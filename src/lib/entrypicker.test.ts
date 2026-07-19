import { describe, expect, it } from 'vitest';
import {
  clubsOf, deselectAll, entryGender, filterEntries, invertSelection, selectAll, selectionState,
} from './entrypicker';
import type { GenericEntry, Player } from '../types';

/** Po importe 460 hráčov z Excelu sa musia dať pridať do súťaže naraz. */
const players: Player[] = [
  { id: 'p1', name: 'Adam Novák', club: 'STO Grob', rating: 500, gender: 'M' },
  { id: 'p2', name: 'Božena Kováčová', club: 'ŠKST BA', rating: 480, gender: 'F' },
  { id: 'p3', name: 'Cyril Šimko', club: 'STO Grob', rating: 460, gender: 'M' },
  { id: 'p4', name: 'Dáša Horváthová', club: 'MSK Malacky', rating: 440, gender: 'F' },
];
const entries: GenericEntry[] = players.map(p => ({ id: p.id, name: p.name, club: p.club, rating: p.rating, memberIds: [p.id] }));

describe('hromadný výber účastníkov', () => {
  it('označí naraz všetkých zobrazených', () => {
    expect(selectAll([], entries)).toHaveLength(4);
  });

  it('opakované označenie nič nezduplikuje', () => {
    const raz = selectAll([], entries);
    expect(selectAll(raz, entries)).toEqual(raz);
  });

  it('označenie zachová tých, čo už boli vybraní', () => {
    expect(selectAll(['p3'], entries)[0]).toBe('p3');
  });

  it('odznačí naraz všetkých zobrazených', () => {
    expect(deselectAll(selectAll([], entries), entries)).toEqual([]);
  });

  it('odznačenie sa dotkne len zobrazených, ostatní zostanú', () => {
    const vybrani = selectAll([], entries);
    const zobrazeni = entries.filter(e => e.club === 'STO Grob');
    const po = deselectAll(vybrani, zobrazeni);
    expect(po).toHaveLength(2);
    expect(po).not.toContain('p1');
    expect(po).toContain('p2');
  });

  it('hľadanie ignoruje diakritiku aj veľkosť písmen', () => {
    expect(filterEntries(entries, { q: 'simko' }, [], players).map(e => e.id)).toEqual(['p3']);
    expect(filterEntries(entries, { q: 'NOVAK' }, [], players).map(e => e.id)).toEqual(['p1']);
  });

  it('hľadá aj podľa klubu', () => {
    expect(filterEntries(entries, { q: 'grob' }, [], players)).toHaveLength(2);
  });

  it('filtruje podľa klubu', () => {
    expect(filterEntries(entries, { club: 'MSK Malacky' }, [], players).map(e => e.id)).toEqual(['p4']);
  });

  it('filtruje podľa pohlavia — všetky dievčatá naraz', () => {
    const dievcata = filterEntries(entries, { gender: 'F' }, [], players);
    expect(dievcata.map(e => e.id)).toEqual(['p2', 'p4']);
    expect(selectAll([], dievcata)).toEqual(['p2', 'p4']);
  });

  it('filtruje na už vybraných a na ešte nevybraných', () => {
    expect(filterEntries(entries, { only: 'selected' }, ['p1'], players).map(e => e.id)).toEqual(['p1']);
    expect(filterEntries(entries, { only: 'unselected' }, ['p1'], players)).toHaveLength(3);
  });

  it('pár muža a ženy je zmiešaný', () => {
    const par: GenericEntry = { id: 'x1', name: 'Novák / Kováčová', club: '', rating: 980, memberIds: ['p1', 'p2'] };
    expect(entryGender(par, players)).toBe('X');
    const muzsky: GenericEntry = { id: 'x2', name: 'Novák / Šimko', club: '', rating: 960, memberIds: ['p1', 'p3'] };
    expect(entryGender(muzsky, players)).toBe('M');
  });

  it('otočenie výberu prehodí zobrazených a ostatných nechá', () => {
    const po = invertSelection(['p1'], entries);
    expect(po).not.toContain('p1');
    expect(po).toHaveLength(3);
  });

  it('stav označenia rozlíši nič, časť a všetko', () => {
    expect(selectionState([], entries)).toBe('none');
    expect(selectionState(['p1'], entries)).toBe('some');
    expect(selectionState(entries.map(e => e.id), entries)).toBe('all');
  });

  it('zoznam klubov je bez duplikátov a zoradený', () => {
    expect(clubsOf(entries)).toEqual(['MSK Malacky', 'STO Grob', 'ŠKST BA']);
  });

  it('zvládne 460 hráčov jedným kliknutím', () => {
    const vela: GenericEntry[] = Array.from({ length: 460 }, (_, i) => ({
      id: `v${i}`, name: `Hráč ${i}`, club: `Klub ${i % 30}`, rating: 500 - i, memberIds: [`v${i}`],
    }));
    const vybrani = selectAll([], vela);
    expect(vybrani).toHaveLength(460);
    expect(new Set(vybrani).size).toBe(460);
    const jedenKlub = filterEntries(vela, { club: 'Klub 7' }, [], []);
    expect(selectAll([], jedenKlub)).toHaveLength(jedenKlub.length);
  });
});
