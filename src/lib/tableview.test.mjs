// Zápis od stola musí vo všetkých fázach správne posunúť víťaza a prepočítať stav.
// Spustenie: skompilované jadro ulož ako ./multisport.mjs a ./stages.mjs
import * as M from './multisport.mjs';
import * as S from './stages.mjs';
let ok = 0, fail = 0;
const t = (n, c) => { try { c() ? ok++ : (fail++, console.error('ZLYHALO:', n)); } catch (e) { fail++; console.error('VÝNIMKA:', n, e.message); } };

const mk = (id, a, b, bo = 5) => ({ id, round: 0, playerAId: a, playerBId: b,
  sets: Array.from({ length: bo }, () => ({ a: null, b: null })), winnerId: null, status: 'scheduled', specialResult: null });
const win = (m, bo = 5) => M.normalizeMatch({ ...m, sets: [{ a: 11, b: 5 }, { a: 11, b: 6 }, { a: 11, b: 7 }] }, bo);

// --- kvalifikácia ---
let q = { slots: 1, bestOf: 5, directIds: [], brackets: [{ id: 'b1', name: 'Vetva 1', rounds: [
  { id: 'r1', name: '1. kolo', kind: 'main', bestOf: 5, matches: [mk('q1', 'p0', 'p1'), mk('q2', 'p2', 'p3')] },
  { id: 'r2', name: 'O postup', kind: 'main', bestOf: 5, matches: [mk('q3', null, null)] }] }] };
q = { ...q, brackets: q.brackets.map(b => ({ ...b, rounds: b.rounds.map((r, i) => i !== 0 ? r : ({ ...r, matches: r.matches.map(m => win(m)) })) })) };
q = M.advanceQualification(q);
t('kvalifikácia: víťazi 1. kola postúpili', () => {
  const r2 = q.brackets[0].rounds[1].matches[0];
  return !!r2.playerAId && !!r2.playerBId;
});

// --- fáza typu pavúk ---
let st = { id: 's', name: 'Pavúk', kind: 'knockout', source: { from: 'entries' }, bestOf: 5, consolation: false, thirdPlace: false,
  rounds: [{ id: 'k1', name: 'Semifinále', kind: 'main', bestOf: 5, matches: [mk('a1', 'p0', 'p1'), mk('a2', 'p2', 'p3')] },
           { id: 'k2', name: 'Finále', kind: 'main', bestOf: 5, matches: [mk('a3', null, null)] }] };
st = { ...st, rounds: st.rounds.map((r, i) => i !== 0 ? r : ({ ...r, matches: r.matches.map(m => win(m)) })) };
st = S.advanceStage(st);
t('fáza: víťazi semifinále sú vo finále', () => {
  const f = st.rounds[1].matches[0];
  return !!f.playerAId && !!f.playerBId;
});

// --- fáza typu skupiny (zápis nemení štruktúru, len výsledok) ---
const gStage = { id: 'g', name: 'Skupiny', kind: 'groups', source: { from: 'entries' }, bestOf: 5, consolation: false,
  groups: [{ id: 'gg', name: 'A', entryIds: ['p0', 'p1'], bestOf: 5, qualifiers: 1, matches: [win(mk('gm', 'p0', 'p1'))] }] };
t('fáza-skupiny: dohratý zápas uzavrie fázu', () => S.stageDone(gStage) === true);

// --- družstvá ---
const tie = { id: 't', competitionId: 'c', homeTeamId: 'H', awayTeamId: 'A', systemId: 'TEAM3_5S',
  nomination: { homeSlots: {}, awaySlots: {}, homeDouble: [], awayDouble: [] },
  homeScore: 0, awayScore: 0, winnerTeamId: null, status: 'scheduled',
  rubbers: [
    { id: 'rb1', order: 1, kind: 'singles', label: 'A-X', homePlayerIds: ['p0'], awayPlayerIds: ['p1'], match: win(mk('m1', 'p0', 'p1')) },
    { id: 'rb2', order: 2, kind: 'singles', label: 'B-Y', homePlayerIds: ['p2'], awayPlayerIds: ['p3'], match: win(mk('m2', 'p2', 'p3')) },
    { id: 'rb3', order: 3, kind: 'singles', label: 'C-Z', homePlayerIds: ['p4'], awayPlayerIds: ['p5'], match: win(mk('m3', 'p4', 'p5')) }] };
const scored = M.scoreTeamTie(tie, 5);
t('družstvo: stav stretnutia sa prepočítal', () => scored.homeScore === 3 && scored.awayScore === 0);
t('družstvo: víťazom je domáce družstvo', () => scored.winnerTeamId === 'H');
t('družstvo: stretnutie je dohraté', () => scored.status === 'finished');

console.log(`ZÁPIS OD STOLA — VŠETKY FÁZY: ${ok} prešlo, ${fail} zlyhalo`);
