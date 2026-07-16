import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Trophy, Plus, ArrowRight, ShieldCheck } from 'lucide-react';
import { cloudReady, createTournament, listTournaments, type TournamentListItem } from './lib/supabase';
import './styles.css';

export function Home() {
  const nav = useNavigate();
  const [items, setItems] = useState<TournamentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { (async () => { try { if (cloudReady) setItems(await listTournaments()); } catch (e) { setErr((e as Error).message); } finally { setLoading(false); } })(); }, []);

  const create = async () => {
    if (!name.trim() || !pin.trim() || !code.trim()) { setErr('Vyplň názov, PIN aj kód.'); return; }
    setBusy(true); setErr('');
    try { const slug = await createTournament(name.trim(), pin.trim(), code.trim()); nav(`/t/${slug}/admin`, { state: { pin: pin.trim() } }); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return <div className="public-shell">
    <header className="public-top"><div className="brand-line"><img className="brand-logo-sm" src="/topspin.png" alt="TOPSPIN" /><strong>TOPSPIN</strong></div></header>
    <main className="public-main">
      {!cloudReady && <div className="cloud-warn">Chýba pripojenie na Supabase. Nastav <code>VITE_SUPABASE_URL</code> a <code>VITE_SUPABASE_ANON_KEY</code>.</div>}

      <section className="card form-card create-card">
        <h2><Plus size={18} /> Nový turnaj</h2>
        <div className="create-grid">
          <input placeholder="Názov turnaja" value={name} onChange={e => setName(e.target.value)} />
          <input placeholder="Admin PIN (na editáciu)" value={pin} onChange={e => setPin(e.target.value)} />
          <input placeholder="Tajný kód na zakladanie" value={code} onChange={e => setCode(e.target.value)} type="password" />
          <button className="button primary" disabled={busy || !cloudReady} onClick={create}>{busy ? 'Zakladám…' : 'Založiť a spravovať'}</button>
        </div>
        <p className="hint"><ShieldCheck size={14} /> PIN si zapamätaj – slúži na editáciu. Výsledky uvidí každý cez odkaz alebo QR.</p>
        {err && <p className="match-error">{err}</p>}
      </section>

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
