import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Trophy, Link as LinkIcon, Eye, RotateCcw, Save, Home } from 'lucide-react';
import { TournamentEditor } from './App';
import { deleteTournament, getTournament, isConflict, saveTournament, signOut, type Session } from './lib/supabase';
import { AuthGate } from './components/AuthGate';
import { AuthBar } from './components/AuthBar';
import type { TournamentState } from './types';
import './styles.css';

type Backup = { at: number; data: TournamentState };
const backupKey = (slug: string) => `stoten.backup.${slug}`;
const readBackup = (slug: string): Backup | null => { try { const s = localStorage.getItem(backupKey(slug)); return s ? JSON.parse(s) as Backup : null; } catch { return null; } };
const writeBackup = (slug: string, data: TournamentState) => { try { localStorage.setItem(backupKey(slug), JSON.stringify({ at: Date.now(), data })); } catch { /* plné úložisko – ignoruj */ } };

export function AdminApp() {
  const { slug = '' } = useParams();
  return <AuthGate slug={slug}>{s => <AdminInner session={s} />}</AuthGate>;
}

function AdminInner({ session }: { session: Session }) {
  const { slug = '' } = useParams();
  const [unlocked, setUnlocked] = useState(true);
  const [initial, setInitial] = useState<TournamentState | null>(null);
  const [seed, setSeed] = useState(0);
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [pending, setPending] = useState<Backup | null>(null);
  const [stale, setStale] = useState(false);
  const lastPushed = useRef<string>('');
  const version = useRef<number>(0);
  const latest = useRef<TournamentState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nav = useNavigate();
  const removeTournament = async () => {
    if (!confirm('Naozaj nezvratne zmazať celý turnaj vrátane výsledkov?')) return;
    try { await deleteTournament(slug); try { localStorage.removeItem(backupKey(slug)); } catch { /* ignore */ } nav('/'); }
    catch (e) { alert('Zmazanie zlyhalo: ' + (e as Error).message); }
  };

  /** Načíta turnaj hneď po vstupe — prístup už overil AuthGate. */
  const openTournament = async () => {
    setErr('');
    try {
      const t = await getTournament(slug);
      if (!t) { setErr('Turnaj sa nenašiel.'); return; }
      const bk = readBackup(slug);
      if (bk && Date.now() - bk.at < 24 * 3600 * 1000 && JSON.stringify(bk.data) !== JSON.stringify(t.data)) setPending(bk);
      lastPushed.current = JSON.stringify(t.data); version.current = t.version;
      setInitial(t.data); setName(t.name); setUnlocked(true);
    } catch (e) { setErr((e as Error).message); }
  };
  useEffect(() => {
    setUnlocked(false); setInitial(null); setSaveState('idle');
    openTournament();
    /* eslint-disable-next-line */
  }, [slug]);

  const pushCloud = async (s: TournamentState) => {
    setSaveState('saving');
    try {
      version.current = await saveTournament(slug, s, version.current || undefined);
      lastPushed.current = JSON.stringify(s); setSaveState('saved'); setStale(false);
    } catch (e) {
      if (isConflict(e)) { setStale(true); setSaveState('idle'); }   // neprepisujeme cudzie zmeny
      else setSaveState('error');
    }
  };

  /** Načíta turnaj z cloudu. Ak lokálne nič nečaká na uloženie, ticho ho použije;
   *  inak len upozorní, aby sa nezmazali rozpísané zmeny. */
  const refetch = async (silent: boolean) => {
    try {
      const t = await getTournament(slug);
      if (!t) return;
      const cloud = JSON.stringify(t.data);
      const local = latest.current ? JSON.stringify(latest.current) : lastPushed.current;
      if (cloud === local) { setStale(false); return; }
      if (local === lastPushed.current) { setInitial(t.data); setName(t.name); setSeed(x => x + 1); lastPushed.current = cloud; version.current = t.version; setStale(false); }
      else if (!silent || true) setStale(true);
    } catch { /* offline – necháme, čo máme */ }
  };
  const save = (s: TournamentState) => {
    latest.current = s;
    writeBackup(slug, s);            // vždy lokálna záloha (aj keď cloud zlyhá)
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => pushCloud(s), 700);
  };
  const forceSave = () => { if (latest.current) pushCloud(latest.current); };

  // Neaktivita: po návrate na kartu (alebo raz za 5 min) over, či sa turnaj nezmenil inde.
  useEffect(() => {
    if (!unlocked) return;
    let hiddenAt = 0;
    const onVis = () => {
      if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
      if (Date.now() - hiddenAt > 60000) refetch(true);
    };
    document.addEventListener('visibilitychange', onVis);
    const id = setInterval(() => { if (document.visibilityState === 'visible') refetch(true); }, 300000);
    return () => { document.removeEventListener('visibilitychange', onVis); clearInterval(id); };
    /* eslint-disable-next-line */
  }, [unlocked, slug]);
  const restore = () => { if (!pending) return; setInitial(pending.data); setSeed(x => x + 1); setPending(null); pushCloud(pending.data); };

  if (!unlocked) return <div className="public-shell">
    <header className="public-top"><Link className="brand-line" to="/"><img className="brand-logo-sm" src="/topspin.png" alt="TOPSPIN" /><strong>TOPSPIN</strong></Link><AuthBar /></header>
    <main className="public-main"><section className="card form-card">
      {err ? <><h2>Turnaj sa nepodarilo otvoriť</h2><p className="match-error">{err}</p>
        <div className="row-actions"><button className="button primary" onClick={openTournament}>Skúsiť znova</button>
        <Link className="button" to={`/t/${slug}`}><Eye size={16} />Verejné výsledky</Link></div></>
        : <p className="muted">Načítavam turnaj…</p>}
    </section></main></div>;

  const url = typeof window !== 'undefined' ? `${window.location.origin}/t/${slug}` : '';
  const banner = <div className="admin-banner">
    {stale && <button className="save-chip stale" onClick={() => { if (confirm('Turnaj bol medzitým zmenený inde. Načítať aktuálnu verziu? Tvoje neuložené zmeny sa nahradia (ostávajú v zálohe zariadenia).')) { setStale(false); latest.current = null; refetch(false); } }} title="Turnaj bol zmenený v inom zariadení">Zmenené inde – načítať</button>}
    {pending && <button className="save-chip restore" onClick={restore} title="Máš novšiu neuloženú zálohu v tomto zariadení"><RotateCcw size={13} />Obnoviť zálohu</button>}
    <span className={`save-chip ${saveState}`} onClick={saveState === 'error' ? forceSave : undefined} title={saveState === 'error' ? 'Klikni na opätovné uloženie' : ''}>
      {saveState === 'saving' ? 'Ukladám…' : saveState === 'error' ? 'Chyba – skús znova' : 'Uložené'}</span>
    {saveState === 'error' && <button className="link-btn" onClick={forceSave}><Save size={13} />Uložiť</button>}
    <a className="link-btn" href="/"><Home size={13} />Turnaje</a>
    <a className="link-btn" href={`/t/${slug}`} target="_blank" rel="noreferrer"><Eye size={13} />Verejné</a>
    <a className="link-btn" href={`/t/${slug}/tv`} target="_blank" rel="noreferrer">TV režim</a>
    <a className="link-btn" href={`/t/${slug}/stol`} target="_blank" rel="noreferrer">Od stola</a>
    <button className="link-btn" onClick={() => navigator.clipboard?.writeText(url)}><LinkIcon size={13} />Odkaz</button>
    <span className="mini-qr"><QRCodeSVG value={url} size={40} /></span>
  </div>;

  return initial ? <TournamentEditor key={seed} initial={initial} onSave={save} banner={banner} onDelete={removeTournament} slug={slug} /> : null;
}
