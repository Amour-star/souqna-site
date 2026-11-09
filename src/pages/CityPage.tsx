import {useMemo} from 'react';
import {Link, useParams} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useSeo} from '@/hooks/useSeo';
import {useCategories} from '@/hooks/useCategories';
import {useProductSearch} from '@/hooks/useProductSearch';
import {useSearchFilters} from '@/hooks/useSearchFilters';
import {ListingGrid, ListingGridSkeleton} from '@/components/listing/ListingCard';
import {Button, EmptyState, ErrorState} from '@/components/ui';
import {localizedField} from '@/lib/i18n';
import {PAGE_SIZE, SITE_URL} from '@/lib/config';
import {findCityBySlugOrName, SYRIAN_CITIES} from '@/data/cities';

/**
 * City landing page for Syrian cities (e.g. Damascus, Aleppo, Homs).
 * Crawlable, indexable, and optimized for local search queries like
 * "سيارات للبيع في دمشق" or "عقارات للبيع في حلب".
 */
export const CityPage = () => {
  const {t, i18n} = useTranslation();
  const {citySlug = '', categoryId} = useParams();
  const city = useMemo(() => findCityBySlugOrName(citySlug), [citySlug]);
  const {categories} = useCategories();

  const activeCategory = useMemo(
    () => categories.find(c => c.id === categoryId),
    [categories, categoryId],
  );

  const categoryName = activeCategory
    ? localizedField(activeCategory, 'name', i18n.language)
    : '';

  const {filters, setFilters} = useSearchFilters({
    location: city?.nameAr,
    ...(categoryId ? {categoryID: categoryId} : {}),
  });

  const query = useProductSearch(filters);

  const heading = city
    ? activeCategory
      ? `${categoryName} في ${city.nameAr}`
      : `إعلانات للبيع والشراء في ${city.nameAr}`
    : t('search.title');

  const pageDescription = city
    ? activeCategory
      ? `تصفح أحدث إعلانات ${categoryName} للبيع والشراء في ${city.nameAr} على سوقنا. قارن الأسعار وتواصل مع البائعين مباشرة.`
      : city.description
    : t('home.heroSubtitle');

  const canonicalPath = city
    ? `/city/${city.slug}${categoryId ? `/${categoryId}` : ''}`
    : undefined;

  const total = query.data?.totalRecords ?? 0;
  const page = filters.page ?? 1;
  const totalPages = Math.max(1, Math.ceil(total / (filters.pageSize ?? PAGE_SIZE)));

  const breadcrumbs = useMemo(() => {
    if (!city) return [];
    return [
      {name: 'الرئيسية', path: '/'},
      {name: `إعلانات ${city.nameAr}`, path: `/city/${city.slug}`},
      ...(activeCategory
        ? [{name: categoryName, path: `/city/${city.slug}/${activeCategory.id}`}]
        : []),
    ];
  }, [city, activeCategory, categoryName]);

  useSeo({
    title: city ? heading : t('listing.notFoundTitle'),
    description: pageDescription,
    canonicalPath,
    noIndex: !city,
    structuredData: city
      ? {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: heading,
          description: pageDescription,
          url: `${SITE_URL}${canonicalPath}`,
          breadcrumb: {
            '@type': 'BreadcrumbList',
            itemListElement: breadcrumbs.map((crumb, idx) => ({
              '@type': 'ListItem',
              position: idx + 1,
              name: crumb.name,
              item: `${SITE_URL}${crumb.path}`,
            })),
          },
        }
      : null,
  });

  if (!city) {
    return (
      <div className="container page">
        <EmptyState
          icon="📍"
          title="المدينة غير موجودة"
          body="عذراً، لم نتمكن من العثور على هذه المدينة. يمكنك تصفح المدن والمحافظات السورية المدعومة."
          action={
            <Link className="btn btn--primary" to="/search">
              {t('listing.backToSearch')}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="container page">
      {/* Breadcrumb Navigation */}
      <nav aria-label="مسار التصفح" style={{marginBottom: 'var(--space-3)'}}>
        <ol className="breadcrumbs-list" style={{display: 'flex', gap: '8px', listStyle: 'none', padding: 0, fontSize: '0.875rem'}}>
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return (
              <li key={crumb.path} style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                {index > 0 && <span aria-hidden="true" style={{color: 'var(--color-text-muted)'}}>/</span>}
                {isLast ? (
                  <span aria-current="page" style={{fontWeight: 600}}>{crumb.name}</span>
                ) : (
                  <Link to={crumb.path} style={{color: 'var(--color-primary)'}}>{crumb.name}</Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Main Heading & Intro */}
      <header style={{marginBottom: 'var(--space-4)'}}>
        <h1 style={{margin: '0 0 var(--space-2)'}}>{heading}</h1>
        <p style={{margin: 0, color: 'var(--color-text-muted)', maxWidth: '720px', lineHeight: 1.6}}>
          {pageDescription}
        </p>
      </header>

      {/* Category filter links - crawlable HTML anchor links */}
      <div className="row-wrap" style={{marginBottom: 'var(--space-4)', gap: '8px', display: 'flex', flexWrap: 'wrap'}}>
        <Link
          to={`/city/${city.slug}`}
          className={`chip ${!categoryId ? 'chip--active' : ''}`}
          style={{textDecoration: 'none'}}>
          جميع الأقسام
        </Link>
        {categories.map(cat => {
          const isSelected = categoryId === cat.id;
          const catTitle = localizedField(cat, 'name', i18n.language);
          return (
            <Link
              key={cat.id}
              to={`/city/${city.slug}/${cat.id}`}
              className={`chip ${isSelected ? 'chip--active' : ''}`}
              style={{textDecoration: 'none'}}>
              {catTitle}
            </Link>
          );
        })}
      </div>

      {/* Results summary */}
      <div style={{marginBottom: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <span style={{fontSize: '0.875rem', color: 'var(--color-text-muted)'}}>
          {total > 0
            ? `عرض ${total} إعلان متاح في ${city.nameAr}`
            : `لا توجد إعلانات منشورة حالياً في ${city.nameAr}`}
        </span>
      </div>

      {/* Product Listings Grid */}
      {query.isLoading ? (
        <ListingGridSkeleton count={12} />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : (query.data?.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon="🏷️"
          title={`لا توجد إعلانات حالياً في ${city.nameAr}`}
          body={activeCategory ? `لم يتم العثور على إعلانات ضمن قسم ${categoryName} في ${city.nameAr}. يمكنك تصفح الأقسام الأخرى أو نشر إعلانك الأول مجاناً.` : 'كن أول من ينشر إعلاناً في هذه المدينة!'}
          action={
            <Link className="btn btn--primary" to="/sell">
              انشر إعلاناً مجاناً
            </Link>
          }
        />
      ) : (
        <>
          <ListingGrid products={query.data?.data ?? []} />

          {/* Crawlable Pagination */}
          {totalPages > 1 && (
            <div style={{marginTop: 'var(--space-6)', display: 'flex', justifyContent: 'center', gap: '8px'}}>
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setFilters({...filters, page: page - 1})}>
                {t('common.previous')}
              </Button>
              <span style={{alignSelf: 'center', margin: '0 8px'}}>
                {page} / {totalPages}
              </span>
              <Button
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => setFilters({...filters, page: page + 1})}>
                {t('common.next')}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Other Syrian Cities for internal crawlability & linking */}
      <section style={{marginTop: 'var(--space-8)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-4)'}}>
        <h2 style={{fontSize: '1.125rem', marginBottom: 'var(--space-2)'}}>مدن ومحافظات سورية أخرى</h2>
        <div style={{display: 'flex', flexWrap: 'wrap', gap: '10px'}}>
          {SYRIAN_CITIES.filter(c => c.slug !== city.slug).slice(0, 10).map(c => (
            <Link
              key={c.slug}
              to={`/city/${c.slug}`}
              style={{
                fontSize: '0.875rem',
                color: 'var(--color-primary)',
                textDecoration: 'none',
                background: 'var(--color-bg-secondary, #f5f5f5)',
                padding: '4px 10px',
                borderRadius: '6px',
              }}>
              إعلانات {c.nameAr}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};

export default CityPage;
