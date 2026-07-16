-- ============================================================
-- TOPSPIN — Supabase schéma (izolovaná predponou topspin_)
-- Bezpečné pridať do EXISTUJÚCEHO projektu: nič s predponou topspin_
-- nekoliduje s tvojimi tabuľkami. Spusti celé naraz v SQL Editor.
-- ============================================================
create extension if not exists pgcrypto;

create table if not exists public.topspin_tournaments (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  data jsonb not null,
  admin_pin text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.topspin_app_config (
  key text primary key,
  value text not null
);

alter table public.topspin_tournaments enable row level security;
alter table public.topspin_app_config enable row level security;
-- zámerne žiadne RLS policy => priamy prístup cez anon kľúč je zamietnutý;
-- všetko ide cez security-definer funkcie nižšie (nevrátia admin_pin ani kód)

create or replace function public.topspin_slugify(txt text) returns text
language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(translate(coalesce(txt,''),
    'áäčďéěíĺľňóôŕšťúůýžÁÄČĎÉĚÍĹĽŇÓÔŔŠŤÚŮÝŽ',
    'aacdeeillnoorstuuyzaacdeeillnoorstuuyz')),
    '[^a-z0-9]+', '-', 'g'))
$$;

create or replace function public.topspin_list_tournaments()
returns table(id uuid, slug text, name text, date text, updated_at timestamptz)
language sql security definer set search_path = public as $$
  select id, slug, name, coalesce(data->'settings'->>'date','') as date, updated_at
  from public.topspin_tournaments order by updated_at desc
$$;

create or replace function public.topspin_get_tournament(p_slug text)
returns table(slug text, name text, data jsonb)
language sql security definer set search_path = public as $$
  select slug, name, data from public.topspin_tournaments where slug = p_slug
$$;

create or replace function public.topspin_create_tournament(p_name text, p_pin text, p_create_code text)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text; v_slug text; v_name text;
begin
  select value into v_code from public.topspin_app_config where key = 'create_code';
  if v_code is null or v_code <> coalesce(p_create_code,'') then
    raise exception 'Neplatný kód pre zakladanie turnajov.';
  end if;
  if coalesce(trim(p_pin),'') = '' then raise exception 'PIN je povinný.'; end if;
  v_name := coalesce(nullif(trim(p_name),''),'Turnaj');
  v_slug := public.topspin_slugify(v_name);
  if v_slug = '' then v_slug := 'turnaj'; end if;
  v_slug := v_slug || '-' || substr(md5(random()::text),1,5);
  insert into public.topspin_tournaments(slug, name, data, admin_pin)
  values (v_slug, v_name,
    jsonb_build_object(
      'version', 5,
      'settings', jsonb_build_object('name', v_name, 'date', to_char(now(),'YYYY-MM-DD'), 'venue','', 'tables',8, 'matchMinutes',25, 'restMinutes',15),
      'players','[]'::jsonb, 'pairs','[]'::jsonb, 'teams','[]'::jsonb, 'competitions','[]'::jsonb),
    p_pin);
  return v_slug;
end $$;

create or replace function public.topspin_verify_pin(p_slug text, p_pin text)
returns boolean language sql security definer set search_path = public as $$
  select exists(select 1 from public.topspin_tournaments where slug = p_slug and admin_pin = p_pin)
$$;

create or replace function public.topspin_save_tournament(p_slug text, p_data jsonb, p_pin text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.topspin_tournaments set data = p_data, updated_at = now()
  where slug = p_slug and admin_pin = p_pin;
  if not found then raise exception 'Neplatný PIN alebo turnaj neexistuje.'; end if;
end $$;

grant execute on function public.topspin_list_tournaments() to anon, authenticated;
grant execute on function public.topspin_get_tournament(text) to anon, authenticated;
grant execute on function public.topspin_create_tournament(text, text, text) to anon, authenticated;
grant execute on function public.topspin_verify_pin(text, text) to anon, authenticated;
grant execute on function public.topspin_save_tournament(text, jsonb, text) to anon, authenticated;

-- ⚠️ ZMEŇ SI TENTO TAJNÝ KÓD! Zadávaš ho pri zakladaní turnaja.
insert into public.topspin_app_config(key, value) values ('create_code', 'ZMEN-MA-1234')
on conflict (key) do update set value = excluded.value;
