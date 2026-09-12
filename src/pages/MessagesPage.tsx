import {useEffect, useMemo, useRef, useState} from 'react';
import {useLocation, useNavigate, useParams} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useSeo} from '@/hooks/useSeo';
import {useAuth} from '@/lib/auth/AuthContext';
import {useConversations} from '@/hooks/useUnreadMessages';
import {useToast} from '@/components/ui/ToastProvider';
import type {ChatMessage} from '@/lib/chat/chatService';
import {formatTime, relativeTime} from '@/lib/format';
import {Button, EmptyState, ErrorState, LoadingState} from '@/components/ui';
import './messages.css';

/**
 * Conversation list + thread, backed by the same Firestore collections the
 * mobile app uses. Membership is enforced by the query (`array-contains` the
 * current user) and by the backend when the conversation is created.
 */
const MessagesPage = () => {
  const {t, i18n} = useTranslation();
  const {conversationId} = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const {user} = useAuth();
  const {show} = useToast();

  const {conversations, isLoading, error} = useConversations();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [members, setMembers] = useState<Record<string, {name?: string; avatar?: string}>>({});
  const threadRef = useRef<HTMLDivElement>(null);

  const productContext = location.state as
    | {productId?: string; productName?: string; productImage?: string}
    | null;

  useSeo({title: t('messages.title'), canonicalPath: '/messages', noIndex: true});

  const active = useMemo(
    () => conversations.find(conversation => conversation.id === conversationId) ?? null,
    [conversations, conversationId],
  );

  // Resolve display names for chat partners from the backend member list.
  useEffect(() => {
    void import('@/lib/chat/chatService')
      .then(({fetchChatMembers}) => fetchChatMembers())
      .then(list => {
        setMembers(
          list.reduce<Record<string, {name?: string; avatar?: string}>>(
            (accumulator, entry) => {
              accumulator[String(entry.id)] = {name: entry.name, avatar: entry.avatar};
              return accumulator;
            },
            {},
          ),
        );
      });
  }, []);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return undefined;
    }

    setMessagesLoading(true);
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    void import('@/lib/chat/chatService').then(({subscribeToMessages}) => {
      if (cancelled) return;
      unsubscribe = subscribeToMessages(
        conversationId,
        next => {
          setMessages(next);
          setMessagesLoading(false);
        },
        () => {
          setMessagesLoading(false);
          show(t('messages.loadError'), 'error');
        },
      );
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [conversationId, show, t]);

  // Clear the unread counter once the thread is open.
  useEffect(() => {
    if (!conversationId || !user?.id) return;
    void import('@/lib/chat/chatService').then(({markConversationAsRead}) =>
      markConversationAsRead(conversationId, user.id),
    );
  }, [conversationId, user?.id, messages.length]);

  useEffect(() => {
    threadRef.current?.scrollTo({top: threadRef.current.scrollHeight});
  }, [messages]);

  const nameFor = (userId: string | null) =>
    (userId && members[userId]?.name) || t('listing.seller');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !conversationId || !user || !active) return;

    setSending(true);
    setDraft('');
    try {
      const {sendMessage} = await import('@/lib/chat/chatService');
      await sendMessage({
        conversationId,
        text,
        senderId: user.id,
        senderName: user.name || t('messages.you'),
        memberIds: active.members,
        // Attach listing context on the first message of a listing enquiry.
        ...(messages.length === 0 && productContext?.productId
          ? {
              product: {
                id: productContext.productId,
                name: productContext.productName,
                image: productContext.productImage,
              },
            }
          : {}),
      });
    } catch {
      setDraft(text);
      show(t('messages.sendFailed'), 'error');
    } finally {
      setSending(false);
    }
  };

  if (error) {
    return (
      <div className="container page">
        <ErrorState body={t('messages.loadError')} />
      </div>
    );
  }

  return (
    <div className="container page">
      <h1 className="sr-only">{t('messages.title')}</h1>

      <div className={`messages${conversationId ? ' messages--thread-open' : ''}`}>
        <aside className="messages__list" aria-label={t('messages.title')}>
          <h2 className="messages__list-title">{t('messages.title')}</h2>

          {isLoading ? (
            <LoadingState />
          ) : conversations.length ? (
            <ul>
              {conversations.map(conversation => {
                const partner = nameFor(conversation.otherUserId);
                return (
                  <li key={conversation.id}>
                    <button
                      type="button"
                      className={`conversation${
                        conversation.id === conversationId ? ' conversation--active' : ''
                      }`}
                      onClick={() => navigate(`/messages/${conversation.id}`)}>
                      <span className="conversation__avatar" aria-hidden="true">
                        {partner.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="conversation__body">
                        <span className="conversation__name truncate">{partner}</span>
                        <span className="conversation__preview truncate">
                          {conversation.lastMessage?.senderId === user?.id
                            ? `${t('messages.you')}: `
                            : ''}
                          {conversation.lastMessage?.text ?? ''}
                        </span>
                      </span>
                      <span className="conversation__meta">
                        <span className="muted small">
                          {conversation.updatedAt
                            ? relativeTime(
                                conversation.updatedAt.toISOString(),
                                i18n.language,
                                t,
                              )
                            : ''}
                        </span>
                        {conversation.unreadCount ? (
                          <span className="conversation__badge">
                            {conversation.unreadCount}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              icon="💬"
              title={t('messages.emptyTitle')}
              body={t('messages.emptyBody')}
            />
          )}
        </aside>

        <section className="messages__thread" aria-label={t('messages.title')}>
          {!conversationId ? (
            <EmptyState icon="✉️" title={t('messages.selectConversation')} />
          ) : (
            <>
              <header className="messages__thread-head">
                <Button
                  variant="ghost"
                  size="sm"
                  className="messages__back"
                  onClick={() => navigate('/messages')}>
                  ← {t('messages.backToList')}
                </Button>
                <h2>{nameFor(active?.otherUserId ?? null)}</h2>
              </header>

              <div className="messages__scroll" ref={threadRef}>
                {messagesLoading ? (
                  <LoadingState />
                ) : messages.length ? (
                  messages.map(message => {
                    const mine = message.senderId === user?.id;
                    return (
                      <div
                        key={message.id}
                        className={`bubble${mine ? ' bubble--mine' : ''}`}>
                        {message.product ? (
                          <span className="bubble__product">
                            {t('messages.aboutListing')}: {message.product.name}
                          </span>
                        ) : null}
                        <span className="bubble__text">{message.text}</span>
                        <span className="bubble__time">
                          {formatTime(message.createdAt, i18n.language)}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <EmptyState icon="👋" title={t('messages.startConversation')} />
                )}
              </div>

              <form className="messages__composer" onSubmit={submit}>
                <label className="sr-only" htmlFor="message-input">
                  {t('messages.inputPlaceholder')}
                </label>
                <input
                  id="message-input"
                  className="input"
                  value={draft}
                  placeholder={t('messages.inputPlaceholder')}
                  onChange={event => setDraft(event.target.value)}
                  autoComplete="off"
                />
                <Button
                  type="submit"
                  variant="primary"
                  loading={sending}
                  disabled={!draft.trim()}>
                  {t('messages.send')}
                </Button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default MessagesPage;
