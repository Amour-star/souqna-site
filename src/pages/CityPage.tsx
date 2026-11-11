import {Link, useParams} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useSeo} from '@/hooks/useSeo';
import {useCategories} from '@/hooks/useCategories';
import {useProductSearch} from '@/hooks/useProductSearch';
import {useSearchFilters} from '@/hooks/useSearchFilters';
import {ListingGrid, ListingGridSkeleton} from '@/components/listing/ListingCard';
import {Button, EmptyState, ErrorState} from '@/components/ui';
import {localizedField} from '@/lib/i18n';
import {cityBySlug} from '@/lib/cities';
import {PAGE_SIZE} from '@/lib/config';
import NotFoundPage from './NotFoundPage';

/**
 * City landing page: `/city/<slug>` and `/city/<slug>/<categoryId>`.
 * The server (api/page.ts) renders the same page for crawlers and decides
 * whether it is indexable; this component is what users see once the app boots.
 */
const CityPage = () => {
  const {t, i18n} = useTranslation();
  const {slug = '', categoryId} = useParams();
  const city = cityBySlug(slug);
  const {categories} = useCategories();
  const category = categories.find(entry => entry.id === categoryId);

  const {filters, setFilters} = useSearchFilters({
    cityId: city?.id,
    ...(categoryId ? {categoryID: categoryId} : {}),
  });
  const query = useProductSearch({...filters, cityId: city?.id, ...(categoryId ? {categoryID: categoryId} : {})});

  const cityName = city ? (i18n.language === 'ar' ? city.ar : city.en) : '';
  const categoryName = category ? localizedField(category, 'name', i18n.language) : '';
  const heading = categoryName
    ? t('city.headingWithCategory', {category: categoryName, city: cityName})
    : t('city.heading', {city: cityName});

  const total = query.data?.totalRecords ?? 0;
  const page = filters.page ?? 1;
  const totalPages = Math.max(1, Math.ceil(total / (filters.pageSize ?? PAGE_SIZE)));

  useSeo({
    title: heading,
    description: t('city.description', {city: cityName}),
    canonicalPath: city ? `/city/${city.slug}${categoryId ? `/${categoryId}` : ''}` : undefined,
    noIndex: !city,
  });

  if (!city) return <NotFoundPage />;

  return (
    <div className="container page">
      <h1>{heading}</h1>
      {categoryId ? (
        <p>
          <Link to={`/city/${city.slug}`}>{t('city.allInCity', {city: cityName})}</Link>
        </p>
      ) : (
        <div className="row-wrap" style={{marginBottom: 'var(--space-4)'}}>
          {categories.map(entry => (
            <Link key={entry.id} className="chip" to={`/city/${city.slug}/${entry.id}`}>
              {localizedField(entry, 'name', i18n.language)}
            </Link>
          ))}
        </div>
      )}

      <p className="search-toolbar__count" aria-live="polite">
        {query.isLoading ? t('search.searching') : t('search.resultsCount', {count: total})}
      </p>

      {query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : query.isLoading ? (
        <ListingGridSkeleton count={12} />
      ) : query.data?.data.length ? (
        <>
          <ListingGrid products={query.data.data} />
          {totalPages > 1 ? (
            <nav className="pagination" aria-label={heading}>
              <Button variant="secondary" disabled={page <= 1} onClick={() => setFilters({...filters, page: page - 1})}>
                {t('common.previous')}
              </Button>
              <span className="muted small">{t('common.page', {page})}</span>
              <Button variant="secondary" disabled={page >= totalPages} onClick={() => setFilters({...filters, page: page + 1})}>
                {t('common.nextPage')}
              </Button>
            </nav>
          ) : null}
        </>
      ) : (
        <EmptyState icon="📭" title={t('search.emptyTitle')} body={t('search.emptyBody')} />
      )}
    </div>
  );
};

export default CityPage;
