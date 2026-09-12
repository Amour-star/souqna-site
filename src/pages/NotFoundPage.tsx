import {Link} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useSeo} from '@/hooks/useSeo';
import {EmptyState} from '@/components/ui';

const NotFoundPage = () => {
  const {t} = useTranslation();
  useSeo({title: t('common.notFoundTitle'), noIndex: true});

  return (
    <div className="container page">
      <EmptyState
        icon="🧭"
        title={t('common.notFoundTitle')}
        body={t('common.notFoundBody')}
        action={
          <Link className="btn btn--primary" to="/">
            {t('common.goHome')}
          </Link>
        }
      />
    </div>
  );
};

export default NotFoundPage;
