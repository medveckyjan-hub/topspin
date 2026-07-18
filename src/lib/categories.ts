/** Katalóg vekových kategórií a pohlavných zložiek pre turnaje.
 *  Vek sa počíta k dátumu turnaja z roku narodenia hráča. */

export type GenderMode = 'M' | 'F' | 'MIX';

export type AgeCategoryDef = {
  id: string;
  group: string;
  /** Označenie pre chlapčenskú / mužskú zložku */
  labelM: string;
  /** Označenie pre dievčenskú / ženskú zložku */
  labelF: string;
  /** Označenie pri spoločnej súťaži */
  labelX: string;
  minAge?: number;
  maxAge?: number;
  /** Veterán = kategória od uvedeného veku vyššie */
  veteranOf?: GenderMode;
};

const u = (n: number): AgeCategoryDef => ({
  id: `U${n}`, group: 'U kategórie', labelM: `U${n} chlapci`, labelF: `U${n} dievčatá`, labelX: `U${n}`, maxAge: n,
});
const vet = (g: 'M' | 'W', n: number): AgeCategoryDef => ({
  id: `${g}${n}`, group: g === 'M' ? 'Veteráni – muži' : 'Veteránky – ženy',
  labelM: `${g}${n}`, labelF: `${g}${n}`, labelX: `${g}${n}`, minAge: n, veteranOf: g === 'M' ? 'M' : 'F',
});

export const AGE_CATEGORIES: AgeCategoryDef[] = [
  { id: 'NAJML_ZIACI', group: 'Mládež', labelM: 'Najmladší žiaci', labelF: 'Najmladšie žiačky', labelX: 'Najmladšie žiactvo', maxAge: 11 },
  { id: 'ML_ZIACI', group: 'Mládež', labelM: 'Mladší žiaci', labelF: 'Mladšie žiačky', labelX: 'Mladšie žiactvo', maxAge: 13 },
  { id: 'ST_ZIACI', group: 'Mládež', labelM: 'Starší žiaci', labelF: 'Staršie žiačky', labelX: 'Staršie žiactvo', maxAge: 15 },
  { id: 'DORAST', group: 'Mládež', labelM: 'Dorastenci', labelF: 'Dorastenky', labelX: 'Dorast', maxAge: 18 },
  { id: 'JUNIORI', group: 'Mládež', labelM: 'Juniori', labelF: 'Juniorky', labelX: 'Juniori', maxAge: 21 },
  { id: 'DOSPELI', group: 'Dospelí', labelM: 'Muži', labelF: 'Ženy', labelX: 'Muži a ženy' },
  { id: 'VETERANI', group: 'Veteráni', labelM: 'Veteráni', labelF: 'Veteránky', labelX: 'Veteráni', minAge: 40 },
  ...[11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23].map(u),
  ...[40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90].map(n => vet('M', n)),
  ...[40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90].map(n => vet('W', n)),
];

export const CATEGORY_GROUPS = ['Mládež', 'Dospelí', 'Veteráni', 'U kategórie', 'Veteráni – muži', 'Veteránky – ženy'];

/** Kategória priradená konkrétnej súťaži (z katalógu alebo vlastná). */
export type CompetitionCategory = {
  /** id z katalógu, alebo 'CUSTOM' pre vlastnú */
  id: string;
  gender: GenderMode;
  /** vlastný názov (len pri id === 'CUSTOM') */
  customLabel?: string;
  /** vlastné vekové ohraničenie — nepovinné, môže byť aj bez neho */
  minAge?: number;
  maxAge?: number;
};

export const findCategory = (id: string): AgeCategoryDef | undefined => AGE_CATEGORIES.find(c => c.id === id);

export const genderLabel = (g: GenderMode): string => (g === 'M' ? 'chlapci / muži' : g === 'F' ? 'dievčatá / ženy' : 'spoločne');

/** Názov kategórie pre zobrazenie, napr. „Starší žiaci" alebo „U15 dievčatá". */
export function categoryLabel(cat?: CompetitionCategory): string {
  if (!cat) return '';
  if (cat.id === 'CUSTOM') return cat.customLabel?.trim() || 'Vlastná kategória';
  const def = findCategory(cat.id);
  if (!def) return '';
  const base = cat.gender === 'M' ? def.labelM : cat.gender === 'F' ? def.labelF : def.labelX;
  return cat.gender === 'MIX' && def.labelX === base ? base : base;
}

/** Skutočné vekové ohraničenie súťaže (vlastné prebíja katalógové). */
export function categoryLimits(cat?: CompetitionCategory): { minAge?: number; maxAge?: number } {
  if (!cat) return {};
  const def = cat.id === 'CUSTOM' ? undefined : findCategory(cat.id);
  return { minAge: cat.minAge ?? def?.minAge, maxAge: cat.maxAge ?? def?.maxAge };
}

/** Vek hráča k dátumu turnaja (z roku narodenia). */
export const ageAt = (birthYear: number, tournamentDate: string): number =>
  (Number(tournamentDate.slice(0, 4)) || new Date().getFullYear()) - birthYear;

/** Spĺňa hráč kategóriu? Vracia dôvod, ak nie. */
export function checkEligibility(
  cat: CompetitionCategory | undefined,
  player: { birthYear?: number | null; gender?: string },
  tournamentDate: string,
): { ok: boolean; reason?: string } {
  if (!cat) return { ok: true };
  if (cat.gender !== 'MIX' && player.gender && player.gender !== cat.gender) {
    return { ok: false, reason: `Kategória je len pre ${cat.gender === 'M' ? 'chlapcov / mužov' : 'dievčatá / ženy'}.` };
  }
  const { minAge, maxAge } = categoryLimits(cat);
  if ((minAge != null || maxAge != null)) {
    if (!player.birthYear) return { ok: false, reason: 'Chýba rok narodenia.' };
    const age = ageAt(player.birthYear, tournamentDate);
    if (minAge != null && age < minAge) return { ok: false, reason: `Kategória je od ${minAge} rokov (hráč má ${age}).` };
    if (maxAge != null && age > maxAge) return { ok: false, reason: `Kategória je do ${maxAge} rokov (hráč má ${age}).` };
  }
  return { ok: true };
}
