-- ════════════════════════════════════════════════════════════════
-- 20260715000000_registration_consents
-- Súhlasy pri registrácii.
--
-- Pridáva stĺpce privacy_consent, media_consent a ich časové značky
-- plus verziu znenia súhlasu. Prepisuje topspin_register tak, aby súhlas
-- so spracovaním osobných údajov vyžadovala a súhlas s fotkami a videom
-- ukladala ako dobrovoľný.
--
-- ZÁVISLOSŤ: 20260101000000_baseline_schema
-- Idempotentná (add column if not exists + drop/create function).
-- ════════════════════════════════════════════════════════════════

-- TOPSPIN Tournament PRO – migrácia súhlasov registrácie
-- Spusti raz v Supabase SQL Editore PRED nasadením novej frontend verzie.

alter table public.topspin_registrations add column if not exists privacy_consent boolean not null default false;
alter table public.topspin_registrations add column if not exists privacy_consent_at timestamptz;
alter table public.topspin_registrations add column if not exists media_consent boolean not null default false;
alter table public.topspin_registrations add column if not exists media_consent_at timestamptz;
alter table public.topspin_registrations add column if not exists consent_version text;

drop function if exists public.topspin_register(text, text, text, text, integer, date, text, text, text[], text, text);
drop function if exists public.topspin_register(text, text, text, text, integer, date, text, text, text[], text, text, boolean, boolean, text);
create function public.topspin_register(
  p_slug text, p_first text, p_last text, p_club text, p_year int,
  p_license date, p_country text, p_gender text, p_categories text[], p_email text, p_note text,
  p_privacy_consent boolean, p_media_consent boolean, p_consent_version text)
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
  if coalesce(p_privacy_consent, false) is not true then
    raise exception 'Na registráciu je potrebný súhlas so spracovaním osobných údajov.';
  end if;
  if exists (select 1 from public.topspin_registrations r
              where r.slug = p_slug and lower(btrim(r.first_name)) = lower(btrim(p_first))
                and lower(btrim(r.last_name)) = lower(btrim(p_last))) then
    raise exception 'Tento hráč je už prihlásený.';
  end if;
  select count(*) into n from public.topspin_registrations
   where slug = p_slug and created_at > now() - interval '1 minute';
  if n > 30 then raise exception 'Príliš veľa prihlášok naraz. Skús o chvíľu.'; end if;
  insert into public.topspin_registrations(
    slug, first_name, last_name, club, birth_year, license_until, country, gender, categories, email, note,
    privacy_consent, privacy_consent_at, media_consent, media_consent_at, consent_version)
  values (p_slug, btrim(p_first), btrim(p_last), coalesce(p_club,''), p_year, p_license,
          coalesce(p_country,'Slovensko'), coalesce(p_gender,'M'), coalesce(p_categories,'{}'), p_email, p_note,
          true, now(), coalesce(p_media_consent,false),
          case when coalesce(p_media_consent,false) then now() else null end,
          nullif(btrim(coalesce(p_consent_version,'')), ''));
end $$;

drop function if exists public.topspin_registrations_admin(text);
create function public.topspin_registrations_admin(p_slug text)
returns table(id uuid, first_name text, last_name text, club text, birth_year int,
              license_until date, country text, gender text, categories text[], email text, note text,
              checked_in boolean, paid boolean, privacy_consent boolean, privacy_consent_at timestamptz,
              media_consent boolean, media_consent_at timestamptz, consent_version text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  perform public.topspin_require_edit(p_slug);
  return query select r.id, r.first_name, r.last_name, r.club, r.birth_year, r.license_until,
                      r.country, r.gender, r.categories, r.email, r.note, r.checked_in, r.paid,
                      r.privacy_consent, r.privacy_consent_at, r.media_consent, r.media_consent_at,
                      r.consent_version, r.created_at
               from public.topspin_registrations r where r.slug = p_slug order by r.last_name, r.first_name;
end $$;

grant execute on function public.topspin_register(text, text, text, text, integer, date, text, text, text[], text, text, boolean, boolean, text) to anon, authenticated;
grant execute on function public.topspin_registrations_admin(text) to authenticated;

-- Staršie prihlášky zostanú s privacy_consent=false a media_consent=false.
-- Organizátor tak vie odlíšiť historický záznam bez elektronicky evidovaného súhlasu.
