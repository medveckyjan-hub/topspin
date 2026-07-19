export type { Stage, StageKind, StagePlan, StageSource };
import type { GenericEntry, KnockoutRound, Stage, StageKind, StagePlan, StageSource, TournamentGroup } from '../types';
import {
  advanceKnockout, bracketRanking, buildBracket, createGroups, standings, uid,
} from './multisport';

// ============================================================
// REŤAZ FÁZ — ľubovoľná postupnosť kôl v jednej súťaži.
// Napríklad: kvalifikácia → skupiny → druhé skupiny → pavúk,
// pričom z každej fázy môžu vypadnutí pokračovať v úteche
// a všetci nakoniec dostanú presné umiestnenie.
// ============================================================



/** Odkiaľ fáza berie účastníkov. */
export type StageSource =
  | { from: 'entries' }                                  // všetci prihlásení
  | { from: 'stage'; stageId: string; take: 'qualified' | 'eliminated' };




export const newStage = (p: Partial<Stage> & { name: string; kind: StageKind; source: StageSource }): Stage => ({
  id: uid(), bestOf: 5, consolation: false, preferredSize: 4, qualifiersPerGroup: 2,
  thirdPlace: true, seeding: 'groups', ...p,
});

// ---------- vstupy a výstupy fázy ----------

const stageById = (plan: StagePlan, id: string) => plan.stages.find(s => s.id === id);

/** Účastníci fázy — buď všetci prihlásení, alebo výstup predchádzajúcej fázy. */
export function stageInput(plan: StagePlan, stage: Stage, entryIds: string[], map: Map<string, GenericEntry>): string[] {
  if (stage.source.from === 'entries') return [...entryIds];
  const prev = stageById(plan, stage.source.stageId);
  if (!prev) return [];
  return stage.source.take === 'qualified' ? stageQualified(prev, map) : stageEliminated(prev, map);
}

/** Postupujúci z fázy. Zo skupín podľa počtu postupujúcich, z pavúka víťaz. */
export function stageQualified(stage: Stage, map: Map<string, GenericEntry>): string[] {
  if (stage.kind === 'groups') {
    return (stage.groups ?? []).flatMap(g => standings(g, map).filter(r => r.qualified).map(r => r.entry.id));
  }
  const rank = bracketRanking(stage.rounds ?? [], map);
  return rank.length ? [rank[0]] : [];
}

/** Vypadnutí z fázy — práve oni môžu pokračovať v úteche. */
export function stageEliminated(stage: Stage, map: Map<string, GenericEntry>): string[] {
  if (stage.kind === 'groups') {
    return (stage.groups ?? []).flatMap(g => standings(g, map).filter(r => !r.qualified).map(r => r.entry.id));
  }
  return bracketRanking(stage.rounds ?? [], map).slice(1);
}

/** Je fáza dohratá? */
export function stageDone(stage: Stage): boolean {
  if (stage.kind === 'groups') {
    const gs = stage.groups ?? [];
    return gs.length > 0 && gs.every(g => g.matches.every(m => !!m.winnerId || !!m.specialResult));
  }
  const rounds = (stage.rounds ?? []).filter(r => r.kind !== 'third');
  if (!rounds.length) return false;
  return rounds.every(r => r.matches.every(m => !m.playerAId || !m.playerBId || !!m.winnerId));
}

/** Presné poradie vo vnútri fázy. */
export function stageRanking(stage: Stage, map: Map<string, GenericEntry>): string[] {
  if (stage.kind === 'knockout') return bracketRanking(stage.rounds ?? [], map);
  // skupiny: najprv všetci prví, potom druhí… v rámci pozície podľa bodov a pomerov
  const rows = (stage.groups ?? []).flatMap(g => standings(g, map).map(r => ({ ...r, gid: g.id })));
  return rows
    .sort((a, b) => a.position - b.position
      || b.matchPoints - a.matchPoints
      || (b.setsFor - b.setsAgainst) - (a.setsFor - a.setsAgainst)
      || (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst))
    .map(r => r.entry.id);
}

// ---------- vytváranie a posun fáz ----------

/** Naplní fázu účastníkmi — vytvorí skupiny alebo pavúka. */
export function buildStage(plan: StagePlan, stage: Stage, entryIds: string[], map: Map<string, GenericEntry>): Stage {
  const ids = stageInput(plan, stage, entryIds, map);
  const entries = ids.map(id => map.get(id)).filter(Boolean) as GenericEntry[];

  if (stage.kind === 'groups') {
    return { ...stage, groups: createGroups(entries, stage.preferredSize ?? 4, stage.bestOf, stage.qualifiersPerGroup ?? 2) };
  }

  // pavúk: nasadenie podľa toho, odkiaľ účastníci prišli
  const prev = stage.source.from === 'stage' ? stageById(plan, stage.source.stageId) : undefined;
  const fromGroups = prev?.kind === 'groups';
  const seeding = stage.seeding ?? (fromGroups ? 'groups' : 'rating');

  let seeds: { id: string; groupIndex: number; position: number; club?: string }[];
  if (seeding === 'groups' && prev?.kind === 'groups') {
    seeds = (prev.groups ?? []).flatMap((g, gi) => standings(g, map)
      .filter(r => (stage.source.from === 'stage' && stage.source.take === 'eliminated' ? !r.qualified : r.qualified))
      .map(r => ({ id: r.entry.id, groupIndex: gi, position: r.position })))
      .sort((a, b) => a.position - b.position || (map.get(b.id)?.rating ?? 0) - (map.get(a.id)?.rating ?? 0));
  } else {
    seeds = [...ids]
      .sort((a, b) => (map.get(b)?.rating ?? 0) - (map.get(a)?.rating ?? 0)
        || (map.get(a)?.name ?? '').localeCompare(map.get(b)?.name ?? '', 'sk'))
      .map((id, i) => ({ id, groupIndex: -1, position: i + 1, club: map.get(id)?.club ?? '' }));
  }

  return { ...stage, rounds: buildBracket(seeds, stage.bestOf, stage.thirdPlace ?? true, seeding === 'groups' ? 'groups' : 'rating') };
}

/** Posunie víťazov v pavúkových fázach. */
export const advanceStage = (stage: Stage): Stage =>
  stage.kind === 'knockout' ? { ...stage, rounds: advanceKnockout(stage.rounds ?? []) } : stage;

/** Fázy, ktoré sa dajú naplniť — predchádzajúca je dohratá. */
export function readyStages(plan: StagePlan, map: Map<string, GenericEntry>): string[] {
  return plan.stages.filter(s => {
    if (s.source.from === 'entries') return true;
    const prev = stageById(plan, s.source.stageId);
    return !!prev && stageDone(prev);
  }).map(s => s.id);
}

// ---------- konečné poradie celej súťaže ----------

/**
 * Presné konečné poradie naprieč všetkými fázami.
 * Platí: kto postúpil ďalej, je vyššie. Hlavná vetva je nad útechou.
 * Poradie sa určuje z poslednej fázy, v ktorej sa účastník objavil.
 */
export function finalPlacement(plan: StagePlan, entryIds: string[], map: Map<string, GenericEntry>): string[] {
  // hĺbka fázy = koľko krokov od štartu; hlbšie = lepšie umiestnenie
  const depth = new Map<string, number>();
  const walk = (s: Stage): number => {
    if (depth.has(s.id)) return depth.get(s.id)!;
    let d = 0;
    if (s.source.from === 'stage') {
      const prev = stageById(plan, s.source.stageId);
      d = prev ? walk(prev) + 1 : 0;
    }
    depth.set(s.id, d);
    return d;
  };
  plan.stages.forEach(walk);

  // pre každého účastníka nájdi najhlbšiu fázu, v ktorej hral
  type Slot = { stage: Stage; rank: number };
  const best = new Map<string, Slot>();
  plan.stages.forEach(stage => {
    stageRanking(stage, map).forEach((id, i) => {
      const cur = best.get(id);
      const d = depth.get(stage.id) ?? 0;
      const curD = cur ? depth.get(cur.stage.id) ?? 0 : -1;
      // hlbšia fáza vyhráva; pri rovnakej hĺbke má prednosť hlavná vetva
      if (!cur || d > curD || (d === curD && cur.stage.consolation && !stage.consolation)) {
        best.set(id, { stage, rank: i });
      }
    });
  });

  const score = (id: string) => {
    const slot = best.get(id);
    if (!slot) return { d: -1, cons: 1, rank: 9999 };
    return { d: depth.get(slot.stage.id) ?? 0, cons: slot.stage.consolation ? 1 : 0, rank: slot.rank };
  };

  return [...entryIds].sort((a, b) => {
    const x = score(a), y = score(b);
    return x.cons - y.cons || y.d - x.d || x.rank - y.rank
      || (map.get(b)?.rating ?? 0) - (map.get(a)?.rating ?? 0);
  });
}

/** Krátky popis fázy pre rozhranie. */
export function stageSummary(plan: StagePlan, stage: Stage, map: Map<string, GenericEntry>): string {
  const src = stage.source.from === 'entries'
    ? 'všetci prihlásení'
    : (() => {
        const prev = stageById(plan, stage.source.stageId);
        const what = stage.source.take === 'qualified' ? 'postupujúci' : 'vypadnutí';
        return `${what} z fázy „${prev?.name ?? '?'}"`;
      })();
  const size = stage.kind === 'groups'
    ? `${(stage.groups ?? []).length} skupín`
    : `pavúk ${((stage.rounds ?? []).filter(r => r.kind !== 'third')[0]?.matches.length ?? 0) * 2} miest`;
  return `${src} · ${size}${stageDone(stage) ? ' · dohraté' : ''}`;
}
