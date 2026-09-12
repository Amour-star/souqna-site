import {useParams} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useSeo} from '@/hooks/useSeo';
import {useCategories, useSubCategories} from '@/hooks/useCategories';
import {useProductSearch} from '@/hooks/useProductSearch';
import {useSearchFilters} from '@/hooks/useSearchFilters';
import {Filters} from '@/components/listing/Filters';
import {ListingGrid, ListingGridSkeleton} from '@/components/listing/ListingCard';
import {Button, EmptyState, ErrorState, Select} from '@/components/ui';
import {localizedField} from '@/lib/i18n';
import {PAGE_SIZE, SITE_URL} from '@/lib/config';
import type {SortOption} from '@/types';

/**
 * Category landing page. Unlike `/search` these URLs are stable and
 * crawlable, so they carry canonical metadata and breadcrumb structured data.
 */
const CategoryPage = () => {
  const {t, i18n} = useTranslation();
  const {categoryId, subCategoryId} = useParams();
  const {categories} = useCategories();
  const {subCategories} = useSubCategories(categoryId);

  const {filters, setFilters, clearFilters} = useSearchFilters({
    categoryID: categoryId,
    ...(subCategoryId ? {subCategoryID: subCategoryId} : {}),
  });
  const query = useProductSearch(filters);

  const category = categories.find(entry => entry.id === categoryId);
  const subCategory = subCategories.find(entry => entry.id === subCategoryId);
  const categoryName = category ? localizedField(category, 'name', i18n.language) : '';
  const subCategoryName = subCategory
    ? localizedField(subCategory, 'name', i18n.language)
    : '';
  const heading = subCategoryName || categoryName || t('search.title');

  const total = query.data?.totalRecords ?? 0;
  const page = filters.page ?? 1;
  const totalPages = Math.max(1, Math.ceil(total / (filters.pageSize ?? PAGE_SIZE)));

  useSeo({
    title: heading,
    description: t('home.heroSubtitle'),
    canonicalPath: subCategoryId
      ? `/category/${categoryId}/${subCategoryId}`
      : `/category/${categoryId}`,
    structuredData: category
      ? {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            {'@type': 'ListItem', position: 1, name: 'Souqna', item: SITE_URL},
            {
              '@type': 'ListItem',
              position: 2,
              name: categoryName,
              item: `${SITE_URL}/category/${categoryId}`,
            },
            ...(subCategoryName
              ? [
                  {
                    '@type': 'ListItem',
                    position: 3,
                    name: subCategoryName,
                    item: `${SITE_URL}/category/${categoryId}/${subCategoryId}`,
                  },
                ]
              : []),
          ],
        }
      : null,
  });

  return (
    <div className="container page">
      <h1>{heading}</h1>

      {subCategories.length ? (
        <div className="row-wrap" style={{marginBottom: 'var(--space-4)'}}>
          {subCategories.map(entry => (
            <button
              key={entry.id}
              type="button"
              className="chip"
              aria-pressed={filters.subCategoryID === entry.id}
              onClick={() =>
                setFilters({
                  ...filters,
                  subCategoryID:
                    filters.subCategoryID === entry.id ? undefined : entry.id,
                  page: 1,
                })
              }>
              {localizedField(entry, 'name', i18n.language)}
            </button>
          ))}
        </div>
      ) : null}

      <div className="search-layout">
        <div className="filters-panel">
          <Filters value={filters} onChange={setFilters} onClear={clearFilters} />
        </div>

        <div>
          <div className="search-toolbar">
            <p className="search-toolbar__count" aria-live="polite">
              {query.isLoading
                ? t('search.searching')
                : t('search.resultsCount', {count: total})}
            </p>
            <div className="search-toolbar__controls">
              <label className="sr-only" htmlFor="category-sort">
                {t('search.sortBy')}
              </label>
              <Select
                id="category-sort"
                value={filters.sort ?? 'newest'}
                onChange={event =>
                  setFilters({...filters, sort: event.target.value as SortOption, page: 1})
                }>
                <option value="newest">{t('search.sort.newest')}</option>
                <option value="oldest">{t('search.sort.oldest')}</option>
                <option value="price_asc">{t('search.sort.priceAsc')}</option>
                <option value="price_desc">{t('search.sort.priceDesc')}</option>
              </Select>
            </div>
          </div>

          {query.isError ? (
            <ErrorState onRetry={() => void query.refetch()} />
          ) : query.isLoading ? (
            <ListingGridSkeleton count={12} />
          ) : query.data?.data.length ? (
            <>
              <ListingGrid products={query.data.data} />
              {totalPages > 1 ? (
                <nav className="pagination" aria-label={heading}>
                  <Button
                    variant="secondary"
                    disabled={page <= 1}
                    onClick={() => setFilters({...filters, page: page - 1})}>
                    {t('common.previous')}
                  </Button>
                  <span className="muted small">{t('common.page', {page})}</span>
                  <Button
                    variant="secondary"
                    disabled={page >= totalPages}
                    onClick={() => setFilters({...filters, page: page + 1})}>
                    {t('common.nextPage')}
                  </Button>
                </nav>
              ) : null}
            </>
          ) : (
            <EmptyState icon="📭" title={t('search.emptyTitle')} body={t('search.emptyBody')} />
          )}
        </div>
      </div>
    </div>
  );
};

export default CategoryPage;
