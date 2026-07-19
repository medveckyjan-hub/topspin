// Nasadzovanie do pavúka v oboch režimoch.
// Spustenie: skompilované jadro ulož ako ./multisport.mjs, potom node src/lib/bracket.test.mjs
import * as M from './multisport.mjs';
let ok = 0, fail = 0;
const t = (n, c) => { try { c() ? ok++ : (fail++, console.error('ZLYHALO:', n)); } catch (e) { fail++; console.error('VÝNIMKA:', n, e.message); } };

const played = m => M.normalizeMatch({ ...m, sets: [{ a: 11, b: 1 }, { a: 11, b: 2 }, { a: 11, b: 3 }] }, 5);

/** Súťaž so skupinami: pavúk vzniká z postupujúcich. */
function withGroups(n, clubFn) {
  const es = Array.from({ length: n }, (_, i) => ({ id: 'x' + i, name: 'X' + i, club: clubFn(i), rating: 500 - i, memberIds: ['x' + i] }));
  const em = new Map(es.map(e => [e.id, e]));
  const gs = M.createGroups(es, 4, 5, 2);
  gs.forEach(g => g.matches.forEach(m => Object.assign(m, played(m))));
  const c = { id: 'c', name: 'C', type: 'singles', bestOf: 5, preferredSize: 4, qualifiersPerGroup: 2, thirdPlace: true, consolation: false, groupPlayoff: false, entryIds: es.map(e => e.id), groups: gs, ko: { main: [], consolation: [] }, teamTies: [] };
  const ko = M.createKnockout(c, em);
  const slots = [];
  ko.main[0].matches.forEach(m => { slots.push(m.playerAId, m.playerBId); });
  return { ko, gs, em, slots };
}

/** Súťaž bez skupín: hrá sa len pavúk. */
function bracketOnly(n, clubFn) {
  const es = Array.from({ length: n }, (_, i) => ({ id: 'y' + i, name: 'Y' + i, club: clubFn(i), rating: 900 - i, memberIds: ['y' + i] }));
  const em = new Map(es.map(e => [e.id, e]));
  const c = { id: 'd', name: 'D', type: 'singles', bestOf: 5, preferredSize: 4, qualifiersPerGroup: 2, thirdPlace: true, consolation: false, groupPlayoff: false, entryIds: es.map(e => e.id), groups: [], ko: { main: [], consolation: [] }, teamTies: [] };
  const ko = M.createKnockout(c, em);
  const slots = [];
  ko.main[0].matches.forEach(m => { slots.push(m.playerAId, m.playerBId); });
  return { ko, em, slots };
}

const perSection = (slots, em, size, club) => {
  const o = {};
  slots.forEach((id, i) => { if (id && em.get(id).club === club) { const s = Math.floor(i / size); o[s] = (o[s] || 0) + 1; } });
  return o;
};

// --- A) PO SKUPINÁCH: rozhoduje len skupina, klub sa nerieši ---
for (const n of [16, 24, 32]) {
  const { ko, gs, slots } = withGroups(n, i => 'K' + i);
  const half = slots.length / 2;
  const grpOf = id => gs.findIndex(g => g.entryIds.includes(id));
  t(`${n} hráčov: A1 a A2 idú do opačných polovíc`, () => {
    for (let gi = 0; gi < gs.length; gi++) {
      const pos = slots.map((id, i) => (id && grpOf(id) === gi ? i : -1)).filter(i => i >= 0);
      if (pos.length === 2 && (pos[0] < half) === (pos[1] < half)) return false;
    }
    return true;
  });
  t(`${n} hráčov: 1. kolo bez dvojíc z tej istej skupiny`, () =>
    ko.main[0].matches.every(m => !m.playerAId || !m.playerBId || grpOf(m.playerAId) !== grpOf(m.playerBId)));
}
t('po skupinách klub nasadeniu nebráni', () => withGroups(16, i => (i < 8 ? 'A' : 'B')).ko.main.length > 0);

// --- B) LEN PAVÚK: kluby sa rozdeľujú do sekcií ---
let { slots, em } = bracketOnly(32, i => (i % 4 === 0 ? 'A' : 'K' + i));
t('32-ka: 8 hráčov klubu do 8 osmín po jednom', () => {
  const e = perSection(slots, em, 4, 'A');
  return Object.keys(e).length === 8 && Object.values(e).every(v => v === 1);
});
t('32-ka: nasadená jednotka zostáva na prvom mieste', () => slots[0] === 'y0');
t('32-ka: dvojka je v druhej polovici', () => slots.indexOf('y1') >= 16);

({ slots, em } = bracketOnly(32, i => (i < 4 ? 'A' : 'K' + i)));
t('32-ka: 4 hráči klubu do 4 štvrtín', () => Object.keys(perSection(slots, em, 8, 'A')).length === 4);

({ slots, em } = bracketOnly(16, i => (i % 4 === 0 ? 'A' : 'K' + i)));
t('16-ka: 4 hráči klubu do 4 štvrtín', () => Object.keys(perSection(slots, em, 4, 'A')).length === 4);

t('všetci z jedného klubu prejdú bez pádu', () => bracketOnly(8, () => 'A').slots.filter(Boolean).length === 8);
t('12 hráčov v 16-ke: nikto sa nestratil', () => bracketOnly(12, i => (i < 6 ? 'A' : 'B')).slots.filter(Boolean).length === 12);

console.log(`PAVÚK — REŽIMY: ${ok} prešlo, ${fail} zlyhalo`);
