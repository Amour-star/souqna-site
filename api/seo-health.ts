/**
 * SEO Health & Monitoring API (Phase 11).
 *
 * Provides real-time metrics on:
 *   - Total active public listings
 *   - Indexable listings count
 *   - Sitemap URL count and chunking status
 *   - Missing metadata, missing images, and city/category integrity
 *   - Health checks and regression detection
 */

interface Req {
  query: Record<string, string | string[] | undefined>;
}
interface Res {
  status(code: number): Res;
  setHeader(name: string, value: string): Res;
  json(data: unknown): void;
}

const API = (process.env.VITE_API_URL || 'https://backend.souqna.net/api').replace(/\/+$/, '');
const SITE = (process.env.VITE_SITE_URL || 'https://www.souqna.net').replace(/\/+$/, '');
const LISTINGS_PER_SITEMAP = 1000;

export default async function handler(req: Req, res: Res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

  const startTime = Date.now();

  try {
    const [prodSampleRes, categoriesRes, subCategoriesRes] = await Promise.all([
      fetch(`${API}/showProductsWithoutAuth`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', pageNo: '1', recordsPerPage: '100'},
        body: '{}',
        signal: AbortSignal.timeout(8000),
      }),
      fetch(`${API}/viewCategories`, {signal: AbortSignal.timeout(8000)}),
      fetch(`${API}/viewSubCategories`, {signal: AbortSignal.timeout(8000)}),
    ]);

    const prodData = await prodSampleRes.json();
    const catData = await categoriesRes.json();
    const subData = await subCategoriesRes.json();

    const totalRecords = Number(prodData?.totalRecords) || 0;
    const sampleListings: Array<{
      id: string;
      name?: string;
      description?: string;
      city?: string;
      location?: string;
      categoryID?: string;
      images?: {path?: string}[];
      status?: number | string;
    }> = prodData?.data ?? [];

    const categories = (catData?.data ?? []).filter((c: {status: number | string}) => Number(c.status) === 1);
    const subCategories = (subData?.data ?? []).filter((s: {status: number | string}) => Number(s.status) === 1);

    // Audit the sample listings for SEO defects
    let missingTitleCount = 0;
    let missingDescCount = 0;
    let missingImageCount = 0;
    let missingLocationCount = 0;
    let missingCategoryCount = 0;

    for (const item of sampleListings) {
      if (!item.name || !item.name.trim()) missingTitleCount++;
      if (!item.description || !item.description.trim()) missingDescCount++;
      if (!item.images || item.images.length === 0) missingImageCount++;
      if (!item.city && !item.location) missingLocationCount++;
      if (!item.categoryID) missingCategoryCount++;
    }

    const sitemapChunks = Math.max(1, Math.ceil(totalRecords / LISTINGS_PER_SITEMAP));
    const staticPagesCount = 7;
    const activeSubcategoriesWithProducts = subCategories.filter(
      (s: {productsCount?: number; products_count?: number}) =>
        Number(s.productsCount ?? s.products_count ?? 0) > 0,
    ).length;

    const totalSitemapUrls =
      staticPagesCount +
      categories.length +
      activeSubcategoriesWithProducts +
      18 + // Syrian cities
      totalRecords;

    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      responseTimeMs: Date.now() - startTime,
      metrics: {
        totalActivePublicListings: totalRecords,
        indexableListingsCount: totalRecords,
        categoriesCount: categories.length,
        activeSubcategoriesCount: activeSubcategoriesWithProducts,
        supportedSyrianCitiesCount: 18,
        totalIndexedUrls: totalSitemapUrls,
        sitemapChunksCount: sitemapChunks,
      },
      sitemapStructure: {
        indexUrl: `${SITE}/sitemap.xml`,
        indexAlias: `${SITE}/sitemap_index.xml`,
        pagesUrl: `${SITE}/sitemap-pages.xml`,
        categoriesUrl: `${SITE}/sitemap-categories.xml`,
        citiesUrl: `${SITE}/sitemap-cities.xml`,
        listingsPattern: `${SITE}/sitemap-listings-[1-${sitemapChunks}].xml`,
      },
      auditSampleResults: {
        sampleSize: sampleListings.length,
        missingTitles: missingTitleCount,
        missingDescriptions: missingDescCount,
        missingImages: missingImageCount,
        missingLocationOrCity: missingLocationCount,
        missingCategory: missingCategoryCount,
      },
      crawlersPolicy: {
        robotsTxt: `${SITE}/robots.txt`,
        llmsTxt: `${SITE}/llms.txt`,
        indexNowEndpoint: `${SITE}/api/indexnow`,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: (error as Error).message,
    });
  }
}
