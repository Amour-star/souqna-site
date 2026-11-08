import {slugify, cleanLocation, UUID_RE} from './text.js';

export interface Product {
  id: string;
  name?: string | null;
  ar_name?: string | null;
  description?: string | null;
  ar_description?: string | null;
  price?: number | string | null;
  currency?: string | null;
  status?: number | string | null;
  condition?: number | string | null;
  location?: string | null;
  city?: string | null;
  city_id?: number | null;
  categoryID?: string | null;
  subCategoryID?: string | null;
  date?: string | null;
  expDate?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  images?: {path?: string | null}[] | null;
  category?: {id?: string; name?: string; ar_name?: string | null} | null;
  sub_category?: {id?: string; name?: string; ar_name?: string | null} | null;
  seller?: {id?: string; name?: string | null; is_verified?: boolean | null; created_at?: string | null} | null;
}

export interface Category {
  id: string;
  name: string;
  ar_name?: string | null;
  status?: number | string;
  updated_at?: string | null;
}

export interface SubCategory extends Category {
  categoryID: string;
  productsCount?: number;
  products_count?: number;
}

export const arabicName = (item?: {ar_name?: string | null; name?: string | null} | null): string =>
  (item?.ar_name || item?.name || '').trim();

/** Mirrors `listingPath` in src/lib/format.ts so existing indexed URLs never change. */
export const listingPath = (product: Pick<Product, 'id' | 'name' | 'location'>): string => {
  const slug = slugify([product.name, product.location?.split(',')[0]].filter(Boolean).join(' '));
  return slug ? `/listing/${slug}-${product.id}` : `/listing/${product.id}`;
};

export const listingIdFromSlug = (slug: string): string | null => {
  const match = slug.match(new RegExp(`${UUID_RE.source}$`, 'i'));
  return match ? match[0].toLowerCase() : null;
};

export const categoryPath = (categoryId: string, subCategoryId?: string): string =>
  subCategoryId ? `/category/${categoryId}/${subCategoryId}` : `/category/${categoryId}`;

/**
 * What a listing means for search engines.
 *
 *  - `indexable`  published, in date, has real content   → 200, index, in sitemap
 *  - `sold`       marked sold: still useful to the seller/buyer who follows an old link,
 *                 but not worth ranking                  → 200, noindex, not in sitemap
 *  - `paused`     hidden by the seller                   → 404
 *  - `expired`    past its expiry date                   → 410 Gone
 *  - `thin`       published but no usable content        → 200, noindex, not in sitemap
 */
export type ListingState = 'indexable' | 'sold' | 'paused' | 'expired' | 'thin';

export const isExpired = (product: Product, now: Date = new Date()): boolean => {
  if (!product.expDate) return false;
  const end = new Date(`${String(product.expDate).slice(0, 10)}T23:59:59Z`);
  return !Number.isNaN(end.getTime()) && end.getTime() < now.getTime();
};

export const listingState = (product: Product, now: Date = new Date()): ListingState => {
  const status = Number(product.status ?? 0);
  if (status === 3) return 'sold';
  if (status === 2) return 'paused';
  if (status !== 0 && status !== 1) return 'paused';
  if (isExpired(product, now)) return 'expired';
  const hasName = Boolean((product.name ?? '').trim());
  const hasBody = (product.description ?? '').trim().length >= 20 || (product.images?.length ?? 0) > 0;
  if (!hasName || !product.categoryID || !hasBody) return 'thin';
  return 'indexable';
};

export const isIndexableListing = (product: Product, now?: Date): boolean =>
  listingState(product, now) === 'indexable';

export const listingCity = (product: Product): string => {
  const city = product.city as unknown;
  const name = typeof city === 'string' ? city : (city as {name_ar?: string} | null)?.name_ar;
  return cleanLocation(name || product.location);
};
