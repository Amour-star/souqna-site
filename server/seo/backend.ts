import {API} from './config.js';
import type {Category, Product, SubCategory} from './model.js';

/**
 * The only data source is the Laravel API that the mobile app also uses
 * (this repository has no database of its own). `Backend` is an interface so
 * the sitemap and consistency tests can run against an in-memory fake.
 */

export interface SearchFilters {
  categoryID?: string;
  subCategoryID?: string;
  city_id?: number;
}

export interface Page<T> {
  items: T[];
  total: number;
}

export type DetailResult =
  | {kind: 'ok'; product: Product}
  | {kind: 'missing'}
  | {kind: 'error'; message: string};

export interface Backend {
  categories(): Promise<Category[]>;
  subCategories(): Promise<SubCategory[]>;
  /** Newest-first page of the public feed. `pageNo` is 1-based. */
  search(filters: SearchFilters, pageNo: number, pageSize: number): Promise<Page<Product>>;
  detail(id: string): Promise<DetailResult>;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getJson = async <T>(url: string, init: RequestInit = {}, attempt = 0): Promise<T> => {
  try {
    const response = await fetch(url, {
      ...init,
      headers: {Accept: 'application/json', ...(init.headers as Record<string, string>)},
      signal: AbortSignal.timeout(20_000),
    });
    if (response.status === 404) throw Object.assign(new Error('not found'), {notFound: true});
    if (!response.ok) throw new Error(`${url} → HTTP ${response.status}`);
    return (await response.json()) as T;
  } catch (error) {
    if ((error as {notFound?: boolean}).notFound || attempt >= 2) throw error;
    await sleep(400 * (attempt + 1));
    return getJson<T>(url, init, attempt + 1);
  }
};

export const httpBackend: Backend = {
  async categories() {
    const payload = await getJson<{data?: Category[]}>(`${API}/viewCategories`);
    return (payload.data ?? []).filter(item => Number(item.status) === 1);
  },
  async subCategories() {
    const payload = await getJson<{data?: SubCategory[]}>(`${API}/viewSubCategories`);
    return (payload.data ?? []).filter(item => Number(item.status) === 1);
  },
  async search(filters, pageNo, pageSize) {
    const payload = await getJson<{data?: Product[]; totalRecords?: number}>(
      `${API}/showProductsWithoutAuth`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          pageNo: String(pageNo),
          recordsPerPage: String(pageSize),
        },
        body: JSON.stringify(filters),
      },
    );
    return {items: payload.data ?? [], total: Number(payload.totalRecords) || 0};
  },
  async detail(id) {
    try {
      const payload = await getJson<{success?: boolean; data?: Product}>(`${API}/productDetails/${id}`);
      if (!payload?.success || !payload.data) return {kind: 'missing'};
      return {kind: 'ok', product: payload.data};
    } catch (error) {
      if ((error as {notFound?: boolean}).notFound) return {kind: 'missing'};
      return {kind: 'error', message: (error as Error).message};
    }
  },
};

/**
 * Streams records `[from, to)` of the unfiltered newest-first feed, a page at a
 * time. Memory stays bounded by `pageSize` — the whole table is never loaded.
 */
export async function* streamFeed(
  backend: Backend,
  from: number,
  to: number,
  pageSize = 500,
): AsyncGenerator<Product> {
  // Align the first request to a page boundary, then drop the leading overshoot.
  let pageNo = Math.floor(from / pageSize) + 1;
  let index = (pageNo - 1) * pageSize;
  while (index < to) {
    const {items} = await backend.search({}, pageNo, pageSize);
    if (!items.length) return;
    for (const item of items) {
      if (index >= from && index < to) yield item;
      index += 1;
    }
    if (items.length < pageSize) return;
    pageNo += 1;
  }
}

/** Runs `worker` over `items` with bounded concurrency. */
export const mapLimit = async <T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({length: Math.min(limit, items.length)}, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await worker(items[index], index);
      }
    }),
  );
  return results;
};
