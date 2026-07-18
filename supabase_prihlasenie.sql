-- ============================================================
-- TOPSPIN — PRIHLÁSENIE E-MAILOM (nahrádza PIN)
-- Prístup do turnaja má odteraz iba prihlásený používateľ:
--   • vlastník turnaja (kto ho vytvoril), alebo
--   • e-mail, ktorý vlastník pozval (rozhodca / spoluorganizátor).
-- Spusti celý súbor. Turnaje ani výsledky sa nestratia.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- vlastníctvo a pozvaní používatelia ----------
alter table public.topspin_tournaments add column if not exists owner_id uuid;

create table if not exists public.topspin_access (
  slug text not null,
  email text not null,
  role text not null default 'scorer',           -- 'admin' = plné práva, 'scorer' = zapisovanie
  created_at timestamptz not null default now(),
  primary key (slug, email)
);
alter table public.topspin_access enable row level security;

-- ---------- centrálna kontrola prístupu ----------
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

-- ---------- vytvorenie turnaja: vlastníkom je prihlásený používateľ ----------
drop function if exists public.topspin_create_tournament(text, text, text);
drop function if exists public.topspin_create_tournament(text);
create function public.topspin_create_tournament(p_name text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_slug text; v_base text; i int := 1;
begin
  if auth.uid() is null then raise exception 'Na vytvorenie turnaja sa musíš prihlásiť.'; end if;

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

-- ---------- prevzatie starých turnajov pomocou pôvodného PINu ----------
-- Jednorazovo: prihlásený používateľ zadá starý PIN a stane sa vlastníkom.
create or replace function public.topspin_claim_tournament(p_slug text, p_pin text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare rec record; ok boolean := false;
begin
  if auth.uid() is null then raise exception 'Najprv sa prihlás.'; end if;
  select * into rec from public.topspin_tournaments where slug = p_slug;
  if not found then raise exception 'Turnaj neexistuje.'; end if;
  if rec.owner_id is not null then raise exception 'Turnaj už má vlastníka.'; end if;

  if rec.admin_pin_hash is not null then
    begin ok := (rec.admin_pin_hash = crypt(p_pin, rec.admin_pin_hash)); exception when others then ok := false; end;
  end if;
  if not ok and rec.admin_pin is not null then ok := (rec.admin_pin = p_pin); end if;
  if not ok then raise exception 'Neplatný PIN.'; end if;

  update public.topspin_tournaments set owner_id = auth.uid() where slug = p_slug;
end $$;

-- ---------- zoznam mojich turnajov ----------
create or replace function public.topspin_my_tournaments()
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

-- ---------- pozývanie ďalších používateľov ----------
create or replace function public.topspin_list_access(p_slug text)
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
  insert into public.topspin_access(slug, email, role) values (p_slug, lower(btrim(p_email)), coalesce(p_role,'scorer'))
  on conflict (slug, email) do update set role = excluded.role;
end $$;

create or replace function public.topspin_remove_access(p_slug text, p_email text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.topspin_require_edit(p_slug);
  delete from public.topspin_access where slug = p_slug and lower(email) = lower(btrim(p_email));
end $$;

-- ============================================================
-- PREPIS FUNKCIÍ: namiesto PINu sa kontroluje prihlásený používateľ
-- ============================================================

drop function if exists public.topspin_save_tournament(text, jsonb, text);
drop function if exists public.topspin_save_tournament(text, jsonb, text, integer);
drop function if exists public.topspin_save_tournament(text, jsonb, integer);
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

  update public.topspin_tournaments set data = p_data, version = cur + 1, updated_at = now() where slug = p_slug;

  delete from public.topspin_history h
   where h.slug = p_slug
     and h.id not in (select id from public.topspin_history where slug = p_slug order by saved_at desc limit 50);
  return cur + 1;
end $$;

drop function if exists public.topspin_delete_tournament(text, text);
drop function if exists public.topspin_delete_tournament(text);
create function public.topspin_delete_tournament(p_slug text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.topspin_require_edit(p_slug);
  delete from public.topspin_tournaments where slug = p_slug;
end $$;

drop function if exists public.topspin_registrations_admin(text, text);
drop function if exists public.topspin_registrations_admin(text);
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

drop function if exists public.topspin_delete_registration(text, text, uuid);
drop function if exists public.topspin_delete_registration(text, uuid);
create function public.topspin_delete_registration(p_slug text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.topspin_require_edit(p_slug);
  delete from public.topspin_registrations where id = p_id and slug = p_slug;
end $$;

drop function if exists public.topspin_set_registration_flags(text, text, uuid, boolean, boolean);
drop function if exists public.topspin_set_registration_flags(text, uuid, boolean, boolean);
create function public.topspin_set_registration_flags(p_slug text, p_id uuid, p_checked boolean, p_paid boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.topspin_require_edit(p_slug);
  update public.topspin_registrations
     set checked_in = coalesce(p_checked, checked_in), paid = coalesce(p_paid, paid)
   where id = p_id and slug = p_slug;
end $$;

drop function if exists public.topspin_set_registration(text, text, boolean, timestamptz);
drop function if exists public.topspin_set_registration(text, boolean, timestamptz);
create function public.topspin_set_registration(p_slug text, p_open boolean, p_deadline timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.topspin_require_edit(p_slug);
  update public.topspin_tournaments set reg_open = coalesce(p_open, reg_open), reg_deadline = p_deadline where slug = p_slug;
end $$;

drop function if exists public.topspin_add_media(text, text, text, text, text);
drop function if exists public.topspin_add_media(text, text, text, text);
create function public.topspin_add_media(p_slug text, p_kind text, p_url text, p_title text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.topspin_require_edit(p_slug);
  insert into public.topspin_media(slug, kind, url, title) values (p_slug, p_kind, p_url, coalesce(p_title,''));
end $$;

drop function if exists public.topspin_delete_media(text, text, uuid);
drop function if exists public.topspin_delete_media(text, uuid);
create function public.topspin_delete_media(p_slug text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.topspin_require_edit(p_slug);
  delete from public.topspin_media where id = p_id and slug = p_slug;
end $$;

drop function if exists public.topspin_history_list(text, text);
drop function if exists public.topspin_history_list(text);
create function public.topspin_history_list(p_slug text)
returns table(id bigint, version int, saved_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  perform public.topspin_require_edit(p_slug);
  return query select h.id, h.version, h.saved_at from public.topspin_history h
                where h.slug = p_slug order by h.saved_at desc limit 50;
end $$;

drop function if exists public.topspin_history_restore(text, text, bigint);
drop function if exists public.topspin_history_restore(text, bigint);
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

-- ---------- úložisko: nahrávať smie len ten, kto má prístup k turnaju ----------
drop policy if exists "topspin_media_write" on storage.objects;
create policy "topspin_media_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'topspin-media' and public.topspin_can_edit(split_part(name, '/', 1)));

drop policy if exists "topspin_media_delete" on storage.objects;
create policy "topspin_media_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'topspin-media' and public.topspin_can_edit(split_part(name, '/', 1)));

-- ---------- práva ----------
grant execute on function public.topspin_can_edit(text) to anon, authenticated;
grant execute on function public.topspin_require_edit(text) to authenticated;
grant execute on function public.topspin_create_tournament(text) to authenticated;
grant execute on function public.topspin_claim_tournament(text, text) to authenticated;
grant execute on function public.topspin_my_tournaments() to authenticated;
grant execute on function public.topspin_list_access(text) to authenticated;
grant execute on function public.topspin_add_access(text, text, text) to authenticated;
grant execute on function public.topspin_remove_access(text, text) to authenticated;
grant execute on function public.topspin_save_tournament(text, jsonb, integer) to authenticated;
grant execute on function public.topspin_delete_tournament(text) to authenticated;
grant execute on function public.topspin_registrations_admin(text) to authenticated;
grant execute on function public.topspin_delete_registration(text, uuid) to authenticated;
grant execute on function public.topspin_set_registration_flags(text, uuid, boolean, boolean) to authenticated;
grant execute on function public.topspin_set_registration(text, boolean, timestamptz) to authenticated;
grant execute on function public.topspin_add_media(text, text, text, text) to authenticated;
grant execute on function public.topspin_delete_media(text, uuid) to authenticated;
grant execute on function public.topspin_history_list(text) to authenticated;
grant execute on function public.topspin_history_restore(text, bigint) to authenticated;

-- ============================================================
-- POSLEDNÝ KROK (spusti až po prvom prihlásení v aplikácii):
-- prevezme všetky doterajšie turnaje pod tvoj e-mail.
-- Nahraď svoj e-mail:
--
-- update public.topspin_tournaments
--    set owner_id = (select id from auth.users where lower(email) = lower('tvoj@email.sk'))
--  where owner_id is null;
-- ============================================================
