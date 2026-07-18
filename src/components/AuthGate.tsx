import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { canEdit, getSession, onAuth, signOut, type Session } from '../lib/supabase';
import { AuthBar } from './AuthBar';

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="public-shell">
    <header className="public-top">
      <Link className="brand-line" to="/"><img className="brand-logo-sm" src="/topspin.png" alt="TOPSPIN" /><strong>TOPSPIN</strong></Link>
      <AuthBar />
    </header>
    <main className="public-main"><div className="login-box gate">{children}</div></main>
  </div>;
}

/** Obal, ktorý pustí ďalej len prihláseného používateľa s prístupom k turnaju. */
export function AuthGate({ slug, children, note }: { slug?: string; children: (s: Session) => React.ReactNode; note?: string }) {
  const [session, setSession] = useState<Session>(null);
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    getSession().then(s => { setSession(s); setReady(true); });
    return onAuth(s => setSession(s));
  }, []);

  useEffect(() => {
    if (!session || !slug) { setAllowed(session ? true : null); return; }
    canEdit(slug).then(setAllowed);
  }, [session, slug]);

  if (!ready) return <Frame><p className="muted">Načítavam…</p></Frame>;

  if (!session) return <Frame>
    <h1>Prihlásenie je potrebné</h1>
    <p>{note || 'Na správu turnaja sa prihlás tlačidlom'} <b>Prihlásiť sa</b> vpravo hore.</p>
    <Link className="link-btn" to="/">Späť na turnaje</Link>
  </Frame>;

  if (slug && allowed === false) return <Frame>
    <h1>Nemáš prístup</h1>
    <p>Si prihlásený ako <strong>{session.email}</strong>, ale k tomuto turnaju nemáš oprávnenie. Požiadaj správcu turnaja, aby ti prístup pridelil.</p>
    <button className="link-btn" onClick={() => signOut()}><LogOut size={13} />Odhlásiť sa</button>
    <Link className="link-btn" to="/">Späť na turnaje</Link>
  </Frame>;

  if (slug && allowed === null) return <Frame><p className="muted">Overujem prístup…</p></Frame>;
  return <>{children(session)}</>;
}
