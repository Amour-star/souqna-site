import {describe, expect, it} from 'vitest';
import {buildListingMeta, injectListingMeta, listingIdFromSlug} from '@/lib/listingMeta';

const ID = '3f2b6c1e-9d44-4e0b-a5c7-0e5a8d1b2c3f';
const shell = `<html><head>
<title>سوقنا</title>
<meta
  name="description"
  content="generic" />
<meta property="og:image" content="/logo.png" />
</head><body></body></html>`;

describe('listing share meta', () => {
  it('extracts the uuid from slug-uuid and bare uuid', () => {
    expect(listingIdFromSlug(`ورشة-حلب-${ID}`)).toBe(ID);
    expect(listingIdFromSlug(ID)).toBe(ID);
    expect(listingIdFromSlug('nope')).toBeNull();
  });

  it('emits canonical, og:*, twitter:card and an absolute first image', () => {
    const meta = buildListingMeta(
      {id: ID, name: 'ورشة "كهرباء"', price: 100, currency: 'USD', location: 'حلب', description: 'وصف', images: [{path: 'productImages/a.jpg'}]},
      'https://www.souqna.net', 'https://backend.souqna.net', `/listing/x-${ID}`,
    );
    const html = injectListingMeta(shell, meta);
    expect(html).toContain(`<link rel="canonical" href="https://www.souqna.net/listing/x-${ID}" />`);
    expect(html).toContain('og:image" content="https://backend.souqna.net/productImages/a.jpg"');
    expect(html).toContain('twitter:card" content="summary_large_image"');
    expect(html).toContain('og:url');
    expect(html).not.toContain('/logo.png');
    expect(html).not.toContain('content="generic"');
    expect(html).toContain('&quot;كهرباء&quot;'); // escaped, can't break out of the attribute
  });

  it('marks unpublished listings noindex', () => {
    const meta = buildListingMeta({id: ID, name: 'x', status: 3}, 'https://s', 'https://m', '/listing/x');
    expect(injectListingMeta(shell, meta)).toContain('noindex');
  });
});
