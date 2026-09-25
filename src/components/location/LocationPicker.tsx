import {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Button, Field, Input, Select} from '@/components/ui';
import {
  composeLocation,
  listGovernorates,
  parseLocation,
  reverseGeocode,
  type Governorate,
  type LocationParts,
  type PlaceLanguage,
  type PlaceSuggestion,
} from '@/lib/places/places';
import {PlaceCombobox} from './PlaceCombobox';
import './location.css';

export interface LocationValue {
  location: string;
  lat: string;
  long: string;
}

interface LocationPickerProps {
  value: LocationValue;
  onChange: (next: LocationValue) => void;
  error?: string | null;
  idPrefix?: string;
}

/**
 * Governorate → city / district → optional landmark, for a listing.
 *
 * The result is written back as the same `location` string (+ lat/long) the
 * backend and the mobile app already use, so listings stay interchangeable
 * between clients. An existing value is parsed on mount; whatever cannot be
 * classified is preserved as the landmark line rather than dropped.
 */
export const LocationPicker = ({
  value,
  onChange,
  error,
  idPrefix = 'location',
}: LocationPickerProps) => {
  const {t, i18n} = useTranslation();
  const language: PlaceLanguage = i18n.language?.startsWith('ar') ? 'ar' : 'en';

  const [governorates, setGovernorates] = useState<Governorate[]>([]);
  const [parts, setParts] = useState<LocationParts>({area: '', detail: ''});
  const [areaText, setAreaText] = useState('');
  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  // The last string this component emitted, so external edits can be told apart.
  const emitted = useRef<string | null>(null);

  // Parse the incoming value once the gazetteer is available, and again only
  // if the parent replaces it with something this component did not produce
  // (e.g. an edit form finishing its load).
  useEffect(() => {
    if (ready && emitted.current === value.location) return undefined;
    let cancelled = false;
    void Promise.all([listGovernorates(), parseLocation(value.location)]).then(
      ([list, parsed]) => {
        if (cancelled) return;
        setGovernorates(list);
        setParts(parsed);
        setAreaText(parsed.area);
        emitted.current = value.location;
        setReady(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [value.location, ready]);

  const emit = (next: LocationParts, coords?: {lat: number; lon: number} | null) => {
    const location = composeLocation(next, governorates);
    emitted.current = location;
    onChange({
      location,
      lat: coords ? String(coords.lat) : coords === null ? '' : value.lat,
      long: coords ? String(coords.lon) : coords === null ? '' : value.long,
    });
  };

  const setGovernorate = (id: string) => {
    const governorate = governorates.find(item => item.id === id);
    const next: LocationParts = {governorateId: id || undefined, area: '', detail: parts.detail};
    setParts(next);
    setAreaText('');
    // A governorate's centre is a coarse but honest fallback for radius search.
    emit(next, governorate ? {lat: governorate.lat, lon: governorate.lon} : null);
  };

  const selectPlace = (place: PlaceSuggestion) => {
    const next: LocationParts = {
      governorateId: place.governorateId ?? parts.governorateId,
      area: place.source === 'governorate' ? '' : place.name,
      detail: parts.detail,
    };
    setParts(next);
    setAreaText(next.area);
    emit(next, {lat: place.lat, lon: place.lon});
  };

  const changeArea = (text: string) => {
    setAreaText(text);
    // Free text is allowed: a village or district we do not know is still valid.
    const next = {...parts, area: text};
    setParts(next);
    emit(next);
  };

  const changeDetail = (text: string) => {
    const next = {...parts, detail: text};
    setParts(next);
    emit(next);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setLocateError(t('search.locatingError'));
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      async position => {
        const {latitude, longitude} = position.coords;
        const resolved = await reverseGeocode(latitude, longitude, language);
        setLocating(false);
        const next: LocationParts = {
          governorateId: resolved?.governorateId ?? parts.governorateId,
          area: resolved?.area ?? parts.area,
          detail: parts.detail,
        };
        setParts(next);
        setAreaText(next.area);
        emit(next, {lat: latitude, lon: longitude});
      },
      () => {
        setLocating(false);
        setLocateError(t('search.locatingError'));
      },
      {timeout: 10000, maximumAge: 60000},
    );
  };

  const governorateId = `${idPrefix}-governorate`;
  const areaId = `${idPrefix}-area`;
  const detailId = `${idPrefix}-detail`;

  return (
    <div className="location-picker">
      <div className="location-picker__row">
        <Field label={t('location.governorate')} htmlFor={governorateId} required error={error}>
          <Select
            id={governorateId}
            value={parts.governorateId ?? ''}
            aria-invalid={Boolean(error) && !parts.governorateId}
            disabled={!ready}
            onChange={event => setGovernorate(event.target.value)}>
            <option value="">{t('location.chooseGovernorate')}</option>
            {governorates.map(item => (
              <option key={item.id} value={item.id}>
                {language === 'en' && item.en ? item.en : item.ar}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t('location.area')} htmlFor={areaId} optional hint={t('location.areaHint')}>
          <PlaceCombobox
            id={areaId}
            value={areaText}
            governorateId={parts.governorateId}
            placeholder={t('location.areaPlaceholder')}
            disabled={!ready}
            onValueChange={changeArea}
            onSelect={selectPlace}
          />
        </Field>
      </div>

      <Field label={t('location.detail')} htmlFor={detailId} optional hint={t('location.detailHint')}>
        <Input
          id={detailId}
          value={parts.detail}
          maxLength={120}
          placeholder={t('location.detailPlaceholder')}
          disabled={!ready}
          onChange={event => changeDetail(event.target.value)}
        />
      </Field>

      <div>
        <Button variant="secondary" loading={locating} onClick={useMyLocation}>
          📍 {t('sell.detectLocation')}
        </Button>
        {locateError ? (
          <p className="field__error" role="alert">
            {locateError}
          </p>
        ) : null}
      </div>

      {value.location ? (
        <p className="location-picker__summary">
          <span>{t('location.selected')}:</span>
          <strong>{value.location}</strong>
        </p>
      ) : null}
    </div>
  );
};
