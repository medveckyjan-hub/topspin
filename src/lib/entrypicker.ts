import type { GenericEntry, Player } from '../types';

/**
 * Hromadný výber účastníkov do súťaže.
 *
 * Pri 460 hráčoch importovaných z Excelu je klikanie po jednom neúnosné.
 * Logika je tu, nie v zobrazení, aby sa dala otestovať.
 */

export type EntryFilter = {
  /** Hľadanie v mene a klube. */
  q?: string;
  /** Presný klub, alebo prázdne = všetky. */
  club?: string;
  /** 'M' | 'F' | 'X' podľa pohlavia hráča, alebo prázdne = všetci. */
  gender?: string;
  /** Zobraziť len už vybraných / len nevybraných. */
  only?: 'selected' | 'unselected';
};

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Pohlavie prihlášky: pri páre a družstve podľa členov (zmiešané = 'X'). */
export function entryGender(e: GenericEntry, players: Player[]): string {
  const pm = new Map(players.map(p => [p.id, p]));
  const gs = new Set(e.memberIds.map(id => pm.get(id)?.gender).filter(Boolean) as string[]);
  if (gs.size === 0) return '';
  if (gs.size === 1) return [...gs][0];
  return 'X';
}

/** Zoznam klubov, ktoré sa medzi prihláškami vyskytujú. */
export function clubsOf(entries: GenericEntry[]): string[] {
  return [...new Set(entries.map(e => e.club).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'sk'));
}

/** Prihlášky po použití filtra. Diakritika sa pri hľadaní ignoruje. */
export function filterEntries(
  entries: GenericEntry[],
  filter: EntryFilter,
  selected: string[],
  players: Player[] = [],
): GenericEntry[] {
  const q = norm((filter.q ?? '').trim());
  const sel = new Set(selected);
  return entries.filter(e => {
    if (q && !norm(e.name).includes(q) && !norm(e.club || '').includes(q)) return false;
    if (filter.club && e.club !== filter.club) return false;
    if (filter.gender && entryGender(e, players) !== filter.gender) return false;
    if (filter.only === 'selected' && !sel.has(e.id)) return false;
    if (filter.only === 'unselected' && sel.has(e.id)) return false;
    return true;
  });
}

/** Pridá zobrazené prihlášky k výberu, poradie zachová a nič nezduplikuje. */
export function selectAll(selected: string[], shown: GenericEntry[]): string[] {
  const have = new Set(selected);
  return [...selected, ...shown.map(e => e.id).filter(id => !have.has(id))];
}

/** Odoberie zobrazené prihlášky z výberu. */
export function deselectAll(selected: string[], shown: GenericEntry[]): string[] {
  const drop = new Set(shown.map(e => e.id));
  return selected.filter(id => !drop.has(id));
}

/** Otočí výber medzi zobrazenými. */
export function invertSelection(selected: string[], shown: GenericEntry[]): string[] {
  const sel = new Set(selected);
  const shownIds = shown.map(e => e.id);
  const keep = selected.filter(id => !shownIds.includes(id));
  return [...keep, ...shownIds.filter(id => !sel.has(id))];
}

/** Koľko zo zobrazených je vybraných — pre stav hlavného políčka. */
export function selectionState(selected: string[], shown: GenericEntry[]): 'none' | 'some' | 'all' {
  if (!shown.length) return 'none';
  const sel = new Set(selected);
  const n = shown.filter(e => sel.has(e.id)).length;
  return n === 0 ? 'none' : n === shown.length ? 'all' : 'some';
}
