/**
 * Server-side rendering (SSR) and <head> tags for listing pages (WEB-03, Phase 4, Phase 6).
 *
 * Runs inside the Vercel serverless function on `/listing/:slug` and under Vitest.
 * Injects:
 *   - Semantic HTML inside `<div id="root">` (title, price, city, category, image, description, seller, breadcrumbs)
 *   - Accurate JSON-LD schema (Product, Offer, BreadcrumbList)
 *   - Open Graph, Twitter Cards, Canonical tag
 *   - True HTTP 404 with noindex on deleted / non-existent listings (fixing Soft 404s)
 */

export interface MetaProduct {
  id: string;
  name?: string;
  description?: string;
  price?: number | string;
  currency?: string;
  location?: string;
  city?: string;
  status?: number | string;
  condition?: number | string;
  created_at?: string;
  updated_at?: string;
  expDate?: string;
  categoryID?: string;
  subCategoryID?: string;
  category?: {id?: string; name?: string; ar_name?: string};
  sub_category?: {id?: string; name?: string; ar_name?: string};
  seller?: {name?: string; phone?: string; phoneNo?: string};
  seller_phone?: string;
  sellerPhone?: string;
  contactInfo?: string;
  images?: {path?: string}[];
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `<slug>-<uuid>` (or a bare uuid) → uuid. */
export const listingIdFromSlug = (slug: string): string | null =>
  slug.match(UUID)?.[0] ?? null;

export const escapeAttr = (value: string): string =>
  String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch] as string));

const clip = (value: string, length: number): string => {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
};

const CURRENCY_LABEL: Record<string, string> = {USD: 'دولار', SYP: 'ل.س', TRY: 'ليرة تركية'};

const absoluteMedia = (value: string | undefined, mediaBase: string): string | null => {
  const text = value?.trim();
  if (!text) return null;
  return /^https?:\/\//i.test(text) ? text : `${mediaBase}/${text.replace(/^\/+/, '')}`;
};

export interface ListingMeta {
  title: string;
  description: string;
  image: string | null;
  url: string;
  indexable: boolean;
  product?: MetaProduct;
}

export const buildListingMeta = (
  product: MetaProduct,
  siteUrl: string,
  mediaBase: string,
  requestPath: string,
): ListingMeta => {
  const amount = Number(product.price);
  const price =
    Number.isFinite(amount) && amount > 0
      ? `${amount.toLocaleString('en-US')} ${CURRENCY_LABEL[product.currency ?? 'USD'] ?? product.currency}`
      : '';
  const cityName = product.city || (product.location ?? '').split(/[,–-]/)[0]?.replace(/_+/g, ' ').trim();
  const location = (product.location ?? '').replace(/_+/g, ' ').trim();
  const titleCore = clip(product.name ?? '', 90);

  // Suggested title: [Listing title] | [City] | سوقنا
  const title = cityName
    ? `${titleCore} | ${cityName} | سوقنا`
    : `${titleCore} | سوقنا`;

  const categoryName = product.category?.ar_name || product.category?.name || '';
  const descParts = [
    titleCore,
    cityName ? `في ${cityName}` : location ? `في ${location}` : null,
    categoryName ? `ضمن فئة ${categoryName}` : null,
    price ? `السعر: ${price}` : null,
    product.description ? clip(product.description, 140) : null,
  ].filter(Boolean);

  return {
    title,
    description: clip(descParts.join(' — '), 160),
    image: absoluteMedia(product.images?.[0]?.path, mediaBase),
    url: `${siteUrl}${requestPath}`,
    indexable: [0, 1].includes(Number(product.status ?? 1)),
    product,
  };
};

/** JSON-LD generator for Product, Offer, and BreadcrumbList */
export const buildListingJsonLd = (
  product: MetaProduct,
  meta: ListingMeta,
  siteUrl: string,
  mediaBase: string,
): Record<string, unknown> => {
  const images: string[] = (product.images ?? [])
    .map(img => absoluteMedia(img.path, mediaBase))
    .filter((img): img is string => Boolean(img));

  const amount = Number(product.price);
  const categoryName = product.category?.ar_name || product.category?.name || 'سوق سوريا';
  const subCategoryName = product.sub_category?.ar_name || product.sub_category?.name;

  const breadcrumbItems = [
    {'@type': 'ListItem', position: 1, name: 'الرئيسية', item: siteUrl},
  ];

  if (product.category?.id || product.categoryID) {
    const catId = product.category?.id || product.categoryID;
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 2,
      name: categoryName,
      item: `${siteUrl}/category/${catId}`,
    });
  }

  if ((product.sub_category?.id || product.subCategoryID) && (product.category?.id || product.categoryID)) {
    const catId = product.category?.id || product.categoryID;
    const subId = product.sub_category?.id || product.subCategoryID;
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 3,
      name: subCategoryName || 'الفئة الفرعية',
      item: `${siteUrl}/category/${catId}/${subId}`,
    });
  }

  breadcrumbItems.push({
    '@type': 'ListItem',
    position: breadcrumbItems.length + 1,
    name: product.name ?? 'إعلان',
    item: meta.url,
  });

  const conditionMap: Record<number, string> = {
    1: 'https://schema.org/NewCondition',
    2: 'https://schema.org/UsedCondition',
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        name: product.name ?? '',
        description: product.description ? clip(product.description, 500) : meta.description,
        image: images.length ? images : (meta.image ? [meta.image] : undefined),
        category: categoryName,
        itemCondition: product.condition ? conditionMap[Number(product.condition)] : undefined,
        offers: {
          '@type': 'Offer',
          price: Number.isFinite(amount) && amount > 0 ? amount : undefined,
          priceCurrency: product.currency || 'USD',
          availability: meta.indexable ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          url: meta.url,
          priceValidUntil: product.expDate || undefined,
          seller: product.seller?.name
            ? {
                '@type': 'Person',
                name: product.seller.name,
              }
            : undefined,
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems,
      },
    ],
  };
};

/** Semantic HTML Body for search engines and no-JS visitors */
export const buildListingHtmlBody = (
  product: MetaProduct,
  _meta: ListingMeta,
  siteUrl: string,
  mediaBase: string,
): string => {
  const images: string[] = (product.images ?? [])
    .map(img => absoluteMedia(img.path, mediaBase))
    .filter((img): img is string => Boolean(img));

  const amount = Number(product.price);
  const priceFormatted =
    Number.isFinite(amount) && amount > 0
      ? `${amount.toLocaleString('en-US')} ${CURRENCY_LABEL[product.currency ?? 'USD'] ?? product.currency}`
      : 'السعر عند التواصل';

  const categoryName = product.category?.ar_name || product.category?.name;
  const subCategoryName = product.sub_category?.ar_name || product.sub_category?.name;
  const catId = product.category?.id || product.categoryID;
  const subId = product.sub_category?.id || product.subCategoryID;
  const cityName = product.city || (product.location ?? '').split(/[,–-]/)[0]?.replace(/_+/g, ' ').trim();
  const location = (product.location ?? '').replace(/_+/g, ' ').trim();
  const phone = product.seller_phone ?? product.sellerPhone ?? product.contactInfo ?? product.seller?.phone;

  return `
    <div class="container page ssr-listing-page" style="max-width: 960px; margin: 0 auto; padding: 20px 16px; font-family: 'IBM Plex Sans Arabic', system-ui, sans-serif;">
      <!-- Breadcrumb navigation -->
      <nav aria-label="مسار التصفح" style="margin-bottom: 16px;">
        <ol style="display: flex; gap: 8px; list-style: none; padding: 0; margin: 0; font-size: 0.875rem; color: #666;">
          <li><a href="${siteUrl}/" style="color: #008e91; text-decoration: none;">الرئيسية</a></li>
          ${catId ? `<li><span aria-hidden="true">/</span></li><li><a href="${siteUrl}/category/${catId}" style="color: #008e91; text-decoration: none;">${escapeAttr(categoryName ?? '')}</a></li>` : ''}
          ${catId && subId ? `<li><span aria-hidden="true">/</span></li><li><a href="${siteUrl}/category/${catId}/${subId}" style="color: #008e91; text-decoration: none;">${escapeAttr(subCategoryName ?? '')}</a></li>` : ''}
          <li><span aria-hidden="true">/</span></li>
          <li aria-current="page" style="color: #333; font-weight: 600;">${escapeAttr(product.name ?? '')}</li>
        </ol>
      </nav>

      <article class="listing-detail">
        <header style="margin-bottom: 20px;">
          <h1 style="font-size: 1.75rem; color: #111; margin: 0 0 12px; line-height: 1.3;">${escapeAttr(product.name ?? '')}</h1>
          <div style="display: flex; gap: 16px; flex-wrap: wrap; align-items: center; font-size: 1rem;">
            <span style="font-size: 1.35rem; font-weight: 700; color: #008e91;">${escapeAttr(priceFormatted)}</span>
            ${cityName ? `<span style="color: #555;">📍 ${escapeAttr(cityName)}</span>` : ''}
            ${location && location !== cityName ? `<span style="color: #777;">(${escapeAttr(location)})</span>` : ''}
          </div>
        </header>

        ${images[0] ? `
          <div style="margin-bottom: 24px; text-align: center; background: #f8f8f8; border-radius: 12px; overflow: hidden;">
            <img src="${escapeAttr(images[0])}" alt="${escapeAttr(product.name ?? '')}" width="800" height="600" fetchpriority="high" style="max-width: 100%; height: auto; display: block; margin: 0 auto; object-fit: contain; max-height: 520px;" />
          </div>
        ` : ''}

        <section style="margin-bottom: 28px; background: #fff; border: 1px solid #eee; border-radius: 10px; padding: 20px;">
          <h2 style="font-size: 1.2rem; margin: 0 0 12px; border-bottom: 2px solid #008e91; padding-bottom: 6px; display: inline-block;">تفاصيل الإعلان</h2>
          <div style="font-size: 1.05rem; line-height: 1.8; color: #222; white-space: pre-wrap;">${escapeAttr(product.description ?? '')}</div>
        </section>

        ${product.seller?.name || phone ? `
          <section style="margin-bottom: 24px; background: #f0f7f7; border-radius: 10px; padding: 16px 20px;">
            <h3 style="font-size: 1.1rem; margin: 0 0 8px; color: #008e91;">معلومات البائع</h3>
            <p style="margin: 0; font-size: 1rem; color: #333;">
              ${product.seller?.name ? `<strong>${escapeAttr(product.seller.name)}</strong>` : ''}
              ${phone ? `<span style="margin-inline-start: 16px;">📞 هاتف: <a href="tel:${escapeAttr(phone)}" style="color: #008e91; font-weight: 600;">${escapeAttr(phone)}</a></span>` : ''}
            </p>
          </section>
        ` : ''}

        ${images.length > 1 ? `
          <section style="margin-bottom: 24px;">
            <h3 style="font-size: 1.1rem; margin: 0 0 12px;">صور إضافية (${images.length})</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px;">
              ${images.slice(1).map((img, i) => `
                <img src="${escapeAttr(img)}" alt="${escapeAttr(product.name ?? '')} - صورة ${i + 2}" width="200" height="150" loading="lazy" style="width: 100%; height: 120px; object-fit: cover; border-radius: 6px;" />
              `).join('')}
            </div>
          </section>
        ` : ''}
      </article>
    </div>
  `;
};

/** Replaces the shell's generic title/description/og:image and injects SSR body + JSON-LD. */
export const injectListingMeta = (html: string, meta: ListingMeta): string => {
  const title = escapeAttr(meta.title);
  const description = escapeAttr(meta.description);
  const tags = [
    `<link rel="canonical" href="${escapeAttr(meta.url)}" />`,
    `<meta property="og:type" content="product" />`,
    `<meta property="og:locale" content="ar_SY" />`,
    `<meta property="og:site_name" content="Souqna - سوقنا" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${escapeAttr(meta.url)}" />`,
    ...(meta.image ? [`<meta property="og:image" content="${escapeAttr(meta.image)}" />`] : []),
    `<meta name="twitter:card" content="${meta.image ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    ...(meta.image ? [`<meta name="twitter:image" content="${escapeAttr(meta.image)}" />`] : []),
    ...(meta.indexable ? [] : [`<meta name="robots" content="noindex, follow" />`]),
  ];

  let result = html
    .replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${title}</title>`)
    .replace(/<meta\s+name="description"[\s\S]*?\/>/i, () => `<meta name="description" content="${description}" />`)
    .replace(/<meta\s+property="og:image"[^>]*>\s*/gi, '')
    .replace(/<link\s+rel="canonical"[^>]*>\s*/gi, '')
    .replace('</head>', () => `    ${tags.join('\n    ')}\n  </head>`);

  // Inject structured data and semantic body if product is available
  if (meta.product) {
    const jsonLd = buildListingJsonLd(meta.product, meta, 'https://www.souqna.net', 'https://backend.souqna.net');
    const jsonLdScript = `\n    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>\n  </head>`;
    result = result.replace('</head>', () => jsonLdScript);

    const bodyContent = buildListingHtmlBody(meta.product, meta, 'https://www.souqna.net', 'https://backend.souqna.net');
    result = result.replace(/<div id="root"><\/div>/, () => `<div id="root">${bodyContent}</div>`);
  }

  return result;
};

/** 404 Shell with true 404 status and noindex for non-existent or deleted listings */
export const render404Shell = (shell: string, siteUrl: string): string => {
  const title = 'الإعلان غير موجود | سوقنا';
  const description = 'عذراً، هذا الإعلان غير متوفر حالياً أو تم حذفه من قبل صاحبه.';
  const body = `
  <div class="container page" style="text-align: center; padding: 48px 16px; font-family: 'IBM Plex Sans Arabic', system-ui, sans-serif;">
    <h1 style="font-size: 1.75rem; color: #222; margin-bottom: 12px;">الإعلان غير موجود</h1>
    <p style="color: #666; font-size: 1.05rem; margin: 0 0 24px;">عذراً، لم نتمكن من العثور على هذا الإعلان. قد يكون قد تم حذفه أو أن الرابط غير صحيح.</p>
    <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
      <a href="${siteUrl}/" style="display: inline-block; padding: 10px 20px; background: #008e91; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 500;">العودة للرئيسية</a>
      <a href="${siteUrl}/search" style="display: inline-block; padding: 10px 20px; background: #eee; color: #333; text-decoration: none; border-radius: 8px; font-weight: 500;">تصفح أحدث الإعلانات</a>
    </div>
  </div>`;

  return shell
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`)
    .replace(/<meta\s+name="description"[\s\S]*?\/>/i, `<meta name="description" content="${description}" />`)
    .replace('</head>', `    <meta name="robots" content="noindex, follow" />\n  </head>`)
    .replace(/<div id="root"><\/div>/, `<div id="root">${body}</div>`);
};

// ---- Vercel handler ----
interface Req {
  query: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
}
interface Res {
  status(code: number): Res;
  setHeader(name: string, value: string): Res;
  send(body: string): void;
}

const API = (process.env.VITE_API_URL || 'https://backend.souqna.net/api').replace(/\/+$/, '');
const SITE = (process.env.VITE_SITE_URL || 'https://www.souqna.net').replace(/\/+$/, '');
const MEDIA = API.replace(/\/api$/i, '');

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? '';

export default async function handler(req: Req, res: Res) {
  const host = first(req.headers['x-forwarded-host']) || first(req.headers.host) || new URL(SITE).host;
  let shell = '';
  try {
    const shellResponse = await fetch(`https://${host}/index.html`);
    if (shellResponse.ok) {
      shell = await shellResponse.text();
    }
  } catch {
    // fallback
  }

  if (!shell) {
    shell = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>سوقنا</title></head><body><div id="root"></div></body></html>`;
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  const slug = first(req.query.slug);
  const id = listingIdFromSlug(slug);

  // If no ID could be matched from slug, return true HTTP 404
  if (!id) {
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    res.status(404).send(render404Shell(shell, SITE));
    return;
  }

  try {
    const response = await fetch(`${API}/productDetails/${id}`, {
      headers: {Accept: 'application/json'},
      signal: AbortSignal.timeout(5000),
    });
    const payload = (await response.json()) as {success?: boolean; data?: Record<string, unknown>};

    // If listing not found in backend DB, return true HTTP 404 (fixing Soft 404)
    if (!payload?.success || !payload.data) {
      res.setHeader('Cache-Control', 'public, s-maxage=60');
      res.status(404).send(render404Shell(shell, SITE));
      return;
    }

    const meta = buildListingMeta(
      payload.data as unknown as MetaProduct,
      SITE,
      MEDIA,
      `/listing/${encodeURI(decodeURIComponent(slug))}`,
    );

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    res.status(200).send(injectListingMeta(shell, meta));
  } catch {
    // If backend timeout, return 404 or cached response
    res.setHeader('Cache-Control', 'public, s-maxage=30');
    res.status(404).send(render404Shell(shell, SITE));
  }
}
