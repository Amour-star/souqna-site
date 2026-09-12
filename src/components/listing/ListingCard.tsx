import {memo, useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {CONDITION, PRODUCT_STATUS} from '@/lib/config';
import {
  formatPrice,
  listingPath,
  productCoverImage,
  relativeTime,
} from '@/lib/format';
import {localizedField} from '@/lib/i18n';
import {useAuth} from '@/lib/auth/AuthContext';
import {useFavorites} from '@/hooks/useFavorites';
import {Badge, Skeleton} from '@/components/ui';
import type {Product} from '@/types';
import './listing.css';

/**
 * The marketplace's core unit. Images use a fixed aspect ratio with a lazy
 * loader and a text fallback, so a broken or missing photo can never distort
 * the grid.
 */
const ListingCardBase = ({
  product,
  layout = 'grid',
}: {
  product: Product;
  layout?: 'grid' | 'list';
}) => {
  const {t, i18n} = useTranslation();
  const navigate = useNavigate();
  const {isAuthenticated} = useAuth();
  const {isFavorite, toggle} = useFavorites();
  const [imageFailed, setImageFailed] = useState(false);

  const title = localizedField(product, 'name', i18n.language) || product.name;
  const location =
    localizedField(product, 'location', i18n.language) || product.location || '';
  const cover = productCoverImage(product);
  const price = formatPrice(product.price, product.currency);
  const saved = isFavorite(product);

  const onFavoriteClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isAuthenticated) {
      navigate('/login', {state: {from: listingPath(product), reason: 'favorite'}});
      return;
    }
    toggle(product);
  };

  return (
    <article className={`listing-card listing-card--${layout}`}>
      <Link className="listing-card__link" to={listingPath(product)}>
        <div className="listing-card__media">
          {cover && !imageFailed ? (
            <img
              src={cover}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <span className="listing-card__placeholder">{t('listing.noImage')}</span>
          )}

          {Number(product.status) === PRODUCT_STATUS.SOLD ? (
            <span className="listing-card__status">
              <Badge tone="danger">{t('listing.soldBadge')}</Badge>
            </span>
          ) : null}
          {Number(product.status) === PRODUCT_STATUS.INACTIVE ? (
            <span className="listing-card__status">
              <Badge tone="warning">{t('listing.inactiveBadge')}</Badge>
            </span>
          ) : null}
        </div>

        <div className="listing-card__body">
          <h3 className="listing-card__title clamp-2">
            <bdi>{title}</bdi>
          </h3>
          <p className="listing-card__price">
            {price ?? t('listing.priceOnRequest')}
            {product.negotiable ? (
              <span className="listing-card__negotiable"> · {t('listing.negotiable')}</span>
            ) : null}
          </p>
          <p className="listing-card__meta truncate">
            {location ? <bdi>{location}</bdi> : null}
            {location ? ' · ' : ''}
            <bdi>{relativeTime(product.created_at, i18n.language, t)}</bdi>
          </p>
          {product.condition ? (
            <span className="listing-card__condition">
              <Badge>
                {Number(product.condition) === CONDITION.NEW
                  ? t('listing.new')
                  : t('listing.used')}
              </Badge>
            </span>
          ) : null}
        </div>
      </Link>

      <button
        type="button"
        className={`listing-card__fav${saved ? ' listing-card__fav--on' : ''}`}
        onClick={onFavoriteClick}
        aria-pressed={saved}
        aria-label={`${saved ? t('listing.saved') : t('listing.save')}: ${title}`}>
        <span aria-hidden="true">{saved ? '♥' : '♡'}</span>
      </button>
    </article>
  );
};

export const ListingCard = memo(ListingCardBase);

export const ListingCardSkeleton = ({layout = 'grid'}: {layout?: 'grid' | 'list'}) => (
  <div className={`listing-card listing-card--${layout}`} aria-hidden="true">
    <div className="listing-card__link">
      <div className="listing-card__media">
        <Skeleton height="100%" radius={0} />
      </div>
      <div className="listing-card__body">
        <Skeleton height={16} width="85%" />
        <Skeleton height={18} width="45%" />
        <Skeleton height={12} width="65%" />
      </div>
    </div>
  </div>
);

export const ListingGrid = ({
  products,
  layout = 'grid',
}: {
  products: Product[];
  layout?: 'grid' | 'list';
}) => (
  <div className={`listing-grid listing-grid--${layout}`}>
    {products.map(product => (
      <ListingCard key={product.id} product={product} layout={layout} />
    ))}
  </div>
);

export const ListingGridSkeleton = ({
  count = 8,
  layout = 'grid',
}: {
  count?: number;
  layout?: 'grid' | 'list';
}) => (
  <div className={`listing-grid listing-grid--${layout}`}>
    {Array.from({length: count}, (_, index) => (
      <ListingCardSkeleton key={index} layout={layout} />
    ))}
  </div>
);
