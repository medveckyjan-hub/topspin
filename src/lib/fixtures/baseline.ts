/**
 * M0-08 — základný E2E dataset.
 *
 * `baseline-tournament.json` drží vstupné dáta (hráči, páry, družstvá, plán súťaží).
 * Odvodené štruktúry — skupiny, pavúky, harmonogram — sa stavajú tu, cez skutočné
 * funkcie jadra. Dataset je deterministický, takže test aj ručná kontrola pracujú
 * vždy s tým istým turnajom.
 */
import raw from './baseline-tournament.json';
import {
  autoSchedule, buildTeamTie, createGroups, createQualification, entryMap, normalizeMatch,
  qualifiedForGroups, scoreTeamTie, uid,
} from '../multisport';
import { advanceStage, buildStage, newStage } from '../stages';
import type {
  Competition, GenericEntry, Match, PairEntry, Player, Stage, StagePlan, TeamEntry,
  TournamentState,
} from '../../types';

type StageSpec = {
  kluc: string; name: string; kind: 'groups' | 'knockout'; source: string;
  preferredSize?: number; qualifiersPerGroup?: number; bestOf: 3 | 5 | 7;
  thirdPlace?: boolean; consolation?: boolean;
};

export const baselineData = raw as unknown as {
  settings: TournamentState['settings'];
  players: Player[];
  pairs: PairEntry[];
  teams: TeamEntry[];
  plan: {
    dvojhra: { qualification: { directCount: number; slots: number; bestOf: 3 | 5 | 7 }; stages: StageSpec[] };
    stvorhra: { preferredSize: number; qualifiersPerGroup: number; bestOf: 3 | 5 | 7; thirdPlace: boolean };
    dvojhra_veterani: { entryCount: number; preferredSize: number; qualifiersPerGroup: number; bestOf: 3 | 5 | 7 };
    druzstva: { systemId: string; bestOf: number };
  };
};

const comp = (over: Partial<Competition> & { name: string; type: Competition['type'] }): Competition => ({
  id: uid(), bestOf: 5, preferredSize: 4, qualifiersPerGroup: 2, thirdPlace: true,
  consolation: false, groupPlayoff: false, entryIds: [], groups: [],
  ko: { main: [], consolation: [] }, teamTies: [], ...over,
});

/** Východiskový stav turnaja — prihlásení účastníci, ešte bez žrebu. */
export function baselineState(): TournamentState {
  const d = baselineData;
  const playerIds = d.players.map(p => p.id);

  const dvojhra = comp({ name: 'Dvojhra muži', type: 'singles', bestOf: 5, entryIds: playerIds });
  const stvorhra = comp({
    name: 'Štvorhra muži', type: 'doubles', bestOf: d.plan.stvorhra.bestOf,
    preferredSize: d.plan.stvorhra.preferredSize, qualifiersPerGroup: d.plan.stvorhra.qualifiersPerGroup,
    thirdPlace: d.plan.stvorhra.thirdPlace, entryIds: d.pairs.map(p => p.id),
  });
  const druzstva = comp({
    name: 'Družstvá', type: 'teams', bestOf: 5,
    teamSystemId: d.plan.druzstva.systemId as Competition['teamSystemId'],
    entryIds: d.teams.map(t => t.id),
  });

  // Súťaž, ktorá beží v tej istej fáze ako štvorhra a zdieľa s ňou hráčov —
  // práve na nej sa ukáže, keby harmonogram prestal sledovať fyzických hráčov.
  const veterani = comp({
    name: 'Dvojhra 40+', type: 'singles', bestOf: d.plan.dvojhra_veterani.bestOf,
    preferredSize: d.plan.dvojhra_veterani.preferredSize,
    qualifiersPerGroup: d.plan.dvojhra_veterani.qualifiersPerGroup,
    entryIds: playerIds.slice(0, d.plan.dvojhra_veterani.entryCount),
  });

  return {
    version: 5,
    settings: d.settings,
    players: d.players,
    pairs: d.pairs,
    teams: d.teams,
    competitions: [dvojhra, stvorhra, druzstva, veterani],
  };
}

/** Mapa prihlášok pre danú súťaž. */
export const mapOf = (c: Competition, s: TournamentState): Map<string, GenericEntry> =>
  entryMap(c, s.players, s.pairs, s.teams);

/** Index fyzických hráčov — potrebný, aby harmonogram nepostavil hráča k dvom stolom naraz. */
export function physicalIndex(s: TournamentState): Map<string, string[]> {
  const idx = new Map<string, string[]>();
  s.competitions.forEach(c => mapOf(c, s).forEach((e, id) => idx.set(id, e.memberIds?.length ? e.memberIds : [id])));
  return idx;
}

/** Postaví kvalifikáciu a celú reťaz fáz dvojhry podľa plánu z datasetu. */
export function buildSingles(s: TournamentState): TournamentState {
  const state = structuredClone(s) as TournamentState;
  const c = state.competitions[0];
  const map = mapOf(c, state);
  const spec = baselineData.plan.dvojhra;

  c.qualification = createQualification(c.entryIds, map, spec.qualification.directCount,
    spec.qualification.slots, spec.qualification.bestOf);

  const byKey = new Map<string, Stage>();
  const stages: Stage[] = spec.stages.map(st => {
    const source = st.source === 'entries'
      ? { from: 'entries' as const }
      : (() => {
          const [key, take] = st.source.split(':');
          const prev = byKey.get(key);
          return { from: 'stage' as const, stageId: prev!.id, take: take as 'qualified' | 'eliminated' };
        })();
    const stage = newStage({
      name: st.name, kind: st.kind, source, bestOf: st.bestOf,
      consolation: !!st.consolation, thirdPlace: st.thirdPlace ?? true,
      preferredSize: st.preferredSize ?? 4, qualifiersPerGroup: st.qualifiersPerGroup ?? 2,
    });
    byKey.set(st.kluc, stage);
    return stage;
  });
  c.stagePlan = { stages };
  return state;
}

/** Postaví skupiny štvorhry a stretnutia družstiev. */
export function buildOthers(s: TournamentState): TournamentState {
  const state = structuredClone(s) as TournamentState;
  const dbl = state.competitions[1];
  const dblMap = mapOf(dbl, state);
  dbl.groups = createGroups(dbl.entryIds.map(id => dblMap.get(id)!).filter(Boolean),
    dbl.preferredSize, dbl.bestOf, dbl.qualifiersPerGroup);

  const vet = state.competitions[3];
  const vetMap = mapOf(vet, state);
  vet.groups = createGroups(vet.entryIds.map(id => vetMap.get(id)!).filter(Boolean),
    vet.preferredSize, vet.bestOf, vet.qualifiersPerGroup);

  const team = state.competitions[2];
  const ties = [];
  for (let i = 0; i < state.teams.length; i++) {
    for (let j = i + 1; j < state.teams.length; j++) {
      ties.push(buildTeamTie(team.id, state.teams[i], state.teams[j],
        team.teamSystemId ?? 'TEAM3_5S', baselineData.plan.druzstva.bestOf));
    }
  }
  team.teamTies = ties;
  return state;
}

/** Odohrá zápas — vyhráva vyššie hodnotený, aby bol výsledok predvídateľný. */
export function playMatch(m: Match, bestOf: 3 | 5 | 7, map: Map<string, GenericEntry>): Match {
  if (!m.playerAId || !m.playerBId || m.winnerId) return m;
  const need = bestOf === 7 ? 4 : bestOf === 5 ? 3 : 2;
  const aBetter = (map.get(m.playerAId)?.rating ?? 0) >= (map.get(m.playerBId)?.rating ?? 0);
  const sets = Array.from({ length: need }, (_, i) => (aBetter ? { a: 11, b: i + 3 } : { a: i + 3, b: 11 }));
  return normalizeMatch({ ...m, sets }, bestOf);
}

/** Odohrá skupinovú fázu. */
export const playGroups = (groups: any[], map: Map<string, GenericEntry>) =>
  groups.map(g => ({ ...g, matches: g.matches.map((m: Match) => playMatch(m, g.bestOf, map)) }));

/** Odohrá pavúk vrátane postupov a zápasu o 3. miesto. */
export function playBracket(stage: Stage, map: Map<string, GenericEntry>): Stage {
  let st = stage;
  for (let guard = 0; guard < 12; guard++) {
    const before = JSON.stringify(st.rounds);
    st = { ...st, rounds: (st.rounds ?? []).map(r => ({ ...r, matches: r.matches.map(m => playMatch(m, r.bestOf, map)) })) };
    st = advanceStage(st);
    if (JSON.stringify(st.rounds) === before) break;
  }
  return st;
}

/** Prejde celú reťaz fáz v poradí závislostí. */
export function playAllStages(c: Competition, map: Map<string, GenericEntry>, entryIds: string[]): StagePlan {
  let plan: StagePlan = { stages: [...(c.stagePlan?.stages ?? [])] };
  for (let i = 0; i < plan.stages.length; i++) {
    let st = buildStage(plan, plan.stages[i], entryIds, map);
    st = st.kind === 'groups'
      ? { ...st, groups: playGroups(st.groups ?? [], map) }
      : playBracket(st, map);
    plan = { stages: plan.stages.map((x, k) => (k === i ? st : x)) };
  }
  return plan;
}

/** Naplánuje celý turnaj so sledovaním fyzických hráčov. */
export const scheduleAll = (s: TournamentState): Competition[] =>
  autoSchedule(s.competitions, s.settings.tables, s.settings.startTime ?? '09:00',
    s.settings.matchMinutes, s.settings.restMinutes, 'all', physicalIndex(s));

/** Odohrá stretnutia družstiev a dopočíta ich stav. */
export function playTeamTies(c: Competition, map: Map<string, GenericEntry>): Competition {
  const ties = c.teamTies.map(tie => {
    const rubbers = tie.rubbers.map(rb => ({ ...rb, match: playMatch(rb.match, 5, map) }));
    return scoreTeamTie({ ...tie, rubbers }, 5);
  });
  return { ...c, teamTies: ties };
}

export { qualifiedForGroups };
