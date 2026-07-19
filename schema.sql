-- ============================================================
-- TOPSPIN — JEDINÁ SCHÉMA DATABÁZY
--
-- Toto je jediný SQL súbor, ktorý sa spúšťa. Nahrádza všetky
-- predchádzajúce (supabase.sql, supabase_security.sql,
-- supabase_prihlasenie.sql, supabase_pristup.sql, supabase_konto.sql,
-- supabase_oprava_pin.sql, supabase_upratanie.sql).
--
-- Dá sa spustiť opakovane — vždy nastaví databázu do správneho stavu.
-- Turnaje, výsledky ani registrácie sa nestratia.
--
-- Prístup: prihlásenie e-mailom a heslom. PIN neexistuje.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;


-- ============================================================
-- 1) TABUĽKY
-- ============================================================

create table if not exists public.topspin_tournaments (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  data jsonb not null default '{}'::jsonb,
  owner_id uuid,
  version int not null default 1,
  reg_open boolean not null default true,
  reg_deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.topspin_tournaments add column if not exists owner_id uuid;
alter table public.topspin_tournaments add column if not exists version int not null default 1;
alter table public.topspin_tournaments add column if not exists reg_open boolean not null default true;
alter table public.topspin_tournaments add column if not exists reg_deadline timestamptz;
alter table public.topspin_tournaments alter column data set default '{}'::jsonb;

-- zvyšky po PINe (ak ešte existujú)
alter table public.topspin_tournaments drop column if exists admin_pin;
alter table public.topspin_tournaments drop column if exists admin_pin_hash;
drop table if exists public.topspin_lockouts;

create table if not exists public.topspin_app_config (
  key text primary key,
  value text not null
);

-- kto smie zakladať nové turnaje
create table if not exists public.topspin_creators (
  email text primary key,
  created_at timestamptz not null default now()
);

-- kto má prístup ku konkrétnemu turnaju
create table if not exists public.topspin_access (
  slug text not null,
  email text not null,
  role text not null default 'scorer',
  created_at timestamptz not null default now(),
  primary key (slug, email)
);

-- spoločná databáza hráčov
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

-- prihlášky na turnaj
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
  checked_in boolean not null default false,
  paid boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.topspin_registrations add column if not exists checked_in boolean not null default false;
alter table public.topspin_registrations add column if not exists paid boolean not null default false;
create index if not exists topspin_reg_slug_idx on public.topspin_registrations(slug);

-- propozície, galéria, videá (v DB len odkaz, súbory sú v úložisku)
create table if not exists public.topspin_media (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  kind text not null check (kind in ('propozicie','photo','video')),
  url text not null,
  title text default '',
  created_at timestamptz not null default now()
);
create index if not exists topspin_media_slug_idx on public.topspin_media(slug);

-- história uložení (posledných 50 verzií na turnaj)
create table if not exists public.topspin_history (
  id bigserial primary key,
  slug text not null,
  data jsonb not null,
  version int,
  saved_at timestamptz not null default now()
);
create index if not exists topspin_history_slug_idx on public.topspin_history(slug, saved_at desc);

-- Priamy prístup cez anon kľúč je zamietnutý (žiadne RLS policy).
-- Všetko ide cez security-definer funkcie nižšie.
alter table public.topspin_tournaments  enable row level security;
alter table public.topspin_app_config    enable row level security;
alter table public.topspin_creators      enable row level security;
alter table public.topspin_access        enable row level security;
alter table public.topspin_players       enable row level security;
alter table public.topspin_registrations enable row level security;
alter table public.topspin_media         enable row level security;
alter table public.topspin_history       enable row level security;


-- ============================================================
-- 2) POMOCNÉ FUNKCIE A KONTROLA PRÍSTUPU
-- ============================================================

create or replace function public.unaccent_safe(t text)
returns text language sql immutable as $$
  select translate(t,
    'áäčďéěíĺľňóôöŕřšťúůüýžÁÄČĎÉĚÍĹĽŇÓÔÖŔŘŠŤÚŮÜÝŽ',
    'aacdeeillnooorrstuuuyzAACDEEILLNOOORRSTUUUYZ')
$$;

-- Má prihlásený používateľ právo upravovať tento turnaj?
create or replace function public.topspin_can_edit(p_slug text)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.topspin_tournaments t
     where t.slug = p_slug
       and (
         (t.owner_id is not null and t.owner_id = auth.uid())
         or exists (
           select 1 from public.topspin_access a
            where a.slug = p_slug
              and lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
         )
       )
  )
$$;

create or replace function public.topspin_require_edit(p_slug text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Musíš byť prihlásený.'; end if;
  if not public.topspin_can_edit(p_slug) then raise exception 'Na tento turnaj nemáš prístup.'; end if;
end $$;

-- Smie prihlásený používateľ zakladať turnaje?
create or replace function public.topspin_can_create()
returns boolean language sql security definer stable set search_path = public as $$
  select auth.uid() is not null
     and exists (
       select 1 from public.topspin_creators c
        where lower(c.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
     )
$$;


-- ============================================================
-- 3) TURNAJE
-- ============================================================

-- Zoznam turnajov pre úvodnú stránku: dátum, miesto, kategórie a stav.
drop function if exists public.topspin_list_tournaments();
create function public.topspin_list_tournaments()
returns table(slug text, name text, t_date text, venue text, address text,
              categories text[], reg_open boolean, reg_deadline timestamptz,
              has_propozicie boolean, has_gallery boolean, has_video boolean, updated_at timestamptz)
language sql security definer stable set search_path = public as $$
  select t.slug,
         t.name,
         nullif(t.data->'settings'->>'date','')    as t_date,
         nullif(t.data->'settings'->>'venue','')   as venue,
         nullif(t.data->'settings'->>'address','') as address,
         coalesce((select array_agg(x->>'name' order by ord)
                     from jsonb_array_elements(coalesce(t.data->'competitions','[]'::jsonb))
                          with ordinality as e(x, ord)
                    where coalesce(x->>'name','') <> ''), '{}') as categories,
         t.reg_open,
         t.reg_deadline,
         exists (select 1 from public.topspin_media m where m.slug = t.slug and m.kind = 'propozicie') as has_propozicie,
         exists (select 1 from public.topspin_media m where m.slug = t.slug and m.kind = 'photo')      as has_gallery,
         exists (select 1 from public.topspin_media m where m.slug = t.slug and m.kind = 'video')      as has_video,
         t.updated_at
    from public.topspin_tournaments t
   order by coalesce(nullif(t.data->'settings'->>'date','')::date, t.updated_at::date) desc
$$;

drop function if exists public.topspin_get_tournament(text);
create function public.topspin_get_tournament(p_slug text)
returns table(slug text, name text, data jsonb, version int, updated_at timestamptz)
language sql security definer stable set search_path = public as $$
  select slug, name, data, version, updated_at from public.topspin_tournaments where slug = p_slug
$$;

drop function if exists public.topspin_my_tournaments();
create function public.topspin_my_tournaments()
returns table(slug text, name text, updated_at timestamptz, role text)
language sql security definer stable set search_path = public as $$
  select t.slug, t.name, t.updated_at,
         case when t.owner_id = auth.uid() then 'owner'
              else coalesce((select a.role from public.topspin_access a
                              where a.slug = t.slug
                                and lower(a.email) = lower(coalesce(auth.jwt() ->> 'email',''))), 'scorer') end
    from public.topspin_tournaments t
   where t.owner_id = auth.uid()
      or exists (select 1 from public.topspin_access a
                  where a.slug = t.slug and lower(a.email) = lower(coalesce(auth.jwt() ->> 'email','')))
   order by t.updated_at desc
$$;

drop function if exists public.topspin_create_tournament(text);
drop function if exists public.topspin_create_tournament(text, text, text);
create function public.topspin_create_tournament(p_name text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_slug text; v_base text; i int := 1;
begin
  if auth.uid() is null then raise exception 'Najprv sa prihlás.'; end if;
  if not public.topspin_can_create() then
    raise exception 'Tvoj e-mail nemá povolenie zakladať turnaje.';
  end if;

  v_base := regexp_replace(lower(public.unaccent_safe(p_name)), '[^a-z0-9]+', '-', 'g');
  v_base := trim(both '-' from v_base);
  if v_base = '' then v_base := 'turnaj'; end if;
  v_slug := v_base;
  while exists (select 1 from public.topspin_tournaments where slug = v_slug) loop
    i := i + 1; v_slug := v_base || '-' || i;
  end loop;

  insert into public.topspin_tournaments(slug, name, data, owner_id)
  values (v_slug, p_name, '{}'::jsonb, auth.uid());
  return v_slug;
end $$;

-- Uloženie s kontrolou verzie: dvaja zapisovatelia si neprepíšu prácu.
drop function if exists public.topspin_save_tournament(text, jsonb, integer);
drop function if exists public.topspin_save_tournament(text, jsonb, text);
drop function if exists public.topspin_save_tournament(text, jsonb, text, integer);
create function public.topspin_save_tournament(p_slug text, p_data jsonb, p_version int default null)
returns int language plpgsql security definer set search_path = public as $$
declare cur int;
begin
  perform public.topspin_require_edit(p_slug);
  select version into cur from public.topspin_tournaments where slug = p_slug for update;
  if cur is null then raise exception 'Turnaj neexistuje.'; end if;
  if p_version is not null and p_version <> cur then
    raise exception 'CONFLICT: turnaj bol medzitým zmenený (verzia % vs %).', p_version, cur;
  end if;

  insert into public.topspin_history(slug, data, version)
    select slug, data, version from public.topspin_tournaments where slug = p_slug;

  update public.topspin_tournaments
     set data = p_data, version = cur + 1, updated_at = now()
   where slug = p_slug;

  delete from public.topspin_history h
   where h.slug = p_slug
     and h.id not in (select id from public.topspin_history where slug = p_slug order by saved_at desc limit 50);
  return cur + 1;
end $$;

drop function if exists public.topspin_delete_tournament(text);
drop function if exists public.topspin_delete_tournament(text, text);
create function public.topspin_delete_tournament(p_slug text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.topspin_require_edit(p_slug);
  delete from public.topspin_tournaments where slug = p_slug;
end $$;


-- ============================================================
-- 4) HISTÓRIA ZMIEN
-- ============================================================

drop function if exists public.topspin_history_list(text);
drop function if exists public.topspin_history_list(text, text);
create function public.topspin_history_list(p_slug text)
returns table(id bigint, version int, saved_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  perform public.topspin_require_edit(p_slug);
  return query select h.id, h.version, h.saved_at from public.topspin_history h
                where h.slug = p_slug order by h.saved_at desc limit 50;
end $$;

drop function if exists public.topspin_history_restore(text, bigint);
drop function if exists public.topspin_history_restore(text, text, bigint);
create function public.topspin_history_restore(p_slug text, p_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d jsonb; cur int;
begin
  perform public.topspin_require_edit(p_slug);
  select data into d from public.topspin_history where id = p_id and slug = p_slug;
  if d is null then raise exception 'Verzia sa nenašla.'; end if;
  select version into cur from public.topspin_tournaments where slug = p_slug;
  insert into public.topspin_history(slug, data, version)
    select slug, data, version from public.topspin_tournaments where slug = p_slug;
  update public.topspin_tournaments set data = d, version = cur + 1, updated_at = now() where slug = p_slug;
  return d;
end $$;


-- ============================================================
-- 5) PRÍSTUPY A ZAKLADATELIA
-- ============================================================

drop function if exists public.topspin_list_access(text);
create function public.topspin_list_access(p_slug text)
returns table(email text, role text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  perform public.topspin_require_edit(p_slug);
  return query select a.email, a.role, a.created_at from public.topspin_access a
                where a.slug = p_slug order by a.created_at;
end $$;

create or replace function public.topspin_add_access(p_slug text, p_email text, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.topspin_require_edit(p_slug);
  insert into public.topspin_access(slug, email, role)
  values (p_slug, lower(btrim(p_email)), coalesce(p_role,'scorer'))
  on conflict (slug, email) do update set role = excluded.role;
end $$;

create or replace function public.topspin_remove_access(p_slug text, p_email text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.topspin_require_edit(p_slug);
  delete from public.topspin_access where slug = p_slug and lower(email) = lower(btrim(p_email));
end $$;

drop function if exists public.topspin_list_creators();
create function public.topspin_list_creators()
returns table(email text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.topspin_can_create() then raise exception 'Nemáš oprávnenie.'; end if;
  return query select c.email, c.created_at from public.topspin_creators c order by c.created_at;
end $$;

create or replace function public.topspin_add_creator(p_email text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.topspin_can_create() then raise exception 'Nemáš oprávnenie.'; end if;
  insert into public.topspin_creators(email) values (lower(btrim(p_email))) on conflict do nothing;
end $$;

create or replace function public.topspin_remove_creator(p_email text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.topspin_can_create() then raise exception 'Nemáš oprávnenie.'; end if;
  if lower(btrim(p_email)) = lower(coalesce(auth.jwt() ->> 'email','')) then
    raise exception 'Seba zo zoznamu odobrať nemôžeš.';
  end if;
  delete from public.topspin_creators where lower(email) = lower(btrim(p_email));
end $$;


-- ============================================================
-- 6) DATABÁZA HRÁČOV
-- ============================================================

drop function if exists public.topspin_search_players(text);
create function public.topspin_search_players(q text)
returns table(name text, club text, rating int, gender text, photo text)
language sql security definer stable set search_path = public as $$
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


-- ============================================================
-- 7) REGISTRÁCIA NA TURNAJ
-- ============================================================

drop function if exists public.topspin_list_registrations(text);
create function public.topspin_list_registrations(p_slug text)
returns table(id uuid, first_name text, last_name text, club text, birth_year int,
              license_until date, country text, gender text, categories text[], created_at timestamptz)
language sql security definer stable set search_path = public as $$
  select id, first_name, last_name, club, birth_year, license_until, country, gender, categories, created_at
    from public.topspin_registrations where slug = p_slug order by created_at
$$;

drop function if exists public.topspin_registration_state(text);
create function public.topspin_registration_state(p_slug text)
returns table(reg_open boolean, reg_deadline timestamptz)
language sql security definer stable set search_path = public as $$
  select reg_open, reg_deadline from public.topspin_tournaments where slug = p_slug
$$;

-- Verejné prihlásenie na turnaj. Uzavrie sa ručne, termínom uzávierky
-- alebo automaticky začiatkom turnaja.
drop function if exists public.topspin_register(text, text, text, text, integer, date, text, text, text[], text, text);
create function public.topspin_register(
  p_slug text, p_first text, p_last text, p_club text, p_year int,
  p_license date, p_country text, p_gender text, p_categories text[], p_email text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare t record; n int; start_ts timestamptz;
begin
  select * into t from public.topspin_tournaments where slug = p_slug;
  if not found then raise exception 'Turnaj neexistuje.'; end if;
  if not t.reg_open then raise exception 'Registrácia na tento turnaj je uzavretá.'; end if;
  if t.reg_deadline is not null and now() > t.reg_deadline then raise exception 'Termín registrácie už uplynul.'; end if;

  begin
    start_ts := ((t.data->'settings'->>'date') || ' ' ||
                 coalesce(nullif(t.data->'settings'->>'startTime',''), '00:00'))::timestamptz;
  exception when others then start_ts := null;
  end;
  if start_ts is not null and now() >= start_ts then
    raise exception 'Registrácia je uzavretá — turnaj sa už začal.';
  end if;

  if coalesce(btrim(p_first),'') = '' or coalesce(btrim(p_last),'') = '' then
    raise exception 'Meno a priezvisko sú povinné.';
  end if;
  if exists (select 1 from public.topspin_registrations r
              where r.slug = p_slug and lower(btrim(r.first_name)) = lower(btrim(p_first))
                and lower(btrim(r.last_name)) = lower(btrim(p_last))) then
    raise exception 'Tento hráč je už prihlásený.';
  end if;
  select count(*) into n from public.topspin_registrations
   where slug = p_slug and created_at > now() - interval '1 minute';
  if n > 30 then raise exception 'Príliš veľa prihlášok naraz. Skús o chvíľu.'; end if;

  insert into public.topspin_registrations(slug, first_name, last_name, club, birth_year, license_until, country, gender, categories, email, note)
  values (p_slug, btrim(p_first), btrim(p_last), coalesce(p_club,''), p_year, p_license,
          coalesce(p_country,'Slovensko'), coalesce(p_gender,'M'), coalesce(p_categories,'{}'), p_email, p_note);
end $$;

drop function if exists public.topspin_registrations_admin(text);
drop function if exists public.topspin_registrations_admin(text, text);
create function public.topspin_registrations_admin(p_slug text)
returns table(id uuid, first_name text, last_name text, club text, birth_year int,
              license_until date, country text, gender text, categories text[], email text, note text,
              checked_in boolean, paid boolean, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  perform public.topspin_require_edit(p_slug);
  return query select r.id, r.first_name, r.last_name, r.club, r.birth_year, r.license_until,
                      r.country, r.gender, r.categories, r.email, r.note, r.checked_in, r.paid, r.created_at
               from public.topspin_registrations r where r.slug = p_slug order by r.last_name, r.first_name;
end $$;

drop function if exists public.topspin_delete_registration(text, uuid);
drop function if exists public.topspin_delete_registration(text, text, uuid);
create function public.topspin_delete_registration(p_slug text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.topspin_require_edit(p_slug);
  delete from public.topspin_registrations where id = p_id and slug = p_slug;
end $$;

drop function if exists public.topspin_set_registration_flags(text, uuid, boolean, boolean);
drop function if exists public.topspin_set_registration_flags(text, text, uuid, boolean, boolean);
create function public.topspin_set_registration_flags(p_slug text, p_id uuid, p_checked boolean, p_paid boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.topspin_require_edit(p_slug);
  update public.topspin_registrations
     set checked_in = coalesce(p_checked, checked_in), paid = coalesce(p_paid, paid)
   where id = p_id and slug = p_slug;
end $$;

drop function if exists public.topspin_set_registration(text, boolean, timestamptz);
drop function if exists public.topspin_set_registration(text, text, boolean, timestamptz);
create function public.topspin_set_registration(p_slug text, p_open boolean, p_deadline timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.topspin_require_edit(p_slug);
  update public.topspin_tournaments
     set reg_open = coalesce(p_open, reg_open), reg_deadline = p_deadline
   where slug = p_slug;
end $$;


-- ============================================================
-- 8) MÉDIÁ (propozície, galéria, videá)
-- ============================================================

drop function if exists public.topspin_list_media(text);
create function public.topspin_list_media(p_slug text)
returns table(id uuid, kind text, url text, title text, created_at timestamptz)
language sql security definer stable set search_path = public as $$
  select id, kind, url, title, created_at from public.topspin_media where slug = p_slug order by created_at
$$;

drop function if exists public.topspin_add_media(text, text, text, text);
drop function if exists public.topspin_add_media(text, text, text, text, text);
create function public.topspin_add_media(p_slug text, p_kind text, p_url text, p_title text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.topspin_require_edit(p_slug);
  insert into public.topspin_media(slug, kind, url, title) values (p_slug, p_kind, p_url, coalesce(p_title,''));
end $$;

drop function if exists public.topspin_delete_media(text, uuid);
drop function if exists public.topspin_delete_media(text, text, uuid);
create function public.topspin_delete_media(p_slug text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.topspin_require_edit(p_slug);
  delete from public.topspin_media where id = p_id and slug = p_slug;
end $$;


-- ============================================================
-- 9) ÚLOŽISKO SÚBOROV
-- Čítať smie ktokoľvek, nahrávať a mazať len ten, kto má prístup
-- k danému turnaju (cesta k súboru začína jeho slugom).
-- ============================================================

insert into storage.buckets (id, name, public) values ('topspin-media','topspin-media', true)
  on conflict (id) do nothing;

drop policy if exists "topspin_media_read"   on storage.objects;
create policy "topspin_media_read" on storage.objects
  for select using (bucket_id = 'topspin-media');

drop policy if exists "topspin_media_write"  on storage.objects;
create policy "topspin_media_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'topspin-media' and public.topspin_can_edit(split_part(name, '/', 1)));

drop policy if exists "topspin_media_delete" on storage.objects;
create policy "topspin_media_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'topspin-media' and public.topspin_can_edit(split_part(name, '/', 1)));


-- ============================================================
-- 10) PRÁVA
-- ============================================================

grant execute on function public.unaccent_safe(text)                to anon, authenticated;
grant execute on function public.topspin_can_edit(text)             to anon, authenticated;
grant execute on function public.topspin_can_create()               to anon, authenticated;
grant execute on function public.topspin_require_edit(text)         to authenticated;
grant execute on function public.topspin_list_tournaments()         to anon, authenticated;
grant execute on function public.topspin_get_tournament(text)       to anon, authenticated;
grant execute on function public.topspin_list_registrations(text)   to anon, authenticated;
grant execute on function public.topspin_registration_state(text)   to anon, authenticated;
grant execute on function public.topspin_list_media(text)           to anon, authenticated;
grant execute on function public.topspin_search_players(text)       to anon, authenticated;
grant execute on function public.topspin_upsert_player(text, text, int, text, text) to anon, authenticated;
grant execute on function public.topspin_register(text, text, text, text, integer, date, text, text, text[], text, text) to anon, authenticated;

grant execute on function public.topspin_my_tournaments()           to authenticated;
grant execute on function public.topspin_create_tournament(text)    to authenticated;
grant execute on function public.topspin_save_tournament(text, jsonb, integer) to authenticated;
grant execute on function public.topspin_delete_tournament(text)    to authenticated;
grant execute on function public.topspin_history_list(text)         to authenticated;
grant execute on function public.topspin_history_restore(text, bigint) to authenticated;
grant execute on function public.topspin_list_access(text)          to authenticated;
grant execute on function public.topspin_add_access(text, text, text) to authenticated;
grant execute on function public.topspin_remove_access(text, text)  to authenticated;
grant execute on function public.topspin_list_creators()            to authenticated;
grant execute on function public.topspin_add_creator(text)          to authenticated;
grant execute on function public.topspin_remove_creator(text)       to authenticated;
grant execute on function public.topspin_registrations_admin(text)  to authenticated;
grant execute on function public.topspin_delete_registration(text, uuid) to authenticated;
grant execute on function public.topspin_set_registration_flags(text, uuid, boolean, boolean) to authenticated;
grant execute on function public.topspin_set_registration(text, boolean, timestamptz) to authenticated;
grant execute on function public.topspin_add_media(text, text, text, text) to authenticated;
grant execute on function public.topspin_delete_media(text, uuid)   to authenticated;


-- ============================================================
-- 11) KONTROLA
-- ============================================================

select 'turnajov' as co, count(*)::text as hodnota from public.topspin_tournaments
union all select 'bez vlastníka', count(*)::text from public.topspin_tournaments where owner_id is null
union all select 'zakladateľov',  count(*)::text from public.topspin_creators
union all select 'hráčov v DB',   count(*)::text from public.topspin_players;
