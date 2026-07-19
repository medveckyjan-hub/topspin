#!/usr/bin/env node
/**
 * M0-06 — kontrola integrity npm registry.
 *
 * Build na Netlify aj v CI musí ťahať balíky výhradne z verejného registry.
 * Ak sa do package-lock.json dostane interná alebo súkromná doména
 * (napr. firemný Nexus či Artifactory), inštalácia mimo tej siete zlyhá
 * a projekt sa nedá zostaviť. Táto kontrola to zachytí skôr než build.
 */
import { readFileSync, existsSync } from 'node:fs';

const ALLOWED = ['registry.npmjs.org', 'registry.yarnpkg.com'];
const problems = [];

// 1) package-lock.json — všetky resolved URL
if (!existsSync('package-lock.json')) {
  console.error('CHYBA: package-lock.json chýba. Bez neho nie je inštalácia reprodukovateľná.');
  process.exit(1);
}
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const seen = new Set();
const walk = (node) => {
  if (!node || typeof node !== 'object') return;
  if (typeof node.resolved === 'string' && node.resolved.startsWith('http')) {
    const host = new URL(node.resolved).host;
    seen.add(host);
    if (!ALLOWED.includes(host)) problems.push(`package-lock.json odkazuje na ${host}`);
  }
  for (const v of Object.values(node)) if (v && typeof v === 'object') walk(v);
};
walk(lock);

// 2) .npmrc — nesmie prepisovať registry na neverejný
if (existsSync('.npmrc')) {
  for (const line of readFileSync('.npmrc', 'utf8').split('\n')) {
    const m = line.match(/registry\s*=\s*(\S+)/);
    if (!m) continue;
    const host = new URL(m[1]).host;
    if (!ALLOWED.includes(host)) problems.push(`.npmrc nastavuje registry na ${host}`);
  }
}

if (problems.length) {
  console.error('KONTROLA REGISTRY ZLYHALA:');
  problems.forEach(p => console.error('  - ' + p));
  console.error('\nPovolené sú len: ' + ALLOWED.join(', '));
  process.exit(1);
}
console.log(`Kontrola registry OK — ${seen.size} hostiteľ(ov): ${[...seen].join(', ') || 'žiadne resolved URL'}`);
