import {Link} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {STORE_LINKS, SUPPORT_EMAIL} from '@/lib/config';
import {useCategories} from '@/hooks/useCategories';
import {localizedField} from '@/lib/i18n';
import {LanguageSwitcher} from './LanguageSwitcher';

export const Footer = () => {
  const {t, i18n} = useTranslation();
  const {categories} = useCategories();

  return (
    <footer className="site-footer">
      <div className="container site-footer__grid">
        <div>
          <div className="site-footer__brand">
            <img src="/logo.png" alt="" width={32} height={32} />
            <span>Souqna</span>
          </div>
          <p className="muted small">{t('footer.aboutText')}</p>
          <div className="site-footer__stores">
            <a
              href={STORE_LINKS.android}
              target="_blank"
              rel="noreferrer noopener"
              title="Google Play"
              className="site-footer__store-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 6v12c0 .55.45 1 1 1h16c.55 0 1-.45 1-1V6c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1zm8 11l-4-5h8l-4 5zm8-9l-8 10-8-10h16z" />
              </svg>
            </a>
            <a
              href={STORE_LINKS.ios}
              target="_blank"
              rel="noreferrer noopener"
              title="App Store"
              className="site-footer__store-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 13.5c-.91 0-1.82.55-2.25 1.74h4.32c-.37-1.1-1.37-1.74-2.07-1.74zm-4.7 0c-.9 0-1.78.46-2.25 1.74h4.32c-.37-1.1-1.37-1.74-2.07-1.74zM18.5 12c1.93 0 3.5-1.57 3.5-3.5S20.43 5 18.5 5 15 6.57 15 8.5s1.57 3.5 3.5 3.5zm0-5c.83 0 1.5.67 1.5 1.5S19.33 10 18.5 10s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5zM5.5 12c1.93 0 3.5-1.57 3.5-3.5S7.43 5 5.5 5 2 6.57 2 8.5 3.57 12 5.5 12zm0-5c.83 0 1.5.67 1.5 1.5S6.33 10 5.5 10 4 9.33 4 8.5 4.67 7 5.5 7z" />
              </svg>
            </a>
          </div>
        </div>

        <nav aria-label={t('footer.marketplace')}>
          <h3 className="site-footer__heading">{t('footer.marketplace')}</h3>
          <ul className="site-footer__list">
            {categories.slice(0, 6).map(category => (
              <li key={category.id}>
                <Link to={`/category/${category.id}`}>
                  {localizedField(category, 'name', i18n.language)}
                </Link>
              </li>
            ))}
            <li>
              <Link to="/sell">{t('nav.sell')}</Link>
            </li>
          </ul>
        </nav>

        <nav aria-label={t('footer.legal')}>
          <h3 className="site-footer__heading">{t('footer.legal')}</h3>
          <ul className="site-footer__list">
            <li>
              <a href="/safety.html">{t('footer.safety')}</a>
            </li>
            <li>
              <a href="/faq.html">{t('footer.faq')}</a>
            </li>
            <li>
              <a href="/how-it-works.html">{t('footer.howItWorks')}</a>
            </li>
            <li>
              <a href="/privacy.html">{t('footer.privacy')}</a>
            </li>
            <li>
              <a href="/terms.html">{t('footer.terms')}</a>
            </li>
            <li>
              <a href="/support.html">{t('footer.support')}</a>
            </li>
            <li>
              <a href="/data-deletion.html">{t('footer.deleteData')}</a>
            </li>
            <li>
              <a href={`mailto:${SUPPORT_EMAIL}`}>{t('footer.contact')}</a>
            </li>
          </ul>
        </nav>
      </div>

      <div className="container site-footer__bottom">
        <div>
          <div className="muted small">{t('footer.rights', {year: new Date().getFullYear()})}</div>
          <div className="muted small" style={{marginTop: 'var(--space-2)'}}>
            Powered by{' '}
            <a href="https://alhafid.de" target="_blank" rel="noreferrer noopener">
              alhafid.de
            </a>
          </div>
        </div>
        <LanguageSwitcher />
      </div>
    </footer>
  );
};
