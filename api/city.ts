/**
 * Server-Side Rendering (SSR) handler for Syrian City Landing Pages (Phase 4, Phase 5, Phase 6).
 *
 * Runs inside Vercel serverless function on `/city/:citySlug` and
 * `/city/:citySlug/:categoryId`.
 * Injects:
 *   - Semantic HTML inside `<div id="root">` (Breadcrumbs, H1, category filter links, local listings, other cities)
 *   - Schema.org BreadcrumbList and CollectionPage structured data
 *   - Localized Syrian city title, description, and canonical URL
 *   - True HTTP 404 on invalid city slug
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

const SYRIAN_CITIES_REGISTRY: Record<string, {nameAr: string; nameEn: string; desc: string}> = {
  damascus: {
    nameAr: 'دمشق',
    nameEn: 'Damascus',
    desc: 'تصفح آلاف الإعلانات للبيع والشراء في دمشق على سوقنا. سيارات، عقارات، موبايلات، أثاث وإلكترونيات بأفضل الأسعار في دمشق وجميع أحيائها.',
  },
  aleppo: {
    nameAr: 'حلب',
    nameEn: 'Aleppo',
    desc: 'تصفح أكبر سوق إلكتروني للبيع والشراء في حلب. سيارات مستعملة وجديدة، شقق وعقارات للبيع والإيجار، أجهزة كهربائية وموبايلات في حلب وريفها.',
  },
  homs: {
    nameAr: 'حمص',
    nameEn: 'Homs',
    desc: 'سوق حمص المفتوح للبيع والشراء على سوقنا. شقق للبيع والإيجار، سيارات، هواتف ذكية ومستلزمات منزلية بأسعار منافسة في حمص.',
  },
  hama: {
    nameAr: 'حماة',
    nameEn: 'Hama',
    desc: 'إعلانات مبوبة مجانية في حماة. تصفح آلاف العروض للسيارات، العقارات، الأجهزة الإلكترونية والوظائف في حماة ومحيطها.',
  },
  latakia: {
    nameAr: 'اللاذقية',
    nameEn: 'Latakia',
    desc: 'سوق اللاذقية للبيع والشراء. شاليهات وعقارات بحرية، سيارات، موبايلات وخدمات متنوعة في محافظة اللاذقية والساحل السوري.',
  },
  tartus: {
    nameAr: 'طرطوس',
    nameEn: 'Tartus',
    desc: 'عقارات وسيارات وأجهزة إلكترونية للبيع والشراء في طرطوس. تواصل مع البائعين وتصفح أحدث الإعلانات اليومية على سوقنا طرطوس.',
  },
  'rif-dimashq': {
    nameAr: 'ريف دمشق',
    nameEn: 'Rif Dimashq',
    desc: 'إعلانات البيع والشراء في ريف دمشق. مزارع، فلل، أراضي، سيارات ومعدات صناعية وزراعية في جميع مناطق ريف دمشق.',
  },
  qudsaya: {
    nameAr: 'قدسيا',
    nameEn: 'Qudsaya',
    desc: 'شقق للبيع والإيجار وسيارات وإلكترونيات في قدسيا وضاحية قدسيا. تصفح أحدث عروض السوق المحلي مباشرة على سوقنا.',
  },
  douma: {
    nameAr: 'دوما',
    nameEn: 'Douma',
    desc: 'سوق دوما والغوطة للبيع والشراء. مزارع، عقارات، قطع غيار وسيارات متوفرة للتواصل المباشر مع أصحابها في دوما.',
  },
  daraa: {
    nameAr: 'درعا',
    nameEn: 'Daraa',
    desc: 'إعلانات مبوبة للبيع والشراء في درعا وحوران. سيارات، عقارات، مواشي ومعدات زراعية بأسعار مناسبة في محافظة درعا.',
  },
  'as-suwayda': {
    nameAr: 'السويداء',
    nameEn: 'As-Suwayda',
    desc: 'سوق السويداء الإلكتروني للبيع والشراء على سوقنا. سيارات، عقارات، هواتف وأجهزة منزلية في محافظة السويداء وجبل العرب.',
  },
  idlib: {
    nameAr: 'إدلب',
    nameEn: 'Idlib',
    desc: 'إعلانات البيع والشراء في إدلب وريفها. سيارات، دراجات نارية، أجهزة، عقارات ومواد غذائية وتجارية على منصة سوقنا.',
  },
  jableh: {
    nameAr: 'جبلة',
    nameEn: 'Jableh',
    desc: 'عقارات وسيارات وموبايلات للبيع والإيجار في مدينة جبلة وريفها. تصفح عروض السوق المفتوح على سوقنا.',
  },
  baniyas: {
    nameAr: 'بانياس',
    nameEn: 'Baniyas',
    desc: 'إعلانات بانياس للبيع والشراء. شقق، سيارات، إلكترونيات ومستلزمات في بانياس ومحيطها على سوقنا.',
  },
  'deir-ez-zor': {
    nameAr: 'دير الزور',
    nameEn: 'Deir ez-Zor',
    desc: 'سوق دير الزور والمنطقة الشرقية للبيع والشراء. سيارات، عقارات ومختلف البضائع والخدمات على سوقنا.',
  },
  'ar-raqqa': {
    nameAr: 'الرقة',
    nameEn: 'Ar-Raqqa',
    desc: 'إعلانات الرقة للبيع والشراء. تصفح العروض وتواصل مع المعلنين مباشرة في محافظة الرقة.',
  },
  'al-hasakah': {
    nameAr: 'الحسكة',
    nameEn: 'Al-Hasakah',
    desc: 'سوق الحسكة والقامشلي للبيع والشراء على سوقنا. سيارات، هواتف، عقارات وأدوات تجارية في محافظة الحسكة.',
  },
  quneitra: {
    nameAr: 'القنيطرة',
    nameEn: 'Al-Quneitra',
    desc: 'إعلانات القنيطرة والجولان للبيع والشراء على سوقنا. سيارات وعقارات وسلع متنوعة.',
  },
};

const resolveCity = (slug: string) => {
  if (!slug) return null;
  const decoded = decodeURIComponent(slug).toLowerCase().trim();
  if (SYRIAN_CITIES_REGISTRY[decoded]) return {slug: decoded, ...SYRIAN_CITIES_REGISTRY[decoded]};
  for (const [key, val] of Object.entries(SYRIAN_CITIES_REGISTRY)) {
    if (val.nameAr === decoded || val.nameAr.replace(/\s+/g, '-') === decoded) {
      return {slug: key, ...val};
    }
  }
  return null;
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

  const citySlug = first(req.query.citySlug);
  const categoryId = first(req.query.categoryId);
  const city = resolveCity(citySlug);

  if (!city) {
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    const notFoundHtml = shell
      .replace(/<title>[\s\S]*?<\/title>/i, `<title>المدينة غير موجودة | سوقنا</title>`)
      .replace('</head>', `    <meta name="robots" content="noindex, follow" />\n  </head>`)
      .replace(
        /<div id="root"><\/div>/,
        `<div id="root"><div class="container page" style="text-align: center; padding: 48px 16px;"><h1>المدينة غير موجودة</h1><p>عذراً، لم نتمكن من العثور على هذه المدينة.</p><a href="/" class="btn btn--primary">العودة للرئيسية</a></div></div>`,
      );
    res.status(404).send(notFoundHtml);
    return;
  }

  try {
    let categoryName = '';
    let categories: Array<{id: string; name: string; ar_name?: string}> = [];
    try {
      const catRes = await fetch(`${API}/viewCategories`, {signal: AbortSignal.timeout(5000)});
      categories = (await catRes.json())?.data ?? [];
      if (categoryId) {
        const foundCat = categories.find(c => c.id === categoryId);
        if (foundCat) categoryName = foundCat.ar_name || foundCat.name;
      }
    } catch {
      // category fetch failure non-fatal
    }

    const heading = categoryName
      ? `${categoryName} في ${city.nameAr}`
      : `إعلانات للبيع والشراء في ${city.nameAr}`;

    const seoTitle = `${heading} | سوقنا`;
    const seoDescription = categoryName
      ? `تصفح أحدث إعلانات ${categoryName} للبيع والشراء في ${city.nameAr} على سوقنا. قارن الأسعار وتواصل مع البائعين مباشرة.`
      : city.desc;

    const canonicalUrl = `${SITE}/city/${city.slug}${categoryId ? `/${categoryId}` : ''}`;

    // Fetch active products in this city
    let products: Array<{id: string; name?: string; price?: number; currency?: string; location?: string}> = [];
    let total = 0;
    try {
      const prodRes = await fetch(`${API}/showProductsWithoutAuth`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', pageNo: '1', recordsPerPage: '24'},
        body: JSON.stringify({
          location: city.nameAr,
          ...(categoryId ? {categoryID: categoryId} : {}),
        }),
        signal: AbortSignal.timeout(6000),
      });
      const prodData = await prodRes.json();
      products = (prodData?.data ?? []).filter((p: {status: number | string}) => [0, 1].includes(Number(p.status)));
      total = Number(prodData?.totalRecords) || products.length;
    } catch {
      // Products fetch failure non-fatal
    }

    const breadcrumbs = [
      {name: 'الرئيسية', url: `${SITE}/`},
      {name: `إعلانات ${city.nameAr}`, url: `${SITE}/city/${city.slug}`},
      ...(categoryName ? [{name: categoryName, url: canonicalUrl}] : []),
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
        {
          '@type': 'CollectionPage',
          name: heading,
          description: seoDescription,
          url: canonicalUrl,
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: products.length,
            itemListElement: products.slice(0, 24).map((p, idx) => ({
              '@type': 'ListItem',
              position: idx + 1,
              name: p.name ?? '',
              url: `${SITE}${listingPath(p)}`,
            })),
          },
        },
      ],
    };

    const bodyContent = `
      <div class="container page ssr-city-page" style="max-width: 1040px; margin: 0 auto; padding: 20px 16px; font-family: 'IBM Plex Sans Arabic', system-ui, sans-serif;">
        <!-- Breadcrumbs -->
        <nav aria-label="مسار التصفح" style="margin-bottom: 16px;">
          <ol style="display: flex; gap: 8px; list-style: none; padding: 0; margin: 0; font-size: 0.875rem; color: #666;">
            <li><a href="${SITE}/" style="color: #008e91; text-decoration: none;">الرئيسية</a></li>
            <li><span aria-hidden="true">/</span></li>
            ${categoryName ? `<li><a href="${SITE}/city/${city.slug}" style="color: #008e91; text-decoration: none;">إعلانات ${escapeAttr(city.nameAr)}</a></li><li><span aria-hidden="true">/</span></li>` : ''}
            <li aria-current="page" style="color: #333; font-weight: 600;">${escapeAttr(categoryName ? categoryName : `إعلانات ${city.nameAr}`)}</li>
          </ol>
        </nav>

        <header style="margin-bottom: 24px;">
          <h1 style="font-size: 1.75rem; color: #111; margin: 0 0 8px;">${escapeAttr(heading)}</h1>
          <p style="color: #666; font-size: 1rem; margin: 0; line-height: 1.6;">${escapeAttr(seoDescription)}</p>
        </header>

        <!-- Category Filter Links -->
        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 24px;">
          <a href="${SITE}/city/${city.slug}" style="text-decoration: none; padding: 6px 14px; border-radius: 20px; font-size: 0.875rem; background: ${!categoryId ? '#008e91' : '#f0f0f0'}; color: ${!categoryId ? '#fff' : '#333'}; font-weight: 500;">جميع الأقسام</a>
          ${categories.map(c => `
            <a href="${SITE}/city/${city.slug}/${c.id}" style="text-decoration: none; padding: 6px 14px; border-radius: 20px; font-size: 0.875rem; background: ${categoryId === c.id ? '#008e91' : '#f0f0f0'}; color: ${categoryId === c.id ? '#fff' : '#333'}; font-weight: 500;">${escapeAttr(c.ar_name || c.name)}</a>
          `).join('')}
        </div>

        <!-- Local Product Listings -->
        <section style="margin-bottom: 36px;">
          <h2 style="font-size: 1.25rem; margin: 0 0 16px; color: #333;">أحدث العروض في ${escapeAttr(city.nameAr)} (${total})</h2>
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
            <p style="color: #666; font-size: 1rem;">لا توجد إعلانات منشورة حالياً في هذه المدينة. كن أول من ينشر إعلاناً!</p>
          `}
        </section>

        <!-- Other Syrian Cities Links -->
        <section style="border-top: 1px solid #eee; padding-top: 20px;">
          <h3 style="font-size: 1.1rem; margin: 0 0 12px; color: #444;">مدن ومحافظات سورية أخرى</h3>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            ${Object.entries(SYRIAN_CITIES_REGISTRY).filter(([k]) => k !== city.slug).slice(0, 10).map(([k, v]) => `
              <a href="${SITE}/city/${k}" style="font-size: 0.875rem; color: #008e91; text-decoration: none; background: #f5f5f5; padding: 4px 10px; border-radius: 6px;">إعلانات ${escapeAttr(v.nameAr)}</a>
            `).join('')}
          </div>
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
