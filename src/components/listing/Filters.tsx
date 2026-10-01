import {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useCategories, useSubCategories} from '@/hooks/useCategories';
import {localizedField} from '@/lib/i18n';
import {CONDITION} from '@/lib/config';
import {SUPPORTED_CURRENCIES} from '@/lib/format';
import {fieldOptions} from '@/lib/fieldOptions';
import {Button, Field, Input, Select} from '@/components/ui';
import {PlaceCombobox} from '@/components/location/PlaceCombobox';
import type {ProductFilters} from '@/types';

export interface FiltersProps {
  value: ProductFilters;
  onChange: (next: ProductFilters) => void;
  onClear: () => void;
}

/**
 * Marketplace filter panel.
 *
 * Only filters the platform actually stores are offered — category,
 * subcategory, price, condition and location/radius. Category-specific
 * attributes come from the backend `fields` table; when a category has none
 * configured, nothing extra is rendered rather than showing dead controls.
 */
export const Filters = ({value, onChange, onClear}: FiltersProps) => {
  const {t, i18n} = useTranslation();
  const {categories} = useCategories();
  const {subCategories} = useSubCategories(value.categoryID);

  const categoryFields = (categories.find(item => item.id === value.categoryID)?.fields ?? []).filter(
    field => field.type === 'select' || field.type === 'radio',
  );

  const [minPrice, setMinPrice] = useState(value.minPrice?.toString() ?? '');
  const [maxPrice, setMaxPrice] = useState(value.maxPrice?.toString() ?? '');
  const [location, setLocation] = useState(value.location ?? '');
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    setMinPrice(value.minPrice?.toString() ?? '');
    setMaxPrice(value.maxPrice?.toString() ?? '');
    setLocation(value.location ?? '');
  }, [value.minPrice, value.maxPrice, value.location]);

  const patch = (next: Partial<ProductFilters>) =>
    onChange({...value, ...next, page: 1});

  const commitPrice = () => {
    const min = minPrice.trim() ? Number(minPrice) : undefined;
    const max = maxPrice.trim() ? Number(maxPrice) : undefined;
    const minValue = Number.isFinite(min as number) ? (min as number) : undefined;
    const maxValue = Number.isFinite(max as number) ? (max as number) : undefined;
    patch({
      minPrice: minValue,
      maxPrice: maxValue,
      // A price bound only means something inside one currency (100,000 SYP is
      // not 100,000 USD), so pick one rather than compare across currencies.
      currency:
        value.currency ?? (minValue !== undefined || maxValue !== undefined ? 'USD' : undefined),
    });
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationError(t('search.locatingError'));
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      position => {
        setLocating(false);
        patch({
          lat: position.coords.latitude,
          long: position.coords.longitude,
          radius: value.radius ?? 50,
        });
      },
      () => {
        setLocating(false);
        setLocationError(t('search.locatingError'));
      },
      {timeout: 10000, maximumAge: 300000},
    );
  };

  return (
    <div className="filters stack">
      <Field label={t('search.category')} htmlFor="filter-category">
        <Select
          id="filter-category"
          value={value.categoryID ?? ''}
          onChange={event =>
            patch({categoryID: event.target.value || undefined, subCategoryID: undefined, attrs: undefined})
          }>
          <option value="">{t('search.allCategories')}</option>
          {categories.map(category => (
            <option key={category.id} value={category.id}>
              {localizedField(category, 'name', i18n.language)}
            </option>
          ))}
        </Select>
      </Field>

      {value.categoryID && subCategories.length ? (
        <Field label={t('search.subCategory')} htmlFor="filter-subcategory">
          <Select
            id="filter-subcategory"
            value={value.subCategoryID ?? ''}
            onChange={event => patch({subCategoryID: event.target.value || undefined})}>
            <option value="">{t('search.allSubCategories')}</option>
            {subCategories.map(subCategory => (
              <option key={subCategory.id} value={subCategory.id}>
                {localizedField(subCategory, 'name', i18n.language)}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <fieldset className="filters__fieldset">
        <legend className="field__label">{t('search.price')}</legend>
        <div className="filters__row">
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            aria-label={t('search.minPrice')}
            placeholder={t('search.minPrice')}
            value={minPrice}
            onChange={event => setMinPrice(event.target.value)}
            onBlur={commitPrice}
          />
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            aria-label={t('search.maxPrice')}
            placeholder={t('search.maxPrice')}
            value={maxPrice}
            onChange={event => setMaxPrice(event.target.value)}
            onBlur={commitPrice}
          />
        </div>
        <Select
          aria-label={t('search.currency')}
          value={value.currency ?? ''}
          onChange={event => patch({currency: event.target.value || undefined})}>
          <option value="">{t('search.anyCurrency')}</option>
          {SUPPORTED_CURRENCIES.map(currency => (
            <option key={currency} value={currency}>
              {t(`search.currency_${currency}`)}
            </option>
          ))}
        </Select>
      </fieldset>

      <Field label={t('search.condition')} htmlFor="filter-condition">
        <Select
          id="filter-condition"
          value={value.condition ?? ''}
          onChange={event =>
            patch({condition: event.target.value ? Number(event.target.value) : undefined})
          }>
          <option value="">{t('search.anyCondition')}</option>
          <option value={CONDITION.NEW}>{t('listing.new')}</option>
          <option value={CONDITION.USED}>{t('listing.used')}</option>
        </Select>
      </Field>

      {categoryFields.map(field => {
        const options = fieldOptions(field, i18n.language);
        if (!options.length) return null;
        const id = `filter-attr-${field.name}`;
        return (
          <Field
            key={field.id}
            label={localizedField(field, 'label', i18n.language)}
            htmlFor={id}>
            <Select
              id={id}
              value={value.attrs?.[field.name] ?? ''}
              onChange={event => {
                const next = {...(value.attrs ?? {})};
                if (event.target.value) next[field.name] = event.target.value;
                else delete next[field.name];
                patch({attrs: Object.keys(next).length ? next : undefined});
              }}>
              <option value="">{t('search.anyValue')}</option>
              {options.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        );
      })}

      <Field label={t('search.location')} htmlFor="filter-location" error={locationError}>
        <PlaceCombobox
          id="filter-location"
          value={location}
          placeholder={t('home.locationPlaceholder')}
          includeGovernorates
          onValueChange={setLocation}
          onSelect={place => {
            setLocation(place.name);
            patch({location: place.name});
          }}
          onEnterWithoutSelection={() => patch({location: location.trim() || undefined})}
          onBlurCommit={() => patch({location: location.trim() || undefined})}
        />
      </Field>

      <Button variant="secondary" onClick={useMyLocation} loading={locating}>
        📍 {t('search.useMyLocation')}
      </Button>

      {typeof value.lat === 'number' ? (
        <Field label={t('search.radius')} htmlFor="filter-radius">
          <input
            id="filter-radius"
            type="range"
            min={1}
            max={200}
            step={1}
            value={value.radius ?? 50}
            onChange={event => patch({radius: Number(event.target.value)})}
          />
          <span className="field__hint">
            {t('search.radiusValue', {count: value.radius ?? 50})}
          </span>
        </Field>
      ) : null}

      <Button variant="ghost" onClick={onClear}>
        {t('search.clearFilters')}
      </Button>
    </div>
  );
};
