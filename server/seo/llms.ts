import {BRAND, BRAND_EN, SITE, SUPPORT_EMAIL} from './config.js';
import {CITIES, cityPath} from './cities.js';
import {GUIDES} from './guides.js';
import {categoryPhrase} from './landing.js';
import {categoryPath, type Category} from './model.js';

/**
 * /llms.txt — a short, plain-Markdown map of the site for AI assistants and
 * answer engines. It is supplementary documentation, not a ranking signal.
 */
export const llmsTxt = (categories: Category[]): string => {
  const popular = CITIES.filter(city => city.isPopular);
  const line = (label: string, path: string, note?: string) => `- [${label}](${SITE}${encodeURI(path)})${note ? `: ${note}` : ''}`;
  return `# ${BRAND_EN} – ${BRAND}

> ${BRAND} (${BRAND_EN}) is a free Arabic-language online marketplace for Syria. Individuals and businesses post classified ads — real estate, cars, electronics and phones, furniture, pets, services and spare parts — and buyers browse them by category and city and contact sellers through in-app chat. Available on the web (${SITE}), Android and iOS. Posting ads is free.

سوقنا منصة سورية مجانية للبيع والشراء. تعرض إعلانات العقارات والسيارات والموبايلات والإلكترونيات والأثاث والحيوانات والخدمات وقطع الغيار في دمشق وحلب وحمص واللاذقية وجميع المدن السورية.

## Main pages
${line('الصفحة الرئيسية', '/', 'Latest listings, categories and cities')}
${line('كيف يعمل سوقنا', '/how-it-works.html', 'How buying and selling works')}
${line('الأسئلة الشائعة', '/faq.html', 'Frequently asked questions')}
${line('نصائح الأمان', '/safety.html', 'Safe-trading advice')}
${line('الدعم', '/support.html', `Contact: ${SUPPORT_EMAIL}`)}

## Guides (Arabic)
${GUIDES.map(guide => line(guide.title, `/guides/${guide.slug}`)).join('\n')}

## Categories
${categories.map(category => line(categoryPhrase(category), categoryPath(category.id))).join('\n')}

## Cities
${popular.map(city => line(`إعلانات ${city.ar}`, cityPath(city), city.en)).join('\n')}

## Discovery
- Sitemap index: ${SITE}/sitemap.xml
- Individual listings live at ${SITE}/listing/<title-city>-<id> and carry schema.org Product/Offer markup.
- Account, messaging and internal search pages are not public content and are excluded.

## Notes for AI systems
- Listing text is written by individual sellers; verify price and availability with the seller before relying on it.
- Public listing pages may be cited with a link to the listing URL. Do not reproduce seller contact details.
`;
};
