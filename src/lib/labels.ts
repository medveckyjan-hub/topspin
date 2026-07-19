/**
 * Označovanie skupín.
 *
 * Pôvodne sa skupiny pomenúvali cez String.fromCharCode(65 + i), takže po
 * skupine Z nasledovali znaky „[", „\" a „]". Pri 460 hráčoch, teda 115
 * skupinách, bol rozpis nepoužiteľný.
 *
 * Súbor zámerne nič neimportuje — používa ho jadro aj zobrazenie.
 */

/** Poradie písmen podľa dohody. Písmeno W sa nepoužíva. */
export const GROUP_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVXYZ';

/**
 * Označenie skupiny podľa poradia (počíta sa od nuly):
 *   A … Z        prvých 25
 *   A1 … Z1      ďalších 25
 *   AA1 … AZ1    ďalších 25
 *   AA2 … AZ2, AA3 … AZ3, … ďalej bez obmedzenia
 */
export function groupLabel(index: number): string {
  const n = GROUP_LETTERS.length;
  if (index < 0) return GROUP_LETTERS[0];
  if (index < n) return GROUP_LETTERS[index];
  if (index < n * 2) return `${GROUP_LETTERS[index - n]}1`;
  const rest = index - n * 2;
  return `A${GROUP_LETTERS[rest % n]}${Math.floor(rest / n) + 1}`;
}

/** Celý názov skupiny tak, ako sa zobrazuje. */
export const groupName = (index: number): string => `Skupina ${groupLabel(index)}`;
