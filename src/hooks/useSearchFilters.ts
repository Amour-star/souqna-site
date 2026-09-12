import {useCallback, useMemo} from 'react';
import {useSearchParams} from 'react-router-dom';
import {PAGE_SIZE} from '@/lib/config';
import type {ProductFilters, SortOption} from '@/types';

const SORT_VALUES: SortOption[] = [
  'newest',
  'oldest',
  'price_asc',
  'price_desc',
  'distance',
];

const RECENT_KEY = 'souqna.recentSearches';
const RECENT_LIMIT = 6;

/** Reads the last search terms so returning users can repeat them in a tap. */
export const readRecentSearches = (): string[] => {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

export const rememberSearch = (term: string) => {
  const trimmed = term.trim();
  if (!trimmed) return;
  try {
    const next = [trimmed, ...readRecentSearches().filter(item => item !== trimmed)].slice(
      0,
      RECENT_LIMIT,
    );
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
};

export const clearRecentSearches = () => {
  try {
    window.localStorage.removeItem(RECENT_KEY);
  } catch {
    /* storage unavailable */
  }
};

const numberParam = (value: string | null): number | undefined => {
  if (value === null || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/**
 * Filter state lives in the URL, so a filtered search is shareable, survives a
 * reload, and restores itself when the user navigates back from a listing.
 */
export const useSearchFilters = (overrides: Partial<ProductFilters> = {}) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<ProductFilters>(() => {
    const sortParam = searchParams.get('sort') as SortOption | null;
    return {
      q: searchParams.get('q') ?? undefined,
      categoryID: searchParams.get('category') ?? undefined,
      subCategoryID: searchParams.get('subcategory') ?? undefined,
      location: searchParams.get('location') ?? undefined,
      lat: numberParam(searchParams.get('lat')),
      long: numberParam(searchParams.get('long')),
      radius: numberParam(searchParams.get('radius')),
      minPrice: numberParam(searchParams.get('min')),
      maxPrice: numberParam(searchParams.get('max')),
      condition: numberParam(searchParams.get('condition')),
      sort: sortParam && SORT_VALUES.includes(sortParam) ? sortParam : 'newest',
      page: numberParam(searchParams.get('page')) ?? 1,
      pageSize: PAGE_SIZE,
      ...overrides,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, JSON.stringify(overrides)]);

  const setFilters = useCallback(
    (next: ProductFilters) => {
      const params = new URLSearchParams();
      if (next.q) params.set('q', next.q);
      if (next.categoryID) params.set('category', next.categoryID);
      if (next.subCategoryID) params.set('subcategory', next.subCategoryID);
      if (next.location) params.set('location', next.location);
      if (typeof next.lat === 'number') params.set('lat', String(next.lat));
      if (typeof next.long === 'number') params.set('long', String(next.long));
      if (typeof next.radius === 'number') params.set('radius', String(next.radius));
      if (typeof next.minPrice === 'number') params.set('min', String(next.minPrice));
      if (typeof next.maxPrice === 'number') params.set('max', String(next.maxPrice));
      if (next.condition) params.set('condition', String(next.condition));
      if (next.sort && next.sort !== 'newest') params.set('sort', next.sort);
      if (next.page && next.page > 1) params.set('page', String(next.page));
      setSearchParams(params, {replace: true});
    },
    [setSearchParams],
  );

  const clearFilters = useCallback(() => {
    const params = new URLSearchParams();
    const term = searchParams.get('q');
    if (term) params.set('q', term);
    setSearchParams(params, {replace: true});
  }, [searchParams, setSearchParams]);

  return {filters, setFilters, clearFilters};
};
