#!/usr/bin/env node
/**
 * Post-build prerender for search engines and link previews.
 *
 * Souqna is a client-rendered SPA on static hosting, so a crawler that does not
 * run JavaScript (most social/link-preview bots, and Google's first pass) would
 * see an empty page. This step writes a real HTML page for every crawlable
 * route — home, categories, subcategories and recent listings — containing the
 * correct <title>, description, canonical URL, Open Graph tags, JSON-LD and a
 * semantic HTML body with real links.
 *
 * It is not SSR and does not hydrate: React's `createRoot` replaces the static
 * body the moment the app boots, so users still get the full SPA. Files are flat
 * (`listing/<id>.html`, `category/<id>.html`, `home.html`) and public/.htaccess
 * rewrites the public URLs onto them — see `fileFor`. A route with no prerendered
 * file, and every account page, falls through to the neutral SPA shell.
 *
 * All data comes from the live API. If the API is unreachable the step logs a
 * warning and leaves the plain SPA build untouched — it never fails a deploy.
 *
 *   npm run build          (runs this automatically)
 *   PRERENDER_LISTINGS=500 node scripts/prerender.mjs
 */
import {readFile, writeFile, mkdir, access} from 'node:fs/promises';
import path from 'node:path';

const API = (process.env.VITE_API_URL || 'https://backend.souqna.net/api').replace(/\/+$/, '');
const SITE = (process.env.VITE_SITE_URL || 'https://www.souqna.net').replace(/\/+$/, '');
const MEDIA = API.replace(/\/api$/i, '');
const DIST = 'dist';
const MAX_LISTINGS = Number(process.env.PRERENDER_LISTINGS || 300);
const CATEGORY_PAGE_SIZE = 24;

const HOME_TITLE = 'سوقنا | سوق سوريا للبيع والشراء';
const HOME_DESCRIPTION =
  'سوقنا منصة سورية آمنة وموثوقة للبيع والشراء. تصفح الإعلانات ابحث عن السيارات والموبايلات والعقارات والأثاث وغيرها في مختلف مناطق سوريا.';

// ---------------------------------------------------------------------------
// helpers (kept in step with src/lib/format.ts)
// ---------------------------------------------------------------------------

const slugify = value =>
  (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70);

const listingPath = product => {
  const slug = slugify([product.name, product.location?.split(',')[0]].filter(Boolean).join(' '));
  return slug ? `/listing/${slug}-${product.id}` : `/listing/${product.id}`;
};

const mediaUrl = value => {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  return /^https?:\/\//i.test(text) ? text : `${MEDIA}/${text.replace(/^\/+/, '')}`;
};

const escapeHtml = value =>
  String(value ?? '').replace(/[&<>"']/g, character =>
    ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[character],
  );

/** JSON for an inline <script>: `<` is escaped so user text can never close the tag. */
const jsonLd = data => JSON.stringify(data).replace(/</g, '\\u003c');

const clip = (value, length) => {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
};

/** Locations are free text and often carry stray underscores from hand-typed ads. */
const cleanLocation = value => String(value ?? '').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();

const arabicName = item => item?.ar_name || item?.name || '';

const isPublished = status => [0, 1].includes(Number(status));

const CURRENCY_LABEL = {USD: 'دولار', SYP: 'ل.س', TRY: 'ليرة تركية'};
const priceText = product => {
  const amount = Number(product.price);
  if (!Number.isFinite(amount) || amount <= 0) return '';
  const currency = product.currency || 'USD';
  return `${amount.toLocaleString('en-US')} ${CURRENCY_LABEL[currency] ?? currency}`;
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** The API occasionally answers 5xx under load; retry before giving up on a page. */
const getJson = async (url, init, attempt = 0) => {
  try {
    const response = await fetch(url, {
      headers: {Accept: 'application/json'},
      signal: AbortSignal.timeout(30_000),
      ...init,
    });
    if (!response.ok) throw new Error(`${url} → HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    if (attempt >= 3) throw error;
    await sleep(700 * (attempt + 1));
    return getJson(url, init, attempt + 1);
  }
};

/** Runs a page builder; a failure skips that page rather than the whole prerender. */
const attempt = async (label, build) => {
  try {
    return await build();
  } catch (error) {
    console.warn(`prerender: skipped ${label} (${error.message})`);
    return null;
  }
};

const searchProducts = async (body, pageSize) => {
  const payload = await getJson(`${API}/showProductsWithoutAuth`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      pageNo: '1',
      recordsPerPage: String(pageSize),
    },
    body: JSON.stringify(body),
  });
  return {
    items: (payload?.data ?? []).filter(item => isPublished(item.status)),
    total: Number(payload?.totalRecords) || 0,
  };
};

/** Runs `worker` over `items` with bounded concurrency, to stay polite to the API. */
const mapLimit = async (items, limit, worker) => {
  const results = new Array(items.length);
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

// ---------------------------------------------------------------------------
// HTML assembly
// ---------------------------------------------------------------------------

let template = '';

const replaceOnce = (html, pattern, replacement) =>
  pattern.test(html) ? html.replace(pattern, () => replacement) : html;

const render = ({route, title, description, image, type = 'website', ld = [], body}) => {
  const url = `${SITE}${route}`;
  const fullTitle = title.includes('سوقنا') || title.includes('Souqna') ? title : `${title} | سوقنا`;

  let html = template;
  html = replaceOnce(html, /<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(fullTitle)}</title>`);
  html = replaceOnce(
    html,
    /<meta\s+name="description"[\s\S]*?\/>/,
    `<meta name="description" content="${escapeHtml(description)}" />`,
  );
  // The template already ships a generic og:image; drop it so the page-specific one wins.
  html = html.replace(/\s*<meta property="og:image"[^>]*\/>/, '');

  const head = [
    `<link rel="canonical" href="${escapeHtml(url)}" />`,
    `<meta property="og:type" content="${type}" />`,
    `<meta property="og:title" content="${escapeHtml(fullTitle)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
    `<meta property="og:locale" content="ar_SY" />`,
    `<meta property="og:image" content="${escapeHtml(image || `${SITE}/logo.png`)}" />`,
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`,
    ...ld.map(data => `<script type="application/ld+json">${jsonLd(data)}</script>`),
  ].join('\n    ');

  html = html.replace('</head>', () => `    ${head}\n  </head>`);
  html = replaceOnce(html, /<div id="root"><\/div>/, `<div id="root">${body}</div>`);
  return html;
};

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/**
 * Where a route's prerendered HTML lives. Files are flat and named by ASCII id
 * — never `<slug>/index.html` — for two reasons: Apache answers a directory
 * request without a trailing slash with a 301 to the slashed URL (which would
 * contradict the canonical), and Arabic slugs make fragile filenames. The
 * .htaccess rewrites map the public URL onto these files.
 *
 *   /                    → home.html          (via DirectoryIndex)
 *   /listing/<slug>-<id> → listing/<id>.html
 *   /category/<c>        → category/<c>.html
 *   /category/<c>/<s>    → category/<c>__<s>.html
 */
const fileFor = route => {
  if (route === '/') return path.join(DIST, 'home.html');
  const listing = route.match(new RegExp(`^/listing/.*?(${UUID})$`, 'i'));
  if (listing) return path.join(DIST, 'listing', `${listing[1]}.html`);
  const category = route.match(new RegExp(`^/category/(${UUID})(?:/(${UUID}))?$`, 'i'));
  if (category) {
    return path.join(DIST, 'category', `${category[1]}${category[2] ? `__${category[2]}` : ''}.html`);
  }
  throw new Error(`No prerender file mapping for ${route}`);
};

const writePage = async (route, html) => {
  const file = fileFor(route);
  await mkdir(path.dirname(file), {recursive: true});
  await writeFile(file, html, 'utf8');
};

const breadcrumbLd = crumbs => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: crumbs.map((crumb, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: crumb.name,
    item: `${SITE}${crumb.path}`,
  })),
});

const breadcrumbNav = crumbs =>
  `<nav aria-label="مسار التصفح"><ol>${crumbs
    .map(crumb => `<li><a href="${escapeHtml(crumb.path)}">${escapeHtml(crumb.name)}</a></li>`)
    .join('')}</ol></nav>`;

const listingLinks = products =>
  products.length
    ? `<ul>${products
        .map(product => {
          const price = priceText(product);
          return `<li><a href="${escapeHtml(listingPath(product))}">${escapeHtml(
            product.name,
          )}</a>${price ? ` — ${escapeHtml(price)}` : ''}${
            product.location ? ` — ${escapeHtml(clip(product.location, 60))}` : ''
          }</li>`;
        })
        .join('')}</ul>`
    : '';

const itemListLd = products => ({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  itemListElement: products.map((product, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    url: `${SITE}${listingPath(product)}`,
    name: product.name,
  })),
});

// ---------------------------------------------------------------------------
// page builders
// ---------------------------------------------------------------------------

const homePage = ({categories, latest}) =>
  render({
    route: '/',
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    ld: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Souqna — سوقنا',
        url: SITE,
        inLanguage: 'ar',
        potentialAction: {
          '@type': 'SearchAction',
          target: `${SITE}/search?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Souqna',
        alternateName: 'سوقنا',
        url: SITE,
        logo: `${SITE}/logo.png`,
        areaServed: {'@type': 'Country', name: 'Syria'},
      },
    ],
    body: `<main class="container">
      <h1>سوقنا — سوق سوريا للبيع والشراء</h1>
      <p>${escapeHtml(HOME_DESCRIPTION)}</p>
      <h2>التصنيفات</h2>
      <ul>${categories
        .map(
          category =>
            `<li><a href="/category/${escapeHtml(category.id)}">${escapeHtml(arabicName(category))}</a></li>`,
        )
        .join('')}</ul>
      <h2>أحدث الإعلانات</h2>
      ${listingLinks(latest)}
    </main>`,
  });

const categoryPage = ({category, subCategory, siblings, products, total}) => {
  const categoryName = arabicName(category);
  const subName = subCategory ? arabicName(subCategory) : '';
  const heading = subName ? `${subName} — ${categoryName}` : categoryName;
  const route = subCategory
    ? `/category/${category.id}/${subCategory.id}`
    : `/category/${category.id}`;
  const crumbs = [
    {name: 'سوقنا', path: '/'},
    {name: categoryName, path: `/category/${category.id}`},
    ...(subCategory ? [{name: subName, path: route}] : []),
  ];
  const description = total
    ? `تصفح ${total} إعلان ضمن ${heading} في سوريا على سوقنا. قارن الأسعار وتواصل مع البائعين مباشرة.`
    : `تصفح إعلانات ${heading} في سوريا على سوقنا.`;

  return render({
    route,
    title: `${heading} في سوريا`,
    description,
    image: mediaUrl(products[0]?.images?.[0]?.path),
    ld: [breadcrumbLd(crumbs), ...(products.length ? [itemListLd(products)] : [])],
    body: `<main class="container">
      ${breadcrumbNav(crumbs)}
      <h1>${escapeHtml(heading)}</h1>
      <p>${escapeHtml(description)}</p>
      ${
        !subCategory && siblings.length
          ? `<h2>الفئات الفرعية</h2><ul>${siblings
              .map(
                sub =>
                  `<li><a href="/category/${escapeHtml(category.id)}/${escapeHtml(sub.id)}">${escapeHtml(
                    arabicName(sub),
                  )}</a></li>`,
              )
              .join('')}</ul>`
          : ''
      }
      ${listingLinks(products)}
    </main>`,
  });
};

const conditionSchema = {1: 'https://schema.org/NewCondition', 2: 'https://schema.org/UsedCondition'};

const listingPage = ({product, category, subCategory}) => {
  const route = listingPath(product);
  const images = (product.images ?? []).map(image => mediaUrl(image.path)).filter(Boolean);
  const price = priceText(product);
  // The name is already in the title, so the description leads with price and place.
  const description = clip(
    [price, cleanLocation(product.location), product.description].filter(Boolean).join(' — '),
    160,
  );
  const crumbs = [
    {name: 'سوقنا', path: '/'},
    ...(category ? [{name: arabicName(category), path: `/category/${category.id}`}] : []),
    ...(category && subCategory
      ? [{name: arabicName(subCategory), path: `/category/${category.id}/${subCategory.id}`}]
      : []),
    {name: product.name, path: route},
  ];
  const amount = Number(product.price);

  return render({
    route,
    title: [product.name, clip(cleanLocation(product.location), 40)].filter(Boolean).join(' — '),
    description,
    image: images[0],
    type: 'product',
    ld: [
      {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        description: clip(product.description, 500) || undefined,
        image: images.length ? images : undefined,
        category: category ? arabicName(category) : undefined,
        itemCondition: conditionSchema[Number(product.condition)],
        offers: {
          '@type': 'Offer',
          price: Number.isFinite(amount) && amount > 0 ? amount : undefined,
          priceCurrency: product.currency || 'USD',
          availability: 'https://schema.org/InStock',
          url: `${SITE}${route}`,
          areaServed: product.location || undefined,
        },
      },
      breadcrumbLd(crumbs),
    ],
    body: `<main class="container">
      ${breadcrumbNav(crumbs)}
      <article>
        <h1>${escapeHtml(product.name)}</h1>
        ${images[0] ? `<img src="${escapeHtml(images[0])}" alt="${escapeHtml(product.name)}" width="640" />` : ''}
        ${price ? `<p><strong>${escapeHtml(price)}</strong></p>` : ''}
        ${product.location ? `<p>${escapeHtml(product.location)}</p>` : ''}
        <p>${escapeHtml(clip(product.description, 1500))}</p>
      </article>
    </main>`,
  });
};

// ---------------------------------------------------------------------------

const main = async () => {
  try {
    await access(path.join(DIST, 'index.html'));
  } catch {
    throw new Error('dist/index.html not found — run `vite build` first');
  }
  template = await readFile(path.join(DIST, 'index.html'), 'utf8');

  const [categoriesPayload, subCategoriesPayload] = await Promise.all([
    getJson(`${API}/viewCategories`),
    getJson(`${API}/viewSubCategories`),
  ]);
  const categories = (categoriesPayload?.data ?? []).filter(item => Number(item.status) === 1);
  const subCategories = (subCategoriesPayload?.data ?? []).filter(item => Number(item.status) === 1);
  const categoryById = new Map(categories.map(category => [category.id, category]));

  const latest = (await attempt('latest listings', () => searchProducts({}, 12))) ?? {items: []};
  const pages = [];

  pages.push(['/', homePage({categories, latest: latest.items.slice(0, 12)})]);

  // Categories.
  await mapLimit(categories, 3, category =>
    attempt(`category ${category.id}`, async () => {
      const {items, total} = await searchProducts({categoryID: category.id}, CATEGORY_PAGE_SIZE);
      const siblings = subCategories.filter(sub => sub.categoryID === category.id);
      pages.push([
        `/category/${category.id}`,
        categoryPage({category, siblings, products: items, total}),
      ]);
    }),
  );

  // Subcategories — only those that actually hold listings, so crawlers are
  // not sent to dozens of empty pages.
  const subCategoryPages = await mapLimit(subCategories, 4, subCategory =>
    attempt(`subcategory ${subCategory.id}`, async () => {
      const category = categoryById.get(subCategory.categoryID);
      if (!category) return null;
      const {items, total} = await searchProducts(
        {categoryID: category.id, subCategoryID: subCategory.id},
        CATEGORY_PAGE_SIZE,
      );
      if (!items.length) return null;
      return [
        `/category/${category.id}/${subCategory.id}`,
        categoryPage({category, subCategory, siblings: [], products: items, total}),
      ];
    }),
  );
  pages.push(...subCategoryPages.filter(Boolean));

  // Listings: newest first, up to the cap.
  const listings = [];
  for (let page = 1; listings.length < MAX_LISTINGS; page += 1) {
    const payload = await attempt(`listings page ${page}`, () => getJson(`${API}/showProductsWithoutAuth`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        pageNo: String(page),
        recordsPerPage: '100',
      },
      body: '{}',
    }));
    if (!payload) break;
    const batch = (payload?.data ?? []).filter(item => isPublished(item.status));
    listings.push(...batch);
    if (!payload?.data?.length || page * 100 >= Number(payload?.totalRecords || 0)) break;
  }

  const subCategoryById = new Map(subCategories.map(sub => [sub.id, sub]));
  for (const product of listings.slice(0, MAX_LISTINGS)) {
    pages.push([
      listingPath(product),
      listingPage({
        product,
        category: categoryById.get(product.categoryID),
        subCategory: subCategoryById.get(product.subCategoryID),
      }),
    ]);
  }

  for (const [route, html] of pages) await writePage(route, html);
  console.log(
    `prerender: wrote ${pages.length} pages (${categories.length} categories, ` +
      `${subCategoryPages.filter(Boolean).length} subcategories, ${Math.min(listings.length, MAX_LISTINGS)} listings)`,
  );
};

main().catch(error => {
  // A stale or missing prerender must never block a deploy: the SPA still works.
  console.warn(`prerender skipped: ${error.message}`);
});
