import {describe, expect, it} from 'vitest';
import {
  escapeXml,
  slugify,
  listingPath,
  generatePagesSitemap,
  generateCitiesSitemap,
} from '../../api/sitemap';
import {render404Shell} from '../../api/listing';
import {SYRIAN_CITIES, findCityBySlugOrName} from '../data/cities';

describe('Sitemap System (Phase 2)', () => {
  it('correctly escapes XML special characters', () => {
    expect(escapeXml('<foo & "bar" \'>')).toBe('&lt;foo &amp; &quot;bar&quot; &apos;&gt;');
  });

  it('slugifies Arabic and Latin text properly', () => {
    expect(slugify('شقة للبيع حلب')).toBe('شقة-للبيع-حلب');
    expect(slugify('BMW 320d 2020')).toBe('bmw-320d-2020');
  });

  it('generates correct listing canonical paths', () => {
    const p1 = {id: '12345678-1234-1234-1234-123456789abc', name: 'كيا سورينتو', location: 'دمشق'};
    expect(listingPath(p1)).toBe('/listing/كيا-سورينتو-دمشق-12345678-1234-1234-1234-123456789abc');

    const p2 = {id: '12345678-1234-1234-1234-123456789abc'};
    expect(listingPath(p2)).toBe('/listing/12345678-1234-1234-1234-123456789abc');
  });

  it('generates pages sitemap excluding private and internal search routes', () => {
    const xml = generatePagesSitemap();
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain('<loc>https://www.souqna.net/</loc>');
    expect(xml).toContain('<loc>https://www.souqna.net/safety.html</loc>');
    expect(xml).toContain('<loc>https://www.souqna.net/how-it-works.html</loc>');
    expect(xml).toContain('<loc>https://www.souqna.net/faq.html</loc>');

    // Critical exclusions
    expect(xml).not.toContain('/search');
    expect(xml).not.toContain('/login');
    expect(xml).not.toContain('/profile');
    expect(xml).not.toContain('/sell');
    expect(xml).not.toContain('/messages');
  });

  it('generates Syrian cities sitemap with all key hubs', () => {
    const xml = generateCitiesSitemap();
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<loc>https://www.souqna.net/city/damascus</loc>');
    expect(xml).toContain('<loc>https://www.souqna.net/city/aleppo</loc>');
    expect(xml).toContain('<loc>https://www.souqna.net/city/homs</loc>');
    expect(xml).toContain('<loc>https://www.souqna.net/city/hama</loc>');
    expect(xml).toContain('<loc>https://www.souqna.net/city/latakia</loc>');
  });

  it('404 shell prevents soft 404s and carries noindex', () => {
    const shell = '<html><head><title>سوقنا</title></head><body><div id="root"></div></body></html>';
    const html404 = render404Shell(shell, 'https://www.souqna.net');
    expect(html404).toContain('<meta name="robots" content="noindex, follow" />');
    expect(html404).toContain('الإعلان غير موجود');
    expect(html404).toContain('العودة للرئيسية');
  });

  it('Syrian cities dataset covers 14 governorates and key commercial hubs', () => {
    const governorates = SYRIAN_CITIES.filter(c => c.isGovernorate);
    expect(governorates.length).toBe(14);

    expect(findCityBySlugOrName('damascus')?.nameAr).toBe('دمشق');
    expect(findCityBySlugOrName('دمشق')?.slug).toBe('damascus');
    expect(findCityBySlugOrName('aleppo')?.nameAr).toBe('حلب');
    expect(findCityBySlugOrName('حلب')?.slug).toBe('aleppo');
    expect(findCityBySlugOrName('homs')?.nameAr).toBe('حمص');
    expect(findCityBySlugOrName('latakia')?.nameAr).toBe('اللاذقية');
    expect(findCityBySlugOrName('non-existent')).toBeNull();
  });
});
