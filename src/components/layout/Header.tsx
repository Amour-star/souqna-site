import {useEffect, useRef, useState} from 'react';
import {Link, NavLink, useLocation, useNavigate, useSearchParams} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useAuth} from '@/lib/auth/AuthContext';
import {useCategories} from '@/hooks/useCategories';
import {useUnreadMessages} from '@/hooks/useUnreadMessages';
import {localizedField} from '@/lib/i18n';
import {LanguageSwitcher} from './LanguageSwitcher';
import {useFavorites} from '@/hooks/useFavorites';
import './layout.css';

/** Desktop-first marketplace header: brand, search, categories, user actions. */
export const Header = () => {
  const {t, i18n} = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const {isAuthenticated, user} = useAuth();
  const {categories} = useCategories();
  const {unreadCount} = useUnreadMessages();
  const {favorites} = useFavorites();

  const [term, setTerm] = useState(searchParams.get('q') ?? '');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Keep the header input in step with the URL when the route changes.
  useEffect(() => {
    setTerm(searchParams.get('q') ?? '');
  }, [searchParams]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onClickAway = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClickAway);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickAway);
      document.removeEventListener('keydown', onEscape);
    };
  }, [menuOpen]);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (term.trim()) params.set('q', term.trim());
    navigate(`/search${params.toString() ? `?${params}` : ''}`);
  };

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link to="/" className="site-header__brand" aria-label="Souqna">
          <img src="/logo.png" alt="" width={36} height={36} />
          <span>Souqna</span>
        </Link>

        <form className="site-header__search" role="search" onSubmit={submitSearch}>
          <label className="sr-only" htmlFor="header-search">
            {t('common.searchLabel')}
          </label>
          <input
            id="header-search"
            className="input site-header__search-input"
            type="search"
            value={term}
            placeholder={t('home.searchPlaceholder')}
            onChange={event => setTerm(event.target.value)}
          />
          <button type="submit" className="btn btn--primary site-header__search-btn">
            <span aria-hidden="true">🔎</span>
            <span className="site-header__search-label">{t('home.searchButton')}</span>
          </button>
        </form>

        <nav className="site-header__actions" aria-label={t('nav.account')}>
          <NavLink to="/sell" className="btn btn--primary btn--sm site-header__sell">
            + {t('nav.sell')}
          </NavLink>

          <NavLink
            to="/favorites"
            className="icon-btn site-header__icon"
            aria-label={t('nav.favorites')}>
            <span aria-hidden="true">♡</span>
            {isAuthenticated && favorites.length ? (
              <span className="site-header__badge">{favorites.length}</span>
            ) : null}
          </NavLink>

          <NavLink
            to="/messages"
            className="icon-btn site-header__icon"
            aria-label={t('nav.messages')}>
            <span aria-hidden="true">💬</span>
            {unreadCount ? (
              <span className="site-header__badge" aria-label={t('messages.unread', {count: unreadCount})}>
                {unreadCount}
              </span>
            ) : null}
          </NavLink>

          <div className="site-header__menu" ref={menuRef}>
            <button
              type="button"
              className="icon-btn"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={t('nav.account')}
              onClick={() => setMenuOpen(open => !open)}>
              <span aria-hidden="true">{isAuthenticated ? '👤' : '☰'}</span>
            </button>

            {menuOpen ? (
              <div className="menu" role="menu">
                {isAuthenticated ? (
                  <>
                    <span className="menu__header">{user?.name || user?.email}</span>
                    <Link className="menu__item" role="menuitem" to="/profile">
                      {t('nav.profile')}
                    </Link>
                    <Link className="menu__item" role="menuitem" to="/profile/listings">
                      {t('nav.myListings')}
                    </Link>
                    <Link className="menu__item" role="menuitem" to="/notifications">
                      {t('nav.notifications')}
                    </Link>
                    <Link className="menu__item" role="menuitem" to="/profile/settings">
                      {t('nav.settings')}
                    </Link>
                  </>
                ) : (
                  <>
                    <Link className="menu__item" role="menuitem" to="/login">
                      {t('nav.login')}
                    </Link>
                    <Link className="menu__item" role="menuitem" to="/register">
                      {t('nav.register')}
                    </Link>
                  </>
                )}

                <div className="menu__separator" role="separator" />
                <LanguageSwitcher variant="menu" />

                {isAuthenticated ? (
                  <>
                    <div className="menu__separator" role="separator" />
                    <Link className="menu__item" role="menuitem" to="/logout">
                      {t('nav.logout')}
                    </Link>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </nav>
      </div>

      <nav className="site-header__categories" aria-label={t('nav.categories')}>
        <div className="container site-header__categories-inner">
          <NavLink
            to="/search"
            end
            className={({isActive}) => `category-link${isActive ? ' category-link--active' : ''}`}>
            {t('search.allCategories')}
          </NavLink>
          {categories.map(category => (
            <NavLink
              key={category.id}
              to={`/category/${category.id}`}
              className={({isActive}) =>
                `category-link${isActive ? ' category-link--active' : ''}`
              }>
              {localizedField(category, 'name', i18n.language)}
            </NavLink>
          ))}
        </div>
      </nav>
    </header>
  );
};
