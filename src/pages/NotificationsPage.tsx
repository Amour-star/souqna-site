import {useTranslation} from 'react-i18next';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {useSeo} from '@/hooks/useSeo';
import {useAuth} from '@/lib/auth/AuthContext';
import {useToast} from '@/components/ui/ToastProvider';
import {clearNotifications, deleteNotification, fetchNotifications} from '@/lib/api/users';
import {errorMessage} from '@/lib/api/errorMessages';
import {relativeTime} from '@/lib/format';
import {Button, EmptyState, ErrorState, Skeleton} from '@/components/ui';
import './notifications.css';

const NotificationsPage = () => {
  const {t, i18n} = useTranslation();
  const {user} = useAuth();
  const queryClient = useQueryClient();
  const {show} = useToast();
  const role = Number(user?.role ?? 3);

  useSeo({title: t('notifications.title'), canonicalPath: '/notifications', noIndex: true});

  const query = useQuery({
    queryKey: ['notifications', role],
    queryFn: () => fetchNotifications(role),
    enabled: Boolean(user),
  });

  const removal = useMutation({
    mutationFn: (id: string) => deleteNotification(id, role),
    onSuccess: () => queryClient.invalidateQueries({queryKey: ['notifications', role]}),
    onError: error => show(errorMessage(error), 'error'),
  });

  const clearAll = useMutation({
    mutationFn: () => clearNotifications(role),
    onSuccess: () => queryClient.invalidateQueries({queryKey: ['notifications', role]}),
    onError: error => show(errorMessage(error), 'error'),
  });

  const notifications = query.data ?? [];

  return (
    <div className="container page">
      <div className="row-wrap" style={{justifyContent: 'space-between'}}>
        <h1>{t('notifications.title')}</h1>
        {notifications.length ? (
          <Button variant="ghost" loading={clearAll.isPending} onClick={() => clearAll.mutate()}>
            {t('notifications.clearAll')}
          </Button>
        ) : null}
      </div>

      {query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : query.isLoading ? (
        <ul className="notification-list">
          {Array.from({length: 4}, (_, index) => (
            <li key={index} className="notification card">
              <Skeleton height={16} width="55%" />
              <Skeleton height={13} width="80%" />
            </li>
          ))}
        </ul>
      ) : notifications.length ? (
        <ul className="notification-list">
          {notifications.map(notification => {
            const unread = !(notification.read ?? notification.isRead);
            return (
              <li
                key={notification.id}
                className={`notification card${unread ? ' notification--unread' : ''}`}>
                <div className="notification__body">
                  <p className="notification__title">
                    {notification.title || notification.type || t('notifications.title')}
                  </p>
                  <p className="muted small">{notification.body || notification.message}</p>
                  <p className="muted small">
                    {relativeTime(notification.created_at, i18n.language, t)}
                  </p>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={t('notifications.delete')}
                  onClick={() => removal.mutate(String(notification.id))}>
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon="🔔"
          title={t('notifications.emptyTitle')}
          body={t('notifications.emptyBody')}
        />
      )}
    </div>
  );
};

export default NotificationsPage;
