import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Link, useNavigate, useParams} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {useSeo} from '@/hooks/useSeo';
import {useAuth} from '@/lib/auth/AuthContext';
import {useCategories, useSubCategories} from '@/hooks/useCategories';
import {useToast} from '@/components/ui/ToastProvider';
import {
  createProduct,
  deleteProductImage,
  fetchProduct,
  updateProduct,
  type ProductInput,
} from '@/lib/api/products';
import {errorMessage} from '@/lib/api/errorMessages';
import {localizedField} from '@/lib/i18n';
import {
  SUPPORTED_CURRENCIES,
  formatPrice,
  listingPath,
  mediaUrl,
  parseCustomFields,
} from '@/lib/format';
import {CONDITION} from '@/lib/config';
import {MAX_IMAGES, prepareImageForUpload, validateImageFile} from '@/lib/images';
import {
  Button,
  Field,
  Input,
  LoadingState,
  Modal,
  Select,
  Textarea,
} from '@/components/ui';
import {PasswordInput} from '@/components/ui/PasswordInput';
import {
  isValid,
  validateListing,
  validateListingStep,
  type ListingErrors,
  type ListingFormValues,
} from '@/lib/listingForm';
import type {CategoryField} from '@/types';
import './sell.css';

const DRAFT_KEY = 'souqna.sellDraft';

interface DraftImage {
  id: string;
  file?: File;
  previewUrl: string;
  /** Set for images already stored on the listing (edit mode). */
  remoteId?: string;
}

type SellForm = ListingFormValues;

const EMPTY_FORM: SellForm = {
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

const STEPS = [
  'sell.stepCategory',
  'sell.stepPhotos',
  'sell.stepDetails',
  'sell.stepAttributes',
  'sell.stepLocation',
  'sell.stepPreview',
];

/**
 * Multi-step listing composer, used for both creating and editing.
 *
 * Everything the user types is mirrored into localStorage between steps, so a
 * refresh, an accidental back navigation or a dropped connection never loses
 * the listing. Images are held in memory (files cannot be serialised) and the
 * restore notice says so.
 */
const SellPage = () => {
  const {t, i18n} = useTranslation();
  const navigate = useNavigate();
  const {listingId} = useParams();
  const queryClient = useQueryClient();
  const {show} = useToast();
  const {user, isSeller, becomeSeller} = useAuth();

  const isEditing = Boolean(listingId);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<SellForm>(EMPTY_FORM);
  const [images, setImages] = useState<DraftImage[]>([]);
  const [errors, setErrors] = useState<ListingErrors>({});
  const [draftRestored, setDraftRestored] = useState(false);
  const [publishedId, setPublishedId] = useState<string | null>(null);
  const [sellerModalOpen, setSellerModalOpen] = useState(false);
  const [sellerPassword, setSellerPassword] = useState('');
  const [sellerType, setSellerType] = useState<1 | 2>(1);
  const [sellerError, setSellerError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const [locating, setLocating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {categories} = useCategories();
  const {subCategories} = useSubCategories(form.categoryID || null);

  const categoryFields: CategoryField[] = useMemo(() => {
    const category = categories.find(entry => entry.id === form.categoryID);
    return Array.isArray(category?.fields) ? category!.fields! : [];
  }, [categories, form.categoryID]);

  useSeo({
    title: isEditing ? t('sell.editListing') : t('sell.title'),
    canonicalPath: '/sell',
    noIndex: true,
  });

  const existing = useQuery({
    queryKey: ['product', listingId],
    queryFn: () => fetchProduct(listingId as string),
    enabled: isEditing,
  });

  // Prefill when editing.
  useEffect(() => {
    const product = existing.data;
    if (!product) return;

    setForm({
      categoryID: product.categoryID ?? '',
      subCategoryID: product.subCategoryID ?? '',
      name: product.name ?? '',
      description: product.description ?? '',
      price: String(product.price ?? ''),
      currency: product.currency ?? 'USD',
      condition: product.condition ? String(product.condition) : '',
      negotiable: Boolean(product.negotiable),
      contactInfo: product.contactInfo ?? '',
      location: product.location ?? '',
      lat: product.lat ? String(product.lat) : '',
      long: product.long ? String(product.long) : '',
      customFields: parseCustomFields(product.custom_fields).reduce<Record<string, string>>(
        (accumulator, field) => {
          accumulator[field.name] = field.value;
          return accumulator;
        },
        {},
      ),
    });

    setImages(
      (product.images ?? []).map(image => ({
        id: image.id,
        remoteId: image.id,
        previewUrl: mediaUrl(image.path) ?? '',
      })),
    );
  }, [existing.data]);

  // Restore an unfinished draft (create mode only).
  useEffect(() => {
    if (isEditing) return;
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {form?: SellForm; step?: number};
      if (parsed?.form && parsed.form.name?.trim()) {
        setForm({...EMPTY_FORM, ...parsed.form});
        setStep(Math.min(parsed.step ?? 0, STEPS.length - 1));
        setDraftRestored(true);
      }
    } catch {
      /* corrupted draft — start clean */
    }
  }, [isEditing]);

  // Persist the draft as the user works.
  useEffect(() => {
    if (isEditing || publishedId) return;
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({form, step}));
    } catch {
      /* storage unavailable */
    }
  }, [form, step, isEditing, publishedId]);

  // Default the contact number to the account's phone.
  useEffect(() => {
    if (!form.contactInfo && user?.phone) {
      setForm(current => ({...current, contactInfo: user.phone as string}));
    }
  }, [user?.phone, form.contactInfo]);

  useEffect(
    () => () => {
      images.forEach(image => {
        if (image.file) URL.revokeObjectURL(image.previewUrl);
      });
    },
    // Revoke object URLs only when leaving the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const update = <K extends keyof SellForm>(key: K, value: SellForm[K]) => {
    setForm(current => ({...current, [key]: value}));
    setErrors(current => {
      if (!current[key as string]) return current;
      const next = {...current};
      delete next[key as string];
      return next;
    });
  };

  const addFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList?.length) return;
      const room = MAX_IMAGES - images.length;
      if (room <= 0) {
        show(t('sell.photosHint', {max: MAX_IMAGES}), 'error');
        return;
      }

      const accepted: DraftImage[] = [];
      for (const file of Array.from(fileList).slice(0, room)) {
        const invalid = validateImageFile(file);
        if (invalid) {
          show(`${file.name}: ${t('common.errorBody')}`, 'error');
          continue;
        }
        const prepared = await prepareImageForUpload(file);
        accepted.push({
          id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
          file: prepared,
          previewUrl: URL.createObjectURL(prepared),
        });
      }

      if (accepted.length) setImages(current => [...current, ...accepted]);
    },
    [images.length, show, t],
  );

  const removeImage = async (image: DraftImage) => {
    if (image.remoteId && isEditing) {
      try {
        await deleteProductImage(image.remoteId);
      } catch (error) {
        show(errorMessage(error), 'error');
        return;
      }
    }
    if (image.file) URL.revokeObjectURL(image.previewUrl);
    setImages(current => current.filter(entry => entry.id !== image.id));
  };

  const moveImage = (index: number, delta: number) => {
    setImages(current => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const detectLocation = () => {
    if (!navigator.geolocation) {
      show(t('search.locatingError'), 'error');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      position => {
        setLocating(false);
        setForm(current => ({
          ...current,
          lat: String(position.coords.latitude),
          long: String(position.coords.longitude),
        }));
      },
      () => {
        setLocating(false);
        show(t('search.locatingError'), 'error');
      },
      {timeout: 10000},
    );
  };

  /** Translates a field error into the active language for display. */
  const errorText = (field: string): string | undefined => {
    const error = errors[field];
    return error ? t(error.key, error.values) : undefined;
  };

  const validationContext = () => ({
    form,
    imageCount: images.length,
    hasSubCategories: subCategories.length > 0,
    categoryFields,
    fieldLabel: (field: CategoryField) =>
      (i18n.language === 'ar' && field.ar_label ? field.ar_label : field.label) ||
      field.name,
  });

  const validateStep = (index: number): boolean => {
    const next = validateListingStep(index, validationContext());
    setErrors(next);
    return isValid(next);
  };

  const buildInput = (): ProductInput => ({
    name: form.name.trim(),
    description: form.description.trim(),
    price: String(Math.round(Number(form.price) || 0)),
    currency: form.currency,
    categoryID: form.categoryID,
    subCategoryID: form.subCategoryID,
    contactInfo: form.contactInfo.trim(),
    location: form.location.trim(),
    lat: form.lat,
    long: form.long,
    condition: form.condition ? Number(form.condition) : null,
    negotiable: form.negotiable,
    customFields: categoryFields
      .map(field => ({
        name: field.name,
        value: form.customFields[field.name] ?? '',
        ar_name: field.ar_name ?? undefined,
      }))
      .filter(entry => entry.value !== ''),
    images: images.filter(image => image.file).map(image => image.file as File),
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const input = buildInput();
      return isEditing
        ? updateProduct(listingId as string, input)
        : createProduct(input);
    },
    onSuccess: product => {
      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* storage unavailable */
      }
      void queryClient.invalidateQueries({queryKey: ['products']});
      void queryClient.invalidateQueries({queryKey: ['my-products']});

      if (isEditing) {
        void queryClient.invalidateQueries({queryKey: ['product', listingId]});
        show(t('profile.saved'), 'success');
        navigate('/profile/listings');
        return;
      }

      setPublishedId(product?.id ?? null);
    },
    onError: error => {
      show(errorMessage(error), 'error');
    },
  });

  const confirmSellerSwitch = async () => {
    setSwitching(true);
    setSellerError(null);
    try {
      await becomeSeller({password: sellerPassword || undefined, sellerType});
      setSellerModalOpen(false);
      setSellerPassword('');
    } catch (error) {
      setSellerError(errorMessage(error));
    } finally {
      setSwitching(false);
    }
  };

  // ---- Seller gate -------------------------------------------------------
  if (!isSeller) {
    return (
      <div className="container page">
        <div className="card card--pad sell-gate">
          <h1>{t('sell.becomeSellerTitle')}</h1>
          <p className="muted">{t('sell.becomeSellerBody')}</p>
          <Button variant="primary" size="lg" onClick={() => setSellerModalOpen(true)}>
            {t('sell.becomeSellerConfirm')}
          </Button>
        </div>

        <Modal
          open={sellerModalOpen}
          onClose={() => setSellerModalOpen(false)}
          title={t('sell.becomeSellerTitle')}
          actions={
            <>
              <Button variant="ghost" onClick={() => setSellerModalOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button variant="primary" loading={switching} onClick={confirmSellerSwitch}>
                {t('sell.becomeSellerConfirm')}
              </Button>
            </>
          }>
          <div className="stack">
            {sellerError ? (
              <p className="auth-alert" role="alert">
                {sellerError}
              </p>
            ) : null}

            <Field label={t('sell.sellerTypeLabel')} htmlFor="seller-type">
              <Select
                id="seller-type"
                value={sellerType}
                onChange={event => setSellerType(Number(event.target.value) as 1 | 2)}>
                <option value={1}>{t('sell.sellerTypePrivate')}</option>
                <option value={2}>{t('sell.sellerTypeBusiness')}</option>
              </Select>
            </Field>

            {user?.provider === 'email' || !user?.provider ? (
              <Field
                label={t('sell.becomeSellerPassword')}
                htmlFor="seller-password"
                required>
                <PasswordInput
                  id="seller-password"
                  autoComplete="current-password"
                  value={sellerPassword}
                  onChange={event => setSellerPassword(event.target.value)}
                />
              </Field>
            ) : null}
          </div>
        </Modal>
      </div>
    );
  }

  if (isEditing && existing.isLoading) return <LoadingState />;

  // ---- Success screen ----------------------------------------------------
  if (publishedId) {
    return (
      <div className="container page">
        <div className="card card--pad sell-success">
          <span className="sell-success__icon" aria-hidden="true">
            🎉
          </span>
          <h1>{t('sell.successTitle')}</h1>
          <p className="muted">{t('sell.successBody')}</p>
          <div className="row-wrap" style={{justifyContent: 'center'}}>
            <Link
              className="btn btn--primary"
              to={listingPath({id: publishedId, name: form.name, location: form.location})}>
              {t('sell.viewListing')}
            </Link>
            <Link className="btn btn--secondary" to={`/sell/${publishedId}`}>
              {t('sell.editListing')}
            </Link>
            <Button
              variant="ghost"
              onClick={() => {
                setPublishedId(null);
                setForm(EMPTY_FORM);
                setImages([]);
                setStep(0);
              }}>
              {t('sell.postAnother')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isLastStep = step === STEPS.length - 1;

  return (
    <div className="container page sell-page">
      <h1>{isEditing ? t('sell.editListing') : t('sell.title')}</h1>

      <ol className="sell-steps" aria-label={t('sell.step', {current: step + 1, total: STEPS.length})}>
        {STEPS.map((key, index) => (
          <li
            key={key}
            className={`sell-steps__item${index === step ? ' sell-steps__item--active' : ''}${
              index < step ? ' sell-steps__item--done' : ''
            }`}
            aria-current={index === step ? 'step' : undefined}>
            <span className="sell-steps__index">{index + 1}</span>
            <span className="sell-steps__label">{t(key)}</span>
          </li>
        ))}
      </ol>

      {draftRestored && !isEditing ? (
        <div className="sell-draft-notice">
          <span>{t('sell.draftRestored')}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setForm(EMPTY_FORM);
              setImages([]);
              setStep(0);
              setDraftRestored(false);
              try {
                window.localStorage.removeItem(DRAFT_KEY);
              } catch {
                /* storage unavailable */
              }
            }}>
            {t('sell.discardDraft')}
          </Button>
        </div>
      ) : null}

      <div className="card card--pad sell-panel">
        {/* Step 1 — category */}
        {step === 0 ? (
          <div className="stack">
            <Field
              label={t('sell.chooseCategory')}
              htmlFor="sell-category"
              error={errorText('categoryID')}
              required>
              <Select
                id="sell-category"
                value={form.categoryID}
                onChange={event => {
                  update('categoryID', event.target.value);
                  update('subCategoryID', '');
                }}>
                <option value="">—</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {localizedField(category, 'name', i18n.language)}
                  </option>
                ))}
              </Select>
            </Field>

            {form.categoryID && subCategories.length ? (
              <Field
                label={t('sell.chooseSubCategory')}
                htmlFor="sell-subcategory"
                error={errorText('subCategoryID')}
                required>
                <Select
                  id="sell-subcategory"
                  value={form.subCategoryID}
                  onChange={event => update('subCategoryID', event.target.value)}>
                  <option value="">—</option>
                  {subCategories.map(subCategory => (
                    <option key={subCategory.id} value={subCategory.id}>
                      {localizedField(subCategory, 'name', i18n.language)}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </div>
        ) : null}

        {/* Step 2 — photos */}
        {step === 1 ? (
          <div className="stack">
            <p className="field__hint">{t('sell.photosHint', {max: MAX_IMAGES})}</p>

            <button
              type="button"
              className="dropzone"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={event => event.preventDefault()}
              onDrop={event => {
                event.preventDefault();
                void addFiles(event.dataTransfer.files);
              }}>
              <span aria-hidden="true">📷</span>
              <span>{t('sell.dropzone')}</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={event => {
                void addFiles(event.target.files);
                event.target.value = '';
              }}
            />

            {errors.images ? (
              <span className="field__error" role="alert">
                {errorText('images')}
              </span>
            ) : null}

            {images.length ? (
              <ul className="photo-grid">
                {images.map((image, index) => (
                  <li key={image.id} className="photo-grid__item">
                    <img src={image.previewUrl} alt="" loading="lazy" />
                    {index === 0 ? (
                      <span className="photo-grid__cover">{t('sell.coverPhoto')}</span>
                    ) : null}
                    <div className="photo-grid__actions">
                      <button
                        type="button"
                        onClick={() => moveImage(index, -1)}
                        disabled={index === 0}
                        aria-label={t('sell.movePhotoLeft')}>
                        ◀
                      </button>
                      <button
                        type="button"
                        onClick={() => moveImage(index, 1)}
                        disabled={index === images.length - 1}
                        aria-label={t('sell.movePhotoRight')}>
                        ▶
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeImage(image)}
                        aria-label={t('sell.removePhoto')}>
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {/* Step 3 — basics */}
        {step === 2 ? (
          <div className="stack">
            <Field label={t('sell.titleLabel')} htmlFor="sell-name" error={errorText('name')} required>
              <Input
                id="sell-name"
                value={form.name}
                maxLength={255}
                placeholder={t('sell.titlePlaceholder')}
                aria-invalid={Boolean(errors.name)}
                onChange={event => update('name', event.target.value)}
              />
            </Field>

            <Field
              label={t('sell.descriptionLabel')}
              htmlFor="sell-description"
              error={errorText('description')}
              required>
              <Textarea
                id="sell-description"
                value={form.description}
                placeholder={t('sell.descriptionPlaceholder')}
                aria-invalid={Boolean(errors.description)}
                onChange={event => update('description', event.target.value)}
              />
            </Field>

            <div className="sell-row">
              <Field label={t('sell.priceLabel')} htmlFor="sell-price" error={errorText('price')} required>
                <Input
                  id="sell-price"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={form.price}
                  aria-invalid={Boolean(errors.price)}
                  onChange={event => update('price', event.target.value)}
                />
              </Field>

              <Field label={t('sell.currencyLabel')} htmlFor="sell-currency">
                <Select
                  id="sell-currency"
                  value={form.currency}
                  onChange={event => update('currency', event.target.value)}>
                  {SUPPORTED_CURRENCIES.map(currency => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label={t('sell.conditionLabel')} htmlFor="sell-condition" optional>
              <Select
                id="sell-condition"
                value={form.condition}
                onChange={event => update('condition', event.target.value)}>
                <option value="">—</option>
                <option value={CONDITION.NEW}>{t('listing.new')}</option>
                <option value={CONDITION.USED}>{t('listing.used')}</option>
              </Select>
            </Field>

            <label className="checkbox">
              <input
                type="checkbox"
                checked={form.negotiable}
                onChange={event => update('negotiable', event.target.checked)}
              />
              {t('sell.negotiableLabel')}
            </label>

            <Field label={t('sell.contactLabel')} htmlFor="sell-contact" optional>
              <Input
                id="sell-contact"
                type="tel"
                inputMode="tel"
                value={form.contactInfo}
                onChange={event => update('contactInfo', event.target.value)}
              />
            </Field>
          </div>
        ) : null}

        {/* Step 4 — category attributes */}
        {step === 3 ? (
          <div className="stack">
            {categoryFields.length ? (
              categoryFields.map(field => {
                const label =
                  i18n.language === 'ar' && field.ar_label ? field.ar_label : field.label;
                const options = (
                  (i18n.language === 'ar' && field.ar_options
                    ? field.ar_options
                    : field.options) ?? ''
                )
                  .split(',')
                  .map(option => option.trim())
                  .filter(Boolean);
                const value = form.customFields[field.name] ?? '';
                const error = errorText(`custom.${field.name}`);
                const id = `custom-${field.name}`;

                const setValue = (next: string) =>
                  setForm(current => ({
                    ...current,
                    customFields: {...current.customFields, [field.name]: next},
                  }));

                return (
                  <Field
                    key={field.id}
                    label={label}
                    htmlFor={id}
                    error={error}
                    required={Boolean(field.required)}>
                    {field.type === 'select' || field.type === 'radio' ? (
                      <Select id={id} value={value} onChange={event => setValue(event.target.value)}>
                        <option value="">—</option>
                        {options.map(option => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </Select>
                    ) : field.type === 'textarea' ? (
                      <Textarea
                        id={id}
                        value={value}
                        onChange={event => setValue(event.target.value)}
                      />
                    ) : field.type === 'checkbox' ? (
                      <label className="checkbox">
                        <input
                          id={id}
                          type="checkbox"
                          checked={value === '1'}
                          onChange={event => setValue(event.target.checked ? '1' : '')}
                        />
                        {label}
                      </label>
                    ) : (
                      <Input
                        id={id}
                        type={field.type === 'number' ? 'number' : 'text'}
                        value={value}
                        onChange={event => setValue(event.target.value)}
                      />
                    )}
                  </Field>
                );
              })
            ) : (
              <p className="muted">{t('sell.previewHint')}</p>
            )}
          </div>
        ) : null}

        {/* Step 5 — location */}
        {step === 4 ? (
          <div className="stack">
            <Field
              label={t('sell.locationLabel')}
              htmlFor="sell-location"
              hint={t('sell.locationHint')}
              error={errorText('location')}
              required>
              <Input
                id="sell-location"
                value={form.location}
                placeholder={t('sell.locationPlaceholder')}
                aria-invalid={Boolean(errors.location)}
                onChange={event => update('location', event.target.value)}
              />
            </Field>

            <Button variant="secondary" loading={locating} onClick={detectLocation}>
              📍 {t('sell.detectLocation')}
            </Button>

            {form.lat && form.long ? (
              <p className="muted small">
                {Number(form.lat).toFixed(4)}, {Number(form.long).toFixed(4)}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Step 6 — preview */}
        {step === 5 ? (
          <div className="stack">
            <p className="field__hint">{t('sell.previewHint')}</p>
            <div className="sell-preview">
              {images[0] ? (
                <img className="sell-preview__image" src={images[0].previewUrl} alt="" />
              ) : null}
              <div>
                <h2>{form.name}</h2>
                <p className="listing-detail__price">
                  {formatPrice(form.price, form.currency) ??
                    t('listing.priceOnRequest')}
                </p>
                <p className="muted small">{form.location}</p>
                <p className="listing-detail__description">{form.description}</p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="sell-actions">
          <Button
            variant="ghost"
            disabled={step === 0 || mutation.isPending}
            onClick={() => setStep(current => Math.max(0, current - 1))}>
            {t('sell.back')}
          </Button>

          {isLastStep ? (
            <Button
              variant="primary"
              size="lg"
              loading={mutation.isPending}
              onClick={() => {
                const all = validateListing(validationContext());
                setErrors(all);
                if (!isValid(all)) {
                  show(t('sell.error.fixFields'), 'error');
                  return;
                }
                mutation.mutate();
              }}>
              {mutation.isPending
                ? t('sell.publishing')
                : isEditing
                  ? t('sell.saveChanges')
                  : t('sell.publish')}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                if (validateStep(step)) setStep(current => current + 1);
              }}>
              {t('sell.next')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SellPage;
