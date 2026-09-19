import {Link} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import '@/pages/import.css';

/** Small prompt for sellers who already have ads on Doushesh. Shown on the post-an-ad page. */
export const ImportCallout = () => {
  const {t} = useTranslation();
  return (
    <aside className="import-callout" aria-label={t('import.callout')}>
      <span>{t('import.callout')}</span>
      <Link className="btn btn--secondary btn--sm" to="/import">
        {t('import.calloutAction')}
      </Link>
    </aside>
  );
};
