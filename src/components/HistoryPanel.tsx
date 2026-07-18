import { useEffect, useState } from 'react';
import { History, RotateCcw } from 'lucide-react';
import { listHistory, restoreHistory, type HistoryEntry } from '../lib/supabase';
import type { TournamentState } from '../types';

/** História uložení — posledných 50 verzií, s možnosťou vrátiť sa späť. */
export function HistoryPanel({ slug, onRestore }: {
  slug: string; onRestore: (s: TournamentState) => void;
}) {
  const [rows, setRows] = useState<HistoryEntry[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setErr('');
    try { setRows(await listHistory(slug)); }
    catch (e) { setErr((e as Error).message); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [slug]);

  const back = async (h: HistoryEntry) => {
    if (!confirm(`Vrátiť turnaj do stavu z ${new Date(h.saved_at).toLocaleString('sk-SK')}? Aktuálny stav sa najprv odloží do histórie, takže sa vieš vrátiť späť.`)) return;
    setBusy(true);
    try { onRestore(await restoreHistory(slug, h.id)); await load(); }
    catch (e) { alert((e as Error).message); }
    setBusy(false);
  };

  return <section className="card">
    <div className="card-header"><h2><History size={18} /> História zmien</h2><button className="button" onClick={load}>Obnoviť</button></div>
    <p className="field-hint">Každé uloženie sa odkladá na server. Ak sa niečo pokazí (zlé prežrebovanie, zmazaná skupina), vráť sa na predchádzajúci stav.</p>
    {err ? <p className="muted">{err}</p> : rows.length === 0 ? <p className="muted">Zatiaľ žiadne uložené verzie.</p> :
      <div className="table-scroll"><table><thead><tr><th>Verzia</th><th>Uložené</th><th /></tr></thead><tbody>
        {rows.map(h => <tr key={h.id}><td><b>{h.version ?? '—'}</b></td>
          <td>{new Date(h.saved_at).toLocaleString('sk-SK')}</td>
          <td><button className="button" disabled={busy} onClick={() => back(h)}><RotateCcw size={15} />Vrátiť sem</button></td></tr>)}
      </tbody></table></div>}
  </section>;
}
