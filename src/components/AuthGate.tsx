import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogIn, LogOut, Mail } from 'lucide-react';
import { canEdit, claimTournament, getSession, onAuth, signOut, type Session } from '../lib/supabase';
import { LoginModal } from './AuthBar';

/** Obal, ktorý pustí ďalej len prihláseného používateľa s prístupom k turnaju. */
export function AuthGate({ slug, children, note }: { slug?: string; children: (s: Session) => React.ReactNode; note?: string }) {
  const [session, setSession] = useState<Session>(null);
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [pin, setPin] = useState('');
  const [claimErr, setClaimErr] = useState('');
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    getSession().then(s => { setSession(s); setReady(true); });
    return onAuth(s => setSession(s));
  }, []);

  useEffect(() => {
    if (!session || !slug) { setAllowed(session ? true : null); return; }
    canEdit(slug).then(setAllowed);
  }, [session, slug]);

  const claim = async () => {
    setClaimErr('');
    try { await claimTournament(slug!, pin); setAllowed(await canEdit(slug!)); }
    catch (e) { setClaimErr((e as Error).message); }
  };

  if (!ready) return <div className="login-shell"><p className="muted">Načítavam…</p></div>;
  if (!session) return <div className="login-shell"><div className="login-box">
    <img src="/topspin.png" alt="TOPSPIN" />
    <h1>Prihlásenie</h1>
    <p>{note || 'Na správu turnaja sa prihlás svojím e-mailom.'}</p>
    <button className="button primary" onClick={() => setShowLogin(true)}>Prihlásiť sa</button>
    <Link className="link-btn" to="/">Späť na turnaje</Link>
    {showLogin && <LoginModal onClose={() => setShowLogin(false)} note={note} />}
  </div></div>;

  if (slug && allowed === false) return <div className="login-shell"><div className="login-box">
    <h1>Nemáš prístup</h1>
    <p>Si prihlásený ako <strong>{session.email}</strong>, ale tento turnaj patrí niekomu inému.</p>
    <p className="field-hint">Ak je to tvoj starší turnaj, prevezmi ho zadaním pôvodného PINu — spraví sa to len raz.</p>
    <input placeholder="Pôvodný PIN turnaja" value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === 'Enter' && claim()} />
    <button className="button primary" onClick={claim}>Prevziať turnaj</button>
    {claimErr && <p className="match-error">{claimErr}</p>}
    <button className="link-btn" onClick={() => signOut()}><LogOut size={13} />Prihlásiť sa iným e-mailom</button>
    <Link className="link-btn" to="/">Späť na turnaje</Link>
  </div></div>;

  if (slug && allowed === null) return <div className="login-shell"><p className="muted">Overujem prístup…</p></div>;
  return <>{children(session)}</>;
}
