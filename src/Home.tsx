import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Trophy, Plus, ArrowRight, ShieldCheck } from 'lucide-react';
import { canCreate, cloudReady, createTournament, getSession, listTournaments, onAuth, signOut, type Session, type TournamentListItem } from './lib/supabase';
import { AuthBar } from './components/AuthBar';
import './styles.css';

export function Home() {
  const nav = useNavigate();
  const [items, setItems] = useState<TournamentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<Session>(null);
  const [authReady, setAuthReady] = useState(false);
  const [mayCreate, setMayCreate] = useState(false);
  useEffect(() => { getSession().then(s => { setSession(s); setAuthReady(true); }); return onAuth(setSession); }, []);
  useEffect(() => { if (session) canCreate().then(setMayCreate); else setMayCreate(false); }, [session]);

  useEffect(() => { (async () => { try { if (cloudReady) setItems(await listTournaments()); } catch (e) { setErr((e as Error).message); } finally { setLoading(false); } })(); }, []);

  const create = async () => {
    if (!name.trim()) { setErr('Vyplň názov turnaja.'); return; }
    setBusy(true); setErr('');
    try { const slug = await createTournament(name.trim()); nav(`/t/${slug}/admin`); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return <div className="public-shell">
    <header className="public-top">
      <div className="brand-line"><img className="brand-logo-sm" src="/topspin.png" alt="TOPSPIN" /><strong>TOPSPIN</strong></div>
      <AuthBar />
    </header>
    <main className="public-main">
      {!cloudReady && <div className="cloud-warn">Chýba pripojenie na Supabase. Nastav <code>VITE_SUPABASE_URL</code> a <code>VITE_SUPABASE_ANON_KEY</code>.</div>}

      {session && mayCreate && <section className="card form-card">
        <div className="card-header"><h2>Správa turnajov</h2>
          <Link className="button primary" to="/sprava"><Plus size={16} />Moje turnaje a zakladanie</Link></div>
        <p className="hint">Turnaje sa zakladajú a spravujú v sekcii Správa turnajov.</p>
      </section>}

      <section className="card form-card">
        <h2>Turnaje</h2>
        {loading ? <p className="muted">Načítavam…</p> : items.length === 0 ? <p className="muted">Zatiaľ žiadne turnaje.</p> :
          <div className="tourn-list">{items.map(t => <Link key={t.id} className="tourn-item" to={`/t/${t.slug}`}>
            <div><strong>{t.name}</strong><span>{t.date || '—'}</span></div><ArrowRight size={18} />
          </Link>)}</div>}
      </section>
    </main>
  </div>;
}
