import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Check, ChevronLeft, Lock, Minus, Plus, RefreshCw } from 'lucide-react';
import { getTournament, isConflict, saveTournament } from './lib/supabase';
import { AuthGate } from './components/AuthGate';
import { AuthBar } from './components/AuthBar';
import { advanceKnockout, advanceQualification, entryMap, normalizeMatch, scoreTeamTie, scoreText, setsToWin, validateMatch } from './lib/multisport';
import { advanceStage } from './lib/stages';
import type { Competition, Match, TournamentState } from './types';
import './styles.css';

type Slot =
  | { kind: 'group'; compId: string; groupId: string; matchId: string }
  | { kind: 'playoff'; compId: string; groupId: string; slot: 'final' | 'third' }
  | { kind: 'ko'; compId: string; side: 'main' | 'consolation'; roundIdx: number; matchId: string }
  | { kind: 'final'; compId: string; matchId: string }
  | { kind: 'qual'; compId: string; bracketId: string; roundIdx: number; matchId: string }
  | { kind: 'stage'; compId: string; stageId: string; groupId?: string; roundIdx?: number; matchId: string }
  | { kind: 'team'; compId: string; tieId: string; rubberId: string };

type Row = { slot: Slot; comp: Competition; phase: string; m: Match; bestOf: number; a: string; b: string };

/** Zapisovanie od stola — jednoduchý mobilný režim pre rozhodcu.
 *  Vyberie si svoj stôl a zapisuje sety veľkými tlačidlami. */
export function TableView() {
  const { slug = '' } = useParams();
  return <AuthGate slug={slug} note="Prihlás sa e-mailom, ktorý ti pridal organizátor turnaja.">{() => <TableInner />}</AuthGate>;
}

function TableInner() {
  const { slug = '' } = useParams();
  const [unlocked] = useState(true);
  const [data, setData] = useState<TournamentState | null>(null);
  const [table, setTable] = useState<number | 'all'>('all');
  const [open, setOpen] = useState<Row | null>(null);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error' | 'conflict'>('idle');
  const version = useRef(0);

  const load = async () => {
    try { const t = await getTournament(slug); if (t) { setData(t.data); version.current = t.version; } } catch { /* ponechaj */ }
  };
  useEffect(() => { if (unlocked) { load(); const id = setInterval(load, 25000); return () => clearInterval(id); } }, [unlocked, slug]);

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

      c.finalGroup?.matches.forEach(m => out.push({ slot: { kind: 'final', compId: c.id, matchId: m.id },
        comp: c, phase: 'Finálová skupina', m, bestOf: c.finalGroup!.bestOf, a: nm(m.playerAId), b: nm(m.playerBId) }));

      c.qualification?.brackets.forEach(b => b.rounds.forEach((r, ri) => r.matches.forEach(m =>
        out.push({ slot: { kind: 'qual', compId: c.id, bracketId: b.id, roundIdx: ri, matchId: m.id },
          comp: c, phase: `Kvalifikácia · ${b.name} · ${r.name}`, m, bestOf: r.bestOf, a: nm(m.playerAId), b: nm(m.playerBId) }))));

      c.stagePlan?.stages.forEach(st => {
        st.groups?.forEach(g => g.matches.forEach(m =>
          out.push({ slot: { kind: 'stage', compId: c.id, stageId: st.id, groupId: g.id, matchId: m.id },
            comp: c, phase: `${st.name} · ${g.name}`, m, bestOf: g.bestOf, a: nm(m.playerAId), b: nm(m.playerBId) })));
        st.rounds?.forEach((r, ri) => r.matches.forEach(m =>
          out.push({ slot: { kind: 'stage', compId: c.id, stageId: st.id, roundIdx: ri, matchId: m.id },
            comp: c, phase: `${st.name} · ${r.name}`, m, bestOf: r.bestOf, a: nm(m.playerAId), b: nm(m.playerBId) })));
      });

      c.teamTies.forEach(tie => tie.rubbers.forEach(rb =>
        out.push({ slot: { kind: 'team', compId: c.id, tieId: tie.id, rubberId: rb.id },
          comp: c, phase: `Stretnutie · ${rb.label}`, m: rb.match, bestOf: rb.match.sets.length || c.bestOf,
          a: rb.homePlayerIds.map(id => data.players.find(p => p.id === id)?.name ?? '—').join(' / ') || nm(rb.match.playerAId),
          b: rb.awayPlayerIds.map(id => data.players.find(p => p.id === id)?.name ?? '—').join(' / ') || nm(rb.match.playerBId) })));
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
    const slot = row.slot;
    const c = next.competitions.find(x => x.id === slot.compId)!;
    if (slot.kind === 'group') {
      const g = c.groups.find(x => x.id === slot.groupId)!;
      g.matches = g.matches.map(m => (m.id === slot.matchId ? updated : m));
    } else if (slot.kind === 'playoff') {
      const g = c.groups.find(x => x.id === slot.groupId)!;
      if (g.playoff) g.playoff = { ...g.playoff, [slot.slot]: updated } as typeof g.playoff;
    } else if (slot.kind === 'ko') {
      const r = c.ko[slot.side][slot.roundIdx];
      r.matches = r.matches.map(m => (m.id === slot.matchId ? updated : m));
      // víťaz musí postúpiť do ďalšieho kola — bez tohto sa výsledok uložil,
      // ale súper v nasledujúcom kole sa nikdy neobjavil
      c.ko[slot.side] = advanceKnockout(c.ko[slot.side]);
    } else if (slot.kind === 'final') {
      if (c.finalGroup) c.finalGroup.matches = c.finalGroup.matches.map(m => (m.id === slot.matchId ? updated : m));
    } else if (slot.kind === 'qual') {
      const b = c.qualification?.brackets.find(x => x.id === slot.bracketId);
      const r = b?.rounds[slot.roundIdx];
      if (r) r.matches = r.matches.map(m => (m.id === slot.matchId ? updated : m));
      if (c.qualification) c.qualification = advanceQualification(c.qualification);
    } else if (slot.kind === 'stage') {
      const st = c.stagePlan?.stages.find(x => x.id === slot.stageId);
      if (st) {
        if (slot.groupId) {
          const g = st.groups?.find(x => x.id === slot.groupId);
          if (g) g.matches = g.matches.map(m => (m.id === slot.matchId ? updated : m));
        } else if (st.rounds && slot.roundIdx !== undefined) {
          const r = st.rounds[slot.roundIdx];
          if (r) r.matches = r.matches.map(m => (m.id === slot.matchId ? updated : m));
          const moved = advanceStage(st);
          st.rounds = moved.rounds;
        }
      }
    } else {
      const tie = c.teamTies.find(x => x.id === slot.tieId);
      const rb = tie?.rubbers.find(x => x.id === slot.rubberId);
      if (rb) rb.match = updated;
      if (tie) {
        const scored = scoreTeamTie(tie, tie.rubbers[0]?.match.sets.length || c.bestOf);
        tie.homeScore = scored.homeScore;
        tie.awayScore = scored.awayScore;
        tie.winnerTeamId = scored.winnerTeamId;
        tie.status = scored.status;
      }
    }
    setData(next);
    setState('saving');
    try { version.current = await saveTournament(slug, next, version.current || undefined); setState('saved'); }
    catch (e) { if (isConflict(e)) { setState('conflict'); await load(); } else setState('error'); }
  };

  if (open) return <ScoreSheet row={open} onClose={() => setOpen(null)} onSave={(m) => { applyMatch(open, m); setOpen(null); }} />;

  return <div className="tbl-shell">
    <header className="tbl-top">
      <div><strong>Zapisovanie od stola</strong><span className={`tbl-state ${state}`}>{state === 'saving' ? 'Ukladám…' : state === 'saved' ? 'Uložené' : state === 'conflict' ? 'Načítané nanovo' : state === 'error' ? 'Chyba ukladania' : ''}</span></div>
      <div className="tbl-right"><AuthBar /><button className="icon-button" onClick={load}><RefreshCw size={18} /></button></div>
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
  const num = (v: number | null) => v ?? 0;
  const bump = (i: number, side: 'a' | 'b', d: number) =>
    setSets(cur => cur.map((s, j) => (j === i ? { ...s, [side]: Math.max(0, num(side === 'a' ? s.a : s.b) + d) } : s)));
  // Počítadlo aj tlačidlo riadi ten istý validátor ako v admine —
  // set 7:4 alebo 1:0 nie je vyhratý set.
  const draft = { ...row.m, sets, specialResult: null } as Match;
  const check = validateMatch(draft, row.bestOf);
  const scored = normalizeMatch(draft, row.bestOf);
  const won = { a: 0, b: 0 };
  sets.forEach(s => {
    const a = num(s.a), b = num(s.b);
    if (a === 0 && b === 0) return;
    const ok = Math.max(a, b) >= 11 && Math.abs(a - b) >= 2;
    if (!ok) return;
    if (a > b) won.a++; else if (b > a) won.b++;
  });
  const finished = check.valid && check.complete && !!scored.winnerId;

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
          <b>{num(s.a)}</b>
          <button onClick={() => bump(i, 'a', 1)}><Plus size={18} /></button>
        </div>
        <div className="sheet-ctrl">
          <button onClick={() => bump(i, 'b', -1)}><Minus size={18} /></button>
          <b>{num(s.b)}</b>
          <button onClick={() => bump(i, 'b', 1)}><Plus size={18} /></button>
        </div>
      </div>)}
    </div>

    <div className="sheet-actions">
      <button className="button primary big" disabled={!finished}
        onClick={() => onSave(scored)}>
        <Check size={18} />{finished ? 'Uložiť výsledok' : 'Zápas ešte nie je dohratý'}
      </button>
      {!finished && <p className="sheet-warn">{check.message || `Na výhru treba ${need} platných setov (min. 11 bodov a rozdiel 2).`}</p>}
      <div className="sheet-special">
        <button className="button" onClick={() => onSave(normalizeMatch({ ...row.m, specialResult: 'WO_A' }, row.bestOf))}>{row.a} neprišiel</button>
        <button className="button" onClick={() => onSave(normalizeMatch({ ...row.m, specialResult: 'WO_B' }, row.bestOf))}>{row.b} neprišiel</button>
      </div>
    </div>
  </div>;
}
