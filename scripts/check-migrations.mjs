#!/usr/bin/env node
/**
 * M0-07 — kontrola migračnej štruktúry.
 *
 * Migrácie sa spúšťajú v poradí podľa časovej značky. Ak sa dve migrácie
 * trafia do tej istej značky, poradie prestane byť určené a dve prostredia
 * môžu skončiť s inou schémou. Táto kontrola to zachytí v CI.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'supabase/migrations';
const problems = [];

if (!existsSync(DIR)) {
  console.error(`CHYBA: priečinok ${DIR} neexistuje.`);
  process.exit(1);
}

const files = readdirSync(DIR).filter(f => f.endsWith('.sql')).sort();
if (!files.length) problems.push('v priečinku nie je žiadna migrácia');

const stamps = new Map();
const NAME = /^(\d{14})_[a-z0-9_]+\.sql$/;

for (const f of files) {
  const m = f.match(NAME);
  if (!m) { problems.push(`${f}: názov musí byť YYYYMMDDHHMMSS_popis.sql (malé písmená a podčiarkovníky)`); continue; }
  const stamp = m[1];
  if (stamps.has(stamp)) problems.push(`${f}: rovnaká časová značka ako ${stamps.get(stamp)} — poradie by nebolo určené`);
  stamps.set(stamp, f);

  const body = readFileSync(join(DIR, f), 'utf8');
  const head = body.slice(0, 800);
  if (!head.includes('--')) problems.push(`${f}: chýba hlavička s popisom, čo migrácia robí`);
  if (/create or replace function/i.test(body) && !/drop function if exists/i.test(body)) {
    problems.push(`${f}: mení funkciu cez create or replace bez predchádzajúceho drop function if exists ` +
                  '(PostgreSQL odmietne premenovaný parameter aj zmenený návratový typ)');
  }
  if (/(crypt|gen_salt)\s*\(/i.test(body) && !/search_path\s*=\s*[^;]*extensions/i.test(body)) {
    problems.push(`${f}: používa crypt()/gen_salt() bez "set search_path = public, extensions" — v Supabase by funkcia nebola nájdená`);
  }
}

// snímok schémy musí existovať, aby sa dala založiť nová databáza
if (!existsSync('schema.sql')) problems.push('chýba schema.sql — celkový snímok schémy pre nové prostredie');

if (problems.length) {
  console.error('KONTROLA MIGRÁCIÍ ZLYHALA:');
  problems.forEach(p => console.error('  - ' + p));
  process.exit(1);
}
console.log(`Kontrola migrácií OK — ${files.length} migrácií, časové značky jedinečné.`);
files.forEach(f => console.log('  · ' + f));
