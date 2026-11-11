/** Text helpers shared by the sitemap, HTML renderer and tests. */

export const escapeHtml = (value: unknown): string =>
  String(value ?? '').replace(/[&<>"']/g, ch =>
    ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[ch] as string,
  );

export const escapeXml = (value: string): string =>
  value.replace(/[<>&'"]/g, ch =>
    ({'<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'})[ch] as string,
  );

/** JSON for an inline <script>: `<` is escaped so user text can never close the tag. */
export const jsonLd = (data: unknown): string =>
  JSON.stringify(data).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, '');

export const clip = (value: unknown, length: number): string => {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= length) return text;
  // Cut on a word boundary where one is close enough, so snippets stay readable.
  const cut = text.slice(0, length - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > length * 0.6 ? cut.slice(0, space) : cut).trim()}…`;
};

/**
 * MUST stay identical to `slugify` in src/lib/format.ts — the slug is part of
 * the public listing URL, and changing it would orphan every indexed page.
 * A unit test compares the two implementations.
 */
export const slugify = (value: string | null | undefined): string =>
  (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70);

/** Locations are free text and often carry stray underscores from hand-typed ads. */
export const cleanLocation = (value: unknown): string =>
  String(value ?? '').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Removes phone numbers (and the labels that introduce them) from text used in
 * meta tags and structured data. Sellers paste their number into descriptions;
 * it is fine on the listing page but does not belong in search snippets.
 */
export const stripContactDetails = (value: unknown): string =>
  String(value ?? '')
    .replace(/(?:(?:للتواصل|للاتصال|اتصال|واتس\s?اب?|الرقم|رقم|جوال|هاتف|موبايل|تلفون)\s*(?:حصريا|حصرياً)?\s*(?:على|عبر|:)?\s*)?(?:\+|00)?\d[\d\s\-().]{7,}\d/g, ' ')
    .replace(/[٠-٩]{8,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const isoDate = (value: unknown): string | null => {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export const absoluteMedia = (value: unknown, mediaBase: string): string | null => {
  const text = String(value ?? '').trim();
  if (!text) return null;
  return /^https?:\/\//i.test(text) ? text : `${mediaBase}/${text.replace(/^\/+/, '')}`;
};

export const CURRENCY_LABEL: Record<string, string> = {USD: 'دولار', SYP: 'ل.س', TRY: 'ليرة تركية'};

/**
 * A price we are willing to publish in snippets and structured data. Sellers
 * often type 0 or 1 as a "call for price" placeholder; presenting that as a real
 * price (or as an Offer) would be misleading, so it is treated as "no price".
 */
export const usablePrice = (price: unknown): number | null => {
  if (price === null || price === undefined || price === '') return null;
  const amount = Number(price);
  return Number.isFinite(amount) && amount > 1 ? amount : null;
};

export const priceText = (price: unknown, currency: unknown): string => {
  const amount = usablePrice(price);
  if (amount === null) return '';
  const code = String(currency || 'USD').toUpperCase();
  return `${amount.toLocaleString('en-US')} ${CURRENCY_LABEL[code] ?? code}`;
};

export const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
export const isUuid = (value: string): boolean => new RegExp(`^${UUID_RE.source}$`, 'i').test(value);
