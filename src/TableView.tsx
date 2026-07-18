import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Check, ChevronLeft, Lock, Minus, Plus, RefreshCw } from 'lucide-react';
import { getTournament, isConflict, saveTournament, verifyPin } from './lib/supabase';
import { entryMap, normalizeMatch, scoreText, setsToWin } from './lib/multisport';
import type { Competition, Match, TournamentState } from './types';
import './styles.css';

type Slot =
  | { kind: 'group'; compId: string; groupId: string; matchId: string }
  | { kind: 'playoff'; compId: string; groupId: string; slot: 'final' | 'third' }
  | { kind: 'ko'; compId: string; side: 'main' | 'consolation'; roundIdx: number; matchId: string };

type Row = { slot: Slot; comp: Competition; phase: string; m: Match; bestOf: number; a: string; b: string };

/** Zapisovanie od stola — jednoduchý mobilný režim pre rozhodcu.
 *  Vyberie si svoj stôl a zapisuje sety veľkými tlačidlami. */
export function TableView() {
  const { slug = '' } = useParams();
  const [pin, setPin] = useState('');
  const [entry, setEntry] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [err, setErr] = useState('');
  const [data, setData] = useState<TournamentState | null>(null);
  const [table, setTable] = useState<number | 'all'>('all');
  const [open, setOpen] = useState<Row | null>(null);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error' | 'conflict'>('idle');
  const version = useRef(0);

  const load = async () => {
    try { const t = await getTournament(slug); if (t) { setData(t.data); version.current = t.version; } } catch { /* ponechaj */ }
  };
  useEffect(() => { if (unlocked) { load(); const id = setInterval(load, 25000); return () => clearInterval(id); } }, [unlocked, slug]);

  const unlock = async () => {
    setErr('');
    try {
      const ok = await verifyPin(slug, entry);
      if (!ok) { setErr('Nesprávny PIN.'); return; }
      setPin(entry); setUnlocked(true);
    } catch (e) { setErr((e as Error).message); }
  };

  const rows = useMemo<Row[]>(() => {
    if (!data) return [];
    const out: Row[] = [];
    data.competitions.forEach(c => {
      const em = entryMap(c, data.players, data.pairs, data.teams);
      const nm = (id: string | null) => (id ? em.get(id)?.name || '—' : '—');
      c.groups.forEach(g => {
        g.matches.forEach(m => out.push({ slot: { kind: 'group', compId: c.id, groupId: g.id, matchId: m.id }, comp: c, phase: g.name, m, bestOf: g.bestOf, a: nm(m.playerAId), b: nm(m.playerBId) }));
        if (g.playoff) {
          out.push({ slot: { kind: 'playoff', compId: c.id, groupId: g.id, slot: 'final' }, comp: c, phase: `${g.name} · o 1. miesto`, m: g.playoff.final, bestOf: g.bestOf, a: nm(g.playoff.final.playerAId), b: nm(g.playoff.final.playerBId) });
          if (g.playoff.third) out.push({ slot: { kind: 'playoff', compId: c.id, groupId: g.id, slot: 'third' }, comp: c, phase: `${g.name} · o 3. miesto`, m: g.playoff.third, bestOf: g.bestOf, a: nm(g.playoff.third.playerAId), b: nm(g.playoff.third.playerBId) });
        }
      });
      (['main', 'consolation'] as const).forEach(side => c.ko[side].forEach((r, ri) => r.matches.forEach(m =>
        out.push({ slot: { kind: 'ko', compId: c.id, side, roundIdx: ri, matchId: m.id }, comp: c, phase: `${side === 'consolation' ? 'Útecha · ' : ''}${r.name}`, m, bestOf: r.bestOf, a: nm(m.playerAId), b: nm(m.playerBId) }))));
    });
    return out.filter(r => r.m.playerAId && r.m.playerBId);
  }, [data]);

  const tables = useMemo(() => [...new Set(rows.map(r => r.m.table).filter(Boolean))].sort((a, b) => (a as number) - (b as number)) as number[], [rows]);
  const visible = rows.filter(r => (table === 'all' || r.m.table === table));
  const todo = visible.filter(r => !r.m.winnerId);
  const done = visible.filter(r => r.m.winnerId);

  const applyMatch = async (row: Row, updated: Match) => {
    if (!data) return;
    const next: TournamentState = structuredClone(data);
    const c = next.competitions.find(x => x.id === row.slot.compId)!;
    if (row.slot.kind === 'group') {
      const g = c.groups.find(x => x.id === row.slot.groupId)!;
      g.matches = g.matches.map(m => (m.id === row.slot.matchId ? updated : m));
    } else if (row.slot.kind === 'playoff') {
      const g = c.groups.find(x => x.id === row.slot.groupId)!;
      if (g.playoff) g.playoff = { ...g.playoff, [row.slot.slot]: updated } as typeof g.playoff;
    } else {
      const r = c.ko[row.slot.side][row.slot.roundIdx];
      r.matches = r.matches.map(m => (m.id === row.slot.matchId ? updated : m));
    }
    setData(next);
    setState('saving');
    try { version.current = await saveTournament(slug, next, pin, version.current || undefined); setState('saved'); }
    catch (e) { if (isConflict(e)) { setState('conflict'); await load(); } else setState('error'); }
  };

  if (!unlocked) return <div className="tbl-shell"><div className="tbl-lock">
    <img src="/topspin.png" alt="TOPSPIN" />
    <h1>Zapisovanie od stola</h1>
    <p>Zadaj PIN turnaja. Zapisovať môžeš len výsledky, nastavenia turnaja ostávajú organizátorovi.</p>
    <input placeholder="PIN" type="password" value={entry} onChange={e => setEntry(e.target.value)} onKeyDown={e => e.key === 'Enter' && unlock()} />
    <button className="button primary" onClick={unlock}><Lock size={16} />Vstúpiť</button>
    {err && <p className="match-error">{err}</p>}
    <Link className="link-btn" to={`/t/${slug}`}>Verejné výsledky</Link>
  </div></div>;

  if (open) return <ScoreSheet row={open} onClose={() => setOpen(null)} onSave={(m) => { applyMatch(open, m); setOpen(null); }} />;

  return <div className="tbl-shell">
    <header className="tbl-top">
      <div><strong>Zapisovanie od stola</strong><span className={`tbl-state ${state}`}>{state === 'saving' ? 'Ukladám…' : state === 'saved' ? 'Uložené' : state === 'conflict' ? 'Načítané nanovo' : state === 'error' ? 'Chyba ukladania' : ''}</span></div>
      <button className="icon-button" onClick={load}><RefreshCw size={18} /></button>
    </header>

    <div className="tbl-tabs">
      <button className={table === 'all' ? 'on' : ''} onClick={() => setTable('all')}>Všetky</button>
      {tables.map(t => <button key={t} className={table === t ? 'on' : ''} onClick={() => setTable(t)}>Stôl {t}</button>)}
    </div>

    <h3 className="tbl-h">Na zapísanie ({todo.length})</h3>
    {todo.length === 0 ? <p className="tbl-empty">Žiadne zápasy na tomto stole.</p> :
      <div className="tbl-list">{todo.map(r => <button className="tbl-card" key={r.m.id} onClick={() => setOpen(r)}>
        <div className="tbl-meta"><span>{r.comp.name} · {r.phase}</span>{r.m.table && <em>stôl {r.m.table}</em>}{r.m.scheduledTime && <em>{r.m.scheduledTime}</em>}</div>
        <div className="tbl-names"><b>{r.a}</b><i>vs</i><b>{r.b}</b></div>
      </button>)}</div>}

    {done.length > 0 && <><h3 className="tbl-h">Dohraté ({done.length})</h3>
      <div className="tbl-list">{done.slice().reverse().map(r => <button className="tbl-card done" key={r.m.id} onClick={() => setOpen(r)}>
        <div className="tbl-meta"><span>{r.comp.name} · {r.phase}</span></div>
        <div className="tbl-names"><b className={r.m.winnerId === r.m.playerAId ? 'w' : ''}>{r.a}</b><i>{scoreText(r.m)}</i><b className={r.m.winnerId === r.m.playerBId ? 'w' : ''}>{r.b}</b></div>
      </button>)}</div></>}
  </div>;
}

/** Zápis setov veľkými tlačidlami — použiteľné jednou rukou pri stole. */
function ScoreSheet({ row, onClose, onSave }: { row: Row; onClose: () => void; onSave: (m: Match) => void }) {
  const need = setsToWin(row.bestOf);
  const [sets, setSets] = useState(() => row.m.sets.map(s => ({ ...s })));
  const bump = (i: number, side: 'a' | 'b', d: number) =>
    setSets(cur => cur.map((s, j) => (j === i ? { ...s, [side]: Math.max(0, (side === 'a' ? s.a : s.b) + d) } : s)));
  const won = sets.reduce((acc, s) => { if (s.a > s.b) acc.a++; else if (s.b > s.a) acc.b++; return acc; }, { a: 0, b: 0 });
  const finished = won.a >= need || won.b >= need;

  return <div className="tbl-shell sheet">
    <header className="tbl-top">
      <button className="icon-button" onClick={onClose}><ChevronLeft size={20} /></button>
      <div><strong>{row.comp.name}</strong><span>{row.phase}{row.m.table ? ` · stôl ${row.m.table}` : ''}</span></div>
      <span />
    </header>

    <div className="sheet-score"><div><b>{row.a}</b><span>{won.a}</span></div><i>:</i><div><span>{won.b}</span><b>{row.b}</b></div></div>

    <div className="sheet-sets">
      {sets.map((s, i) => <div className="sheet-set" key={i}>
        <span className="sheet-lab">Set {i + 1}</span>
        <div className="sheet-ctrl">
          <button onClick={() => bump(i, 'a', -1)}><Minus size={18} /></button>
          <b>{s.a}</b>
          <button onClick={() => bump(i, 'a', 1)}><Plus size={18} /></button>
        </div>
        <div className="sheet-ctrl">
          <button onClick={() => bump(i, 'b', -1)}><Minus size={18} /></button>
          <b>{s.b}</b>
          <button onClick={() => bump(i, 'b', 1)}><Plus size={18} /></button>
        </div>
      </div>)}
    </div>

    <div className="sheet-actions">
      <button className="button primary big" disabled={!finished}
        onClick={() => onSave(normalizeMatch({ ...row.m, sets, specialResult: null }, row.bestOf))}>
        <Check size={18} />{finished ? 'Uložiť výsledok' : `Chýba ${need} vyhratých setov`}
      </button>
      <div className="sheet-special">
        <button className="button" onClick={() => onSave(normalizeMatch({ ...row.m, specialResult: 'WO_A' }, row.bestOf))}>{row.a} neprišiel</button>
        <button className="button" onClick={() => onSave(normalizeMatch({ ...row.m, specialResult: 'WO_B' }, row.bestOf))}>{row.b} neprišiel</button>
      </div>
    </div>
  </div>;
}
