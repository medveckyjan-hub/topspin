// Opravy z externého auditu: bronz v stageDone a validácia setov pri stole.
// Spustenie: skompilované jadro ulož ako ./multisport.mjs a ./stages.mjs
import * as M from './multisport.mjs';
import * as S from './stages.mjs';
let ok = 0, fail = 0;
const t = (n, c) => { try { c() ? ok++ : (fail++, console.error('ZLYHALO:', n)); } catch (e) { fail++; console.error('VÝNIMKA:', n, e.message); } };

const es = Array.from({ length: 8 }, (_, i) => ({ id: 'p' + i, name: 'H' + i, club: 'K' + i, rating: 100 - i, memberIds: ['p' + i] }));
const seeds = es.map((e, i) => ({ id: e.id, groupIndex: -1, position: i + 1, club: e.club }));
const win = m => M.normalizeMatch({ ...m, sets: [{ a: 11, b: 5 }, { a: 11, b: 6 }, { a: 11, b: 7 }] }, 5);

let st = { id: 's', name: 'KO', kind: 'knockout', source: { from: 'entries' }, bestOf: 5, consolation: false, thirdPlace: true,
  rounds: M.buildBracket(seeds, 5, true, 'rating') };

// dohraj všetko okrem zápasu o 3. miesto
for (let i = 0; i < 5; i++) {
  st = { ...st, rounds: st.rounds.map(r => r.kind === 'third' ? r
    : ({ ...r, matches: r.matches.map(m => m.playerAId && m.playerBId && !m.winnerId ? win(m) : m) })) };
  st = S.advanceStage(st);
}
const third = st.rounds.find(r => r.kind === 'third');
t('zápas o bronz vznikol a nie je dohratý', () => !!third && !!third.matches[0].playerAId && !third.matches[0].winnerId);
t('fáza NIE je dohratá, kým sa hrá o bronz', () => S.stageDone(st) === false);

st = { ...st, rounds: st.rounds.map(r => ({ ...r, matches: r.matches.map(m => m.playerAId && m.playerBId && !m.winnerId ? win(m) : m) })) };
t('po dohraní bronzu je fáza dohratá', () => S.stageDone(st) === true);

const base = { id: 'm', round: 0, playerAId: 'p0', playerBId: 'p1', status: 'scheduled', winnerId: null, specialResult: null };
t('set 7:4 je neplatný', () => M.validateMatch({ ...base, sets: [{ a: 7, b: 4 }, { a: 11, b: 2 }, { a: 11, b: 3 }, { a: null, b: null }, { a: null, b: null }] }, 5).valid === false);
t('set 1:0 je neplatný', () => M.validateMatch({ ...base, sets: [{ a: 1, b: 0 }, { a: 11, b: 2 }, { a: 11, b: 3 }, { a: null, b: null }, { a: null, b: null }] }, 5).valid === false);
t('tri platné sety = dohratý zápas', () => { const v = M.validateMatch({ ...base, sets: [{ a: 11, b: 4 }, { a: 11, b: 2 }, { a: 11, b: 3 }, { a: null, b: null }, { a: null, b: null }] }, 5); return v.valid && v.complete; });
t('12:10 je platný set', () => M.validateMatch({ ...base, sets: [{ a: 12, b: 10 }, { a: 11, b: 2 }, { a: 11, b: 3 }, { a: null, b: null }, { a: null, b: null }] }, 5).valid === true);

console.log(`OPRAVY Z AUDITU: ${ok} prešlo, ${fail} zlyhalo`);
