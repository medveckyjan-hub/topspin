# TOPSPIN Tournament PRO — turnajový systém (Netlify + Supabase)

Online systém na stolnotenisové turnaje. **Výsledky sú verejné** (odkaz + QR kód),
**editácia je len pre prihlásených používateľov** s prístupom k danému turnaju.

## Čo appka vie

- viac súťaží v jednom turnaji: **dvojhra, štvorhra, mix, družstvá**
  (New Swaythling Cup, Corbillon Cup, ITTF Best of 9, olympijský, ligové systémy),
- **skupiny 3–12** s ITTF poradím pri rovnosti (vzájomný zápas → minitabuľka → rating),
- **pavúk** s nasadením, voľnými losmi, zápasom o 3. miesto a **útechou**,
- **kvalifikácia** pred skupinami, vrátane priamo nasadených hráčov,
- **reťaz fáz**: ľubovoľná postupnosť kôl (kvalifikácia → skupiny → druhé skupiny → pavúk)
  s útechou vetviacou sa z ktorejkoľvek fázy a presným konečným poradím,
- **rozklik každého zápasu** do detailu: sety, WO/RET/DSQ, stôl, čas, poznámka,
- **best of 3/5/7 na každej úrovni**: súťaž → skupina → kolo pavúka → jednotlivý zápas,
- **harmonogram** na stoly a čas so sledovaním **fyzických hráčov** (hráč nemôže mať
  dvojhru a štvorhru naraz) a s upozornením na kolízie,
- **zápis od stola** pre všetky fázy vrátane kvalifikácie, fáz a družstiev,
- **tlač zápisu o zápase**, prehľadu a **import hráčov z XLSX**.

## Adresy (routes)

- `/` — verejný zoznam turnajov,
- `/sprava` — správa vlastných turnajov a zakladanie nového (len pre prihlásených),
- `/t/:slug` — **verejné výsledky** turnaja (QR smeruje sem),
- `/t/:slug/admin` — správa turnaja,
- `/t/:slug/stol` — zapisovanie od stola,
- `/t/:slug/tv` — zobrazenie na veľkú obrazovku.

## Prihlasovanie

Prihlasuje sa **e-mailom a heslom**. Starší režim s PIN-om a tajným kódom bol
odstránený — turnaj už nie je chránený zdieľaným kódom, ale konkrétnym účtom.

- Zakladať turnaje môžu len účty v zozname `topspin_creators`.
- K existujúcemu turnaju sa prístup udeľuje cez `topspin_access`.
- Do spoločnej databázy hráčov smie zapisovať len prihlásený používateľ
  s prístupom aspoň k jednému turnaju.

---

## Nasadenie — krok za krokom

### 1) Supabase
1. Vytvor projekt na supabase.com.
2. V **SQL Editor** spusti celý súbor `schema.sql` (je idempotentný, dá sa spustiť opakovane).
   Staré skripty v `archiv_sql/` sa už nespúšťajú.
3. V **Project Settings → API** skopíruj `Project URL` a `anon public` kľúč.
4. Pridaj svoj účet do `topspin_creators`, aby si mohol zakladať turnaje.

### 2) Netlify
1. Nahraj repo na GitHub, v Netlify daj **Add new site → Import**.
2. Build je predvyplnený z `netlify.toml` (`npm run build`, publish `dist`).
3. V **Site settings → Environment variables** pridaj:
   - `VITE_SUPABASE_URL` = Project URL,
   - `VITE_SUPABASE_ANON_KEY` = anon public kľúč.
4. **Deploy** (po zmene env premenných daj Redeploy).

### 3) Používanie
- Prihlás sa v hornej lište, choď na `/sprava` a založ turnaj.
- Rozpíš turnaj v admine (autosave do cloudu).
- Divákom pošli verejný odkaz alebo vytlač **QR** z admin lišty.

## Lokálny vývoj

    nvm use            # Node 22 podľa .nvmrc
    npm ci
    cp .env.example .env      # doplň VITE_SUPABASE_URL a VITE_SUPABASE_ANON_KEY
    npm run dev

## Overenie pred nasadením

Jediný príkaz, ktorý spustí celú bránu:

    npm run verify

Postupne prebehne:

| Krok | Príkaz | Čo kontroluje |
|---|---|---|
| 1 | `npm run check:registry` | že `package-lock.json` a `.npmrc` ukazujú len na verejný npm registry |
| 2 | `npm run check:migrations` | pomenovanie a jedinečnosť migrácií, hlavičky, pasce `create or replace` a `search_path` |
| 3 | `npm run typecheck` | typová kontrola aplikácie (prísny režim) |
| 4 | `npm run typecheck:tests` | typová kontrola testov |
| 5 | `npm test` | 152 automatických kontrol vo Viteste |
| 6 | `npm run build` | produkčný build |

To isté beží pri každom push a pull requeste cez GitHub Actions
(`.github/workflows/ci.yml`). Kým nie je CI zelené, verzia sa nemá nasadzovať.

### Testy

Všetky testy sú riadne Vitest súbory v `src/lib/*.test.ts`. Nič sa nepredkompilováva —
staré ručné `.mjs` skripty, ktoré potrebovali vygenerované `multisport.mjs`
a `stages.mjs`, boli zrušené.

| Súbor | Kontroly | Oblasť |
|---|---:|---|
| `multisport.test.ts` | 11 | jadro: skupiny, sety, poradie |
| `regressions.test.ts` | 23 | hraničné regresie z auditu |
| `stages.test.ts` | 19 | reťaz fáz a konečné poradie |
| `schedule.test.ts` | 16 | harmonogram a fyzickí hráči |
| `bracket.test.ts` | 14 | nasadzovanie do pavúka |
| `qualification.test.ts` | 12 | kvalifikácia |
| `draw.test.ts` | 10 | žreb a oddelenie klubov |
| `audit-fixes.test.ts` | 7 | skoršie opravy z auditu |
| `normalize.test.ts` | 7 | neúplné dáta turnaja |
| `tableview.test.ts` | 6 | zápis od stola |
| `e2e.test.ts` | 20 | celý turnaj od prihlášok po konečné poradie |
| `parallel.test.ts` | 7 | súbežnosť súťaží a hranice rozpisu |
| **spolu** | **152** | |

### Základný E2E dataset

`src/lib/fixtures/baseline-tournament.json` je deterministický turnaj:
32 hráčov z 8 klubov, 8 párov na štvorhru a 4 družstvá. Nad ním beží
`e2e.test.ts`, ktorý prejde kvalifikáciu, dve kolá skupín, finálový pavúk,
dve útechy, štvorhru aj družstvá a naplánuje celý turnaj.

Dataset zámerne obsahuje súťaž **Dvojhra 40+**, ktorá sa hrá klasickými
skupinami — plánuje sa teda súbežne so štvorhrou a zdieľa s ňou hráčov.
Bez toho by test nezachytil, keby harmonogram prestal sledovať fyzických
hráčov; overené mutačným testom.

### Databáza a migrácie

Postup pri zmenách schémy je v `supabase/README.md`. Pravidlo je jednoduché:
**žiadna zmena databázy bez migrácie** a existujúce migrácie sa nikdy neupravujú.

## Bezpečnosť

- Tabuľky majú RLS **bez politík** → cez anon kľúč sa k nim nedá pristúpiť priamo.
  Všetko ide cez `security definer` funkcie.
- Oprávnenia sa overujú **na serveri** (v DB funkciách), nie v prehliadači.
- Anon kľúč je verejný zámerne (patrí do frontendu) — sám osebe needituje dáta.
- Pri registrácii sa vyžaduje **súhlas so spracovaním osobných údajov**;
  súhlas s publikovaním fotografií a videí je samostatný a dobrovoľný.
