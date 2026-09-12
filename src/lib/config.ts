/**
 * Runtime configuration for the Souqna web client.
 *
 * The web app is a second client of the exact same Souqna platform the mobile
 * app talks to: same Laravel API, same JWT identity, same Firestore chat.
 * Nothing here may diverge from `src/config/api.js` / `src/config/firebase.ts`
 * in the React Native app without breaking cross-client parity.
 */

const DEFAULT_API_URL = 'https://backend.souqna.net/api';

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const ensureApiSuffix = (value: string) => {
  const normalized = stripTrailingSlash(value);
  if (!normalized) return '';
  return /\/api$/i.test(normalized) ? normalized : `${normalized}/api`;
};

const envApiUrl =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_PUBLIC_API_URL ||
  '';

/** Base URL of the shared Laravel API, always ending in `/api`. */
export const API_BASE_URL = ensureApiSuffix(envApiUrl || DEFAULT_API_URL);

/** Origin that serves uploaded images (`/productImages/...`, `/categoryImages/...`). */
export const MEDIA_BASE_URL = API_BASE_URL.replace(/\/api$/i, '');

/** Public site origin, used for canonical URLs and share links. */
export const SITE_URL = stripTrailingSlash(
  import.meta.env.VITE_SITE_URL || 'https://www.souqna.net',
);

export const STORE_LINKS = {
  android: 'https://play.google.com/store/apps/details?id=com.souqnaapp',
  ios: 'https://apps.apple.com/us/app/souqna-app/id6753893826',
};

export const SUPPORT_EMAIL = 'appsouqna@gmail.com';

/** Roles as defined by the backend `users.role` column. */
export const ROLE = {
  ADMIN: 1,
  SELLER: 2,
  BUYER: 3,
} as const;

/**
 * Product `status` values as the live backend uses them today.
 *
 * Listings are created with status 0 and an admin *may* flip them to 1 via
 * `approveProduct` — but the public listing endpoint does not filter on it, so
 * 0 and 1 are both publicly visible and are treated here as "published".
 * INACTIVE/SOLD come with the optional backend patch in `backend-patch/` and
 * are only surfaced when `FEATURES.listingStatus` is enabled.
 */
export const PRODUCT_STATUS = {
  /** Created, publicly listed, not yet explicitly approved. */
  PENDING: 0,
  /** Explicitly approved by an admin, publicly listed. */
  ACTIVE: 1,
  /** Paused by the seller (requires the backend patch). */
  INACTIVE: 2,
  /** Marked as sold by the seller (requires the backend patch). */
  SOLD: 3,
} as const;

/** True while a listing is visible to buyers. */
export const isPublished = (status: number | string | null | undefined) => {
  const value = Number(status);
  return value === PRODUCT_STATUS.PENDING || value === PRODUCT_STATUS.ACTIVE;
};

/** Condition values accepted by `createProduct` / `updateProduct` (`in:1,2`). */
export const CONDITION = {
  NEW: 1,
  USED: 2,
} as const;

/**
 * Capabilities that depend on a backend deploy. Keep these off until the
 * matching server change is live, so the UI never offers an action that would
 * silently do nothing.
 */
export const FEATURES = {
  /** Seller-controlled deactivate / mark-as-sold. See `backend-patch/README.md`. */
  listingStatus: import.meta.env.VITE_FEATURE_LISTING_STATUS === 'true',
  /**
   * Sign in to Firebase with a custom token minted by the Laravel API, so
   * Firestore rules can identify the user. Turn on only after the backend
   * endpoint is deployed — see `backend-patch/security/FIRESTORE_SECURITY.md`.
   */
  firebaseAuth: import.meta.env.VITE_FEATURE_FIREBASE_AUTH === 'true',
  /**
   * Submit listing reports to the API instead of falling back to the user's
   * email client. Needs `backend-patch/ReportController.php`.
   */
  reportsApi: import.meta.env.VITE_FEATURE_REPORTS_API === 'true',
};

export const PAGE_SIZE = 24;
