/**
 * Nahrávanie súborov (propozície, fotky) s overením PINu.
 * Anonymné nahrávanie do úložiska je zakázané — jediná cesta dnu vedie
 * cez túto funkciu, ktorá najprv overí PIN turnaja a až potom zapíše
 * súbor servisným kľúčom.
 *
 * Vyžaduje premenné prostredia na Netlify:
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 */
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Použi POST.' }, 405);

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) return json({ error: 'Chýba nastavenie servera (kľúče Supabase).' }, 500);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Chybný formát požiadavky.' }, 400); }
  const { slug, pin, filename, contentType, data } = body || {};
  if (!slug || !pin || !filename || !data) return json({ error: 'Neúplná požiadavka.' }, 400);

  const bytes = Buffer.from(data, 'base64');
  if (bytes.length > 15 * 1024 * 1024) return json({ error: 'Súbor je väčší ako 15 MB.' }, 413);
  const okType = /^(image\/(jpeg|png|webp|gif)|application\/pdf)$/.test(contentType || '');
  if (!okType) return json({ error: 'Povolené sú len obrázky a PDF.' }, 415);

  // 1) overenie PINu (so zámkom po neúspešných pokusoch)
  const check = await fetch(`${url}/rest/v1/rpc/topspin_verify_pin`, {
    method: 'POST',
    headers: { apikey: anon, Authorization: `Bearer ${anon}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_slug: slug, p_pin: pin }),
  });
  const ok = await check.json().catch(() => false);
  if (!check.ok || ok !== true) return json({ error: 'Neplatný PIN.' }, 403);

  // 2) zápis do úložiska servisným kľúčom
  const clean = String(filename).replace(/[^\w.\-]+/g, '_').slice(-60);
  const path = `${slug}/${Date.now()}_${clean}`;
  const up = await fetch(`${url}/storage/v1/object/topspin-media/${path}`, {
    method: 'POST',
    headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': contentType, 'x-upsert': 'false' },
    body: bytes,
  });
  if (!up.ok) return json({ error: `Uloženie súboru zlyhalo (${up.status}).` }, 500);

  return json({ url: `${url}/storage/v1/object/public/topspin-media/${path}` });
};
