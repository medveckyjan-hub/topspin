import { useMemo, useState } from 'react';
import { CheckSquare, Square, Users, X } from 'lucide-react';
import {
  clubsOf, deselectAll, entryGender, filterEntries, invertSelection, selectAll, selectionState,
  type EntryFilter,
} from '../lib/entrypicker';
import type { GenericEntry, Player } from '../types';

/**
 * Výber účastníkov do súťaže s hromadným označovaním.
 *
 * Po importe 460 hráčov z Excelu je klikanie po jednom neúnosné, preto sa dá
 * označiť naraz všetko zobrazené — a zobrazenie sa dá zúžiť hľadaním,
 * klubom alebo pohlavím (napr. všetky dievčatá do súťaže žiačok).
 */
export function EntryPicker({ entries, selected, players, onChange }: {
  entries: GenericEntry[];
  selected: string[];
  players: Player[];
  onChange: (ids: string[]) => void;
}) {
  const [f, setF] = useState<EntryFilter>({ q: '', club: '', gender: '', only: undefined });
  const kluby = useMemo(() => clubsOf(entries), [entries]);
  const shown = useMemo(() => filterEntries(entries, f, selected, players), [entries, f, selected, players]);
  const stav = selectionState(selected, shown);
  const filtrujeSa = !!(f.q || f.club || f.gender || f.only);

  return <div className="picker">
    <div className="picker-tools">
      <input
        className="picker-search"
        placeholder="Hľadať meno alebo klub…"
        value={f.q ?? ''}
        onChange={e => setF(x => ({ ...x, q: e.target.value }))}
      />
      <select value={f.club ?? ''} onChange={e => setF(x => ({ ...x, club: e.target.value }))}>
        <option value="">Všetky kluby</option>
        {kluby.map(k => <option key={k} value={k}>{k}</option>)}
      </select>
      <select value={f.gender ?? ''} onChange={e => setF(x => ({ ...x, gender: e.target.value }))}>
        <option value="">Muži aj ženy</option>
        <option value="M">Muži / chlapci</option>
        <option value="F">Ženy / dievčatá</option>
        <option value="X">Zmiešané</option>
      </select>
      <select value={f.only ?? ''} onChange={e => setF(x => ({ ...x, only: (e.target.value || undefined) as EntryFilter['only'] }))}>
        <option value="">Všetci</option>
        <option value="selected">Len vybraní</option>
        <option value="unselected">Len nevybraní</option>
      </select>
      {filtrujeSa && <button className="button ghost" onClick={() => setF({ q: '', club: '', gender: '', only: undefined })}>
        <X size={15} />Zrušiť filter
      </button>}
    </div>

    <div className="picker-bulk">
      <button className="button" onClick={() => onChange(selectAll(selected, shown))} disabled={stav === 'all'}>
        <CheckSquare size={16} />Označiť {filtrujeSa ? 'zobrazených' : 'všetkých'} ({shown.length})
      </button>
      <button className="button" onClick={() => onChange(deselectAll(selected, shown))} disabled={stav === 'none'}>
        <Square size={16} />Odznačiť {filtrujeSa ? 'zobrazených' : 'všetkých'}
      </button>
      <button className="button ghost" onClick={() => onChange(invertSelection(selected, shown))}>
        Otočiť výber
      </button>
      <span className="picker-count">
        <Users size={15} />vybraných <strong>{selected.length}</strong>
        {filtrujeSa && <> · zobrazených {shown.length} z {entries.length}</>}
      </span>
    </div>

    {shown.length === 0
      ? <p className="muted">Filtru nezodpovedá nikto.</p>
      : <div className="check-list compact-list">{shown.map(e => <label key={e.id}>
        <input
          type="checkbox"
          checked={selected.includes(e.id)}
          onChange={ev => onChange(ev.target.checked
            ? selectAll(selected, [e])
            : deselectAll(selected, [e]))}
        />
        <span className="pick-name">{e.name}</span>
        {e.club && <span className="pick-club">{e.club}</span>}
        {players.length > 0 && entryGender(e, players) === 'F' && <span className="pick-g">Ž</span>}
      </label>)}</div>}
  </div>;
}
