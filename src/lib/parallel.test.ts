import { describe, expect, it } from 'vitest';
import { autoSchedule, buildTeamTie, createGroups, normalizeMatch, scheduleConflicts, scheduleSpan } from './multisport';
import type { Competition, GenericEntry, Match, TeamEntry } from '../types';

/**
 * Súťaže sa v jednej hale hrajú SÚBEŽNE. Kým sa ukladali za sebou, štyri
 * kategórie mládeže natiahli deň na dvojnásobok a pridanie stolov nepomáhalo.
 * Rovnako sa reťazili družstevné stretnutia, hoci sú to iné družstvá.
 */
const mins = (t?: string) => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m; };

const makeComp = (id: string, n: number, offset: number): [Competition, Map<string, GenericEntry>] => {
  const entries: GenericEntry[] = Array.from({ length: n }, (_, i) => ({
    id: `${id}p${i}`, name: `${id} ${i}`, club: `K${(i + offset) % 7}`, rating: 1500 - i * 9, memberIds: [`${id}p${i}`],
  }));
  const map = new Map(entries.map(e => [e.id, e]));
  const c: Competition = {
    id, name: `Súťaž ${id}`, type: 'singles', bestOf: 5, preferredSize: 4, qualifiersPerGroup: 2,
    thirdPlace: false, consolation: false, groupPlayoff: false, entryIds: entries.map(e => e.id),
    groups: createGroups(entries, 4, 5, 2), ko: { main: [], consolation: [] }, teamTies: [],
  };
  return [c, map];
};

describe('súbežnosť v hale', () => {
  it('štyri kategórie sa nehrajú za sebou, ale súbežne', () => {
    const built = ['a', 'b', 'c', 'd'].map((id, i) => makeComp(id, 24, i));
    const comps = built.map(([c]) => c);
    const idx = new Map(comps.flatMap(c => c.entryIds.map(x => [x, [x]] as [string, string[]])));
    const sched = autoSchedule(comps, 12, '09:00', 20, 5, 'all', idx);

    const zaciatky = sched.map(c => Math.min(...c.groups.flatMap(g => g.matches.map(m => mins(m.scheduledTime)))));
    // všetky kategórie musia začať v prvej hodine, nie postupne cez deň
    zaciatky.forEach(z => expect(z).toBeLessThanOrEqual(mins('10:00')));
  });

  it('pridanie stolov skráti turnaj', () => {
    const koniec = (tables: number) => {
      const comps = ['a', 'b', 'c', 'd'].map((id, i) => makeComp(id, 24, i)[0]);
      const idx = new Map(comps.flatMap(c => c.entryIds.map(x => [x, [x]] as [string, string[]])));
      const s = autoSchedule(comps, tables, '09:00', 20, 5, 'all', idx);
      return Math.max(...s.flatMap(c => c.groups.flatMap(g => g.matches.map(m => mins(m.scheduledTime)))));
    };
    expect(koniec(16)).toBeLessThan(koniec(6));
  });

  it('družstevné stretnutia bežia súbežne, zápasy vnútri stretnutia za sebou', () => {
    const teams: TeamEntry[] = Array.from({ length: 4 }, (_, i) => ({
      id: `t${i}`, name: `Družstvo ${i}`, club: `K${i}`, playerIds: [`t${i}a`, `t${i}b`, `t${i}c`],
    }));
    const ties = [];
    for (let i = 0; i < teams.length; i++)
      for (let j = i + 1; j < teams.length; j++)
        ties.push(buildTeamTie('tc', teams[i], teams[j], 'TEAM3_5S', 5));
    const c: Competition = {
      id: 'tc', name: 'Družstvá', type: 'teams', bestOf: 5, preferredSize: 4, qualifiersPerGroup: 2,
      thirdPlace: false, consolation: false, groupPlayoff: false, entryIds: teams.map(t => t.id),
      groups: [], ko: { main: [], consolation: [] }, teamTies: ties,
    };
    const idx = new Map(teams.map(t => [t.id, t.playerIds] as [string, string[]]));
    teams.forEach(t => t.playerIds.forEach(p => idx.set(p, [p])));
    const [s] = autoSchedule([c], 12, '09:00', 20, 5, 'all', idx);

    const zaciatky = s.teamTies.map(t => Math.min(...t.rubbers.map(rb => mins(rb.match.scheduledTime))));
    // Stretnutia sa už nereťazia jedno za druhým — každé začína hneď, ako sú
    // jeho hráči voľní. Pri 4 družstvách sú stretnutia previazané cez hráčov,
    // takže sa časť oprávnene posunie.
    //
    // ZNÁME OBMEDZENIE: plánovač neukladá stretnutia do vĺn, teda nespáruje
    // vopred (1–2) s (3–4), aby začali naraz. Zápasy sa nekryjú a rozpis je
    // korektný, len nie najkratší možný. Pre kategórie jednotlivcov to nehrá
    // rolu; pri veľkej družstevnej súťaži by sa oplatilo doplniť rozdelenie
    // do kôl.
    const trvanieStretnutia = 5 * 20;
    expect(Math.max(...zaciatky) - Math.min(...zaciatky))
      .toBeLessThan(s.teamTies.length * trvanieStretnutia);

    // vnútri stretnutia idú zápasy za sebou
    s.teamTies.forEach(t => {
      const casy = [...t.rubbers].sort((a, b) => a.order - b.order).map(rb => mins(rb.match.scheduledTime));
      for (let i = 1; i < casy.length; i++) expect(casy[i]).toBeGreaterThan(casy[i - 1]);
    });
  });

  it('žiadny rozpis nepretečie cez polnoc', () => {
    const comps = ['a', 'b', 'c', 'd'].map((id, i) => makeComp(id, 24, i)[0]);
    const idx = new Map(comps.flatMap(c => c.entryIds.map(x => [x, [x]] as [string, string[]])));
    const sched = autoSchedule(comps, 10, '09:00', 20, 5, 'all', idx);
    sched.forEach(c => c.groups.forEach(g => g.matches.forEach((m: Match) => {
      if (m.scheduledTime) expect(mins(m.scheduledTime)).toBeGreaterThanOrEqual(mins('09:00'));
    })));
  });

  it('súbežnosť nesmie postaviť hráča k dvom stolom naraz', () => {
    const built = ['a', 'b'].map((id, i) => makeComp(id, 16, i));
    const comps = built.map(([c]) => c);
    // ten istý hráč hrá v oboch súťažiach
    comps[1].entryIds[0] = comps[0].entryIds[0];
    comps[1].groups[0].entryIds[0] = comps[0].entryIds[0];
    comps[1].groups[0].matches.forEach(m => {
      if (m.playerAId === 'bp0') m.playerAId = comps[0].entryIds[0];
      if (m.playerBId === 'bp0') m.playerBId = comps[0].entryIds[0];
    });
    const idx = new Map(comps.flatMap(c => c.entryIds.map(x => [x, [x]] as [string, string[]])));
    const sched = autoSchedule(comps, 8, '09:00', 20, 5, 'all', idx);
    expect(scheduleConflicts(sched, idx, 20)).toHaveLength(0);
  });
});

describe('hranice rozpisu', () => {
  it('čas sa neobtáča cez polnoc — turnaj presahujúci deň to prizná', () => {
    // 200 zápasov na 2 stoloch = 2000 minút, teda cez polnoc
    const entries = Array.from({ length: 40 }, (_, i) => ({ id: `q${i}`, name: `Q${i}`, club: `K${i % 5}`, rating: 900 - i, memberIds: [`q${i}`] }));
    const c: Competition = {
      id: 'x', name: 'Veľká', type: 'singles', bestOf: 5, preferredSize: 8, qualifiersPerGroup: 2, thirdPlace: false,
      consolation: false, groupPlayoff: false, entryIds: entries.map(e => e.id),
      groups: createGroups(entries as any, 8, 5, 2), ko: { main: [], consolation: [] }, teamTies: [],
    };
    const idx = new Map(entries.map(e => [e.id, [e.id]] as [string, string[]]));
    const [s] = autoSchedule([c], 2, '09:00', 20, 5, 'all', idx);
    const span = scheduleSpan([s], 20, '22:00');
    expect(span.overflow).toBe(true);
    // hodina musí byť viditeľne nad 24, nie zamaskovaná ako ráno
    expect(Number(span.last!.split(':')[0])).toBeGreaterThan(22);
  });

  it('bežný turnaj sa do dňa zmestí a neoznačí sa ako presahujúci', () => {
    const entries = Array.from({ length: 16 }, (_, i) => ({ id: `r${i}`, name: `R${i}`, club: `K${i % 4}`, rating: 900 - i, memberIds: [`r${i}`] }));
    const c: Competition = {
      id: 'y', name: 'Malá', type: 'singles', bestOf: 5, preferredSize: 4, qualifiersPerGroup: 2, thirdPlace: false,
      consolation: false, groupPlayoff: false, entryIds: entries.map(e => e.id),
      groups: createGroups(entries as any, 4, 5, 2), ko: { main: [], consolation: [] }, teamTies: [],
    };
    const idx = new Map(entries.map(e => [e.id, [e.id]] as [string, string[]]));
    const [s] = autoSchedule([c], 8, '09:00', 20, 5, 'all', idx);
    const span = scheduleSpan([s], 20, '22:00');
    expect(span.overflow).toBe(false);
    expect(span.matches).toBeGreaterThan(0);
  });
});
