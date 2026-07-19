// Oddelenie klubov v žrebe. Spustenie: node src/lib/draw.test.mjs (potrebuje skompilované jadro v ./multisport.mjs)
import * as M from './multisport.mjs';
let ok = 0, fail = 0;
const t = (n, c) => { try { c() ? ok++ : (fail++, console.error('ZLYHALO:', n)); } catch (e) { fail++; console.error('VÝNIMKA:', n, e.message); } };
const mk = spec => spec.map((club, i) => ({ id: 'p' + i, name: 'H' + i, club, rating: 300 - i, memberIds: ['p' + i] }));
const run = (es, pref) => [M.createGroups(es, pref, 5, 2), new Map(es.map(e => [e.id, e]))];
const maxSame = (gs, map, club) => Math.max(...gs.map(g => g.entryIds.filter(id => map.get(id).club === club).length));

let es = mk(Array.from({ length: 32 }, (_, i) => (i < 8 ? 'A' : 'K' + (i % 7))));
let [gs, map] = run(es, 4);
t('8 hráčov klubu do 8 skupín = 1 na skupinu', () => maxSame(gs, map, 'A') === 1);
t('nikto sa nestratil', () => gs.reduce((s, g) => s + g.entryIds.length, 0) === 32);
t('žiadny klubový konflikt', () => M.clubConflicts(gs, map).length === 0);

es = mk(Array.from({ length: 24 }, (_, i) => (i < 10 ? 'A' : 'K' + (i % 5))));
[gs, map] = run(es, 4);
t('10 hráčov klubu v 6 skupinách → najviac 2 spolu', () => maxSame(gs, map, 'A') <= 2);

es = mk(Array.from({ length: 12 }, () => 'A'));
[gs, map] = run(es, 4);
t('všetci z jedného klubu prejdú bez pádu', () => gs.reduce((s, g) => s + g.entryIds.length, 0) === 12);

es = mk(Array.from({ length: 16 }, (_, i) => (i < 8 ? '' : 'K' + i)));
[gs, map] = run(es, 4);
t('hráči bez klubu sa neoddeľujú', () => M.clubConflicts(gs, map).length === 0);

es = mk(Array.from({ length: 32 }, (_, i) => (i % 2 === 0 ? 'A' : 'B')));
[gs, map] = run(es, 4);
t('dva kluby po 16 v 8 skupinách → najviac 2', () => maxSame(gs, map, 'A') <= 2 && maxSame(gs, map, 'B') <= 2);

es = mk(Array.from({ length: 16 }, (_, i) => 'K' + i));
[gs, map] = run(es, 4);
t('najvyššie nasadený ide do skupiny A', () => map.get(gs[0].entryIds[0]).rating === 300);
t('štyria najlepší sú v rôznych skupinách', () => {
  const top = es.slice(0, 4).map(e => e.id);
  return new Set(top.map(id => gs.findIndex(g => g.entryIds.includes(id)))).size === 4;
});

const ids = Array.from({ length: 20 }, (_, i) => 'q' + i);
const qmap = new Map(ids.map((id, i) => [id, { id, name: 'H' + i, club: i >= 8 && i < 16 ? 'A' : 'K' + i, rating: 200 - i, memberIds: [id] }]));
const q = M.createQualification(ids, qmap, 8, 4, 5);
t('kvalifikácia rozdelí klub medzi vetvy', () => {
  const per = q.brackets.map(b => {
    const set = new Set();
    b.rounds[0]?.matches.forEach(m => { if (m.playerAId) set.add(m.playerAId); if (m.playerBId) set.add(m.playerBId); });
    return [...set].filter(id => qmap.get(id).club === 'A').length;
  });
  return Math.max(...per) <= 2;
});

console.log(`ŽREB A KLUBY: ${ok} prešlo, ${fail} zlyhalo`);
