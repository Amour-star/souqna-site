/**
 * Domain types mirroring the payloads returned by the shared Souqna backend.
 * Field names follow the API exactly (including its mixed camel/snake casing)
 * so that the web client stays a faithful second consumer of the same data.
 */

export type ID = string;

export interface Category {
  id: ID;
  name: string;
  ar_name: string | null;
  image: string | null;
  imageName?: string | null;
  status?: number;
  /** Category-specific attributes, when configured in the admin panel. */
  fields?: CategoryField[];
}

export interface SubCategory extends Category {
  categoryID: ID;
  productsCount?: number;
  products_count?: number;
  category?: Category;
}

export interface CategoryField {
  id: ID;
  categoryID: ID;
  label: string;
  ar_label: string | null;
  name: string;
  ar_name: string | null;
  type: 'text' | 'textarea' | 'select' | 'number' | 'checkbox' | 'radio';
  required: boolean | number;
  options: string | null;
  ar_options: string | null;
}

export interface ProductImage {
  id: ID;
  productID: ID;
  path: string;
}

export interface CustomFieldValue {
  name: string;
  value: string;
  ar_name?: string;
  ar_value?: string;
}

export interface Seller {
  id: ID;
  name?: string | null;
  email?: string | null;
  avatar?: string | null;
  phone?: string | null;
  created_at?: string | null;
  role?: number | string | null;
  document?: {status?: number | null} | null;
}

export interface Product {
  id: ID;
  userID: ID;
  categoryID: ID;
  subCategoryID: ID;
  name: string;
  ar_name: string | null;
  description: string;
  ar_description: string | null;
  price: number | string;
  currency: string | null;
  status: number;
  condition: number | null;
  negotiable: number | boolean | null;
  contactInfo: string | null;
  location: string | null;
  ar_location: string | null;
  lat: string | number | null;
  long: string | number | null;
  date: string | null;
  expDate: string | null;
  created_at: string;
  updated_at: string;
  custom_fields: string | CustomFieldValue[] | null;
  images: ProductImage[];
  category?: Category | null;
  sub_category?: SubCategory | null;
  seller?: Seller | null;
  seller_id?: ID | null;
  user_id?: ID | null;
  seller_phone?: string | null;
  sellerPhone?: string | null;
  seller_is_verified?: boolean;
  sellerIsVerified?: boolean;
  likesCount?: number;
  likes_count?: number;
  viewsCount?: number;
  views_count?: number;
  isFavorite?: boolean;
  likedByMe?: boolean;
  isLikedByMe?: boolean;
}

export interface AuthUser {
  id: ID;
  name: string;
  email: string;
  avatar: string | null;
  /** Currently active role (2 = seller, 3 = buyer). */
  role: number;
  /** Role stored server-side, which can differ while a session is switched. */
  actualRole?: number;
  phone?: string | null;
  provider?: string | null;
  status?: number | null;
  created_at?: string | null;
  emailVerified?: boolean;
}

export interface AuthSession {
  user: AuthUser;
  token: string;
  refreshToken: string | null;
}

export interface Paginated<T> {
  data: T[];
  totalRecords: number;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  status?: number;
  data?: T;
  totalRecords?: number;
}

export interface AppNotification {
  id: ID;
  title?: string | null;
  body?: string | null;
  message?: string | null;
  type?: string | null;
  read?: boolean | number | null;
  isRead?: boolean | number | null;
  created_at?: string | null;
  data?: Record<string, unknown> | null;
}

export type SortOption =
  | 'newest'
  | 'oldest'
  | 'price_asc'
  | 'price_desc'
  | 'distance';

export interface ProductFilters {
  q?: string;
  categoryID?: ID;
  subCategoryID?: ID;
  sellerID?: ID;
  location?: string;
  lat?: number;
  long?: number;
  radius?: number;
  minPrice?: number;
  maxPrice?: number;
  condition?: number;
  fromDate?: string;
  toDate?: string;
  sort?: SortOption;
  page?: number;
  pageSize?: number;
}
