import {useCallback, useMemo} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {addFavorite, fetchFavorites, removeFavorite} from '@/lib/api/favorites';
import {useAuth} from '@/lib/auth/AuthContext';
import {useToast} from '@/components/ui/ToastProvider';
import {errorMessage} from '@/lib/api/errorMessages';
import type {Product} from '@/types';

export const favoritesQueryKey = ['favorites'] as const;

/**
 * Favourites shared across every screen.
 *
 * The server is the source of truth, so the state matches the mobile app. The
 * toggle updates the cache optimistically — including inserting the product on
 * "add", so the heart fills immediately — and rolls back if the call fails.
 */
export const useFavorites = () => {
  const {isAuthenticated} = useAuth();
  const queryClient = useQueryClient();
  const {show} = useToast();
  const {t} = useTranslation();

  const query = useQuery({
    queryKey: favoritesQueryKey,
    queryFn: fetchFavorites,
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  const favoriteIds = useMemo(
    () => new Set((query.data ?? []).map(product => String(product.id))),
    [query.data],
  );

  const mutation = useMutation({
    mutationFn: async ({product, next}: {product: Product; next: boolean}) => {
      if (next) await addFavorite(product.id);
      else await removeFavorite(product.id);
      return {product, next};
    },
    onMutate: async ({product, next}) => {
      await queryClient.cancelQueries({queryKey: favoritesQueryKey});
      const previous = queryClient.getQueryData<Product[]>(favoritesQueryKey);

      queryClient.setQueryData<Product[]>(favoritesQueryKey, current => {
        const list = current ?? [];
        const withoutProduct = list.filter(
          entry => String(entry.id) !== String(product.id),
        );
        return next ? [product, ...withoutProduct] : withoutProduct;
      });

      return {previous};
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(favoritesQueryKey, context.previous);
      }
      show(errorMessage(error), 'error');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({queryKey: favoritesQueryKey});
    },
  });

  /**
   * Once the favourites list has loaded it is authoritative: the per-product
   * `isFavorite` flag from a search response is a snapshot from request time
   * and would otherwise keep a just-unsaved listing looking saved.
   */
  const isFavorite = useCallback(
    (product: Pick<Product, 'id' | 'isFavorite'>) => {
      if (query.isSuccess) return favoriteIds.has(String(product.id));
      return Boolean(product.isFavorite);
    },
    [favoriteIds, query.isSuccess],
  );

  const toggle = useCallback(
    (product: Product) => {
      const next = !isFavorite(product);
      mutation.mutate({product, next});
      show(next ? t('favorites.added') : t('favorites.removed'), 'success');
    },
    [isFavorite, mutation, show, t],
  );

  return {
    favorites: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    isFavorite,
    toggle,
    isToggling: mutation.isPending,
  };
};
