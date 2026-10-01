import {STEP} from '@/lib/listingForm';

/**
 * Classifies a failed create/update-listing request so the composer can react
 * specifically (jump to the broken field, send the user to login, offer a
 * retry) instead of collapsing everything into one generic toast.
 */

export type SaveFailureKind =
  | 'validation'
  | 'unauthenticated'
  | 'forbidden'
  | 'tooLarge'
  | 'server'
  | 'network'
  | 'unknown';

export interface SaveFieldError {
  /** Form field the error belongs to (a key of the composer's error map). */
  field: string;
  /** Laravel's own message, used only to tell "required" apart from "invalid". */
  message: string;
}

export interface SaveFailure {
  kind: SaveFailureKind;
  status?: number;
  fields: SaveFieldError[];
  /** Composer step containing the first invalid field, if any. */
  step: number | null;
}

/** Laravel input name → the composer's field key. */
const normalizeField = (name: string): string => {
  const base = name.split('.')[0];
  if (base === 'image' || base === 'images') return 'images';
  if (base === 'city_id' || base === 'lat' || base === 'long') return 'location';
  return base;
};

const FIELD_STEP: Record<string, number> = {
  categoryID: STEP.CATEGORY,
  subCategoryID: STEP.CATEGORY,
  images: STEP.PHOTOS,
  name: STEP.DETAILS,
  description: STEP.DETAILS,
  price: STEP.DETAILS,
  currency: STEP.DETAILS,
  condition: STEP.DETAILS,
  negotiable: STEP.DETAILS,
  contactInfo: STEP.DETAILS,
  custom_fields: STEP.ATTRIBUTES,
  location: STEP.LOCATION,
};

export const stepForField = (field: string): number | null => FIELD_STEP[field] ?? null;

interface FailureShape {
  response?: {status?: number; data?: {errors?: Record<string, string[] | string>}};
  isAxiosError?: boolean;
}

export const classifySaveError = (error: unknown): SaveFailure => {
  const {response, isAxiosError} = (error ?? {}) as FailureShape;
  const status = response?.status;

  const errors = response?.data?.errors;
  const fields: SaveFieldError[] =
    errors && typeof errors === 'object'
      ? Object.entries(errors).map(([name, messages]) => ({
          field: normalizeField(name),
          message: String(Array.isArray(messages) ? messages[0] : messages),
        }))
      : [];

  const steps = fields.map(entry => stepForField(entry.field)).filter((s): s is number => s !== null);
  const step = steps.length ? Math.min(...steps) : null;
  const base = {status, fields, step};

  // Some endpoints answer 200 with {success:false, errors} — treat like a 422.
  if (fields.length) return {...base, kind: 'validation'};
  if (status === 401) return {...base, kind: 'unauthenticated'};
  if (status === 403) return {...base, kind: 'forbidden'};
  if (status === 413) return {...base, kind: 'tooLarge'};
  if (status && status >= 500) return {...base, kind: 'server'};
  if (!response && isAxiosError) return {...base, kind: 'network'};
  return {...base, kind: 'unknown'};
};
