import type {CategoryField} from '@/types';

/**
 * Validation for the listing composer.
 *
 * Kept out of the component and locale-independent: each rule returns a
 * translation key plus its interpolation values, so the same logic produces
 * Arabic or English messages and can be tested without rendering React.
 *
 * The field requirements mirror `validateCreateAdForm` in the mobile app, so a
 * listing accepted on one client is accepted on the other.
 */

export const MIN_TITLE_LENGTH = 3;
export const MIN_DESCRIPTION_LENGTH = 10;

export interface ListingFormValues {
  categoryID: string;
  subCategoryID: string;
  name: string;
  description: string;
  price: string;
  currency: string;
  condition: string;
  negotiable: boolean;
  contactInfo: string;
  location: string;
  lat: string;
  long: string;
  customFields: Record<string, string>;
}

/** A validation failure, ready to hand to `t()`. */
export interface FieldError {
  key: string;
  values?: Record<string, string | number>;
}

export type ListingErrors = Record<string, FieldError>;

export interface ValidationContext {
  form: ListingFormValues;
  imageCount: number;
  hasSubCategories: boolean;
  categoryFields: CategoryField[];
  /** Resolves a category field's display label in the active language. */
  fieldLabel?: (field: CategoryField) => string;
}

export const STEP = {
  CATEGORY: 0,
  PHOTOS: 1,
  DETAILS: 2,
  ATTRIBUTES: 3,
  LOCATION: 4,
  PREVIEW: 5,
} as const;

export const STEP_COUNT = 6;

/** Validates one step of the composer. */
export const validateListingStep = (
  step: number,
  context: ValidationContext,
): ListingErrors => {
  const {form, imageCount, hasSubCategories, categoryFields, fieldLabel} = context;
  const errors: ListingErrors = {};

  if (step === STEP.CATEGORY) {
    if (!form.categoryID) errors.categoryID = {key: 'sell.error.category'};
    if (hasSubCategories && !form.subCategoryID) {
      errors.subCategoryID = {key: 'sell.error.subCategory'};
    }
  }

  if (step === STEP.PHOTOS && imageCount < 1) {
    errors.images = {key: 'sell.error.images'};
  }

  if (step === STEP.DETAILS) {
    if (form.name.trim().length < MIN_TITLE_LENGTH) {
      errors.name = {key: 'sell.error.titleShort', values: {count: MIN_TITLE_LENGTH}};
    }
    if (form.description.trim().length < MIN_DESCRIPTION_LENGTH) {
      errors.description = {
        key: 'sell.error.descriptionShort',
        values: {count: MIN_DESCRIPTION_LENGTH},
      };
    }
    const price = Number(form.price);
    if (!form.price.trim() || !Number.isFinite(price) || price < 0) {
      errors.price = {key: 'sell.error.price'};
    }
  }

  if (step === STEP.ATTRIBUTES) {
    categoryFields
      .filter(field => Boolean(field.required))
      .forEach(field => {
        if (!form.customFields[field.name]?.trim()) {
          errors[`custom.${field.name}`] = {
            key: 'sell.error.customRequired',
            values: {field: fieldLabel?.(field) ?? field.label ?? field.name},
          };
        }
      });
  }

  if (step === STEP.LOCATION && !form.location.trim()) {
    errors.location = {key: 'sell.error.location'};
  }

  return errors;
};

/** Every step's errors at once, used before publishing. */
export const validateListing = (context: ValidationContext): ListingErrors =>
  Object.assign(
    {},
    ...Array.from({length: STEP_COUNT}, (_, step) => validateListingStep(step, context)),
  );

export const isValid = (errors: ListingErrors) => Object.keys(errors).length === 0;
