// Harmonogram musí počítať s fyzickými hráčmi, nie s ID prihlášky.
// Spustenie: skompilované jadro ulož ako ./multisport.mjs
import * as M from './multisport.mjs';
let ok = 0, fail = 0;
const t = (n, c) => { try { c() ? ok++ : (fail++, console.error('ZLYHALO:', n)); } catch (e) { fail++; console.error('VÝNIMKA:', n, e.message); } };
const mins = x => { const [a, b] = x.split(':').map(Number); return a * 60 + b; };
const mk = (id, a, b) => ({ id, round: 0, playerAId: a, playerBId: b, sets: [], winnerId: null, status: 'scheduled', specialResult: null });

const idx = new Map([['p0', ['p0']], ['p1', ['p1']], ['p2', ['p2']], ['p3', ['p3']],
  ['d0', ['p0', 'p1']], ['d1', ['p2', 'p3']], ['t0', ['p0', 'p2']], ['t1', ['p1', 'p3']]]);

const comps = () => [
  { id: 'c1', name: 'Dvojhra', type: 'singles', bestOf: 5, thirdPlace: false, consolation: false, groupPlayoff: false,
    entryIds: ['p0', 'p1', 'p2', 'p3'], teamTies: [], ko: { main: [], consolation: [] },
    groups: [{ id: 'g1', name: 'A', entryIds: ['p0', 'p1', 'p2', 'p3'], bestOf: 5, qualifiers: 2, matches: [mk('m1', 'p0', 'p2'), mk('m2', 'p1', 'p3')] }] },
  { id: 'c2', name: 'Štvorhra', type: 'doubles', bestOf: 5, thirdPlace: false, consolation: false, groupPlayoff: false,
    entryIds: ['d0', 'd1'], teamTies: [], ko: { main: [], consolation: [] },
    groups: [{ id: 'g2', name: 'A', entryIds: ['d0', 'd1'], bestOf: 5, qualifiers: 1, matches: [mk('m3', 'd0', 'd1')] }] },
];

const before = M.autoSchedule(comps(), 4, '09:00', 20, 5, 'all');
const after = M.autoSchedule(comps(), 4, '09:00', 20, 5, 'all', idx);

t('bez indexu vznikne kolízia (potvrdenie chyby z auditu)',
  () => M.scheduleConflicts(before, idx, 20).length > 0);
t('s indexom hráč nemá dva zápasy naraz',
  () => M.scheduleConflicts(after, idx, 20).length === 0);
t('medzi dvojhrou a štvorhrou toho istého hráča je odstup aj s odpočinkom', () => {
  const a = mins(after[0].groups[0].matches[0].scheduledTime);
  const b = mins(after[1].groups[0].matches[0].scheduledTime);
  return Math.abs(a - b) >= 25;
});
t('detektor pomenuje konkrétneho hráča', () => {
  const c = M.scheduleConflicts(before, idx, 20)[0];
  return c && ['p0', 'p1', 'p2', 'p3'].includes(c.playerId) && !!c.a && !!c.b;
});
t('zápasy dostali stôl aj čas',
  () => after.every(c => c.groups.every(g => g.matches.every(m => !!m.table && !!m.scheduledTime))));
t('družstvo sa rozloží na svojich hráčov', () => {
  const teamComp = [{ id: 'c3', name: 'Družstvá', type: 'teams', bestOf: 5, thirdPlace: false, consolation: false, groupPlayoff: false,
    entryIds: ['t0', 't1'], teamTies: [], ko: { main: [], consolation: [] },
    groups: [{ id: 'g3', name: 'A', entryIds: ['t0', 't1'], bestOf: 5, qualifiers: 1, matches: [mk('m4', 't0', 't1')] }] }];
  const mixed = [...comps(), ...teamComp];
  const sched = M.autoSchedule(mixed, 4, '09:00', 20, 5, 'all', idx);
  return M.scheduleConflicts(sched, idx, 20).length === 0;
});
t('zložené ID "a+b" sa tiež rozloží', () => {
  const one = [{ id: 'c4', name: 'Tímový zápas', type: 'teams', bestOf: 5, thirdPlace: false, consolation: false, groupPlayoff: false,
    entryIds: [], teamTies: [], ko: { main: [], consolation: [] },
    groups: [{ id: 'g4', name: 'A', entryIds: [], bestOf: 5, qualifiers: 1, matches: [mk('m5', 'p0+p1', 'p2+p3'), mk('m6', 'p0', 'p2')] }] }];
  const sched = M.autoSchedule(one, 4, '09:00', 20, 5, 'all', new Map());
  return M.scheduleConflicts(sched, new Map(), 20).length === 0;
});


// ---------- kvalifikácia, reťaz fáz a družstvá v harmonograme ----------
const mk2 = (id, a, b, round = 0) => ({ id, round, playerAId: a, playerBId: b, sets: [], winnerId: null, status: 'scheduled', specialResult: null });
const full = () => ({
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

const all = M.autoSchedule([full()], 2, '09:00', 20, 5, 'all', idx);
const cc = all[0];
const qt = cc.qualification.brackets[0].rounds[0].matches[0];
const sg = cc.stagePlan.stages[0].groups[0].matches[0];
const sk = cc.stagePlan.stages[1].rounds[0].matches[0];
const tr = cc.teamTies[0].rubbers;

t('kvalifikácia dostala čas aj stôl', () => !!qt.scheduledTime && !!qt.table);
t('obe fázy dostali čas', () => !!sg.scheduledTime && !!sk.scheduledTime);
t('družstevné zápasy dostali čas', () => !!tr[0].match.scheduledTime && !!tr[1].match.scheduledTime);
t('kvalifikácia sa hrá pred fázami', () => mins(qt.scheduledTime) <= mins(sg.scheduledTime));
t('pavúková fáza až po skupinovej', () => mins(sk.scheduledTime) > mins(sg.scheduledTime));
t('zápasy jedného stretnutia idú za sebou', () => mins(tr[1].match.scheduledTime) > mins(tr[0].match.scheduledTime));
t('celý rozpis je bez kolízií hráčov', () => M.scheduleConflicts(all, idx, 20).length === 0);

const onlyQ = M.autoSchedule([full()], 2, '09:00', 20, 5, 'qualification', idx);
t('„len kvalifikácia" nechá fázy nedotknuté',
  () => !!onlyQ[0].qualification.brackets[0].rounds[0].matches[0].scheduledTime
     && !onlyQ[0].stagePlan.stages[0].groups[0].matches[0].scheduledTime);
const onlyT = M.autoSchedule([full()], 2, '09:00', 20, 5, 'teams', idx);
t('„len družstvá" naplánuje iba stretnutia',
  () => !!onlyT[0].teamTies[0].rubbers[0].match.scheduledTime
     && !onlyT[0].qualification.brackets[0].rounds[0].matches[0].scheduledTime);

console.log(`HARMONOGRAM A FYZICKÍ HRÁČI: ${ok} prešlo, ${fail} zlyhalo`);
