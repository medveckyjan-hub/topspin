import type {
  Competition, GenericEntry, Knockout, KnockoutRound, Match, PairEntry, Player,
  SetScore, StandingRow, TeamEntry, TeamNomination, TeamRubber, TeamSystem, TeamSystemId,
  TeamTie, TournamentGroup, FinalRow, QualBracket, QualificationStage } from '../types';

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
  CORBILLON: { id: 'CORBILLON', name: 'Corbillon Cup (2–4 hráči, 4 dvojhry + štvorhra)', rosterMin: 2, rosterMax: 4, activePlayers: 2, winTarget: 3, allowOneSubstitution: false, rubbers: [
    { order: 1, kind: 'singles', homeSlot: 'A', awaySlot: 'X', label: 'A – X' },
    { order: 2, kind: 'singles', homeSlot: 'B', awaySlot: 'Y', label: 'B – Y' },
    { order: 3, kind: 'doubles', homeSlot: 'AB', awaySlot: 'XY', label: 'Štvorhra' },
    { order: 4, kind: 'singles', homeSlot: 'A', awaySlot: 'Y', label: 'A – Y' },
    { order: 5, kind: 'singles', homeSlot: 'B', awaySlot: 'X', label: 'B – X' }] },
  SWAYTHLING: { id: 'SWAYTHLING', name: 'New Swaythling Cup (3 hráči, 5 dvojhier)', rosterMin: 3, rosterMax: 3, activePlayers: 3, winTarget: 3, allowOneSubstitution: false, rubbers: [
    { order: 1, kind: 'singles', homeSlot: 'A', awaySlot: 'X', label: 'A – X' },
    { order: 2, kind: 'singles', homeSlot: 'B', awaySlot: 'Y', label: 'B – Y' },
    { order: 3, kind: 'singles', homeSlot: 'C', awaySlot: 'Z', label: 'C – Z' },
    { order: 4, kind: 'singles', homeSlot: 'A', awaySlot: 'Y', label: 'A – Y' },
    { order: 5, kind: 'singles', homeSlot: 'B', awaySlot: 'X', label: 'B – X' }] },
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
  TEAM2_4S: { id: 'TEAM2_4S', name: 'Dvojčlenné družstvá (4 dvojhry + štvorhra)', rosterMin: 2, rosterMax: 4, activePlayers: 2, winTarget: 3, allowOneSubstitution: true, rubbers: [
    { order: 1, kind: 'singles', homeSlot: 'A', awaySlot: 'X', label: 'A – X' },
    { order: 2, kind: 'singles', homeSlot: 'B', awaySlot: 'Y', label: 'B – Y' },
    { order: 3, kind: 'singles', homeSlot: 'A', awaySlot: 'Y', label: 'A – Y' },
    { order: 4, kind: 'singles', homeSlot: 'B', awaySlot: 'X', label: 'B – X' },
    { order: 5, kind: 'doubles', homeSlot: 'AB', awaySlot: 'XY', label: 'Štvorhra' }] },
  TEAM3_5S: { id: 'TEAM3_5S', name: 'Trojčlenné družstvá 3 vs. 3 (5 dvojhier)', rosterMin: 3, rosterMax: 5, activePlayers: 3, winTarget: 3, allowOneSubstitution: true, rubbers: [
    { order: 1, kind: 'singles', homeSlot: 'A', awaySlot: 'X', label: 'A – X' },
    { order: 2, kind: 'singles', homeSlot: 'B', awaySlot: 'Y', label: 'B – Y' },
    { order: 3, kind: 'singles', homeSlot: 'C', awaySlot: 'Z', label: 'C – Z' },
    { order: 4, kind: 'singles', homeSlot: 'A', awaySlot: 'Y', label: 'A – Y' },
    { order: 5, kind: 'singles', homeSlot: 'B', awaySlot: 'X', label: 'B – X' }] },
  TEAM3_9S: { id: 'TEAM3_9S', name: 'ITTF Best of 9 (3 hráči, 9 dvojhier)', rosterMin: 3, rosterMax: 3, activePlayers: 3, winTarget: 5, allowOneSubstitution: false, rubbers: [
    { order: 1, kind: 'singles', homeSlot: 'A', awaySlot: 'X', label: 'A – X' },
    { order: 2, kind: 'singles', homeSlot: 'B', awaySlot: 'Y', label: 'B – Y' },
    { order: 3, kind: 'singles', homeSlot: 'C', awaySlot: 'Z', label: 'C – Z' },
    { order: 4, kind: 'singles', homeSlot: 'B', awaySlot: 'X', label: 'B – X' },
    { order: 5, kind: 'singles', homeSlot: 'A', awaySlot: 'Z', label: 'A – Z' },
    { order: 6, kind: 'singles', homeSlot: 'C', awaySlot: 'Y', label: 'C – Y' },
    { order: 7, kind: 'singles', homeSlot: 'B', awaySlot: 'Z', label: 'B – Z' },
    { order: 8, kind: 'singles', homeSlot: 'C', awaySlot: 'X', label: 'C – X' },
    { order: 9, kind: 'singles', homeSlot: 'A', awaySlot: 'Y', label: 'A – Y' }] },
  MIXED_TEAM: { id: 'MIXED_TEAM', name: 'Zmiešané družstvá (chlapec + dievča)', rosterMin: 2, rosterMax: 4, activePlayers: 2, winTarget: 3, allowOneSubstitution: true, rubbers: [
    { order: 1, kind: 'singles', homeSlot: 'A', awaySlot: 'X', label: 'Chlapci: A – X' },
    { order: 2, kind: 'singles', homeSlot: 'B', awaySlot: 'Y', label: 'Dievčatá: B – Y' },
    { order: 3, kind: 'doubles', homeSlot: 'AB', awaySlot: 'XY', label: 'Zmiešaná štvorhra' },
    { order: 4, kind: 'singles', homeSlot: 'A', awaySlot: 'Y', label: 'A – Y' },
    { order: 5, kind: 'singles', homeSlot: 'B', awaySlot: 'X', label: 'B – X' }] },
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

/** Príslušnosť pre oddelenie v žrebe — klub, pri reprezentácii štát. */
const affiliationOf = (e: GenericEntry): string => (e.club || '').trim().toLowerCase();

/**
 * Rozdelenie do skupín podľa pravidiel:
 *  - hadové nasadenie podľa ratingu (najlepší do rôznych skupín),
 *  - hráči z rovnakého klubu (resp. štátu) sa rozdelia do čo najviac rôznych skupín;
 *    stretnúť sa môžu až vtedy, keď je ich viac než skupín.
 * Postupuje sa po pásmach: v každom pásme dostane každá skupina jedného hráča,
 * pričom sa vyberá taký, ktorý do skupiny nevnesie ďalší klubový konflikt.
 */
export function createGroups(entries: GenericEntry[], pref: number, bestOf: 3 | 5 | 7, q: number): TournamentGroup[] {
  const sorted = [...entries].sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name, 'sk'));
  const sizes = chooseGroupSizes(sorted.length, pref);
  const n = sizes.length;
  const buckets: GenericEntry[][] = sizes.map(() => []);
  const clubs: Map<string, number>[] = sizes.map(() => new Map());

  const countIn = (gi: number, aff: string) => (aff ? clubs[gi].get(aff) ?? 0 : 0);
  const put = (gi: number, e: GenericEntry) => {
    buckets[gi].push(e);
    const aff = affiliationOf(e);
    if (aff) clubs[gi].set(aff, countIn(gi, aff) + 1);
  };

  const pool = [...sorted];
  let band = 0;
  while (pool.length) {
    // poradie skupín v tomto pásme = hadové (tam a späť)
    const order = Array.from({ length: n }, (_, i) => (band % 2 === 0 ? i : n - 1 - i))
      .filter(gi => buckets[gi].length < sizes[gi]);
    if (!order.length) break;

    for (const gi of order) {
      if (!pool.length) break;
      // vyber najvyššie nasadeného hráča, ktorý do skupiny nevnesie klubový konflikt;
      // ak taký nie je, ber najvyššie nasadeného s najmenším počtom rovnakého klubu
      let pick = pool.findIndex(e => countIn(gi, affiliationOf(e)) === 0);
      if (pick === -1) {
        let best = 0, bestCount = Infinity;
        pool.forEach((e, i) => { const c = countIn(gi, affiliationOf(e)); if (c < bestCount) { bestCount = c; best = i; } });
        pick = best;
      }
      put(gi, pool.splice(pick, 1)[0]);
    }
    band++;
  }

  return buckets.map((b, i) => ({ id: uid(), name: `Skupina ${String.fromCharCode(65 + i)}`, entryIds: b.map(x => x.id), matches: generateRoundRobin(b.map(x => x.id), bestOf), qualifiers: Math.max(0, Math.min(q, b.length)), bestOf }));
}

/** Kontrola žrebu: skupiny, v ktorých sa stretli hráči z rovnakého klubu. */
export function clubConflicts(groups: TournamentGroup[], map: Map<string, GenericEntry>): { group: string; club: string; count: number }[] {
  const out: { group: string; club: string; count: number }[] = [];
  groups.forEach(g => {
    const seen = new Map<string, number>();
    g.entryIds.forEach(id => {
      const e = map.get(id); if (!e) return;
      const aff = affiliationOf(e); if (!aff) return;
      seen.set(aff, (seen.get(aff) ?? 0) + 1);
    });
    seen.forEach((count, club) => { if (count > 1) out.push({ group: g.name, club: map.get(g.entryIds.find(id => affiliationOf(map.get(id) ?? { club: '' } as GenericEntry) === club) ?? '')?.club ?? club, count }); });
  });
  return out;
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

type Seed = { id: string; groupIndex: number; position: number; club?: string };

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

/**
 * Nasadenie pavúka PO SKUPINÁCH: seed 1 hore / 2 dole, rozloženie bye.
 * Jediné pravidlo oddelenia je skupina — postupujúci z tej istej skupiny
 * (A1 a A2) musia ísť do opačných polovíc pavúka. Klub sa tu nerieši,
 * o jeho oddelenie sa postaral už žreb do skupín.
 */
function placeSeeds(qualified: Seed[]): (Seed | null)[] {
  let size = 1; while (size < qualified.length) size *= 2; size = Math.max(2, size);
  const q = [...qualified].sort((a, b) => a.position - b.position);
  const order = seedOrder(size);
  const slots: (Seed | null)[] = Array(size).fill(null);
  q.forEach((s, i) => { slots[order[i] - 1] = s; });

  const half = size / 2;
  const halfOf = (i: number) => (i < half ? 0 : 1);
  const groupsInHalf = (h: number) => {
    const m = new Map<number, number[]>();
    slots.forEach((x, i) => { if (x && halfOf(i) === h) m.set(x.groupIndex, [...(m.get(x.groupIndex) ?? []), i]); });
    return m;
  };

  // A1 a A2 do opačných polovíc — presúva sa vždy ten horšie nasadený z dvojice
  // a vymieňa sa len s hráčom, nie s voľným žrebom, aby rozloženie bye
  // (voľné žreby patria najvyššie nasadeným) zostalo nedotknuté.
  for (let h = 0; h < 2; h++) {
    const dup = [...groupsInHalf(h)].filter(([, idxs]) => idxs.length > 1);
    for (const [gi, idxs] of dup) {
      const move = idxs.sort((x, y) => (slots[y]!.position - slots[x]!.position))[0]; // najhoršie nasadený
      const other = 1 - h;
      let target = -1;
      for (let k = 0; k < size; k++) {
        if (halfOf(k) !== other) continue;
        const b = slots[k];
        if (!b) continue;                                             // voľný žreb sa nepresúva
        if (b.groupIndex === gi) continue;                            // tam by konflikt vznikol
        const back = groupsInHalf(h).get(b.groupIndex) ?? [];
        if (back.some(i => i !== move)) continue;                     // presun by vytvoril konflikt naopak
        target = k; break;
      }
      if (target >= 0) { const t = slots[move]; slots[move] = slots[target]; slots[target] = t; }
    }
  }

  // v 1. kole sa nesmú stretnúť hráči z tej istej skupiny
  for (let i = 0; i < size; i += 2) {
    const a = slots[i], b = slots[i + 1];
    if (a && b && a.groupIndex === b.groupIndex) {
      for (let k = 0; k < size; k += 2) {
        if (k === i) continue;
        const c = slots[k], d = slots[k + 1];
        if (d && d.groupIndex !== a.groupIndex && (!c || c.groupIndex !== b.groupIndex)) {
          const t = slots[i + 1]; slots[i + 1] = slots[k + 1]; slots[k + 1] = t; break;
        }
      }
    }
  }
  return slots;
}

/**
 * Nasadenie pavúka BEZ SKUPÍN (hrá sa len pavúk). Tu sa oddeľujú kluby:
 * hráči jedného klubu sa rozložia do rôznych sekcií pavúka (osmín, štvrtín),
 * aby sa stretli čo najneskôr.
 */
function placeSeedsByClub(seeds: Seed[]): (Seed | null)[] {
  let size = 1; while (size < seeds.length) size *= 2; size = Math.max(2, size);
  const q = [...seeds].sort((a, b) => a.position - b.position);
  const order = seedOrder(size);
  const slots: (Seed | null)[] = Array(size).fill(null);
  q.forEach((s, i) => { slots[order[i] - 1] = s; });

  // sekcia = blok pavúka danej veľkosti; postupne od najväčších (polovice) po dvojice
  for (let sec = size / 2; sec >= 2; sec /= 2) {
    const sectionOf = (i: number) => Math.floor(i / sec);
    const countIn = (arr: (Seed | null)[], s: number, club: string) =>
      arr.filter((x, i) => !!x && sectionOf(i) === s && x.club === club).length;

    // nasadení hráči (prvých `sec/2`… prakticky prvých 8) sa nepresúvajú
    const protectedSeeds = Math.max(2, size / 8);
    for (let i = 0; i < size; i++) {
      const a = slots[i];
      if (!a || !a.club) continue;
      if (a.position <= protectedSeeds) continue;
      const sa = sectionOf(i);
      if (countIn(slots, sa, a.club) <= 1) continue;

      // nájdi výmenu do sekcie, kde tento klub chýba a nevznikne nový konflikt
      let done = false;
      for (let k = 0; k < size && !done; k++) {
        const b = slots[k];
        const sb = sectionOf(k);
        if (sb === sa) continue;
        if (b && b.position <= protectedSeeds) continue;
        if (countIn(slots, sb, a.club) > 0) continue;
        if (b && b.club && countIn(slots, sa, b.club) > 0) continue;
        slots[i] = b; slots[k] = a; done = true;
      }
    }
  }
  return slots;
}

export function createKnockout(c: Competition, map: Map<string, GenericEntry>): Knockout {
  const ratingOf = (id: string) => map.get(id)?.rating ?? 0;

  // Bez skupín sa hrá len pavúk — nasadzuje sa podľa ratingu a oddeľujú sa kluby.
  if (c.groups.length === 0) {
    const ids = c.qualification ? qualifiedForGroups(c.qualification) : c.entryIds;
    const seeds: Seed[] = [...ids]
      .sort((a, b) => ratingOf(b) - ratingOf(a) || (map.get(a)?.name ?? '').localeCompare(map.get(b)?.name ?? '', 'sk'))
      .map((id, i) => ({ id, groupIndex: -1, position: i + 1, club: (map.get(id)?.club || '').trim().toLowerCase() }));
    const main = seeds.length >= 2 ? bracketFromSeeds(placeSeedsByClub(seeds), c.bestOf, c.thirdPlace) : [];
    return { main, consolation: [] };
  }

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
  const isEmpty = (m?: Match) => !m || (!m.playerAId && !m.playerBId);
  const wasPlayed = (m: Match) => !!m.specialResult || m.sets.some(s => s.a !== null || s.b !== null);

  for (let r = 0; r < main.length - 1; r++) {
    const cur = main[r], next = main[r + 1];
    next.matches.forEach((target, j) => {
      const f1 = cur.matches[2 * j], f2 = cur.matches[2 * j + 1];
      const w1 = f1?.winnerId ?? null, w2 = f2?.winnerId ?? null;
      target.playerAId = w1;
      target.playerBId = w2;

      const bothKnown = !!w1 && !!w2;
      // Voľný žreb: protihráč nepríde nikdy, lebo zdrojový zápas nemá hráčov.
      const bye = (!!w1 && isEmpty(f2)) || (!!w2 && isEmpty(f1));

      if (bye && !bothKnown) { target.winnerId = w1 || w2; target.status = 'finished'; return; }

      // Súper ešte nie je známy → zápas sa nesmie tváriť ako dohratý.
      if (!bothKnown) {
        if (!wasPlayed(target)) { target.winnerId = null; target.status = 'scheduled'; }
        return;
      }

      // Obaja známi: ponechaj len skutočne odohratý výsledok medzi nimi.
      if (target.winnerId && (![w1, w2].includes(target.winnerId) || !wasPlayed(target))) {
        target.winnerId = null; target.status = 'scheduled'; target.sets = emptySets(target.sets.length);
      }
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
export type SchedulePhase = 'all' | 'qualification' | 'groups' | 'playoff' | 'ko' | 'stages' | 'teams';

/** Automatický rozpis času a stolov. Plánuje skupiny, play-off skupín aj vyraďovacie pavúky.
 *  Zohľadňuje voľné stoly aj oddych hráča medzi zápasmi; kolá pavúka idú za sebou. */
export function autoSchedule(competitions: Competition[], tables: number, start = '09:00', matchMinutes = 20, restMinutes = 5, phase: SchedulePhase = 'all', entryIndex?: Map<string, string[]>): Competition[] {
  const [h, min] = start.split(':').map(Number);
  const base = (h || 0) * 60 + (min || 0);
  const tableFree = Array(Math.max(1, tables)).fill(base);
  /** obsadenosť sa vedie na FYZICKÝCH hráčov — inak by hráč mohol mať
   *  dvojhru a štvorhru v tom istom čase na dvoch stoloch */
  const busy = new Map<string, number>();
  const copy: Competition[] = structuredClone(competitions);
  const hhmm = (t: number) => `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;

  /** Rozloží ID prihlášky na skutočných hráčov: dvojhra = hráč,
   *  štvorhra = obaja z páru, družstvo = celá zostava, "a+b" = obaja. */
  const physical = (entryId: string | null): string[] => {
    if (!entryId) return [];
    const direct = entryIndex?.get(entryId);
    if (direct && direct.length) return direct;
    if (entryId.includes('+')) return entryId.split('+').filter(Boolean);
    return [entryId];
  };
  const readyAt = (m: Match): number => {
    let t = 0;
    for (const id of [...physical(m.playerAId), ...physical(m.playerBId)]) t = Math.max(t, busy.get(id) ?? 0);
    return t;
  };

  const place = (m: Match, notBefore: number): number => {
    const playersReady = readyAt(m);
    let bestTable = 0, bestStart = Infinity;
    for (let t = 0; t < tableFree.length; t++) {
      const ready = Math.max(tableFree[t], notBefore, playersReady);
      if (ready < bestStart) { bestStart = ready; bestTable = t; }
    }
    m.table = bestTable + 1;
    m.scheduledTime = hhmm(bestStart);
    const end = bestStart + matchMinutes;
    tableFree[bestTable] = end;
    for (const id of [...physical(m.playerAId), ...physical(m.playerBId)]) busy.set(id, end + restMinutes);
    return end;
  };
  const clear = (m: Match) => { m.table = undefined; m.scheduledTime = undefined; };

  const doQual = phase === 'all' || phase === 'qualification';
  const doGroups = phase === 'all' || phase === 'groups';
  const doPlayoff = phase === 'all' || phase === 'playoff';
  const doKo = phase === 'all' || phase === 'ko';
  const doStages = phase === 'all' || phase === 'stages';
  const doTeams = phase === 'all' || phase === 'teams';

  let floor = base;
  // ak sa niektorá fáza nepreplánováva, nadviaž na už naplánované zápasy
  const existing = competitions.flatMap(c => [
    ...(doGroups ? [] : c.groups.flatMap(g => g.matches)),
    ...(doPlayoff ? [] : c.groups.flatMap(g => g.playoff ? [g.playoff.final, ...(g.playoff.third ? [g.playoff.third] : [])] : [])),
  ]).map(m => m.scheduledTime).filter(Boolean) as string[];
  existing.forEach(t => { const [a, b] = t.split(':').map(Number); floor = Math.max(floor, a * 60 + b + matchMinutes); });
  if (doQual) {
    // kvalifikačné vetvy sa hrajú ako prvé, kolo po kole naprieč všetkými vetvami
    for (const c of copy) {
      const q = c.qualification;
      if (!q) continue;
      const depth = Math.max(0, ...q.brackets.map(b => b.rounds.filter(r => r.kind !== 'third').length));
      let roundFloor = base;
      for (let ri = 0; ri < depth; ri++) {
        let end = roundFloor;
        for (const b of q.brackets) {
          const r = b.rounds.filter(x => x.kind !== 'third')[ri];
          if (!r) continue;
          for (const m of r.matches) {
            if (!m.playerAId || !m.playerBId) { clear(m); continue; }
            end = Math.max(end, place(m, roundFloor));
          }
        }
        roundFloor = end;
      }
      floor = Math.max(floor, roundFloor);
    }
  }
  if (doGroups) {
    const all = copy.flatMap(c => c.groups.flatMap(g => g.matches.map(m => ({ m })))).sort((a, b) => a.m.round - b.m.round);
    for (const { m } of all) { if (!m.playerAId || !m.playerBId) { clear(m); continue; } floor = Math.max(floor, place(m, base)); }
  }
  if (doGroups) {
    const fin = copy.flatMap(c => (c.finalGroup ? c.finalGroup.matches : [])).sort((a, b) => a.round - b.round);
    for (const m of fin) { if (!m.playerAId || !m.playerBId) { clear(m); continue; } floor = Math.max(floor, place(m, floor)); }
  }
  if (doPlayoff) {
    const pos = copy.flatMap(c => c.groups.flatMap(g => g.playoff ? [g.playoff.final, ...(g.playoff.third ? [g.playoff.third] : [])] : []));
    for (const m of pos) { if (!m.playerAId || !m.playerBId) { clear(m); continue; } floor = Math.max(floor, place(m, floor)); }
  }
  if (doKo) {
    for (const c of copy) {
      for (const side of ['main', 'consolation'] as const) {
        let roundFloor = floor;
        for (const r of c.ko[side]) {
          let end = roundFloor;
          for (const m of r.matches) end = Math.max(end, place(m, roundFloor));
          roundFloor = end;
        }
      }
    }
  }
  if (doStages) {
    // fázy sa plánujú v poradí závislostí — čo z čoho vychádza
    for (const c of copy) {
      const stages = c.stagePlan?.stages ?? [];
      if (!stages.length) continue;
      const depthOf = new Map<string, number>();
      const walk = (id: string, guard = 0): number => {
        if (depthOf.has(id)) return depthOf.get(id)!;
        if (guard > stages.length) return 0;            // poistka proti cyklu
        const st = stages.find(x => x.id === id);
        const d = st && st.source.from === 'stage' ? walk(st.source.stageId, guard + 1) + 1 : 0;
        depthOf.set(id, d);
        return d;
      };
      stages.forEach(st => walk(st.id));
      const ordered = [...stages].sort((a, b) => (depthOf.get(a.id) ?? 0) - (depthOf.get(b.id) ?? 0));

      let stageFloor = floor;
      for (const st of ordered) {
        let end = stageFloor;
        if (st.kind === 'groups') {
          const ms = (st.groups ?? []).flatMap(g => g.matches).sort((a, b) => a.round - b.round);
          for (const m of ms) {
            if (!m.playerAId || !m.playerBId) { clear(m); continue; }
            end = Math.max(end, place(m, stageFloor));
          }
        } else {
          let roundFloor = stageFloor;
          for (const r of st.rounds ?? []) {
            let rEnd = roundFloor;
            for (const m of r.matches) {
              if (!m.playerAId || !m.playerBId) { clear(m); continue; }
              rEnd = Math.max(rEnd, place(m, roundFloor));
            }
            roundFloor = rEnd;
          }
          end = Math.max(end, roundFloor);
        }
        stageFloor = end;
        floor = Math.max(floor, end);
      }
    }
  }
  if (doTeams) {
    // družstevné stretnutie: jeho jednotlivé zápasy idú za sebou v poradí systému
    for (const c of copy) {
      for (const tie of c.teamTies) {
        let tieFloor = floor;
        for (const rb of [...tie.rubbers].sort((a, b) => a.order - b.order)) {
          const m = rb.match;
          if (!m.playerAId || !m.playerBId) { clear(m); continue; }
          tieFloor = Math.max(tieFloor, place(m, tieFloor));
        }
        floor = Math.max(floor, tieFloor);
      }
    }
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

  // Finálová skupina (ak sa hrá) určuje konečné poradie na čele.
  if (c.finalGroup && c.finalGroup.entryIds.length) {
    standings(c.finalGroup, map).forEach(r => put(r.entry.id, r.position, String(r.position)));
  }

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


/** Finálová skupina — z postupujúcich zo základných skupín sa vytvorí
 *  jedna skupina každý s každým, ktorá určí konečné poradie. */
export function createFinalGroup(c: Competition, map: Map<string, GenericEntry>, bestOf?: number): TournamentGroup {
  const qual: string[] = [];
  c.groups.forEach(g => standings(g, map).filter(r => r.qualified).forEach(r => qual.push(r.entry.id)));
  const ids = qual.length ? qual : c.entryIds.slice();
  const bo = (bestOf ?? c.bestOf) as 3 | 5 | 7;
  return { id: uid(), name: 'Finálová skupina', entryIds: ids, matches: generateRoundRobin(ids, bo), qualifiers: 0, bestOf: bo };
}

// ============================================================
// KVALIFIKÁCIA — reťazenie fáz: kvalifikácia → skupiny → pavúk + útecha
// Hrá sa toľko samostatných vetiev, koľko je voľných miest v skupinách.
// Víťaz každej vetvy postupuje. Nasadení idú do skupín priamo.
// ============================================================

/** Vytvorí kvalifikáciu: najlepší podľa ratingu idú priamo, zvyšok hrá o `slots` miest. */
export function createQualification(
  entryIds: string[],
  map: Map<string, GenericEntry>,
  directCount: number,
  slots: number,
  bestOf: 3 | 5 | 7 = 5,
): QualificationStage {
  const ratingOf = (id: string) => map.get(id)?.rating ?? 0;
  const sorted = [...entryIds].sort((a, b) => ratingOf(b) - ratingOf(a)
    || (map.get(a)?.name ?? '').localeCompare(map.get(b)?.name ?? '', 'sk'));

  const direct = Math.max(0, Math.min(directCount, sorted.length));
  const directIds = sorted.slice(0, direct);
  const rest = sorted.slice(direct);
  const n = Math.max(1, Math.min(slots, rest.length));

  // rozdelenie zvyšku do n vetiev — hadovo a s oddelením klubov
  const buckets: string[][] = Array.from({ length: n }, () => []);
  const bClubs: Map<string, number>[] = Array.from({ length: n }, () => new Map());
  const affOf = (id: string) => (map.get(id)?.club || '').trim().toLowerCase();
  const cap = Math.ceil(rest.length / n);
  const pool = [...rest];
  let band = 0;
  while (pool.length) {
    const order = Array.from({ length: n }, (_, i) => (band % 2 === 0 ? i : n - 1 - i))
      .filter(i => buckets[i].length < cap);
    if (!order.length) break;
    for (const i of order) {
      if (!pool.length) break;
      let pick = pool.findIndex(id => { const a = affOf(id); return !a || !bClubs[i].has(a); });
      if (pick === -1) {
        let best = 0, bestCount = Infinity;
        pool.forEach((id, k) => { const c = bClubs[i].get(affOf(id)) ?? 0; if (c < bestCount) { bestCount = c; best = k; } });
        pick = best;
      }
      const id = pool.splice(pick, 1)[0];
      buckets[i].push(id);
      const a = affOf(id); if (a) bClubs[i].set(a, (bClubs[i].get(a) ?? 0) + 1);
    }
    band++;
  }

  const brackets: QualBracket[] = buckets.map((ids, i) => {
    const seeds: Seed[] = ids.map((id, k) => ({ id, groupIndex: i, position: k + 1 }));
    return {
      id: uid(),
      name: `Kvalifikácia ${i + 1}`,
      rounds: seeds.length >= 2
        ? bracketFromSeeds(placeSeeds(seeds), bestOf, false)
            .map((r, k, all) => ({ ...r, name: k === all.length - 1 ? 'O postup' : `${k + 1}. kolo` }))
        : [],
    };
  });

  return { slots: n, bestOf, directIds, brackets };
}

/** Posunie víťazov vo všetkých vetvách kvalifikácie. */
export function advanceQualification(q: QualificationStage): QualificationStage {
  return { ...q, brackets: q.brackets.map(b => ({ ...b, rounds: advanceKnockout(b.rounds) })) };
}

/** Víťaz každej vetvy, alebo null ak sa ešte dohráva. */
export function qualificationWinners(q: QualificationStage): (string | null)[] {
  return q.brackets.map(bracketWinner);
}

/** Víťaz vetvy — až keď je dohratý každý zápas s dvoma hráčmi. */
function bracketWinner(b: QualBracket): string | null {
  const rounds = b.rounds.filter(r => r.kind !== 'third');
  if (!rounds.length) return null;
  const entrants = new Set<string>();
  rounds[0].matches.forEach(m => { if (m.playerAId) entrants.add(m.playerAId); if (m.playerBId) entrants.add(m.playerBId); });
  if (entrants.size <= 1) return [...entrants][0] ?? null;
  for (const r of rounds) for (const m of r.matches) {
    if (m.playerAId && m.playerBId && !m.winnerId) return null;
  }
  return rounds.at(-1)?.matches[0]?.winnerId ?? null;
}

/** Je kvalifikácia dohratá vo všetkých vetvách? */
export const qualificationDone = (q: QualificationStage): boolean =>
  qualificationWinners(q).every(w => w !== null);

/** Zoznam tých, čo idú do skupín: nasadení priamo + víťazi kvalifikácie. */
export function qualifiedForGroups(q: QualificationStage): string[] {
  return [...q.directIds, ...qualificationWinners(q).filter((w): w is string => !!w)];
}

/**
 * Všeobecná stavba pavúka z ľubovoľného zoznamu účastníkov.
 * `mode='groups'` — nasadenie podľa umiestnenia v skupinách (A1/A2 do opačných polovíc),
 * `mode='rating'` — nasadenie podľa ratingu s oddelením klubov (hrá sa len pavúk).
 */
export function buildBracket(
  seedsIn: { id: string; groupIndex: number; position: number; club?: string }[],
  bestOf: 3 | 5 | 7,
  thirdPlace: boolean,
  mode: 'groups' | 'rating',
): KnockoutRound[] {
  if (seedsIn.length < 2) return [];
  const seeds = seedsIn.map(s => ({ ...s, club: (s.club || '').trim().toLowerCase() }));
  return bracketFromSeeds(mode === 'rating' ? placeSeedsByClub(seeds) : placeSeeds(seeds), bestOf, thirdPlace);
}

/** Konečné poradie v pavúku: víťaz, finalista, o 3. miesto, potom podľa kola vypadnutia. */
export function bracketRanking(rounds: KnockoutRound[], map: Map<string, GenericEntry>): string[] {
  const main = rounds.filter(r => r.kind !== 'third');
  if (!main.length) return [];
  const out: string[] = [];
  const push = (id: string | null) => { if (id && !out.includes(id)) out.push(id); };

  const final = main[main.length - 1].matches[0];
  push(final?.winnerId ?? null);
  if (final?.winnerId) push(final.playerAId === final.winnerId ? final.playerBId : final.playerAId);

  const third = rounds.find(r => r.kind === 'third')?.matches[0];
  if (third?.winnerId) {
    push(third.winnerId);
    push(third.playerAId === third.winnerId ? third.playerBId : third.playerAId);
  }

  // ostatní podľa kola, v ktorom vypadli (neskôr = lepšie), v rámci kola podľa nasadenia
  for (let ri = main.length - 1; ri >= 0; ri--) {
    const losers: string[] = [];
    main[ri].matches.forEach(m => {
      if (!m.winnerId) return;
      const loser = m.playerAId === m.winnerId ? m.playerBId : m.playerAId;
      if (loser) losers.push(loser);
    });
    losers.sort((a, b) => (map.get(b)?.rating ?? 0) - (map.get(a)?.rating ?? 0));
    losers.forEach(push);
  }
  return out;
}

/** Kolízie v harmonograme: ten istý fyzický hráč má dva zápasy v prekrývajúcom sa čase. */
export function scheduleConflicts(
  competitions: Competition[],
  entryIndex: Map<string, string[]>,
  matchMinutes = 20,
): { playerId: string; time: string; a: string; b: string }[] {
  const mins = (t?: string) => { if (!t) return null; const [x, y] = t.split(':').map(Number); return x * 60 + y; };
  const physical = (id: string | null): string[] => {
    if (!id) return [];
    const d = entryIndex.get(id);
    if (d && d.length) return d;
    return id.includes('+') ? id.split('+').filter(Boolean) : [id];
  };

  type Slot = { start: number; label: string; players: string[] };
  const slots: Slot[] = [];
  const add = (m: Match, label: string) => {
    const st = mins(m.scheduledTime);
    if (st === null) return;
    slots.push({ start: st, label, players: [...physical(m.playerAId), ...physical(m.playerBId)] });
  };

  competitions.forEach(c => {
    c.groups.forEach(g => {
      g.matches.forEach(m => add(m, `${c.name} · ${g.name}`));
      if (g.playoff) { add(g.playoff.final, `${c.name} · ${g.name} play-off`); if (g.playoff.third) add(g.playoff.third, `${c.name} · ${g.name} play-off`); }
    });
    c.finalGroup?.matches.forEach(m => add(m, `${c.name} · finálová skupina`));
    (['main', 'consolation'] as const).forEach(side => c.ko[side].forEach(r => r.matches.forEach(m => add(m, `${c.name} · ${r.name}`))));
    c.qualification?.brackets.forEach(b => b.rounds.forEach(r => r.matches.forEach(m => add(m, `${c.name} · ${b.name}`))));
    c.stagePlan?.stages.forEach(st => {
      st.groups?.forEach(g => g.matches.forEach(m => add(m, `${c.name} · ${st.name} · ${g.name}`)));
      st.rounds?.forEach(r => r.matches.forEach(m => add(m, `${c.name} · ${st.name} · ${r.name}`)));
    });
    c.teamTies.forEach(t => t.rubbers.forEach(rb => add(rb.match, `${c.name} · stretnutie`)));
  });

  const hhmm = (t: number) => `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  const out: { playerId: string; time: string; a: string; b: string }[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const overlap = Math.abs(slots[i].start - slots[j].start) < matchMinutes;
      if (!overlap) continue;
      for (const p of slots[i].players) {
        if (!slots[j].players.includes(p)) continue;
        const key = `${p}|${slots[i].start}|${slots[j].start}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ playerId: p, time: hhmm(Math.min(slots[i].start, slots[j].start)), a: slots[i].label, b: slots[j].label });
      }
    }
  }
  return out;
}

