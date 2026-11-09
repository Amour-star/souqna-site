import {Link, useParams} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {listingPath} from '@/lib/format';
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
  const heading = subCategoryName
    ? `${subCategoryName} — ${categoryName}`
    : categoryName || t('search.title');

  const total = query.data?.totalRecords ?? 0;
  const page = filters.page ?? 1;
  const totalPages = Math.max(1, Math.ceil(total / (filters.pageSize ?? PAGE_SIZE)));

  const seoTitle = `${heading} في سوريا`;
  const seoDescription = total > 0
    ? `تصفح ${total} إعلان ضمن ${heading} في سوريا على سوقنا. قارن الأسعار وتواصل مع البائعين مباشرة في دمشق وحلب وكافة المدن السورية.`
    : `تصفح أحدث إعلانات ${heading} في سوريا على سوقنا. بيع واشترِ بسهولة وتواصل مع البائعين مباشرة.`;

  const breadcrumbs = [
    {name: 'الرئيسية', path: '/'},
    ...(category ? [{name: categoryName, path: `/category/${categoryId}`}] : []),
    ...(category && subCategory
      ? [{name: subCategoryName, path: `/category/${categoryId}/${subCategoryId}`}]
      : []),
  ];

  const items = query.data?.data ?? [];

  useSeo({
    title: seoTitle,
    description: seoDescription,
    canonicalPath: subCategoryId
      ? `/category/${categoryId}/${subCategoryId}`
      : `/category/${categoryId}`,
    structuredData: category
      ? {
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'BreadcrumbList',
              itemListElement: breadcrumbs.map((crumb, idx) => ({
                '@type': 'ListItem',
                position: idx + 1,
                name: crumb.name,
                item: `${SITE_URL}${crumb.path}`,
              })),
            },
            ...(items.length
              ? [
                  {
                    '@type': 'ItemList',
                    name: heading,
                    numberOfItems: items.length,
                    itemListElement: items.slice(0, 24).map((p, idx) => ({
                      '@type': 'ListItem',
                      position: idx + 1,
                      name: p.name,
                      url: `${SITE_URL}${listingPath(p)}`,
                    })),
                  },
                ]
              : []),
          ],
        }
      : null,
  });

  return (
    <div className="container page">
      {/* Crawlable Breadcrumbs */}
      <nav aria-label="مسار التصفح" style={{marginBottom: 'var(--space-3)'}}>
        <ol style={{display: 'flex', gap: '8px', listStyle: 'none', padding: 0, fontSize: '0.875rem', margin: 0}}>
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

      <h1>{heading}</h1>
      <p style={{margin: '0 0 var(--space-4)', color: 'var(--color-text-muted)', fontSize: '0.95rem'}}>
        {seoDescription}
      </p>

      {/* Crawlable Subcategory Links with real href attributes */}
      {subCategories.length ? (
        <div className="row-wrap" style={{marginBottom: 'var(--space-4)', gap: '8px', display: 'flex', flexWrap: 'wrap'}}>
          <Link
            to={`/category/${categoryId}`}
            className={`chip ${!subCategoryId ? 'chip--active' : ''}`}
            style={{textDecoration: 'none'}}>
            الكل
          </Link>
          {subCategories.map(entry => {
            const isSelected = subCategoryId === entry.id;
            return (
              <Link
                key={entry.id}
                to={`/category/${categoryId}/${entry.id}`}
                className={`chip ${isSelected ? 'chip--active' : ''}`}
                style={{textDecoration: 'none'}}>
                {localizedField(entry, 'name', i18n.language)}
              </Link>
            );
          })}
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
