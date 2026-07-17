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
export async function getTournament(slug: string): Promise<{ name: string; slug: string; data: TournamentState } | null> {
  const { data, error } = await supabase.rpc('topspin_get_tournament', { p_slug: slug });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row ? { name: row.name, slug: row.slug, data: row.data as TournamentState } : null;
}

/** Založenie turnaja – gated tajným admin kódom; vracia slug. */
export async function createTournament(name: string, pin: string, createCode: string): Promise<string> {
  const { data, error } = await supabase.rpc('topspin_create_tournament', { p_name: name, p_pin: pin, p_create_code: createCode });
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
export async function saveTournament(slug: string, data: TournamentState, pin: string): Promise<void> {
  const { error } = await supabase.rpc('topspin_save_tournament', { p_slug: slug, p_data: data, p_pin: pin });
  if (error) throw error;
}

/** Zmazanie turnaja – server overí PIN. */
export async function deleteTournament(slug: string, pin: string): Promise<void> {
  const { error } = await supabase.rpc('topspin_delete_tournament', { p_slug: slug, p_pin: pin });
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
