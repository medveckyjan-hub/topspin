import { useMemo, useState, useEffect, useRef } from 'react';
import { Menu, Plus, Trash2, Download, Printer, Shuffle, ShieldCheck, FileSpreadsheet, X, Wand2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Sidebar } from './components/Sidebar';
import { EntryCard } from './components/EntryCard';
import {
  TEAM_SYSTEMS, applySubstitution, autoSchedule, buildTeamTie, canMovePlayer, createGroups, createKnockout,
  advanceKnockout as advance, entryMap, groupRounds, movePlayer, normalizeMatch, resizeSets, scoreTeamTie, scoreText, setsText, setsToWin, setGroupBestOf, setRoundBestOf, standings, uid, validateMatch,
} from './lib/multisport';
import type {
  Competition, CompetitionType, Knockout, Match, Player, TeamSystemId, TeamTie, TournamentGroup, TournamentState, View,
} from './types';
import './styles.css';

export const emptyTournament = (name: string): TournamentState => ({
  version: 5,
  settings: { name: name || 'Turnaj', date: new Date().toISOString().slice(0, 10), venue: '', tables: 8, matchMinutes: 25, restMinutes: 15 },
  players: [], pairs: [], teams: [], competitions: [],
});

type Detail =
  | { kind: 'group'; compId: string; groupId: string; matchId: string }
  | { kind: 'ko'; compId: string; side: 'main' | 'consolation'; roundIdx: number; matchId: string }
  | { kind: 'team'; compId: string; tieId: string; rubberId: string };

export function TournamentEditor({ initial, onSave, banner, onDelete }: { initial: TournamentState; onSave: (s: TournamentState) => void; banner?: React.ReactNode; onDelete?: () => void }) {
  const [state, setState] = useState<TournamentState>(initial);
  const [view, setView] = useState<View>('dashboard');
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [detail, setDetail] = useState<Detail | null>(null);
  const [card, setCard] = useState<{ compId: string; entryId: string; name: string } | null>(null);
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } onSave(state); }, [state]);

  const pmap = useMemo(() => new Map(state.players.map(p => [p.id, p])), [state.players]);
  const allGroups = state.competitions.reduce((s, c) => s + c.groups.length, 0);

  const label = (id: string | null): string => {
    if (!id) return '—';
    if (id.includes('+')) return id.split('+').map(x => pmap.get(x)?.name || '?').join(' / ');
    return pmap.get(id)?.name || state.pairs.find(x => x.id === id)?.name || state.teams.find(x => x.id === id)?.name || '—';
  };
  const clubOf = (id: string | null): string => {
    if (!id) return '';
    if (id.includes('+')) return id.split('+').map(x => pmap.get(x)?.club || '').filter(Boolean).join(' / ');
    return pmap.get(id)?.club || state.pairs.find(x => x.id === id)?.club || state.teams.find(x => x.id === id)?.club || '';
  };

  // ---- mutácie ----
  const addPlayer = (name: string, club: string, rating: number, gender: Player['gender']) =>
    setState(s => ({ ...s, players: [...s.players, { id: uid(), name, club, rating, gender }] }));
  const importPlayers = async (file?: File) => {
    if (!file) return;
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
    const add = rows.map(r => ({ id: uid(), name: String(r[0] ?? '').trim(), club: String(r[1] ?? '').trim(), rating: Number(r[2]) || 0, gender: (String(r[3] ?? 'M').trim().toUpperCase().startsWith('F') ? 'F' : 'M') as Player['gender'] }))
      .filter(p => p.name && !/^(meno|name|hráč)$/i.test(p.name));
    if (add.length) { setState(s => ({ ...s, players: [...s.players, ...add] })); setNotice(`Importovaných ${add.length} hráčov.`); }
  };
  const addPair = (a: string, b: string, mixed: boolean) => {
    if (!a || !b || a === b) return;
    const pa = pmap.get(a)!, pb = pmap.get(b)!;
    if (mixed && pa.gender === pb.gender) { setNotice('Mix musí tvoriť hráči rozdielneho pohlavia.'); return; }
    setState(s => ({ ...s, pairs: [...s.pairs, { id: uid(), name: `${pa.name} / ${pb.name}`, playerIds: [a, b], club: pa.club === pb.club ? pa.club : `${pa.club} + ${pb.club}` }] }));
  };
  const addTeam = (name: string, club: string, ids: string[]) => {
    if (ids.length < 2 || ids.length > 4) { setNotice('Družstvo musí mať 2 až 4 hráčov.'); return; }
    setState(s => ({ ...s, teams: [...s.teams, { id: uid(), name, club, playerIds: ids }] }));
  };
  const addCompetition = (name: string, type: CompetitionType, systemId?: TeamSystemId) =>
    setState(s => ({ ...s, competitions: [...s.competitions, { id: uid(), name, type, bestOf: 5, preferredSize: 4, qualifiersPerGroup: 2, thirdPlace: true, consolation: false, entryIds: [], groups: [], ko: { main: [], consolation: [] }, teamSystemId: systemId, teamTies: [] }] }));
  const updateComp = (id: string, fn: (c: Competition) => Competition) => setState(s => ({ ...s, competitions: s.competitions.map(c => c.id === id ? fn(c) : c) }));
  const removeComp = (id: string) => setState(s => ({ ...s, competitions: s.competitions.filter(c => c.id !== id) }));

  const updateGroupMatch = (compId: string, groupId: string, matchId: string, m: Match) =>
    updateComp(compId, c => ({ ...c, groups: c.groups.map(g => g.id === groupId ? { ...g, matches: g.matches.map(x => x.id === matchId ? m : x) } : g) }));
  const updateKoMatch = (compId: string, side: 'main' | 'consolation', roundIdx: number, matchId: string, m: Match) =>
    updateComp(compId, c => {
      const rounds = c.ko[side].map((r, i) => i === roundIdx ? { ...r, matches: r.matches.map(x => x.id === matchId ? m : x) } : r);
      // posun víťazov (advance) — importované cez helper nižšie
      return { ...c, ko: { ...c.ko, [side]: advance(rounds) } };
    });
  const updateTeamRubber = (compId: string, tieId: string, rubberId: string, m: Match, bestOf: number) =>
    updateComp(compId, c => ({ ...c, teamTies: c.teamTies.map(t => t.id === tieId ? scoreTeamTie({ ...t, rubbers: t.rubbers.map(r => r.id === rubberId ? { ...r, match: m } : r) }, bestOf) : t) }));

  const closeDetail = () => setDetail(null);

  const titles: Record<View, string> = { dashboard: 'Prehľad turnaja', players: 'Hráči', entries: 'Páry a družstvá', competitions: 'Súťaže', groups: 'Skupiny', results: 'Výsledky skupín', knockout: 'Vyraďovacie pavúky', schedule: 'Stoly a harmonogram', teams: 'Družstvové zápasy', exports: 'Tlač a export' };

  return (
    <div className="app-layout">
      {notice && <div className="toast" onClick={() => setNotice('')}>{notice}</div>}
      <div className={open ? 'sidebar-backdrop visible' : 'sidebar-backdrop'} onClick={() => setOpen(false)} />
      <div className={open ? 'sidebar-wrap open' : 'sidebar-wrap'}><Sidebar active={view} onChange={v => { setView(v); setOpen(false); }} playerCount={state.players.length} groupCount={allGroups} /></div>
      <main className="content">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setOpen(true)}><Menu /></button>
          <div><h1>{titles[view]}</h1><p>{state.settings.name} · {state.settings.date}{state.settings.venue ? ` · ${state.settings.venue}` : ''}</p></div>
          <div className="status">{banner}<span><ShieldCheck size={15} />Uložené v cloude</span></div>
        </header>
        <div className="content-body">
          {view === 'dashboard' && <Dashboard state={state} setState={setState} onDelete={onDelete} />}
          {view === 'players' && <Players state={state} setState={setState} add={addPlayer} importPlayers={importPlayers} />}
          {view === 'entries' && <Entries state={state} addPair={addPair} addTeam={addTeam} />}
          {view === 'competitions' && <Competitions state={state} add={addCompetition} update={updateComp} remove={removeComp} setNotice={setNotice} />}
          {view === 'groups' && <Groups state={state} update={updateComp} setNotice={setNotice} />}
          {view === 'results' && <Results state={state} update={updateComp} label={label} openMatch={setDetail} openCard={(compId, entryId, name) => setCard({ compId, entryId, name })} />}
          {view === 'knockout' && <Knockout state={state} update={updateComp} label={label} openMatch={setDetail} setNotice={setNotice} />}
          {view === 'schedule' && <Schedule state={state} setState={setState} setNotice={setNotice} label={label} />}
          {view === 'teams' && <Teams state={state} update={updateComp} label={label} openMatch={setDetail} setNotice={setNotice} />}
          {view === 'exports' && <Exports state={state} setState={setState} label={label} />}
        </div>
      </main>

      {card && (() => { const comp = state.competitions.find(c => c.id === card.compId); return comp ? <EntryCard competition={comp} entryId={card.entryId} name={card.name} label={label} avatar={state.players.find(p => p.id === card.entryId)?.photo} onClose={() => setCard(null)} /> : null; })()}
      {detail && <MatchModal state={state} detail={detail} label={label} clubOf={clubOf}
        onClose={closeDetail}
        onChange={(m, bestOf) => {
          if (detail.kind === 'group') updateGroupMatch(detail.compId, detail.groupId, detail.matchId, normalizeMatch(m, bestOf));
          else if (detail.kind === 'ko') updateKoMatch(detail.compId, detail.side, detail.roundIdx, detail.matchId, normalizeMatch(m, bestOf));
          else updateTeamRubber(detail.compId, detail.tieId, detail.rubberId, normalizeMatch(m, bestOf), bestOf);
        }} />}
    </div>
  );
}

// ============================ POHĽADY ============================
function Dashboard({ state, setState, onDelete }: { state: TournamentState; setState: React.Dispatch<React.SetStateAction<TournamentState>>; onDelete?: () => void }) {
  const s = state.settings;
  const set = (patch: Partial<typeof s>) => setState(st => ({ ...st, settings: { ...st.settings, ...patch } }));
  return <div className="dash">
    <section className="hero card"><div><span className="kicker">Jeden systém pre celý turnaj</span><h2>{s.name}</h2><p>Dvojhra · štvorhra · mix · družstvá</p></div></section>
    <section className="card form-card"><h2>Nastavenie turnaja</h2><div className="settings-grid">
      <label>Názov<input value={s.name} onChange={e => set({ name: e.target.value })} /></label>
      <label>Dátum<input type="date" value={s.date} onChange={e => set({ date: e.target.value })} /></label>
      <label>Miesto<input value={s.venue} onChange={e => set({ venue: e.target.value })} /></label>
      <label>Počet stolov<input type="number" min={1} value={s.tables} onChange={e => set({ tables: Number(e.target.value) || 1 })} /></label>
      <label>Čas zápasu (min.)<input type="number" min={10} value={s.matchMinutes} onChange={e => set({ matchMinutes: Number(e.target.value) || 20 })} /></label>
      <label>Oddych (min.)<input type="number" min={0} value={s.restMinutes} onChange={e => set({ restMinutes: Number(e.target.value) || 0 })} /></label>
    </div></section>
    <div className="stats-grid">{[[state.players.length, 'Hráči'], [state.pairs.length, 'Páry'], [state.teams.length, 'Družstvá'], [state.competitions.length, 'Súťaže']].map(x => <div className="card stat" key={x[1] as string}><strong>{x[0]}</strong><span>{x[1]}</span></div>)}</div>
    {onDelete && <section className="card danger-zone"><div><strong>Zmazať turnaj</strong><p>Nezvratne odstráni celý turnaj vrátane výsledkov.</p></div><button className="button danger-btn" onClick={onDelete}><Trash2 size={16} />Zmazať turnaj</button></section>}
  </div>;
}

async function fileToThumb(file: File, size = 220, quality = 0.72): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const s = Math.min(img.width, img.height);
    const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', quality);
  } finally { URL.revokeObjectURL(url); }
}

function Avatar({ photo, name, size = 40 }: { photo?: string; name: string; size?: number }) {
  const initials = name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return photo
    ? <img className="avatar" src={photo} alt={name} style={{ width: size, height: size }} />
    : <span className="avatar avatar-ph" style={{ width: size, height: size, fontSize: size * 0.38 }}>{initials || '?'}</span>;
}

function Players({ state, setState, add, importPlayers }: { state: TournamentState; setState: React.Dispatch<React.SetStateAction<TournamentState>>; add: (n: string, c: string, r: number, g: Player['gender']) => void; importPlayers: (f?: File) => void }) {
  const [f, setF] = useState({ n: '', c: '', r: '', g: 'M' as Player['gender'] });
  const setPhoto = async (id: string, file?: File) => { if (!file) return; const photo = await fileToThumb(file); setState(s => ({ ...s, players: s.players.map(p => p.id === id ? { ...p, photo } : p) })); };
  return <div className="page-grid">
    <section className="card form-card"><h2>Pridať hráča</h2>
      <div className="player-form">
        <input placeholder="Meno" value={f.n} onChange={e => setF({ ...f, n: e.target.value })} />
        <input placeholder="Klub" value={f.c} onChange={e => setF({ ...f, c: e.target.value })} />
        <input type="number" placeholder="Rating" value={f.r} onChange={e => setF({ ...f, r: e.target.value })} />
        <select value={f.g} onChange={e => setF({ ...f, g: e.target.value as Player['gender'] })}><option value="M">Muž</option><option value="F">Žena</option><option value="X">Iné</option></select>
        <button className="button primary" onClick={() => { if (f.n.trim()) { add(f.n.trim(), f.c.trim(), Number(f.r) || 0, f.g); setF({ n: '', c: '', r: '', g: 'M' }); } }}><Plus size={17} />Pridať</button>
      </div>
      <label className="upload"><FileSpreadsheet /><div><strong>Import XLSX / CSV</strong><span>Stĺpce: meno, klub, rating, pohlavie</span></div><input type="file" accept=".xlsx,.xls,.csv" onChange={e => importPlayers(e.target.files?.[0])} /></label>
    </section>
    <section className="card roster-card"><div className="card-header"><h2>Hráči ({state.players.length})</h2><button className="text-danger" onClick={() => setState(s => ({ ...s, players: [] }))}><Trash2 size={16} />Vymazať</button></div>
      <div className="table-scroll"><table><thead><tr><th>#</th><th>Foto</th><th>Meno</th><th>Klub</th><th>Poh.</th><th>Rating</th><th /></tr></thead><tbody>
        {[...state.players].sort((a, b) => b.rating - a.rating).map((p, i) => <tr key={p.id}><td>{i + 1}</td>
          <td><label className="avatar-upload" title="Nahrať / zmeniť fotku"><Avatar photo={p.photo} name={p.name} /><input type="file" accept="image/*" onChange={e => setPhoto(p.id, e.target.files?.[0])} />{p.photo && <button className="avatar-x" onClick={ev => { ev.preventDefault(); setState(s => ({ ...s, players: s.players.map(x => x.id === p.id ? { ...x, photo: undefined } : x) })); }}>×</button>}</label></td>
          <td><strong>{p.name}</strong></td><td>{p.club || '—'}</td><td>{p.gender}</td><td>{p.rating || '—'}</td>
          <td><button className="icon-button danger" onClick={() => setState(s => ({ ...s, players: s.players.filter(x => x.id !== p.id) }))}><Trash2 size={16} /></button></td></tr>)}
      </tbody></table></div>
    </section>
  </div>;
}

function Entries({ state, addPair, addTeam }: { state: TournamentState; addPair: (a: string, b: string, m: boolean) => void; addTeam: (n: string, c: string, ids: string[]) => void }) {
  const [a, setA] = useState(''), [b, setB] = useState(''), [mixed, setMixed] = useState(false);
  const [tn, setTn] = useState(''), [tc, setTc] = useState(''), [ids, setIds] = useState<string[]>([]);
  return <div className="entry-columns">
    <section className="card form-card"><h2>Nový pár / mix</h2>
      <label className="check"><input type="checkbox" checked={mixed} onChange={e => setMixed(e.target.checked)} /> Mix (muž + žena)</label>
      <select value={a} onChange={e => setA(e.target.value)}><option value="">Prvý hráč</option>{state.players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      <select value={b} onChange={e => setB(e.target.value)}><option value="">Druhý hráč</option>{state.players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      <button className="button primary" onClick={() => { addPair(a, b, mixed); setA(''); setB(''); }}>Vytvoriť pár</button>
      <div className="list-cards">{state.pairs.map(p => <div key={p.id}><strong>{p.name}</strong><span>{p.club}</span></div>)}</div>
    </section>
    <section className="card form-card"><h2>Nové družstvo</h2>
      <input placeholder="Názov družstva" value={tn} onChange={e => setTn(e.target.value)} />
      <input placeholder="Klub" value={tc} onChange={e => setTc(e.target.value)} />
      <div className="check-list">{state.players.map(p => <label key={p.id}><input type="checkbox" checked={ids.includes(p.id)} onChange={e => setIds(x => e.target.checked ? [...x, p.id] : x.filter(i => i !== p.id))} />{p.name}</label>)}</div>
      <button className="button primary" onClick={() => { addTeam(tn, tc, ids); setTn(''); setTc(''); setIds([]); }}>Vytvoriť družstvo (2–4)</button>
      <div className="list-cards">{state.teams.map(t => <div key={t.id}><strong>{t.name}</strong><span>{t.playerIds.map(id => state.players.find(p => p.id === id)?.name).join(', ')}</span></div>)}</div>
    </section>
  </div>;
}

const BestOf = ({ value, onChange }: { value: number; onChange: (v: 3 | 5 | 7) => void }) =>
  <select className="bestof" value={value} onChange={e => onChange(Number(e.target.value) as 3 | 5 | 7)} onClick={e => e.stopPropagation()}>
    {[3, 5, 7].map(n => <option key={n} value={n}>best of {n}</option>)}
  </select>;

function Competitions({ state, add, update, remove, setNotice }: { state: TournamentState; add: (n: string, t: CompetitionType, s?: TeamSystemId) => void; update: (id: string, fn: (c: Competition) => Competition) => void; remove: (id: string) => void; setNotice: (s: string) => void }) {
  const [n, setN] = useState(''), [t, setT] = useState<CompetitionType>('singles'), [sys, setSys] = useState<TeamSystemId>('CORBILLON');
  return <div className="matches-stack">
    <section className="card form-card competition-create">
      <input placeholder="Názov súťaže" value={n} onChange={e => setN(e.target.value)} />
      <select value={t} onChange={e => setT(e.target.value as CompetitionType)}><option value="singles">Dvojhra</option><option value="doubles">Štvorhra</option><option value="mixed">Mix</option><option value="teams">Družstvá</option></select>
      {t === 'teams' && <select value={sys} onChange={e => setSys(e.target.value as TeamSystemId)}>{Object.values(TEAM_SYSTEMS).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}
      <button className="button primary" onClick={() => { if (n.trim()) { add(n, t, t === 'teams' ? sys : undefined); setN(''); } }}>Pridať súťaž</button>
    </section>
    {state.competitions.map(c => {
      const em = entryMap(c, state.players, state.pairs, state.teams); const available = [...em.values()];
      return <section className="card form-card" key={c.id}>
        <div className="card-header"><div><span className="kicker">{c.type}{c.type === 'teams' ? ` · ${TEAM_SYSTEMS[c.teamSystemId || 'CORBILLON'].name}` : ''}</span><h2>{c.name}</h2></div><button className="icon-button danger" onClick={() => remove(c.id)}><Trash2 /></button></div>
        <div className="settings-grid">
          <label>Best of (základ)<BestOf value={c.bestOf} onChange={v => update(c.id, x => ({ ...x, bestOf: v }))} /></label>
          {c.type !== 'teams' && <><label>Veľkosť skupiny<select value={c.preferredSize} onChange={e => update(c.id, x => ({ ...x, preferredSize: Number(e.target.value) }))}>{Array.from({ length: 10 }, (_, i) => i + 3).map(x => <option key={x}>{x}</option>)}</select></label>
            <label>Postupujúci<input type="number" min={1} max={8} value={c.qualifiersPerGroup} onChange={e => update(c.id, x => ({ ...x, qualifiersPerGroup: Number(e.target.value) || 1 }))} /></label>
            <label className="check"><input type="checkbox" checked={c.thirdPlace} onChange={e => update(c.id, x => ({ ...x, thirdPlace: e.target.checked }))} /> Zápas o 3. miesto</label>
            <label className="check"><input type="checkbox" checked={c.consolation} onChange={e => update(c.id, x => ({ ...x, consolation: e.target.checked }))} /> Útecha (nepostupujúci)</label></>}
        </div>
        <h3>Účastníci ({c.entryIds.length})</h3>
        <div className="check-list compact-list">{available.map(e => <label key={e.id}><input type="checkbox" checked={c.entryIds.includes(e.id)} onChange={ev => update(c.id, x => ({ ...x, entryIds: ev.target.checked ? [...x.entryIds, e.id] : x.entryIds.filter(i => i !== e.id) }))} />{e.name}</label>)}</div>
        {c.type !== 'teams'
          ? <button className="button primary" onClick={() => { update(c.id, x => ({ ...x, groups: createGroups(x.entryIds.map(id => em.get(id)!).filter(Boolean), x.preferredSize, x.bestOf, x.qualifiersPerGroup), ko: { main: [], consolation: [] } })); setNotice('Skupiny vytvorené.'); }}><Shuffle size={17} />Vytvoriť skupiny a rozpis</button>
          : <button className="button primary" onClick={() => { const teams = state.teams.filter(x => c.entryIds.includes(x.id)); const ties: TeamTie[] = []; for (let i = 0; i < teams.length; i++) for (let j = i + 1; j < teams.length; j++) ties.push(buildTeamTie(c.id, teams[i], teams[j], c.teamSystemId || 'CORBILLON', c.bestOf)); update(c.id, x => ({ ...x, teamTies: ties })); setNotice('Družstvové stretnutia vytvorené.'); }}><Wand2 size={17} />Vytvoriť stretnutia (každý s každým)</button>}
      </section>;
    })}
  </div>;
}

function Groups({ state, update, setNotice }: { state: TournamentState; update: (id: string, fn: (c: Competition) => Competition) => void; setNotice: (s: string) => void }) {
  const comps = state.competitions.filter(c => c.type !== 'teams' && c.groups.length);
  if (!comps.length) return <Empty title="Žiadne skupiny" text="Vytvor skupiny v sekcii Súťaže." />;
  return <div className="matches-stack">{comps.map(c => {
    const em = entryMap(c, state.players, state.pairs, state.teams);
    return <section className="card form-card" key={c.id}><h2>{c.name}</h2><div className="group-grid">{c.groups.map(g => <div className="group-mini" key={g.id}>
      <div className="group-mini-head"><h3>{g.name}</h3><BestOf value={g.bestOf} onChange={v => update(c.id, x => ({ ...x, groups: x.groups.map(y => y.id === g.id ? setGroupBestOf(y, v) : y) }))} /></div>
      {g.entryIds.map((id, i) => <div className="group-player" key={id}><span className="seed">{i + 1}</span><span className="gp-name">{em.get(id)?.name}</span>
        <select value={g.id} onChange={e => { const chk = canMovePlayer(c.groups, id, e.target.value); if (!chk.ok) { setNotice(chk.message || 'Presun nie je možný.'); return; } update(c.id, x => ({ ...x, groups: movePlayer(x.groups, id, e.target.value), ko: { main: [], consolation: [] } })); }}>
          {c.groups.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
      </div>)}
      <label className="mini-q">Postupuje: <select value={g.qualifiers} onChange={e => update(c.id, x => ({ ...x, groups: x.groups.map(y => y.id === g.id ? { ...y, qualifiers: Number(e.target.value) } : y) }))}>{Array.from({ length: Math.max(1, g.entryIds.length - 1) }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}</select></label>
    </div>)}</div></section>;
  })}</div>;
}

function Results({ state, update, label, openMatch, openCard }: { state: TournamentState; update: (id: string, fn: (c: Competition) => Competition) => void; label: (id: string | null) => string; openMatch: (d: Detail) => void; openCard: (compId: string, entryId: string, name: string) => void }) {
  const comps = state.competitions.filter(c => c.type !== 'teams' && c.groups.length);
  if (!comps.length) return <Empty title="Žiadne výsledky" text="Najprv vytvor skupiny." />;
  return <div className="matches-stack">{comps.map(c => {
    const em = entryMap(c, state.players, state.pairs, state.teams);
    return <section className="card match-card" key={c.id}><h2>{c.name}</h2>{c.groups.map(g => {
      const st = standings(g, em); const done = g.matches.filter(m => m.winnerId).length;
      return <div className="match-layout" key={g.id}>
        <div><div className="group-mini-head"><h3>{g.name} <span className="pill">{done}/{g.matches.length}</span></h3><BestOf value={g.bestOf} onChange={v => update(c.id, x => ({ ...x, groups: x.groups.map(y => y.id === g.id ? setGroupBestOf(y, v) : y) }))} /></div>
          {g.matches.map(m => <MatchRow key={m.id} m={m} label={label} onClick={() => openMatch({ kind: 'group', compId: c.id, groupId: g.id, matchId: m.id })} />)}</div>
        <div><h3>Tabuľka</h3><div className="table-scroll"><table><thead><tr><th>#</th><th>Účastník</th><th>Z</th><th>V</th><th>P</th><th>B</th><th>Sety</th><th>Lopt.</th></tr></thead><tbody>
          {st.map(r => <tr key={r.entry.id} className={r.qualified ? 'qualified-row' : ''}><td>{r.position}</td><td><strong className="clickable-name" onClick={() => openCard(c.id, r.entry.id, r.entry.name)}>{r.entry.name}</strong>{r.tieNote ? <small className="tie"> · {r.tieNote}</small> : ''}</td><td>{r.played}</td><td>{r.wins}</td><td>{r.losses}</td><td><b>{r.matchPoints}</b></td><td>{r.setsFor}:{r.setsAgainst}</td><td>{r.pointsFor}:{r.pointsAgainst}</td></tr>)}
        </tbody></table></div></div>
      </div>;
    })}</section>;
  })}</div>;
}

function Knockout({ state, update, label, openMatch, setNotice }: { state: TournamentState; update: (id: string, fn: (c: Competition) => Competition) => void; label: (id: string | null) => string; openMatch: (d: Detail) => void; setNotice: (s: string) => void }) {
  const comps = state.competitions.filter(c => c.type !== 'teams');
  if (!comps.length) return <Empty title="Žiadne pavúky" text="Najprv vytvor súťaž a skupiny." />;
  const renderBracket = (c: Competition, side: 'main' | 'consolation') => {
    const rounds = c.ko[side]; if (!rounds.length) return null;
    return <div className="bracket">{rounds.map((r, ri) => <section className="bracket-round" key={r.id}>
      <div className="br-head"><h3>{r.name}</h3>{r.kind !== 'third' && <BestOf value={r.bestOf} onChange={v => update(c.id, x => ({ ...x, ko: { ...x.ko, [side]: x.ko[side].map((y, i) => i === ri ? setRoundBestOf(y, v) : y) } }))} />}</div>
      {r.matches.map(m => <MatchRow key={m.id} compact m={m} label={label} onClick={() => (m.playerAId && m.playerBId) && openMatch({ kind: 'ko', compId: c.id, side, roundIdx: ri, matchId: m.id })} />)}
    </section>)}</div>;
  };
  return <div className="matches-stack">{comps.map(c => {
    const em = entryMap(c, state.players, state.pairs, state.teams);
    const groupsDone = c.groups.length > 0 && c.groups.every(g => g.matches.every(m => m.winnerId));
    return <section className="card form-card" key={c.id}><div className="card-header"><h2>{c.name}</h2>
      {!c.ko.main.length && <button className="button primary" onClick={() => { if (!c.groups.length) { setNotice('Najprv vytvor a dohraj skupiny.'); return; } if (!groupsDone && !confirm('Skupiny nie sú dohraté. Vytvoriť pavúk aj tak?')) return; update(c.id, x => ({ ...x, ko: createKnockout(x, em) })); }}><Wand2 size={16} />Vytvoriť pavúk z postupujúcich</button>}
      {c.ko.main.length > 0 && <button className="button" onClick={() => update(c.id, x => ({ ...x, ko: createKnockout(x, em) }))}>Prežrebovať</button>}
    </div>
      {c.ko.main.length > 0 && <><h3 className="bracket-title">Hlavná súťaž</h3>{renderBracket(c, 'main')}</>}
      {c.ko.consolation.length > 0 && <><h3 className="bracket-title">Útecha</h3>{renderBracket(c, 'consolation')}</>}
      {!c.ko.main.length && <p className="muted">Pavúk sa vytvorí z aktuálnych postupových miest skupín (a útecha z nepostupujúcich, ak je zapnutá).</p>}
    </section>;
  })}</div>;
}

function Schedule({ state, setState, setNotice, label }: { state: TournamentState; setState: React.Dispatch<React.SetStateAction<TournamentState>>; setNotice: (s: string) => void; label: (id: string | null) => string }) {
  const comps = state.competitions.filter(c => c.groups.length);
  return <div className="matches-stack">
    <section className="card"><div className="card-header"><h2>Stoly a harmonogram</h2>
      <button className="button primary" onClick={() => { setState(s => ({ ...s, competitions: autoSchedule(s.competitions, s.settings.tables, '09:00', s.settings.matchMinutes, s.settings.restMinutes) })); setNotice('Harmonogram vytvorený bez konfliktov hráčov.'); }}>Automaticky naplánovať</button></div>
      {!comps.length && <p className="muted">Zatiaľ žiadne skupinové zápasy.</p>}
    </section>
    {comps.map(c => <section className="card form-card" key={c.id}><h2>{c.name} — rozpis po kolách</h2>
      {groupRounds(c).map(r => <div className="round-block" key={r.round}>
        <h3>{r.round}. kolo</h3>
        <div className="round-matches">{r.items.map(({ groupName, m }) => <div className="round-match" key={m.id}>
          <span className="rm-group">{groupName}</span>
          <span className="rm-players">{label(m.playerAId)} <i>–</i> {label(m.playerBId)}</span>
          <span className="rm-meta">{m.table ? `stôl ${m.table}` : ''}{m.scheduledTime ? ` · ${m.scheduledTime}` : ''}{m.winnerId ? ` · ${scoreText(m)}` : ''}</span>
        </div>)}</div>
      </div>)}
    </section>)}
  </div>;
}

function Teams({ state, update, label, openMatch, setNotice }: { state: TournamentState; update: (id: string, fn: (c: Competition) => Competition) => void; label: (id: string | null) => string; openMatch: (d: Detail) => void; setNotice: (s: string) => void }) {
  const comps = state.competitions.filter(c => c.type === 'teams');
  if (!comps.length) return <Empty title="Žiadne družstvá" text="Vytvor súťaž typu Družstvá a stretnutia." />;
  return <div className="matches-stack">{comps.map(c => <section className="card match-card" key={c.id}><h2>{c.name} · {TEAM_SYSTEMS[c.teamSystemId || 'CORBILLON'].name}</h2>
    {!c.teamTies.length && <p className="muted">Stretnutia vytvor v sekcii Súťaže.</p>}
    {c.teamTies.map(t => <TeamTieCard key={t.id} tie={t} c={c} state={state} label={label} openMatch={openMatch} update={update} setNotice={setNotice} />)}
  </section>)}</div>;
}

function TeamTieCard({ tie, c, state, label, openMatch, update, setNotice }: { tie: TeamTie; c: Competition; state: TournamentState; label: (id: string | null) => string; openMatch: (d: Detail) => void; update: (id: string, fn: (c: Competition) => Competition) => void; setNotice: (s: string) => void }) {
  const home = state.teams.find(x => x.id === tie.homeTeamId)!, away = state.teams.find(x => x.id === tie.awayTeamId)!;
  const [side, setSide] = useState<'home' | 'away'>('home'), [out, setOut] = useState(''), [inn, setIn] = useState(''), [from, setFrom] = useState(1);
  return <div className="team-tie">
    <div className="team-score"><strong>{home.name}</strong><b className={tie.winnerTeamId ? 'done' : ''}>{tie.homeScore} : {tie.awayScore}</b><strong>{away.name}</strong></div>
    {tie.rubbers.map(r => <div key={r.id} className="rubber-row" onClick={() => (r.match.playerAId && r.match.playerBId) && openMatch({ kind: 'team', compId: c.id, tieId: tie.id, rubberId: r.id })}>
      <span className="rubber-label">{r.order}. {r.label} · {r.kind === 'doubles' ? 'štvorhra' : 'dvojhra'}</span>
      <span className="rubber-players">{label(r.match.playerAId)} – {label(r.match.playerBId)}</span>
      <span className="rubber-score">{r.match.winnerId ? scoreText(r.match) : '›'}</span>
    </div>)}
    <details><summary>Striedanie jedného hráča</summary><div className="sub-form">
      <select value={side} onChange={e => setSide(e.target.value as 'home' | 'away')}><option value="home">Domáci</option><option value="away">Hostia</option></select>
      <select value={out} onChange={e => setOut(e.target.value)}><option value="">Striedaný</option>{(side === 'home' ? home : away).playerIds.map(id => <option key={id} value={id}>{label(id)}</option>)}</select>
      <select value={inn} onChange={e => setIn(e.target.value)}><option value="">Náhradník</option>{(side === 'home' ? home : away).playerIds.map(id => <option key={id} value={id}>{label(id)}</option>)}</select>
      <input type="number" min={1} value={from} onChange={e => setFrom(Number(e.target.value) || 1)} />
      <button className="button" onClick={() => { try { const nt = applySubstitution(tie, side, out, inn, from, c.bestOf); update(c.id, x => ({ ...x, teamTies: x.teamTies.map(y => y.id === tie.id ? nt : y) })); setNotice('Striedanie zapísané.'); } catch (e) { setNotice((e as Error).message); } }}>Zapísať striedanie</button>
    </div></details>
  </div>;
}

function Exports({ state, setState, label }: { state: TournamentState; setState: React.Dispatch<React.SetStateAction<TournamentState>>; label: (id: string | null) => string }) {
  const exp = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })); a.download = 'stoten-turnaj.json'; a.click(); };
  return <section className="card export-card"><h2>Tlač a export</h2>
    <div className="export-actions">
      <button className="button primary" onClick={() => window.print()}><Printer />Tlačiť / PDF</button>
      <button className="button" onClick={exp}><Download />Export JSON</button>
      <label className="button upload-button">Import JSON<input type="file" accept=".json" onChange={async e => { const f = e.target.files?.[0]; if (f) { try { const d = JSON.parse(await f.text()); if (d.version === 5) setState(d); } catch { /* ignore */ } } }} /></label>
    </div>
    <div className="print-summary"><h3>{state.settings.name}</h3><p>{state.settings.date} · {state.settings.venue}</p>
      {state.competitions.filter(c => c.type !== 'teams').map(c => { const em = entryMap(c, state.players, state.pairs, state.teams); return <div key={c.id}><h4>{c.name}</h4>{c.groups.map(g => <div key={g.id}><strong>{g.name}</strong><ol>{standings(g, em).map(r => <li key={r.entry.id}>{r.entry.name} — {r.wins}V/{r.losses}P, sety {r.setsFor}:{r.setsAgainst}</li>)}</ol></div>)}</div>; })}
    </div>
  </section>;
}

// ============================ ZDIEĽANÉ ============================
function Empty({ title, text }: { title: string; text: string }) { return <section className="card page-empty"><h2>{title}</h2><p>{text}</p></section>; }

function MatchRow({ m, label, onClick, compact }: { m: Match; label: (id: string | null) => string; onClick: () => void; compact?: boolean }) {
  const ready = m.playerAId && m.playerBId;
  return <div className={compact ? 'match-row compact' : 'match-row'} onClick={ready ? onClick : undefined} role={ready ? 'button' : undefined}>
    <div className="mr-players"><span className={m.winnerId === m.playerAId ? 'win' : ''}>{label(m.playerAId)}</span><span className={m.winnerId === m.playerBId ? 'win' : ''}>{label(m.playerBId)}</span></div>
    <div className="mr-score">{m.winnerId ? <><b>{scoreText(m)}</b>{!m.specialResult && setsText(m) && <small className="mr-sets">{setsText(m)}</small>}{m.specialResult && <small className="mr-sets">{setsText(m)}</small>}</> : ready ? <span className="mr-open">zapísať ›</span> : ''}</div>
  </div>;
}

function MatchModal({ state, detail, label, clubOf, onClose, onChange }: {
  state: TournamentState; detail: Detail; label: (id: string | null) => string; clubOf: (id: string | null) => string;
  onClose: () => void; onChange: (m: Match, bestOf: number) => void;
}) {
  // nájdi aktuálny zápas + kontext podľa detailu
  const c = state.competitions.find(x => x.id === detail.compId)!;
  let m: Match | undefined, levelBest = c.bestOf, ctxTitle = c.name, ctxSub = '';
  if (detail.kind === 'group') { const g = c.groups.find(x => x.id === detail.groupId); m = g?.matches.find(x => x.id === detail.matchId); levelBest = g?.bestOf ?? c.bestOf; ctxSub = g?.name ?? ''; }
  else if (detail.kind === 'ko') { const r = c.ko[detail.side][detail.roundIdx]; m = r?.matches.find(x => x.id === detail.matchId); levelBest = r?.bestOf ?? c.bestOf; ctxSub = `${detail.side === 'consolation' ? 'Útecha · ' : ''}${r?.name ?? ''}`; }
  else { const t = c.teamTies.find(x => x.id === detail.tieId); const r = t?.rubbers.find(x => x.id === detail.rubberId); m = r?.match; ctxSub = r ? `${r.order}. ${r.label}` : ''; }
  if (!m) return null;
  const match = m;
  const bestOf = match.sets.length || levelBest;

  const setScore = (i: number, side: 'a' | 'b', v: string) => {
    const sets = match.sets.map((s, j) => j === i ? { ...s, [side]: v === '' ? null : Math.max(0, Number(v)) } : s);
    onChange({ ...match, sets, specialResult: null, result: null }, bestOf);
  };
  const changeBestOf = (nb: 3 | 5 | 7) => onChange({ ...match, sets: resizeSets(match.sets, nb), result: match.result ? { a: 0, b: 0 } : null }, nb);
  const special = (v: string) => onChange({ ...match, specialResult: (v || null) as Match['specialResult'], result: null, sets: match.sets.map(() => ({ a: null, b: null })) }, bestOf);
  const setResult = (a: number, b: number) => onChange({ ...match, result: { a, b }, specialResult: null, sets: match.sets.map(() => ({ a: null, b: null })) }, bestOf);
  const setMode = (mode: 'sets' | 'final') => onChange({ ...match, result: mode === 'final' ? { a: 0, b: 0 } : null, specialResult: null, sets: match.sets.map(() => ({ a: null, b: null })) }, bestOf);
  const meta = (patch: Partial<Match>) => onChange({ ...match, ...patch }, bestOf);
  const val = validateMatch(match, bestOf);
  const finalMode = !!match.result;
  const need = setsToWin(bestOf);
  const finalOptions: [number, number][] = [];
  for (let l = need - 1; l >= 0; l--) finalOptions.push([need, l]);
  for (let l = 0; l < need; l++) finalOptions.push([l, need]);

  const printRecord = () => {
    const rowsHtml = match.sets.map((s, i) => `<tr><td>${i + 1}. set</td><td class="b">${s.a ?? ''}</td><td class="b">${s.b ?? ''}</td></tr>`).join('');
    const html = `<!doctype html><html lang="sk"><head><meta charset="utf-8"><title>Zápis o zápase</title>
    <style>body{font-family:system-ui,Arial,sans-serif;color:#111;padding:24px;max-width:640px;margin:auto}h1{font-size:18px;margin:0 0 4px}h2{font-size:14px;color:#555;margin:0 0 16px;font-weight:500}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;margin:12px 0}.row{border-bottom:1px solid #ddd;padding:4px 0;font-size:14px}
    table{border-collapse:collapse;width:100%;margin-top:12px}td{border:1px solid #999;padding:8px;font-size:14px}td.b{width:60px;text-align:center;font-family:monospace;font-size:16px}
    .players{display:flex;justify-content:space-between;font-size:18px;font-weight:700;margin:14px 0}.sig{display:flex;justify-content:space-between;margin-top:48px;font-size:12px;color:#555}.sig div{border-top:1px solid #999;width:40%;padding-top:6px;text-align:center}
    @media print{button{display:none}}</style></head><body>
    <h1>${escapeHtml(state.settings.name)} — Zápis o zápase</h1>
    <h2>${escapeHtml(state.settings.date)}${state.settings.venue ? ' · ' + escapeHtml(state.settings.venue) : ''} · ${escapeHtml(c.name)} · ${escapeHtml(ctxSub)}</h2>
    <div class="grid"><div class="row">Stôl: ${match.table ?? '____'}</div><div class="row">Čas: ${escapeHtml(match.scheduledTime || '____')}</div><div class="row">Hrá sa na: best of ${bestOf}</div><div class="row">Rozhodca: ______________</div></div>
    <div class="players"><span>${escapeHtml(label(match.playerAId))}<br><small style="font-weight:400;color:#666">${escapeHtml(clubOf(match.playerAId))}</small></span><span style="color:#999">–</span><span style="text-align:right">${escapeHtml(label(match.playerBId))}<br><small style="font-weight:400;color:#666">${escapeHtml(clubOf(match.playerBId))}</small></span></div>
    <table><thead><tr><td></td><td class="b">${escapeHtml(shortName(label(match.playerAId)))}</td><td class="b">${escapeHtml(shortName(label(match.playerBId)))}</td></tr></thead><tbody>${rowsHtml}</tbody></table>
    ${match.winnerId ? `<p style="margin-top:12px;font-size:15px"><strong>Víťaz:</strong> ${escapeHtml(label(match.winnerId))} (${scoreText(match)})</p>` : ''}
    <div class="sig"><div>Podpis hráča A</div><div>Podpis rozhodcu</div><div>Podpis hráča B</div></div>
    <button onclick="window.print()" style="margin-top:24px;padding:10px 16px;font-size:14px">Tlačiť</button>
    </body></html>`;
    const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); }
  };

  return <div className="modal-backdrop" onClick={onClose}><div className="modal" onClick={e => e.stopPropagation()}>
    <div className="modal-head"><div><span className="kicker">{ctxTitle} · {ctxSub}</span><h2>{label(match.playerAId)} <span className="vs">vs</span> {label(match.playerBId)}</h2></div><button className="icon-button" onClick={onClose}><X /></button></div>
    <div className="modal-body">
      <div className="modal-row"><label>Úroveň zápasu:</label><BestOf value={bestOf} onChange={changeBestOf} />
        <div className="mode-toggle"><button className={!finalMode ? 'on' : ''} onClick={() => setMode('sets')}>Po setoch</button><button className={finalMode ? 'on' : ''} onClick={() => setMode('final')}>Len výsledok</button></div></div>
      {finalMode
        ? <div className="modal-row"><label>Celkový výsledok:</label>
            <select value={`${match.result!.a}:${match.result!.b}`} onChange={e => { const [a, b] = e.target.value.split(':').map(Number); setResult(a, b); }}>
              <option value="0:0">— zvoľ —</option>
              {finalOptions.map(([a, b]) => <option key={`${a}:${b}`} value={`${a}:${b}`}>{a}:{b}</option>)}
            </select></div>
        : <div className="set-grid">{match.sets.map((s, i) => <div key={i} className="set-cell"><small>Set {i + 1}</small>
            <input type="number" min={0} value={s.a ?? ''} disabled={!!match.specialResult} onChange={e => setScore(i, 'a', e.target.value)} />
            <b>:</b>
            <input type="number" min={0} value={s.b ?? ''} disabled={!!match.specialResult} onChange={e => setScore(i, 'b', e.target.value)} /></div>)}</div>}
      <div className="modal-row"><label>Osobitný výsledok:</label>
        <select value={match.specialResult ?? ''} onChange={e => special(e.target.value)}>
          <option value="">Bežný výsledok</option><option value="WO_A">Kontumácia (WO) – A neprišiel</option><option value="WO_B">Kontumácia (WO) – B neprišiel</option>
          <option value="RET_A">Vzdal sa A</option><option value="RET_B">Vzdal sa B</option><option value="DSQ_A">Diskvalifikácia A</option><option value="DSQ_B">Diskvalifikácia B</option>
        </select></div>
      <div className="modal-row three"><label>Stôl<input type="number" min={1} value={match.table ?? ''} onChange={e => meta({ table: Number(e.target.value) || undefined })} /></label>
        <label>Čas<input type="time" value={match.scheduledTime ?? ''} onChange={e => meta({ scheduledTime: e.target.value })} /></label></div>
      <div className="modal-row"><label>Poznámka</label><input value={match.note ?? ''} onChange={e => meta({ note: e.target.value })} /></div>
      {!val.valid && <p className="match-error">{val.message}</p>}
      {val.valid && !val.complete && !match.specialResult && match.sets.some(s => s.a !== null || s.b !== null) && <p className="match-warning">{val.message}</p>}
      {match.winnerId && <p className="winner">Víťaz: {label(match.winnerId)} ({scoreText(match)})</p>}
    </div>
    <div className="modal-foot"><button className="button" onClick={printRecord}><Printer size={16} />Tlačiť zápis</button><button className="button primary" onClick={onClose}>Hotovo</button></div>
  </div></div>;
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
const shortName = (s: string) => s.length > 10 ? s.slice(0, 9) + '.' : s;
