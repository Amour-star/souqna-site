import {api} from './client';
import type {Category, SubCategory} from '@/types';

/**
 * Categories and subcategories come from the backend admin panel — never
 * hardcoded here, so web and mobile always show the same taxonomy.
 */

const unwrapList = <T,>(payload: any): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  if (Array.isArray(payload?.data)) return payload.data as T[];
  if (Array.isArray(payload?.data?.data)) return payload.data.data as T[];
  return [];
};

export const fetchCategories = async (): Promise<Category[]> => {
  // `categories` is the newer public endpoint; `viewCategories` is the legacy
  // one the mobile app still falls back to. Try both, same as mobile.
  try {
    const {data} = await api.get('categories');
    const list = unwrapList<Category>(data);
    if (list.length) return list;
  } catch {
    /* fall through to the legacy endpoint */
  }
  const {data} = await api.get('viewCategories');
  return unwrapList<Category>(data);
};

export const fetchSubCategories = async (categoryId: string): Promise<SubCategory[]> => {
  const {data} = await api.get(`subCategoriesByCategory/${categoryId}`);
  return unwrapList<SubCategory>(data);
};

export const fetchAllSubCategories = async (): Promise<SubCategory[]> => {
  const {data} = await api.get('viewSubCategories');
  return unwrapList<SubCategory>(data);
};
