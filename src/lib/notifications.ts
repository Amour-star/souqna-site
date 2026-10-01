import type {AppNotification} from '@/types';

/** A notification is unread unless the API says otherwise (`read`, `isRead` or a `read_at` timestamp). */
export const isUnread = (n: AppNotification): boolean =>
  !(n.read || n.isRead || n.read_at);

/** The API stores the text in `description`; older payloads used `body`/`message`. */
export const notificationBody = (n: AppNotification): string =>
  n.body || n.message || n.description || '';
