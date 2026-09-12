import {beforeAll, describe, expect, it} from 'vitest';
import i18n, {changeLanguage, initI18n} from '@/lib/i18n';
import {
  MIN_DESCRIPTION_LENGTH,
  MIN_TITLE_LENGTH,
  STEP,
  isValid,
  validateListing,
  validateListingStep,
  type ListingFormValues,
  type ValidationContext,
} from '@/lib/listingForm';
import type {CategoryField} from '@/types';

const emptyForm: ListingFormValues = {
  categoryID: '',
  subCategoryID: '',
  name: '',
  description: '',
  price: '',
  currency: 'USD',
  condition: '',
  negotiable: false,
  contactInfo: '',
  location: '',
  lat: '',
  long: '',
  customFields: {},
};

/** A complete listing written the way a real Arabic seller would write it. */
const arabicListing: ListingFormValues = {
  ...emptyForm,
  categoryID: 'cat-1',
  subCategoryID: 'sub-1',
  name: 'آيفون 15 برو ماكس 256 غيغابايت',
  description: 'جهاز بحالة ممتازة، استعمال ٦ أشهر، مع العلبة والشاحن الأصلي.',
  price: '850',
  location: 'دمشق، المزة',
};

const context = (
  form: ListingFormValues,
  overrides: Partial<ValidationContext> = {},
): ValidationContext => ({
  form,
  imageCount: 1,
  hasSubCategories: true,
  categoryFields: [],
  ...overrides,
});

beforeAll(async () => {
  if (!i18n.isInitialized) await initI18n();
});

describe('listing validation', () => {
  it('accepts a complete Arabic listing', () => {
    expect(isValid(validateListing(context(arabicListing)))).toBe(true);
  });

  it('accepts a mixed Arabic and Latin title', () => {
    const form = {...arabicListing, name: 'iPhone 15 Pro آيفون'};
    expect(isValid(validateListing(context(form)))).toBe(true);
  });

  it('requires a category and subcategory', () => {
    const errors = validateListingStep(STEP.CATEGORY, context(emptyForm));
    expect(errors.categoryID?.key).toBe('sell.error.category');
    expect(errors.subCategoryID?.key).toBe('sell.error.subCategory');
  });

  it('does not demand a subcategory when the category has none', () => {
    const form = {...emptyForm, categoryID: 'cat-1'};
    const errors = validateListingStep(
      STEP.CATEGORY,
      context(form, {hasSubCategories: false}),
    );
    expect(isValid(errors)).toBe(true);
  });

  it('requires at least one photo', () => {
    const errors = validateListingStep(STEP.PHOTOS, context(arabicListing, {imageCount: 0}));
    expect(errors.images?.key).toBe('sell.error.images');
    expect(isValid(validateListingStep(STEP.PHOTOS, context(arabicListing)))).toBe(true);
  });

  it('measures Arabic titles by character count, not bytes', () => {
    // Three Arabic letters is a valid short title; it is 6 bytes in UTF-8.
    const form = {...arabicListing, name: 'سجاد'};
    expect(isValid(validateListingStep(STEP.DETAILS, context(form)))).toBe(true);

    const tooShort = {...arabicListing, name: 'ا'};
    const errors = validateListingStep(STEP.DETAILS, context(tooShort));
    expect(errors.name?.key).toBe('sell.error.titleShort');
    expect(errors.name?.values).toEqual({count: MIN_TITLE_LENGTH});
  });

  it('rejects a whitespace-only title and description', () => {
    const form = {...arabicListing, name: '   ', description: '\n\t  '};
    const errors = validateListingStep(STEP.DETAILS, context(form));
    expect(errors.name?.key).toBe('sell.error.titleShort');
    expect(errors.description?.values).toEqual({count: MIN_DESCRIPTION_LENGTH});
  });

  it('rejects a missing, negative or non-numeric price', () => {
    for (const price of ['', '  ', '-5', 'مجاناً', 'abc']) {
      const errors = validateListingStep(STEP.DETAILS, context({...arabicListing, price}));
      expect(errors.price?.key, `price=${price}`).toBe('sell.error.price');
    }
  });

  it('accepts a zero price, which means "free"', () => {
    const errors = validateListingStep(STEP.DETAILS, context({...arabicListing, price: '0'}));
    expect(errors.price).toBeUndefined();
  });

  it('requires a location', () => {
    const errors = validateListingStep(STEP.LOCATION, context({...arabicListing, location: ' '}));
    expect(errors.location?.key).toBe('sell.error.location');
  });

  it('enforces required category attributes and names them', () => {
    const field = {
      id: 'f1',
      categoryID: 'cat-1',
      name: 'brand',
      label: 'Brand',
      ar_label: 'الماركة',
      ar_name: null,
      type: 'text',
      required: true,
      options: null,
      ar_options: null,
    } as CategoryField;

    const errors = validateListingStep(
      STEP.ATTRIBUTES,
      context(arabicListing, {
        categoryFields: [field],
        fieldLabel: f => f.ar_label ?? f.label,
      }),
    );
    expect(errors['custom.brand']?.key).toBe('sell.error.customRequired');
    expect(errors['custom.brand']?.values).toEqual({field: 'الماركة'});
  });

  it('ignores optional category attributes', () => {
    const field = {
      id: 'f2',
      categoryID: 'cat-1',
      name: 'colour',
      label: 'Colour',
      ar_label: 'اللون',
      ar_name: null,
      type: 'text',
      required: false,
      options: null,
      ar_options: null,
    } as CategoryField;

    expect(
      isValid(validateListingStep(STEP.ATTRIBUTES, context(arabicListing, {categoryFields: [field]}))),
    ).toBe(true);
  });
});

describe('validation messages', () => {
  it('reads naturally in Arabic', async () => {
    await changeLanguage('ar');
    const errors = validateListing(context(emptyForm, {imageCount: 0}));

    const messages = Object.values(errors).map(error => i18n.t(error.key, error.values));
    expect(messages).toContain('اختر القسم.');
    expect(messages).toContain('أضف صورة واحدة على الأقل.');
    expect(messages).toContain('أدخل سعراً صالحاً.');
    // No raw keys and no English left in the Arabic output.
    messages.forEach(message => {
      expect(message).not.toMatch(/sell\.error/);
      expect(message).not.toMatch(/[A-Za-z]{4}/);
    });
  });

  it('reads naturally in English', async () => {
    await changeLanguage('en');
    const errors = validateListing(context(emptyForm, {imageCount: 0}));
    const messages = Object.values(errors).map(error => i18n.t(error.key, error.values));

    expect(messages).toContain('Choose a category.');
    expect(messages).toContain('Add at least one photo.');
    expect(messages).toContain('The title needs at least 3 characters.');
    messages.forEach(message => expect(message).not.toMatch(/sell\.error/));
  });
});
