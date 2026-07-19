import { describe, expect, it } from 'vitest';
import { baselineState, buildOthers, buildSingles, mapOf, playAllStages, playTeamTies, scheduleAll } from './fixtures/baseline';
import { playerMatches, playerTotals } from './playercard';
import { createGroups, entryMap } from './multisport';
import type { TournamentState } from '../types';

/**
 * Karta hráča musí ukázať VŠETKY zápasy vo všetkých súťažiach a stupňoch.
 * Predtým čítala len základné skupiny a pavúk.
 */
function odohranyTurnaj(): TournamentState {
  const s0 = buildSingles(baselineState());
  const c = s0.competitions[0];
  const plan = playAllStages(c, mapOf(c, s0), c.entryIds);
  const withStages = { ...s0, competitions: s0.competitions.map((x, i) => (i === 0 ? { ...x, stagePlan: plan } : x)) };
  const full = buildOthers(withStages);
  const team = full.competitions[2];
  const played = playTeamTies(team, mapOf(team, full));
  const sched = scheduleAll({ ...full, competitions: full.competitions.map((x, i) => (i === 2 ? played : x)) });
  return { ...full, competitions: sched };
}

const state = odohranyTurnaj();

describe('karta hráča', () => {
  it('hráč vidí zápasy zo všetkých súťaží, v ktorých štartoval', () => {
    // pl00 hrá dvojhru, štvorhru (pár pa0), družstvo aj dvojhru 40+
    const rows = playerMatches(state, 'pl00');
    const sutaze = new Set(rows.map(r => r.competition));
    expect(sutaze.size).toBeGreaterThanOrEqual(3);
    expect([...sutaze]).toContain('Dvojhra muži');
    expect([...sutaze]).toContain('Štvorhra muži');
  });

  it('zápasy z reťaze fáz sa zobrazia, nielen základné skupiny', () => {
    const rows = playerMatches(state, 'pl00');
    const fazy = rows.filter(r => r.competition === 'Dvojhra muži').map(r => r.phase);
    expect(fazy.some(f => f.includes('kolo skupín'))).toBe(true);
    expect(fazy.length).toBeGreaterThan(1);
  });

  it('družstevné zápasy sa zobrazia s názvami družstiev', () => {
    const rows = playerMatches(state, 'pl00');
    const druzstva = rows.filter(r => r.phase.startsWith('Družstvá'));
    expect(druzstva.length).toBeGreaterThan(0);
    expect(druzstva[0].phase).toMatch(/Družstvá · .+ – .+ ·/);
  });

  it('kvalifikačné zápasy sa zobrazia', () => {
    const vsetci = state.players.map(p => p.id);
    const skvalifikaciou = vsetci
      .map(id => playerMatches(state, id))
      .filter(rows => rows.some(r => r.phase.startsWith('Kvalifikácia')));
    expect(skvalifikaciou.length).toBeGreaterThan(0);
  });

  it('play-off skupiny sa zobrazí — práve to predtým chýbalo', () => {
    const em = entryMap(state.competitions[3], state.players, state.pairs, state.teams);
    const entries = state.competitions[3].entryIds.map(id => em.get(id)!).filter(Boolean);
    const groups = createGroups(entries, 4, 5, 2);
    const g = groups[0];
    const hraci = g.entryIds;
    const withPlayoff: TournamentState = {
      ...state,
      competitions: state.competitions.map((c, i) => (i !== 3 ? c : {
        ...c, groups: [{ ...g, playoff: {
          final: { id: 'pf', round: 0, playerAId: hraci[0], playerBId: hraci[1], sets: [], winnerId: null, status: 'scheduled', specialResult: null },
          third: { id: 'pt', round: 0, playerAId: hraci[2], playerBId: hraci[3], sets: [], winnerId: null, status: 'scheduled', specialResult: null },
        } }],
      })),
    };
    const rows = playerMatches(withPlayoff, hraci[0]);
    expect(rows.some(r => r.phase.includes('play-off o 1. miesto'))).toBe(true);
    const rows3 = playerMatches(withPlayoff, hraci[2]);
    expect(rows3.some(r => r.phase.includes('play-off o 3. miesto'))).toBe(true);
  });

  it('finálová skupina sa zobrazí', () => {
    const hraci = state.competitions[0].entryIds.slice(0, 2);
    const withFinal: TournamentState = {
      ...state,
      competitions: state.competitions.map((c, i) => (i !== 0 ? c : {
        ...c, finalGroup: { id: 'fg', name: 'Finálová skupina', entryIds: hraci, qualifiers: 1, bestOf: 5,
          matches: [{ id: 'fm', round: 0, playerAId: hraci[0], playerBId: hraci[1], sets: [], winnerId: null, status: 'scheduled', specialResult: null }] },
      })),
    };
    expect(playerMatches(withFinal, hraci[0]).some(r => r.phase === 'Finálová skupina')).toBe(true);
  });

  it('súčty sedia s počtom odohraných zápasov', () => {
    const rows = playerMatches(state, 'pl00');
    const t = playerTotals(rows);
    expect(t.wins + t.losses).toBe(rows.filter(r => r.m.winnerId).length);
    expect(t.total).toBe(rows.length);
  });

  it('hráč bez zápasov dostane prázdny zoznam, nie pád', () => {
    expect(playerMatches(state, 'neexistuje')).toEqual([]);
  });

  it('kliknutie na pár ukáže zápasy páru, nie oboch hráčov zvlášť', () => {
    const parId = state.pairs[0].id;
    const rows = playerMatches(state, parId);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every(r => r.competition === 'Štvorhra muži')).toBe(true);
  });

  it('zápasy sú zoradené po súťažiach a stupňoch', () => {
    const rows = playerMatches(state, 'pl00');
    const poradia = rows.map(r => r.order);
    expect(poradia).toEqual([...poradia].sort((a, b) => a - b));
  });
});
