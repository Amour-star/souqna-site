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
              {/* Google Play official symbol: colorful play triangle */}
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3.5 3.5L14.5 12L3.5 20.5V3.5Z" fill="#00A651" />
                <path d="M14.5 12L3.5 20.5L14.5 15V12Z" fill="#0D652D" />
                <path d="M14.5 12L20.5 16L3.5 20.5Z" fill="#1F71B8" />
                <path d="M14.5 12L20.5 8L3.5 3.5Z" fill="#F7931E" />
              </svg>
            </a>
            <a
              href={STORE_LINKS.ios}
              target="_blank"
              rel="noreferrer noopener"
              title="App Store"
              className="site-footer__store-icon">
              {/* App Store official symbol: A with colored squares */}
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="2" width="6" height="6" fill="#FF3B30" rx="1" />
                <rect x="9" y="2" width="6" height="6" fill="#34C759" rx="1" />
                <rect x="16" y="2" width="6" height="6" fill="#00B4EF" rx="1" />
                <rect x="2" y="9" width="6" height="6" fill="#FF9500" rx="1" />
                <rect x="9" y="9" width="6" height="6" fill="#AF52DE" rx="1" />
                <rect x="16" y="9" width="6" height="6" fill="#A2845E" rx="1" />
                <rect x="2" y="16" width="6" height="6" fill="#5AC8FA" rx="1" />
                <rect x="9" y="16" width="6" height="6" fill="#FFCC00" rx="1" />
                <rect x="16" y="16" width="6" height="6" fill="#FF2D55" rx="1" />
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
