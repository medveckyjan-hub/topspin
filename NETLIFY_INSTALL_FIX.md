# Netlify dependency-install fix

## Príčina
Predchádzajúci `package-lock.json` obsahoval `resolved` URL smerujúce na interný OpenAI/CAAS npm mirror. Netlify k nemu nemá prístup, preto inštalácia čakala až do 18-minútového timeoutu.

## Oprava
- všetky `resolved` URL v `package-lock.json` smerujú na `https://registry.npmjs.org/`
- `.npmrc` explicitne nastavuje verejný npm registry
- `.nvmrc` pripína Node.js 22
- `package.json` deklaruje Node 22.x a npm 10.x

## Nasadenie
1. Nahraď na GitHube `package-lock.json` a `package.json`.
2. Pridaj skryté súbory `.nvmrc` a `.npmrc` do koreňa repozitára.
3. Commitni a pushni.
4. V Netlify zvoľ **Clear cache and deploy site**.
5. Over, že log uvádza Node 22 a že inštalácia balíkov skončí bez timeoutu.
