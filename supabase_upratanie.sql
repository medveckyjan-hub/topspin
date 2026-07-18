-- ============================================================
-- TOPSPIN — ODSTRÁNENIE ZVYŠKOV PO PINe
--
-- Rieši chybu: null value in column "admin_pin" ... violates not-null
-- Prihlásenie beží cez e-mail a heslo, PIN už nikde netreba.
-- Turnaje ani výsledky sa nestratia.
-- ============================================================

-- 1) okamžitá oprava: PIN prestáva byť povinný
alter table public.topspin_tournaments alter column admin_pin drop not null;
alter table public.topspin_tournaments alter column admin_pin set default null;

-- 2) funkcie, ktoré ešte pracovali s PINom
drop function if exists public.topspin_claim_tournament(text, text);
drop function if exists public.topspin_verify_pin(text, text);
drop function if exists public.topspin_check_pin(text, text);

-- 3) samotné stĺpce s PINom a tabuľka zámkov
alter table public.topspin_tournaments drop column if exists admin_pin;
alter table public.topspin_tournaments drop column if exists admin_pin_hash;
drop table if exists public.topspin_lockouts;

-- 4) kontrola — musí prejsť bez chyby a vrátiť zoznam turnajov
select t.slug, t.name, u.email as vlastnik
  from public.topspin_tournaments t
  left join auth.users u on u.id = t.owner_id
 order by t.updated_at desc;
