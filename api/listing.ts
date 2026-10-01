import {buildListingMeta, injectListingMeta, listingIdFromSlug} from '../src/lib/listingMeta';

/**
 * Serves the SPA shell for /listing/<slug>-<uuid> with that listing's Open
 * Graph / Twitter / canonical tags in the HTML, so link previews and crawlers
 * see the right title and photo. Browsers still boot the normal SPA.
 *
 * Any failure falls back to the untouched shell — a sharing nicety must never
 * take a listing page down.
 */

interface Req {
  query: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
}
interface Res {
  status(code: number): Res;
  setHeader(name: string, value: string): Res;
  send(body: string): void;
}

const API = (process.env.VITE_API_URL || 'https://backend.souqna.net/api').replace(/\/+$/, '');
const SITE = (process.env.VITE_SITE_URL || 'https://www.souqna.net').replace(/\/+$/, '');
const MEDIA = API.replace(/\/api$/i, '');

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? '';

export default async function handler(req: Req, res: Res) {
  const host = first(req.headers['x-forwarded-host']) || first(req.headers.host) || new URL(SITE).host;
  const shellResponse = await fetch(`https://${host}/index.html`);
  if (!shellResponse.ok) {
    res.status(502).send('Shell unavailable');
    return;
  }
  const shell = await shellResponse.text();

  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  const slug = first(req.query.slug);
  const id = listingIdFromSlug(slug);
  if (!id) {
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    res.status(200).send(shell);
    return;
  }

  try {
    const response = await fetch(`${API}/productDetails/${id}`, {
      headers: {Accept: 'application/json'},
      signal: AbortSignal.timeout(4000),
    });
    const payload = (await response.json()) as {success?: boolean; data?: Record<string, unknown>};
    if (!payload?.success || !payload.data) throw new Error('listing not found');

    const meta = buildListingMeta(
      payload.data as never,
      SITE,
      MEDIA,
      `/listing/${encodeURI(decodeURIComponent(slug))}`,
    );
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    res.status(200).send(injectListingMeta(shell, meta));
  } catch {
    res.setHeader('Cache-Control', 'public, s-maxage=30');
    res.status(200).send(shell);
  }
}
