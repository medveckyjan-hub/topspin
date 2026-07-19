import { describe, expect, it } from 'vitest';
import * as M from './multisport';

describe('žreb a oddelenie klubov', () => {
// Oddelenie klubov v žrebe. Spustenie: node src/lib/draw.test.mjs (potrebuje skompilované jadro v ./multisport.mjs)
const mk: any = spec => spec.map((club, i) => ({ id: 'p' + i, name: 'H' + i, club, rating: 300 - i, memberIds: ['p' + i] }));
const run: any = (es, pref) => [M.createGroups(es, pref, 5, 2), new Map(es.map(e => [e.id, e]))];
const maxSame = (gs, map, club) => Math.max(...gs.map(g => g.entryIds.filter(id => map.get(id).club === club).length));

let es = mk(Array.from({ length: 32 }, (_, i) => (i < 8 ? 'A' : 'K' + (i % 7))));
let [gs, map] = run(es, 4);
const __chk1 = (() => { try { return !!(maxSame(gs, map, 'A') === 1); } catch (e) { return e; } })();
it('8 hráčov klubu do 8 skupín = 1 na skupinu', () => { if (__chk1 instanceof Error) throw __chk1; expect(__chk1).toBe(true); });
const __chk2 = (() => { try { return !!(gs.reduce((s, g) => s + g.entryIds.length, 0) === 32); } catch (e) { return e; } })();
it('nikto sa nestratil', () => { if (__chk2 instanceof Error) throw __chk2; expect(__chk2).toBe(true); });
const __chk3 = (() => { try { return !!(M.clubConflicts(gs, map).length === 0); } catch (e) { return e; } })();
it('žiadny klubový konflikt', () => { if (__chk3 instanceof Error) throw __chk3; expect(__chk3).toBe(true); });

es = mk(Array.from({ length: 24 }, (_, i) => (i < 10 ? 'A' : 'K' + (i % 5))));
[gs, map] = run(es, 4);
const __chk4 = (() => { try { return !!(maxSame(gs, map, 'A') <= 2); } catch (e) { return e; } })();
it('10 hráčov klubu v 6 skupinách → najviac 2 spolu', () => { if (__chk4 instanceof Error) throw __chk4; expect(__chk4).toBe(true); });

es = mk(Array.from({ length: 12 }, () => 'A'));
[gs, map] = run(es, 4);
const __chk5 = (() => { try { return !!(gs.reduce((s, g) => s + g.entryIds.length, 0) === 12); } catch (e) { return e; } })();
it('všetci z jedného klubu prejdú bez pádu', () => { if (__chk5 instanceof Error) throw __chk5; expect(__chk5).toBe(true); });

es = mk(Array.from({ length: 16 }, (_, i) => (i < 8 ? '' : 'K' + i)));
[gs, map] = run(es, 4);
const __chk6 = (() => { try { return !!(M.clubConflicts(gs, map).length === 0); } catch (e) { return e; } })();
it('hráči bez klubu sa neoddeľujú', () => { if (__chk6 instanceof Error) throw __chk6; expect(__chk6).toBe(true); });

es = mk(Array.from({ length: 32 }, (_, i) => (i % 2 === 0 ? 'A' : 'B')));
[gs, map] = run(es, 4);
const __chk7 = (() => { try { return !!(maxSame(gs, map, 'A') <= 2 && maxSame(gs, map, 'B') <= 2); } catch (e) { return e; } })();
it('dva kluby po 16 v 8 skupinách → najviac 2', () => { if (__chk7 instanceof Error) throw __chk7; expect(__chk7).toBe(true); });

es = mk(Array.from({ length: 16 }, (_, i) => 'K' + i));
[gs, map] = run(es, 4);
const __chk8 = (() => { try { return !!(map.get(gs[0].entryIds[0]).rating === 300); } catch (e) { return e; } })();
it('najvyššie nasadený ide do skupiny A', () => { if (__chk8 instanceof Error) throw __chk8; expect(__chk8).toBe(true); });
const __chk9 = (() => { try { return !!(() => {
  const top = es.slice(0, 4).map(e => e.id);
  return new Set(top.map(id => gs.findIndex(g => g.entryIds.includes(id)))).size === 4;
})(); } catch (e) { return e; } })();
it('štyria najlepší sú v rôznych skupinách', () => { if (__chk9 instanceof Error) throw __chk9; expect(__chk9).toBe(true); });

const ids = Array.from({ length: 20 }, (_, i) => 'q' + i);
const qmap = new Map(ids.map((id, i) => [id, { id, name: 'H' + i, club: i >= 8 && i < 16 ? 'A' : 'K' + i, rating: 200 - i, memberIds: [id] }]));
const q = M.createQualification(ids, qmap, 8, 4, 5);
const __chk10 = (() => { try { return !!(() => {
  const per = q.brackets.map(b => {
    const set = new Set();
    b.rounds[0]?.matches.forEach(m => { if (m.playerAId) set.add(m.playerAId); if (m.playerBId) set.add(m.playerBId); });
    return [...set].filter((id: any) => qmap.get(id).club === 'A').length;
  });
  return Math.max(...per) <= 2;
})(); } catch (e) { return e; } })();
it('kvalifikácia rozdelí klub medzi vetvy', () => { if (__chk10 instanceof Error) throw __chk10; expect(__chk10).toBe(true); });


});
