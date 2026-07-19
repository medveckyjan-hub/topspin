import { describe, expect, it } from 'vitest';
import * as M from './multisport';
import * as S from './stages';

describe('opravy z auditu', () => {
// Opravy z externého auditu: bronz v stageDone a validácia setov pri stole.

const es = Array.from({ length: 8 }, (_, i) => ({ id: 'p' + i, name: 'H' + i, club: 'K' + i, rating: 100 - i, memberIds: ['p' + i] }));
const seeds: any = es.map((e, i) => ({ id: e.id, groupIndex: -1, position: i + 1, club: e.club }));
const win: any = m => M.normalizeMatch({ ...m, sets: [{ a: 11, b: 5 }, { a: 11, b: 6 }, { a: 11, b: 7 }] }, 5);

let st: any = { id: 's', name: 'KO', kind: 'knockout', source: { from: 'entries' }, bestOf: 5, consolation: false, thirdPlace: true,
  rounds: M.buildBracket(seeds, 5, true, 'rating') };

// dohraj všetko okrem zápasu o 3. miesto
for (let i = 0; i < 5; i++) {
  st = { ...st, rounds: st.rounds.map(r => r.kind === 'third' ? r
    : ({ ...r, matches: r.matches.map(m => m.playerAId && m.playerBId && !m.winnerId ? win(m) : m) })) };
  st = S.advanceStage(st);
}
const third = st.rounds.find(r => r.kind === 'third');
const __chk1 = (() => { try { return !!(!!third && !!third.matches[0].playerAId && !third.matches[0].winnerId); } catch (e) { return e; } })();
it('zápas o bronz vznikol a nie je dohratý', () => { if (__chk1 instanceof Error) throw __chk1; expect(__chk1).toBe(true); });
const __chk2 = (() => { try { return !!(S.stageDone(st) === false); } catch (e) { return e; } })();
it('fáza NIE je dohratá, kým sa hrá o bronz', () => { if (__chk2 instanceof Error) throw __chk2; expect(__chk2).toBe(true); });

st = { ...st, rounds: st.rounds.map(r => ({ ...r, matches: r.matches.map(m => m.playerAId && m.playerBId && !m.winnerId ? win(m) : m) })) };
const __chk3 = (() => { try { return !!(S.stageDone(st) === true); } catch (e) { return e; } })();
it('po dohraní bronzu je fáza dohratá', () => { if (__chk3 instanceof Error) throw __chk3; expect(__chk3).toBe(true); });

const base: any = { id: 'm', round: 0, playerAId: 'p0', playerBId: 'p1', status: 'scheduled', winnerId: null, specialResult: null };
const __chk4 = (() => { try { return !!(M.validateMatch({ ...base, sets: [{ a: 7, b: 4 }, { a: 11, b: 2 }, { a: 11, b: 3 }, { a: null, b: null }, { a: null, b: null }] }, 5).valid === false); } catch (e) { return e; } })();
it('set 7:4 je neplatný', () => { if (__chk4 instanceof Error) throw __chk4; expect(__chk4).toBe(true); });
const __chk5 = (() => { try { return !!(M.validateMatch({ ...base, sets: [{ a: 1, b: 0 }, { a: 11, b: 2 }, { a: 11, b: 3 }, { a: null, b: null }, { a: null, b: null }] }, 5).valid === false); } catch (e) { return e; } })();
it('set 1:0 je neplatný', () => { if (__chk5 instanceof Error) throw __chk5; expect(__chk5).toBe(true); });
const __chk6 = (() => { try { return !!(() => { const v = M.validateMatch({ ...base, sets: [{ a: 11, b: 4 }, { a: 11, b: 2 }, { a: 11, b: 3 }, { a: null, b: null }, { a: null, b: null }] }, 5); return v.valid && v.complete; })(); } catch (e) { return e; } })();
it('tri platné sety = dohratý zápas', () => { if (__chk6 instanceof Error) throw __chk6; expect(__chk6).toBe(true); });
const __chk7 = (() => { try { return !!(M.validateMatch({ ...base, sets: [{ a: 12, b: 10 }, { a: 11, b: 2 }, { a: 11, b: 3 }, { a: null, b: null }, { a: null, b: null }] }, 5).valid === true); } catch (e) { return e; } })();
it('12:10 je platný set', () => { if (__chk7 instanceof Error) throw __chk7; expect(__chk7).toBe(true); });


});
