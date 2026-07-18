import { useEffect, useState } from 'react';
import { LayoutGrid, LogIn, LogOut, User, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getSession, onAuth, signInWithPassword, signOut, type Session } from '../lib/supabase';

/** Prihlásenie v hornej lište — dostupné z každej stránky.
 *  Neprihlásený vidí tlačidlo „Prihlásiť sa", prihlásený svoj e-mail. */
export function AuthBar() {
  const [session, setSession] = useState<Session>(null);
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    getSession().then(setSession);
    return onAuth(s => { setSession(s); if (s) setOpen(false); });
  }, []);

  if (!session) return <>
    <button className="auth-btn" onClick={() => setOpen(true)}><LogIn size={15} />Prihlásiť sa</button>
    {open && <LoginModal onClose={() => setOpen(false)} />}
  </>;

  return <div className="auth-user">
    <button className="auth-btn ghost" onClick={() => setMenu(m => !m)}>
      <User size={15} /><span className="auth-mail">{session.email}</span>
    </button>
    {menu && <div className="auth-menu" onMouseLeave={() => setMenu(false)}>
      <span className="auth-menu-mail">{session.email}</span>
      <Link to="/sprava" onClick={() => setMenu(false)}><LayoutGrid size={14} />Správa turnajov</Link>
      <button onClick={() => { setMenu(false); signOut(); }}><LogOut size={14} />Odhlásiť sa</button>
    </div>}
  </div>;
}

/** Okno s prihlásením — e-mail a heslo. */
export function LoginModal({ onClose, note }: { onClose: () => void; note?: string }) {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setErr('');
    if (!email.includes('@')) return setErr('Zadaj platný e-mail.');
    if (!pass) return setErr('Zadaj heslo.');
    setBusy(true);
    try { await signInWithPassword(email, pass); onClose(); }
    catch (e) {
      const msg = String((e as Error).message || '');
      setErr(/invalid login credentials/i.test(msg) ? 'Nesprávny e-mail alebo heslo.' : msg);
      setBusy(false);
    }
  };

  return <div className="modal-backdrop" onClick={onClose}><div className="modal auth-modal" onClick={e => e.stopPropagation()}>
    <div className="modal-head"><h2>Prihlásenie</h2><button className="icon-button" onClick={onClose}><X /></button></div>
    <div className="auth-modal-body">
      {note && <p>{note}</p>}
      <input type="email" placeholder="E-mail" value={email} autoComplete="username" autoFocus
        onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} />
      <input type="password" placeholder="Heslo" value={pass} autoComplete="current-password"
        onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} />
      <button className="button primary" disabled={busy} onClick={send}><LogIn size={16} />{busy ? 'Prihlasujem…' : 'Prihlásiť sa'}</button>
      {err && <p className="match-error">{err}</p>}
    </div>
  </div></div>;
}
