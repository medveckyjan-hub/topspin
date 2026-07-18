import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Plus, Settings, Trophy } from 'lucide-react';
import { AuthBar } from './components/AuthBar';
import { AuthGate } from './components/AuthGate';
import { canCreate, createTournament, myTournaments } from './lib/supabase';
import { skDate } from './lib/format';
import './styles.css';

type MyRow = { slug: string; name: string; updated_at: string; role: string };

/** Správa turnajov — tu sa turnaje zakladajú a odtiaľto sa otvárajú.
 *  Na verejnej úvodnej stránke sa zakladať nedá. */
export function Manage() {
  return <AuthGate note="Na správu turnajov sa prihlás tlačidlom">{() => <ManageInner />}</AuthGate>;
}

function ManageInner() {
  const nav = useNavigate();
  const [rows, setRows] = useState<MyRow[]>([]);
  const [mayCreate, setMayCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => {
    setLoading(true);
    try { setRows(await myTournaments()); } catch (e) { setErr((e as Error).message); }
    try { setMayCreate(await canCreate()); } catch { /* ignore */ }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim()) { setErr('Vyplň názov turnaja.'); return; }
    setBusy(true); setErr('');
    try { const slug = await createTournament(name.trim()); nav(`/t/${slug}/admin`); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  };

  return <div className="public-shell">
    <header className="public-top">
      <Link className="brand-line" to="/"><img className="brand-logo-sm" src="/topspin.png" alt="TOPSPIN" /><strong>TOPSPIN</strong></Link>
      <AuthBar />
    </header>
    <main className="public-main">
      <div className="pub-head"><div><span className="kicker">Správa</span><h1>Moje turnaje</h1>
        <p>Turnaje, ktoré si založil alebo ku ktorým ti bol pridelený prístup.</p></div></div>

      {mayCreate && <section className="card form-card create-card">
        <h2><Plus size={18} /> Nový turnaj</h2>
        <div className="create-grid">
          <input placeholder="Názov turnaja" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && create()} />
          <button className="button primary" disabled={busy} onClick={create}>{busy ? 'Zakladám…' : 'Založiť a spravovať'}</button>
        </div>
        {err && <p className="match-error">{err}</p>}
      </section>}

      <section className="card">
        <div className="card-header"><h2>Turnaje ({rows.length})</h2><button className="button" onClick={load}>Obnoviť</button></div>
        {loading ? <p className="muted">Načítavam…</p> : rows.length === 0 ?
          <p className="muted">Zatiaľ nemáš žiadny turnaj.{mayCreate ? ' Založ si prvý vyššie.' : ''}</p> :
          <div className="t-list">{rows.map(r => <div className="t-row" key={r.slug}>
            <div className="t-main"><Trophy size={18} />
              <div><strong>{r.name}</strong><span>{skDate(r.updated_at)}{r.role === 'owner' ? ' · vlastník' : ' · pridelený prístup'}</span></div></div>
            <div className="row-actions">
              <Link className="button" to={`/t/${r.slug}`}>Verejné</Link>
              <Link className="button primary" to={`/t/${r.slug}/admin`}><Settings size={15} />Spravovať<ArrowRight size={15} /></Link>
            </div>
          </div>)}</div>}
      </section>
    </main>
  </div>;
}
