import {Link} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useSeo} from '@/hooks/useSeo';
import {useFavorites} from '@/hooks/useFavorites';
import {ListingGrid, ListingGridSkeleton} from '@/components/listing/ListingCard';
import {EmptyState, ErrorState} from '@/components/ui';

const FavoritesPage = () => {
  const {t} = useTranslation();
  const {favorites, isLoading, isError, refetch} = useFavorites();

  useSeo({title: t('favorites.title'), canonicalPath: '/favorites', noIndex: true});

  return (
    <div className="container page">
      <h1>{t('favorites.title')}</h1>

      {isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : isLoading ? (
        <ListingGridSkeleton count={8} />
      ) : favorites.length ? (
        <ListingGrid products={favorites} />
      ) : (
        <EmptyState
          icon="♡"
          title={t('favorites.emptyTitle')}
          body={t('favorites.emptyBody')}
          action={
            <Link className="btn btn--primary" to="/search">
              {t('favorites.browse')}
            </Link>
          }
        />
      )}
    </div>
  );
};

export default FavoritesPage;
