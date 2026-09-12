import {useQuery} from '@tanstack/react-query';
import {fetchCategories, fetchSubCategories} from '@/lib/api/catalog';

/** Category taxonomy, cached for the session — it changes rarely. */
export const useCategories = () => {
  const query = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: 10 * 60 * 1000,
  });

  return {
    categories: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
};

export const useSubCategories = (categoryId?: string | null) => {
  const query = useQuery({
    queryKey: ['subcategories', categoryId],
    queryFn: () => fetchSubCategories(categoryId as string),
    enabled: Boolean(categoryId),
    staleTime: 10 * 60 * 1000,
  });

  return {
    subCategories: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
};
