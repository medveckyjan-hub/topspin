# StoTen Tournament PRO — Multi-event (Netlify + Supabase)

Online systém na stolnotenisové turnaje. **Výsledky sú verejné** (odkaz + QR kód),
**editácia je cez PIN**, turnajov môže byť viac a zakladajú sa **len cez tajný kód**.

## Čo appka vie

- viac súťaží v jednom turnaji: **dvojhra, štvorhra, mix, družstvá** (Corbillon, Swaythling, olympijský, ligové, 1 striedanie),
- **skupiny 3–12** s ITTF poradím pri rovnosti (vzájomný zápas → minitabuľka → rating),
- **pavúk** s nasadením, voľnými losmi, zápasom o 3. miesto a **útechou**,
- **rozklik každého zápasu** (skupina/pavúk/družstvá) do detailu: sety, WO/RET/DSQ, stôl, čas, poznámka,
- **best of 3/5/7 na každej úrovni**: súťaž → skupina → kolo pavúka → jednotlivý zápas,
- **tlač zápisu o zápase** aj prehľadu, **harmonogram** na stoly a čas, **import hráčov z XLSX**.

## Adresy (routes)

- `/` — zoznam turnajov + zakladanie (cez tajný kód),
- `/t/:slug` — **verejné výsledky** turnaja (QR smeruje sem),
- `/t/:slug/admin` — správa turnaja po zadaní **PIN**.

---

## Nasadenie — krok za krokom

### 1) Supabase
1. Vytvor projekt na supabase.com.
2. V **SQL Editor** spusti celý súbor `supabase.sql`.
3. Na konci je `create_code` = `ZMEN-MA-1234` — **zmeň si tento tajný kód**. Budeš ho zadávať pri zakladaní turnaja.
4. V **Project Settings → API** skopíruj `Project URL` a `anon public` kľúč.

### 2) Netlify
1. Nahraj repo na GitHub, v Netlify daj **Add new site → Import**.
2. Build je predvyplnený z `netlify.toml` (`npm run build`, publish `dist`).
3. V **Site settings → Environment variables** pridaj:
   - `VITE_SUPABASE_URL` = Project URL,
   - `VITE_SUPABASE_ANON_KEY` = anon public kľúč.
4. **Deploy** (po zmene env premenných daj Redeploy).

### 3) Používanie
- Na `/` zadaj názov, **PIN** (na editáciu) a **tajný kód** → *Založiť a spravovať*.
- Rozpíš turnaj v admine (autosave do cloudu).
- Divákom pošli verejný odkaz alebo vytlač **QR** z admin lišty / verejnej stránky.

## Lokálny vývoj

    npm install
    cp .env.example .env      # doplň VITE_SUPABASE_URL a VITE_SUPABASE_ANON_KEY
    npm run dev
    npm test
    npm run build

## Bezpečnosť

- Tabuľky majú RLS **bez politík** → cez anon kľúč sa k nim nedá pristúpiť priamo.
  Všetko ide cez `security definer` funkcie, ktoré nikdy nevrátia `admin_pin` ani `create_code`.
- PIN aj tajný kód sa overujú **na serveri** (v DB funkciách), nie v prehliadači.
- Anon kľúč je verejný zámerne (patrí do frontendu) — sám osebe needituje dáta.
