import {MEDIA_BASE_URL} from './config';
import type {CustomFieldValue, Product} from '@/types';

/** Resolves a backend media path (`/productImages/x.jpg`) to a full URL. */
export const mediaUrl = (path?: string | null): string | null => {
  if (!path) return null;
  const value = String(path).trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `${MEDIA_BASE_URL}/${value.replace(/^\/+/, '')}`;
};

export const productCoverImage = (product: Product): string | null =>
  mediaUrl(product.images?.[0]?.path);

/**
 * Currency symbols, matching `getCurrencySymbol` in the mobile app's product
 * detail screen. SYP is shown as £ because that is the symbol the platform
 * already uses — web and app must not disagree about what a price says.
 */
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  SYP: '£',
  TRY: '₺',
};

/** Currencies the platform accepts, mirroring the mobile price input. */
export const SUPPORTED_CURRENCIES = ['USD', 'SYP', 'TRY'] as const;

export const currencySymbol = (currency: string | null | undefined): string => {
  const code = (currency || 'USD').toUpperCase();
  return CURRENCY_SYMBOLS[code] ?? code;
};

/**
 * Formats a listing price as `<symbol> <grouped amount>`, e.g. `$ 1,250`.
 *
 * Digits stay Latin in both languages. That is what the mobile app renders,
 * and Arabic marketplace UIs conventionally keep Western numerals for prices —
 * switching the web to Arabic-Indic digits would make the same listing look
 * different in the two clients.
 */
export const formatPrice = (
  value: number | string | null | undefined,
  currency: string | null | undefined,
): string | null => {
  // `Number(null)` and `Number('')` are both 0, which would render a missing
  // price as "$0" instead of falling back to "price on request".
  if (value === null || value === undefined || value === '') return null;

  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;

  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);

  return `${currencySymbol(currency)} ${formatted}`;
};

export const formatDate = (value: string | null | undefined, language: string): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-SY-u-nu-latn' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

export const formatTime = (date: Date | null, language: string): string => {
  if (!date) return '';
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-SY-u-nu-latn' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

/**
 * Relative time for listing cards ("3 days ago"), falling back to an absolute
 * date beyond a week so old listings stay readable.
 */
export const relativeTime = (
  value: string | null | undefined,
  language: string,
  t: (key: string, options?: Record<string, unknown>) => string,
): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) return t('time.justNow');
  if (minutes < 60) return t('time.minutesAgo', {count: minutes});

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('time.hoursAgo', {count: hours});

  const days = Math.floor(hours / 24);
  if (days <= 7) return t('time.daysAgo', {count: days});

  return formatDate(value, language);
};

/** URL-safe slug that keeps Arabic characters readable in the address bar. */
export const slugify = (value: string): string =>
  (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70);

/**
 * SEO-friendly listing path: `/listing/iphone-15-pro-berlin-<id>`.
 * The id is the last dash-separated segment, so the slug can change freely.
 */
export const listingPath = (product: Pick<Product, 'id' | 'name' | 'location'>): string => {
  const slug = slugify(
    [product.name, product.location?.split(',')[0]].filter(Boolean).join(' '),
  );
  return slug ? `/listing/${slug}-${product.id}` : `/listing/${product.id}`;
};

/** Extracts the listing id from a slugged path segment. */
export const idFromSlug = (slug: string | undefined): string => {
  if (!slug) return '';
  // Ids are UUIDs; take the trailing 36-character UUID when present.
  const uuid = slug.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  );
  if (uuid) return uuid[0];
  const parts = slug.split('-');
  return parts[parts.length - 1] ?? slug;
};

/** `custom_fields` arrives as a JSON string from the API. */
export const parseCustomFields = (
  value: Product['custom_fields'],
): CustomFieldValue[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const sellerIdOf = (product: Product): string =>
  String(product.seller_id ?? product.user_id ?? product.userID ?? '');

export const isVerifiedSeller = (product: Product): boolean =>
  Boolean(product.seller_is_verified ?? product.sellerIsVerified);

export const productViews = (product: Product): number =>
  Number(product.viewsCount ?? product.views_count ?? 0) || 0;

export const productSaves = (product: Product): number =>
  Number(product.likesCount ?? product.likes_count ?? 0) || 0;
