import { describe, expect, it } from 'vitest';
import * as M from './multisport';

describe('nasadzovanie do pavúka', () => {
// Nasadzovanie do pavúka v oboch režimoch.

const played: any = m => M.normalizeMatch({ ...m, sets: [{ a: 11, b: 1 }, { a: 11, b: 2 }, { a: 11, b: 3 }] }, 5);

/** Súťaž so skupinami: pavúk vzniká z postupujúcich. */
function withGroups(n, clubFn) {
  const es = Array.from({ length: n }, (_, i) => ({ id: 'x' + i, name: 'X' + i, club: clubFn(i), rating: 500 - i, memberIds: ['x' + i] }));
  const em = new Map(es.map(e => [e.id, e]));
  const gs = M.createGroups(es, 4, 5, 2);
  gs.forEach(g => g.matches.forEach(m => Object.assign(m, played(m))));
  const c: any = { id: 'c', name: 'C', type: 'singles', bestOf: 5, preferredSize: 4, qualifiersPerGroup: 2, thirdPlace: true, consolation: false, groupPlayoff: false, entryIds: es.map(e => e.id), groups: gs, ko: { main: [], consolation: [] }, teamTies: [] };
  const ko = M.createKnockout(c, em);
  const slots = [];
  ko.main[0].matches.forEach(m => { slots.push(m.playerAId, m.playerBId); });
  return { ko, gs, em, slots };
}

/** Súťaž bez skupín: hrá sa len pavúk. */
function bracketOnly(n, clubFn) {
  const es = Array.from({ length: n }, (_, i) => ({ id: 'y' + i, name: 'Y' + i, club: clubFn(i), rating: 900 - i, memberIds: ['y' + i] }));
  const em = new Map(es.map(e => [e.id, e]));
  const c: any = { id: 'd', name: 'D', type: 'singles', bestOf: 5, preferredSize: 4, qualifiersPerGroup: 2, thirdPlace: true, consolation: false, groupPlayoff: false, entryIds: es.map(e => e.id), groups: [], ko: { main: [], consolation: [] }, teamTies: [] };
  const ko = M.createKnockout(c, em);
  const slots = [];
  ko.main[0].matches.forEach(m => { slots.push(m.playerAId, m.playerBId); });
  return { ko, em, slots };
}

const perSection: any = (slots, em, size, club) => {
  const o = {};
  slots.forEach((id, i) => { if (id && em.get(id).club === club) { const s = Math.floor(i / size); o[s] = (o[s] || 0) + 1; } });
  return o;
};

// --- A) PO SKUPINÁCH: rozhoduje len skupina, klub sa nerieši ---
for (const n of [16, 24, 32]) {
  const { ko, gs, slots } = withGroups(n, i => 'K' + i);
  const half = slots.length / 2;
  const grpOf = id => gs.findIndex(g => g.entryIds.includes(id));
  const __chk1 = (() => { try { return !!(() => {
    for (let gi = 0; gi < gs.length; gi++) {
      const pos = slots.map((id, i) => (id && grpOf(id) === gi ? i : -1)).filter(i => i >= 0);
      if (pos.length === 2 && (pos[0] < half) === (pos[1] < half)) return false;
    }
    return true;
  })(); } catch (e) { return e; } })();
  it(`${n} hráčov: A1 a A2 idú do opačných polovíc`, () => { if (__chk1 instanceof Error) throw __chk1; expect(__chk1).toBe(true); });
  const __chk2 = (() => { try { return !!(ko.main[0].matches.every(m => !m.playerAId || !m.playerBId || grpOf(m.playerAId) !== grpOf(m.playerBId))); } catch (e) { return e; } })();
  it(`${n} hráčov: 1. kolo bez dvojíc z tej istej skupiny`, () => { if (__chk2 instanceof Error) throw __chk2; expect(__chk2).toBe(true); });
}
const __chk3 = (() => { try { return !!(withGroups(16, i => (i < 8 ? 'A' : 'B')).ko.main.length > 0); } catch (e) { return e; } })();
it('po skupinách klub nasadeniu nebráni', () => { if (__chk3 instanceof Error) throw __chk3; expect(__chk3).toBe(true); });

// --- B) LEN PAVÚK: kluby sa rozdeľujú do sekcií ---
let { slots, em } = bracketOnly(32, i => (i % 4 === 0 ? 'A' : 'K' + i));
const __chk4 = (() => { try { return !!(() => {
  const e = perSection(slots, em, 4, 'A');
  return Object.keys(e).length === 8 && Object.values(e).every(v => v === 1);
})(); } catch (e) { return e; } })();
it('32-ka: 8 hráčov klubu do 8 osmín po jednom', () => { if (__chk4 instanceof Error) throw __chk4; expect(__chk4).toBe(true); });
const __chk5 = (() => { try { return !!(slots[0] === 'y0'); } catch (e) { return e; } })();
it('32-ka: nasadená jednotka zostáva na prvom mieste', () => { if (__chk5 instanceof Error) throw __chk5; expect(__chk5).toBe(true); });
const __chk6 = (() => { try { return !!(slots.indexOf('y1') >= 16); } catch (e) { return e; } })();
it('32-ka: dvojka je v druhej polovici', () => { if (__chk6 instanceof Error) throw __chk6; expect(__chk6).toBe(true); });

({ slots, em } = bracketOnly(32, i => (i < 4 ? 'A' : 'K' + i)));
const __chk7 = (() => { try { return !!(Object.keys(perSection(slots, em, 8, 'A')).length === 4); } catch (e) { return e; } })();
it('32-ka: 4 hráči klubu do 4 štvrtín', () => { if (__chk7 instanceof Error) throw __chk7; expect(__chk7).toBe(true); });

({ slots, em } = bracketOnly(16, i => (i % 4 === 0 ? 'A' : 'K' + i)));
const __chk8 = (() => { try { return !!(Object.keys(perSection(slots, em, 4, 'A')).length === 4); } catch (e) { return e; } })();
it('16-ka: 4 hráči klubu do 4 štvrtín', () => { if (__chk8 instanceof Error) throw __chk8; expect(__chk8).toBe(true); });

const __chk9 = (() => { try { return !!(bracketOnly(8, () => 'A').slots.filter(Boolean).length === 8); } catch (e) { return e; } })();
it('všetci z jedného klubu prejdú bez pádu', () => { if (__chk9 instanceof Error) throw __chk9; expect(__chk9).toBe(true); });
const __chk10 = (() => { try { return !!(bracketOnly(12, i => (i < 6 ? 'A' : 'B')).slots.filter(Boolean).length === 12); } catch (e) { return e; } })();
it('12 hráčov v 16-ke: nikto sa nestratil', () => { if (__chk10 instanceof Error) throw __chk10; expect(__chk10).toBe(true); });


});
