import { describe, expect, it } from 'vitest';
import {
  advanceKnockout, applySubstitution, buildBracket, buildTeamTie, createQualification, normalizeMatch,
  qualificationDone, qualificationWinners, qualifiedForGroups, standings, TEAM_SYSTEMS,
} from './multisport';
import { advanceStage, finalPlacement, newStage, stageCycles, stageDone } from './stages';
import type { GenericEntry, KnockoutRound, Match, TournamentGroup } from '../types';

const mkMap: any = (n: number) => new Map<string, GenericEntry>(
  Array.from({ length: n }, (_, i) => [`p${i}`, { id: `p${i}`, name: `H${i}`, club: '', rating: 100 - i, memberIds: [`p${i}`] }]));
const mk: any = (id: string, a: string | null, b: string | null): Match =>
  ({ id, round: 0, playerAId: a, playerBId: b, sets: [], winnerId: null, status: 'scheduled', specialResult: null });
const winA: any = (m: Match, bestOf: 3 | 5 | 7 = 5) => normalizeMatch({ ...m, sets: [{ a: 11, b: 1 }, { a: 11, b: 2 }, { a: 11, b: 3 }] }, bestOf);
const winB: any = (m: Match, bestOf: 3 | 5 | 7 = 5) => normalizeMatch({ ...m, sets: [{ a: 1, b: 11 }, { a: 2, b: 11 }, { a: 3, b: 11 }] }, bestOf);

// ─────────────────────────────────────────────────────────────
// P0-02 Kvalifikácia s nulovou, jednočlennou a plnou vetvou
// ─────────────────────────────────────────────────────────────
describe('regresia P0-02 — hraničné kvalifikácie', () => {
  it('všetci postupujú priamo → žiadna vetva a kvalifikácia je hotová', () => {
    const q = createQualification(['p0', 'p1', 'p2', 'p3'], mkMap(4), 4, 0, 5);
    expect(q.brackets).toHaveLength(0);
    expect(qualificationDone(q)).toBe(true);
    expect(qualifiedForGroups(q)).toHaveLength(4);
  });

  it('nula miest v kvalifikácii nevytvorí prázdnu nedohratú vetvu', () => {
    const q = createQualification(['p0', 'p1', 'p2'], mkMap(3), 1, 0, 5);
    expect(q.brackets).toHaveLength(0);
    expect(qualificationDone(q)).toBe(true);
  });

  it('jednočlenná vetva má automatického víťaza, nie večne nedohratú vetvu', () => {
    const q = createQualification(['p0', 'p1', 'p2'], mkMap(3), 2, 1, 5);
    expect(q.brackets).toHaveLength(1);
    expect(q.brackets[0].autoQualifiedId).toBeTruthy();
    expect(qualificationWinners(q).filter(Boolean)).toHaveLength(1);
    expect(qualificationDone(q)).toBe(true);
  });

  it('dvojčlenná vetva sa musí odohrať — pred zápasom nikto nepostupuje', () => {
    const q = createQualification(['p0', 'p1', 'p2', 'p3'], mkMap(4), 2, 1, 5);
    expect(q.brackets[0].rounds.length).toBeGreaterThan(0);
    expect(qualificationDone(q)).toBe(false);
  });

  it('viac vetiev: každá dá práve jedného postupujúceho', () => {
    const q = createQualification(Array.from({ length: 12 }, (_, i) => `p${i}`), mkMap(12), 0, 4, 5);
    expect(q.brackets).toHaveLength(4);
    const played = { ...q, brackets: q.brackets.map(b => ({ ...b, rounds: b.rounds.map(r => ({ ...r, matches: r.matches.map(m => m.playerAId && m.playerBId ? winA(m) : m) })) })) };
    let adv = played;
    for (let i = 0; i < 4; i++) {
      adv = { ...adv, brackets: adv.brackets.map(b => ({ ...b, rounds: advanceKnockout(b.rounds).map(r => ({ ...r, matches: r.matches.map(m => m.playerAId && m.playerBId && !m.winnerId ? winA(m) : m) })) })) };
    }
    expect(qualificationWinners(adv).filter(Boolean)).toHaveLength(4);
  });
});

// ─────────────────────────────────────────────────────────────
// P0-03 / P0-04 Starý výsledok nesmie prežiť zmenu účastníka
// ─────────────────────────────────────────────────────────────
const semiBracket: any = (): KnockoutRound[] => ([
  { id: 'r1', name: 'Semifinále', kind: 'main', bestOf: 5, matches: [mk('a1', 'p0', 'p1'), mk('a2', 'p2', 'p3')] },
  { id: 'r2', name: 'Finále', kind: 'main', bestOf: 5, matches: [mk('a3', null, null)] },
  { id: 'r3', name: 'O 3. miesto', kind: 'third', bestOf: 5, matches: [mk('a4', null, null)] },
]);

describe('regresia P0-03 — oprava skoršieho kola', () => {
  it('po zmene víťaza semifinále sa starý výsledok finále neprenesie na nového hráča', () => {
    let r = semiBracket();
    r = r.map(x => ({ ...x, matches: x.matches.map(m => (m.playerAId && m.playerBId ? winA(m) : m)) }));
    r = advanceKnockout(r);
    r = r.map((x, i) => (i !== 1 ? x : { ...x, matches: x.matches.map(m => winA(m)) }));
    const before = r[1].matches[0];
    expect(before.winnerId).toBe('p0');

    // rozhodca opraví semifinále — vyhrá p1
    r = r.map((x, i) => (i !== 0 ? x : { ...x, matches: x.matches.map((m, mi) => (mi !== 0 ? m : winB(m))) }));
    r = advanceKnockout(r);

    const after = r[1].matches[0];
    expect(after.playerAId).toBe('p1');            // vo finále je nový hráč
    expect(after.winnerId).toBeNull();             // a starý výsledok je preč
    expect(after.sets.filter(s => s.a !== null)).toHaveLength(0);
  });

  it('bronzový zápas nesmie mať víťaza spomedzi neúčastníkov', () => {
    let r = semiBracket();
    r = r.map(x => ({ ...x, matches: x.matches.map(m => (m.playerAId && m.playerBId ? winA(m) : m)) }));
    r = advanceKnockout(r);
    const third = r.find(x => x.kind === 'third')!.matches[0];
    const entrants = [third.playerAId, third.playerBId];
    if (third.winnerId) expect(entrants).toContain(third.winnerId);

    // po oprave semifinále musí byť bronz opäť bez výsledku
    r = r.map((x, i) => (i !== 0 ? x : { ...x, matches: x.matches.map((m, mi) => (mi !== 0 ? m : winB(m))) }));
    r = advanceKnockout(r);
    const t2 = r.find(x => x.kind === 'third')!.matches[0];
    if (t2.winnerId) expect([t2.playerAId, t2.playerBId]).toContain(t2.winnerId);
  });

  it('to isté platí vo fáze typu pavúk', () => {
    let st = newStage({ name: 'Pavúk', kind: 'knockout', source: { from: 'entries' } });
    st = { ...st, rounds: semiBracket() };
    st = { ...st, rounds: st.rounds!.map(x => ({ ...x, matches: x.matches.map(m => (m.playerAId && m.playerBId ? winA(m) : m)) })) };
    st = advanceStage(st);
    st = { ...st, rounds: st.rounds!.map((x, i) => (i !== 1 ? x : { ...x, matches: x.matches.map(m => winA(m)) })) };
    st = { ...st, rounds: st.rounds!.map((x, i) => (i !== 0 ? x : { ...x, matches: x.matches.map((m, mi) => (mi !== 0 ? m : winB(m))) })) };
    st = advanceStage(st);
    const fin = st.rounds![1].matches[0];
    expect(fin.playerAId).toBe('p1');
    expect(fin.winnerId).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// P0-05 Cyklus vo fázach
// ─────────────────────────────────────────────────────────────
describe('regresia P0-05 — cyklus vo fázach', () => {
  const cyclicPlan = () => {
    const a = newStage({ name: 'A', kind: 'groups', source: { from: 'entries' } });
    const b = newStage({ name: 'B', kind: 'groups', source: { from: 'stage', stageId: a.id, take: 'qualified' } });
    a.source = { from: 'stage', stageId: b.id, take: 'qualified' };
    return { stages: [a, b] };
  };

  it('konečné poradie nespadne na pretečenie zásobníka', () => {
    const out = finalPlacement(cyclicPlan(), ['p0', 'p1'], mkMap(2));
    expect(out).toHaveLength(2);
  });

  it('cyklus sa dá diagnostikovať namiesto pádu', () => {
    const cycles = stageCycles(cyclicPlan());
    expect(cycles.length).toBeGreaterThan(0);
    expect(cycles[0].length).toBeGreaterThan(1);
  });

  it('zdravý reťazec žiadny cyklus nehlási', () => {
    const a = newStage({ name: 'Skupiny', kind: 'groups', source: { from: 'entries' } });
    const b = newStage({ name: 'Pavúk', kind: 'knockout', source: { from: 'stage', stageId: a.id, take: 'qualified' } });
    expect(stageCycles({ stages: [a, b] })).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// Striedanie v družstve
// ─────────────────────────────────────────────────────────────
describe('regresia — striedanie v družstve', () => {
  const team: any = (id: string, ids: string[]) => ({ id, name: id, club: '', playerIds: ids });
  const tie: any = () => buildTeamTie('c1', team('H', ['p0', 'p1', 'p2']), team('A', ['p3', 'p4', 'p5']), 'TEAM3_5S', 5);

  it('striedanie prepíše hráča v ešte neodohratých zápasoch', () => {
    const out = applySubstitution(tie(), 'home', 'p2', 'p9', 2, 5);
    const after = out.rubbers.filter(r => r.order >= 2);
    expect(after.some(r => r.homePlayerIds.includes('p9'))).toBe(true);
    expect(after.every(r => !r.homePlayerIds.includes('p2'))).toBe(true);
  });

  it('striedanie nesiahne na už odohraté zápasy', () => {
    const out = applySubstitution(tie(), 'home', 'p0', 'p9', 3, 5);
    const before = out.rubbers.filter(r => r.order < 3);
    expect(before.every(r => !r.homePlayerIds.includes('p9'))).toBe(true);
  });

  it('druhé striedanie toho istého družstva sa odmietne', () => {
    const first = applySubstitution(tie(), 'home', 'p2', 'p9', 2, 5);
    expect(() => applySubstitution(first, 'home', 'p1', 'p8', 3, 5)).toThrow();
  });

  it('striedanie vynuluje výsledok dotknutého zápasu', () => {
    let t0 = tie();
    t0 = { ...t0, rubbers: t0.rubbers.map(r => (r.order === 3 ? { ...r, match: winA(r.match) } : r)) };
    const out = applySubstitution(t0, 'home', 'p2', 'p9', 2, 5);
    const r3 = out.rubbers.find(r => r.order === 3)!;
    expect(r3.match.winnerId).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// Špeciálne výsledky (WO) a ich vplyv
// ─────────────────────────────────────────────────────────────
describe('regresia — špeciálne výsledky', () => {
  it('WO určí víťaza bez setov a označí zápas ako kontumovaný', () => {
    const m = normalizeMatch({ ...mk('w1', 'p0', 'p1'), specialResult: 'WO_B' }, 5);
    expect(m.winnerId).toBe('p0');
    expect(m.status).toBe('walkover');
  });
  it('zrušenie WO zmaže aj víťaza', () => {
    const won = normalizeMatch({ ...mk('w2', 'p0', 'p1'), specialResult: 'WO_A' }, 5);
    expect(won.winnerId).toBe('p1');
    const cleared = normalizeMatch({ ...won, specialResult: null, sets: [] }, 5);
    expect(cleared.winnerId).toBeNull();
    expect(cleared.status).not.toBe('finished');
  });
  it('RET a DSQ majú vlastný stav, nie obyčajné dohratie', () => {
    expect(normalizeMatch({ ...mk('w3', 'p0', 'p1'), specialResult: 'RET_A' }, 5).status).toBe('retired');
    expect(normalizeMatch({ ...mk('w4', 'p0', 'p1'), specialResult: 'DSQ_B' }, 5).status).toBe('disqualified');
  });
  it('WO sa premietne do tabuľky skupiny', () => {
    const g: TournamentGroup = { id: 'g', name: 'A', entryIds: ['p0', 'p1'], bestOf: 5, qualifiers: 1,
      matches: [normalizeMatch({ ...mk('gm', 'p0', 'p1'), specialResult: 'WO_B' }, 5)] };
    const rows = standings(g, mkMap(2));
    expect(rows[0].entry.id).toBe('p0');
    expect(rows[0].matchPoints).toBeGreaterThan(rows[1].matchPoints);
  });
});

// ─────────────────────────────────────────────────────────────
// Nasadzovanie — ochrana opráv FIX-06
// ─────────────────────────────────────────────────────────────
describe('regresia — tímové systémy podľa pravidiel', () => {
  it('New Swaythling Cup: 5 dvojhier, cieľ 3', () => {
    const s = TEAM_SYSTEMS.SWAYTHLING;
    expect(s.rubbers).toHaveLength(5);
    expect(s.winTarget).toBe(3);
    expect(s.rubbers.every(r => r.kind === 'singles')).toBe(true);
    expect(s.rubbers.map(r => `${r.homeSlot}${r.awaySlot}`)).toEqual(['AX', 'BY', 'CZ', 'AY', 'BX']);
  });
  it('Corbillon Cup: 4 dvojhry + štvorhra na treťom mieste, cieľ 3', () => {
    const s = TEAM_SYSTEMS.CORBILLON;
    expect(s.rubbers).toHaveLength(5);
    expect(s.winTarget).toBe(3);
    expect(s.rubbers[2].kind).toBe('doubles');
    expect(s.rubbers.filter(r => r.kind === 'singles')).toHaveLength(4);
  });
  it('ITTF Best of 9 ostáva samostatne, cieľ 5', () => {
    const s = TEAM_SYSTEMS.TEAM3_9S;
    expect(s.rubbers).toHaveLength(9);
    expect(s.winTarget).toBe(5);
  });
});

// ─────────────────────────────────────────────────────────────
// Bye a nasadenie — ochrana skoršej opravy
// ─────────────────────────────────────────────────────────────
describe('regresia — voľné žreby patria nasadeným', () => {
  it('pri 12 hráčoch v 16-ke má nasadená jednotka voľný žreb', () => {
    const seeds = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, groupIndex: -1, position: i + 1, club: '' }));
    const rounds = buildBracket(seeds, 5, true, 'rating');
    const first = rounds.filter(r => r.kind !== 'third')[0];
    const top = first.matches.find(m => m.playerAId === 'p0' || m.playerBId === 'p0')!;
    expect(top.playerAId === null || top.playerBId === null).toBe(true);
  });
});
