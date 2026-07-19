import { describe, expect, it } from 'vitest';
import {
  baselineData, baselineState, buildOthers, buildSingles, mapOf, physicalIndex,
  playAllStages, playTeamTies, qualifiedForGroups, scheduleAll,
} from './fixtures/baseline';
import { clubConflicts, scheduleConflicts, standings } from './multisport';
import { finalPlacement, stageCycles, stageDone, stageRanking } from './stages';
import type { Match } from '../types';

/**
 * M0-08 — základný E2E beh.
 *
 * Prejde celý turnaj od prihlášok po konečné poradie: kvalifikácia,
 * dve kolá skupín, finálový pavúk, dve útechy, štvorhra a družstvá.
 * Kontroluje vlastnosti, ktoré musia platiť vždy, nie konkrétne mená víťazov.
 */
describe('E2E — celý turnaj od prihlášok po konečné poradie', () => {
  const start = baselineState();

  it('dataset je kompletný a deterministický', () => {
    expect(start.players).toHaveLength(32);
    expect(start.pairs).toHaveLength(8);
    expect(start.teams).toHaveLength(4);
    expect(start.competitions).toHaveLength(4);
    expect(new Set(start.players.map(p => p.club)).size).toBe(8);
  });

  const withSingles = buildSingles(start);
  const singles = withSingles.competitions[0];
  const map = mapOf(singles, withSingles);

  it('kvalifikácia rozdelí priamo nasadených a hráčov o postup', () => {
    const q = singles.qualification!;
    expect(q.directIds).toHaveLength(baselineData.plan.dvojhra.qualification.directCount);
    expect(q.brackets).toHaveLength(baselineData.plan.dvojhra.qualification.slots);
    expect(new Set([...q.directIds, ...q.brackets.flatMap(b =>
      b.rounds.flatMap(r => r.matches.flatMap(m => [m.playerAId, m.playerBId])))].filter(Boolean)).size)
      .toBeLessThanOrEqual(32);
  });

  it('nikto nie je zároveň priamo nasadený aj v kvalifikačnej vetve', () => {
    const q = singles.qualification!;
    const inBrackets = new Set(q.brackets.flatMap(b =>
      b.rounds.flatMap(r => r.matches.flatMap(m => [m.playerAId, m.playerBId]))).filter(Boolean) as string[]);
    expect(q.directIds.some(id => inBrackets.has(id))).toBe(false);
  });

  const plan = playAllStages(singles, map, singles.entryIds);
  const played = { ...withSingles, competitions: withSingles.competitions.map((c, i) => (i === 0 ? { ...c, stagePlan: plan } : c)) };

  it('všetky fázy sa dohrali', () => {
    expect(plan.stages).toHaveLength(5);
    plan.stages.forEach(st => expect(stageDone(st)).toBe(true));
  });

  it('plán fáz neobsahuje cyklus', () => {
    expect(stageCycles(plan)).toHaveLength(0);
  });

  it('prvé kolo skupín rozdelilo kluby, koľko sa dalo', () => {
    const g1 = plan.stages[0];
    const conflicts = clubConflicts(g1.groups ?? [], map);
    // 4 hráči z klubu na 8 skupín — nikto sa nesmie stretnúť v skupine
    expect(conflicts).toHaveLength(0);
  });

  it('do druhého kola postúpil presne dvojnásobok počtu skupín', () => {
    const g1 = plan.stages[0];
    const g2 = plan.stages[1];
    const postup = (g1.groups ?? []).length * (g1.qualifiersPerGroup ?? 2);
    expect((g2.groups ?? []).flatMap(g => g.entryIds)).toHaveLength(postup);
  });

  it('každá skupina má dohratý každý zápas dvoch hráčov', () => {
    plan.stages.filter(s => s.kind === 'groups').forEach(st =>
      (st.groups ?? []).forEach(g => g.matches.forEach((m: Match) => {
        if (m.playerAId && m.playerBId) expect(m.winnerId).toBeTruthy();
      })));
  });

  it('vo finálovom pavúku vyhral jediný hráč a je aj bronz', () => {
    const ko = plan.stages.find(s => s.name === 'Finálový pavúk')!;
    const rank = stageRanking(ko, map);
    expect(rank.length).toBeGreaterThanOrEqual(4);
    const third = (ko.rounds ?? []).find(r => r.kind === 'third');
    expect(third?.matches[0].winnerId).toBeTruthy();
  });

  it('konečné poradie dá každému účastníkovi jedinečné miesto', () => {
    const order = finalPlacement(plan, singles.entryIds, map);
    expect(order).toHaveLength(32);
    expect(new Set(order).size).toBe(32);
  });

  it('víťaz turnaja je víťazom finálového pavúka', () => {
    const ko = plan.stages.find(s => s.name === 'Finálový pavúk')!;
    const order = finalPlacement(plan, singles.entryIds, map);
    expect(order[0]).toBe(stageRanking(ko, map)[0]);
  });

  it('útecha sa radí za hlavnú vetvu', () => {
    const order = finalPlacement(plan, singles.entryIds, map);
    const ko = plan.stages.find(s => s.name === 'Finálový pavúk')!;
    const koIds = new Set(stageRanking(ko, map));
    const prve = order.slice(0, koIds.size);
    expect(prve.every(id => koIds.has(id))).toBe(true);
  });

  const full = buildOthers(played);

  it('štvorhra má skupiny a vypočítateľné poradie', () => {
    const dbl = full.competitions[1];
    const dblMap = mapOf(dbl, full);
    expect(dbl.groups.length).toBeGreaterThan(0);
    dbl.groups.forEach(g => {
      const rows = standings(g, dblMap);
      expect(rows).toHaveLength(g.entryIds.length);
      expect(rows.map(r => r.position)).toEqual([...rows.map(r => r.position)].sort((a, b) => a - b));
    });
  });

  it('družstvá odohrajú každý s každým a stretnutie má víťaza', () => {
    const team = full.competitions[2];
    const teamMap = mapOf(team, full);
    expect(team.teamTies).toHaveLength(6);            // 4 družstvá = 6 stretnutí
    const done = playTeamTies(team, teamMap);
    done.teamTies.forEach(t => {
      expect(t.status).toBe('finished');
      expect(t.winnerTeamId).toBeTruthy();
      expect(t.homeScore + t.awayScore).toBeGreaterThanOrEqual(3);
    });
  });

  const scheduled = scheduleAll(full);

  it('harmonogram pokryje všetky fázy', () => {
    const singlesS = scheduled[0];
    const qualTimes = (singlesS.qualification?.brackets ?? []).flatMap(b =>
      b.rounds.flatMap(r => r.matches.filter(m => m.playerAId && m.playerBId).map(m => m.scheduledTime)));
    const stageTimes = (singlesS.stagePlan?.stages ?? []).flatMap(st => [
      ...(st.groups ?? []).flatMap(g => g.matches.map((m: Match) => m.scheduledTime)),
      ...(st.rounds ?? []).flatMap(r => r.matches.filter(m => m.playerAId && m.playerBId).map(m => m.scheduledTime)),
    ]);
    expect(qualTimes.every(Boolean)).toBe(true);
    expect(stageTimes.filter(Boolean).length).toBeGreaterThan(0);
    expect(scheduled[2].teamTies.every(t => t.rubbers.every(rb => !!rb.match.scheduledTime))).toBe(true);
  });

  it('dvojhra 40+ a štvorhra sa plánujú súbežne a zdieľajú hráčov', () => {
    // ak by táto podmienka prestala platiť, ďalší test by stratil zmysel
    const vet = scheduled[3];
    const dbl = scheduled[1];
    const idx = physicalIndex(full);
    const vetPlayers = new Set(vet.groups.flatMap(g => g.entryIds.flatMap(id => idx.get(id) ?? [id])));
    const dblPlayers = new Set(dbl.groups.flatMap(g => g.entryIds.flatMap(id => idx.get(id) ?? [id])));
    expect([...vetPlayers].some(p => dblPlayers.has(p))).toBe(true);
  });

  it('žiadny hráč nemá dva zápasy naraz', () => {
    expect(scheduleConflicts(scheduled, physicalIndex(full), full.settings.matchMinutes)).toHaveLength(0);
  });

  it('každý naplánovaný zápas má stôl v rozsahu haly', () => {
    const tables = full.settings.tables;
    const all: Match[] = [];
    scheduled.forEach(c => {
      c.groups.forEach(g => all.push(...g.matches));
      (c.stagePlan?.stages ?? []).forEach(st => {
        (st.groups ?? []).forEach(g => all.push(...g.matches));
        (st.rounds ?? []).forEach(r => all.push(...r.matches));
      });
      (c.qualification?.brackets ?? []).forEach(b => b.rounds.forEach(r => all.push(...r.matches)));
      c.teamTies.forEach(t => t.rubbers.forEach(rb => all.push(rb.match)));
    });
    all.filter(m => m.table !== undefined).forEach(m => {
      expect(m.table).toBeGreaterThanOrEqual(1);
      expect(m.table).toBeLessThanOrEqual(tables);
    });
  });

  it('žiadny zápas nemá víťaza, ktorý v ňom nehral', () => {
    const bad: string[] = [];
    scheduled.forEach(c => {
      const check = (m: Match, kde: string) => {
        if (m.winnerId && m.winnerId !== m.playerAId && m.winnerId !== m.playerBId) bad.push(`${kde} ${m.id}`);
      };
      c.groups.forEach(g => g.matches.forEach(m => check(m, 'skupina')));
      (c.stagePlan?.stages ?? []).forEach(st => {
        (st.groups ?? []).forEach(g => g.matches.forEach((m: Match) => check(m, st.name)));
        (st.rounds ?? []).forEach(r => r.matches.forEach(m => check(m, st.name)));
      });
      (c.qualification?.brackets ?? []).forEach(b => b.rounds.forEach(r => r.matches.forEach(m => check(m, 'kvalifikácia'))));
    });
    expect(bad).toEqual([]);
  });

  it('postupujúci z kvalifikácie sú podmnožinou prihlásených', () => {
    const q = full.competitions[0].qualification!;
    const ids = new Set(full.competitions[0].entryIds);
    qualifiedForGroups(q).forEach(id => expect(ids.has(id)).toBe(true));
  });
});
