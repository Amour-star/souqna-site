/**
 * Shared configuration for the server-side SEO layer (Vercel functions in
 * `api/`). Everything here is plain TypeScript with no Node-only imports besides
 * `process.env`, so the same modules run in the functions and under Vitest.
 */
const env = (name: string): string | undefined =>
  typeof process !== 'undefined' ? process.env?.[name] : undefined;

export const API = (env('VITE_API_URL') || 'https://backend.souqna.net/api').replace(/\/+$/, '');
export const SITE = (env('VITE_SITE_URL') || 'https://www.souqna.net').replace(/\/+$/, '');
export const MEDIA = API.replace(/\/api$/i, '');

export const BRAND = 'سوقنا';
export const BRAND_EN = 'Souqna';
export const SUPPORT_EMAIL = 'payment@souqna.net';
export const STORE_LINKS = {
  android: 'https://play.google.com/store/apps/details?id=com.souqnaapp',
  ios: 'https://apps.apple.com/us/app/souqna-app/id6753893826',
};

const num = (name: string, fallback: number) => {
  const value = Number(env(name));
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

/** Google's hard limit is 50,000 URLs / 50 MB per sitemap; stay far below both. */
export const LISTINGS_PER_SITEMAP = Math.min(num('SEO_LISTINGS_PER_SITEMAP', 5000), 45000);
/** A city landing page is only indexable with at least this many live listings. */
export const MIN_CITY_LISTINGS = num('SEO_MIN_CITY_LISTINGS', 10);
/** …and a city × category page with at least this many. */
export const MIN_COMBO_LISTINGS = num('SEO_MIN_COMBO_LISTINGS', 10);
/** A subcategory page is indexable with at least this many live listings. */
export const MIN_SUBCATEGORY_LISTINGS = num('SEO_MIN_SUBCATEGORY_LISTINGS', 3);
/** Listings per page on category / city landing pages (matches the SPA). */
export const PAGE_SIZE = 24;

/**
 * IndexNow key. The key is public by design (it is served at /<key>.txt so the
 * engines can verify ownership), so a default is safe; override with
 * INDEXNOW_KEY to rotate it.
 */
export const INDEXNOW_KEY = env('INDEXNOW_KEY') || '5f0c3a9e7b1d4c82a6e9d3f1b7c24a08';
export const CRON_SECRET = env('CRON_SECRET');
export const SEO_ADMIN_TOKEN = env('SEO_ADMIN_TOKEN');
export const PING_SECRET = env('SEO_PING_SECRET');
