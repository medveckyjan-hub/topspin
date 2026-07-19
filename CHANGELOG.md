# Changelog

## 44E — záťažový test na maximálnej veľkosti

### Model: 6 kategórií × 256 hráčov, každý hrá dvojhru, štvorhru aj mix
1536 hráčov, 1536 párov, 15 súťaží, **6144 zápasov**.

### Výkon jadra — bez problémov
| Krok | Čas |
|---|---:|
| žreb všetkých skupín | 113 ms |
| odohranie skupín | 11 ms |
| všetky pavúky | 199 ms |
| harmonogram na 40 stolov | 62 ms |
| kontrola kolízií (6144 zápasov) | 125 ms |
| konečné poradie všetkých súťaží | 19 ms |

Uložený dokument: 1,9 MB. Jadro pri tejto veľkosti nemá problém.

### Chyba: čas potichu pretekal cez polnoc
Rozpis na 6144 zápasov trvá 58 hodín. `hhmm()` však počítal hodiny modulo 24,
takže zápas o 31:45 sa zobrazil ako **07:45** — vyzeral ako ranný a kolidoval
s prvým kolom. Detektor kolízií tak hlásil **1296 falošných kolízií**, pričom
skutočný problém bol iný: turnaj sa nezmestí do dňa.

Oprava: čas sa už neobtáča. Zápas po polnoci sa zobrazí ako 25:30, teda
viditeľne ako nasledujúci deň. Po oprave: **0 kolízií**.

### Nová funkcia `scheduleSpan(competitions, matchMinutes, dayEnd)`
Vracia začiatok, koniec, trvanie, počet zápasov a príznak `overflow`.
V harmonograme sa pri presahu zobrazí upozornenie s konkrétnymi číslami
a návrhom, čo s tým (viac stolov, kratšie zápasy, viac dní, menej súťaží).

### Nové testy (2, spolu 152)
Rozpis presahujúci deň to prizná a hodina je viditeľne nad 24 · bežný turnaj
sa označí ako zmestiteľný.

### Poznámka k limitu
Toto nie je limit softvéru, ale fyziky: 6144 zápasov × 20 minút = 2048 hodín
hracieho času. Na 40 stoloch je to 51 hodín, na 100 stoloch 20,5 hodiny.
Do jedného dňa sa taký turnaj nedá odohrať bez ohľadu na systém.

## 44D — súbežnosť súťaží v hale

### Chyba: štyri kategórie sa plánovali za sebou, nie súbežne
Pri meraní reálneho tvaru dňa (4 kategórie mládeže, 236 zápasov, 10 stolov)
vyšiel koniec turnaja **o 24:10** a pridanie stolov nepomáhalo — z 8 na 16
stolov sa deň skrátil len z 15,2 na 13,3 hodiny. Príčina: plánovač posúval
jednu spoločnú časovú hranicu, takže každá ďalšia súťaž začínala až po
dohraní predchádzajúcej. Využitie stolov bolo 3,6 z 10.

Oprava: každá súťaž má vlastnú časovú os. Rozlišuje sa „kedy smie začať
aktuálna fáza" a „kedy skončil posledný zápas" — zápasy jednej fázy bežia
súbežne na viacerých stoloch, medzi fázami sa čaká (skupiny pred pavúkom).
Stoly a hráči zostávajú jediné zdieľané zdroje.

**Výsledok pri 10 stoloch: koniec o 19:20 namiesto 24:10.** Pridanie stolov
teraz funguje: 8 stolov 12,3 h · 10 stolov 10,3 h · 12 stolov 9,0 h · 16 stolov 7,3 h.

### Chyba: družstevné stretnutia sa reťazili
Šesť stretnutí po piatich zápasoch sa ukladalo striktne za sebou — desať hodín
a rozpis pretiekol cez polnoc (časy typu 02:40). Stretnutia sú pritom iné
družstvá na iných stoloch. Teraz sa plánujú súbežne, sekvenčné zostáva len
poradie zápasov vnútri jedného stretnutia.

### Nové testy — `src/lib/parallel.test.ts` (5 kontrol)
Kategórie začínajú súbežne · pridanie stolov skracuje turnaj · stretnutia sa
nereťazia a zápasy v stretnutí idú za sebou · rozpis nepretečie cez polnoc ·
súbežnosť nepostaví hráča k dvom stolom naraz.

### Známe obmedzenie
Plánovač neukladá družstevné stretnutia do vĺn — nespáruje vopred (1–2) s (3–4),
aby začali naraz. Rozpis je korektný, len nie najkratší možný. Pri kategóriách
jednotlivcov to nehrá rolu.

### Poznámka k nálezu
Obe chyby odhalilo až meranie na reálnom tvare turnaja, nie testy. Regresiu,
ktorú moja prvá oprava zaviedla, zachytil E2E test do minúty.

Počet kontrol: 145 → **150**.

## 44B — míľnik M0: funkčná testovacia brána

### M0-01 Prevod manuálnych scenárov do Vitestu
- Sedem ručných `.mjs` skriptov prevedených na plnohodnotné Vitest súbory
  (`audit-fixes`, `bracket`, `draw`, `qualification`, `schedule`, `stages`, `tableview`).
- `normalize.test.mjs` prepísaný ako `normalize.test.ts` cez `it.each`.
- Zrušená závislosť na generovaných súboroch `multisport.mjs` a `stages.mjs`.
- Počet kontrol: **11 → 125**, všetky zelené.

### M0-02 Nové regresie (`src/lib/regressions.test.ts`, 23 kontrol)
- kvalifikácia s 0, 1, 2 a N účastníkmi vo vetve,
- starý výsledok po oprave skoršieho kola (semifinále aj bronz, pavúk aj fáza),
- cyklus v pláne fáz — bez pádu a s diagnostikou,
- striedanie v družstve vrátane odmietnutia druhého striedania,
- špeciálne výsledky WO/RET/DSQ a ich zrušenie,
- tímové systémy podľa pravidiel (New Swaythling, Corbillon, ITTF Best of 9),
- voľné žreby patria nasadeným hráčom.

### Opravy vyvolané regresiami
- **P0-02** `createQualification` už nevytvorí prázdnu vetvu, keď postupujú všetci priamo
  (vráti 0 vetiev a kvalifikácia je hotová). Jednočlenná vetva má `autoQualifiedId`,
  takže postupuje bez hrania a neblokuje dokončenie.
- **P0-05** `finalPlacement` je chránený proti cyklu v pláne fáz (`visiting`),
  predtým padal na pretečenie zásobníka. Pribudla funkcia `stageCycles` na diagnostiku.

### M0-03 `npm run verify`
Jeden príkaz: kontrola registry → typecheck aplikácie → typecheck testov → testy → build.

### M0-04 GitHub Actions
`.github/workflows/ci.yml` spúšťa celú bránu pri každom push a pull requeste.

### M0-05 Dokumentácia
README prepísaný — odstránené PIN a tajný kód (už neexistujú), doplnené prihlasovanie
e-mailom, reťaz fáz, harmonogram fyzických hráčov, registračné súhlasy a popis brány.

### M0-06 Kontrola integrity registry
`scripts/check-registry.mjs` zlyhá, ak `package-lock.json` alebo `.npmrc`
odkazujú na inú než verejnú npm doménu.

### M0-07 Migračná štruktúra
- `supabase/migrations/` s dvoma migráciami: `20260101000000_baseline_schema.sql`
  (celá schéma) a `20260715000000_registration_consents.sql` (súhlasy pri registrácii).
- Každá migrácia má hlavičku s popisom, závislosťou a poznámkou o idempotentnosti.
- `supabase/README.md` — pravidlo „žiadna zmena databázy bez migrácie", pomenovanie,
  postup pridania a dve pasce PostgreSQL/Supabase, na ktoré sme už narazili
  (premenovaný parameter pri `create or replace`, `search_path` a `pgcrypto`).
- `scripts/check-migrations.mjs` overuje pomenovanie, jedinečné časové značky,
  prítomnosť hlavičky, `drop function if exists` pred zmenou funkcie
  a `search_path` pri použití `crypt()`.
- `archiv_sql/` zostáva len ako historická stopa a nikdy sa nespúšťa.

### M0-08 Základný E2E dataset
- `src/lib/fixtures/baseline-tournament.json` — deterministický turnaj:
  32 hráčov z 8 klubov, 8 párov, 4 družstvá, štyri súťaže.
- `src/lib/fixtures/baseline.ts` — stavia z neho turnaj cez skutočné funkcie jadra.
- `src/lib/e2e.test.ts` — 20 kontrol cez celý priebeh: kvalifikácia, dve kolá skupín,
  finálový pavúk, dve útechy, štvorhra, družstvá a harmonogram.
- MUTAČNÉ OVEROVANIE: prvá verzia datasetu chybu neodhalila, lebo dvojhra bežala
  cez fázy a štvorhra cez skupiny — plánovač ich ukladal za sebou, takže sa nikdy
  neprekryli. Doplnená súťaž „Dvojhra 40+", ktorá beží súbežne so štvorhrou
  a zdieľa s ňou hráčov. Overené tromi mutáciami jadra (fyzickí hráči, poradie
  útechy, oddelenie klubov) — všetky tri test zhodí.

### Technické
- `tsconfig.json` typuje aplikáciu prísne a testov sa netýka.
- `tsconfig.test.json` typuje testy miernejšie (pochádzajú z JS scenárov).
- Počet kontrol po M0: **145** (125 po M0-01/02 + 20 E2E).
- `npm run verify` má teraz šesť krokov vrátane kontroly migrácií.
