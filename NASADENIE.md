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
Testy jadra potrebujú skompilované jadro ako `src/lib/multisport.mjs`.
- turnajová logika — 113 kontrol (Bergerove tabuľky, ITTF poradie, pavúk)
- `src/lib/normalize.test.mjs` — neúplné turnajové dáta, 7 kontrol
- `src/lib/qualification.test.mjs` — kvalifikácia a reťazenie fáz, 12 kontrol
- `src/lib/draw.test.mjs` — oddelenie klubov v žrebe do skupín, 10 kontrol
- `src/lib/bracket.test.mjs` — nasadzovanie do pavúka v oboch režimoch, 14 kontrol

## Pravidlá nasadzovania (aby sa v budúcnosti nepomiešali)
- **Hrajú sa skupiny → pavúk:** v pavúku rozhoduje len skupina. Postupujúci
  z tej istej skupiny (A1, A2) idú do opačných polovíc. Kluby sa tu neriešia,
  o ich oddelenie sa postaral žreb do skupín.
- **Hrá sa len pavúk (bez skupín):** nasadzuje sa podľa ratingu a kluby sa
  rozdeľujú do sekcií — pri 32-ke ide 8 hráčov jedného klubu do 8 rôznych osmín.
- V oboch prípadoch zostáva nasadenie a rozloženie voľných žrebov nedotknuté.
