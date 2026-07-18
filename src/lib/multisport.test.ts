import { describe, expect, it } from 'vitest';
import {
  TEAM_SYSTEMS, applySubstitution, buildTeamTie, chooseGroupSizes, createGroups, createKnockout,
  generateRoundRobin, isValidSet, movePlayer, normalizeMatch, resizeSets, standings,
} from './multisport';
import type { Competition, GenericEntry, Match, TeamEntry, TournamentGroup } from '../types';

const gen = (ids: string[]) => new Map<string, GenericEntry>(ids.map((id, i) => [id, { id, name: id, club: '', rating: 100 - i, memberIds: [id] }]));
const win = (id: string, a: string, b: string, aWins: boolean): Match => normalizeMatch({ id, round: 1, playerAId: a, playerBId: b, status: 'scheduled', winnerId: null, specialResult: null, sets: aWins ? [{ a: 11, b: 1 }, { a: 11, b: 1 }, { a: 11, b: 1 }] : [{ a: 1, b: 11 }, { a: 1, b: 11 }, { a: 1, b: 11 }] }, 5);

describe('multi-event core', () => {
  it('drží skupiny v rozsahu 3–12', () => { for (let n = 3; n < 100; n++) { const s = chooseGroupSizes(n, 5); expect(s.reduce((a, b) => a + b, 0)).toBe(n); expect(Math.min(...s)).toBeGreaterThanOrEqual(3); expect(Math.max(...s)).toBeLessThanOrEqual(12); } });
  it('vytvorí každý pár v skupine práve raz', () => { const m = generateRoundRobin(['a', 'b', 'c', 'd', 'e'], 5); expect(m).toHaveLength(10); expect(new Set(m.map(x => [x.playerAId, x.playerBId].sort().join('-'))).size).toBe(10); });
  it('validuje sety', () => { expect(isValidSet(11, 9)).toBe(true); expect(isValidSet(12, 10)).toBe(true); expect(isValidSet(11, 10)).toBe(false); });
  it('obsahuje medzinárodné aj ligové systémy', () => { expect(TEAM_SYSTEMS.CORBILLON.rubbers).toHaveLength(5); expect(TEAM_SYSTEMS.SWAYTHLING.rubbers).toHaveLength(9); expect(TEAM_SYSTEMS.OLYMPIC.rubbers[0].kind).toBe('doubles'); });
  it('povolí len jedno striedanie na družstvo v stretnutí', () => { const h: TeamEntry = { id: 'h', name: 'H', club: '', playerIds: ['a', 'b', 'c'] }, a: TeamEntry = { id: 'a', name: 'A', club: '', playerIds: ['x', 'y', 'z'] }; let tie = buildTeamTie('c', h, a, 'CORBILLON', 5); tie = applySubstitution(tie, 'home', 'a', 'c', 4, 5); expect(tie.nomination.homeSub?.inPlayerId).toBe('c'); expect(() => applySubstitution(tie, 'home', 'b', 'a', 5, 5)).toThrow(); });

  it('ITTF minitabuľka rozhodne 3-cyklus setovým pomerom', () => {
    const map = gen(['a', 'b', 'c']);
    const g: TournamentGroup = { id: 'g', name: 'G', entryIds: ['a', 'b', 'c'], qualifiers: 2, bestOf: 5, matches: [
      win('1', 'a', 'b', true), win('2', 'b', 'c', true),
      normalizeMatch({ id: '3', round: 1, playerAId: 'c', playerBId: 'a', status: 'scheduled', winnerId: null, specialResult: null, sets: [{ a: 11, b: 9 }, { a: 9, b: 11 }, { a: 11, b: 9 }, { a: 9, b: 11 }, { a: 11, b: 9 }] }, 5)] };
    const st = standings(g, map);
    expect(st.every(r => r.matchPoints === 3)).toBe(true);
    expect(st[0].entry.id).toBe('a'); expect(st[2].entry.id).toBe('c');
  });

  it('pavúk: seed 1 hore, seed 1≠2 v 1. kole, bye k top seedom, zápas o 3. miesto', () => {
    const map = gen(['q1', 'q2', 'q3', 'q4', 'q5', 'q6']);
    const groups: TournamentGroup[] = [
      { id: 'A', name: 'A', entryIds: ['q1', 'q3', 'q5'], qualifiers: 3, bestOf: 5, matches: [] },
      { id: 'B', name: 'B', entryIds: ['q2', 'q4', 'q6'], qualifiers: 3, bestOf: 5, matches: [] }];
    const c = { bestOf: 5, thirdPlace: true, consolation: false, groups } as unknown as Competition;
    const ko = createKnockout(c, map);
    const r1 = ko.main[0].matches.map(m => [m.playerAId, m.playerBId]);
    expect(ko.main[0].matches).toHaveLength(4);
    expect(r1[0][0]).toBe('q1');
    expect(r1.some(p => p.includes('q1') && p.includes('q2'))).toBe(false);
    expect(r1.find(p => p.includes('q1'))!.includes(null)).toBe(true);
    expect(ko.main.some(r => r.kind === 'third')).toBe(true);
  });

  it('útecha sa vytvorí z nepostupujúcich', () => {
    const map = gen(['w1', 'w2', 'w3', 'w4']);
    const groups: TournamentGroup[] = [
      { id: 'A', name: 'A', entryIds: ['w1', 'w2'], qualifiers: 1, bestOf: 5, matches: [] },
      { id: 'B', name: 'B', entryIds: ['w3', 'w4'], qualifiers: 1, bestOf: 5, matches: [] }];
    const c = { bestOf: 5, thirdPlace: false, consolation: true, groups } as unknown as Competition;
    expect(createKnockout(c, map).consolation.length).toBeGreaterThanOrEqual(1);
  });

  it('resizeSets zachová výsledky a doplní prázdne', () => { const r = resizeSets([{ a: 11, b: 9 }, { a: 9, b: 11 }], 7); expect(r).toHaveLength(7); expect(r[0].a).toBe(11); expect(r[2].a).toBeNull(); });

  it('presun hráča medzi skupinami preváži rozpis', () => {
    const groups: TournamentGroup[] = [
      { id: 'A', name: 'A', entryIds: ['a', 'b', 'c', 'd'], qualifiers: 2, bestOf: 5, matches: generateRoundRobin(['a', 'b', 'c', 'd'], 5) },
      { id: 'B', name: 'B', entryIds: ['e', 'f', 'g'], qualifiers: 2, bestOf: 5, matches: generateRoundRobin(['e', 'f', 'g'], 5) }];
    const moved = movePlayer(groups, 'a', 'B');
    expect(moved[0].entryIds).toHaveLength(3); expect(moved[1].entryIds).toContain('a');
  });

  it('createGroups pridelí best of a hadové nasadenie', () => { const es: GenericEntry[] = Array.from({ length: 8 }, (_, i) => ({ id: 'p' + i, name: 'P' + i, club: '', rating: 100 - i, memberIds: ['p' + i] })); const gs = createGroups(es, 4, 3, 2); expect(gs.every(g => g.bestOf === 3)).toBe(true); expect(gs.reduce((s, g) => s + g.entryIds.length, 0)).toBe(8); });
});
