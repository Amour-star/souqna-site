import {useEffect, useMemo, useState} from 'react';
import {Link, useNavigate, useParams} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useQuery} from '@tanstack/react-query';
import {fetchProduct, recordProductView} from '@/lib/api/products';
import {useSeo} from '@/hooks/useSeo';
import {useAuth} from '@/lib/auth/AuthContext';
import {useFavorites} from '@/hooks/useFavorites';
import {useToast} from '@/components/ui/ToastProvider';
import {useProductSearch} from '@/hooks/useProductSearch';
import {Gallery} from '@/components/listing/Gallery';
import {ListingGrid} from '@/components/listing/ListingCard';
import {Badge, Button, EmptyState, ErrorState, LoadingState, Modal, Select, Textarea} from '@/components/ui';
import {localizedField} from '@/lib/i18n';
import {
  formatDate,
  formatPrice,
  idFromSlug,
  listingPath,
  mediaUrl,
  parseCustomFields,
  productSaves,
  productViews,
  relativeTime,
  sellerIdOf,
} from '@/lib/format';
import {CONDITION, FEATURES, PRODUCT_STATUS, SITE_URL, isPublished} from '@/lib/config';
import {
  REPORT_REASONS,
  hasReported,
  submitReport,
  type ReportReason,
} from '@/lib/api/reports';
import {errorMessage} from '@/lib/api/errorMessages';
import './listing-page.css';

const ListingPage = () => {
  const {t, i18n} = useTranslation();
  const {slug} = useParams();
  const navigate = useNavigate();
  const {user, isAuthenticated} = useAuth();
  const {isFavorite, toggle} = useFavorites();
  const {show} = useToast();

  const id = idFromSlug(slug);
  const [showPhone, setShowPhone] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>(REPORT_REASONS[0]);
  const [reportDetails, setReportDetails] = useState('');
  const [reporting, setReporting] = useState(false);
  const [contacting, setContacting] = useState(false);

  const query = useQuery({
    queryKey: ['product', id],
    queryFn: () => fetchProduct(id),
    enabled: Boolean(id),
  });

  const product = query.data;
  const sellerId = product ? sellerIdOf(product) : '';
  const isOwner = Boolean(product && user && sellerId === String(user.id));

  // Count a view once per listing per browser session.
  useEffect(() => {
    if (!product?.id) return;
    const key = `souqna.viewed.${product.id}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, '1');
    } catch {
      /* storage unavailable — still record the view */
    }
    void recordProductView(product.id, user?.id ?? 'anonymous');
  }, [product?.id, user?.id]);

  const title = product ? localizedField(product, 'name', i18n.language) || product.name : '';
  const description = product
    ? localizedField(product, 'description', i18n.language) || product.description
    : '';
  const location = product
    ? localizedField(product, 'location', i18n.language) || product.location || ''
    : '';
  const price = product ? formatPrice(product.price, product.currency) : null;
  const cover = product?.images?.[0] ? mediaUrl(product.images[0].path) : null;
  const customFields = useMemo(
    () => (product ? parseCustomFields(product.custom_fields) : []),
    [product],
  );

  const similar = useProductSearch(
    {categoryID: product?.categoryID, pageSize: 8, page: 1},
    Boolean(product?.categoryID),
  );

  useSeo({
    title: title || t('common.loading'),
    description: description ? description.slice(0, 160) : undefined,
    canonicalPath: product ? listingPath(product) : undefined,
    image: cover,
    type: 'product',
    structuredData:
      product && isPublished(product.status)
        ? {
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: title,
            description: description?.slice(0, 500),
            image: product.images.map(image => mediaUrl(image.path)).filter(Boolean),
            category: product.category?.name,
            offers: {
              '@type': 'Offer',
              price: Number(product.price) || undefined,
              priceCurrency: product.currency || 'USD',
              availability: 'https://schema.org/InStock',
              url: `${SITE_URL}${listingPath(product)}`,
            },
          }
        : null,
  });

  const contactSeller = async () => {
    if (!product) return;
    if (!isAuthenticated || !user) {
      navigate('/login', {state: {from: listingPath(product)}});
      return;
    }
    setContacting(true);
    try {
      // Firestore is only needed once the user actually contacts a seller.
      const {ensureFirebaseSession} = await import('@/lib/chat/firebaseAuth');
      await ensureFirebaseSession();
      const {getOrCreateConversation} = await import('@/lib/chat/chatService');
      const conversationId = await getOrCreateConversation({
        currentUserId: user.id,
        otherUserId: sellerId,
        productId: product.id,
      });
      navigate(`/messages/${conversationId}`, {
        state: {
          productId: product.id,
          productName: title,
          productImage: cover,
          otherUserId: sellerId,
        },
      });
    } catch (error) {
      show(errorMessage(error), 'error');
    } finally {
      setContacting(false);
    }
  };

  const shareListing = async () => {
    if (!product) return;
    const url = `${SITE_URL}${listingPath(product)}`;
    if (navigator.share) {
      try {
        await navigator.share({title, text: title, url});
        return;
      } catch {
        /* the user dismissed the share sheet */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      show(t('listing.shareCopied'), 'success');
    } catch {
      show(url);
    }
  };

  const sendReport = async () => {
    if (!product) return;

    // Reporting is attributed, so it needs a signed-in user — that is what
    // makes the rate limiting and moderation trail meaningful.
    if (!isAuthenticated) {
      navigate('/login', {state: {from: listingPath(product)}});
      return;
    }

    if (hasReported(product.id)) {
      show(t('listing.reportAlreadySent'));
      setReportOpen(false);
      return;
    }

    setReporting(true);
    try {
      await submitReport({
        productID: product.id,
        reason: reportReason,
        details: reportDetails,
        listingUrl: `${SITE_URL}${listingPath(product)}`,
      });
      show(t('listing.reportSubmitted'), 'success');
      setReportOpen(false);
      setReportDetails('');
    } catch (error) {
      show(errorMessage(error), 'error');
    } finally {
      setReporting(false);
    }
  };

  if (query.isLoading) return <LoadingState />;

  if (query.isError || !product) {
    const status = (query.error as {response?: {status?: number}})?.response?.status;
    if (status === 404) {
      return (
        <div className="container page">
          <EmptyState
            icon="🔎"
            title={t('listing.notFoundTitle')}
            body={t('listing.notFoundBody')}
            action={
              <Link className="btn btn--primary" to="/search">
                {t('listing.backToSearch')}
              </Link>
            }
          />
        </div>
      );
    }
    return (
      <div className="container page">
        <ErrorState onRetry={() => void query.refetch()} />
      </div>
    );
  }

  const saved = isFavorite(product);
  const sellerName = product.seller?.name || t('listing.seller');
  const sellerAvatar = mediaUrl(product.seller?.avatar);
  const phone = product.seller_phone ?? product.sellerPhone ?? product.contactInfo;

  return (
    <div className="container page">
      <article className="listing-detail">
        <div className="listing-detail__main">
          <Gallery images={product.images ?? []} title={title} />

          <header className="listing-detail__header">
            <div className="row-wrap">
              {/* Approval state is only meaningful to the seller. */}
              {isOwner && Number(product.status) === PRODUCT_STATUS.PENDING ? (
                <Badge tone="warning">{t('listing.pendingReview')}</Badge>
              ) : null}
              {Number(product.status) === PRODUCT_STATUS.SOLD ? (
                <Badge tone="danger">{t('listing.soldBadge')}</Badge>
              ) : null}
              {product.condition ? (
                <Badge tone="brand">
                  {Number(product.condition) === CONDITION.NEW
                    ? t('listing.new')
                    : t('listing.used')}
                </Badge>
              ) : null}
              {product.category ? (
                <Link
                  className="badge"
                  to={`/category/${product.categoryID}`}>
                  {localizedField(product.category, 'name', i18n.language)}
                </Link>
              ) : null}
            </div>

            <h1>
              <bdi>{title}</bdi>
            </h1>

            <p className="listing-detail__price">
              {price ?? t('listing.priceOnRequest')}
              {product.negotiable ? (
                <span className="listing-detail__negotiable"> · {t('listing.negotiable')}</span>
              ) : null}
            </p>

            <p className="muted small listing-detail__meta">
              {location ? <bdi>{location}</bdi> : null}
              {location ? ' · ' : ''}
              <bdi>{relativeTime(product.created_at, i18n.language, t)}</bdi>
              {' · '}
              <bdi>{t('listing.views', {count: productViews(product)})}</bdi>
              {' · '}
              <bdi>{t('listing.saves', {count: productSaves(product)})}</bdi>
            </p>
          </header>

          <section className="listing-detail__section" aria-labelledby="listing-description">
            <h2 id="listing-description">{t('listing.description')}</h2>
            <p className="listing-detail__description">
              <bdi>{description}</bdi>
            </p>
          </section>

          {customFields.length ? (
            <section className="listing-detail__section" aria-labelledby="listing-details">
              <h2 id="listing-details">{t('listing.details')}</h2>
              <dl className="listing-detail__specs">
                {customFields.map(field => (
                  <div key={field.name} className="listing-detail__spec">
                    <dt>
                      {i18n.language === 'ar' && field.ar_name ? field.ar_name : field.name}
                    </dt>
                    <dd>
                      {i18n.language === 'ar' && field.ar_value
                        ? field.ar_value
                        : field.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          <section className="listing-detail__safety">
            <h2>{t('listing.safetyTitle')}</h2>
            <p className="muted small">{t('listing.safetyBody')}</p>
          </section>
        </div>

        <aside className="listing-detail__aside">
          <div className="card card--pad stack listing-detail__actions">
            {isOwner ? (
              <>
                <Link className="btn btn--primary btn--block" to={`/sell/${product.id}`}>
                  {t('myListings.edit')}
                </Link>
                <Link className="btn btn--secondary btn--block" to="/profile/listings">
                  {t('nav.myListings')}
                </Link>
              </>
            ) : (
              <>
                <Button
                  variant="primary"
                  size="lg"
                  block
                  loading={contacting}
                  onClick={contactSeller}>
                  💬 {t('listing.messageSeller')}
                </Button>

                {phone ? (
                  showPhone ? (
                    <a className="btn btn--secondary btn--block" href={`tel:${phone}`}>
                      {phone}
                    </a>
                  ) : (
                    <Button variant="secondary" block onClick={() => setShowPhone(true)}>
                      📞 {t('listing.showPhone')}
                    </Button>
                  )
                ) : null}
              </>
            )}

            <div className="row" style={{gap: 'var(--space-2)'}}>
              <Button
                variant="secondary"
                block
                aria-pressed={saved}
                onClick={() => {
                  if (!isAuthenticated) {
                    navigate('/login', {state: {from: listingPath(product)}});
                    return;
                  }
                  toggle(product);
                }}>
                {saved ? '♥' : '♡'} {saved ? t('listing.saved') : t('listing.save')}
              </Button>
              <Button variant="secondary" block onClick={shareListing}>
                ↗ {t('listing.share')}
              </Button>
            </div>

            {!isOwner ? (
              <Button variant="ghost" size="sm" onClick={() => setReportOpen(true)}>
                ⚑ {t('listing.report')}
              </Button>
            ) : null}
          </div>

          <div className="card card--pad seller-card">
            <h2 className="seller-card__title">{t('listing.seller')}</h2>
            <div className="seller-card__identity">
              {sellerAvatar ? (
                <img src={sellerAvatar} alt="" width={48} height={48} loading="lazy" />
              ) : (
                <span className="seller-card__avatar" aria-hidden="true">
                  {sellerName.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div>
                <p className="seller-card__name">
                  {sellerName}
                  {product.seller_is_verified ? (
                    <span className="seller-card__verified" title={t('listing.verifiedSeller')}>
                      ✓
                    </span>
                  ) : null}
                </p>
                {product.seller?.created_at ? (
                  <p className="muted small">
                    {t('listing.memberSince', {
                      date: formatDate(product.seller.created_at, i18n.language),
                    })}
                  </p>
                ) : null}
              </div>
            </div>
            {sellerId ? (
              <Link className="btn btn--secondary btn--block" to={`/seller/${sellerId}`}>
                {t('listing.viewSellerProfile')}
              </Link>
            ) : null}
          </div>
        </aside>
      </article>

      {similar.data?.data.length ? (
        <section className="listing-detail__similar" aria-labelledby="similar-listings">
          <h2 id="similar-listings">{t('listing.similar')}</h2>
          <ListingGrid
            products={similar.data.data.filter(entry => entry.id !== product.id).slice(0, 4)}
          />
        </section>
      ) : null}

      <Modal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title={t('listing.reportTitle')}
        actions={
          <>
            <Button variant="ghost" onClick={() => setReportOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" loading={reporting} onClick={sendReport}>
              {FEATURES.reportsApi
                ? t('listing.reportSubmit')
                : t('listing.reportOpenEmail')}
            </Button>
          </>
        }>
        <div className="stack">
          {!isAuthenticated ? (
            <p className="auth-alert auth-alert--info">{t('listing.reportNeedsLogin')}</p>
          ) : null}

          <label className="field__label" htmlFor="report-reason">
            {t('listing.reportReason')}
          </label>
          <Select
            id="report-reason"
            value={reportReason}
            onChange={event => setReportReason(event.target.value as ReportReason)}>
            {REPORT_REASONS.map(reason => (
              <option key={reason} value={reason}>
                {t(`listing.reportReason.${reason}`)}
              </option>
            ))}
          </Select>

          <label className="field__label" htmlFor="report-details">
            {t('listing.reportDetails')}
          </label>
          <Textarea
            id="report-details"
            value={reportDetails}
            maxLength={2000}
            onChange={event => setReportDetails(event.target.value)}
          />

          {/* Say what the button will actually do, rather than implying the
              report has been filed somewhere it has not. */}
          {!FEATURES.reportsApi ? (
            <p className="field__hint">{t('listing.reportEmailNotice')}</p>
          ) : null}
        </div>
      </Modal>
    </div>
  );
};

export default ListingPage;
