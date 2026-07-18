/** Jednotné formátovanie dátumu a času pre celý systém (deň. mesiac. rok). */

/** '2026-07-17' → '17. 7. 2026'. Prázdny alebo neplatný vstup vráti prázdny reťazec. */
export function skDate(value?: string | null): string {
  if (!value) return '';
  const iso = String(value).slice(0, 10);
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${Number(m[3])}. ${Number(m[2])}. ${m[1]}`;
  const d = new Date(value);
  return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('sk-SK');
}

/** '2026-07-17' + '09:25' → '17. 7. 2026 09:25' */
export function skDateTime(value?: string | null, time?: string | null): string {
  const d = skDate(value);
  return time ? `${d} ${time}`.trim() : d;
}
