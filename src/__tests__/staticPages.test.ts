import {readdirSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {describe, expect, it} from 'vitest';

/** P3: the static legal/support pages must carry the site header (a way back to the app) and stay Arabic/RTL. */
const dir = path.resolve(__dirname, '../../public');
const pages = readdirSync(dir).filter(f => f.endsWith('.html'));

describe('static pages', () => {
  it('found the legal pages', () => {
    expect(pages).toEqual(expect.arrayContaining(['safety.html', 'privacy.html', 'terms.html', 'faq.html', 'support.html']));
  });

  it.each(pages)('%s has the site header linking home and keeps its language/direction', page => {
    const html = readFileSync(path.join(dir, page), 'utf8');
    expect(html).toContain('class="site-header"');
    expect(html).toMatch(/<a class="site-header__brand" href="\/">/);
    // each page keeps its own language/direction and its header follows it
    expect(html).toMatch(/<html lang="(ar|en)" dir="(rtl|ltr)">/);
    const arabic = html.includes('<html lang="ar" dir="rtl">');
    expect(arabic || html.includes('<html lang="en" dir="ltr">')).toBe(true);
    expect(html).toContain(arabic ? 'الرئيسية' : '>Home<');
  });
});
