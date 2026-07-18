/**
 * Udržiavacie volanie (keep-alive).
 * Supabase v bezplatnom pláne uspí projekt po ~7 dňoch bez aktivity — potom
 * turnaje na chvíľu nie sú dostupné. Táto funkcia sa spustí podľa rozvrhu
 * a jedným ľahkým dopytom projekt udrží prebudený.
 */
export default async () => {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    return new Response('Chýba VITE_SUPABASE_URL alebo VITE_SUPABASE_ANON_KEY', { status: 500 });
  }
  try {
    const r = await fetch(`${url}/rest/v1/rpc/topspin_list_tournaments`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    return new Response(`keep-alive ${r.ok ? 'OK' : 'chyba'} (${r.status}) ${new Date().toISOString()}`);
  } catch (e) {
    return new Response('keep-alive zlyhal: ' + e.message, { status: 500 });
  }
};

// Pondelok a štvrtok o 06:00 UTC — pohodlne v rámci 7-dňového limitu.
export const config = { schedule: '0 6 * * 1,4' };
