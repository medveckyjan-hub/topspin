import { useEffect, useState } from 'react';
import { LogIn, LogOut, Mail, User, X } from 'lucide-react';
import { getSession, onAuth, sendLoginLink, signOut, type Session } from '../lib/supabase';

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
      <button onClick={() => { setMenu(false); signOut(); }}><LogOut size={14} />Odhlásiť sa</button>
    </div>}
  </div>;
}

/** Okno s prihlásením e-mailom (bez hesla). */
export function LoginModal({ onClose, note }: { onClose: () => void; note?: string }) {
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

  return <div className="modal-backdrop" onClick={onClose}><div className="modal auth-modal" onClick={e => e.stopPropagation()}>
    <div className="modal-head"><h2>Prihlásenie</h2><button className="icon-button" onClick={onClose}><X /></button></div>
    <div className="auth-modal-body">
      <p>{note || 'Zadaj svoj e-mail. Pošleme ti odkaz, ktorým sa prihlásiš — žiadne heslo si nemusíš pamätať.'}</p>
      {sent ? <div className="login-sent"><Mail size={20} />
        <div><strong>Odkaz je na ceste</strong><span>Skontroluj schránku {email} aj priečinok Spam a klikni na odkaz.</span></div>
      </div> : <>
        <input type="email" placeholder="tvoj@email.sk" value={email} autoComplete="email" autoFocus
          onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} />
        <button className="button primary" disabled={busy} onClick={send}><LogIn size={16} />{busy ? 'Odosielam…' : 'Poslať prihlasovací odkaz'}</button>
      </>}
      {err && <p className="match-error">{err}</p>}
    </div>
  </div></div>;
}
