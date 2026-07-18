-- ============================================================
-- TOPSPIN — PRÍSTUP: ty si vlastník, ty rozhoduješ, kto smie dnu
--
-- Čo tento skript spraví:
--   1) všetky doterajšie turnaje priradí tebe (PIN netreba)
--   2) zavedie zoznam ľudí, ktorí smú zakladať nové turnaje
--   3) zakladanie turnaja povolí len tým zo zoznamu
--
-- DÔLEŽITÉ PORADIE:
--   NAJPRV sa raz prihlás v aplikácii svojím e-mailom (aby konto vzniklo),
--   AŽ POTOM spusti tento skript.
-- ============================================================


-- >>> JEDINÉ MIESTO, KDE NIEČO MENÍŠ <<<
-- Napíš sem e-mail, ktorým sa prihlasuješ:
insert into public.topspin_app_config(key, value)
values ('owner_email', 'tvoj@email.sk')
on conflict (key) do update set value = excluded.value;
-- >>> koniec úprav <<<


-- ---------- 1) všetky turnaje sú tvoje ----------
update public.topspin_tournaments
   set owner_id = (
     select u.id from auth.users u
      where lower(u.email) = lower((select value from public.topspin_app_config where key = 'owner_email'))
   )
 where owner_id is null;


-- ---------- 2) zoznam tých, čo smú zakladať turnaje ----------
create table if not exists public.topspin_creators (
  email text primary key,
  created_at timestamptz not null default now()
);
alter table public.topspin_creators enable row level security;

insert into public.topspin_creators(email)
select lower(value) from public.topspin_app_config where key = 'owner_email'
on conflict (email) do nothing;


-- ---------- 3) zakladať turnaj smie len ten zo zoznamu ----------
create or replace function public.topspin_can_create()
returns boolean language sql security definer stable set search_path = public as $$
  select auth.uid() is not null
     and exists (
       select 1 from public.topspin_creators c
        where lower(c.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
     )
$$;

drop function if exists public.topspin_create_tournament(text);
create function public.topspin_create_tournament(p_name text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_slug text; v_base text; i int := 1;
begin
  if auth.uid() is null then raise exception 'Najprv sa prihlás.'; end if;
  if not public.topspin_can_create() then
    raise exception 'Tvoj e-mail nemá povolenie zakladať turnaje. Požiadaj správcu o prístup.';
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


-- ---------- správa zoznamu (smie len ten, kto v ňom už je) ----------
create or replace function public.topspin_list_creators()
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

grant execute on function public.topspin_can_create() to anon, authenticated;
grant execute on function public.topspin_create_tournament(text) to authenticated;
grant execute on function public.topspin_list_creators() to authenticated;
grant execute on function public.topspin_add_creator(text) to authenticated;
grant execute on function public.topspin_remove_creator(text) to authenticated;


-- ---------- kontrola ----------
-- Musí vypísať tvoj e-mail a počet turnajov, ktoré ti patria:
select (select value from public.topspin_app_config where key = 'owner_email') as moj_email,
       (select count(*) from public.topspin_tournaments
         where owner_id = (select u.id from auth.users u
                            where lower(u.email) = lower((select value from public.topspin_app_config where key = 'owner_email')))
       ) as moje_turnaje,
       (select count(*) from public.topspin_tournaments where owner_id is null) as bez_vlastnika;
