import { describe, expect, it } from 'vitest';
import * as M from './multisport';
import * as S from './stages';

describe('zápis od stola', () => {
// Zápis od stola musí vo všetkých fázach správne posunúť víťaza a prepočítať stav.

const mk: any = (id, a, b, bo = 5) => ({ id, round: 0, playerAId: a, playerBId: b,
  sets: Array.from({ length: bo }, () => ({ a: null, b: null })), winnerId: null, status: 'scheduled', specialResult: null });
const win: any = (m, bo = 5) => M.normalizeMatch({ ...m, sets: [{ a: 11, b: 5 }, { a: 11, b: 6 }, { a: 11, b: 7 }] }, bo);

// --- kvalifikácia ---
let q: any = { slots: 1, bestOf: 5, directIds: [], brackets: [{ id: 'b1', name: 'Vetva 1', rounds: [
  { id: 'r1', name: '1. kolo', kind: 'main', bestOf: 5, matches: [mk('q1', 'p0', 'p1'), mk('q2', 'p2', 'p3')] },
  { id: 'r2', name: 'O postup', kind: 'main', bestOf: 5, matches: [mk('q3', null, null)] }] }] };
q = { ...q, brackets: q.brackets.map(b => ({ ...b, rounds: b.rounds.map((r, i) => i !== 0 ? r : ({ ...r, matches: r.matches.map(m => win(m)) })) })) };
q = M.advanceQualification(q);
const __chk1 = (() => { try { return !!(() => {
  const r2 = q.brackets[0].rounds[1].matches[0];
  return !!r2.playerAId && !!r2.playerBId;
})(); } catch (e) { return e; } })();
it('kvalifikácia: víťazi 1. kola postúpili', () => { if (__chk1 instanceof Error) throw __chk1; expect(__chk1).toBe(true); });

// --- fáza typu pavúk ---
let st: any = { id: 's', name: 'Pavúk', kind: 'knockout', source: { from: 'entries' }, bestOf: 5, consolation: false, thirdPlace: false,
  rounds: [{ id: 'k1', name: 'Semifinále', kind: 'main', bestOf: 5, matches: [mk('a1', 'p0', 'p1'), mk('a2', 'p2', 'p3')] },
           { id: 'k2', name: 'Finále', kind: 'main', bestOf: 5, matches: [mk('a3', null, null)] }] };
st = { ...st, rounds: st.rounds.map((r, i) => i !== 0 ? r : ({ ...r, matches: r.matches.map(m => win(m)) })) };
st = S.advanceStage(st);
const __chk2 = (() => { try { return !!(() => {
  const f = st.rounds[1].matches[0];
  return !!f.playerAId && !!f.playerBId;
})(); } catch (e) { return e; } })();
it('fáza: víťazi semifinále sú vo finále', () => { if (__chk2 instanceof Error) throw __chk2; expect(__chk2).toBe(true); });

// --- fáza typu skupiny (zápis nemení štruktúru, len výsledok) ---
const gStage: any = { id: 'g', name: 'Skupiny', kind: 'groups', source: { from: 'entries' }, bestOf: 5, consolation: false,
  groups: [{ id: 'gg', name: 'A', entryIds: ['p0', 'p1'], bestOf: 5, qualifiers: 1, matches: [win(mk('gm', 'p0', 'p1'))] }] };
const __chk3 = (() => { try { return !!(S.stageDone(gStage) === true); } catch (e) { return e; } })();
it('fáza-skupiny: dohratý zápas uzavrie fázu', () => { if (__chk3 instanceof Error) throw __chk3; expect(__chk3).toBe(true); });

// --- družstvá ---
const tie: any = { id: 't', competitionId: 'c', homeTeamId: 'H', awayTeamId: 'A', systemId: 'TEAM3_5S',
  nomination: { homeSlots: {}, awaySlots: {}, homeDouble: [], awayDouble: [] },
  homeScore: 0, awayScore: 0, winnerTeamId: null, status: 'scheduled',
  rubbers: [
    { id: 'rb1', order: 1, kind: 'singles', label: 'A-X', homePlayerIds: ['p0'], awayPlayerIds: ['p1'], match: win(mk('m1', 'p0', 'p1')) },
    { id: 'rb2', order: 2, kind: 'singles', label: 'B-Y', homePlayerIds: ['p2'], awayPlayerIds: ['p3'], match: win(mk('m2', 'p2', 'p3')) },
    { id: 'rb3', order: 3, kind: 'singles', label: 'C-Z', homePlayerIds: ['p4'], awayPlayerIds: ['p5'], match: win(mk('m3', 'p4', 'p5')) }] };
const scored = M.scoreTeamTie(tie, 5);
const __chk4 = (() => { try { return !!(scored.homeScore === 3 && scored.awayScore === 0); } catch (e) { return e; } })();
it('družstvo: stav stretnutia sa prepočítal', () => { if (__chk4 instanceof Error) throw __chk4; expect(__chk4).toBe(true); });
const __chk5 = (() => { try { return !!(scored.winnerTeamId === 'H'); } catch (e) { return e; } })();
it('družstvo: víťazom je domáce družstvo', () => { if (__chk5 instanceof Error) throw __chk5; expect(__chk5).toBe(true); });
const __chk6 = (() => { try { return !!(scored.status === 'finished'); } catch (e) { return e; } })();
it('družstvo: stretnutie je dohraté', () => { if (__chk6 instanceof Error) throw __chk6; expect(__chk6).toBe(true); });


});
