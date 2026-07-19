import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Trophy, Plus, ArrowRight, Calendar, FileText, Images, MapPin, ShieldCheck, UserPlus, Video } from 'lucide-react';
import { canCreate, cloudReady, createTournament, getSession, listTournaments, onAuth, signOut, type Session, type TournamentListItem } from './lib/supabase';
import { AuthBar } from './components/AuthBar';
import { skDate } from './lib/format';
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
          <div className="tcards">{items.map(t => <TournamentCard key={t.slug} t={t} />)}</div>}
      </section>
    </main>
  </div>;
}

type Status = 'prebieha' | 'odohrany' | 'pripravuje';

/** Stav turnaja podľa dátumu: dnes = prebieha, minulosť = odohraný, budúcnosť = pripravuje sa. */
function statusOf(date: string | null): Status {
  if (!date) return 'pripravuje';
  const today = new Date().toISOString().slice(0, 10);
  if (date === today) return 'prebieha';
  return date < today ? 'odohrany' : 'pripravuje';
}

/** Odpočet do začiatku turnaja. */
function Countdown({ date }: { date: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const diff = new Date(`${date}T09:00:00`).getTime() - now;
  if (diff <= 0) return null;
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const sec = Math.floor((diff % 60000) / 1000);
  const parts: [number, string][] = [[d, 'dní'], [h, 'hod'], [m, 'min'], [sec, 'sek']];
  return <div className="tc-count">{parts.map(([v, l]) => <div key={l}><b>{v}</b><span>{l}</span></div>)}</div>;
}

function TournamentCard({ t }: { t: TournamentListItem }) {
  const cats = t.categories ?? [];
  const st = statusOf(t.t_date);
  const regOpen = t.reg_open && st === 'pripravuje'
    && (!t.reg_deadline || new Date(t.reg_deadline).getTime() > Date.now());
  const label = st === 'prebieha' ? 'Prebieha' : st === 'odohrany' ? 'Odohraný' : 'Pripravuje sa';

  return <article className={`tcard tcard-${st}`}>
    <div className="tc-top">
      <div className="tc-title">
        <Link to={`/t/${t.slug}`}><h3>{t.name}</h3></Link>
        <div className="tc-meta">
          <span className="tc-date"><Calendar size={14} />{t.t_date ? skDate(t.t_date) : 'termín neurčený'}</span>
          {t.venue && <span className="tc-venue"><MapPin size={14} />{t.venue}</span>}
        </div>
      </div>
      <div className="tc-right">
        <span className={`tc-badge tc-badge-${st}`}>{label}</span>
        {st === 'pripravuje' && t.t_date && <Countdown date={t.t_date} />}
      </div>
    </div>

    <div className="tc-bottom">
      <div className="tc-cats">{cats.slice(0, 6).map(c => <span className="tc-cat" key={c}>{c}</span>)}
        {cats.length > 6 && <span className="tc-cat">+{cats.length - 6}</span>}
        {cats.length === 0 && <span className="tc-cat tc-cat-empty">kategórie zatiaľ nezverejnené</span>}</div>
      <div className="tc-links">
        {t.has_propozicie && <Link to={`/t/${t.slug}`} className="tc-link"><FileText size={14} />Propozície</Link>}
        {t.has_gallery && <Link to={`/t/${t.slug}`} className="tc-link"><Images size={14} />Galéria</Link>}
        {t.has_video && <Link to={`/t/${t.slug}`} className="tc-link"><Video size={14} />Videá</Link>}
        {regOpen && <Link to={`/t/${t.slug}`} className="tc-link tc-reg"><UserPlus size={14} />Registrácia</Link>}
        <Link to={`/t/${t.slug}`} className="tc-link tc-open">{st === 'odohrany' ? 'Výsledky' : 'Otvoriť'}<ArrowRight size={14} /></Link>
      </div>
    </div>
  </article>;
}
