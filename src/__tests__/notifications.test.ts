import {describe, expect, it} from 'vitest';
import {isUnread, notificationBody} from '@/lib/notifications';

describe('notification helpers (BUG-03)', () => {
  it('reads the text from description, which is what the API stores', () => {
    expect(notificationBody({id: '1', description: 'تم نشر عروض جديدة'})).toBe('تم نشر عروض جديدة');
    expect(notificationBody({id: '1', body: 'b', description: 'd'})).toBe('b');
    expect(notificationBody({id: '1'})).toBe('');
  });

  it('is unread until read, isRead or read_at says otherwise', () => {
    expect(isUnread({id: '1'})).toBe(true);
    expect(isUnread({id: '1', read: false, read_at: null})).toBe(true);
    expect(isUnread({id: '1', read: true})).toBe(false);
    expect(isUnread({id: '1', isRead: 1})).toBe(false);
    expect(isUnread({id: '1', read_at: '2026-10-01T10:00:00Z'})).toBe(false);
  });
});
