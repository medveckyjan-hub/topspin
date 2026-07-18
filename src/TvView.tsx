import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { getTournament } from './lib/supabase';
import { entryMap, scoreText, standings } from './lib/multisport';
import type { Competition, Match, TournamentState } from './types';
import './styles.css';
import { skDate } from './lib/format';

type Slide =
  | { kind: 'live'; }
  | { kind: 'group'; compId: string; groupId: string }
  | { kind: 'bracket'; compId: string }
  | { kind: 'order'; compId: string };

const SLIDE_MS = 12000;

/** TV režim — celoobrazovkový výstup pre projektor v hale.
 *  Sám sa obnovuje a strieda živé zápasy, tabuľky skupín a pavúky. */
export function TvView() {
  const { slug = '' } = useParams();
  const [data, setData] = useState<TournamentState | null>(null);
  const [name, setName] = useState('');
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try { const t = await getTournament(slug); if (alive && t) { setData(t.data); setName(t.name); } } catch { /* ponechaj posledné */ }
    };
    load();
    const id = setInterval(load, 20000);
    const c = setInterval(() => setClock(new Date()), 30000);
    return () => { alive = false; clearInterval(id); clearInterval(c); };
  }, [slug]);

  const slides = useMemo<Slide[]>(() => {
    if (!data) return [];
    const out: Slide[] = [{ kind: 'live' }];
    (data.competitions ?? []).forEach(c => {
      c.groups.forEach(g => out.push({ kind: 'group', compId: c.id, groupId: g.id }));
      if (c.ko.main.length) out.push({ kind: 'bracket', compId: c.id });
    });
    return out;
  }, [data]);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const id = setInterval(() => setIdx(i => (i + 1) % slides.length), SLIDE_MS);
    return () => clearInterval(id);
  }, [paused, slides.length]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setIdx(i => (i + 1) % Math.max(1, slides.length));
      if (e.key === 'ArrowLeft') setIdx(i => (i - 1 + Math.max(1, slides.length)) % Math.max(1, slides.length));
      if (e.key === ' ') { e.preventDefault(); setPaused(p => !p); }
      if (e.key.toLowerCase() === 'f') document.documentElement.requestFullscreen?.();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [slides.length]);

  if (!data) return <div className="tv tv-load"><h1>TOPSPIN</h1><p>Načítavam…</p></div>;

  const slide = slides[Math.min(idx, slides.length - 1)] ?? { kind: 'live' as const };
  const comp = 'compId' in slide ? (data.competitions ?? []).find(c => c.id === slide.compId) : undefined;
  const em = comp ? entryMap(comp, data.players, data.pairs, data.teams) : null;
  const nm = (id: string | null) => (id && em ? em.get(id)?.name || '—' : '—');
  const cl = (id: string | null) => (id && em ? em.get(id)?.club || '' : '');
  const url = typeof window !== 'undefined' ? `${window.location.origin}/t/${slug}` : '';

  const liveRows = (data.competitions ?? []).flatMap(c => {
    const m2 = entryMap(c, data.players, data.pairs, data.teams);
    const label = (id: string | null) => (id ? m2.get(id)?.name || '—' : '—');
    const all: { phase: string; m: Match }[] = [
      ...c.groups.flatMap(g => g.matches.map(m => ({ phase: g.name, m }))),
      ...c.groups.flatMap(g => g.playoff ? [{ phase: `${g.name} · o 1.`, m: g.playoff.final }, ...(g.playoff.third ? [{ phase: `${g.name} · o 3.`, m: g.playoff.third }] : [])] : []),
      ...c.ko.main.flatMap(r => r.matches.map(m => ({ phase: r.name, m }))),
    ];
    return all.filter(x => x.m.table && !x.m.winnerId && x.m.playerAId && x.m.playerBId)
      .map(x => ({ comp: c.name, phase: x.phase, m: x.m, label }));
  }).sort((a, b) => (a.m.table ?? 0) - (b.m.table ?? 0));

  const recent = (data.competitions ?? []).flatMap(c => {
    const m2 = entryMap(c, data.players, data.pairs, data.teams);
    const label = (id: string | null) => (id ? m2.get(id)?.name || '—' : '—');
    return [
      ...c.groups.flatMap(g => g.matches.map(m => ({ m, label }))),
      ...c.ko.main.flatMap(r => r.matches.map(m => ({ m, label }))),
    ].filter(x => x.m.winnerId);
  }).slice(-6).reverse();

  return <div className="tv">
    <header className="tv-top">
      <div className="tv-brand"><img src="/topspin.png" alt="TOPSPIN" /><div><strong>{name}</strong><span>{data.settings.venue || skDate(data.settings.date)}</span></div></div>
      <div className="tv-right">
        <div className="tv-qr"><QRCodeSVG value={url} size={78} /><span>Výsledky online</span></div>
        <div className="tv-clock">{clock.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })}</div>
      </div>
    </header>

    <main className="tv-main">
      {slide.kind === 'live' && <>
        <h2 className="tv-h">Práve sa hrá</h2>
        {liveRows.length === 0 ? <p className="tv-empty">Momentálne neprebieha žiadny zápas.</p> :
          <div className="tv-live">{liveRows.slice(0, 8).map(({ comp: cn, phase, m, label }) => <div className="tv-live-row" key={m.id}>
            <span className="tv-table">{m.table}</span>
            <div className="tv-live-mid"><span className="tv-live-meta">{cn} · {phase}</span>
              <div className="tv-live-names"><b>{label(m.playerAId)}</b><i>vs</i><b>{label(m.playerBId)}</b></div></div>
            <span className="tv-live-time">{m.scheduledTime || ''}</span>
          </div>)}</div>}
        {recent.length > 0 && <>
          <h3 className="tv-h3">Posledné výsledky</h3>
          <div className="tv-recent">{recent.map(({ m, label }) => <div className="tv-rec" key={m.id}>
            <span className={m.winnerId === m.playerAId ? 'w' : ''}>{label(m.playerAId)}</span>
            <b>{scoreText(m)}</b>
            <span className={m.winnerId === m.playerBId ? 'w' : ''}>{label(m.playerBId)}</span>
          </div>)}</div></>}
      </>}

      {slide.kind === 'group' && comp && em && (() => {
        const g = comp.groups.find(x => x.id === slide.groupId);
        if (!g) return null;
        const st = standings(g, em);
        return <>
          <h2 className="tv-h">{comp.name} — {g.name}</h2>
          <table className="tv-table-std"><thead><tr><th>#</th><th>Hráč</th><th>V</th><th>P</th><th>B</th><th>Sety</th></tr></thead><tbody>
            {st.map(r => <tr key={r.entry.id} className={r.qualified ? 'q' : ''}>
              <td>{r.position}</td><td><b>{r.entry.name}</b><em>{r.entry.club}</em></td>
              <td>{r.wins}</td><td>{r.losses}</td><td className="tv-pts">{r.matchPoints}</td><td>{r.setsFor}:{r.setsAgainst}</td></tr>)}
          </tbody></table>
        </>;
      })()}

      {slide.kind === 'bracket' && comp && (() => {
        const rounds = comp.ko.main.filter(r => r.kind !== 'third');
        return <>
          <h2 className="tv-h">{comp.name} — pavúk</h2>
          <div className="tv-bracket">{rounds.map(r => <div className="tv-round" key={r.id}>
            <h4>{r.name}</h4>
            {r.matches.map(m => { const sc = m.winnerId ? scoreText(m).split(':') : null; return <div className="tv-km" key={m.id}>
              <div className={m.winnerId === m.playerAId ? 'tv-kr w' : 'tv-kr'}><span>{nm(m.playerAId)}<em>{cl(m.playerAId)}</em></span><b>{sc ? sc[0] : ''}</b></div>
              <div className={m.winnerId === m.playerBId ? 'tv-kr w' : 'tv-kr'}><span>{nm(m.playerBId)}<em>{cl(m.playerBId)}</em></span><b>{sc ? sc[1] : ''}</b></div>
            </div>; })}
          </div>)}</div>
        </>;
      })()}
    </main>

    <footer className="tv-foot">
      <div className="tv-dots">{slides.map((_, i) => <span key={i} className={i === idx ? 'on' : ''} />)}</div>
      <span className="tv-hint">medzerník = pauza · šípky = prepínanie · F = celá obrazovka{paused ? ' · POZASTAVENÉ' : ''}</span>
    </footer>
  </div>;
}
