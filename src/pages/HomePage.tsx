import {useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useSeo} from '@/hooks/useSeo';
import {useCategories} from '@/hooks/useCategories';
import {useProductSearch} from '@/hooks/useProductSearch';
import {ListingGrid, ListingGridSkeleton} from '@/components/listing/ListingCard';
import {Button, EmptyState, ErrorState, Skeleton} from '@/components/ui';
import {localizedField} from '@/lib/i18n';
import {mediaUrl} from '@/lib/format';
import {SITE_URL, STORE_LINKS} from '@/lib/config';
import './home.css';

const HomePage = () => {
  const {t, i18n} = useTranslation();
  const navigate = useNavigate();
  const {categories, isLoading: categoriesLoading, isError: categoriesError, refetch} =
    useCategories();
  const latest = useProductSearch({page: 1, pageSize: 12, sort: 'newest'});

  const [term, setTerm] = useState('');
  const [location, setLocation] = useState('');

  useSeo({
    title: 'سوقنا | سوق سوريا للبيع والشراء',
    description: t('home.seoDescription'),
    canonicalPath: '/',
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Souqna — سوقنا',
      url: SITE_URL,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${SITE_URL}/search?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
  });

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (term.trim()) params.set('q', term.trim());
    if (location.trim()) params.set('location', location.trim());
    navigate(`/search${params.toString() ? `?${params}` : ''}`);
  };

  return (
    <>
      <section className="hero">
        <div className="container">
          <h1 className="hero__title">{t('home.heroTitle')}</h1>
          <p className="hero__subtitle">{t('home.heroSubtitle')}</p>

          <form className="hero__search" onSubmit={submitSearch} role="search">
            <div className="hero__field">
              <label className="sr-only" htmlFor="hero-term">
                {t('common.searchLabel')}
              </label>
              <input
                id="hero-term"
                className="input"
                type="search"
                value={term}
                placeholder={t('home.searchPlaceholder')}
                onChange={event => setTerm(event.target.value)}
              />
            </div>
            <div className="hero__field hero__field--location">
              <label className="sr-only" htmlFor="hero-location">
                {t('search.location')}
              </label>
              <input
                id="hero-location"
                className="input"
                type="text"
                value={location}
                placeholder={t('home.locationPlaceholder')}
                onChange={event => setLocation(event.target.value)}
              />
            </div>
            <Button type="submit" variant="primary" size="lg">
              {t('home.searchButton')}
            </Button>
          </form>
        </div>
      </section>

      <section className="container home-section" aria-labelledby="home-categories">
        <div className="home-section__head">
          <h2 id="home-categories">{t('home.browseCategories')}</h2>
          <Link to="/search">{t('home.viewAll')}</Link>
        </div>

        {categoriesError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : categoriesLoading ? (
          <div className="category-grid">
            {Array.from({length: 7}, (_, index) => (
              <div key={index} className="category-tile">
                <Skeleton height={56} width={56} radius="50%" />
                <Skeleton height={12} width="70%" />
              </div>
            ))}
          </div>
        ) : (
          <div className="category-grid">
            {categories.map(category => {
              const image = mediaUrl(category.image);
              return (
                <Link
                  key={category.id}
                  to={`/category/${category.id}`}
                  className="category-tile">
                  <span className="category-tile__icon">
                    {image ? (
                      <img src={image} alt="" loading="lazy" width={56} height={56} />
                    ) : (
                      <span aria-hidden="true">🏷️</span>
                    )}
                  </span>
                  <span className="category-tile__label">
                    {localizedField(category, 'name', i18n.language)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="container home-section" aria-labelledby="home-latest">
        <div className="home-section__head">
          <h2 id="home-latest">{t('home.latestListings')}</h2>
          <Link to="/search">{t('home.viewAll')}</Link>
        </div>

        {latest.isError ? (
          <ErrorState onRetry={() => void latest.refetch()} />
        ) : latest.isLoading ? (
          <ListingGridSkeleton count={8} />
        ) : latest.data?.data.length ? (
          <ListingGrid products={latest.data.data} />
        ) : (
          <EmptyState icon="📭" title={t('search.emptyTitle')} body={t('search.emptyBody')} />
        )}
      </section>

      <section className="container home-section">
        <div className="sell-cta">
          <div>
            <h2>{t('home.sellCtaTitle')}</h2>
            <p className="muted">{t('home.sellCtaBody')}</p>
          </div>
          <Link className="btn btn--primary btn--lg" to="/sell">
            {t('home.sellCtaButton')}
          </Link>
        </div>
      </section>

      <section className="container home-section">
        <div className="app-cta">
          <p>{t('home.getTheApp')}</p>
          <div className="row-wrap">
            <a
              className="btn btn--secondary"
              href={STORE_LINKS.android}
              target="_blank"
              rel="noreferrer noopener">
              Google Play
            </a>
            <a
              className="btn btn--secondary"
              href={STORE_LINKS.ios}
              target="_blank"
              rel="noreferrer noopener">
              App Store
            </a>
          </div>
        </div>
      </section>
    </>
  );
};

export default HomePage;
