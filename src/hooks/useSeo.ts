import {useEffect} from 'react';
import {SITE_URL} from '@/lib/config';

interface SeoInput {
  title: string;
  description?: string;
  /** Path relative to the site root, e.g. `/listing/abc`. */
  canonicalPath?: string;
  image?: string | null;
  type?: 'website' | 'article' | 'product';
  /** Set for pages that must never be indexed (account, messages, …). */
  noIndex?: boolean;
  /** JSON-LD structured data injected while the page is mounted. */
  structuredData?: Record<string, unknown> | null;
}

const setMetaByName = (name: string, content: string) => {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute('name', name);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
};

const setMetaByProperty = (property: string, content: string) => {
  let element = document.head.querySelector<HTMLMetaElement>(
    `meta[property="${property}"]`,
  );
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute('property', property);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
};

const setCanonical = (href: string) => {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
};

const STRUCTURED_DATA_ID = 'souqna-structured-data';

/**
 * Per-route document head management: title, description, canonical, Open
 * Graph and JSON-LD. The app is client-rendered, so this runs on navigation;
 * crawlers that execute JavaScript (Google, Bing) pick the values up.
 */
export const useSeo = ({
  title,
  description,
  canonicalPath,
  image,
  type = 'website',
  noIndex,
  structuredData,
}: SeoInput) => {
  useEffect(() => {
    const fullTitle = title.includes('Souqna') ? title : `${title} | Souqna`;
    document.title = fullTitle;

    if (description) {
      setMetaByName('description', description);
      setMetaByProperty('og:description', description);
    }

    setMetaByProperty('og:title', fullTitle);
    setMetaByProperty('og:type', type === 'product' ? 'product' : type);
    setMetaByProperty('og:site_name', 'Souqna');
    setMetaByName('twitter:card', image ? 'summary_large_image' : 'summary');

    const url = `${SITE_URL}${canonicalPath ?? window.location.pathname}`;
    setCanonical(url);
    setMetaByProperty('og:url', url);

    if (image) setMetaByProperty('og:image', image);

    setMetaByName('robots', noIndex ? 'noindex, nofollow' : 'index, follow');

    return () => {
      // Reset the indexing directive so a private page never leaves a stale
      // noindex behind for the next route.
      setMetaByName('robots', 'index, follow');
    };
  }, [title, description, canonicalPath, image, type, noIndex]);

  useEffect(() => {
    const existing = document.getElementById(STRUCTURED_DATA_ID);
    existing?.remove();
    if (!structuredData) return undefined;

    const script = document.createElement('script');
    script.id = STRUCTURED_DATA_ID;
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(structuredData);
    document.head.appendChild(script);

    return () => script.remove();
  }, [structuredData]);
};
