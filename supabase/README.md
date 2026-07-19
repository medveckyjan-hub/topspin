# Databáza TOPSPIN — migrácie

## Pravidlo

**Žiadna zmena databázy bez migrácie.** Každý zásah do schémy (nová tabuľka,
stĺpec, funkcia, oprávnenie) je nový súbor v `supabase/migrations/`.
Existujúce migrácie sa nikdy neupravujú ani nemažú — už mohli byť spustené
na ostrej databáze a ich prepísanie by znamenalo, že dva systémy majú
rovnaké číslo migrácie, ale iný obsah.

## Pomenovanie

    YYYYMMDDHHMMSS_kratky_popis.sql

Časová značka určuje poradie spustenia. Popis je po slovensky, malými
písmenami, slová oddelené podčiarkovníkom.

## Ako pridať migráciu

1. Vytvor súbor s aktuálnou časovou značkou.
2. Do hlavičky napíš, čo migrácia robí, od ktorej migrácie závisí
   a či je idempotentná.
3. Píš idempotentne, kde sa dá: `create table if not exists`,
   `add column if not exists`, pri funkciách `drop function if exists`
   a potom `create function`.
4. Spusti `npm run check:migrations` — overí pomenovanie, jedinečnosť
   časových značiek a prítomnosť hlavičky.
5. Spusti migráciu v Supabase SQL Editore.
6. Zapíš zmenu do `CHANGELOG.md`.

## Prečo PostgreSQL niekedy odmietne `create or replace`

Dve pasce, na ktoré sme už narazili:

- **Premenovaný parameter.** Ak sa zmení názov argumentu funkcie,
  `create or replace` zlyhá — treba najprv `drop function`.
- **Zmenený návratový typ** pri funkcii vracajúcej tabuľku — takisto
  najprv `drop function`.

Preto migrácie meniace funkcie vždy začínajú `drop function if exists`
s **plným zoznamom typov argumentov** starej aj novej verzie.

## Pozor na `search_path`

Supabase drží `pgcrypto` v schéme `extensions`. Funkcia, ktorá používa
`crypt()` alebo `gen_salt()`, musí mať `set search_path = public, extensions`,
inak sa funkcia nenájde a kontrola potichu zlyhá. Toto bola príčina
starého zablokovania prihlásenia.

## Vzťah k `schema.sql`

`schema.sql` v koreni je **celkový snímok** aktuálnej schémy pre nové
prostredie — kto zakladá databázu od nuly, spustí jeho. Migrácie sú
záznam, ako sa k tomuto stavu prišlo. Pri zmene schémy sa aktualizujú
obidva: nová migrácia **a** snímok.

## Staré skripty

Priečinok `archiv_sql/` obsahuje osem historických skriptov z čias, keď
sa prístup riešil PIN-om. **Nikdy sa už nespúšťajú.** Sú tam len ako
stopa histórie a do migrácií nepatria.
