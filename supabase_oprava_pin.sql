-- ============================================================
-- TOPSPIN — OPRAVA PRIHLÁSENIA PINom
-- Príčina: Supabase má rozšírenie pgcrypto v schéme "extensions",
-- ale funkcie mali search_path len "public", takže crypt() vnútri
-- funkcie nebolo dostupné a overenie PINu vždy zlyhalo.
-- Spusti celý súbor. Dáta ostávajú nedotknuté.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- odomkne prípadné zámky z neúspešných pokusov
delete from public.topspin_lockouts;

drop function if exists public.topspin_check_pin(text, text);
create function public.topspin_check_pin(p_slug text, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions          -- ← kľúčová oprava
as $$
declare rec record; lock_rec record; ok boolean := false;
begin
  select * into lock_rec from public.topspin_lockouts where slug = p_slug;
  if lock_rec.locked_until is not null and lock_rec.locked_until > now() then
    raise exception 'Príliš veľa nesprávnych pokusov. Skús znova o % minút.',
      ceil(extract(epoch from (lock_rec.locked_until - now())) / 60);
  end if;

  select * into rec from public.topspin_tournaments where slug = p_slug;
  if not found then return false; end if;

  -- 1) zašifrovaný PIN
  if rec.admin_pin_hash is not null then
    begin
      ok := (rec.admin_pin_hash = crypt(p_pin, rec.admin_pin_hash));
    exception when others then
      ok := false;                              -- keby crypt zlyhal, skúsi sa záloha nižšie
    end;
  end if;

  -- 2) záloha: pôvodný nezašifrovaný PIN (kvôli starším turnajom)
  if not ok and rec.admin_pin is not null then
    ok := (rec.admin_pin = p_pin);
    -- pri úspechu doplň zašifrovanú podobu
    if ok and rec.admin_pin_hash is null then
      begin
        update public.topspin_tournaments set admin_pin_hash = crypt(p_pin, gen_salt('bf')) where slug = p_slug;
      exception when others then null;
      end;
    end if;
  end if;

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

drop function if exists public.topspin_verify_pin(text, text);
create function public.topspin_verify_pin(p_slug text, p_pin text)
returns boolean language sql security definer set search_path = public, extensions as $$
  select public.topspin_check_pin(p_slug, p_pin)
$$;

-- vytvorenie turnaja tiež potrebuje crypt()
drop function if exists public.topspin_create_tournament(text, text, text);
create function public.topspin_create_tournament(p_name text, p_pin text, p_create_code text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_slug text; v_base text; i int := 1;
begin
  if p_create_code is distinct from (select value from public.topspin_app_config where key = 'create_code') then
    raise exception 'Neplatný kód na vytvorenie turnaja.';
  end if;
  if length(coalesce(p_pin,'')) < 4 then raise exception 'PIN musí mať aspoň 4 znaky.'; end if;

  v_base := regexp_replace(lower(public.unaccent_safe(p_name)), '[^a-z0-9]+', '-', 'g');
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

-- doplň chýbajúce zašifrované PIN-y (beží v editore, kde crypt() je dostupné)
update public.topspin_tournaments
   set admin_pin_hash = crypt(admin_pin, gen_salt('bf'))
 where admin_pin_hash is null and admin_pin is not null;

grant execute on function public.topspin_check_pin(text,text) to anon, authenticated;
grant execute on function public.topspin_verify_pin(text,text) to anon, authenticated;
grant execute on function public.topspin_create_tournament(text,text,text) to anon, authenticated;

-- kontrola: nahraď 'tvoj-slug' a 'tvoj-pin' — musí vrátiť true
-- select public.topspin_verify_pin('tvoj-slug', 'tvoj-pin');
