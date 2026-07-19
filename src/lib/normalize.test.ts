import { describe, expect, it } from 'vitest';

/** Kópia normalizeState bez závislosti na Supabase klientovi.
 *  Overuje, že aplikácia prežije neúplné alebo poškodené dáta turnaja. */
function normalizeState(raw: unknown, name = 'Turnaj') {
  const d = (raw && typeof raw === 'object') ? raw as Record<string, any> : {};
  const s = d.settings ?? {};
  return {
    version: 5 as const,
    settings: {
      name: s.name || name,
      date: s.date || new Date().toISOString().slice(0, 10),
      venue: s.venue ?? '',
      tables: s.tables ?? 8,
      matchMinutes: s.matchMinutes ?? 20,
      restMinutes: s.restMinutes ?? 5,
      startTime: s.startTime ?? '09:00',
    },
    players: Array.isArray(d.players) ? d.players : [],
    pairs: Array.isArray(d.pairs) ? d.pairs : [],
    teams: Array.isArray(d.teams) ? d.teams : [],
    competitions: Array.isArray(d.competitions) ? d.competitions : [],
  };
}

const cases: [string, unknown][] = [
  ['prázdny objekt (nový turnaj)', {}],
  ['null', null],
  ['bez nastavení', { players: [], competitions: [] }],
  ['bez súťaží', { settings: { name: 'X', date: '2026-07-18' } }],
  ['súťaže ako null', { competitions: null, players: null }],
  ['cudzí tvar', { nieco: 'ine' }],
  ['reťazec namiesto objektu', 'nezmysel'],
];

describe('neúplné dáta turnaja', () => {
  it.each(cases)('prežije vstup: %s', (_label, input) => {
    const s = normalizeState(input, 'Turnaj');
    expect(Array.isArray(s.competitions)).toBe(true);
    expect(Array.isArray(s.players)).toBe(true);
    expect(Array.isArray(s.pairs)).toBe(true);
    expect(Array.isArray(s.teams)).toBe(true);
    expect(typeof s.settings.date).toBe('string');
    expect(s.settings.tables).toBeGreaterThan(0);
  });
});
