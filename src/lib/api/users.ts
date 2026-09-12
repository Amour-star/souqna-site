import {api} from './client';
import {ROLE} from '@/lib/config';
import type {AppNotification, ID, Product, Seller} from '@/types';

/** Public seller profile plus the listings they have published. */
export const fetchSellerDetails = async (sellerId: ID): Promise<Seller | null> => {
  const {data} = await api.get(`getSellerDetails/${sellerId}`);
  const payload = data?.data ?? data?.seller ?? null;
  return payload ? (payload as Seller) : null;
};

export const fetchSellerProducts = async (sellerId: ID): Promise<Product[]> => {
  const {data} = await api.post(
    'showProductsWithoutAuth',
    {sellerID: sellerId},
    {headers: {pageNo: 1, recordsPerPage: 60}},
  );
  return Array.isArray(data?.data) ? data.data : [];
};

/**
 * Notifications are role-scoped on the backend: sellers and buyers read from
 * different endpoints. Mirrors `fetchNotifications` in the mobile client.
 */
export const fetchNotifications = async (role: number): Promise<AppNotification[]> => {
  const endpoint =
    role === ROLE.SELLER ? 'viewAllNotificaionsSeller' : 'viewAllNotificaionsBuyer';
  const {data} = await api.get(endpoint, {
    params: role === ROLE.SELLER ? {amount: 200} : undefined,
  });
  const payload = data?.data ?? data?.notifications ?? [];
  return Array.isArray(payload) ? payload : [];
};

export const deleteNotification = async (id: ID, role: number) => {
  const endpoint =
    role === ROLE.SELLER
      ? `deleteNotificationSeller/${id}`
      : `deleteNotificationBuyer/${id}`;
  const {data} = await api.delete(endpoint);
  return data;
};

export const clearNotifications = async (role: number) => {
  const endpoint =
    role === ROLE.SELLER ? 'clearNotificationsSeller' : 'clearNotificationsBuyer';
  const {data} = await api.delete(endpoint);
  return data;
};

export const fetchSellerDashboard = async () => {
  const {data} = await api.get('seller/dashboard');
  return data?.data ?? data ?? null;
};
