-- ============================================================
-- TOPSPIN — ZISTENIE PREČO NESEDÍ PIN + NASTAVENIE NOVÉHO
-- Spúšťaj po krokoch, nie celý súbor naraz.
-- ============================================================

-- KROK 1: vypíš turnaje a stav PINov.
-- Pozri sa na presný "slug" (musí sedieť aj s pomlčkami)
-- a či má turnaj vyplnený zašifrovaný PIN.
select slug,
       name,
       admin_pin                as povodny_pin,          -- ak je vyplnený, toto je tvoj PIN
       (admin_pin_hash is not null) as ma_sifrovany_pin,
       version,
       updated_at
  from public.topspin_tournaments
 order by updated_at desc;


-- KROK 2: over konkrétny PIN (nahraď slug aj PIN podľa kroku 1).
-- Ak vráti true, PIN je správny a prihlásenie bude fungovať.
-- select (admin_pin_hash = extensions.crypt('TVOJ_PIN', admin_pin_hash)) as sedi_sifrovany,
--        (admin_pin = 'TVOJ_PIN')                                       as sedi_povodny
--   from public.topspin_tournaments
--  where slug = 'TVOJ_SLUG';


-- KROK 3 (ak PIN nesedí alebo si ho chceš zmeniť):
-- nastav nový PIN pre turnaj. Nahraď TVOJ_SLUG a NOVY_PIN.
-- update public.topspin_tournaments
--    set admin_pin      = 'NOVY_PIN',
--        admin_pin_hash = extensions.crypt('NOVY_PIN', extensions.gen_salt('bf'))
--  where slug = 'TVOJ_SLUG';
-- delete from public.topspin_lockouts;      -- odomkne prípadný zámok


-- KROK 4: kontrola — musí vrátiť true
-- select public.topspin_verify_pin('TVOJ_SLUG', 'NOVY_PIN');


-- ------------------------------------------------------------
-- Ak by KROK 2 aj 3 hlásili, že funkcia crypt neexistuje,
-- spusti najprv toto a potom skús znova:
-- create extension if not exists pgcrypto with schema extensions;
-- select extensions.crypt('test', extensions.gen_salt('bf'));   -- musí vrátiť reťazec
