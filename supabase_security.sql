-- ============================================================
-- TOPSPIN — BEZPEČNOSTNÁ AKTUALIZÁCIA
-- Spusti celý súbor v Supabase → SQL Editor. Je bezpečné spustiť
-- ho aj opakovane. Existujúce turnaje a PIN-y ostávajú funkčné.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- B) PIN zašifrovaný + zámok po neúspešných pokusoch ----------
alter table public.topspin_tournaments add column if not exists admin_pin_hash text;
alter table public.topspin_tournaments add column if not exists version int not null default 1;
alter table public.topspin_tournaments add column if not exists updated_at timestamptz not null default now();

-- jednorazová migrácia existujúcich PIN-ov do zašifrovanej podoby
update public.topspin_tournaments
   set admin_pin_hash = crypt(admin_pin, gen_salt('bf'))
 where admin_pin_hash is null and admin_pin is not null;

create table if not exists public.topspin_lockouts (
  slug text primary key,
  fails int not null default 0,
  locked_until timestamptz
);
alter table public.topspin_lockouts enable row level security;

-- história zmien (E) — každé uloženie sa odloží, dá sa vrátiť späť
create table if not exists public.topspin_history (
  id bigserial primary key,
  slug text not null,
  data jsonb not null,
  version int,
  saved_at timestamptz not null default now()
);
alter table public.topspin_history enable row level security;
create index if not exists topspin_history_slug_idx on public.topspin_history(slug, saved_at desc);

-- spoločná kontrola PINu so zámkom: 5 zlých pokusov → 15 minút zamknuté
create or replace function public.topspin_check_pin(p_slug text, p_pin text)
returns boolean language plpgsql security definer set search_path = public as $$
declare rec record; lock_rec record; ok boolean;
begin
  select * into lock_rec from public.topspin_lockouts where slug = p_slug;
  if lock_rec.locked_until is not null and lock_rec.locked_until > now() then
    raise exception 'Príliš veľa nesprávnych pokusov. Skús znova o % minút.',
      ceil(extract(epoch from (lock_rec.locked_until - now())) / 60);
  end if;

  select * into rec from public.topspin_tournaments where slug = p_slug;
  if not found then return false; end if;

  ok := (rec.admin_pin_hash is not null and rec.admin_pin_hash = crypt(p_pin, rec.admin_pin_hash))
     or (rec.admin_pin_hash is null and rec.admin_pin = p_pin);

  if ok then
    delete from public.topspin_lockouts where slug = p_slug;
    return true;
  end if;

  insert into public.topspin_lockouts(slug, fails) values (p_slug, 1)
    on conflict (slug) do update set
      fails = public.topspin_lockouts.fails + 1,
      locked_until = case when public.topspin_lockouts.fails + 1 >= 5 then now() + interval '15 minutes' else null end;
  return false;
end $$;

create or replace function public.topspin_verify_pin(p_slug text, p_pin text)
returns boolean language sql security definer set search_path = public as $$
  select public.topspin_check_pin(p_slug, p_pin)
$$;

-- nový turnaj: PIN sa ukladá už len zašifrovaný
create or replace function public.topspin_create_tournament(p_name text, p_pin text, p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare v_slug text; v_base text; i int := 1;
begin
  if p_code is distinct from (select value from public.topspin_app_config where key = 'create_code') then
    raise exception 'Neplatný kód na vytvorenie turnaja.';
  end if;
  if length(coalesce(p_pin,'')) < 4 then raise exception 'PIN musí mať aspoň 4 znaky.'; end if;

  v_base := regexp_replace(lower(unaccent_safe(p_name)), '[^a-z0-9]+', '-', 'g');
  v_base := trim(both '-' from v_base);
  if v_base = '' then v_base := 'turnaj'; end if;
  v_slug := v_base;
  while exists (select 1 from public.topspin_tournaments where slug = v_slug) loop
    i := i + 1; v_slug := v_base || '-' || i;
  end loop;

  insert into public.topspin_tournaments(slug, name, data, admin_pin, admin_pin_hash)
  values (v_slug, p_name, '{}'::jsonb, null, crypt(p_pin, gen_salt('bf')));
  return v_slug;
end $$;

-- pomocná funkcia na slug bez diakritiky (ak nie je rozšírenie unaccent)
create or replace function public.unaccent_safe(t text)
returns text language sql immutable as $$
  select translate(t,
    'áäčďéěíĺľňóôöŕřšťúůüýžÁÄČĎÉĚÍĹĽŇÓÔÖŔŘŠŤÚŮÜÝŽ',
    'aacdeeillnooorrstuuuyzAACDEEILLNOOORRSTUUUYZ')
$$;

-- ---------- F) uloženie s kontrolou verzie (ochrana proti prepísaniu) ----------
create or replace function public.topspin_save_tournament(p_slug text, p_data jsonb, p_pin text, p_version int default null)
returns int language plpgsql security definer set search_path = public as $$
declare cur int;
begin
  if not public.topspin_check_pin(p_slug, p_pin) then raise exception 'Neplatný PIN.'; end if;

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

  -- ponechaj posledných 50 verzií
  delete from public.topspin_history h
   where h.slug = p_slug
     and h.id not in (select id from public.topspin_history where slug = p_slug order by saved_at desc limit 50);

  return cur + 1;
end $$;

create or replace function public.topspin_get_tournament(p_slug text)
returns table(slug text, name text, data jsonb, version int, updated_at timestamptz)
language sql security definer set search_path = public as $$
  select slug, name, data, version, updated_at from public.topspin_tournaments where slug = p_slug
$$;

-- ---------- E) história: zoznam a návrat späť ----------
create or replace function public.topspin_history_list(p_slug text, p_pin text)
returns table(id bigint, version int, saved_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.topspin_check_pin(p_slug, p_pin) then raise exception 'Neplatný PIN.'; end if;
  return query select h.id, h.version, h.saved_at from public.topspin_history h
               where h.slug = p_slug order by h.saved_at desc limit 50;
end $$;

create or replace function public.topspin_history_restore(p_slug text, p_pin text, p_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d jsonb; cur int;
begin
  if not public.topspin_check_pin(p_slug, p_pin) then raise exception 'Neplatný PIN.'; end if;
  select data into d from public.topspin_history where id = p_id and slug = p_slug;
  if d is null then raise exception 'Verzia sa nenašla.'; end if;
  select version into cur from public.topspin_tournaments where slug = p_slug;
  insert into public.topspin_history(slug, data, version)
    select slug, data, version from public.topspin_tournaments where slug = p_slug;
  update public.topspin_tournaments set data = d, version = cur + 1, updated_at = now() where slug = p_slug;
  return d;
end $$;

-- ---------- ostatné funkcie prejdú na kontrolu cez topspin_check_pin ----------
create or replace function public.topspin_delete_tournament(p_slug text, p_pin text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.topspin_check_pin(p_slug, p_pin) then raise exception 'Neplatný PIN.'; end if;
  delete from public.topspin_tournaments where slug = p_slug;
end $$;

create or replace function public.topspin_registrations_admin(p_slug text, p_pin text)
returns table(id uuid, first_name text, last_name text, club text, birth_year int,
              license_until date, country text, gender text, categories text[], email text, note text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.topspin_check_pin(p_slug, p_pin) then raise exception 'Neplatný PIN.'; end if;
  return query select r.id, r.first_name, r.last_name, r.club, r.birth_year, r.license_until,
                      r.country, r.gender, r.categories, r.email, r.note, r.created_at
               from public.topspin_registrations r where r.slug = p_slug order by r.created_at;
end $$;

create or replace function public.topspin_delete_registration(p_slug text, p_pin text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.topspin_check_pin(p_slug, p_pin) then raise exception 'Neplatný PIN.'; end if;
  delete from public.topspin_registrations where id = p_id and slug = p_slug;
end $$;

create or replace function public.topspin_add_media(p_slug text, p_pin text, p_kind text, p_url text, p_title text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.topspin_check_pin(p_slug, p_pin) then raise exception 'Neplatný PIN.'; end if;
  insert into public.topspin_media(slug, kind, url, title) values (p_slug, p_kind, p_url, coalesce(p_title,''));
end $$;

create or replace function public.topspin_delete_media(p_slug text, p_pin text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.topspin_check_pin(p_slug, p_pin) then raise exception 'Neplatný PIN.'; end if;
  delete from public.topspin_media where id = p_id and slug = p_slug;
end $$;

-- ---------- D) ochrana registrácie: otvorenie/uzávierka + limit ----------
alter table public.topspin_tournaments add column if not exists reg_open boolean not null default true;
alter table public.topspin_tournaments add column if not exists reg_deadline timestamptz;

create or replace function public.topspin_register(
  p_slug text, p_first text, p_last text, p_club text, p_year int,
  p_license date, p_country text, p_gender text, p_categories text[], p_email text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare t record; n int;
begin
  select * into t from public.topspin_tournaments where slug = p_slug;
  if not found then raise exception 'Turnaj neexistuje.'; end if;
  if not t.reg_open then raise exception 'Registrácia na tento turnaj je uzavretá.'; end if;
  if t.reg_deadline is not null and now() > t.reg_deadline then raise exception 'Termín registrácie už uplynul.'; end if;
  if coalesce(btrim(p_first),'') = '' or coalesce(btrim(p_last),'') = '' then
    raise exception 'Meno a priezvisko sú povinné.';
  end if;

  -- ochrana proti duplicite
  if exists (select 1 from public.topspin_registrations r
              where r.slug = p_slug and lower(btrim(r.first_name)) = lower(btrim(p_first))
                and lower(btrim(r.last_name)) = lower(btrim(p_last))) then
    raise exception 'Tento hráč je už prihlásený.';
  end if;

  -- ochrana proti zahlteniu: max 30 prihlášok za minútu na turnaj
  select count(*) into n from public.topspin_registrations
   where slug = p_slug and created_at > now() - interval '1 minute';
  if n > 30 then raise exception 'Príliš veľa prihlášok naraz. Skús o chvíľu.'; end if;

  insert into public.topspin_registrations(slug, first_name, last_name, club, birth_year, license_until, country, gender, categories, email, note)
  values (p_slug, btrim(p_first), btrim(p_last), coalesce(p_club,''), p_year, p_license,
          coalesce(p_country,'Slovensko'), coalesce(p_gender,'M'), coalesce(p_categories,'{}'), p_email, p_note);
end $$;

create or replace function public.topspin_set_registration(p_slug text, p_pin text, p_open boolean, p_deadline timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.topspin_check_pin(p_slug, p_pin) then raise exception 'Neplatný PIN.'; end if;
  update public.topspin_tournaments set reg_open = coalesce(p_open, reg_open), reg_deadline = p_deadline where slug = p_slug;
end $$;

create or replace function public.topspin_registration_state(p_slug text)
returns table(reg_open boolean, reg_deadline timestamptz)
language sql security definer set search_path = public as $$
  select reg_open, reg_deadline from public.topspin_tournaments where slug = p_slug
$$;

-- ---------- C) zamknuté nahrávanie súborov ----------
-- Anonymné nahrávanie sa ruší. Súbory nahráva len organizátor cez
-- serverovú funkciu (Netlify), ktorá si najprv overí PIN.
drop policy if exists "topspin_media_write" on storage.objects;

-- ---------- práva ----------
grant execute on function public.topspin_check_pin(text,text) to anon, authenticated;
grant execute on function public.topspin_verify_pin(text,text) to anon, authenticated;
grant execute on function public.topspin_get_tournament(text) to anon, authenticated;
grant execute on function public.topspin_save_tournament(text,jsonb,text,int) to anon, authenticated;
grant execute on function public.topspin_create_tournament(text,text,text) to anon, authenticated;
grant execute on function public.topspin_delete_tournament(text,text) to anon, authenticated;
grant execute on function public.topspin_history_list(text,text) to anon, authenticated;
grant execute on function public.topspin_history_restore(text,text,bigint) to anon, authenticated;
grant execute on function public.topspin_set_registration(text,text,boolean,timestamptz) to anon, authenticated;
grant execute on function public.topspin_registration_state(text) to anon, authenticated;
grant execute on function public.unaccent_safe(text) to anon, authenticated;
