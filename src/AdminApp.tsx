import { useEffect, useRef, useState } from 'react';
import { useParams, useLocation, Link, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Lock, Trophy, Link as LinkIcon, Eye, RotateCcw, Save, Home } from 'lucide-react';
import { TournamentEditor } from './App';
import { deleteTournament, getTournament, saveTournament, verifyPin } from './lib/supabase';
import type { TournamentState } from './types';
import './styles.css';

type Backup = { at: number; data: TournamentState };
const backupKey = (slug: string) => `stoten.backup.${slug}`;
const readBackup = (slug: string): Backup | null => { try { const s = localStorage.getItem(backupKey(slug)); return s ? JSON.parse(s) as Backup : null; } catch { return null; } };
const writeBackup = (slug: string, data: TournamentState) => { try { localStorage.setItem(backupKey(slug), JSON.stringify({ at: Date.now(), data })); } catch { /* plné úložisko – ignoruj */ } };

export function AdminApp() {
  const { slug = '' } = useParams();
  const loc = useLocation();
  const navPin = (loc.state as { pin?: string } | null)?.pin;
  const [pin, setPin] = useState(navPin || '');
  const [unlocked, setUnlocked] = useState(false);
  const [initial, setInitial] = useState<TournamentState | null>(null);
  const [seed, setSeed] = useState(0);
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [entry, setEntry] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [pending, setPending] = useState<Backup | null>(null);
  const latest = useRef<TournamentState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nav = useNavigate();
  const removeTournament = async () => {
    if (!confirm('Naozaj nezvratne zmazať celý turnaj vrátane výsledkov?')) return;
    try { await deleteTournament(slug, pin); try { localStorage.removeItem(backupKey(slug)); } catch { /* ignore */ } nav('/'); }
    catch (e) { alert('Zmazanie zlyhalo: ' + (e as Error).message); }
  };

  const openWith = async (p: string) => {
    setErr('');
    try {
      const ok = await verifyPin(slug, p); if (!ok) { setErr('Nesprávny PIN.'); return; }
      const t = await getTournament(slug); if (!t) { setErr('Turnaj sa nenašiel.'); return; }
      const bk = readBackup(slug);
      if (bk && Date.now() - bk.at < 24 * 3600 * 1000 && JSON.stringify(bk.data) !== JSON.stringify(t.data)) setPending(bk);
      setInitial(t.data); setName(t.name); setPin(p); setUnlocked(true);
    } catch (e) { setErr((e as Error).message); }
  };
  useEffect(() => { setUnlocked(false); setInitial(null); setEntry(''); setSaveState('idle'); setPin(navPin || ''); if (navPin) openWith(navPin); /* eslint-disable-next-line */ }, [slug]);

  const pushCloud = async (s: TournamentState) => { setSaveState('saving'); try { await saveTournament(slug, s, pin); setSaveState('saved'); } catch { setSaveState('error'); } };
  const save = (s: TournamentState) => {
    latest.current = s;
    writeBackup(slug, s);            // vždy lokálna záloha (aj keď cloud zlyhá)
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => pushCloud(s), 700);
  };
  const forceSave = () => { if (latest.current) pushCloud(latest.current); };
  const restore = () => { if (!pending) return; setInitial(pending.data); setSeed(x => x + 1); setPending(null); pushCloud(pending.data); };

  if (!unlocked) return <div className="public-shell"><header className="public-top"><Link className="brand-line" to="/"><img className="brand-logo-sm" src="/topspin.png" alt="TOPSPIN" /><strong>TOPSPIN</strong></Link></header>
    <main className="public-main"><section className="card form-card pin-card">
      <h2><Lock size={18} /> Admin prístup</h2>
      <p className="muted">Zadaj PIN turnaja na editáciu. Bez PIN sú výsledky len na čítanie.</p>
      <div className="pin-row"><input placeholder="PIN" value={entry} onChange={e => setEntry(e.target.value)} onKeyDown={e => e.key === 'Enter' && openWith(entry)} type="password" />
        <button className="button primary" onClick={() => openWith(entry)}>Odomknúť</button></div>
      {err && <p className="match-error">{err}</p>}
      <Link className="button" to={`/t/${slug}`}><Eye size={16} />Verejné výsledky</Link>
    </section></main></div>;

  const url = typeof window !== 'undefined' ? `${window.location.origin}/t/${slug}` : '';
  const banner = <div className="admin-banner">
    {pending && <button className="save-chip restore" onClick={restore} title="Máš novšiu neuloženú zálohu v tomto zariadení"><RotateCcw size={13} />Obnoviť zálohu</button>}
    <span className={`save-chip ${saveState}`} onClick={saveState === 'error' ? forceSave : undefined} title={saveState === 'error' ? 'Klikni na opätovné uloženie' : ''}>
      {saveState === 'saving' ? 'Ukladám…' : saveState === 'error' ? 'Chyba – skús znova' : 'Uložené'}</span>
    {saveState === 'error' && <button className="link-btn" onClick={forceSave}><Save size={13} />Uložiť</button>}
    <a className="link-btn" href="/"><Home size={13} />Turnaje</a>
    <a className="link-btn" href={`/t/${slug}`} target="_blank" rel="noreferrer"><Eye size={13} />Verejné</a>
    <button className="link-btn" onClick={() => navigator.clipboard?.writeText(url)}><LinkIcon size={13} />Odkaz</button>
    <span className="mini-qr"><QRCodeSVG value={url} size={40} /></span>
  </div>;

  return initial ? <TournamentEditor key={seed} initial={initial} onSave={save} banner={banner} onDelete={removeTournament} /> : null;
}
