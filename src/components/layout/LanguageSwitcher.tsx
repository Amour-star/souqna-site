import {useTranslation} from 'react-i18next';
import {SUPPORTED_LANGUAGES, changeLanguage, normalizeLanguage} from '@/lib/i18n';

/**
 * Language switcher.
 *
 * Labels are written in their own language (العربية / English) rather than
 * flags — a flag names a country, not a language, and Arabic is spoken across
 * many of them.
 *
 * Switching never navigates: the language is not part of the URL, so the user
 * stays exactly where they were, filters and scroll position included.
 */
export const LanguageSwitcher = ({
  variant = 'segmented',
}: {
  variant?: 'segmented' | 'menu';
}) => {
  const {t, i18n} = useTranslation();
  const active = normalizeLanguage(i18n.language);

  if (variant === 'menu') {
    return (
      <>
        <span className="menu__header">{t('profile.language')}</span>
        {SUPPORTED_LANGUAGES.map(language => (
          <button
            key={language.code}
            type="button"
            role="menuitemradio"
            aria-checked={active === language.code}
            className="menu__item"
            lang={language.code}
            onClick={() => void changeLanguage(language.code)}>
            {language.label}
            {active === language.code ? ' ✓' : ''}
          </button>
        ))}
      </>
    );
  }

  return (
    <div
      className="lang-switch"
      role="group"
      aria-label={t('profile.language')}>
      {SUPPORTED_LANGUAGES.map(language => (
        <button
          key={language.code}
          type="button"
          className="lang-switch__option"
          lang={language.code}
          aria-pressed={active === language.code}
          onClick={() => void changeLanguage(language.code)}>
          {language.label}
        </button>
      ))}
    </div>
  );
};
