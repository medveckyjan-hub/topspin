import { entryMap, finalOrder, groupRounds, scoreText, standings } from './multisport';
import type { Competition, GenericEntry, Match, TournamentState } from '../types';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

const CSS = `
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #111; margin: 0; font-size: 11pt; }
  header.doc { display: flex; justify-content: space-between; align-items: flex-start;
    border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 14px; }
  header.doc h1 { font-size: 15pt; margin: 0 0 2px; }
  header.doc p { margin: 0; font-size: 9pt; color: #555; }
  header.doc .doc-kind { font-size: 9pt; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; }
  h2 { font-size: 12pt; margin: 16px 0 6px; border-bottom: 1px solid #bbb; padding-bottom: 3px; }
  h3 { font-size: 10.5pt; margin: 12px 0 5px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th, td { border: 1px solid #999; padding: 4px 6px; font-size: 9.5pt; text-align: center; }
  th { background: #eee; font-size: 8.5pt; text-transform: uppercase; }
  td.l, th.l { text-align: left; }
  td.club { font-size: 8pt; color: #555; }
  .muted { color: #666; font-size: 9pt; }
  .blank { height: 22px; }
  .sheet { border: 1px solid #999; padding: 8px 10px; margin-bottom: 10px; page-break-inside: avoid; }
  .sheet-head { display: flex; justify-content: space-between; font-size: 8.5pt; color: #555; margin-bottom: 6px; }
  .sheet-names { display: flex; justify-content: space-between; align-items: center; gap: 10px; font-size: 11pt; font-weight: 700; }
  .sets { display: flex; gap: 6px; margin-top: 8px; }
  .sets div { flex: 1; border: 1px solid #999; height: 40px; position: relative; }
  .sets span { position: absolute; top: 1px; left: 3px; font-size: 7pt; color: #777; }
  .sig { display: flex; justify-content: space-between; margin-top: 26px; font-size: 8.5pt; color: #555; }
  .sig div { border-top: 1px solid #999; width: 30%; text-align: center; padding-top: 3px; }
  .brk { display: flex; gap: 14px; page-break-inside: avoid; }
  .brk-col { flex: 1; }
  .brk-col h4 { font-size: 8.5pt; text-transform: uppercase; color: #666; margin: 0 0 6px; }
  .brk-m { border: 1px solid #999; margin-bottom: 12px; }
  .brk-r { display: flex; justify-content: space-between; padding: 4px 6px; font-size: 9.5pt; }
  .brk-r + .brk-r { border-top: 1px solid #ccc; }
  .brk-r b { font-variant-numeric: tabular-nums; }
  .pb { page-break-before: always; }
  @media print { .noprint { display: none; } }
  .noprint { margin-bottom: 14px; }
  .noprint button { font: inherit; padding: 8px 16px; border: 1px solid #999; background: #f4f4f4; border-radius: 6px; cursor: pointer; }
`;

function openDoc(title: string, kind: string, state: TournamentState, body: string) {
  const s = state.settings;
  const html = `<!doctype html><html lang="sk"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head>
  <body>
    <div class="noprint"><button onclick="window.print()">Tlačiť / uložiť ako PDF</button></div>
    <header class="doc">
      <div><h1>${esc(s.name)}</h1><p>${esc(s.date)}${s.venue ? ' · ' + esc(s.venue) : ''}</p></div>
      <div class="doc-kind">${esc(kind)}</div>
    </header>
    ${body}
  </body></html>`;
  const w = window.open('', '_blank');
  if (!w) { alert('Prehliadač zablokoval nové okno. Povoľ vyskakovacie okná pre túto stránku.'); return; }
  w.document.write(html);
  w.document.close();
}

const nameOf = (em: Map<string, GenericEntry>, id: string | null) => (id ? em.get(id)?.name || '—' : '—');
const clubOf = (em: Map<string, GenericEntry>, id: string | null) => (id ? em.get(id)?.club || '' : '');

/** Žreb: rozpis skupín s prázdnymi zápasmi na zapisovanie rukou. */
export function printDraw(state: TournamentState) {
  const body = state.competitions.filter(c => c.groups.length).map(c => {
    const em = entryMap(c, state.players, state.pairs, state.teams);
    const groups = c.groups.map(g => {
      const rows = g.entryIds.map((id, i) =>
        `<tr><td>${i + 1}</td><td class="l">${esc(nameOf(em, id))}</td><td class="l club">${esc(clubOf(em, id))}</td></tr>`).join('');
      const matches = g.matches.slice().sort((a, b) => a.round - b.round).map(m => {
        const ia = g.entryIds.indexOf(m.playerAId || '') + 1, ib = g.entryIds.indexOf(m.playerBId || '') + 1;
        return `<tr><td>${m.round}.</td><td>${ia} – ${ib}</td><td class="l">${esc(nameOf(em, m.playerAId))}</td>
          <td class="l">${esc(nameOf(em, m.playerBId))}</td><td>${m.table ?? ''}</td><td>${esc(m.scheduledTime ?? '')}</td>
          <td class="blank"></td></tr>`;
      }).join('');
      return `<h3>${esc(g.name)} — postupujú: ${g.qualifiers}</h3>
        <table><thead><tr><th>#</th><th class="l">Hráč</th><th class="l">Klub</th></tr></thead><tbody>${rows}</tbody></table>
        <table><thead><tr><th>Kolo</th><th>Zápas</th><th class="l">Hráč A</th><th class="l">Hráč B</th><th>Stôl</th><th>Čas</th><th>Výsledok</th></tr></thead><tbody>${matches}</tbody></table>`;
    }).join('');
    return `<h2>${esc(c.name)}</h2>${groups}`;
  }).join('<div class="pb"></div>');
  openDoc('Žreb', 'Žreb a rozpis skupín', state, body || '<p class="muted">Žiadne skupiny.</p>');
}

/** Tabuľky skupín s aktuálnymi výsledkami. */
export function printStandings(state: TournamentState) {
  const body = state.competitions.filter(c => c.groups.length || c.finalGroup).map(c => {
    const em = entryMap(c, state.players, state.pairs, state.teams);
    const tbl = (g: NonNullable<Competition['finalGroup']>) => {
      const st = standings(g, em);
      const rows = st.map(r => `<tr><td>${r.position}</td><td class="l">${esc(r.entry.name)}</td>
        <td class="l club">${esc(r.entry.club)}</td><td>${r.played}</td><td>${r.wins}</td><td>${r.losses}</td>
        <td><b>${r.matchPoints}</b></td><td>${r.setsFor}:${r.setsAgainst}</td><td>${r.pointsFor}:${r.pointsAgainst}</td></tr>`).join('');
      return `<h3>${esc(g.name)}</h3><table><thead><tr><th>#</th><th class="l">Hráč</th><th class="l">Klub</th>
        <th>Z</th><th>V</th><th>P</th><th>B</th><th>Sety</th><th>Loptičky</th></tr></thead><tbody>${rows}</tbody></table>`;
    };
    return `<h2>${esc(c.name)}</h2>${c.finalGroup ? tbl(c.finalGroup) : ''}${c.groups.map(tbl).join('')}`;
  }).join('');
  openDoc('Tabuľky', 'Tabuľky skupín', state, body || '<p class="muted">Žiadne skupiny.</p>');
}

/** Pavúk na tlač — kolá vedľa seba. */
export function printBracket(state: TournamentState) {
  const body = state.competitions.filter(c => c.ko.main.length).map(c => {
    const em = entryMap(c, state.players, state.pairs, state.teams);
    const cols = c.ko.main.map(r => {
      const ms = r.matches.map(m => {
        const sc = m.winnerId ? scoreText(m).split(':') : ['', ''];
        return `<div class="brk-m">
          <div class="brk-r"><span>${esc(nameOf(em, m.playerAId))}</span><b>${esc(sc[0])}</b></div>
          <div class="brk-r"><span>${esc(nameOf(em, m.playerBId))}</span><b>${esc(sc[1])}</b></div></div>`;
      }).join('');
      return `<div class="brk-col"><h4>${esc(r.name)}</h4>${ms}</div>`;
    }).join('');
    return `<h2>${esc(c.name)} — pavúk</h2><div class="brk">${cols}</div>`;
  }).join('<div class="pb"></div>');
  openDoc('Pavúk', 'Vyraďovací pavúk', state, body || '<p class="muted">Žiadny pavúk.</p>');
}

/** Časový harmonogram po fázach. */
export function printSchedule(state: TournamentState) {
  type R = { comp: string; kind: string; phase: string; m: Match; em: Map<string, GenericEntry> };
  const rows: R[] = state.competitions.flatMap(c => {
    const em = entryMap(c, state.players, state.pairs, state.teams);
    return [
      ...c.groups.flatMap(g => g.matches.map(m => ({ comp: c.name, kind: 'Skupiny', phase: g.name, m, em }))),
      ...(c.finalGroup ? c.finalGroup.matches.map(m => ({ comp: c.name, kind: 'Finálová skupina', phase: c.finalGroup!.name, m, em })) : []),
      ...c.groups.flatMap(g => g.playoff ? [{ comp: c.name, kind: 'Play-off', phase: `${g.name} · o 1.`, m: g.playoff.final, em },
        ...(g.playoff.third ? [{ comp: c.name, kind: 'Play-off', phase: `${g.name} · o 3.`, m: g.playoff.third, em }] : [])] : []),
      ...c.ko.main.flatMap(r => r.matches.map(m => ({ comp: c.name, kind: 'Pavúk', phase: r.name, m, em }))),
    ];
  }).filter(x => x.m.scheduledTime).sort((a, b) => (a.m.scheduledTime || '').localeCompare(b.m.scheduledTime || '') || (a.m.table ?? 0) - (b.m.table ?? 0));

  const phases = ['Skupiny', 'Finálová skupina', 'Play-off', 'Pavúk'].filter(p => rows.some(r => r.kind === p));
  const body = phases.map(p => {
    const tr = rows.filter(r => r.kind === p).map(r => `<tr><td><b>${esc(r.m.scheduledTime)}</b></td><td>${r.m.table ?? '—'}</td>
      <td class="l">${esc(r.comp)}</td><td class="l">${esc(r.phase)}</td>
      <td class="l">${esc(nameOf(r.em, r.m.playerAId))} – ${esc(nameOf(r.em, r.m.playerBId))}</td>
      <td>${r.m.winnerId ? esc(scoreText(r.m)) : ''}</td></tr>`).join('');
    return `<h2>${esc(p)}</h2><table><thead><tr><th>Čas</th><th>Stôl</th><th class="l">Súťaž</th><th class="l">Fáza</th>
      <th class="l">Zápas</th><th>Výsledok</th></tr></thead><tbody>${tr}</tbody></table>`;
  }).join('');
  openDoc('Harmonogram', 'Časový harmonogram', state, body || '<p class="muted">Harmonogram nie je vytvorený.</p>');
}

/** Súpiska účastníkov po súťažiach. */
export function printEntries(state: TournamentState) {
  const body = state.competitions.filter(c => c.entryIds.length).map(c => {
    const em = entryMap(c, state.players, state.pairs, state.teams);
    const rows = c.entryIds.map((id, i) => `<tr><td>${i + 1}</td><td class="l">${esc(nameOf(em, id))}</td>
      <td class="l club">${esc(clubOf(em, id))}</td><td class="blank"></td></tr>`).join('');
    return `<h2>${esc(c.name)} — ${c.entryIds.length} účastníkov</h2>
      <table><thead><tr><th>#</th><th class="l">Účastník</th><th class="l">Klub</th><th>Prezentácia</th></tr></thead><tbody>${rows}</tbody></table>`;
  }).join('');
  openDoc('Súpiska', 'Súpiska účastníkov', state, body || '<p class="muted">Žiadni účastníci.</p>');
}

/** Konečné poradie so ziskom bodov. */
export function printFinalOrder(state: TournamentState) {
  const body = state.competitions.map(c => {
    const em = entryMap(c, state.players, state.pairs, state.teams);
    const fo = finalOrder(c, em);
    if (!fo.length) return '';
    const rows = fo.map((r, i) => `<tr><td>${i + 1}</td><td><b>${esc(r.placeLabel)}</b></td>
      <td class="l">${esc(r.entry.name)}</td><td class="l club">${esc(r.entry.club)}</td>
      <td>${esc(c.points?.[r.placeLabel] ?? '')}</td></tr>`).join('');
    return `<h2>${esc(c.name)} — konečné poradie</h2>
      <table><thead><tr><th>#</th><th>Umiestnenie</th><th class="l">Účastník</th><th class="l">Klub</th><th>Body</th></tr></thead><tbody>${rows}</tbody></table>`;
  }).join('');
  openDoc('Konečné poradie', 'Konečné poradie', state, body || '<p class="muted">Poradie zatiaľ nie je známe.</p>');
}

/** Prázdne zápisy o stretnutí pre rozhodcov pri stoloch. */
export function printMatchSheets(state: TournamentState) {
  const sheets: string[] = [];
  state.competitions.forEach(c => {
    const em = entryMap(c, state.players, state.pairs, state.teams);
    const all: { phase: string; m: Match; bestOf: number }[] = [
      ...c.groups.flatMap(g => g.matches.map(m => ({ phase: `${c.name} · ${g.name}`, m, bestOf: g.bestOf }))),
      ...(c.finalGroup ? c.finalGroup.matches.map(m => ({ phase: `${c.name} · ${c.finalGroup!.name}`, m, bestOf: c.finalGroup!.bestOf })) : []),
      ...c.ko.main.flatMap(r => r.matches.map(m => ({ phase: `${c.name} · ${r.name}`, m, bestOf: r.bestOf }))),
    ];
    all.filter(x => x.m.playerAId && x.m.playerBId && !x.m.winnerId).forEach(({ phase, m, bestOf }) => {
      const boxes = Array.from({ length: bestOf }, (_, i) => `<div><span>Set ${i + 1}</span></div>`).join('');
      sheets.push(`<div class="sheet">
        <div class="sheet-head"><span>${esc(phase)}</span><span>${m.table ? 'Stôl ' + m.table : ''} ${esc(m.scheduledTime ?? '')} · best of ${bestOf}</span></div>
        <div class="sheet-names"><span>${esc(nameOf(em, m.playerAId))}<br><small class="muted">${esc(clubOf(em, m.playerAId))}</small></span>
          <span>–</span>
          <span style="text-align:right">${esc(nameOf(em, m.playerBId))}<br><small class="muted">${esc(clubOf(em, m.playerBId))}</small></span></div>
        <div class="sets">${boxes}</div>
        <div class="sig"><div>Víťaz</div><div>Rozhodca</div><div>Podpisy hráčov</div></div>
      </div>`);
    });
  });
  openDoc('Zápisy o stretnutí', 'Zápisy o stretnutí', state, sheets.join('') || '<p class="muted">Žiadne nedohraté zápasy.</p>');
}
