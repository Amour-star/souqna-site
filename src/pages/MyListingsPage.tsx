import {useMemo, useState} from 'react';
import {Link} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {useSeo} from '@/hooks/useSeo';
import {useAuth} from '@/lib/auth/AuthContext';
import {useToast} from '@/components/ui/ToastProvider';
import {deleteProduct, fetchMyProducts, updateProductStatus} from '@/lib/api/products';
import {errorMessage} from '@/lib/api/errorMessages';
import {FEATURES, PRODUCT_STATUS, SITE_URL, isPublished} from '@/lib/config';
import {
  formatPrice,
  listingPath,
  mediaUrl,
  productSaves,
  productViews,
  relativeTime,
} from '@/lib/format';
import {localizedField} from '@/lib/i18n';
import {Badge, Button, EmptyState, ErrorState, Modal, Skeleton} from '@/components/ui';
import type {Product} from '@/types';
import './my-listings.css';

type TabKey = 'active' | 'sold' | 'inactive';

/**
 * Sold and paused only exist once the backend patch is deployed, so without it
 * there is a single list and no tab strip at all.
 */
const TABS: {key: TabKey; labelKey: string; match: (status: number) => boolean}[] = [
  {key: 'active', labelKey: 'myListings.tab.active', match: isPublished},
  {
    key: 'sold',
    labelKey: 'myListings.tab.sold',
    match: status => status === PRODUCT_STATUS.SOLD,
  },
  {
    key: 'inactive',
    labelKey: 'myListings.tab.inactive',
    match: status => status === PRODUCT_STATUS.INACTIVE,
  },
];

/** Seller dashboard: every listing the signed-in user owns, grouped by status. */
const MyListingsPage = () => {
  const {t, i18n} = useTranslation();
  const {isSeller} = useAuth();
  const queryClient = useQueryClient();
  const {show} = useToast();

  const [tab, setTab] = useState<TabKey>('active');
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);

  useSeo({title: t('myListings.title'), canonicalPath: '/profile/listings', noIndex: true});

  const query = useQuery({
    queryKey: ['my-products'],
    queryFn: () => fetchMyProducts(1, 60),
    enabled: isSeller,
  });

  const grouped = useMemo(() => {
    const products = query.data?.data ?? [];
    return TABS.reduce<Record<TabKey, Product[]>>(
      (accumulator, entry) => {
        accumulator[entry.key] = products.filter(product =>
          entry.match(Number(product.status)),
        );
        return accumulator;
      },
      {active: [], sold: [], inactive: []},
    );
  }, [query.data]);

  const removal = useMutation({
    mutationFn: (product: Product) => deleteProduct(product.id),
    onSuccess: () => {
      show(t('myListings.deleted'), 'success');
      void queryClient.invalidateQueries({queryKey: ['my-products']});
      void queryClient.invalidateQueries({queryKey: ['products']});
    },
    onError: error => show(errorMessage(error), 'error'),
    onSettled: () => setPendingDelete(null),
  });

  const statusChange = useMutation({
    mutationFn: ({product, status}: {product: Product; status: number}) =>
      updateProductStatus(product.id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({queryKey: ['my-products']});
      void queryClient.invalidateQueries({queryKey: ['products']});
    },
    onError: error => show(errorMessage(error), 'error'),
  });

  const shareListing = async (product: Product) => {
    const url = `${SITE_URL}${listingPath(product)}`;
    try {
      await navigator.clipboard.writeText(url);
      show(t('listing.shareCopied'), 'success');
    } catch {
      show(url);
    }
  };

  if (!isSeller) {
    return (
      <div className="container page">
        <EmptyState
          icon="🏷️"
          title={t('sell.becomeSellerTitle')}
          body={t('sell.becomeSellerBody')}
          action={
            <Link className="btn btn--primary" to="/sell">
              {t('sell.becomeSellerConfirm')}
            </Link>
          }
        />
      </div>
    );
  }

  const listings = grouped[tab];

  return (
    <div className="container page">
      <div className="row-wrap" style={{justifyContent: 'space-between'}}>
        <h1>{t('myListings.title')}</h1>
        <Link className="btn btn--primary" to="/sell">
          + {t('nav.sell')}
        </Link>
      </div>

      {FEATURES.listingStatus ? (
        <div className="tabs" role="tablist" aria-label={t('myListings.title')}>
          {TABS.map(entry => (
            <button
              key={entry.key}
              type="button"
              role="tab"
              className="tab"
              aria-selected={tab === entry.key}
              onClick={() => setTab(entry.key)}>
              {t(entry.labelKey)}
              {grouped[entry.key].length ? ` (${grouped[entry.key].length})` : ''}
            </button>
          ))}
        </div>
      ) : null}

      <div className="my-listings" role="tabpanel">
        {query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} />
        ) : query.isLoading ? (
          Array.from({length: 3}, (_, index) => (
            <div key={index} className="my-listing card">
              <Skeleton height={110} width={150} />
              <div className="stack" style={{flex: 1}}>
                <Skeleton height={18} width="60%" />
                <Skeleton height={14} width="35%" />
                <Skeleton height={14} width="45%" />
              </div>
            </div>
          ))
        ) : listings.length ? (
          listings.map(product => {
            const cover = mediaUrl(product.images?.[0]?.path);
            const title = localizedField(product, 'name', i18n.language) || product.name;
            return (
              <article key={product.id} className="my-listing card">
                <Link className="my-listing__media" to={listingPath(product)}>
                  {cover ? (
                    <img src={cover} alt="" loading="lazy" />
                  ) : (
                    <span className="muted small">{t('listing.noImage')}</span>
                  )}
                </Link>

                <div className="my-listing__body">
                  <Link className="my-listing__title" to={listingPath(product)}>
                    {title}
                  </Link>
                  <p className="my-listing__price">
                    {formatPrice(product.price, product.currency) ??
                      t('listing.priceOnRequest')}
                  </p>
                  <p className="muted small">
                    {relativeTime(product.created_at, i18n.language, t)}
                    {' · '}
                    {t('myListings.stats', {
                      views: productViews(product),
                      saves: productSaves(product),
                    })}
                  </p>
                  {Number(product.status) === PRODUCT_STATUS.SOLD ? (
                    <Badge tone="danger">{t('listing.soldBadge')}</Badge>
                  ) : Number(product.status) === PRODUCT_STATUS.INACTIVE ? (
                    <Badge tone="warning">{t('listing.inactiveBadge')}</Badge>
                  ) : null}
                </div>

                <div className="my-listing__actions">
                  <Link className="btn btn--secondary btn--sm" to={`/sell/${product.id}`}>
                    {t('myListings.edit')}
                  </Link>
                  <Link className="btn btn--ghost btn--sm" to={listingPath(product)}>
                    {t('myListings.preview')}
                  </Link>
                  <Button variant="ghost" size="sm" onClick={() => void shareListing(product)}>
                    {t('listing.share')}
                  </Button>

                  {/* Status controls need the optional backend endpoint; they
                      stay hidden rather than failing silently without it. */}
                  {FEATURES.listingStatus ? (
                    isPublished(product.status) ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={statusChange.isPending}
                          onClick={() =>
                            statusChange.mutate({product, status: PRODUCT_STATUS.SOLD})
                          }>
                          {t('myListings.markSold')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            statusChange.mutate({product, status: PRODUCT_STATUS.INACTIVE})
                          }>
                          {t('myListings.deactivate')}
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          statusChange.mutate({product, status: PRODUCT_STATUS.ACTIVE})
                        }>
                        {t('myListings.reactivate')}
                      </Button>
                    )
                  ) : null}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPendingDelete(product)}
                    style={{color: 'var(--danger)'}}>
                    {t('myListings.delete')}
                  </Button>
                </div>
              </article>
            );
          })
        ) : (
          <EmptyState
            icon="📄"
            title={t('myListings.emptyTitle')}
            body={t('myListings.emptyBody')}
            action={
              <Link className="btn btn--primary" to="/sell">
                {t('home.sellCtaButton')}
              </Link>
            }
          />
        )}
      </div>

      <Modal
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title={t('myListings.deleteConfirmTitle')}
        actions={
          <>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              loading={removal.isPending}
              onClick={() => pendingDelete && removal.mutate(pendingDelete)}>
              {t('myListings.delete')}
            </Button>
          </>
        }>
        <p className="muted">{t('myListings.deleteConfirmBody')}</p>
      </Modal>
    </div>
  );
};

export default MyListingsPage;
