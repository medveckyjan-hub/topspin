# TOPSPIN — ako nasadiť zmeny

## Databáza
Spúšťa sa **jediný súbor**: `schema.sql`.
Dá sa spustiť opakovane, dáta sa nestratia. Staršie SQL súbory sú
v priečinku `archiv_sql/` len ako záznam — **nikdy ich nespúšťaj**.

Supabase → SQL Editor → New query → vlož celý `schema.sql` → Run.
Na konci vypíše počty turnajov, zakladateľov a hráčov.

## Aplikácia (GitHub)
Nahraj zmenené súbory do repozitára `topspin`, Netlify nasadí sám.

Build teraz kontroluje typy (`tsc --noEmit && vite build`).
Ak sa nasadenie zastaví na chybe typu, chyba sa **nedostane k používateľom** —
to je zámer. Text chyby z Netlify logu stačí poslať.

## Nastavenia, ktoré musia platiť
- Supabase → Authentication → URL Configuration → Redirect URLs
  obsahuje `https://tttopspin.netlify.app/**`
- Netlify → Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  (premenná `SUPABASE_SERVICE_ROLE_KEY` už **nie je potrebná** — zmaž ju)

## Testy
- `node /tmp/ms2test.mjs` — turnajová logika (113 kontrol)
- `src/lib/normalize.test.mjs` — neúplné turnajové dáta (7 kontrol)
