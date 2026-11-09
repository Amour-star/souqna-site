/**
 * Server-Side Rendering (SSR) handler for Category and Subcategory landing pages (Phase 4, Phase 5, Phase 6).
 *
 * Runs inside Vercel serverless function on `/category/:categoryId` and
 * `/category/:categoryId/:subCategoryId`.
 * Injects:
 *   - Semantic HTML inside `<div id="root">` (Breadcrumbs, H1, subcategory links, product listings)
 *   - Schema.org BreadcrumbList and ItemList structured data
 *   - Unique title, meta description, and canonical URL
 *   - True HTTP 404 on invalid/non-existent category
 */

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

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? '';

const escapeAttr = (value: string): string =>
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

const slugify = (value: string): string =>
  (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70);

const listingPath = (product: {id: string; name?: string; location?: string}): string => {
  const slug = slugify([product.name, product.location?.split(/[,–-]/)[0]].filter(Boolean).join(' '));
  return slug ? `/listing/${slug}-${product.id}` : `/listing/${product.id}`;
};

const CURRENCY_LABEL: Record<string, string> = {USD: 'دولار', SYP: 'ل.س', TRY: 'ليرة تركية'};

const priceFormatted = (price: unknown, currency: unknown): string => {
  const amount = Number(price);
  if (!Number.isFinite(amount) || amount <= 0) return '';
  const curr = String(currency || 'USD');
  return `${amount.toLocaleString('en-US')} ${CURRENCY_LABEL[curr] ?? curr}`;
};

export default async function handler(req: Req, res: Res) {
  const host = first(req.headers['x-forwarded-host']) || first(req.headers.host) || new URL(SITE).host;
  let shell = '';
  try {
    const shellResponse = await fetch(`https://${host}/index.html`);
    if (shellResponse.ok) shell = await shellResponse.text();
  } catch {
    // fallback
  }

  if (!shell) {
    shell = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>سوقنا</title></head><body><div id="root"></div></body></html>`;
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  const categoryId = first(req.query.categoryId);
  const subCategoryId = first(req.query.subCategoryId);

  if (!categoryId) {
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    res.status(404).send(shell);
    return;
  }

  try {
    const [categoriesRes, subCategoriesRes] = await Promise.all([
      fetch(`${API}/viewCategories`, {signal: AbortSignal.timeout(6000)}),
      fetch(`${API}/viewSubCategories`, {signal: AbortSignal.timeout(6000)}),
    ]);

    const categories = (await categoriesRes.json())?.data ?? [];
    const subCategories = (await subCategoriesRes.json())?.data ?? [];

    const category = categories.find((c: {id: string}) => c.id === categoryId);
    if (!category) {
      // 404 for non-existent category
      res.setHeader('Cache-Control', 'public, s-maxage=60');
      const notFoundHtml = shell
        .replace(/<title>[\s\S]*?<\/title>/i, `<title>القسم غير موجود | سوقنا</title>`)
        .replace('</head>', `    <meta name="robots" content="noindex, follow" />\n  </head>`)
        .replace(
          /<div id="root"><\/div>/,
          `<div id="root"><div class="container page" style="text-align: center; padding: 48px 16px;"><h1>القسم غير موجود</h1><p>عذراً، لم نتمكن من العثور على هذا القسم.</p><a href="/" class="btn btn--primary">العودة للرئيسية</a></div></div>`,
        );
      res.status(404).send(notFoundHtml);
      return;
    }

    const subCategory = subCategoryId
      ? subCategories.find((s: {id: string}) => s.id === subCategoryId)
      : null;

    const categoryName = category.ar_name || category.name || '';
    const subCategoryName = subCategory ? subCategory.ar_name || subCategory.name || '' : '';
    const heading = subCategoryName ? `${subCategoryName} — ${categoryName}` : categoryName;

    // Fetch first batch of products for this category
    let products: Array<{id: string; name?: string; price?: number; currency?: string; location?: string; images?: {path?: string}[]}> = [];
    let total = 0;
    try {
      const prodRes = await fetch(`${API}/showProductsWithoutAuth`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', pageNo: '1', recordsPerPage: '24'},
        body: JSON.stringify({
          categoryID: categoryId,
          ...(subCategoryId ? {subCategoryID: subCategoryId} : {}),
        }),
        signal: AbortSignal.timeout(6000),
      });
      const prodData = await prodRes.json();
      products = (prodData?.data ?? []).filter((p: {status: number | string}) => [0, 1].includes(Number(p.status)));
      total = Number(prodData?.totalRecords) || products.length;
    } catch {
      // Products fetch failure non-fatal for category shell
    }

    const canonicalUrl = `${SITE}/category/${categoryId}${subCategoryId ? `/${subCategoryId}` : ''}`;
    const seoTitle = `${heading} في سوريا | سوقنا`;
    const seoDescription = total > 0
      ? `تصفح ${total} إعلان ضمن ${heading} في سوريا على سوقنا. قارن الأسعار وتواصل مع البائعين مباشرة في دمشق وحلب وحمص وكافة المدن السورية.`
      : `تصفح أحدث إعلانات ${heading} في سوريا على سوقنا. بيع واشترِ بسهولة وتواصل مع البائعين مباشرة.`;

    const breadcrumbs = [
      {name: 'الرئيسية', url: `${SITE}/`},
      {name: categoryName, url: `${SITE}/category/${categoryId}`},
      ...(subCategory ? [{name: subCategoryName, url: canonicalUrl}] : []),
    ];

    const jsonLd = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BreadcrumbList',
          itemListElement: breadcrumbs.map((crumb, idx) => ({
            '@type': 'ListItem',
            position: idx + 1,
            name: crumb.name,
            item: crumb.url,
          })),
        },
        ...(products.length
          ? [
              {
                '@type': 'ItemList',
                name: heading,
                numberOfItems: products.length,
                itemListElement: products.slice(0, 24).map((p, idx) => ({
                  '@type': 'ListItem',
                  position: idx + 1,
                  name: p.name ?? '',
                  url: `${SITE}${listingPath(p)}`,
                })),
              },
            ]
          : []),
      ],
    };

    const categorySiblings = subCategories.filter(
      (s: {categoryID: string; status: number | string}) =>
        s.categoryID === categoryId && Number(s.status) === 1,
    );

    const bodyContent = `
      <div class="container page ssr-category-page" style="max-width: 1040px; margin: 0 auto; padding: 20px 16px; font-family: 'IBM Plex Sans Arabic', system-ui, sans-serif;">
        <!-- Breadcrumbs -->
        <nav aria-label="مسار التصفح" style="margin-bottom: 16px;">
          <ol style="display: flex; gap: 8px; list-style: none; padding: 0; margin: 0; font-size: 0.875rem; color: #666;">
            <li><a href="${SITE}/" style="color: #008e91; text-decoration: none;">الرئيسية</a></li>
            <li><span aria-hidden="true">/</span></li>
            ${subCategory ? `<li><a href="${SITE}/category/${categoryId}" style="color: #008e91; text-decoration: none;">${escapeAttr(categoryName)}</a></li><li><span aria-hidden="true">/</span></li>` : ''}
            <li aria-current="page" style="color: #333; font-weight: 600;">${escapeAttr(subCategory ? subCategoryName : categoryName)}</li>
          </ol>
        </nav>

        <header style="margin-bottom: 24px;">
          <h1 style="font-size: 1.75rem; color: #111; margin: 0 0 8px;">${escapeAttr(heading)} في سوريا</h1>
          <p style="color: #666; font-size: 1rem; margin: 0; line-height: 1.6;">${escapeAttr(seoDescription)}</p>
        </header>

        <!-- Crawlable Subcategory Links -->
        ${categorySiblings.length ? `
          <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 24px;">
            <a href="${SITE}/category/${categoryId}" style="text-decoration: none; padding: 6px 14px; border-radius: 20px; font-size: 0.875rem; background: ${!subCategoryId ? '#008e91' : '#f0f0f0'}; color: ${!subCategoryId ? '#fff' : '#333'}; font-weight: 500;">الكل</a>
            ${categorySiblings.map((s: {id: string; ar_name?: string; name?: string}) => `
              <a href="${SITE}/category/${categoryId}/${s.id}" style="text-decoration: none; padding: 6px 14px; border-radius: 20px; font-size: 0.875rem; background: ${subCategoryId === s.id ? '#008e91' : '#f0f0f0'}; color: ${subCategoryId === s.id ? '#fff' : '#333'}; font-weight: 500;">${escapeAttr(s.ar_name || s.name || '')}</a>
            `).join('')}
          </div>
        ` : ''}

        <!-- Listings Grid -->
        <section>
          <h2 style="font-size: 1.25rem; margin: 0 0 16px; color: #333;">أحدث الإعلانات في ${escapeAttr(heading)} (${total})</h2>
          ${products.length ? `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px;">
              ${products.map(p => {
                const price = priceFormatted(p.price, p.currency);
                const loc = (p.location ?? '').replace(/_+/g, ' ').trim();
                const path = listingPath(p);
                return `
                  <article style="background: #fff; border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden; display: flex; flex-direction: column;">
                    <a href="${SITE}${escapeAttr(path)}" style="text-decoration: none; color: inherit; padding: 12px; display: flex; flex-direction: column; flex: 1;">
                      <h3 style="font-size: 1rem; margin: 0 0 8px; color: #111; line-height: 1.4;">${escapeAttr(p.name ?? '')}</h3>
                      ${price ? `<span style="font-size: 1.1rem; font-weight: 700; color: #008e91; margin-bottom: 4px;">${escapeAttr(price)}</span>` : ''}
                      ${loc ? `<span style="font-size: 0.85rem; color: #777;">📍 ${escapeAttr(loc)}</span>` : ''}
                    </a>
                  </article>
                `;
              }).join('')}
            </div>
          ` : `
            <p style="color: #666; font-size: 1rem;">لا توجد إعلانات منشورة حالياً في هذا القسم. كن أول من ينشر إعلاناً!</p>
          `}
        </section>
      </div>
    `;

    const tags = [
      `<link rel="canonical" href="${escapeAttr(canonicalUrl)}" />`,
      `<meta property="og:type" content="website" />`,
      `<meta property="og:locale" content="ar_SY" />`,
      `<meta property="og:site_name" content="Souqna - سوقنا" />`,
      `<meta property="og:title" content="${escapeAttr(seoTitle)}" />`,
      `<meta property="og:description" content="${escapeAttr(seoDescription)}" />`,
      `<meta property="og:url" content="${escapeAttr(canonicalUrl)}" />`,
      `<meta property="og:image" content="${SITE}/logo.png" />`,
      `<meta name="twitter:card" content="summary" />`,
      `<meta name="twitter:title" content="${escapeAttr(seoTitle)}" />`,
      `<meta name="twitter:description" content="${escapeAttr(seoDescription)}" />`,
      `<meta name="twitter:image" content="${SITE}/logo.png" />`,
      `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`,
    ];

    const finalHtml = shell
      .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeAttr(seoTitle)}</title>`)
      .replace(/<meta\s+name="description"[\s\S]*?\/>/i, `<meta name="description" content="${escapeAttr(seoDescription)}" />`)
      .replace(/<meta\s+property="og:image"[^>]*>\s*/gi, '')
      .replace(/<link\s+rel="canonical"[^>]*>\s*/gi, '')
      .replace('</head>', `    ${tags.join('\n    ')}\n  </head>`)
      .replace(/<div id="root"><\/div>/, `<div id="root">${bodyContent}</div>`);

    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
    res.status(200).send(finalHtml);
  } catch {
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    res.status(200).send(shell);
  }
}
