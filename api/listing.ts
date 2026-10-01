/**
 * Server-side <head> tags for a shared listing link (WEB-03).
 *
 * Pure string work with no imports, so it runs unchanged inside the Vercel
 * function in `api/listing.ts` and under Vitest. WhatsApp, Telegram and
 * Facebook do not execute JavaScript, so the tags must be in the HTML itself.
 */

export interface MetaProduct {
  id: string;
  name?: string;
  description?: string;
  price?: number | string;
  currency?: string;
  location?: string;
  status?: number | string;
  images?: {path?: string}[];
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `<slug>-<uuid>` (or a bare uuid) → uuid. */
export const listingIdFromSlug = (slug: string): string | null =>
  slug.match(UUID)?.[0] ?? null;

export const escapeAttr = (value: string): string =>
  value.replace(/[&<>"']/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[ch] as string);

const clip = (value: string, length: number): string => {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
};

const CURRENCY_LABEL: Record<string, string> = {USD: 'دولار', SYP: 'ل.س', TRY: 'ليرة تركية'};

const absoluteMedia = (value: string | undefined, mediaBase: string): string | null => {
  const text = value?.trim();
  if (!text) return null;
  return /^https?:\/\//i.test(text) ? text : `${mediaBase}/${text.replace(/^\/+/, '')}`;
};

export interface ListingMeta {
  title: string;
  description: string;
  image: string | null;
  url: string;
  indexable: boolean;
}

export const buildListingMeta = (
  product: MetaProduct,
  siteUrl: string,
  mediaBase: string,
  requestPath: string,
): ListingMeta => {
  const amount = Number(product.price);
  const price =
    Number.isFinite(amount) && amount > 0
      ? `${amount.toLocaleString('en-US')} ${CURRENCY_LABEL[product.currency ?? 'USD'] ?? product.currency}`
      : '';
  const location = (product.location ?? '').replace(/_+/g, ' ').trim();
  return {
    title: [clip(product.name ?? '', 90), clip(location, 40)].filter(Boolean).join(' — '),
    description: clip([price, location, product.description ?? ''].filter(Boolean).join(' — '), 160),
    image: absoluteMedia(product.images?.[0]?.path, mediaBase),
    url: `${siteUrl}${requestPath}`,
    indexable: [0, 1].includes(Number(product.status ?? 1)),
  };
};

/** Replaces the shell's generic title/description/og:image with the listing's. */
export const injectListingMeta = (html: string, meta: ListingMeta): string => {
  const title = escapeAttr(meta.title);
  const description = escapeAttr(meta.description);
  const tags = [
    `<link rel="canonical" href="${escapeAttr(meta.url)}" />`,
    `<meta property="og:type" content="product" />`,
    `<meta property="og:locale" content="ar_SY" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${escapeAttr(meta.url)}" />`,
    ...(meta.image ? [`<meta property="og:image" content="${escapeAttr(meta.image)}" />`] : []),
    `<meta name="twitter:card" content="${meta.image ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    ...(meta.image ? [`<meta name="twitter:image" content="${escapeAttr(meta.image)}" />`] : []),
    ...(meta.indexable ? [] : [`<meta name="robots" content="noindex" />`]),
  ].join('\n    ');

  return html
    .replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${title}</title>`)
    .replace(/<meta\s+name="description"[\s\S]*?\/>/i, () => `<meta name="description" content="${description}" />`)
    // The shell's neutral og:image / canonical would otherwise win over ours.
    .replace(/<meta\s+property="og:image"[^>]*>\s*/gi, '')
    .replace(/<link\s+rel="canonical"[^>]*>\s*/gi, '')
    .replace('</head>', () => `    ${tags}\n  </head>`);
};

// ---- Vercel handler ----
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
