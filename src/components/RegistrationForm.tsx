import { useState } from 'react';
import { Send, X } from 'lucide-react';
import { registerPlayer, type RegistrationInput } from '../lib/supabase';

const COUNTRIES = ['Slovensko', 'Česko', 'Poľsko', 'Maďarsko', 'Rakúsko', 'Iné'];

/** Prihlasovací formulár na turnaj (verejný). */
export function RegistrationForm({ slug, tournament, categories, onClose, onDone }: {
  slug: string; tournament: string; categories: string[]; onClose: () => void; onDone: () => void;
}) {
  const [f, setF] = useState<RegistrationInput>({
    first: '', last: '', club: '', year: null, license: null,
    country: 'Slovensko', gender: '', categories: [], email: '', note: '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (patch: Partial<RegistrationInput>) => setF(x => ({ ...x, ...patch }));
  const toggleCat = (c: string) => setF(x => ({ ...x, categories: x.categories.includes(c) ? x.categories.filter(y => y !== c) : [...x.categories, c] }));

  const submit = async () => {
    setErr('');
    if (!f.first.trim() || !f.last.trim()) return setErr('Vyplň meno aj priezvisko.');
    if (!f.club.trim()) return setErr('Vyplň klub / oddiel.');
    if (!f.year) return setErr('Vyplň rok narodenia.');
    if (!f.gender) return setErr('Vyber pohlavie.');
    if (categories.length > 0 && f.categories.length === 0) return setErr('Vyber aspoň jednu kategóriu.');
    if (!f.email.trim() || !f.email.includes('@')) return setErr('Vyplň platný e-mail.');
    setBusy(true);
    try { await registerPlayer(slug, f); onDone(); }
    catch (e) { setErr('Registrácia zlyhala: ' + (e as Error).message); setBusy(false); }
  };

  return <div className="modal-backdrop" onClick={onClose}><div className="modal reg" onClick={e => e.stopPropagation()}>
    <div className="modal-head"><h2>{tournament} <span className="reg-sub">/ Registrácia – hráč</span></h2><button className="icon-button" onClick={onClose}><X /></button></div>

    <div className="reg-grid">
      <label className="reg-f">Meno <b>*</b><input value={f.first} onChange={e => set({ first: e.target.value })} /></label>
      <label className="reg-f">Priezvisko <b>*</b><input value={f.last} onChange={e => set({ last: e.target.value })} /></label>
      <label className="reg-f reg-wide">Klub / oddiel <b>*</b><input value={f.club} onChange={e => set({ club: e.target.value })} /></label>
      <label className="reg-f">Rok narodenia <b>*</b><input type="number" min={1920} max={2025} value={f.year ?? ''} onChange={e => set({ year: Number(e.target.value) || null })} /></label>
      <label className="reg-f">Licencia do<input type="date" value={f.license ?? ''} onChange={e => set({ license: e.target.value || null })} /></label>
      <label className="reg-f">Krajina <b>*</b><select value={f.country} onChange={e => set({ country: e.target.value })}>{COUNTRIES.map(c => <option key={c}>{c}</option>)}</select></label>
      <label className="reg-f">Pohlavie <b>*</b><select value={f.gender} onChange={e => set({ gender: e.target.value })}>
        <option value="">Vyberte prosím</option><option value="M">Muž</option><option value="F">Žena</option></select></label>

      {categories.length > 0 && <div className="reg-f reg-wide"><span className="reg-lab">Kategórie <b>*</b></span>
        <div className="reg-cats">{categories.map(c => <label key={c} className="reg-cat">
          <input type="checkbox" checked={f.categories.includes(c)} onChange={() => toggleCat(c)} />{c}</label>)}</div>
      </div>}

      <label className="reg-f reg-wide">E-mail <b>*</b><input type="email" value={f.email} onChange={e => set({ email: e.target.value })} /></label>
      <label className="reg-f reg-wide">Požiadavky<textarea rows={3} value={f.note} onChange={e => set({ note: e.target.value })} placeholder="Strava, ubytovanie, doprava, iné" /></label>
    </div>

    {err && <p className="reg-err">{err}</p>}
    <div className="reg-actions"><button className="button primary" disabled={busy} onClick={submit}><Send size={16} />{busy ? 'Odosielam…' : 'Pridať'}</button></div>
  </div></div>;
}
