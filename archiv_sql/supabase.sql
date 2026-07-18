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

create or replace function public.topspin_delete_tournament(p_slug text, p_pin text)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.topspin_tournaments where slug = p_slug and admin_pin = p_pin;
  if not found then raise exception 'Neplatný PIN alebo turnaj neexistuje.'; end if;
end $$;

grant execute on function public.topspin_list_tournaments() to anon, authenticated;
grant execute on function public.topspin_get_tournament(text) to anon, authenticated;
grant execute on function public.topspin_create_tournament(text, text, text) to anon, authenticated;
grant execute on function public.topspin_verify_pin(text, text) to anon, authenticated;
grant execute on function public.topspin_save_tournament(text, jsonb, text) to anon, authenticated;
grant execute on function public.topspin_delete_tournament(text, text) to anon, authenticated;

-- ⚠️ ZMEŇ SI TENTO TAJNÝ KÓD! Zadávaš ho pri zakladaní turnaja.
insert into public.topspin_app_config(key, value) values ('create_code', 'ZMEN-MA-1234')
on conflict (key) do update set value = excluded.value;

-- ============================================================
-- Spoločná databáza hráčov (naprieč turnajmi) — pridané neskôr
-- ============================================================
create table if not exists public.topspin_players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_key text unique not null,
  club text default '',
  rating int default 0,
  gender text default 'M',
  photo text,
  updated_at timestamptz not null default now()
);
alter table public.topspin_players enable row level security;

create or replace function public.topspin_search_players(q text)
returns table(name text, club text, rating int, gender text, photo text)
language sql security definer set search_path = public as $$
  select name, club, rating, gender, photo from public.topspin_players
  where coalesce(q,'') = '' or name ilike '%' || q || '%'
  order by name limit 500
$$;

create or replace function public.topspin_upsert_player(p_name text, p_club text, p_rating int, p_gender text, p_photo text)
returns void language plpgsql security definer set search_path = public as $$
declare k text;
begin
  k := lower(btrim(coalesce(p_name,'')));
  if k = '' then return; end if;
  insert into public.topspin_players(name, name_key, club, rating, gender, photo)
  values (btrim(p_name), k, coalesce(p_club,''), coalesce(p_rating,0), coalesce(p_gender,'M'), p_photo)
  on conflict (name_key) do update set
    club = excluded.club, rating = excluded.rating, gender = excluded.gender,
    photo = coalesce(excluded.photo, public.topspin_players.photo), updated_at = now();
end $$;

grant execute on function public.topspin_search_players(text) to anon, authenticated;
grant execute on function public.topspin_upsert_player(text, text, int, text, text) to anon, authenticated;

-- ============================================================
-- REGISTRÁCIA DO TURNAJA + MÉDIÁ (propozície / galéria / videá)
-- Súbory idú do Supabase Storage, v DB je len odkaz → turnajové
-- JSON ostáva malé a stránka sa nespomaľuje.
-- ============================================================

create table if not exists public.topspin_registrations (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  first_name text not null,
  last_name text not null,
  club text default '',
  birth_year int,
  license_until date,
  country text default 'Slovensko',
  gender text default 'M',
  categories text[] default '{}',
  email text,
  note text,
  created_at timestamptz not null default now()
);
alter table public.topspin_registrations enable row level security;
create index if not exists topspin_reg_slug_idx on public.topspin_registrations(slug);

create table if not exists public.topspin_media (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  kind text not null check (kind in ('propozicie','photo','video')),
  url text not null,
  title text default '',
  created_at timestamptz not null default now()
);
alter table public.topspin_media enable row level security;
create index if not exists topspin_media_slug_idx on public.topspin_media(slug);

-- verejné: zoznam registrovaných BEZ e-mailu a poznámky
create or replace function public.topspin_list_registrations(p_slug text)
returns table(id uuid, first_name text, last_name text, club text, birth_year int,
              license_until date, country text, gender text, categories text[], created_at timestamptz)
language sql security definer set search_path = public as $$
  select id, first_name, last_name, club, birth_year, license_until, country, gender, categories, created_at
  from public.topspin_registrations where slug = p_slug order by created_at
$$;

-- verejné: prihlásenie sa na turnaj
create or replace function public.topspin_register(
  p_slug text, p_first text, p_last text, p_club text, p_year int,
  p_license date, p_country text, p_gender text, p_categories text[], p_email text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.topspin_tournaments where slug = p_slug) then
    raise exception 'Turnaj neexistuje.';
  end if;
  if coalesce(btrim(p_first),'') = '' or coalesce(btrim(p_last),'') = '' then
    raise exception 'Meno a priezvisko sú povinné.';
  end if;
  insert into public.topspin_registrations(slug, first_name, last_name, club, birth_year, license_until, country, gender, categories, email, note)
  values (p_slug, btrim(p_first), btrim(p_last), coalesce(p_club,''), p_year, p_license,
          coalesce(p_country,'Slovensko'), coalesce(p_gender,'M'), coalesce(p_categories,'{}'), p_email, p_note);
end $$;

-- pre organizátora (PIN): kompletné údaje vrátane e-mailu
create or replace function public.topspin_registrations_admin(p_slug text, p_pin text)
returns table(id uuid, first_name text, last_name text, club text, birth_year int,
              license_until date, country text, gender text, categories text[], email text, note text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.topspin_tournaments t where t.slug = p_slug and t.admin_pin = p_pin) then
    raise exception 'Neplatný PIN.';
  end if;
  return query select r.id, r.first_name, r.last_name, r.club, r.birth_year, r.license_until,
                      r.country, r.gender, r.categories, r.email, r.note, r.created_at
               from public.topspin_registrations r where r.slug = p_slug order by r.created_at;
end $$;

create or replace function public.topspin_delete_registration(p_slug text, p_pin text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.topspin_tournaments t where t.slug = p_slug and t.admin_pin = p_pin) then
    raise exception 'Neplatný PIN.';
  end if;
  delete from public.topspin_registrations where id = p_id and slug = p_slug;
end $$;

create or replace function public.topspin_list_media(p_slug text)
returns table(id uuid, kind text, url text, title text, created_at timestamptz)
language sql security definer set search_path = public as $$
  select id, kind, url, title, created_at from public.topspin_media where slug = p_slug order by created_at
$$;

create or replace function public.topspin_add_media(p_slug text, p_pin text, p_kind text, p_url text, p_title text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.topspin_tournaments t where t.slug = p_slug and t.admin_pin = p_pin) then
    raise exception 'Neplatný PIN.';
  end if;
  insert into public.topspin_media(slug, kind, url, title) values (p_slug, p_kind, p_url, coalesce(p_title,''));
end $$;

create or replace function public.topspin_delete_media(p_slug text, p_pin text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.topspin_tournaments t where t.slug = p_slug and t.admin_pin = p_pin) then
    raise exception 'Neplatný PIN.';
  end if;
  delete from public.topspin_media where id = p_id and slug = p_slug;
end $$;

grant execute on function public.topspin_list_registrations(text) to anon, authenticated;
grant execute on function public.topspin_register(text,text,text,text,int,date,text,text,text[],text,text) to anon, authenticated;
grant execute on function public.topspin_registrations_admin(text,text) to anon, authenticated;
grant execute on function public.topspin_delete_registration(text,text,uuid) to anon, authenticated;
grant execute on function public.topspin_list_media(text) to anon, authenticated;
grant execute on function public.topspin_add_media(text,text,text,text,text) to anon, authenticated;
grant execute on function public.topspin_delete_media(text,text,uuid) to anon, authenticated;

-- Úložisko súborov (PDF propozície, fotky). Verejné na čítanie.
insert into storage.buckets (id, name, public) values ('topspin-media','topspin-media', true)
  on conflict (id) do nothing;
drop policy if exists "topspin_media_read" on storage.objects;
create policy "topspin_media_read" on storage.objects for select using (bucket_id = 'topspin-media');
drop policy if exists "topspin_media_write" on storage.objects;
create policy "topspin_media_write" on storage.objects for insert with check (bucket_id = 'topspin-media');
