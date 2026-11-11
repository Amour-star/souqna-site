import {mapLimit, type Backend} from './backend.js';
import {CITIES, type SeoCity} from './cities.js';
import {arabicName, type Category} from './model.js';

/**
 * Short, hand-written Arabic search phrases for the known top-level
 * categories. Anything else falls back to «<name> للبيع في سوريا».
 */
const PHRASES: {match: RegExp; phrase: string; blurb: string}[] = [
  {match: /عقار/, phrase: 'عقارات للبيع والإيجار', blurb: 'شقق ومنازل وأراضٍ ومحلات للبيع والإيجار يعرضها ملاكها ووسطاؤها'},
  {match: /سيار|مركب/, phrase: 'سيارات للبيع', blurb: 'سيارات ودراجات نارية ومركبات جديدة ومستعملة'},
  {match: /إلكترون|الكترون|موبايل|هاتف/, phrase: 'إلكترونيات وموبايلات للبيع', blurb: 'هواتف وحواسيب وأجهزة إلكترونية جديدة ومستعملة'},
  {match: /أثاث|اثاث|منزل/, phrase: 'أثاث ومستلزمات منزلية للبيع', blurb: 'أثاث وأدوات منزلية بحالات مختلفة'},
  {match: /حيوان/, phrase: 'حيوانات أليفة للبيع', blurb: 'حيوانات أليفة ومستلزماتها'},
  {match: /خدم/, phrase: 'خدمات', blurb: 'خدمات يعرضها أفراد وشركات'},
  {match: /قطع|غيار/, phrase: 'قطع غيار للبيع', blurb: 'قطع غيار للسيارات والآليات'},
  {match: /جديد|مستعمل/, phrase: 'أغراض جديدة ومستعملة للبيع', blurb: 'أغراض متنوعة جديدة ومستعملة'},
];

export const categoryPhrase = (category: Pick<Category, 'name' | 'ar_name'>): string => {
  const name = arabicName(category);
  return PHRASES.find(entry => entry.match.test(name))?.phrase ?? `${name} للبيع`;
};

export const categoryBlurb = (category: Pick<Category, 'name' | 'ar_name'>): string =>
  PHRASES.find(entry => entry.match.test(arabicName(category)))?.blurb ?? `إعلانات ${arabicName(category)} يضيفها أفراد وتجار`;

// ---- short-lived memo for landing-page totals (per warm function instance) ----

const memo = new Map<string, {at: number; value: number}>();
const TTL = 10 * 60 * 1000;

export const cachedTotal = async (
  backend: Backend,
  filters: {city_id?: number; categoryID?: string; subCategoryID?: string},
): Promise<number> => {
  const key = JSON.stringify(filters);
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  const {total} = await backend.search(filters, 1, 1);
  memo.set(key, {at: Date.now(), value: total});
  return total;
};

export const clearTotalsCache = () => memo.clear();

/** Cities of `candidates` whose public inventory reaches `min` (uses cached totals). */
export const citiesWithInventory = async (
  backend: Backend,
  candidates: SeoCity[],
  min: number,
): Promise<{city: SeoCity; total: number}[]> => {
  const totals = await mapLimit(candidates, 6, async city => ({city, total: await cachedTotal(backend, {city_id: city.id})}));
  return totals.filter(entry => entry.total >= min).sort((a, b) => b.total - a.total);
};

export const popularCities = (): SeoCity[] => CITIES.filter(city => city.isPopular);
