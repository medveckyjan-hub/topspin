import { describe, expect, it } from 'vitest';
import * as M from './multisport';

describe('harmonogram', () => {
// Harmonogram musí počítať s fyzickými hráčmi, nie s ID prihlášky.
const mins = x => { const [a, b] = x.split(':').map(Number); return a * 60 + b; };
const mk: any = (id, a, b) => ({ id, round: 0, playerAId: a, playerBId: b, sets: [], winnerId: null, status: 'scheduled', specialResult: null });

const idx: any = new Map([['p0', ['p0']], ['p1', ['p1']], ['p2', ['p2']], ['p3', ['p3']],
  ['d0', ['p0', 'p1']], ['d1', ['p2', 'p3']], ['t0', ['p0', 'p2']], ['t1', ['p1', 'p3']]]);

const comps: any = () => [
  { id: 'c1', name: 'Dvojhra', type: 'singles', bestOf: 5, thirdPlace: false, consolation: false, groupPlayoff: false,
    entryIds: ['p0', 'p1', 'p2', 'p3'], teamTies: [], ko: { main: [], consolation: [] },
    groups: [{ id: 'g1', name: 'A', entryIds: ['p0', 'p1', 'p2', 'p3'], bestOf: 5, qualifiers: 2, matches: [mk('m1', 'p0', 'p2'), mk('m2', 'p1', 'p3')] }] },
  { id: 'c2', name: 'Štvorhra', type: 'doubles', bestOf: 5, thirdPlace: false, consolation: false, groupPlayoff: false,
    entryIds: ['d0', 'd1'], teamTies: [], ko: { main: [], consolation: [] },
    groups: [{ id: 'g2', name: 'A', entryIds: ['d0', 'd1'], bestOf: 5, qualifiers: 1, matches: [mk('m3', 'd0', 'd1')] }] },
];

const before: any = M.autoSchedule(comps(), 4, '09:00', 20, 5, 'all');
const after: any = M.autoSchedule(comps(), 4, '09:00', 20, 5, 'all', idx);

const __chk1 = (() => { try { return !!(M.scheduleConflicts(before, idx, 20).length > 0); } catch (e) { return e; } })();
it('bez indexu vznikne kolízia (potvrdenie chyby z auditu)', () => { if (__chk1 instanceof Error) throw __chk1; expect(__chk1).toBe(true); });
const __chk2 = (() => { try { return !!(M.scheduleConflicts(after, idx, 20).length === 0); } catch (e) { return e; } })();
it('s indexom hráč nemá dva zápasy naraz', () => { if (__chk2 instanceof Error) throw __chk2; expect(__chk2).toBe(true); });
const __chk3 = (() => { try { return !!(() => {
  const a = mins(after[0].groups[0].matches[0].scheduledTime);
  const b = mins(after[1].groups[0].matches[0].scheduledTime);
  return Math.abs(a - b) >= 25;
})(); } catch (e) { return e; } })();
it('medzi dvojhrou a štvorhrou toho istého hráča je odstup aj s odpočinkom', () => { if (__chk3 instanceof Error) throw __chk3; expect(__chk3).toBe(true); });
const __chk4 = (() => { try { return !!(() => {
  const c = M.scheduleConflicts(before, idx, 20)[0];
  return c && ['p0', 'p1', 'p2', 'p3'].includes(c.playerId) && !!c.a && !!c.b;
})(); } catch (e) { return e; } })();
it('detektor pomenuje konkrétneho hráča', () => { if (__chk4 instanceof Error) throw __chk4; expect(__chk4).toBe(true); });
const __chk5 = (() => { try { return !!(after.every(c => c.groups.every(g => g.matches.every(m => !!m.table && !!m.scheduledTime)))); } catch (e) { return e; } })();
it('zápasy dostali stôl aj čas', () => { if (__chk5 instanceof Error) throw __chk5; expect(__chk5).toBe(true); });
const __chk6 = (() => { try { return !!(() => {
  const teamComp = [{ id: 'c3', name: 'Družstvá', type: 'teams', bestOf: 5, thirdPlace: false, consolation: false, groupPlayoff: false,
    entryIds: ['t0', 't1'], teamTies: [], ko: { main: [], consolation: [] },
    groups: [{ id: 'g3', name: 'A', entryIds: ['t0', 't1'], bestOf: 5, qualifiers: 1, matches: [mk('m4', 't0', 't1')] }] }];
  const mixed = [...comps(), ...teamComp];
  const sched = M.autoSchedule(mixed, 4, '09:00', 20, 5, 'all', idx);
  return M.scheduleConflicts(sched, idx, 20).length === 0;
})(); } catch (e) { return e; } })();
it('družstvo sa rozloží na svojich hráčov', () => { if (__chk6 instanceof Error) throw __chk6; expect(__chk6).toBe(true); });
const __chk7 = (() => { try { return !!(() => {
  const one: any = [{ id: 'c4', name: 'Tímový zápas', type: 'teams', bestOf: 5, thirdPlace: false, consolation: false, groupPlayoff: false,
    entryIds: [], teamTies: [], ko: { main: [], consolation: [] },
    groups: [{ id: 'g4', name: 'A', entryIds: [], bestOf: 5, qualifiers: 1, matches: [mk('m5', 'p0+p1', 'p2+p3'), mk('m6', 'p0', 'p2')] }] }];
  const sched = M.autoSchedule(one, 4, '09:00', 20, 5, 'all', new Map());
  return M.scheduleConflicts(sched, new Map(), 20).length === 0;
})(); } catch (e) { return e; } })();
it('zložené ID "a+b" sa tiež rozloží', () => { if (__chk7 instanceof Error) throw __chk7; expect(__chk7).toBe(true); });


// ---------- kvalifikácia, reťaz fáz a družstvá v harmonograme ----------
const mk2: any = (id, a, b, round = 0) => ({ id, round, playerAId: a, playerBId: b, sets: [], winnerId: null, status: 'scheduled', specialResult: null });
const full: any = () => ({
  id: 'c', name: 'Open', type: 'singles', bestOf: 5, thirdPlace: false, consolation: false, groupPlayoff: false,
  entryIds: ['p0', 'p1', 'p2', 'p3'], ko: { main: [], consolation: [] }, groups: [],
  qualification: { slots: 1, bestOf: 5, directIds: [], brackets: [{ id: 'b1', name: 'Kvalifikácia 1',
    rounds: [{ id: 'r1', name: '1. kolo', kind: 'main', bestOf: 5, matches: [mk2('q1', 'p0', 'p1')] }] }] },
  stagePlan: { stages: [
    { id: 's1', name: 'Skupiny', kind: 'groups', source: { from: 'entries' }, bestOf: 5, consolation: false,
      groups: [{ id: 'sg', name: 'A', entryIds: ['p0', 'p1', 'p2', 'p3'], bestOf: 5, qualifiers: 2,
        matches: [mk2('sm1', 'p0', 'p2'), mk2('sm2', 'p1', 'p3')] }] },
    { id: 's2', name: 'Pavúk', kind: 'knockout', source: { from: 'stage', stageId: 's1', take: 'qualified' }, bestOf: 5, consolation: false,
      rounds: [{ id: 'sr', name: 'Finále', kind: 'main', bestOf: 5, matches: [mk2('sk1', 'p0', 'p1')] }] }] },
  teamTies: [{ id: 't1', competitionId: 'c', homeTeamId: 'h', awayTeamId: 'a', bestOf: 5, rubbers: [
    { id: 'rb1', order: 1, kind: 'singles', label: 'A-X', homePlayerIds: ['p2'], awayPlayerIds: ['p3'], match: mk2('tm1', 'p2', 'p3', 1) },
    { id: 'rb2', order: 2, kind: 'singles', label: 'B-Y', homePlayerIds: ['p0'], awayPlayerIds: ['p1'], match: mk2('tm2', 'p0', 'p1', 2) }] }],
});

const all: any = M.autoSchedule([full()], 2, '09:00', 20, 5, 'all', idx);
const cc = all[0];
const qt = cc.qualification.brackets[0].rounds[0].matches[0];
const sg = cc.stagePlan.stages[0].groups[0].matches[0];
const sk = cc.stagePlan.stages[1].rounds[0].matches[0];
const tr = cc.teamTies[0].rubbers;

const __chk8 = (() => { try { return !!(!!qt.scheduledTime && !!qt.table); } catch (e) { return e; } })();
it('kvalifikácia dostala čas aj stôl', () => { if (__chk8 instanceof Error) throw __chk8; expect(__chk8).toBe(true); });
const __chk9 = (() => { try { return !!(!!sg.scheduledTime && !!sk.scheduledTime); } catch (e) { return e; } })();
it('obe fázy dostali čas', () => { if (__chk9 instanceof Error) throw __chk9; expect(__chk9).toBe(true); });
const __chk10 = (() => { try { return !!(!!tr[0].match.scheduledTime && !!tr[1].match.scheduledTime); } catch (e) { return e; } })();
it('družstevné zápasy dostali čas', () => { if (__chk10 instanceof Error) throw __chk10; expect(__chk10).toBe(true); });
const __chk11 = (() => { try { return !!(mins(qt.scheduledTime) <= mins(sg.scheduledTime)); } catch (e) { return e; } })();
it('kvalifikácia sa hrá pred fázami', () => { if (__chk11 instanceof Error) throw __chk11; expect(__chk11).toBe(true); });
const __chk12 = (() => { try { return !!(mins(sk.scheduledTime) > mins(sg.scheduledTime)); } catch (e) { return e; } })();
it('pavúková fáza až po skupinovej', () => { if (__chk12 instanceof Error) throw __chk12; expect(__chk12).toBe(true); });
const __chk13 = (() => { try { return !!(mins(tr[1].match.scheduledTime) > mins(tr[0].match.scheduledTime)); } catch (e) { return e; } })();
it('zápasy jedného stretnutia idú za sebou', () => { if (__chk13 instanceof Error) throw __chk13; expect(__chk13).toBe(true); });
const __chk14 = (() => { try { return !!(M.scheduleConflicts(all, idx, 20).length === 0); } catch (e) { return e; } })();
it('celý rozpis je bez kolízií hráčov', () => { if (__chk14 instanceof Error) throw __chk14; expect(__chk14).toBe(true); });

const onlyQ: any = M.autoSchedule([full()], 2, '09:00', 20, 5, 'qualification', idx);
const __chk15 = (() => { try { return !!(!!onlyQ[0].qualification.brackets[0].rounds[0].matches[0].scheduledTime
     && !onlyQ[0].stagePlan.stages[0].groups[0].matches[0].scheduledTime); } catch (e) { return e; } })();
it('„len kvalifikácia" nechá fázy nedotknuté', () => { if (__chk15 instanceof Error) throw __chk15; expect(__chk15).toBe(true); });
const onlyT: any = M.autoSchedule([full()], 2, '09:00', 20, 5, 'teams', idx);
const __chk16 = (() => { try { return !!(!!onlyT[0].teamTies[0].rubbers[0].match.scheduledTime
     && !onlyT[0].qualification.brackets[0].rounds[0].matches[0].scheduledTime); } catch (e) { return e; } })();
it('„len družstvá" naplánuje iba stretnutia', () => { if (__chk16 instanceof Error) throw __chk16; expect(__chk16).toBe(true); });


});
