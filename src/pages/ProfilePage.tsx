import {Link} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useQuery} from '@tanstack/react-query';
import {useSeo} from '@/hooks/useSeo';
import {useAuth} from '@/lib/auth/AuthContext';
import {useFavorites} from '@/hooks/useFavorites';
import {useUnreadMessages} from '@/hooks/useUnreadMessages';
import {fetchMyProducts} from '@/lib/api/products';
import {formatDate, mediaUrl} from '@/lib/format';
import {Badge} from '@/components/ui';
import './profile.css';

/** Account hub: identity, quick stats and links into every account area. */
const ProfilePage = () => {
  const {t, i18n} = useTranslation();
  const {user, isSeller} = useAuth();
  const {favorites} = useFavorites();
  const {unreadCount} = useUnreadMessages();

  useSeo({title: t('profile.title'), canonicalPath: '/profile', noIndex: true});

  const myListings = useQuery({
    queryKey: ['my-products'],
    queryFn: () => fetchMyProducts(1, 60),
    enabled: isSeller,
  });

  const avatar = mediaUrl(user?.avatar);

  const links = [
    {to: '/profile/listings', icon: '🏷️', label: t('nav.myListings'), count: myListings.data?.totalRecords},
    {to: '/favorites', icon: '♡', label: t('nav.favorites'), count: favorites.length},
    {to: '/messages', icon: '💬', label: t('nav.messages'), count: unreadCount},
    {to: '/notifications', icon: '🔔', label: t('nav.notifications')},
    {to: '/profile/settings', icon: '⚙️', label: t('nav.settings')},
    {to: '/logout', icon: '↩', label: t('nav.logout')},
  ];

  return (
    <div className="container page">
      <h1>{t('profile.title')}</h1>

      <div className="card card--pad profile-identity">
        {avatar ? (
          <img src={avatar} alt="" width={64} height={64} />
        ) : (
          <span className="profile-identity__avatar" aria-hidden="true">
            {(user?.name || user?.email || '?').slice(0, 1).toUpperCase()}
          </span>
        )}
        <div>
          <h2 className="profile-identity__name">{user?.name || user?.email}</h2>
          <p className="muted small">{user?.email}</p>
          <div className="row-wrap" style={{marginTop: 'var(--space-2)'}}>
            <Badge tone={isSeller ? 'brand' : 'default'}>
              {isSeller ? t('profile.sellerAccount') : t('profile.buyerAccount')}
            </Badge>
            {user?.created_at ? (
              <span className="muted small">
                {t('listing.memberSince', {date: formatDate(user.created_at, i18n.language)})}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <nav className="profile-links" aria-label={t('profile.title')}>
        {links.map(link => (
          <Link key={link.to} className="profile-link card" to={link.to}>
            <span className="profile-link__icon" aria-hidden="true">
              {link.icon}
            </span>
            <span className="profile-link__label">{link.label}</span>
            {link.count ? <span className="profile-link__count">{link.count}</span> : null}
            <span className="profile-link__chevron" aria-hidden="true">
              ›
            </span>
          </Link>
        ))}
      </nav>
    </div>
  );
};

export default ProfilePage;
