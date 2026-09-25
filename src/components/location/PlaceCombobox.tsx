import {useEffect, useId, useRef, useState, type KeyboardEvent} from 'react';
import {useTranslation} from 'react-i18next';
import {
  searchLocalPlaces,
  searchNominatim,
  type PlaceLanguage,
  type PlaceSuggestion,
} from '@/lib/places/places';
import './location.css';

interface PlaceComboboxProps {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  onSelect: (place: PlaceSuggestion) => void;
  placeholder?: string;
  /** Restrict suggestions to one governorate. */
  governorateId?: string;
  /** Offer governorates as results as well as cities and districts. */
  includeGovernorates?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  /** Submit handler for the raw text, so Enter in a search form still searches. */
  onEnterWithoutSelection?: () => void;
  onBlurCommit?: () => void;
}

const MIN_LOCAL_CHARS = 1;
const MIN_REMOTE_CHARS = 3;

/**
 * Autocomplete over Syrian places. Suggestions as you type come only from the
 * local gazetteer (instant, prefix-aware, Arabic-normalised).
 *
 * OpenStreetMap Nominatim is queried only when the user explicitly asks for a
 * wider search: its public usage policy forbids search-as-you-type against the
 * shared servers, and a place missing from the gazetteer (a village, a street)
 * is the exception, not the rule.
 *
 * Implements the ARIA 1.2 combobox pattern: the input keeps focus and points
 * at the highlighted option with `aria-activedescendant`.
 */
export const PlaceCombobox = ({
  id,
  value,
  onValueChange,
  onSelect,
  placeholder,
  governorateId,
  includeGovernorates,
  disabled,
  invalid,
  onEnterWithoutSelection,
  onBlurCommit,
}: PlaceComboboxProps) => {
  const {t, i18n} = useTranslation();
  const language: PlaceLanguage = i18n.language?.startsWith('ar') ? 'ar' : 'en';
  const listId = useId();

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [local, setLocal] = useState<PlaceSuggestion[]>([]);
  const [remote, setRemote] = useState<PlaceSuggestion[]>([]);
  const [remoteTerm, setRemoteTerm] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // Suggestions only appear once the user has typed, never for a prefilled value.
  const touched = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const term = value.trim();

  useEffect(() => {
    let cancelled = false;
    if (!touched.current || term.length < MIN_LOCAL_CHARS) {
      setLocal([]);
      return undefined;
    }
    void searchLocalPlaces(term, {language, governorateId, includeGovernorates}).then(results => {
      if (!cancelled) setLocal(results);
    });
    return () => {
      cancelled = true;
    };
  }, [term, language, governorateId, includeGovernorates]);

  // Wider results belong to the term they were requested for; typing on discards them.
  useEffect(() => {
    abortRef.current?.abort();
    setRemote([]);
    setRemoteTerm(null);
    setSearching(false);
  }, [term, governorateId]);

  const searchMore = () => {
    if (term.length < MIN_REMOTE_CHARS || searching) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSearching(true);
    void searchNominatim(term, {language, governorateId, signal: controller.signal}).then(results => {
      if (controller.signal.aborted) return;
      setRemote(results);
      setRemoteTerm(term);
      setSearching(false);
    });
  };

  // Close when focus or a click leaves the widget.
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Local results first; remote ones only when they add something new.
  const seen = new Set(local.map(item => `${item.governorateId}|${item.name}`));
  const options = [
    ...local,
    ...remote.filter(item => !seen.has(`${item.governorateId}|${item.name}`)),
  ].slice(0, 9);

  const showList = open && touched.current && term.length > 0;
  // A final row offers the wider OpenStreetMap search; it is not a place, so it
  // sits after the options and takes the next keyboard index.
  const canSearchMore = term.length >= MIN_REMOTE_CHARS && remoteTerm !== term;
  const rowCount = options.length + (canSearchMore ? 1 : 0);

  const choose = (place: PlaceSuggestion) => {
    onSelect(place);
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive(current => (rowCount ? (current + 1) % rowCount : -1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActive(current => (rowCount ? (current <= 0 ? rowCount - 1 : current - 1) : -1));
    } else if (event.key === 'Enter') {
      if (showList && active >= 0 && options[active]) {
        event.preventDefault();
        choose(options[active]);
      } else if (showList && canSearchMore && active === options.length) {
        event.preventDefault();
        searchMore();
      } else if (onEnterWithoutSelection) {
        event.preventDefault();
        setOpen(false);
        onEnterWithoutSelection();
      }
    } else if (event.key === 'Escape') {
      if (open) {
        event.preventDefault();
        setOpen(false);
      }
    }
  };

  return (
    <div className="place-combobox" ref={rootRef}>
      <input
        id={id}
        className="input"
        type="text"
        role="combobox"
        autoComplete="off"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={invalid || undefined}
        aria-activedescendant={showList && active >= 0 && active < rowCount ? `${listId}-${active}` : undefined}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={event => {
          touched.current = true;
          onValueChange(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => {
          if (touched.current) setOpen(true);
        }}
        onBlur={onBlurCommit}
        onKeyDown={onKeyDown}
      />

      {showList ? (
        <ul className="place-combobox__list" id={listId} role="listbox" aria-label={t('location.suggestions')}>
          {options.map((option, index) => (
            <li
              key={option.key}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              className={`place-combobox__option${index === active ? ' is-active' : ''}`}
              // Keep focus on the input so the selection does not trigger blur handlers first.
              onMouseDown={event => event.preventDefault()}
              onClick={() => choose(option)}
              onMouseEnter={() => setActive(index)}>
              <span className="place-combobox__name">{option.name}</span>
              {option.context ? (
                <span className="place-combobox__context">{option.context}</span>
              ) : null}
            </li>
          ))}
          {canSearchMore ? (
            <li
              id={`${listId}-${options.length}`}
              role="option"
              aria-selected={active === options.length}
              className={`place-combobox__option place-combobox__more${
                active === options.length ? ' is-active' : ''
              }`}
              onMouseDown={event => event.preventDefault()}
              onClick={searchMore}
              onMouseEnter={() => setActive(options.length)}>
              {searching ? t('location.searching') : t('location.searchMore', {term})}
            </li>
          ) : null}
          {options.length === 0 && !canSearchMore ? (
            <li className="place-combobox__status" role="presentation">
              {searching ? t('location.searching') : t('location.noResults')}
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
};
