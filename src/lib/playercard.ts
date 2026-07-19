import { entryMap, matchSummary } from './multisport';
export { GROUP_LETTERS, groupLabel, groupName } from './labels';
import type { Competition, Match, PairEntry, Player, TeamEntry, TournamentState } from '../types';

/**
 * Označovanie skupín a prehľad zápasov hráča.
 *
 * Pôvodný kód pomenúval skupiny cez String.fromCharCode(65 + i), takže po
 * skupine Z nasledovali znaky „[", „\" a „]". Pri 460 hráčoch (115 skupín)
 * to bol nepoužiteľný rozpis.
 */

export type PlayerMatchRow = {
  competition: string;
  phase: string;
  entryId: string;
  m: Match;
  /** Poradie pre triedenie: súťaž, potom stupeň turnaja. */
  order: number;
};

const PHASE_ORDER = {
  qualification: 0, groups: 1, playoff: 2, finalGroup: 3, stage: 4, ko: 5, consolation: 6, teams: 7,
} as const;

/**
 * Všetky zápasy jedného hráča naprieč VŠETKÝMI súťažami a stupňami.
 *
 * Hráč môže v jednej súťaži vystupovať pod vlastným id (dvojhra), ako súčasť
 * páru (štvorhra, mix) alebo ako člen družstva — preto sa najprv zistí, pod
 * ktorými prihláškami v danej súťaži figuruje.
 */
export function playerMatches(state: TournamentState, id: string): PlayerMatchRow[] {
  const rows: PlayerMatchRow[] = [];
  // Kliknúť sa dá na hráča, ale aj na pár alebo družstvo. Pri hráčovi chceme
  // všetko, čo odohral (aj v štvorhre a v družstve). Pri páre či družstve
  // chceme zápasy práve tejto prihlášky.
  const isPlayer = state.players.some(p => p.id === id);
  const playerId = id;

  state.competitions.forEach((c, ci) => {
    const map = entryMap(c, state.players, state.pairs, state.teams);
    const mine = new Set<string>();
    map.forEach((e, eid) => {
      const members = e.memberIds?.length ? e.memberIds : [eid];
      if (eid === id || (isPlayer && members.includes(id))) mine.add(eid);
    });
    if (!mine.size && !(!isPlayer && c.teamTies.some(t => t.homeTeamId === id || t.awayTeamId === id))) return;

    const base = ci * 100;
    const take = (m: Match, phase: string, kind: keyof typeof PHASE_ORDER) => {
      const side = m.playerAId && mine.has(m.playerAId) ? m.playerAId
        : m.playerBId && mine.has(m.playerBId) ? m.playerBId : null;
      if (!side) return;
      rows.push({ competition: c.name, phase, entryId: side, m, order: base + PHASE_ORDER[kind] });
    };

    // kvalifikácia
    c.qualification?.brackets.forEach(b => b.rounds.forEach(r =>
      r.matches.forEach(m => take(m, `Kvalifikácia · ${b.name} · ${r.name}`, 'qualification'))));

    // základné skupiny + ich play-off (chýbalo)
    c.groups.forEach(g => {
      g.matches.forEach(m => take(m, g.name, 'groups'));
      if (g.playoff) {
        take(g.playoff.final, `${g.name} · play-off o 1. miesto`, 'playoff');
        if (g.playoff.third) take(g.playoff.third, `${g.name} · play-off o 3. miesto`, 'playoff');
      }
    });

    // finálová skupina (chýbala)
    c.finalGroup?.matches.forEach(m => take(m, 'Finálová skupina', 'finalGroup'));

    // reťaz fáz (chýbala)
    c.stagePlan?.stages.forEach(st => {
      st.groups?.forEach(g => g.matches.forEach(m => take(m, `${st.name} · ${g.name}`, 'stage')));
      st.rounds?.forEach(r => r.matches.forEach(m =>
        take(m, `${st.name} · ${r.name}`, st.consolation ? 'consolation' : 'stage')));
    });

    // pavúk a útecha
    c.ko.main.forEach(r => r.matches.forEach(m => take(m, r.name, 'ko')));
    c.ko.consolation.forEach(r => r.matches.forEach(m => take(m, `Útecha · ${r.name}`, 'consolation')));

    // družstvá (chýbali) — v stretnutí vystupuje hráč priamo, nie cez prihlášku
    // družstva, a pri štvorhre je v zápase dvojica, takže hľadáme v súpiskách
    const teamName = (id: string) => state.teams.find(t => t.id === id)?.name ?? '';
    c.teamTies.forEach(tie => tie.rubbers.forEach(rb => {
      const doma = isPlayer ? rb.homePlayerIds.includes(playerId) : tie.homeTeamId === id;
      const vonku = isPlayer ? rb.awayPlayerIds.includes(playerId) : tie.awayTeamId === id;
      if (!doma && !vonku) return;
      const side = doma ? rb.match.playerAId : rb.match.playerBId;
      rows.push({
        competition: c.name,
        phase: `Družstvá · ${teamName(tie.homeTeamId)} – ${teamName(tie.awayTeamId)} · ${rb.label}`,
        entryId: side ?? playerId, m: rb.match, order: base + PHASE_ORDER.teams,
      });
    }));
  });

  return rows.sort((a, b) => a.order - b.order);
}

/** Súhrn hráča z jeho zápasov — výhry, prehry, sety a loptičky. */
export function playerTotals(rows: PlayerMatchRow[]) {
  let wins = 0, losses = 0, setsFor = 0, setsAgainst = 0, ptsFor = 0, ptsAgainst = 0;
  rows.forEach(({ m, entryId }) => {
    if (!m.winnerId) return;
    const isA = m.playerAId === entryId;
    const s = matchSummary(m);
    if (m.winnerId === entryId) wins++; else losses++;
    setsFor += isA ? s.sa : s.sb;
    setsAgainst += isA ? s.sb : s.sa;
    ptsFor += isA ? s.pa : s.pb;
    ptsAgainst += isA ? s.pb : s.pa;
  });
  return { wins, losses, setsFor, setsAgainst, ptsFor, ptsAgainst, played: wins + losses, total: rows.length };
}

/** Zoznam súťaží, v ktorých hráč figuruje. */
export function playerCompetitions(state: TournamentState, playerId: string): string[] {
  const out: string[] = [];
  state.competitions.forEach(c => {
    const map = entryMap(c, state.players, state.pairs, state.teams);
    let found = false;
    map.forEach((e, id) => {
      const members = e.memberIds?.length ? e.memberIds : [id];
      if (id === playerId || members.includes(playerId)) found = true;
    });
    if (found) out.push(c.name);
  });
  return out;
}

export type { Competition, Match, PairEntry, Player, TeamEntry };
