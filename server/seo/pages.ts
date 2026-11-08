import {mapLimit, type Backend} from './backend.js';
import {CITIES, cityBySlug, cityById, cityPath, type SeoCity} from './cities.js';
import {HOME_DESCRIPTION, HOME_TITLE} from '../../src/lib/seoCopy.js';
import {BRAND, BRAND_EN, MEDIA, MIN_CITY_LISTINGS, MIN_COMBO_LISTINGS, MIN_SUBCATEGORY_LISTINGS, PAGE_SIZE, SITE, STORE_LINKS, SUPPORT_EMAIL} from './config.js';
import type {PageDoc} from './document.js';
import {GUIDES, guideBySlug, type Guide} from './guides.js';
import {
  breadcrumbLd, breadcrumbNav, collectionLd, coverUrl, descriptionSnippet, imageAlt, linkList, listingList, paginationNav, trustBlock,
  type Crumb,
} from './html.js';
import {
  arabicName, categoryPath, isIndexableListing, listingCity, listingIdFromSlug, listingPath, listingState,
  type Category, type Product,
} from './model.js';
import {cachedTotal, categoryBlurb, categoryPhrase, popularCities} from './landing.js';
import {absoluteMedia, clip, escapeHtml, isUuid, isoDate, priceText, stripContactDetails, usablePrice} from './text.js';

/**
 * Route → response. Pure data in, `PageResult` out, so the whole indexing
 * policy (status codes, noindex, redirects, canonical) is unit-testable
 * without a server.
 */

export interface PageResult {
  status: number;
  /** 'doc' = render a server-side page; 'shell' = SPA shell with a robots directive. */
  kind: 'doc' | 'shell';
  doc?: PageDoc;
  redirect?: string;
  robots?: string;
  title?: string;
  /** CDN lifetime in seconds. */
  ttl: number;
  retryAfter?: number;
}


/** Routes of the SPA that must never be indexed. */
const NOINDEX_ROUTES: {prefix: string; robots: string}[] = [
  {prefix: '/search', robots: 'noindex, follow'},
  {prefix: '/seller', robots: 'noindex, follow'},
  {prefix: '/sell', robots: 'noindex, nofollow'},
  {prefix: '/favorites', robots: 'noindex, nofollow'},
  {prefix: '/messages', robots: 'noindex, nofollow'},
  {prefix: '/notifications', robots: 'noindex, nofollow'},
  {prefix: '/profile', robots: 'noindex, nofollow'},
  {prefix: '/login', robots: 'noindex, nofollow'},
  {prefix: '/register', robots: 'noindex, nofollow'},
  {prefix: '/verify', robots: 'noindex, nofollow'},
  {prefix: '/forgot-password', robots: 'noindex, nofollow'},
  {prefix: '/reset-password', robots: 'noindex, nofollow'},
  {prefix: '/logout', robots: 'noindex, nofollow'},
  {prefix: '/import', robots: 'noindex, nofollow'},
];

const underPrefix = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

const notFound = (): PageResult => ({status: 404, kind: 'shell', robots: 'noindex, follow', title: `الصفحة غير موجودة | ${BRAND}`, ttl: 60});

const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const parsePage = (value: string | undefined): number => {
  const page = Math.floor(Number(value));
  return Number.isFinite(page) && page >= 1 && page <= 1000 ? page : 1;
};

const withPage = (path: string, page: number) => (page > 1 ? `${path}?page=${page}` : path);
const pageSuffix = (page: number) => (page > 1 ? ` – صفحة ${page}` : '');

const publicOnly = (products: Product[], now: Date) => products.filter(product => isIndexableListing(product, now));

// ---------------------------------------------------------------------------

export interface RouteInput {
  path: string;
  query: Record<string, string | undefined>;
  now?: Date;
}

export const resolveRoute = async (backend: Backend, input: RouteInput): Promise<PageResult> => {
  const now = input.now ?? new Date();
  const path = (input.path.replace(/\/{2,}/g, '/').replace(/(.)\/+$/, '$1') || '/') as string;
  const segments = path.split('/').filter(Boolean).map(safeDecode);

  if (path === '/') return homePage(backend, now);
  if (segments[0] === 'category' && segments.length <= 3) return categoryRoute(backend, segments, input, now);
  if (segments[0] === 'city' && segments.length <= 3) return cityRoute(backend, segments, input, now);
  if (segments[0] === 'listing' && segments.length === 2) return listingRoute(backend, path, segments[1], now);
  if (segments[0] === 'guides' && segments.length <= 2) return guidesRoute(backend, segments[1]);

  const noindex = NOINDEX_ROUTES.find(route => underPrefix(path, route.prefix));
  if (noindex) return {status: 200, kind: 'shell', robots: noindex.robots, ttl: 600};
  return notFound();
};

// ---- home -----------------------------------------------------------------

const homePage = async (backend: Backend, now: Date): Promise<PageResult> => {
  const [categories, latest, cityTotals] = await Promise.all([
    backend.categories(),
    backend.search({}, 1, 24),
    mapLimit(popularCities(), 6, async city => ({city, total: await cachedTotal(backend, {city_id: city.id})})),
  ]);
  const listings = publicOnly(latest.items, now).slice(0, 12);
  const cities = cityTotals.filter(entry => entry.total >= MIN_CITY_LISTINGS).sort((a, b) => b.total - a.total);

  const body = `<main class="container">
  <h1>سوقنا – سوق سوريا للبيع والشراء</h1>
  <p>${escapeHtml(HOME_DESCRIPTION)}</p>
  <section aria-labelledby="cats-h"><h2 id="cats-h">تصفح حسب التصنيف</h2>
  ${linkList(categories.map(category => ({label: categoryPhrase(category), path: categoryPath(category.id)})))}</section>
  <section aria-labelledby="cities-h"><h2 id="cities-h">إعلانات حسب المدينة</h2>
  ${linkList(cities.map(({city}) => ({label: `إعلانات ${city.ar}`, path: cityPath(city)})))}</section>
  <section aria-labelledby="latest-h"><h2 id="latest-h">أحدث الإعلانات</h2>${listingList(listings, {eager: 2})}</section>
  <section aria-labelledby="guides-h"><h2 id="guides-h">أدلة وإجابات مفيدة</h2>
  ${linkList(GUIDES.map(guide => ({label: guide.title, path: `/guides/${guide.slug}`})))}</section>
  ${trustBlock()}
</main>`;

  return {
    status: 200,
    kind: 'doc',
    ttl: 300,
    doc: {
      title: HOME_TITLE,
      description: HOME_DESCRIPTION,
      canonicalPath: '/',
      indexable: true,
      ld: [
        {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          '@id': `${SITE}/#organization`,
          name: BRAND_EN,
          alternateName: BRAND,
          url: `${SITE}/`,
          logo: {'@type': 'ImageObject', url: `${SITE}/logo.png`, width: 512, height: 512},
          description: 'منصة سورية مجانية للبيع والشراء تعمل على الويب وعلى أندرويد وآيفون.',
          areaServed: {'@type': 'Country', name: 'Syria'},
          contactPoint: [{'@type': 'ContactPoint', contactType: 'customer support', email: SUPPORT_EMAIL, availableLanguage: ['ar', 'en']}],
          sameAs: [STORE_LINKS.android, STORE_LINKS.ios],
        },
        {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          '@id': `${SITE}/#website`,
          name: `${BRAND_EN} – ${BRAND}`,
          url: `${SITE}/`,
          inLanguage: 'ar',
          publisher: {'@id': `${SITE}/#organization`},
          // /search?q= is a working public search page (it is noindex, which is fine for a SearchAction target).
          potentialAction: {
            '@type': 'SearchAction',
            target: {'@type': 'EntryPoint', urlTemplate: `${SITE}/search?q={search_term_string}`},
            'query-input': 'required name=search_term_string',
          },
        },
      ],
      body,
    },
  };
};

// ---- categories -----------------------------------------------------------

const categoryRoute = async (backend: Backend, segments: string[], input: RouteInput, now: Date): Promise<PageResult> => {
  const [, categoryId, subId] = segments;
  if (!isUuid(categoryId) || (subId !== undefined && !isUuid(subId))) return notFound();

  const [categories, subCategories] = await Promise.all([backend.categories(), backend.subCategories()]);
  const category = categories.find(entry => entry.id === categoryId);
  const sub = subId ? subCategories.find(entry => entry.id === subId && entry.categoryID === categoryId) : undefined;
  if (!category || (subId && !sub)) return notFound();

  const page = parsePage(input.query.page);
  const feed = await backend.search({categoryID: categoryId, ...(sub ? {subCategoryID: sub.id} : {})}, page, PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(feed.total / PAGE_SIZE));
  if (page > totalPages) return notFound();

  const products = publicOnly(feed.items, now);
  const basePath = categoryPath(categoryId, sub?.id);
  const catName = arabicName(category);
  const subName = sub ? arabicName(sub) : '';
  const indexable = sub ? feed.total >= MIN_SUBCATEGORY_LISTINGS : feed.total >= 1;

  const heading = sub ? `${subName} – ${catName} في سوريا` : `${categoryPhrase(category)} في سوريا`;
  const description = sub
    ? `تصفح ${feed.total} إعلان ضمن ${subName} (${catName}) في سوريا على سوقنا. صور وأسعار ومدن البائعين، وتواصل مباشر عبر المحادثة داخل المنصة.`
    : `تصفح ${feed.total} إعلان ${catName} في سوريا على سوقنا: ${categoryBlurb(category)}. قارن الأسعار وتواصل مع البائعين مباشرة.`;

  const crumbs: Crumb[] = [
    {name: BRAND, path: '/'},
    {name: catName, path: categoryPath(categoryId)},
    ...(sub ? [{name: subName, path: basePath}] : []),
  ];
  const siblings = sub ? [] : subCategories.filter(entry => entry.categoryID === categoryId);
  const topCities = await topCitiesFor(backend, {categoryID: categoryId, ...(sub ? {subCategoryID: sub.id} : {})});

  const body = `<main class="container">
  ${breadcrumbNav(crumbs)}
  <h1>${escapeHtml(heading)}</h1>
  <p>${escapeHtml(description)}</p>
  ${siblings.length ? `<section aria-labelledby="subs-h"><h2 id="subs-h">الفئات الفرعية</h2>${linkList(siblings.map(entry => ({label: `${arabicName(entry)} – ${catName}`, path: categoryPath(categoryId, entry.id)})))}</section>` : ''}
  ${topCities.length ? `<section aria-labelledby="cities-h"><h2 id="cities-h">${escapeHtml(sub ? subName : catName)} حسب المدينة</h2>${linkList(topCities.map(city => ({label: `${categoryPhrase(category)} في ${city.ar}`, path: cityPath(city, categoryId)})))}</section>` : ''}
  <section aria-labelledby="items-h"><h2 id="items-h">الإعلانات</h2>${
    products.length ? listingList(products, {eager: 2}) : '<p>لا توجد إعلانات منشورة حالياً في هذا القسم.</p>'
  }</section>
  ${paginationNav(basePath, page, totalPages)}
  ${trustBlock()}
</main>`;

  return {
    status: 200,
    kind: 'doc',
    ttl: 300,
    doc: {
      title: `${heading}${pageSuffix(page)} | ${BRAND}`,
      description: clip(description, 170),
      canonicalPath: withPage(basePath, page),
      indexable,
      image: products[0] && coverUrl(products[0]) ? {url: coverUrl(products[0]) as string, alt: imageAlt(products[0])} : null,
      ld: [breadcrumbLd(crumbs), collectionLd({name: heading, description, path: withPage(basePath, page), products})],
      body,
    },
  };
};

/** Cities that have a real, indexable page for this filter (used for internal links). */
const topCitiesFor = async (backend: Backend, filters: {categoryID?: string; subCategoryID?: string}): Promise<SeoCity[]> => {
  const rows = await mapLimit(popularCities(), 6, async city => ({city, total: await cachedTotal(backend, {...filters, city_id: city.id})}));
  const min = filters.subCategoryID || filters.categoryID ? MIN_COMBO_LISTINGS : MIN_CITY_LISTINGS;
  return rows.filter(row => row.total >= min).sort((a, b) => b.total - a.total).map(row => row.city);
};

// ---- cities ---------------------------------------------------------------

const cityRoute = async (backend: Backend, segments: string[], input: RouteInput, now: Date): Promise<PageResult> => {
  const [, slug, categoryId] = segments;
  const city = cityBySlug(slug);
  if (!city || (categoryId !== undefined && !isUuid(categoryId))) return notFound();

  const categories = await backend.categories();
  const category = categoryId ? categories.find(entry => entry.id === categoryId) : undefined;
  if (categoryId && !category) return notFound();

  const page = parsePage(input.query.page);
  const filters = {city_id: city.id, ...(category ? {categoryID: category.id} : {})};
  const feed = await backend.search(filters, page, PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(feed.total / PAGE_SIZE));
  if (page > totalPages) return notFound();
  const products = publicOnly(feed.items, now);

  const min = category ? MIN_COMBO_LISTINGS : MIN_CITY_LISTINGS;
  const indexable = feed.total >= min;
  const basePath = cityPath(city, category?.id);
  const phrase = category ? categoryPhrase(category) : 'إعلانات للبيع والشراء';
  const heading = `${phrase} في ${city.ar}`;
  const description = category
    ? `تصفح ${feed.total} إعلان ${arabicName(category)} في ${city.ar} على سوقنا: ${categoryBlurb(category)}. صور وأسعار وتواصل مباشر مع البائعين.`
    : `تصفح ${feed.total} إعلان للبيع والشراء في ${city.ar} على سوقنا: عقارات وسيارات وإلكترونيات وغيرها، مع صور وأسعار وتواصل مباشر مع البائعين.`;

  const crumbs: Crumb[] = [
    {name: BRAND, path: '/'},
    {name: `إعلانات ${city.ar}`, path: cityPath(city)},
    ...(category ? [{name: phrase, path: basePath}] : []),
  ];

  // Category breakdown for the city page: only categories that have a real page.
  let breakdown: {label: string; path: string}[] = [];
  if (!category) {
    const rows = await mapLimit(categories, 4, async entry => ({entry, total: await cachedTotal(backend, {city_id: city.id, categoryID: entry.id})}));
    breakdown = rows
      .filter(row => row.total >= MIN_COMBO_LISTINGS)
      .sort((a, b) => b.total - a.total)
      .map(row => ({label: `${categoryPhrase(row.entry)} في ${city.ar}`, path: cityPath(city, row.entry.id)}));
  }
  const others = popularCities().filter(entry => entry.id !== city.id);

  const body = `<main class="container">
  ${breadcrumbNav(crumbs)}
  <h1>${escapeHtml(heading)}</h1>
  <p>${escapeHtml(description)}</p>
  ${breakdown.length ? `<section aria-labelledby="by-cat-h"><h2 id="by-cat-h">الإعلانات في ${escapeHtml(city.ar)} حسب التصنيف</h2>${linkList(breakdown)}</section>` : ''}
  ${category ? `<p><a href="${escapeHtml(encodeURI(categoryPath(category.id)))}">كل إعلانات ${escapeHtml(arabicName(category))} في سوريا</a> · <a href="${escapeHtml(encodeURI(cityPath(city)))}">كل إعلانات ${escapeHtml(city.ar)}</a></p>` : ''}
  <section aria-labelledby="items-h"><h2 id="items-h">أحدث الإعلانات في ${escapeHtml(city.ar)}</h2>${
    products.length ? listingList(products, {eager: 2}) : '<p>لا توجد إعلانات منشورة حالياً.</p>'
  }</section>
  ${paginationNav(basePath, page, totalPages)}
  <section aria-labelledby="other-h"><h2 id="other-h">مدن أخرى</h2>${linkList(others.map(entry => ({label: `إعلانات ${entry.ar}`, path: cityPath(entry)})))}</section>
  ${trustBlock()}
</main>`;

  return {
    status: 200,
    kind: 'doc',
    ttl: 300,
    doc: {
      title: `${heading}${pageSuffix(page)} | ${BRAND}`,
      description: clip(description, 170),
      canonicalPath: withPage(basePath, page),
      indexable,
      image: products[0] && coverUrl(products[0]) ? {url: coverUrl(products[0]) as string, alt: imageAlt(products[0])} : null,
      ld: [breadcrumbLd(crumbs), collectionLd({name: heading, description, path: withPage(basePath, page), products})],
      body,
    },
  };
};

// ---- listings -------------------------------------------------------------

export const listingMeta = (product: Product) => {
  const city = listingCity(product);
  const name = clip(product.name, 70);
  const title = [name, city, BRAND].filter(Boolean).join(' | ');
  const category = arabicName(product.sub_category) || arabicName(product.category);
  const price = priceText(product.price, product.currency);
  const snippet = descriptionSnippet(product, 110);
  const usable = snippet && snippet !== clip(product.name, 110) ? snippet : '';
  const description = clip(
    [`${category || 'إعلان'}${city ? ` في ${city}` : ''}.`, price && `السعر: ${price}.`, usable].filter(Boolean).join(' '),
    160,
  );
  return {title, description, category, price, city};
};

const listingRoute = async (backend: Backend, requestPath: string, slug: string, now: Date): Promise<PageResult> => {
  const id = listingIdFromSlug(slug);
  if (!id) return notFound();

  const detail = await backend.detail(id);
  if (detail.kind === 'missing') return {status: 404, kind: 'shell', robots: 'noindex, follow', title: `الإعلان غير موجود | ${BRAND}`, ttl: 60};
  if (detail.kind === 'error') return {status: 503, kind: 'shell', robots: 'noindex, follow', ttl: 0, retryAfter: 120};
  const product = detail.product;

  const state = listingState(product, now);
  if (state === 'paused') return {status: 404, kind: 'shell', robots: 'noindex, follow', title: `الإعلان غير متاح | ${BRAND}`, ttl: 60};
  if (state === 'expired') return {status: 410, kind: 'shell', robots: 'noindex, follow', title: `انتهت مدة هذا الإعلان | ${BRAND}`, ttl: 300};

  // One URL per listing: any other slug (bare uuid, stale name, other casing) 301s to the canonical.
  const canonicalPath = listingPath(product);
  const normalise = (value: string) => safeDecode(value).normalize('NFC');
  if (normalise(requestPath) !== normalise(canonicalPath)) {
    return {status: 301, kind: 'shell', redirect: encodeURI(canonicalPath), ttl: 3600};
  }

  const meta = listingMeta(product);
  const images = (product.images ?? []).map(image => absoluteMedia(image.path, MEDIA)).filter((url): url is string => Boolean(url));
  const sold = state === 'sold';
  const indexable = state === 'indexable';
  const amount = usablePrice(product.price);
  const hasPrice = amount !== null;

  const category = product.category;
  const sub = product.sub_category;
  const cityEntry = cityById(product.city_id) ?? CITIES.find(entry => entry.ar === meta.city);
  const cityLink =
    cityEntry && (await cachedTotal(backend, {city_id: cityEntry.id}).catch(() => 0)) >= MIN_CITY_LISTINGS ? cityEntry : undefined;

  const crumbs: Crumb[] = [
    {name: BRAND, path: '/'},
    ...(category?.id ? [{name: arabicName(category), path: categoryPath(category.id)}] : []),
    ...(category?.id && sub?.id ? [{name: arabicName(sub), path: categoryPath(category.id, sub.id)}] : []),
    {name: clip(product.name, 70), path: canonicalPath},
  ];

  const related = await backend
    .search(sub?.id ? {subCategoryID: sub.id} : category?.id ? {categoryID: category.id} : {}, 1, 10)
    .then(feed => publicOnly(feed.items, now).filter(item => item.id !== product.id).slice(0, 6))
    .catch(() => [] as Product[]);

  const published = isoDate(product.created_at);
  const updated = isoDate(product.updated_at);
  const sellerName = (product.seller?.name ?? '').trim();
  const conditionLabel = Number(product.condition) === 1 ? 'جديد' : Number(product.condition) === 2 ? 'مستعمل' : '';
  const dateText = (iso: string | null) => (iso ? iso.slice(0, 10) : '');
  const description = clip(stripContactDetails(product.description ?? ''), 4000);

  const offer = hasPrice
    ? {
        '@type': 'Offer',
        price: amount,
        priceCurrency: String(product.currency || 'USD').toUpperCase(),
        availability: sold ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
        url: `${SITE}${encodeURI(canonicalPath)}`,
        ...(sellerName ? {seller: {'@type': 'Person', name: sellerName}} : {}),
      }
    : undefined;

  const body = `<main class="container">
  ${breadcrumbNav(crumbs)}
  <article>
    <h1>${escapeHtml(product.name)}</h1>
    ${sold ? '<p><strong>تم بيع هذا الغرض.</strong></p>' : ''}
    ${
      images[0]
        ? `<img src="${escapeHtml(images[0])}" alt="${escapeHtml(imageAlt(product))}" width="800" height="600" fetchpriority="high" decoding="async" style="aspect-ratio:4/3;object-fit:contain;max-width:100%;height:auto" />`
        : ''
    }
    ${images.slice(1, 6).map(url => `<img src="${escapeHtml(url)}" alt="${escapeHtml(imageAlt(product))}" width="160" height="120" loading="lazy" decoding="async" style="aspect-ratio:4/3;object-fit:cover" />`).join('')}
    <dl>
      ${meta.price ? `<dt>السعر</dt><dd><strong>${escapeHtml(meta.price)}</strong></dd>` : ''}
      ${category ? `<dt>التصنيف</dt><dd><a href="${escapeHtml(encodeURI(categoryPath(category.id ?? '')))}">${escapeHtml(arabicName(category))}</a>${sub?.id ? ` / <a href="${escapeHtml(encodeURI(categoryPath(category.id ?? '', sub.id)))}">${escapeHtml(arabicName(sub))}</a>` : ''}</dd>` : ''}
      ${meta.city ? `<dt>المدينة</dt><dd>${cityLink ? `<a href="${escapeHtml(encodeURI(cityPath(cityLink)))}">${escapeHtml(meta.city)}</a>` : escapeHtml(meta.city)}</dd>` : ''}
      ${conditionLabel ? `<dt>الحالة</dt><dd>${conditionLabel}</dd>` : ''}
      ${published ? `<dt>تاريخ النشر</dt><dd><time datetime="${published}">${dateText(published)}</time></dd>` : ''}
      ${updated && updated !== published ? `<dt>آخر تحديث</dt><dd><time datetime="${updated}">${dateText(updated)}</time></dd>` : ''}
      ${sellerName ? `<dt>البائع</dt><dd>${escapeHtml(sellerName)}</dd>` : ''}
    </dl>
    <section aria-labelledby="desc-h"><h2 id="desc-h">الوصف</h2><p>${escapeHtml(description).replace(/\r?\n/g, '<br />')}</p></section>
  </article>
  ${related.length ? `<section aria-labelledby="rel-h"><h2 id="rel-h">إعلانات مشابهة</h2>${listingList(related)}</section>` : ''}
  ${trustBlock()}
</main>`;

  return {
    status: 200,
    kind: 'doc',
    ttl: 300,
    doc: {
      title: meta.title,
      description: meta.description,
      canonicalPath,
      indexable,
      ogType: 'product',
      image: images[0] ? {url: images[0], alt: imageAlt(product)} : null,
      headExtra: images[0] ? [`<link rel="preload" as="image" href="${escapeHtml(images[0])}" fetchpriority="high" />`] : [],
      ld: [
        {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.name,
          description: clip(description, 500) || undefined,
          image: images.length ? images : undefined,
          category: arabicName(sub) || arabicName(category) || undefined,
          sku: product.id,
          itemCondition: Number(product.condition) === 1 ? 'https://schema.org/NewCondition' : Number(product.condition) === 2 ? 'https://schema.org/UsedCondition' : undefined,
          offers: offer,
        },
        breadcrumbLd(crumbs),
      ],
      body,
    },
  };
};

// ---- guides ---------------------------------------------------------------

const guideBody = (guide: Guide, links: {label: string; path: string}[]): string => `<main class="container guide">
  ${breadcrumbNav([{name: BRAND, path: '/'}, {name: 'أدلة سوقنا', path: '/guides'}, {name: guide.title, path: `/guides/${guide.slug}`}])}
  <article>
    <h1>${escapeHtml(guide.title)}</h1>
    <p><strong>${escapeHtml(guide.answer)}</strong></p>
    ${guide.sections
      .map(
        section => `<section><h2>${escapeHtml(section.heading)}</h2>${(section.paragraphs ?? []).map(text => `<p>${escapeHtml(text)}</p>`).join('')}${
          section.list ? `<${section.ordered ? 'ol' : 'ul'}>${section.list.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</${section.ordered ? 'ol' : 'ul'}>` : ''
        }</section>`,
      )
      .join('')}
    <section><h2>أسئلة شائعة</h2>${guide.faq.map(item => `<h3>${escapeHtml(item.q)}</h3><p>${escapeHtml(item.a)}</p>`).join('')}</section>
    <p><small>آخر مراجعة للمحتوى: <time datetime="${guide.updated}">${guide.updated}</time></small></p>
  </article>
  <section><h2>روابط مفيدة</h2>${linkList(links)}</section>
  ${trustBlock()}
</main>`;

const GUIDE_STYLE = `<style>body{margin:0;font-family:"IBM Plex Sans Arabic",system-ui,sans-serif;line-height:1.9;background:#f8fafc;color:#0f172a}
.container{max-width:860px;margin:0 auto;padding:24px 16px}.site-bar{background:#008e91;padding:12px 16px}.site-bar a{color:#fff;font-weight:700;text-decoration:none}
h1{color:#006f72}h2{color:#006f72;border-bottom:2px solid #008e91;padding-bottom:6px}a{color:#006f72}.breadcrumb{list-style:none;display:flex;gap:8px;padding:0;flex-wrap:wrap}
.breadcrumb li+li::before{content:"›";margin-inline-end:8px}</style>`;

const resolveGuideLinks = (guide: Guide, categories: Category[]): {label: string; path: string}[] =>
  guide.links.flatMap(link => {
    if (link.kind === 'path') return [{label: link.label, path: link.key}];
    if (link.kind === 'city') return cityBySlug(link.key) ? [{label: link.label, path: cityPath(cityBySlug(link.key) as SeoCity)}] : [];
    const category = categories.find(entry => arabicName(entry).includes(link.key));
    return category ? [{label: link.label, path: categoryPath(category.id)}] : [];
  });

const guidesRoute = async (backend: Backend, slug: string | undefined): Promise<PageResult> => {
  const bar = `<div class="site-bar"><a href="/">${BRAND} – سوق سوريا للبيع والشراء</a></div>`;
  if (!slug) {
    const crumbs: Crumb[] = [{name: BRAND, path: '/'}, {name: 'أدلة سوقنا', path: '/guides'}];
    return {
      status: 200,
      kind: 'doc',
      ttl: 3600,
      doc: {
        title: `أدلة سوقنا: شراء وبيع وإيجار في سوريا | ${BRAND}`,
        description: 'أدلة عملية بالعربية: كيف تشتري سيارة مستعملة، وتجد شقة للبيع أو الإيجار، وتبيع أغراضك وتنشر إعلانك مجاناً على سوقنا.',
        canonicalPath: '/guides',
        indexable: true,
        spa: false,
        ld: [breadcrumbLd(crumbs)],
        body: `${GUIDE_STYLE}${bar}<main class="container">${breadcrumbNav(crumbs)}<h1>أدلة سوقنا</h1>
        <p>إجابات عملية على أسئلة يطرحها المشترون والبائعون في سوريا.</p>
        <ul>${GUIDES.map(guide => `<li><h2><a href="/guides/${guide.slug}">${escapeHtml(guide.title)}</a></h2><p>${escapeHtml(guide.answer)}</p></li>`).join('')}</ul>${trustBlock()}</main>`,
      },
    };
  }
  const guide = guideBySlug(slug);
  if (!guide) return notFound();
  const categories = await backend.categories().catch(() => [] as Category[]);
  const crumbs: Crumb[] = [{name: BRAND, path: '/'}, {name: 'أدلة سوقنا', path: '/guides'}, {name: guide.title, path: `/guides/${guide.slug}`}];
  return {
    status: 200,
    kind: 'doc',
    ttl: 3600,
    doc: {
      title: `${guide.title} | ${BRAND}`,
      description: guide.description,
      canonicalPath: `/guides/${guide.slug}`,
      indexable: true,
      ogType: 'article',
      spa: false,
      ld: [
        breadcrumbLd(crumbs),
        {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: guide.title,
          description: guide.description,
          inLanguage: 'ar',
          dateModified: guide.updated,
          mainEntityOfPage: `${SITE}/guides/${guide.slug}`,
          author: {'@type': 'Organization', name: BRAND},
          publisher: {'@id': `${SITE}/#organization`, '@type': 'Organization', name: BRAND_EN, logo: {'@type': 'ImageObject', url: `${SITE}/logo.png`}},
        },
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: guide.faq.map(item => ({'@type': 'Question', name: item.q, acceptedAnswer: {'@type': 'Answer', text: item.a}})),
        },
      ],
      body: `${GUIDE_STYLE}${bar}${guideBody(guide, resolveGuideLinks(guide, categories))}`,
    },
  };
};

