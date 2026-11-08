import {BRAND, SITE} from './config.js';
import {escapeHtml, jsonLd} from './text.js';

export interface PageImage {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface PageDoc {
  title: string;
  description: string;
  /** Site-relative canonical path (including `?page=N` for deep pages). */
  canonicalPath: string;
  indexable: boolean;
  image?: PageImage | null;
  ogType?: 'website' | 'article' | 'product';
  ld?: unknown[];
  /** Inner HTML of `<div id="root">`. */
  body: string;
  /** false → no SPA bundle (standalone content pages such as guides). */
  spa?: boolean;
  /** Extra tags for <head> (e.g. an LCP image preload). */
  headExtra?: string[];
}

const DEFAULT_IMAGE: PageImage = {
  url: `${SITE}/logo.png`,
  alt: `شعار ${BRAND}`,
  width: 512,
  height: 512,
};

const replaceFirst = (html: string, pattern: RegExp, replacement: string) =>
  pattern.test(html) ? html.replace(pattern, () => replacement) : html;

/**
 * Turns the built SPA shell into a complete, crawlable document: real
 * title/description/canonical/robots/Open Graph/Twitter/JSON-LD in the first
 * response, and the page's content inside #root. The SPA still boots on top of
 * it for users (React's createRoot replaces #root).
 */
export const renderDocument = (shell: string, doc: PageDoc): string => {
  const canonical = `${SITE}${encodeURI(doc.canonicalPath)}`;
  const image = doc.image ?? DEFAULT_IMAGE;
  const title = escapeHtml(doc.title);
  const description = escapeHtml(doc.description);

  let html = shell;
  html = replaceFirst(html, /<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`);
  html = replaceFirst(html, /<meta\s+name="description"[\s\S]*?\/>/i, `<meta name="description" content="${description}" />`);
  // Neutral shell tags would otherwise sit next to (and sometimes beat) ours.
  html = html
    .replace(/\s*<meta\s+property="og:(?:image|site_name)"[^>]*>/gi, '')
    .replace(/\s*<link\s+rel="canonical"[^>]*>/gi, '')
    .replace(/\s*<meta\s+name="robots"[^>]*>/gi, '');
  html = replaceFirst(
    html,
    /<html\s+lang="ar"\s+dir="rtl"/i,
    `<html lang="ar" dir="rtl" data-ssr-path="${escapeHtml(doc.canonicalPath.split('?')[0])}"`,
  );

  const tags = [
    `<meta name="robots" content="${doc.indexable ? 'index, follow, max-image-preview:large' : 'noindex, follow'}" />`,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    `<meta property="og:site_name" content="${BRAND}" />`,
    `<meta property="og:locale" content="ar_SY" />`,
    `<meta property="og:type" content="${doc.ogType ?? 'website'}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    `<meta property="og:image" content="${escapeHtml(image.url)}" />`,
    ...(image.width && image.height
      ? [`<meta property="og:image:width" content="${image.width}" />`, `<meta property="og:image:height" content="${image.height}" />`]
      : []),
    ...(image.alt ? [`<meta property="og:image:alt" content="${escapeHtml(image.alt)}" />`] : []),
    `<meta name="twitter:card" content="${image === DEFAULT_IMAGE ? 'summary' : 'summary_large_image'}" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${escapeHtml(image.url)}" />`,
    ...(image.alt ? [`<meta name="twitter:image:alt" content="${escapeHtml(image.alt)}" />`] : []),
    ...(doc.headExtra ?? []),
    ...(doc.ld ?? []).map(data => `<script type="application/ld+json" data-ssr>${jsonLd(data)}</script>`),
  ].join('\n    ');
  html = html.replace('</head>', () => `    ${tags}\n  </head>`);

  if (doc.spa === false) {
    html = html
      .replace(/\s*<script\s+type="module"[^>]*><\/script>/gi, '')
      .replace(/\s*<link\s+rel="modulepreload"[^>]*>/gi, '');
  }

  return replaceFirst(html, /<div id="root">\s*<\/div>/, `<div id="root">${doc.body}</div>`);
};

/** The untouched SPA shell with an explicit robots directive (private / 404 routes). */
export const renderShellWithRobots = (shell: string, robots: string, title?: string): string => {
  let html = shell.replace(/\s*<meta\s+name="robots"[^>]*>/gi, '');
  if (title) html = replaceFirst(html, /<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  return html.replace('</head>', () => `    <meta name="robots" content="${robots}" />\n  </head>`);
};
