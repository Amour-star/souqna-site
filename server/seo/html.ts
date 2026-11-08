import {BRAND, SITE, STORE_LINKS, SUPPORT_EMAIL, MEDIA} from './config.js';
import {arabicName, listingCity, listingPath, type Category, type Product} from './model.js';
import {absoluteMedia, clip, cleanLocation, escapeHtml, priceText, stripContactDetails} from './text.js';

/** Small HTML builders shared by every server-rendered page. */

export interface Crumb {
  name: string;
  path: string;
}

export const breadcrumbNav = (crumbs: Crumb[]): string =>
  `<nav aria-label="مسار التصفح"><ol class="breadcrumb">${crumbs
    .map((crumb, index) =>
      index === crumbs.length - 1
        ? `<li aria-current="page">${escapeHtml(crumb.name)}</li>`
        : `<li><a href="${escapeHtml(encodeURI(crumb.path))}">${escapeHtml(crumb.name)}</a></li>`,
    )
    .join('')}</ol></nav>`;

export const breadcrumbLd = (crumbs: Crumb[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: crumbs.map((crumb, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: crumb.name,
    item: `${SITE}${encodeURI(crumb.path)}`,
  })),
});

export const coverUrl = (product: Product): string | null => absoluteMedia(product.images?.[0]?.path, MEDIA);

/** Descriptive alt text: what it is, and where. */
export const imageAlt = (product: Product): string => {
  const city = listingCity(product);
  return clip([product.name, city && `في ${city}`].filter(Boolean).join(' '), 120);
};

/**
 * Listing cards: real anchors with descriptive Arabic text. Images reserve a
 * 4:3 box (no layout shift) and load lazily; `eager` is used for the first few
 * cards on a page where they may be above the fold.
 */
export const listingList = (products: Product[], options: {eager?: number} = {}): string => {
  if (!products.length) return '';
  return `<ul class="listing-list">${products
    .map((product, index) => {
      const image = coverUrl(product);
      const price = priceText(product.price, product.currency);
      const city = listingCity(product);
      const eager = index < (options.eager ?? 0);
      return `<li><article>
        <a href="${escapeHtml(encodeURI(listingPath(product)))}">${
          image
            ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(imageAlt(product))}" width="320" height="240" ${
                eager ? 'fetchpriority="high"' : 'loading="lazy"'
              } decoding="async" style="aspect-ratio:4/3;object-fit:cover;max-width:100%;height:auto" />`
            : ''
        }<h3>${escapeHtml(clip(product.name, 90))}</h3></a>
        ${price ? `<p><strong>${escapeHtml(price)}</strong></p>` : ''}
        ${city ? `<p>${escapeHtml(city)}</p>` : ''}
      </article></li>`;
    })
    .join('')}</ul>`;
};

export const itemListLd = (products: Product[]) => ({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  itemListElement: products.map((product, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    url: `${SITE}${encodeURI(listingPath(product))}`,
    name: clip(product.name, 110),
  })),
});

export const collectionLd = (input: {name: string; description: string; path: string; products: Product[]}) => ({
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: input.name,
  description: input.description,
  url: `${SITE}${encodeURI(input.path)}`,
  inLanguage: 'ar',
  isPartOf: {'@type': 'WebSite', name: BRAND, url: SITE},
  ...(input.products.length ? {mainEntity: itemListLd(input.products)} : {}),
});

/** Crawlable pagination: plain links to `?page=N`. */
export const paginationNav = (basePath: string, page: number, totalPages: number): string => {
  if (totalPages <= 1) return '';
  const href = (n: number) => escapeHtml(encodeURI(n === 1 ? basePath : `${basePath}?page=${n}`));
  const window = new Set([1, totalPages, page - 1, page, page + 1, page + 2].filter(n => n >= 1 && n <= totalPages));
  const numbers = [...window].sort((a, b) => a - b);
  return `<nav aria-label="التنقل بين الصفحات" class="pagination"><ul>${
    page > 1 ? `<li><a href="${href(page - 1)}">السابق</a></li>` : ''
  }${numbers
    .map(n => (n === page ? `<li aria-current="page">${n}</li>` : `<li><a href="${href(n)}">${n}</a></li>`))
    .join('')}${page < totalPages ? `<li><a href="${href(page + 1)}">التالي</a></li>` : ''}</ul></nav>`;
};

export const linkList = (items: {label: string; path: string}[]): string =>
  items.length
    ? `<ul>${items.map(item => `<li><a href="${escapeHtml(encodeURI(item.path))}">${escapeHtml(item.label)}</a></li>`).join('')}</ul>`
    : '';

export const categoryName = (category: Category) => arabicName(category);

/** Clean, contact-free snippet of a listing description. */
export const descriptionSnippet = (product: Product, length: number): string =>
  clip(stripContactDetails(cleanLocation(product.description || product.ar_description || '')), length);

export const trustBlock = (): string => `<aside aria-labelledby="trust-h">
  <h2 id="trust-h">عن سوقنا</h2>
  <p>سوقنا منصة سورية مجانية للبيع والشراء تعمل على الويب وعلى تطبيقات
  <a href="${STORE_LINKS.android}" rel="noopener">أندرويد</a> و<a href="${STORE_LINKS.ios}" rel="noopener">آيفون</a>.
  النشر مجاني، والتواصل بين البائع والمشتري يتم عبر محادثة داخل المنصة.
  اطّلع على <a href="/safety.html">نصائح الأمان</a> و<a href="/faq.html">الأسئلة الشائعة</a>،
  أو راسل الدعم على <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>
</aside>`;
