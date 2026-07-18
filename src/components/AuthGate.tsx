import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogIn, LogOut, Mail } from 'lucide-react';
import { canEdit, claimTournament, getSession, onAuth, sendLoginLink, signOut, type Session } from '../lib/supabase';

/** Prihlásenie e-mailom (bez hesla). Na e-mail príde odkaz, ktorým sa používateľ prihlási. */
export function LoginBox({ note }: { note?: string }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setErr('');
    if (!email.includes('@')) return setErr('Zadaj platný e-mail.');
    setBusy(true);
    try { await sendLoginLink(email); setSent(true); }
    catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };

  return <div className="login-box">
    <img src="/topspin.png" alt="TOPSPIN" />
    <h1>Prihlásenie</h1>
    <p>{note || 'Zadaj svoj e-mail. Pošleme ti odkaz, ktorým sa prihlásiš — žiadne heslo si nemusíš pamätať.'}</p>
    {sent ? <div className="login-sent"><Mail size={20} />
      <div><strong>Odkaz je na ceste</strong><span>Skontroluj schránku {email} (aj priečinok Spam) a klikni na odkaz.</span></div>
    </div> : <>
      <input type="email" placeholder="tvoj@email.sk" value={email} autoComplete="email"
        onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} />
      <button className="button primary" disabled={busy} onClick={send}><LogIn size={16} />{busy ? 'Odosielam…' : 'Poslať prihlasovací odkaz'}</button>
    </>}
    {err && <p className="match-error">{err}</p>}
    <Link className="link-btn" to="/">Späť na turnaje</Link>
  </div>;
}

/** Obal, ktorý pustí ďalej len prihláseného používateľa s prístupom k turnaju. */
export function AuthGate({ slug, children, note }: { slug?: string; children: (s: Session) => React.ReactNode; note?: string }) {
  const [session, setSession] = useState<Session>(null);
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [pin, setPin] = useState('');
  const [claimErr, setClaimErr] = useState('');

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
  if (!session) return <div className="login-shell"><LoginBox note={note} /></div>;

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
