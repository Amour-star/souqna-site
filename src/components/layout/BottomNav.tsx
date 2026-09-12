import {NavLink} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useUnreadMessages} from '@/hooks/useUnreadMessages';

/**
 * Mobile-browser tab bar. Mirrors the app's primary destinations so the web
 * experience feels familiar without copying the native UI.
 */
export const BottomNav = () => {
  const {t} = useTranslation();
  const {unreadCount} = useUnreadMessages();

  const items = [
    {to: '/', icon: '🏠', label: t('nav.home'), end: true},
    {to: '/search', icon: '🔎', label: t('nav.search'), end: false},
    {to: '/sell', icon: '➕', label: t('nav.sell'), end: false, primary: true},
    {to: '/messages', icon: '💬', label: t('nav.messages'), end: false, badge: unreadCount},
    {to: '/profile', icon: '👤', label: t('nav.profile'), end: false},
  ];

  return (
    <nav className="bottom-nav" aria-label={t('nav.menu')}>
      {items.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({isActive}) =>
            [
              'bottom-nav__item',
              isActive ? 'bottom-nav__item--active' : '',
              item.primary ? 'bottom-nav__item--primary' : '',
            ]
              .filter(Boolean)
              .join(' ')
          }>
          <span className="bottom-nav__icon" aria-hidden="true">
            {item.icon}
          </span>
          <span className="bottom-nav__label">{item.label}</span>
          {item.badge ? <span className="bottom-nav__badge">{item.badge}</span> : null}
        </NavLink>
      ))}
    </nav>
  );
};
