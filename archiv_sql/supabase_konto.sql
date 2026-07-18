-- ============================================================
-- TOPSPIN — SPRÁVNE KONTO + HESLO + VLASTNÍCTVO TURNAJOV
--
-- Spusti to v dvoch krokoch:
--   KROK 1 = pozri sa, aké kontá existujú
--   KROK 2 = vyber si jedno, nastav heslo a priraď mu turnaje
-- ============================================================


-- ---------- KROK 1: aké kontá máš a komu patria turnaje ----------
-- Označ myšou len tieto dva príkazy a daj Run.

select id, email, created_at, last_sign_in_at
  from auth.users
 order by created_at;

select t.slug, t.name, u.email as vlastnik
  from public.topspin_tournaments t
  left join auth.users u on u.id = t.owner_id;


-- ---------- KROK 2: nastav si konto ----------
-- Do prvých dvoch riadkov napíš e-mail (musí byť vo výpise vyššie)
-- a heslo, ktoré chceš používať. Potom označ celý blok "do $$ ... $$;"
-- a daj Run.

do $$
declare
  v_email text := 'medveckyjan@gmail.com';      -- ← TU napíš svoj e-mail
  v_pass  text := 'ZmenMaNaSvojeHeslo';         -- ← TU napíš svoje heslo
  v_id    uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(v_email);

  if v_id is null then
    raise exception 'Konto % neexistuje. Použi niektorý e-mail z výpisu v kroku 1.', v_email;
  end if;

  -- 1) nastav heslo (konto ostáva to isté, nič sa nestratí)
  update auth.users
     set encrypted_password = extensions.crypt(v_pass, extensions.gen_salt('bf')),
         email_confirmed_at = coalesce(email_confirmed_at, now()),
         updated_at         = now()
   where id = v_id;

  -- 2) všetky turnaje patria tomuto kontu
  update public.topspin_tournaments set owner_id = v_id;

  -- 3) toto konto smie zakladať nové turnaje
  insert into public.topspin_creators(email) values (lower(v_email)) on conflict do nothing;

  insert into public.topspin_app_config(key, value) values ('owner_email', lower(v_email))
    on conflict (key) do update set value = excluded.value;

  raise notice 'Hotovo pre %', v_email;
end $$;


-- ---------- KROK 3: kontrola ----------
-- Musí ukázať tvoj e-mail pri každom turnaji.

select t.slug, t.name, u.email as vlastnik, (u.encrypted_password is not null) as ma_heslo
  from public.topspin_tournaments t
  left join auth.users u on u.id = t.owner_id;
