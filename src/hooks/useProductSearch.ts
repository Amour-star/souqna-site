import {keepPreviousData, useQuery} from '@tanstack/react-query';
import {searchProducts} from '@/lib/api/products';
import type {ProductFilters} from '@/types';

/**
 * Server-side product search. The query key contains the full filter set, so
 * React Query dedupes identical requests and serves cached pages instantly
 * when the user navigates back.
 */
export const useProductSearch = (filters: ProductFilters, enabled = true) =>
  useQuery({
    queryKey: ['products', filters],
    queryFn: () => searchProducts(filters),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
