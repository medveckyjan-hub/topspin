import { createClient } from '@supabase/supabase-js';
import type { TournamentState } from '../types';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const cloudReady = Boolean(url && anon);
export const supabase = cloudReady ? createClient(url, anon) : (null as unknown as ReturnType<typeof createClient>);

export type TournamentListItem = { id: string; slug: string; name: string; date: string; updated_at: string };

/** Verejný zoznam turnajov (bez PIN, bez dát). */
export async function listTournaments(): Promise<TournamentListItem[]> {
  const { data, error } = await supabase.rpc('topspin_list_tournaments');
  if (error) throw error;
  return (data ?? []) as TournamentListItem[];
}

/** Verejné načítanie jedného turnaja (bez PIN). */
export async function getTournament(slug: string): Promise<{ name: string; slug: string; data: TournamentState; version: number } | null> {
  const { data, error } = await supabase.rpc('topspin_get_tournament', { p_slug: slug });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row ? { name: row.name, slug: row.slug, data: row.data as TournamentState, version: Number(row.version ?? 0) } : null;
}

/** Založenie turnaja – gated tajným admin kódom; vracia slug. */
export async function createTournament(name: string): Promise<string> {
  const { data, error } = await supabase.rpc('topspin_create_tournament', { p_name: name });
  if (error) throw error;
  return data as string;
}


/** Overenie PIN pre admin prístup k turnaju. */
export async function verifyPin(slug: string, pin: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('topspin_verify_pin', { p_slug: slug, p_pin: pin });
  if (error) throw error;
  return data === true;
}

/** Uloženie stavu turnaja – server overí PIN. */
/** Uloženie s kontrolou verzie. Ak medzitým uložil niekto iný, server vráti CONFLICT
 *  a my zmeny neprepíšeme. Vracia novú verziu. */
export async function saveTournament(slug: string, data: TournamentState, version?: number): Promise<number> {
  const { data: res, error } = await supabase.rpc('topspin_save_tournament', {
    p_slug: slug, p_data: data, ...(version != null ? { p_version: version } : {}),
  });
  if (error) throw error;
  return Number(res ?? 0);
}

export const isConflict = (e: unknown): boolean => String((e as Error)?.message || '').includes('CONFLICT');

// ---------- História zmien ----------
export type HistoryEntry = { id: number; version: number; saved_at: string };

export async function listHistory(slug: string): Promise<HistoryEntry[]> {
  const { data, error } = await supabase.rpc('topspin_history_list', { p_slug: slug });
  if (error) throw error;
  return (data ?? []) as HistoryEntry[];
}

export async function restoreHistory(slug: string, id: number): Promise<TournamentState> {
  const { data, error } = await supabase.rpc('topspin_history_restore', { p_slug: slug, p_id: id });
  if (error) throw error;
  return data as TournamentState;
}

// ---------- Otvorenie / uzávierka registrácie ----------
export async function getRegistrationState(slug: string): Promise<{ reg_open: boolean; reg_deadline: string | null }> {
  const { data, error } = await supabase.rpc('topspin_registration_state', { p_slug: slug });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { reg_open: row?.reg_open ?? true, reg_deadline: row?.reg_deadline ?? null };
}

export async function setRegistrationState(slug: string, open: boolean, deadline: string | null): Promise<void> {
  const { error } = await supabase.rpc('topspin_set_registration', { p_slug: slug, p_open: open, p_deadline: deadline });
  if (error) throw error;
}

/** Zmazanie turnaja – server overí PIN. */
export async function deleteTournament(slug: string): Promise<void> {
  const { error } = await supabase.rpc('topspin_delete_tournament', { p_slug: slug });
  if (error) throw error;
}

export type DbPlayer = { name: string; club: string; rating: number; gender: string; photo?: string };

/** Vyhľadanie hráčov v spoločnej databáze podľa mena. */
export async function searchPlayers(q: string): Promise<DbPlayer[]> {
  const { data, error } = await supabase.rpc('topspin_search_players', { q });
  if (error) throw error;
  return (data ?? []) as DbPlayer[];
}

/** Uloženie/aktualizácia hráča v spoločnej databáze (podľa mena). */
export async function upsertPlayer(p: DbPlayer): Promise<void> {
  const { error } = await supabase.rpc('topspin_upsert_player', { p_name: p.name, p_club: p.club, p_rating: p.rating, p_gender: p.gender, p_photo: p.photo ?? null });
  if (error) throw error;
}

/** Celá databáza hráčov (naprieč turnajmi). */
export async function listPlayers(): Promise<DbPlayer[]> {
  return searchPlayers('');
}

// ---------- Registrácia do turnaja ----------
export type Registration = {
  id: string; first_name: string; last_name: string; club: string;
  birth_year: number | null; license_until: string | null; country: string;
  gender: string; categories: string[]; email?: string | null; note?: string | null;
  checked_in?: boolean; paid?: boolean; created_at: string;
};
export type RegistrationInput = {
  first: string; last: string; club: string; year: number | null; license: string | null;
  country: string; gender: string; categories: string[]; email: string; note: string;
};

export async function listRegistrations(slug: string): Promise<Registration[]> {
  const { data, error } = await supabase.rpc('topspin_list_registrations', { p_slug: slug });
  if (error) throw error;
  return (data ?? []) as Registration[];
}

export async function registerPlayer(slug: string, r: RegistrationInput): Promise<void> {
  const { error } = await supabase.rpc('topspin_register', {
    p_slug: slug, p_first: r.first, p_last: r.last, p_club: r.club, p_year: r.year,
    p_license: r.license, p_country: r.country, p_gender: r.gender,
    p_categories: r.categories, p_email: r.email, p_note: r.note,
  });
  if (error) throw error;
}

export async function listRegistrationsAdmin(slug: string): Promise<Registration[]> {
  const { data, error } = await supabase.rpc('topspin_registrations_admin', { p_slug: slug });
  if (error) throw error;
  return (data ?? []) as Registration[];
}

export async function deleteRegistration(slug: string, id: string): Promise<void> {
  const { error } = await supabase.rpc('topspin_delete_registration', { p_slug: slug, p_id: id });
  if (error) throw error;
}

// ---------- Médiá (propozície / galéria / videá) ----------
export type MediaKind = 'propozicie' | 'photo' | 'video';
export type MediaItem = { id: string; kind: MediaKind; url: string; title: string; created_at: string };

export async function listMedia(slug: string): Promise<MediaItem[]> {
  const { data, error } = await supabase.rpc('topspin_list_media', { p_slug: slug });
  if (error) throw error;
  return (data ?? []) as MediaItem[];
}

export async function addMedia(slug: string, kind: MediaKind, url: string, title: string): Promise<void> {
  const { error } = await supabase.rpc('topspin_add_media', { p_slug: slug, p_kind: kind, p_url: url, p_title: title });
  if (error) throw error;
}

export async function deleteMedia(slug: string, id: string): Promise<void> {
  const { error } = await supabase.rpc('topspin_delete_media', { p_slug: slug, p_id: id });
  if (error) throw error;
}

/** Nahrá súbor do Supabase Storage a vráti verejnú adresu.
 *  Súbory sú mimo turnajového JSON, takže turnaj ostáva rýchly. */
export async function uploadMedia(slug: string, file: File): Promise<string> {
  const clean = file.name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-60);
  const path = slug + '/' + Date.now() + '_' + clean;
  const { error } = await supabase.storage.from('topspin-media').upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  return supabase.storage.from('topspin-media').getPublicUrl(path).data.publicUrl;
}


/** YouTube/Vimeo odkaz → adresa na vloženie do stránky. */
export function embedUrl(url: string): string {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return url;
}

/** Prezencia a zaplatené štartovné. */
export async function setRegistrationFlags(slug: string, id: string, checked: boolean | null, paid: boolean | null): Promise<void> {
  const { error } = await supabase.rpc('topspin_set_registration_flags', { p_slug: slug, p_id: id, p_checked: checked, p_paid: paid });
  if (error) throw error;
}

// ================= Prihlásenie e-mailom =================
export type Session = { email: string; userId: string } | null;

export async function getSession(): Promise<Session> {
  const { data } = await supabase.auth.getSession();
  const u = data.session?.user;
  return u ? { email: u.email || '', userId: u.id } : null;
}

export function onAuth(cb: (s: Session) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_e, sess) => {
    const u = sess?.user;
    cb(u ? { email: u.email || '', userId: u.id } : null);
  });
  return () => data.subscription.unsubscribe();
}

/** Prihlásenie e-mailom a heslom. */
export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
}

/** Zmena vlastného hesla (pre prihláseného používateľa). */
export async function changePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function signOut(): Promise<void> { await supabase.auth.signOut(); }

/** Turnaje, ku ktorým má prihlásený používateľ prístup. */
export async function myTournaments(): Promise<{ slug: string; name: string; updated_at: string; role: string }[]> {
  const { data, error } = await supabase.rpc('topspin_my_tournaments');
  if (error) throw error;
  return data ?? [];
}

/** Má prihlásený používateľ právo upravovať tento turnaj? */
export async function canEdit(slug: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('topspin_can_edit', { p_slug: slug });
  if (error) return false;
  return data === true;
}

/** Jednorazové prevzatie staršieho turnaja pomocou pôvodného PINu. */
export async function claimTournament(slug: string, pin: string): Promise<void> {
  const { error } = await supabase.rpc('topspin_claim_tournament', { p_slug: slug, p_pin: pin });
  if (error) throw error;
}

// ---------- pozvaní používatelia ----------
export type AccessRow = { email: string; role: string; created_at: string };

export async function listAccess(slug: string): Promise<AccessRow[]> {
  const { data, error } = await supabase.rpc('topspin_list_access', { p_slug: slug });
  if (error) throw error;
  return (data ?? []) as AccessRow[];
}

export async function addAccess(slug: string, email: string, role: string): Promise<void> {
  const { error } = await supabase.rpc('topspin_add_access', { p_slug: slug, p_email: email, p_role: role });
  if (error) throw error;
}

export async function removeAccess(slug: string, email: string): Promise<void> {
  const { error } = await supabase.rpc('topspin_remove_access', { p_slug: slug, p_email: email });
  if (error) throw error;
}

/** Smie prihlásený používateľ zakladať nové turnaje? */
export async function canCreate(): Promise<boolean> {
  const { data, error } = await supabase.rpc('topspin_can_create');
  if (error) return false;
  return data === true;
}

export type CreatorRow = { email: string; created_at: string };

export async function listCreators(): Promise<CreatorRow[]> {
  const { data, error } = await supabase.rpc('topspin_list_creators');
  if (error) throw error;
  return (data ?? []) as CreatorRow[];
}

export async function addCreator(email: string): Promise<void> {
  const { error } = await supabase.rpc('topspin_add_creator', { p_email: email });
  if (error) throw error;
}

export async function removeCreator(email: string): Promise<void> {
  const { error } = await supabase.rpc('topspin_remove_creator', { p_email: email });
  if (error) throw error;
}
