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
- `src/lib/stages.test.mjs` — reťaz fáz a konečné poradie, 19 kontrol
- `src/lib/schedule.test.mjs` — harmonogram a fyzickí hráči, 16 kontrol
- `src/lib/audit-fixes.test.mjs` — opravy z externého auditu, 7 kontrol
- `src/lib/tableview.test.mjs` — zápis od stola vo všetkých fázach, 6 kontrol

## Reťaz fáz (Fázy turnaja)
Súťaž môže mať ľubovoľnú postupnosť kôl. Každá fáza je skupiny alebo pavúk
a berie účastníkov z jedného z troch zdrojov:
- **všetci prihlásení** (prvá fáza),
- **postupujúci** z konkrétnej predchádzajúcej fázy,
- **vypadnutí** z konkrétnej fázy — takto vzniká útecha.

Príklad: Kvalifikácia (pavúk) → 1. kolo skupín → 2. kolo skupín → Finálový pavúk,
plus Útecha 1. kola a Útecha 2. kola vetviace sa z vypadnutých.

Fáza sa dá vytvoriť až keď je jej zdrojová fáza dohratá. Konečné poradie sa
počíta naprieč všetkými fázami: kto sa dostal ďalej, je vyššie; hlavná vetva
je nad útechou.

## Pravidlá nasadzovania (aby sa v budúcnosti nepomiešali)
- **Hrajú sa skupiny → pavúk:** v pavúku rozhoduje len skupina. Postupujúci
  z tej istej skupiny (A1, A2) idú do opačných polovíc. Kluby sa tu neriešia,
  o ich oddelenie sa postaral žreb do skupín.
- **Hrá sa len pavúk (bez skupín):** nasadzuje sa podľa ratingu a kluby sa
  rozdeľujú do sekcií — pri 32-ke ide 8 hráčov jedného klubu do 8 rôznych osmín.
- V oboch prípadoch zostáva nasadenie a rozloženie voľných žrebov nedotknuté.
