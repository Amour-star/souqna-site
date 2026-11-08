import type {Backend, DetailResult, Page, SearchFilters} from '../seo/backend.js';
import type {Category, Product, SubCategory} from '../seo/model.js';

export const CAT_RE = '11111111-1111-4111-8111-111111111111';
export const CAT_CAR = '22222222-2222-4222-8222-222222222222';
export const CAT_PET = '33333333-3333-4333-8333-333333333333';
export const SUB_APT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const SUB_SEDAN = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

export const categories: Category[] = [
  {id: CAT_RE, name: 'Property', ar_name: 'عقارات', status: 1},
  {id: CAT_CAR, name: 'Vehicle', ar_name: 'السيارات', status: 1},
  {id: CAT_PET, name: 'Pets', ar_name: 'الحيوانات', status: 1},
];
export const subCategories: SubCategory[] = [
  {id: SUB_APT, categoryID: CAT_RE, name: 'Apartments', ar_name: 'شقق', status: 1},
  {id: SUB_SEDAN, categoryID: CAT_CAR, name: 'Sedans', ar_name: 'سيارات سياحية', status: 1},
];

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const NOW = new Date('2026-11-08T12:00:00Z');

export interface MakeOptions extends Partial<Product> {
  n: number;
}

export const makeProduct = ({n, ...rest}: MakeOptions): Product => ({
  id: uuid(n),
  name: `إعلان رقم ${n} للبيع`,
  description: `وصف مفصل للإعلان رقم ${n} يتضمن معلومات كافية عن الغرض المعروض. للتواصل 0991236${String(n).padStart(3, '0')}`,
  price: 1000 + n,
  currency: 'USD',
  status: 0,
  location: 'دمشق',
  city: 'دمشق',
  city_id: 1,
  categoryID: CAT_RE,
  subCategoryID: SUB_APT,
  date: '2026-11-01',
  expDate: '2027-01-30',
  created_at: new Date(NOW.getTime() - n * 60_000).toISOString(),
  updated_at: new Date(NOW.getTime() - n * 60_000).toISOString(),
  images: [{path: `/productImages/${n}.jpg`}],
  category: {id: CAT_RE, name: 'Property', ar_name: 'عقارات'},
  sub_category: {id: SUB_APT, name: 'Apartments', ar_name: 'شقق'},
  seller: {id: 'seller-1', name: 'بائع تجريبي'},
  ...rest,
});

/** In-memory stand-in for the Laravel API: newest-first feed, filters, pagination. */
export const fakeBackend = (products: Product[], options: {failDetail?: boolean} = {}): Backend => {
  const sorted = [...products].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const matches = (filters: SearchFilters, product: Product) =>
    (!filters.categoryID || product.categoryID === filters.categoryID) &&
    (!filters.subCategoryID || product.subCategoryID === filters.subCategoryID) &&
    (!filters.city_id || Number(product.city_id) === filters.city_id);
  return {
    categories: async () => categories,
    subCategories: async () => subCategories,
    async search(filters, pageNo, pageSize): Promise<Page<Product>> {
      const all = sorted.filter(product => matches(filters, product));
      return {items: all.slice((pageNo - 1) * pageSize, pageNo * pageSize), total: all.length};
    },
    async detail(id): Promise<DetailResult> {
      if (options.failDetail) return {kind: 'error', message: 'boom'};
      const product = products.find(entry => entry.id === id);
      return product ? {kind: 'ok', product} : {kind: 'missing'};
    },
  };
};
