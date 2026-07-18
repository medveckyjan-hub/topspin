import { useEffect, useState } from 'react';
import { FileText, Images, Trash2, UserPlus, Video } from 'lucide-react';
import {
  addMedia, deleteMedia, deleteRegistration, listMedia, listRegistrationsAdmin, uploadMedia, embedUrl,
  type MediaItem, type MediaKind, type Registration,
} from '../lib/supabase';
import type { Player, TournamentState } from '../types';

const uid = () => Math.random().toString(36).slice(2, 10);

/** Organizátorská správa registrácií a médií. Súbory idú do Supabase Storage,
 *  v turnaji sa neukladajú — stránka tak ostáva rýchla. */
export function RegistrationsAdmin({ slug, pin, state, setState, setNotice }: {
  slug: string; pin: string; state: TournamentState;
  setState: React.Dispatch<React.SetStateAction<TournamentState>>;
  setNotice: (s: string) => void;
}) {
  const [regs, setRegs] = useState<Registration[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoTitle, setVideoTitle] = useState('');

  const load = async () => {
    setErr('');
    try { setRegs(await listRegistrationsAdmin(slug, pin)); } catch (e) { setErr((e as Error).message); }
    try { setMedia(await listMedia(slug)); } catch { /* ignore */ }
  };
  useEffect(() => { load(); }, [slug]);

  const inTournament = (r: Registration) =>
    state.players.some(p => p.name.trim().toLowerCase() === `${r.first_name} ${r.last_name}`.trim().toLowerCase());

  const addToPlayers = (r: Registration) => {
    if (inTournament(r)) return;
    const p: Player = { id: uid(), name: `${r.first_name} ${r.last_name}`, club: r.club || '', rating: 0, gender: r.gender === 'F' ? 'F' : 'M' };
    setState(s => ({ ...s, players: [...s.players, p] }));
  };
  const addAll = () => {
    const add = regs.filter(r => !inTournament(r)).map(r => ({
      id: uid(), name: `${r.first_name} ${r.last_name}`, club: r.club || '', rating: 0,
      gender: (r.gender === 'F' ? 'F' : 'M') as Player['gender'],
    }));
    if (!add.length) return setNotice('Všetci prihlásení sú už medzi hráčmi.');
    setState(s => ({ ...s, players: [...s.players, ...add] }));
    setNotice(`Pridaných ${add.length} hráčov z registrácie.`);
  };
  const removeReg = async (id: string) => {
    if (!confirm('Zmazať túto prihlášku?')) return;
    try { await deleteRegistration(slug, pin, id); load(); } catch (e) { alert((e as Error).message); }
  };

  const upload = async (file: File | undefined, kind: MediaKind, title: string) => {
    if (!file) return;
    setBusy(kind);
    try { const url = await uploadMedia(slug, file, pin); await addMedia(slug, pin, kind, url, title || file.name); await load(); }
    catch (e) { alert('Nahranie zlyhalo: ' + (e as Error).message); }
    setBusy('');
  };
  const uploadMany = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy('photo');
    for (const f of Array.from(files)) {
      try { const url = await uploadMedia(slug, f, pin); await addMedia(slug, pin, 'photo', url, f.name); } catch { /* ignore */ }
    }
    await load(); setBusy('');
  };
  const addVideo = async () => {
    if (!videoUrl.trim()) return;
    try { await addMedia(slug, pin, 'video', videoUrl.trim(), videoTitle.trim()); setVideoUrl(''); setVideoTitle(''); load(); }
    catch (e) { alert((e as Error).message); }
  };
  const removeMedia = async (id: string) => {
    if (!confirm('Zmazať túto položku?')) return;
    try { await deleteMedia(slug, pin, id); load(); } catch (e) { alert((e as Error).message); }
  };

  const props = media.filter(m => m.kind === 'propozicie');
  const photos = media.filter(m => m.kind === 'photo');
  const vids = media.filter(m => m.kind === 'video');

  return <div className="matches-stack">
    <section className="card">
      <div className="card-header"><h2>Prihlásení ({regs.length})</h2><div className="row-actions">
        <button className="button primary" onClick={addAll}><UserPlus size={15} />Pridať všetkých k hráčom</button>
        <button className="button" onClick={load}>Obnoviť</button></div></div>
      {err ? <p className="muted">{err}</p> : regs.length === 0 ? <p className="muted">Zatiaľ žiadne prihlášky. Odkaz na registráciu je na verejnej stránke turnaja.</p> :
        <div className="table-scroll"><table><thead><tr><th>#</th><th>Meno</th><th>Klub</th><th>Rok</th><th>Licencia</th><th>Poh.</th><th>Kategórie</th><th>E-mail</th><th>Požiadavky</th><th /></tr></thead><tbody>
          {regs.map((r, i) => <tr key={r.id}><td>{i + 1}</td>
            <td><strong>{r.first_name} {r.last_name}</strong></td><td>{r.club || '—'}</td>
            <td>{r.birth_year ?? '—'}</td><td>{r.license_until ? new Date(r.license_until).toLocaleDateString('sk-SK') : '—'}</td>
            <td>{r.gender}</td><td>{r.categories?.join(', ') || '—'}</td>
            <td className="reg-mail">{r.email || '—'}</td><td className="reg-mail">{r.note || '—'}</td>
            <td><div className="row-actions">
              {inTournament(r) ? <span className="pill">v turnaji</span> : <button className="button" onClick={() => addToPlayers(r)}>Pridať</button>}
              <button className="icon-button danger" onClick={() => removeReg(r.id)}><Trash2 size={15} /></button>
            </div></td></tr>)}
        </tbody></table></div>}
    </section>

    <section className="card form-card"><h2>Propozície (PDF)</h2>
      <label className="upload"><FileText /><div><strong>{busy === 'propozicie' ? 'Nahrávam…' : 'Nahrať PDF propozície'}</strong><span>Súbor sa uloží do úložiska, nie do turnaja</span></div>
        <input type="file" accept="application/pdf" onChange={e => upload(e.target.files?.[0], 'propozicie', '')} /></label>
      {props.length > 0 && <div className="media-admin">{props.map(m => <div className="media-arow" key={m.id}>
        <a href={m.url} target="_blank" rel="noreferrer">{m.title || 'Propozície'}</a>
        <button className="icon-button danger" onClick={() => removeMedia(m.id)}><Trash2 size={15} /></button></div>)}</div>}
    </section>

    <section className="card form-card"><h2>Fotogaléria</h2>
      <label className="upload"><Images /><div><strong>{busy === 'photo' ? 'Nahrávam…' : 'Nahrať fotky'}</strong><span>Môžeš vybrať viac súborov naraz</span></div>
        <input type="file" accept="image/*" multiple onChange={e => uploadMany(e.target.files)} /></label>
      {photos.length > 0 && <div className="gallery gallery-admin">{photos.map(m => <div className="gal-item" key={m.id}>
        <img src={m.url} alt={m.title} loading="lazy" />
        <button className="gal-x" onClick={() => removeMedia(m.id)}><Trash2 size={14} /></button></div>)}</div>}
    </section>

    <section className="card form-card"><h2>Videá</h2>
      <div className="player-form">
        <input placeholder="Odkaz na YouTube / Vimeo" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} />
        <input placeholder="Popis (nepovinné)" value={videoTitle} onChange={e => setVideoTitle(e.target.value)} />
        <button className="button primary" onClick={addVideo}><Video size={16} />Pridať video</button>
      </div>
      {vids.length > 0 && <div className="media-admin">{vids.map(m => <div className="media-arow" key={m.id}>
        <a href={embedUrl(m.url)} target="_blank" rel="noreferrer">{m.title || m.url}</a>
        <button className="icon-button danger" onClick={() => removeMedia(m.id)}><Trash2 size={15} /></button></div>)}</div>}
    </section>
  </div>;
}
