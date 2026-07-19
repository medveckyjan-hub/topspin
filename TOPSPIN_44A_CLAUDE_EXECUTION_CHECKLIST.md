# TOPSPIN 44A – Claude execution checklist

Používaj tento súbor ako živý checklist. Nevymazávaj dokončené položky; označ ich `[x]` a doplň commit alebo release.

## Už opravené – iba regresne chrániť

- [x] Node 22 pinning
- [x] npm 10 engine
- [x] verejný npm registry
- [x] opravený package-lock
- [x] typecheck
- [x] production build
- [x] New Swaythling Cup
- [x] Corbillon Cup
- [x] ITTF Best of 9
- [x] TableView advances
- [x] TableView validateMatch
- [x] fyzickí hráči v harmonograme
- [x] kvalifikácia/fázy/družstvá v harmonograme
- [x] registračné súhlasy
- [x] anonymný player upsert zablokovaný

## M0 – okamžite

- [x] M0-01 Prevod 91 manuálnych testov — 91 scenárov → Vitest, 125 kontrol zelených
- [x] M0-02 Hraničné regresie — regressions.test.ts, 23 kontrol
- [x] M0-03 npm run verify — registry → typecheck → typecheck:tests → test → build
- [x] M0-04 GitHub Actions — .github/workflows/ci.yml
- [x] M0-05 README bez PIN dokumentácie — README prepísaný, PIN a tajný kód odstránené
- [x] M0-06 Registry integrity check — scripts/check-registry.mjs
- [x] M0-07 Supabase migrations layout — supabase/migrations + README + check:migrations
- [x] M0-08 Baseline E2E dataset — fixtures/baseline-tournament.json + e2e.test.ts (20 kontrol), overené mutáciami

## M1 – integrita zápasu

- [ ] M1-01 Centrálny match engine
- [ ] M1-02 Slot source/signature
- [ ] M1-03 Invalidátor výsledkov
- [ ] M1-04 Rekurzívny prepočet
- [ ] M1-05 Qualification 0/1/N
- [ ] M1-06 Stage DAG
- [ ] M1-07 Match statuses
- [ ] M1-08 Lokálny draft
- [ ] M1-09 WO/RET/DSQ model
- [ ] M1-10 Official lock

## M2 – referenčná integrita

- [ ] M2-01 Runtime schema
- [ ] M2-02 UUID hráčov
- [ ] M2-03 Person vs entry
- [ ] M2-04 Safe delete
- [ ] M2-05 Pair kind
- [ ] M2-06 Pair management
- [ ] M2-07 Team management
- [ ] M2-08 ImpactAnalyzer
- [ ] M2-09 Safe import
- [ ] M2-10 Safe stage delete

## M3 – databáza a Realtime

- [ ] M3-01 Hybrid schema
- [ ] M3-02 Relational matches/sets
- [ ] M3-03 Match-level locking
- [ ] M3-04 Transactional RPC
- [ ] M3-05 Realtime
- [ ] M3-06 Offline queue
- [ ] M3-07 Audit events
- [ ] M3-08 Sequenced autosave
- [ ] M3-09 Backup/restore
- [ ] M3-10 Concurrency test

## M4–M10

Pokračuj výhradne podľa aktualizovaného auditu.
