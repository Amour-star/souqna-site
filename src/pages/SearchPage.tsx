import {useEffect, useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useSeo} from '@/hooks/useSeo';
import {useSearchFilters, rememberSearch} from '@/hooks/useSearchFilters';
import {useProductSearch} from '@/hooks/useProductSearch';
import {useDebouncedValue} from '@/hooks/useDebouncedValue';
import {Filters} from '@/components/listing/Filters';
import {ListingGrid, ListingGridSkeleton} from '@/components/listing/ListingCard';
import {Button, EmptyState, ErrorState, Select} from '@/components/ui';
import {PAGE_SIZE} from '@/lib/config';
import type {SortOption} from '@/types';

const SORT_OPTIONS: {value: SortOption; labelKey: string}[] = [
  {value: 'newest', labelKey: 'search.sort.newest'},
  {value: 'oldest', labelKey: 'search.sort.oldest'},
  {value: 'price_asc', labelKey: 'search.sort.priceAsc'},
  {value: 'price_desc', labelKey: 'search.sort.priceDesc'},
];

const SearchPage = () => {
  const {t} = useTranslation();
  const [searchParams] = useSearchParams();
  const {filters, setFilters, clearFilters} = useSearchFilters();
  const [filtersOpen, setFiltersOpen] = useState(false);

  // The term is debounced so typing in the header does not fire a request per
  // keystroke; the URL is still the single source of truth.
  const debouncedTerm = useDebouncedValue(filters.q ?? '', 350);
  const query = useProductSearch({...filters, q: debouncedTerm || undefined});

  const term = searchParams.get('q') ?? '';
  useEffect(() => {
    if (term) rememberSearch(term);
  }, [term]);

  const total = query.data?.totalRecords ?? 0;
  const results = query.data?.data ?? [];
  const page = filters.page ?? 1;
  const totalPages = Math.max(1, Math.ceil(total / (filters.pageSize ?? PAGE_SIZE)));

  useSeo({
    title: term ? `${term} — ${t('search.title')}` : t('search.title'),
    description: t('home.heroSubtitle'),
    canonicalPath: '/search',
    // Filtered permutations are not useful to index; the plain search page is.
    noIndex: Boolean(searchParams.toString()),
  });

  return (
    <div className="container page">
      <h1 className="sr-only">{t('search.title')}</h1>

      <div className="search-layout">
        <div>
          <Button
            className="filters-toggle"
            variant="secondary"
            block
            aria-expanded={filtersOpen}
            aria-controls="filters-panel"
            onClick={() => setFiltersOpen(open => !open)}>
            {filtersOpen ? t('search.hideFilters') : t('search.showFilters')}
          </Button>

          <div
            id="filters-panel"
            className={`filters-panel${filtersOpen ? ' filters-panel--open' : ''}`}>
            <Filters value={filters} onChange={setFilters} onClear={clearFilters} />
          </div>
        </div>

        <div>
          <div className="search-toolbar">
            <p className="search-toolbar__count" aria-live="polite">
              {query.isLoading
                ? t('search.searching')
                : t('search.resultsCount', {count: total})}
            </p>

            <div className="search-toolbar__controls">
              <label className="sr-only" htmlFor="sort">
                {t('search.sortBy')}
              </label>
              <Select
                id="sort"
                value={filters.sort ?? 'newest'}
                onChange={event =>
                  setFilters({...filters, sort: event.target.value as SortOption, page: 1})
                }>
                {SORT_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {query.isError ? (
            <ErrorState onRetry={() => void query.refetch()} />
          ) : query.isLoading ? (
            <ListingGridSkeleton count={12} />
          ) : results.length ? (
            <>
              <ListingGrid products={results} />

              {totalPages > 1 ? (
                <nav className="pagination" aria-label={t('search.title')}>
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
            <EmptyState
              icon="🔍"
              title={t('search.emptyTitle')}
              body={t('search.emptyBody')}
              action={
                <Button variant="secondary" onClick={clearFilters}>
                  {t('search.clearFilters')}
                </Button>
              }
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchPage;
