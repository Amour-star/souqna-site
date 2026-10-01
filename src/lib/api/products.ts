import {api} from './client';
import {PAGE_SIZE} from '@/lib/config';
import {getAccessToken} from './client';
import {parseCustomFields} from '@/lib/format';
import type {ID, Paginated, Product, ProductFilters} from '@/types';

/**
 * Product search, detail and seller mutations.
 *
 * The backend paginates through the `pageNo` / `recordsPerPage` request
 * headers (not the body) — an unusual contract, but it is the one both clients
 * share, so it is honoured here rather than worked around.
 */

const paginationHeaders = (page: number, pageSize: number) => ({
  pageNo: page,
  recordsPerPage: pageSize,
});

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Price range, condition and sorting are applied client-side against the
 * returned page, because the live API does not implement them yet. The same
 * parameters are also sent to the server: today they are ignored, and once the
 * optional backend patch in `backend-patch/` is deployed they take effect
 * server-side and this local pass becomes a no-op.
 */
const applyClientRefinements = (
  products: Product[],
  filters: ProductFilters,
): Product[] => {
  let result = products;

  if (typeof filters.minPrice === 'number') {
    result = result.filter(item => toNumber(item.price) >= filters.minPrice!);
  }
  if (typeof filters.maxPrice === 'number') {
    result = result.filter(item => toNumber(item.price) <= filters.maxPrice!);
  }
  if (filters.condition) {
    result = result.filter(item => Number(item.condition) === filters.condition);
  }
  if (filters.currency) {
    const wanted = filters.currency.toUpperCase();
    // A listing with no currency is treated as USD, as the create form does.
    result = result.filter(item => (item.currency || 'USD').toUpperCase() === wanted);
  }
  for (const [name, wanted] of Object.entries(filters.attrs ?? {})) {
    const target = wanted.trim().toLowerCase();
    if (!target) continue;
    result = result.filter(item =>
      parseCustomFields(item.custom_fields).some(
        field =>
          field.name === name &&
          [field.value, field.ar_value].some(
            candidate => String(candidate ?? '').trim().toLowerCase() === target,
          ),
      ),
    );
  }

  const sort = filters.sort ?? 'newest';
  if (sort === 'newest' || sort === 'oldest') {
    result = [...result].sort((a, b) => {
      const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return sort === 'newest' ? diff : -diff;
    });
  } else if (sort === 'price_asc' || sort === 'price_desc') {
    result = [...result].sort((a, b) => {
      const diff = toNumber(a.price) - toNumber(b.price);
      return sort === 'price_asc' ? diff : -diff;
    });
  }

  return result;
};

/**
 * True when the request uses a refinement the live API ignores (price range,
 * condition, or an order other than its native newest-first). Those can only
 * be honoured correctly over the *whole* result set: refining a single page
 * would show a shrunken page under a total that no longer matches it.
 */
const needsWindowedRefinement = (filters: ProductFilters): boolean =>
  typeof filters.minPrice === 'number' ||
  typeof filters.maxPrice === 'number' ||
  Boolean(filters.condition) ||
  Boolean(filters.currency) ||
  Object.values(filters.attrs ?? {}).some(Boolean) ||
  (filters.sort !== undefined && filters.sort !== 'newest');

/** Records fetched per request, and the most requests a refined search will make. */
const WINDOW_PAGE_SIZE = 100;
const WINDOW_MAX_PAGES = 5;

export const searchProducts = async (
  filters: ProductFilters = {},
): Promise<Paginated<Product>> => {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? PAGE_SIZE;
  const isLoggedIn = Boolean(getAccessToken());

  // The authenticated variant returns per-user favourite flags.
  const endpoint = isLoggedIn ? 'showProducts' : 'showProductsWithoutAuth';

  const body: Record<string, unknown> = {};
  if (filters.q) body.productName = filters.q;
  if (filters.categoryID) body.categoryID = filters.categoryID;
  if (filters.subCategoryID) body.subCategoryID = filters.subCategoryID;
  if (filters.sellerID) body.sellerID = filters.sellerID;
  if (filters.location) body.location = filters.location;
  if (typeof filters.lat === 'number' && typeof filters.long === 'number') {
    body.lat = filters.lat;
    body.long = filters.long;
    body.radius = filters.radius ?? 50;
  }
  if (filters.fromDate && filters.toDate) {
    body.fromDate = filters.fromDate;
    body.toDate = filters.toDate;
  }
  // Forward-compatible hints (see comment on applyClientRefinements).
  if (typeof filters.minPrice === 'number') body.minPrice = filters.minPrice;
  if (typeof filters.maxPrice === 'number') body.maxPrice = filters.maxPrice;
  if (filters.condition) body.condition = filters.condition;
  if (filters.sort) body.sortBy = filters.sort;

  const request = async (url: string, pageNo: number, recordsPerPage: number) =>
    api.post(url, body, {headers: paginationHeaders(pageNo, recordsPerPage)});

  // Mirrors the mobile fallback: an authenticated listing call that fails
  // should still render public results rather than an error screen. Once a
  // fallback has been needed, later requests in the same search skip straight to it.
  let activeEndpoint = endpoint;
  const fetchPage = async (pageNo: number, recordsPerPage: number) => {
    try {
      return await request(activeEndpoint, pageNo, recordsPerPage);
    } catch (error) {
      if (activeEndpoint === 'showProductsWithoutAuth') throw error;
      activeEndpoint = 'showProductsWithoutAuth';
      return request(activeEndpoint, pageNo, recordsPerPage);
    }
  };

  const itemsOf = (payload: any): Product[] => (Array.isArray(payload?.data) ? payload.data : []);

  if (!needsWindowedRefinement(filters)) {
    const payload = (await fetchPage(page, pageSize)).data ?? {};
    const items = itemsOf(payload);
    return {
      data: applyClientRefinements(items, filters),
      totalRecords: toNumber(payload.totalRecords ?? items.length),
    };
  }

  // Refined search: pull a bounded window of the matching set, refine and sort
  // it as a whole, then paginate locally so the total and every page agree.
  const first = (await fetchPage(1, WINDOW_PAGE_SIZE)).data ?? {};
  const window = itemsOf(first);
  const serverTotal = toNumber(first.totalRecords ?? window.length);
  const pagesNeeded = Math.min(WINDOW_MAX_PAGES, Math.ceil(serverTotal / WINDOW_PAGE_SIZE));
  if (pagesNeeded > 1) {
    const rest = await Promise.all(
      Array.from({length: pagesNeeded - 1}, (_, index) =>
        fetchPage(index + 2, WINDOW_PAGE_SIZE).then(response => itemsOf(response.data)),
      ),
    );
    rest.forEach(items => window.push(...items));
  }

  const refined = applyClientRefinements(window, filters);
  const start = (page - 1) * pageSize;
  return {
    data: refined.slice(start, start + pageSize),
    totalRecords: refined.length,
    // More matches exist on the server than the window covered.
    truncated: serverTotal > window.length,
  };
};

export const fetchProduct = async (id: ID): Promise<Product> => {
  const {data} = await api.get(`productDetails/${id}`);
  if (!data?.success || !data?.data) {
    throw new Error(data?.message || 'Listing not found');
  }
  return data.data as Product;
};

export const fetchProductsBySubCategory = async (id: ID): Promise<Product[]> => {
  const {data} = await api.get(`getProductBySubCategory/${id}`);
  return Array.isArray(data?.data) ? data.data : [];
};

export const fetchProductsByCategory = async (id: ID): Promise<Product[]> => {
  const {data} = await api.get(`getProductByCategory/${id}`);
  return Array.isArray(data?.data) ? data.data : [];
};

/** Records a view. Fire-and-forget: a failure must never block the page. */
export const recordProductView = async (id: ID, viewerKey: string) => {
  try {
    await api.post(`products/${id}/view`, {viewerKey, viewer_key: viewerKey});
  } catch {
    /* view counting is best-effort */
  }
};

export interface ProductInput {
  name: string;
  description: string;
  price: string;
  currency: string;
  categoryID: string;
  subCategoryID: string;
  contactInfo: string;
  location: string;
  lat: string;
  long: string;
  condition?: number | null;
  negotiable?: boolean;
  customFields: {name: string; value: string; ar_name?: string; ar_value?: string}[];
  images: File[];
}

const appendProductFields = (form: FormData, input: ProductInput) => {
  form.append('name', input.name);
  form.append('description', input.description);
  form.append('price', String(input.price));
  form.append('currency', input.currency);
  form.append('categoryID', input.categoryID);
  form.append('subCategoryID', input.subCategoryID);
  form.append('contactInfo', input.contactInfo);
  form.append('location', input.location);
  form.append('lat', input.lat);
  form.append('long', input.long);
  if (input.condition) form.append('condition', String(input.condition));
  if (typeof input.negotiable === 'boolean') {
    form.append('negotiable', input.negotiable ? '1' : '0');
  }
  form.append('custom_fields', JSON.stringify(input.customFields));
};

export const createProduct = async (input: ProductInput): Promise<Product | null> => {
  const form = new FormData();
  appendProductFields(form, input);
  input.images.forEach(file => form.append('images[]', file, file.name));

  const {data} = await api.post('createProduct', form, {
    headers: {'Content-Type': 'multipart/form-data'},
  });
  if (!data?.success) throw new Error(data?.message || 'Could not publish the listing');
  return (data.data as Product) ?? null;
};

export const updateProduct = async (
  id: ID,
  input: ProductInput,
): Promise<Product | null> => {
  const form = new FormData();
  form.append('id', id);
  appendProductFields(form, input);
  input.images.forEach(file => form.append('images[]', file, file.name));

  const {data} = await api.post('updateProduct', form, {
    headers: {'Content-Type': 'multipart/form-data'},
  });
  if (!data?.success) throw new Error(data?.message || 'Could not save the listing');
  return (data.data as Product) ?? null;
};

export const deleteProduct = async (id: ID) => {
  const {data} = await api.delete(`deleteProductSeller/${id}`);
  if (!data?.success) throw new Error(data?.message || 'Could not delete the listing');
  return data;
};

export const deleteProductImage = async (imageId: ID) => {
  const {data} = await api.delete(`deleteImage/${imageId}`);
  if (!data?.success) throw new Error(data?.message || 'Could not delete the image');
  return data;
};

/**
 * Seller-controlled listing status. Requires the backend patch documented in
 * `backend-patch/README.md`; guarded by `FEATURES.listingStatus` at call sites.
 */
export const updateProductStatus = async (id: ID, status: number) => {
  const {data} = await api.post('updateProductStatus', {id, status});
  if (!data?.success) throw new Error(data?.message || 'Could not update the listing status');
  return data;
};

/** Listings owned by the signed-in seller. */
export const fetchMyProducts = async (
  page = 1,
  pageSize = PAGE_SIZE,
): Promise<Paginated<Product>> => {
  const {data} = await api.post(
    'showAllProducts',
    {},
    {headers: paginationHeaders(page, pageSize)},
  );
  const items: Product[] = Array.isArray(data?.data) ? data.data : [];
  return {data: items, totalRecords: toNumber(data?.totalRecords ?? items.length)};
};
