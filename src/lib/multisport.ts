import type {
  Competition, GenericEntry, Knockout, KnockoutRound, Match, PairEntry, Player,
  SetScore, StandingRow, TeamEntry, TeamNomination, TeamRubber, TeamSystem, TeamSystemId,
  TeamTie, TournamentGroup,
} from '../types';

export const uid = () => crypto.randomUUID();
export const emptySets = (bestOf: number): SetScore[] => Array.from({ length: bestOf }, () => ({ a: null, b: null }));
export const setsToWin = (bestOf: number) => Math.ceil(bestOf / 2);

/** Zmení počet setov zápasu (best of) a zachová už zadané výsledky. */
export function resizeSets(sets: SetScore[], bestOf: number): SetScore[] {
  const out = emptySets(bestOf);
  for (let i = 0; i < bestOf && i < sets.length; i++) out[i] = sets[i];
  return out;
}

// ============================ TÍMOVÉ SYSTÉMY ============================
export const TEAM_SYSTEMS: Record<TeamSystemId, TeamSystem> = {
  CORBILLON: { id: 'CORBILLON', name: 'Corbillon Cup (2 hráči)', rosterMin: 2, rosterMax: 4, activePlayers: 2, winTarget: 3, allowOneSubstitution: true, rubbers: [
    { order: 1, kind: 'singles', homeSlot: 'A', awaySlot: 'X', label: 'A – X' },
    { order: 2, kind: 'singles', homeSlot: 'B', awaySlot: 'Y', label: 'B – Y' },
    { order: 3, kind: 'doubles', homeSlot: 'AB', awaySlot: 'XY', label: 'Štvorhra' },
    { order: 4, kind: 'singles', homeSlot: 'A', awaySlot: 'Y', label: 'A – Y' },
    { order: 5, kind: 'singles', homeSlot: 'B', awaySlot: 'X', label: 'B – X' }] },
  SWAYTHLING: { id: 'SWAYTHLING', name: 'Swaythling Cup (3 hráči)', rosterMin: 3, rosterMax: 4, activePlayers: 3, winTarget: 5, allowOneSubstitution: true, rubbers: [
    { order: 1, kind: 'singles', homeSlot: 'A', awaySlot: 'X', label: 'A – X' },
    { order: 2, kind: 'singles', homeSlot: 'B', awaySlot: 'Y', label: 'B – Y' },
    { order: 3, kind: 'singles', homeSlot: 'C', awaySlot: 'Z', label: 'C – Z' },
    { order: 4, kind: 'singles', homeSlot: 'B', awaySlot: 'X', label: 'B – X' },
    { order: 5, kind: 'singles', homeSlot: 'A', awaySlot: 'Z', label: 'A – Z' },
    { order: 6, kind: 'singles', homeSlot: 'C', awaySlot: 'Y', label: 'C – Y' },
    { order: 7, kind: 'singles', homeSlot: 'B', awaySlot: 'Z', label: 'B – Z' },
    { order: 8, kind: 'singles', homeSlot: 'C', awaySlot: 'X', label: 'C – X' },
    { order: 9, kind: 'singles', homeSlot: 'A', awaySlot: 'Y', label: 'A – Y' }] },
  OLYMPIC: { id: 'OLYMPIC', name: 'Olympijský tímový systém', rosterMin: 3, rosterMax: 4, activePlayers: 3, winTarget: 3, allowOneSubstitution: true, rubbers: [
    { order: 1, kind: 'doubles', homeSlot: 'BC', awaySlot: 'YZ', label: 'Štvorhra B/C – Y/Z' },
    { order: 2, kind: 'singles', homeSlot: 'A', awaySlot: 'X', label: 'A – X' },
    { order: 3, kind: 'singles', homeSlot: 'C', awaySlot: 'Z', label: 'C – Z' },
    { order: 4, kind: 'singles', homeSlot: 'A', awaySlot: 'Y', label: 'A – Y' },
    { order: 5, kind: 'singles', homeSlot: 'B', awaySlot: 'X', label: 'B – X' }] },
  LEAGUE_2P1: { id: 'LEAGUE_2P1', name: 'Liga 2 + 1', rosterMin: 2, rosterMax: 4, activePlayers: 2, winTarget: 3, allowOneSubstitution: true, rubbers: [
    { order: 1, kind: 'singles', homeSlot: 'A', awaySlot: 'X', label: 'A – X' },
    { order: 2, kind: 'singles', homeSlot: 'B', awaySlot: 'Y', label: 'B – Y' },
    { order: 3, kind: 'doubles', homeSlot: 'AB', awaySlot: 'XY', label: 'Štvorhra' },
    { order: 4, kind: 'singles', homeSlot: 'A', awaySlot: 'Y', label: 'A – Y' },
    { order: 5, kind: 'singles', homeSlot: 'B', awaySlot: 'X', label: 'B – X' }] },
  LEAGUE_3P: { id: 'LEAGUE_3P', name: 'Liga 3 hráči', rosterMin: 3, rosterMax: 4, activePlayers: 3, winTarget: 5, allowOneSubstitution: true, rubbers: [
    { order: 1, kind: 'singles', homeSlot: 'A', awaySlot: 'X', label: 'A – X' },
    { order: 2, kind: 'singles', homeSlot: 'B', awaySlot: 'Y', label: 'B – Y' },
    { order: 3, kind: 'singles', homeSlot: 'C', awaySlot: 'Z', label: 'C – Z' },
    { order: 4, kind: 'doubles', homeSlot: 'AB', awaySlot: 'XY', label: 'Štvorhra' },
    { order: 5, kind: 'singles', homeSlot: 'A', awaySlot: 'Y', label: 'A – Y' },
    { order: 6, kind: 'singles', homeSlot: 'B', awaySlot: 'Z', label: 'B – Z' },
    { order: 7, kind: 'singles', homeSlot: 'C', awaySlot: 'X', label: 'C – X' }] },
  CUSTOM: { id: 'CUSTOM', name: 'Vlastný systém', rosterMin: 2, rosterMax: 4, activePlayers: 2, winTarget: 3, allowOneSubstitution: true, rubbers: [
    { order: 1, kind: 'singles', homeSlot: 'A', awaySlot: 'X', label: 'A – X' }] },
};

// ============================ ZÁPAS ============================
export function isValidSet(a: number, b: number) { const hi = Math.max(a, b), lo = Math.min(a, b); return hi >= 11 && hi - lo >= 2; }

export function validateMatch(m: Match, bestOf: number) {
  if (m.specialResult) return { valid: !!m.playerAId && !!m.playerBId, complete: true, message: '' };
  if (m.result) {
    const { a, b } = m.result; const need = setsToWin(bestOf);
    if (a === 0 && b === 0) return { valid: true, complete: false, message: 'Zvoľ celkový výsledok.' };
    const ok = a !== b && Math.max(a, b) === need && Math.min(a, b) < need;
    return { valid: ok, complete: ok, message: ok ? '' : `Celkový výsledok musí končiť na ${need} setov (napr. ${need}:0).` };
  }
  const need = setsToWin(bestOf); let a = 0, b = 0;
  for (let i = 0; i < m.sets.length; i++) {
    const s = m.sets[i];
    if (s.a === null && s.b === null) continue;
    if (s.a === null || s.b === null) return { valid: false, complete: false, message: `Set ${i + 1} nie je vyplnený celý.` };
    if (!isValidSet(s.a, s.b)) return { valid: false, complete: false, message: `Set ${i + 1} nie je platný (min. 11 a rozdiel 2).` };
    if (a >= need || b >= need) return { valid: false, complete: true, message: 'Po rozhodujúcom sete už nesmú byť ďalšie sety.' };
    if (s.a > s.b) a++; else b++;
  }
  const complete = a >= need || b >= need;
  return { valid: true, complete, message: complete ? '' : 'Zápas ešte nie je ukončený.' };
}

export function matchSummary(m: Match) {
  if (m.result) return { sa: m.result.a, sb: m.result.b, pa: 0, pb: 0 };
  let sa = 0, sb = 0, pa = 0, pb = 0;
  for (const s of m.sets) { if (s.a === null || s.b === null || !isValidSet(s.a, s.b)) continue; pa += s.a; pb += s.b; s.a > s.b ? sa++ : sb++; }
  return { sa, sb, pa, pb };
}

export function normalizeMatch(m: Match, bestOf: number): Match {
  if (m.specialResult) {
    const loser = m.specialResult.endsWith('_A') ? 'A' : 'B';
    const winner = loser === 'A' ? m.playerBId : m.playerAId;
    const status = m.specialResult.startsWith('WO') ? 'walkover' : m.specialResult.startsWith('RET') ? 'retired' : 'disqualified';
    return { ...m, winnerId: winner, status };
  }
  if (m.result) {
    const { a, b } = m.result;
    const winner = a > b ? m.playerAId : b > a ? m.playerBId : null;
    return { ...m, winnerId: winner, status: winner ? 'finished' : 'scheduled' };
  }
  const need = setsToWin(bestOf); let a = 0, b = 0;
  for (const s of m.sets) { if (s.a === null || s.b === null || !isValidSet(s.a, s.b)) continue; if (s.a > s.b) a++; else b++; if (a === need || b === need) break; }
  const winner = a === need ? m.playerAId : b === need ? m.playerBId : null;
  return { ...m, winnerId: winner, status: winner ? 'finished' : m.status === 'finished' ? 'scheduled' : m.status };
}

// ============================ SKUPINY ============================
export function chooseGroupSizes(n: number, pref: number) {
  if (n < 3) return n >= 2 ? [n] : [];
  const min = Math.ceil(n / 12), max = Math.floor(n / 3);
  const g = Math.max(min, Math.min(max, Math.round(n / Math.max(2, pref))));
  const base = Math.floor(n / g), rem = n % g;
  return Array.from({ length: g }, (_, i) => base + (i < rem ? 1 : 0));
}

/** Rozpis skupiny podľa Bergerových tabuliek (ITTF). Pre nepárny počet hráčov
 *  sa použije najbližšie párne číslo, kde najvyššie číslo je „voľno" (bye). */
export function generateRoundRobin(ids: string[], bestOf: number): Match[] {
  const n = ids.length;
  if (n < 2) return [];
  const even = n % 2 === 0 ? n : n + 1;
  const m = even - 1;            // počet kôl (nepárne modulo)
  const step = (m + 1) / 2;
  const idOf = (num: number) => (num >= 1 && num <= ids.length ? ids[num - 1] : null); // num === even a viac = voľno
  const out: Match[] = [];
  for (let r = 1; r <= m; r++) {
    const c = ((r - 1) * step) % m + 1;      // súper najvyššieho čísla v tomto kole
    const pairs: [number, number][] = [[even, c]];
    const used = new Set<number>([c]);
    for (let i = 1; i <= m; i++) {
      if (used.has(i)) continue;
      let j = (2 * c - i) % m; j = ((j % m) + m) % m; if (j === 0) j = m;
      if (j === i || used.has(j)) continue;
      pairs.push([i, j]); used.add(i); used.add(j);
    }
    for (const [a, b] of pairs) {
      const ida = idOf(a), idb = idOf(b);
      if (ida && idb) out.push({ id: uid(), round: r, playerAId: ida, playerBId: idb, sets: emptySets(bestOf), winnerId: null, status: 'scheduled', specialResult: null });
    }
  }
  return out;
}

export function createGroups(entries: GenericEntry[], pref: number, bestOf: 3 | 5 | 7, q: number): TournamentGroup[] {
  const sorted = [...entries].sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name, 'sk'));
  const sizes = chooseGroupSizes(sorted.length, pref);
  const buckets = sizes.map(() => [] as GenericEntry[]);
  let idx = 0, dir = 1; // hadové nasadenie
  for (const e of sorted) {
    while (buckets[idx].length >= sizes[idx]) { idx += dir; if (idx >= buckets.length) { idx = buckets.length - 1; dir = -1; } if (idx < 0) { idx = 0; dir = 1; } }
    buckets[idx].push(e);
    idx += dir; if (idx >= buckets.length) { idx = buckets.length - 1; dir = -1; } if (idx < 0) { idx = 0; dir = 1; }
  }
  return buckets.map((b, i) => ({ id: uid(), name: `Skupina ${String.fromCharCode(65 + i)}`, entryIds: b.map(x => x.id), matches: generateRoundRobin(b.map(x => x.id), bestOf), qualifiers: Math.max(0, Math.min(q, b.length)), bestOf }));
}

export function canMovePlayer(groups: TournamentGroup[], entryId: string, targetId: string) {
  const src = groups.find(g => g.entryIds.includes(entryId)), tgt = groups.find(g => g.id === targetId);
  if (!src || !tgt || src.id === tgt.id) return { ok: false, message: '' };
  if (src.entryIds.length <= 3) return { ok: false, message: 'Zdrojová skupina musí mať aspoň 3 účastníkov.' };
  if (tgt.entryIds.length >= 12) return { ok: false, message: 'Cieľová skupina môže mať najviac 12 účastníkov.' };
  if (src.matches.some(m => m.winnerId) || tgt.matches.some(m => m.winnerId)) return { ok: false, message: 'Po zadaní výsledkov už nemožno presúvať.' };
  return { ok: true, message: '' };
}
export function movePlayer(groups: TournamentGroup[], entryId: string, targetId: string): TournamentGroup[] {
  if (!canMovePlayer(groups, entryId, targetId).ok) return groups;
  return groups.map(g => {
    if (!g.entryIds.includes(entryId) && g.id !== targetId) return g;
    const ids = g.id === targetId ? [...g.entryIds, entryId] : g.entryIds.filter(i => i !== entryId);
    return { ...g, entryIds: ids, matches: generateRoundRobin(ids, g.bestOf), qualifiers: Math.max(0, Math.min(g.qualifiers, ids.length)) };
  });
}

/** Zmena best of skupiny (zachová výsledky). */
export function setGroupBestOf(g: TournamentGroup, bestOf: 3 | 5 | 7): TournamentGroup {
  return { ...g, bestOf, matches: g.matches.map(m => normalizeMatch({ ...m, sets: resizeSets(m.sets, bestOf) }, bestOf)) };
}

// ============================ TABUĽKY (ITTF minitabuľka) ============================
const ratio = (a: number, b: number) => (b === 0 ? (a > 0 ? Number.POSITIVE_INFINITY : 0) : a / b);
type Row = StandingRow;

export function statsFor(entries: GenericEntry[], matches: Match[]): Row[] {
  const rows: Row[] = entries.map(entry => ({ entry, played: 0, wins: 0, losses: 0, matchPoints: 0, setsFor: 0, setsAgainst: 0, pointsFor: 0, pointsAgainst: 0, position: 0, qualified: false, tieNote: '' }));
  const map = new Map(rows.map(r => [r.entry.id, r]));
  for (const m of matches) {
    if (!m.winnerId || !m.playerAId || !m.playerBId) continue;
    const a = map.get(m.playerAId), b = map.get(m.playerBId);
    if (!a || !b) continue;
    const s = matchSummary(m);
    a.played++; b.played++;
    a.setsFor += s.sa; a.setsAgainst += s.sb; b.setsFor += s.sb; b.setsAgainst += s.sa;
    a.pointsFor += s.pa; a.pointsAgainst += s.pb; b.pointsFor += s.pb; b.pointsAgainst += s.pa;
    const woLoss = !!(m.specialResult && m.specialResult.startsWith('WO'));
    if (m.winnerId === a.entry.id) { a.wins++; a.matchPoints += 2; b.losses++; b.matchPoints += woLoss ? 0 : 1; }
    else { b.wins++; b.matchPoints += 2; a.losses++; a.matchPoints += woLoss ? 0 : 1; }
  }
  return rows;
}

function resolveTie(tied: Row[], matches: Match[]): Row[] {
  if (tied.length <= 1) return tied;
  if (tied.length === 2) {
    const ids = new Set(tied.map(r => r.entry.id));
    const direct = matches.find(m => m.winnerId && m.playerAId && m.playerBId && ids.has(m.playerAId) && ids.has(m.playerBId));
    if (direct) return [...tied].sort((a, b) => (direct.winnerId === a.entry.id ? -1 : direct.winnerId === b.entry.id ? 1 : 0)).map(r => ({ ...r, tieNote: 'vzájomný zápas' }));
  }
  const ids = new Set(tied.map(r => r.entry.id));
  const mini = matches.filter(m => m.playerAId && m.playerBId && ids.has(m.playerAId) && ids.has(m.playerBId));
  const ms = statsFor(tied.map(r => r.entry), mini);
  ms.sort((a, b) => b.matchPoints - a.matchPoints || ratio(b.setsFor, b.setsAgainst) - ratio(a.setsFor, a.setsAgainst) || ratio(b.pointsFor, b.pointsAgainst) - ratio(a.pointsFor, a.pointsAgainst));
  const orig = (r: Row) => tied.find(x => x.entry.id === r.entry.id)!;
  const out: Row[] = [];
  for (let i = 0; i < ms.length;) {
    let j = i + 1;
    while (j < ms.length && ms[j].matchPoints === ms[i].matchPoints && ratio(ms[j].setsFor, ms[j].setsAgainst) === ratio(ms[i].setsFor, ms[i].setsAgainst) && ratio(ms[j].pointsFor, ms[j].pointsAgainst) === ratio(ms[i].pointsFor, ms[i].pointsAgainst)) j++;
    const block = ms.slice(i, j);
    if (block.length === ms.length) { // stále nerozhodné → rating, meno
      block.sort((a, b) => b.entry.rating - a.entry.rating || a.entry.name.localeCompare(b.entry.name, 'sk'));
      out.push(...block.map(r => ({ ...orig(r), tieNote: 'minitabuľka → rating' })));
    } else if (block.length > 1) {
      out.push(...resolveTie(block.map(orig), mini).map(r => ({ ...r, tieNote: r.tieNote || 'minitabuľka' })));
    } else out.push({ ...orig(block[0]), tieNote: 'minitabuľka' });
    i = j;
  }
  return out;
}

export function standings(group: TournamentGroup, map: Map<string, GenericEntry>): StandingRow[] {
  const entries = group.entryIds.map(id => map.get(id)).filter(Boolean) as GenericEntry[];
  const base = statsFor(entries, group.matches);
  base.sort((a, b) => b.matchPoints - a.matchPoints);
  const ordered: Row[] = [];
  for (let i = 0; i < base.length;) { let j = i + 1; while (j < base.length && base[j].matchPoints === base[i].matchPoints) j++; ordered.push(...resolveTie(base.slice(i, j), group.matches)); i = j; }
  ordered.forEach((r, i) => { r.position = i + 1; r.qualified = i < group.qualifiers; });
  return ordered;
}

// ============================ PAVÚK (KO) ============================
function seedOrder(size: number): number[] {
  let rounds = [[1, 2]];
  const total = Math.round(Math.log2(size));
  for (let r = 0; r < total - 1; r++) {
    const next: number[][] = []; const sum = Math.pow(2, r + 2) + 1;
    for (const m of rounds) { next.push([m[0], sum - m[0]]); next.push([sum - m[1], m[1]]); }
    rounds = next;
  }
  return rounds.flat();
}
const roundName = (count: number) => (count === 2 ? 'Finále' : count === 4 ? 'Semifinále' : count === 8 ? 'Štvrťfinále' : count === 16 ? 'Osemfinále' : `Kolo ${count}`);
const byeWinner = (a: string | null, b: string | null) => (a && !b ? a : b && !a ? b : null);

type Seed = { id: string; groupIndex: number; position: number };

function bracketFromSeeds(seeds: (Seed | null)[], bestOf: 3 | 5 | 7, thirdPlace: boolean): KnockoutRound[] {
  const size = seeds.length;
  const rounds: KnockoutRound[] = [];
  let count = size;
  for (let ri = 0; count >= 2; ri++, count /= 2) {
    const matches: Match[] = [];
    for (let i = 0; i < count / 2; i++) {
      const a = ri === 0 ? seeds[i * 2]?.id ?? null : null;
      const b = ri === 0 ? seeds[i * 2 + 1]?.id ?? null : null;
      const auto = byeWinner(a, b);
      matches.push({ id: uid(), round: ri + 1, playerAId: a, playerBId: b, sets: emptySets(bestOf), winnerId: auto, status: auto ? 'finished' : 'scheduled', specialResult: null });
    }
    rounds.push({ id: uid(), name: roundName(count), matches, kind: 'main', bestOf });
  }
  const out = advanceMain(rounds);
  if (thirdPlace && out.length >= 2) out.push({ id: uid(), name: 'O 3. miesto', kind: 'third', bestOf, matches: [{ id: uid(), round: out.length, playerAId: null, playerBId: null, sets: emptySets(bestOf), winnerId: null, status: 'scheduled', specialResult: null }] });
  return out;
}

/** Nasadenie: seed 1 hore / 2 dole, rozloženie bye, vyhýbanie sa 1. kolo hráčom z tej istej skupiny. */
function placeSeeds(qualified: Seed[]): (Seed | null)[] {
  let size = 1; while (size < qualified.length) size *= 2; size = Math.max(2, size);
  const q = [...qualified].sort((a, b) => a.position - b.position);
  const order = seedOrder(size);
  const slots: (Seed | null)[] = Array(size).fill(null);
  q.forEach((s, i) => { slots[order[i] - 1] = s; });
  for (let i = 0; i < size; i += 2) {
    const a = slots[i], b = slots[i + 1];
    if (a && b && a.groupIndex === b.groupIndex) {
      for (let k = 0; k < size; k += 2) {
        if (k === i) continue;
        const c = slots[k], d = slots[k + 1];
        if (d && d.groupIndex !== a.groupIndex && (!c || c.groupIndex !== b.groupIndex)) { const t = slots[i + 1]; slots[i + 1] = slots[k + 1]; slots[k + 1] = t; break; }
      }
    }
  }
  return slots;
}

export function createKnockout(c: Competition, map: Map<string, GenericEntry>): Knockout {
  const ratingOf = (id: string) => map.get(id)?.rating ?? 0;
  const collect = (want: 'main' | 'cons'): Seed[] => c.groups.flatMap((g, gi) => standings(g, map)
    .filter(r => (want === 'main' ? r.qualified : !r.qualified))
    .map(r => ({ id: r.entry.id, groupIndex: gi, position: r.position })))
    .sort((a, b) => a.position - b.position || ratingOf(b.id) - ratingOf(a.id));
  const mainSeeds = collect('main');
  const main = mainSeeds.length >= 2 ? bracketFromSeeds(placeSeeds(mainSeeds), c.bestOf, c.thirdPlace) : [];
  let consolation: KnockoutRound[] = [];
  if (c.consolation) { const cs = collect('cons'); if (cs.length >= 2) consolation = bracketFromSeeds(placeSeeds(cs), c.bestOf, false); }
  return { main, consolation };
}

/** Posun víťazov v hlavnom pavúku + doplnenie zápasu o 3. miesto zo semifinálových porazených. */
function advanceMain(rounds: KnockoutRound[]): KnockoutRound[] {
  const copy: KnockoutRound[] = structuredClone(rounds);
  const main = copy.filter(r => r.kind !== 'third');
  for (let r = 0; r < main.length - 1; r++) {
    main[r].matches.forEach((m, i) => {
      const target = main[r + 1].matches[Math.floor(i / 2)];
      if (i % 2 === 0) target.playerAId = m.winnerId; else target.playerBId = m.winnerId;
      const a = target.playerAId, b = target.playerBId;
      if ((a && !b) || (b && !a)) { target.winnerId = a || b; target.status = 'finished'; }
      else if (a && b && target.winnerId && ![a, b].includes(target.winnerId)) { target.winnerId = null; target.status = 'scheduled'; target.sets = emptySets(target.sets.length); }
    });
  }
  const semi = main.at(-2), third = copy.find(r => r.kind === 'third');
  if (semi && third) {
    const losers = semi.matches.map(m => (m.winnerId ? (m.winnerId === m.playerAId ? m.playerBId : m.playerAId) : null));
    third.matches[0].playerAId = losers[0] ?? null;
    third.matches[0].playerBId = losers[1] ?? null;
  }
  return copy;
}

export function advanceKnockout(rounds: KnockoutRound[]): KnockoutRound[] { return advanceMain(rounds); }

/** Zmena best of pre celé kolo pavúka (zachová výsledky). */
export function setRoundBestOf(round: KnockoutRound, bestOf: 3 | 5 | 7): KnockoutRound {
  return { ...round, bestOf, matches: round.matches.map(m => normalizeMatch({ ...m, sets: resizeSets(m.sets, bestOf) }, bestOf)) };
}

// ============================ HARMONOGRAM ============================
export function autoSchedule(competitions: Competition[], tables: number, start = '09:00', matchMinutes = 25, restMinutes = 15): Competition[] {
  const [h, min] = start.split(':').map(Number);
  const tableFree = Array(Math.max(1, tables)).fill(h * 60 + min);
  const busy = new Map<string, number>();
  const copy: Competition[] = structuredClone(competitions);
  const all = copy.flatMap(c => c.groups.flatMap(g => g.matches.map(m => ({ m })))).sort((a, b) => a.m.round - b.m.round);
  for (const { m } of all) {
    if (!m.playerAId || !m.playerBId) continue;
    let bestTable = 0, bestStart = Infinity;
    for (let t = 0; t < tableFree.length; t++) {
      const ready = Math.max(tableFree[t], busy.get(m.playerAId) ?? 0, busy.get(m.playerBId) ?? 0);
      if (ready < bestStart) { bestStart = ready; bestTable = t; }
    }
    m.table = bestTable + 1;
    m.scheduledTime = `${String(Math.floor(bestStart / 60) % 24).padStart(2, '0')}:${String(bestStart % 60).padStart(2, '0')}`;
    tableFree[bestTable] = bestStart + matchMinutes;
    busy.set(m.playerAId, bestStart + matchMinutes + restMinutes);
    busy.set(m.playerBId, bestStart + matchMinutes + restMinutes);
  }
  return copy;
}

// ============================ TÍMOVÉ STRETNUTIA ============================
function idsFor(slot: string, side: 'home' | 'away', n: TeamNomination) {
  if (slot.length > 1) return side === 'home' ? [...n.homeDouble] : [...n.awayDouble];
  const id = side === 'home' ? n.homeSlots[slot] : n.awaySlots[slot];
  return id ? [id] : [];
}
function rubberFromTemplate(t: TeamSystem['rubbers'][number], n: TeamNomination, bestOf: number): TeamRubber {
  const home = idsFor(t.homeSlot, 'home', n), away = idsFor(t.awaySlot, 'away', n);
  return { id: uid(), order: t.order, kind: t.kind, label: t.label, homePlayerIds: home, awayPlayerIds: away, match: { id: uid(), round: t.order, playerAId: home.join('+') || null, playerBId: away.join('+') || null, sets: emptySets(bestOf), winnerId: null, status: 'scheduled', specialResult: null } };
}
export function buildTeamTie(competitionId: string, home: TeamEntry, away: TeamEntry, systemId: TeamSystemId, bestOf: number): TeamTie {
  const sys = TEAM_SYSTEMS[systemId]; const homeSlots: Record<string, string> = {}, awaySlots: Record<string, string> = {};
  ['A', 'B', 'C', 'D'].forEach((s, i) => { if (home.playerIds[i]) homeSlots[s] = home.playerIds[i]; });
  ['X', 'Y', 'Z', 'W'].forEach((s, i) => { if (away.playerIds[i]) awaySlots[s] = away.playerIds[i]; });
  const nomination: TeamNomination = { homeSlots, awaySlots, homeDouble: home.playerIds.slice(0, 2) as [string, string], awayDouble: away.playerIds.slice(0, 2) as [string, string] };
  return { id: uid(), competitionId, homeTeamId: home.id, awayTeamId: away.id, systemId, nomination, rubbers: sys.rubbers.map(t => rubberFromTemplate(t, nomination, bestOf)), homeScore: 0, awayScore: 0, winnerTeamId: null, status: 'scheduled' };
}
export function applySubstitution(tie: TeamTie, side: 'home' | 'away', outPlayerId: string, inPlayerId: string, fromRubber: number, bestOf: number): TeamTie {
  const key = side === 'home' ? 'homeSub' : 'awaySub';
  if (tie.nomination[key]) throw new Error('Počas stretnutia je povolené len jedno striedanie družstva.');
  const nomination = { ...tie.nomination, [key]: { outPlayerId, inPlayerId, fromRubber } };
  const rubbers = tie.rubbers.map(r => {
    if (r.order < fromRubber) return r;
    const repl = (ids: string[]) => ids.map(x => (x === outPlayerId ? inPlayerId : x));
    const home = side === 'home' ? repl(r.homePlayerIds) : r.homePlayerIds;
    const away = side === 'away' ? repl(r.awayPlayerIds) : r.awayPlayerIds;
    return { ...r, homePlayerIds: home, awayPlayerIds: away, match: { ...r.match, playerAId: home.join('+') || null, playerBId: away.join('+') || null, sets: emptySets(bestOf), winnerId: null, status: 'scheduled' as const } };
  });
  return { ...tie, nomination, rubbers };
}
export function scoreTeamTie(tie: TeamTie, bestOf: number): TeamTie {
  const sys = TEAM_SYSTEMS[tie.systemId]; let h = 0, a = 0;
  const rubbers = tie.rubbers.map(r => ({ ...r, match: normalizeMatch(r.match, bestOf) }));
  for (const r of rubbers) { if (h >= sys.winTarget || a >= sys.winTarget) break; if (!r.match.winnerId) continue; if (r.match.winnerId === r.match.playerAId) h++; else a++; }
  const done = h >= sys.winTarget || a >= sys.winTarget;
  return { ...tie, rubbers, homeScore: h, awayScore: a, winnerTeamId: h >= sys.winTarget ? tie.homeTeamId : a >= sys.winTarget ? tie.awayTeamId : null, status: done ? 'finished' : rubbers.some(r => r.match.winnerId) ? 'playing' : 'scheduled' };
}

// ============================ ZJEDNOTENIE ÚČASTNÍKOV ============================
export function entryMap(c: Competition, players: Player[], pairs: PairEntry[], teams: TeamEntry[]) {
  const pm = new Map(players.map(p => [p.id, p]));
  const out = new Map<string, GenericEntry>();
  if (c.type === 'singles') players.forEach(p => out.set(p.id, { id: p.id, name: p.name, club: p.club, rating: p.rating, memberIds: [p.id] }));
  if (c.type === 'doubles' || c.type === 'mixed') pairs.forEach(p => out.set(p.id, { id: p.id, name: p.name, club: p.club, rating: (pm.get(p.playerIds[0])?.rating || 0) + (pm.get(p.playerIds[1])?.rating || 0), memberIds: p.playerIds }));
  if (c.type === 'teams') teams.forEach(t => out.set(t.id, { id: t.id, name: t.name, club: t.club, rating: t.playerIds.reduce((s, id) => s + (pm.get(id)?.rating || 0), 0), memberIds: t.playerIds }));
  return out;
}

// pomocník: textové skóre zápasu (sety alebo osobitný výsledok)
export function scoreText(m: Match): string {
  if (m.specialResult) return m.specialResult.replace('_', ' ');
  if (m.result) return `${m.result.a}:${m.result.b}`;
  let a = 0, b = 0; for (const s of m.sets) { if (s.a === null || s.b === null) continue; if (s.a > s.b) a++; else b++; } return `${a}:${b}`;
}

// detailný rozpis setov, napr. "11:1, 9:11, 11:5"
export function setsText(m: Match): string {
  if (m.specialResult) return m.specialResult.replace('_', ' ');
  if (m.result) return '';
  return m.sets.filter(s => s.a !== null && s.b !== null).map(s => `${s.a}:${s.b}`).join(', ');
}

// rozpis skupinových zápasov po kolách (naprieč všetkými skupinami súťaže)
export function groupRounds(c: Competition): { round: number; items: { groupName: string; m: Match }[] }[] {
  const map = new Map<number, { groupName: string; m: Match }[]>();
  c.groups.forEach(g => g.matches.forEach(m => { const arr = map.get(m.round) || []; arr.push({ groupName: g.name, m }); map.set(m.round, arr); }));
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([round, items]) => ({ round, items: items.sort((x, y) => x.groupName.localeCompare(y.groupName, 'sk') || (x.m.table ?? 99) - (y.m.table ?? 99)) }));
}

// play-off skupiny: 1.–2. o prvé miesto, 3.–4. o tretie miesto (podľa poradia v skupine)
export function createGroupPlayoff(group: TournamentGroup, map: Map<string, GenericEntry>): { final: Match; third: Match | null } {
  const st = standings(group, map);
  const mk = (aId: string | null, bId: string | null): Match => ({ id: uid(), round: 1, playerAId: aId, playerBId: bId, sets: emptySets(group.bestOf), winnerId: null, status: 'scheduled', specialResult: null });
  const final = mk(st[0]?.entry.id ?? null, st[1]?.entry.id ?? null);
  const third = st.length >= 4 ? mk(st[2].entry.id, st[3].entry.id) : null;
  return { final, third };
}

/** Finálne poradie kategórie (ako SSTZ): 1, 2, 3–4, 5–8, 9–16 … podľa vypadnutia z pavúka,
 *  nepostupujúci zo skupín zoradení podľa umiestnenia v skupine (vetvené po miestach). */
export function finalOrder(c: Competition, map: Map<string, GenericEntry>): FinalRow[] {
  const groupPos = new Map<string, number>();
  const wl = (m?: Match | null): [string | null, string | null] => (m && m.winnerId ? [m.winnerId, m.winnerId === m.playerAId ? m.playerBId : m.playerAId] : [null, null]);
  c.groups.forEach(g => {
    standings(g, map).forEach(r => groupPos.set(r.entry.id, r.position));
    if (g.playoff) {
      const [fw, fl] = wl(g.playoff.final); if (fw) groupPos.set(fw, 1); if (fl) groupPos.set(fl, 2);
      const [tw, tl] = wl(g.playoff.third); if (tw) groupPos.set(tw, 3); if (tl) groupPos.set(tl, 4);
    }
  });
  const rows: FinalRow[] = [];
  const placed = new Set<string>();
  const put = (id: string | null, place: number, label: string) => { if (!id) return; const e = map.get(id); if (e && !placed.has(id)) { rows.push({ entry: e, place, placeLabel: label }); placed.add(id); } };
  const loser = (m: Match) => (m.winnerId ? (m.winnerId === m.playerAId ? m.playerBId : m.playerAId) : null);

  const main = c.ko.main.filter(r => r.kind !== 'third');
  const third = c.ko.main.find(r => r.kind === 'third');
  if (main.length) {
    const fin = main[main.length - 1].matches[0];
    if (fin?.winnerId) { put(fin.winnerId, 1, '1'); put(loser(fin), 2, '2'); }
    const semi = main[main.length - 2];
    const tm = third?.matches[0];
    if (tm && tm.winnerId) { put(tm.winnerId, 3, '3'); put(loser(tm), 4, '4'); }
    else if (semi) semi.matches.forEach(m => put(loser(m), 3, '3–4'));
    for (let ri = main.length - 3; ri >= 0; ri--) {
      const mc = main[ri].matches.length; const start = mc + 1, end = 2 * mc; const label = `${start}–${end}`;
      main[ri].matches.forEach(m => put(loser(m), start, label));
    }
  }
  // zvyšok (nepostupujúci + neumiestnení) podľa miesta v skupine
  const rest = c.entryIds.map(id => map.get(id)).filter((e): e is GenericEntry => !!e && !placed.has(e.id));
  const byPos = new Map<number, GenericEntry[]>();
  rest.forEach(e => { const p = groupPos.get(e.id) ?? 99; (byPos.get(p) ?? byPos.set(p, []).get(p)!).push(e); });
  let base = rows.reduce((mx, r) => Math.max(mx, r.place), 0);
  [...byPos.keys()].sort((a, b) => a - b).forEach(pos => {
    const arr = byPos.get(pos)!.sort((a, b) => b.rating - a.rating);
    const start = base + 1, end = base + arr.length;
    const label = arr.length > 1 ? `${start}–${end}` : `${start}`;
    arr.forEach(e => rows.push({ entry: e, place: start, placeLabel: label }));
    base = end;
  });
  return rows.sort((a, b) => a.place - b.place);
}

/** Minitabuľky pri rovnosti bodov: pre každú skupinu hráčov s rovnakými bodmi vráti
 *  ich vzájomnú tabuľku (len zápasy medzi nimi), zoradenú tak, ako sa rovnosť rozhodla. */
export function tieTables(group: TournamentGroup, map: Map<string, GenericEntry>): StandingRow[][] {
  const full = standings(group, map);
  const out: StandingRow[][] = [];
  for (let i = 0; i < full.length;) {
    let j = i + 1;
    while (j < full.length && full[j].matchPoints === full[i].matchPoints) j++;
    if (j - i >= 2) {
      const slice = full.slice(i, j);
      const ids = new Set(slice.map(r => r.entry.id));
      const mini = group.matches.filter(m => m.playerAId && m.playerBId && ids.has(m.playerAId) && ids.has(m.playerBId));
      if (mini.some(m => m.winnerId)) {
        const order = new Map(slice.map((r, idx) => [r.entry.id, idx]));
        const rows = statsFor(slice.map(r => r.entry), mini).sort((a, b) => order.get(a.entry.id)! - order.get(b.entry.id)!);
        rows.forEach((r, idx) => { r.position = slice[idx].position; });
        out.push(rows);
      }
    }
    i = j;
  }
  return out;
}
