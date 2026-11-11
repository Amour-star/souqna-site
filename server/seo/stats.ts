import {streamFeed, type Backend} from './backend.js';
import {MIN_CITY_LISTINGS, MIN_COMBO_LISTINGS, MIN_SUBCATEGORY_LISTINGS} from './config.js';
import {isIndexableListing, listingState, type Product} from './model.js';
import {isoDate} from './text.js';

export interface Bucket {
  count: number;
  /** Newest `updated_at` among the bucket's indexable listings (ISO). */
  newest: string | null;
}

export interface SeoStats {
  generatedAt: string;
  scanned: number;
  indexable: number;
  states: Record<string, number>;
  categories: Map<string, Bucket>;
  subCategories: Map<string, Bucket>;
  cities: Map<number, Bucket>;
  combos: Map<string, Bucket>;
  newest: string | null;
}

const bump = <K>(map: Map<K, Bucket>, key: K, stamp: string | null) => {
  const bucket = map.get(key) ?? {count: 0, newest: null};
  bucket.count += 1;
  if (stamp && (!bucket.newest || stamp > bucket.newest)) bucket.newest = stamp;
  map.set(key, bucket);
};

export const comboKey = (cityId: number, categoryId: string) => `${cityId}:${categoryId}`;
export const subKey = (categoryId: string, subId: string) => `${categoryId}/${subId}`;

/**
 * One streaming pass over the public feed (1,000 records at a time, only
 * counters are kept) that yields every number the landing-page eligibility
 * rules need. Used by the category and city sitemaps and the health report.
 */
export const scanStats = async (backend: Backend, now: Date = new Date()): Promise<SeoStats> => {
  const stats: SeoStats = {
    generatedAt: now.toISOString(),
    scanned: 0,
    indexable: 0,
    states: {},
    categories: new Map(),
    subCategories: new Map(),
    cities: new Map(),
    combos: new Map(),
    newest: null,
  };
  const seen = new Set<string>();
  for await (const product of streamFeed(backend, 0, Number.MAX_SAFE_INTEGER, 1000)) {
    if (seen.has(product.id)) continue; // the feed can shift between pages while we read it
    seen.add(product.id);
    stats.scanned += 1;
    const state = listingState(product, now);
    stats.states[state] = (stats.states[state] ?? 0) + 1;
    if (!isIndexableListing(product, now)) continue;
    stats.indexable += 1;
    const stamp = isoDate(product.updated_at) ?? isoDate(product.created_at);
    if (stamp && (!stats.newest || stamp > stats.newest)) stats.newest = stamp;
    if (product.categoryID) {
      bump(stats.categories, product.categoryID, stamp);
      if (product.subCategoryID) bump(stats.subCategories, subKey(product.categoryID, product.subCategoryID), stamp);
    }
    if (product.city_id) {
      bump(stats.cities, Number(product.city_id), stamp);
      if (product.categoryID) bump(stats.combos, comboKey(Number(product.city_id), product.categoryID), stamp);
    }
  }
  return stats;
};

// ---- eligibility rules (single source of truth for pages AND sitemaps) ----

export const categoryIndexable = (count: number) => count >= 1;
export const subCategoryIndexable = (count: number) => count >= MIN_SUBCATEGORY_LISTINGS;
export const cityIndexable = (count: number) => count >= MIN_CITY_LISTINGS;
export const comboIndexable = (count: number) => count >= MIN_COMBO_LISTINGS;

export type { Product };
