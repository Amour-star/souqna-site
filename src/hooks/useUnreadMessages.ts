import {useEffect, useState} from 'react';
import {useAuth} from '@/lib/auth/AuthContext';
import type {Conversation} from '@/lib/chat/chatService';

/**
 * Live conversation list from Firestore.
 *
 * A realtime subscription already exists in the platform, so the badge listens
 * to it rather than polling the API. The Firebase SDK is imported lazily and
 * only for signed-in users, so anonymous visitors never download it.
 */
export const useConversations = () => {
  const {user, isAuthenticated} = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setConversations([]);
      setIsLoading(false);
      return undefined;
    }

    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    setIsLoading(true);
    void (async () => {
      // When Firestore rules require a Firebase identity, establish it first.
      const {ensureFirebaseSession} = await import('@/lib/chat/firebaseAuth');
      await ensureFirebaseSession();
      const {subscribeToConversations} = await import('@/lib/chat/chatService');
      if (cancelled) return;
      unsubscribe = subscribeToConversations(
        user.id,
        next => {
          setConversations(next);
          setError(null);
          setIsLoading(false);
        },
        subscriptionError => {
          setError(subscriptionError);
          setIsLoading(false);
        },
      );
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [isAuthenticated, user?.id]);

  return {conversations, isLoading, error};
};

export const useUnreadMessages = () => {
  const {conversations} = useConversations();
  return {
    unreadCount: conversations.reduce(
      (total, conversation) => total + conversation.unreadCount,
      0,
    ),
  };
};
