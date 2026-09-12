import {useParams} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useQuery} from '@tanstack/react-query';
import {useSeo} from '@/hooks/useSeo';
import {fetchSellerDetails, fetchSellerProducts} from '@/lib/api/users';
import {formatDate, mediaUrl} from '@/lib/format';
import {ListingGrid, ListingGridSkeleton} from '@/components/listing/ListingCard';
import {Badge, EmptyState, ErrorState} from '@/components/ui';
import {isPublished} from '@/lib/config';
import './profile.css';

/**
 * Public seller profile. Only fields the platform intends to be public are
 * shown — no email, no exact address.
 */
const SellerProfilePage = () => {
  const {t, i18n} = useTranslation();
  const {sellerId} = useParams();

  const seller = useQuery({
    queryKey: ['seller', sellerId],
    queryFn: () => fetchSellerDetails(sellerId as string),
    enabled: Boolean(sellerId),
  });

  const listings = useQuery({
    queryKey: ['seller-products', sellerId],
    queryFn: () => fetchSellerProducts(sellerId as string),
    enabled: Boolean(sellerId),
  });

  const name = seller.data?.name || t('listing.seller');
  const avatar = mediaUrl(seller.data?.avatar);
  const publicListings = (listings.data ?? []).filter(product =>
    isPublished(product.status),
  );

  useSeo({
    title: name,
    description: t('profile.publicProfile'),
    canonicalPath: `/seller/${sellerId}`,
  });

  return (
    <div className="container page">
      <div className="card card--pad profile-identity">
        {avatar ? (
          <img src={avatar} alt="" width={64} height={64} />
        ) : (
          <span className="profile-identity__avatar" aria-hidden="true">
            {name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div>
          <h1 className="profile-identity__name">{name}</h1>
          {seller.data?.created_at ? (
            <p className="muted small">
              {t('profile.sellerSince', {
                date: formatDate(seller.data.created_at, i18n.language),
              })}
            </p>
          ) : null}
          <div className="row-wrap" style={{marginTop: 'var(--space-2)'}}>
            <Badge>{t('listing.sellerListings', {count: publicListings.length})}</Badge>
            {Number(seller.data?.document?.status) === 2 ? (
              <Badge tone="success">{t('listing.verifiedSeller')}</Badge>
            ) : null}
          </div>
        </div>
      </div>

      <h2>{t('home.latestListings')}</h2>

      {listings.isError ? (
        <ErrorState onRetry={() => void listings.refetch()} />
      ) : listings.isLoading ? (
        <ListingGridSkeleton count={8} />
      ) : publicListings.length ? (
        <ListingGrid products={publicListings} />
      ) : (
        <EmptyState icon="📭" title={t('profile.noListings')} />
      )}
    </div>
  );
};

export default SellerProfilePage;
