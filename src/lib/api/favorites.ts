import {api} from './client';
import type {ID, Product} from '@/types';

/** Favourites live server-side, so they follow the user between web and app. */

export const fetchFavorites = async (): Promise<Product[]> => {
  const {data} = await api.get('getFavorites');
  const payload = data?.data ?? data?.favorites ?? [];
  if (!Array.isArray(payload)) return [];
  // The endpoint returns either products or favourite rows wrapping a product.
  return payload
    .map((entry: any) => (entry?.product ? entry.product : entry))
    .filter(Boolean) as Product[];
};

export const addFavorite = async (productID: ID) => {
  const {data} = await api.post('addToFavorite', {productID});
  if (!data?.success) throw new Error(data?.message || 'Could not save the listing');
  return data;
};

export const removeFavorite = async (productID: ID) => {
  const {data} = await api.post('removeFromFavorite', {productID});
  if (!data?.success) throw new Error(data?.message || 'Could not remove the listing');
  return data;
};
