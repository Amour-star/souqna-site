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
