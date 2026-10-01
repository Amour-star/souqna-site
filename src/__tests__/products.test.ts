import {beforeEach, describe, expect, it, vi} from 'vitest';

const post = vi.fn();

vi.mock('@/lib/api/client', () => ({
  api: {post, get: vi.fn(), delete: vi.fn()},
  getAccessToken: () => null,
}));

const {searchProducts} = await import('@/lib/api/products');

const product = (id: string, price: number, createdAt: string, condition?: number) => ({
  id,
  price,
  created_at: createdAt,
  condition: condition ?? null,
});

/**
 * The live API ignores price/condition/sort parameters, so the client refines
 * the returned page itself. These tests cover that fallback; once the backend
 * patch lands the server returns already-filtered data and this pass is a
 * no-op, which the "leaves matching data untouched" case checks.
 */
describe('searchProducts client-side refinement', () => {
  beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue({
      data: {
        success: true,
        totalRecords: 3,
        data: [
          product('a', 300, '2026-01-03T00:00:00Z'),
          product('b', 100, '2026-01-01T00:00:00Z'),
          product('c', 200, '2026-01-02T00:00:00Z', 1),
        ],
      },
    });
  });

  it('sends pagination through request headers, as the API requires', async () => {
    await searchProducts({page: 2, pageSize: 10});
    expect(post).toHaveBeenCalledWith(
      'showProductsWithoutAuth',
      expect.any(Object),
      expect.objectContaining({headers: {pageNo: 2, recordsPerPage: 10}}),
    );
  });

  it('sorts by price ascending', async () => {
    const result = await searchProducts({sort: 'price_asc'});
    expect(result.data.map(entry => entry.id)).toEqual(['b', 'c', 'a']);
  });

  it('sorts by price descending', async () => {
    const result = await searchProducts({sort: 'price_desc'});
    expect(result.data.map(entry => entry.id)).toEqual(['a', 'c', 'b']);
  });

  it('sorts newest first by default', async () => {
    const result = await searchProducts({});
    expect(result.data.map(entry => entry.id)).toEqual(['a', 'c', 'b']);
  });

  it('applies a price range', async () => {
    const result = await searchProducts({minPrice: 150, maxPrice: 250});
    expect(result.data.map(entry => entry.id)).toEqual(['c']);
  });

  it('applies a condition filter', async () => {
    const result = await searchProducts({condition: 1});
    expect(result.data.map(entry => entry.id)).toEqual(['c']);
  });

  it('leaves already-matching data untouched', async () => {
    const result = await searchProducts({minPrice: 0, maxPrice: 1000, sort: 'newest'});
    expect(result.data).toHaveLength(3);
    expect(result.totalRecords).toBe(3);
  });

  it('forwards search and category filters in the request body', async () => {
    await searchProducts({q: 'iphone', categoryID: 'cat-1', minPrice: 50, sort: 'price_asc'});
    expect(post).toHaveBeenCalledWith(
      'showProductsWithoutAuth',
      expect.objectContaining({
        productName: 'iphone',
        categoryID: 'cat-1',
        minPrice: 50,
        sortBy: 'price_asc',
      }),
      expect.any(Object),
    );
  });
});

/**
 * Refining one page of a larger result set would leave the total and the page
 * contents disagreeing. With a refinement the API ignores, the client instead
 * fetches a window of the whole matching set and paginates it locally.
 */
describe('searchProducts windowed refinement', () => {
  const TOTAL = 250;
  const all = Array.from({length: TOTAL}, (_, index) =>
    product(`p${index}`, index + 1, `2026-01-01T00:00:${String(index % 60).padStart(2, '0')}Z`),
  );

  beforeEach(() => {
    post.mockReset();
    post.mockImplementation(async (_url: string, _body: unknown, config: any) => {
      const {pageNo, recordsPerPage} = config.headers;
      const start = (pageNo - 1) * recordsPerPage;
      return {data: {success: true, totalRecords: TOTAL, data: all.slice(start, start + recordsPerPage)}};
    });
  });

  it('finds matches that live beyond the first server page', async () => {
    // Prices 200-250 sit on server page 3 — invisible to per-page filtering.
    const result = await searchProducts({minPrice: 200, pageSize: 24});
    expect(result.totalRecords).toBe(51);
    expect(result.data).toHaveLength(24);
    expect(result.data.every(entry => Number(entry.price) >= 200)).toBe(true);
  });

  it('keeps the total and the pages consistent', async () => {
    const first = await searchProducts({minPrice: 200, pageSize: 24, page: 1});
    const last = await searchProducts({minPrice: 200, pageSize: 24, page: 3});
    expect(first.totalRecords).toBe(last.totalRecords);
    expect(last.data).toHaveLength(51 - 48);
  });

  it('sorts the whole set, not just one page', async () => {
    const result = await searchProducts({sort: 'price_desc', pageSize: 5});
    expect(result.data.map(entry => entry.price)).toEqual([250, 249, 248, 247, 246]);
  });

  it('does not window when no unsupported refinement is used', async () => {
    await searchProducts({q: 'iphone', page: 2, pageSize: 24});
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][2].headers).toEqual({pageNo: 2, recordsPerPage: 24});
  });

  it('caps the window and reports truncation', async () => {
    post.mockImplementation(async (_url: string, _body: unknown, config: any) => ({
      data: {
        success: true,
        totalRecords: 10_000,
        data: Array.from({length: config.headers.recordsPerPage}, (_, index) =>
          product(`x${config.headers.pageNo}-${index}`, index, '2026-01-01T00:00:00Z'),
        ),
      },
    }));
    const result = await searchProducts({sort: 'price_asc'});
    expect(post).toHaveBeenCalledTimes(5);
    expect(result.truncated).toBe(true);
  });

  it('is not truncated when the window covers everything', async () => {
    const result = await searchProducts({minPrice: 1});
    expect(result.truncated).toBe(false);
    expect(result.totalRecords).toBe(TOTAL);
  });
});

describe('searchProducts currency and attribute filters', () => {
  const listing = (id: string, currency: string | null, attrs: object[] = []) => ({
    id,
    price: 100,
    currency,
    created_at: '2026-01-01T00:00:00Z',
    custom_fields: JSON.stringify(attrs),
  });

  beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue({
      data: {
        success: true,
        totalRecords: 4,
        data: [
          listing('usd', 'USD', [{name: 'fuel', value: 'Petrol', ar_value: 'بنزين'}]),
          listing('syp', 'SYP', [{name: 'fuel', value: 'Diesel', ar_value: 'ديزل'}]),
          listing('none', null),
          listing('try', 'TRY', [{name: 'fuel', value: 'petrol'}]),
        ],
      },
    });
  });

  it('keeps only listings in the chosen currency', async () => {
    const result = await searchProducts({currency: 'SYP'});
    expect(result.data.map(entry => entry.id)).toEqual(['syp']);
  });

  it('treats a listing without a currency as USD', async () => {
    const result = await searchProducts({currency: 'USD'});
    expect(result.data.map(entry => entry.id).sort()).toEqual(['none', 'usd']);
  });

  it('never compares a price bound across currencies', async () => {
    const result = await searchProducts({minPrice: 50, currency: 'TRY'});
    expect(result.data.map(entry => entry.id)).toEqual(['try']);
  });

  it('filters by a category attribute, case-insensitively', async () => {
    const result = await searchProducts({attrs: {fuel: 'Petrol'}});
    expect(result.data.map(entry => entry.id).sort()).toEqual(['try', 'usd']);
  });

  it('also matches the Arabic stored value', async () => {
    const result = await searchProducts({attrs: {fuel: 'ديزل'}});
    expect(result.data.map(entry => entry.id)).toEqual(['syp']);
  });

  it('ignores attribute filters with an empty value', async () => {
    const result = await searchProducts({attrs: {fuel: ''}});
    expect(result.data).toHaveLength(4);
  });

  it('treats malformed custom_fields as having no attributes', async () => {
    post.mockResolvedValue({
      data: {success: true, totalRecords: 1, data: [{id: 'bad', price: 1, custom_fields: '{not json', created_at: '2026-01-01T00:00:00Z'}]},
    });
    expect((await searchProducts({attrs: {fuel: 'Petrol'}})).data).toEqual([]);
  });
});
