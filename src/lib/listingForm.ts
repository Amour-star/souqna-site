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
  /** Stable backend city id, set only when the area is a confirmed canonical city. */
  cityId?: number;
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

/** Step indexes the wizard actually shows: the attributes step only exists for categories that define attributes. */
export const activeStepIndexes = (hasAttributes: boolean): number[] =>
  [STEP.CATEGORY, STEP.PHOTOS, STEP.DETAILS, STEP.ATTRIBUTES, STEP.LOCATION, STEP.PREVIEW].filter(
    index => index !== STEP.ATTRIBUTES || hasAttributes,
  );

/**
 * The step a "next"/"back" press lands on. A current step that is not in the active list (a stale
 * draft pointing at the attributes step of a category that has none) is treated as the nearest
 * visible step instead of jumping back to the first one.
 */
export const stepAfter = (current: number, direction: 1 | -1, hasAttributes: boolean): number => {
  const steps = activeStepIndexes(hasAttributes);
  const at = steps.indexOf(current);
  if (at >= 0) return steps[Math.min(steps.length - 1, Math.max(0, at + direction))];
  return direction === 1
    ? steps.find(index => index > current) ?? steps[steps.length - 1]
    : [...steps].reverse().find(index => index < current) ?? steps[0];
};

/** Where to move when the current step stops existing (e.g. the category changed). */
export const visibleStep = (current: number, hasAttributes: boolean): number =>
  activeStepIndexes(hasAttributes).includes(current) ? current : stepAfter(current, 1, hasAttributes);

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
