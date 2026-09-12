import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as limitQuery,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type DocumentData,
  type Timestamp,
} from 'firebase/firestore';
import {db} from './firebase';
import {api} from '@/lib/api/client';

/**
 * Firestore-backed messaging, byte-compatible with the mobile implementation
 * in `src/firebase/chatService.js`.
 *
 * Document shape (must not drift):
 *   conversations/{chatId} = {
 *     members: string[],                       // exactly two user ids
 *     userInfo: {[userId]: {id, unreadCount, lastRead}},
 *     lastMessage: {text, senderId, createdAt},
 *     updatedAt, createdAt
 *   }
 *   conversations/{chatId}/messages/{id} = {
 *     text, createdAt, user: {_id, name}, product?
 *   }
 *
 * The conversation id itself is minted by the Laravel backend (`chat/start`),
 * which is what keeps both clients pointing at the same thread.
 */

export interface ChatMessage {
  id: string;
  text: string;
  createdAt: Date | null;
  senderId: string;
  senderName: string;
  product?: {id: string; name?: string; image?: string; price?: number | string} | null;
}

export interface Conversation {
  id: string;
  members: string[];
  lastMessage: {text: string; senderId: string; createdAt: Date | null} | null;
  updatedAt: Date | null;
  unreadCount: number;
  otherUserId: string | null;
  userInfo: Record<string, {id?: string; unreadCount?: number; name?: string}>;
}

const conversationsRef = () => collection(db, 'conversations');
const conversationRef = (id: string) => doc(db, 'conversations', id);
const messagesRef = (id: string) => collection(db, 'conversations', id, 'messages');

const toDate = (value: unknown): Date | null => {
  if (!value) return null;
  const timestamp = value as Timestamp;
  if (typeof timestamp?.toDate === 'function') return timestamp.toDate();
  if (value instanceof Date) return value;
  return null;
};

const normalizeId = (value: unknown): string | null => {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
};

const normalizeMembers = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const unique = new Set<string>();
  value.forEach(entry => {
    const id = normalizeId(entry);
    if (id) unique.add(id);
  });
  return Array.from(unique);
};

const buildUserInfo = (
  existing: DocumentData | undefined,
  members: string[],
): Record<string, DocumentData> => {
  const next: Record<string, DocumentData> = {};
  members.forEach(memberId => {
    const current = existing?.[memberId] ?? {};
    next[memberId] = {
      ...current,
      id: memberId,
      unreadCount: Number(current?.unreadCount ?? 0) || 0,
    };
  });
  return next;
};

/**
 * Asks the backend for the canonical conversation id for this buyer/seller/
 * product triple, then makes sure the matching Firestore document exists.
 *
 * The backend call is what authorises the conversation: the caller's identity
 * comes from the JWT, never from a client-supplied user id.
 */
export const getOrCreateConversation = async (input: {
  currentUserId: string;
  otherUserId: string;
  productId: string;
}): Promise<string> => {
  const currentUserId = normalizeId(input.currentUserId);
  const otherUserId = normalizeId(input.otherUserId);
  const productId = normalizeId(input.productId);

  if (!currentUserId || !otherUserId || !productId) {
    throw new Error('Missing conversation details');
  }

  const {data} = await api.post('chat/start', {
    seller_id: otherUserId,
    product_id: productId,
  });

  const chatId = normalizeId(data?.chat_id ?? data?.data?.chat_id);
  if (!data?.success || !chatId) {
    throw new Error(data?.message || 'Could not start the conversation');
  }

  const ref = conversationRef(chatId);
  const snapshot = await getDoc(ref);
  const existing = snapshot.exists() ? snapshot.data() : null;
  const members = normalizeMembers([currentUserId, otherUserId]);

  await setDoc(
    ref,
    {
      members,
      userInfo: buildUserInfo(existing?.userInfo, members),
      updatedAt: serverTimestamp(),
      ...(existing ? {} : {createdAt: serverTimestamp()}),
    },
    {merge: true},
  );

  return chatId;
};

/** Live list of the user's conversations, newest activity first. */
export const subscribeToConversations = (
  userId: string,
  onResult: (conversations: Conversation[]) => void,
  onError?: (error: Error) => void,
) => {
  const normalizedUserId = normalizeId(userId);
  if (!normalizedUserId) return () => {};

  return onSnapshot(
    query(
      conversationsRef(),
      where('members', 'array-contains', normalizedUserId),
      orderBy('updatedAt', 'desc'),
      limitQuery(100),
    ),
    snapshot => {
      const conversations = snapshot.docs.map(entry => {
        const value = entry.data();
        const members = normalizeMembers(value.members);
        const userInfo = (value.userInfo ?? {}) as Conversation['userInfo'];
        return {
          id: entry.id,
          members,
          userInfo,
          otherUserId: members.find(member => member !== normalizedUserId) ?? null,
          unreadCount: Number(userInfo?.[normalizedUserId]?.unreadCount ?? 0) || 0,
          updatedAt: toDate(value.updatedAt),
          lastMessage: value.lastMessage
            ? {
                text: String(value.lastMessage.text ?? ''),
                senderId: String(value.lastMessage.senderId ?? ''),
                createdAt: toDate(value.lastMessage.createdAt),
              }
            : null,
        } satisfies Conversation;
      });
      onResult(conversations);
    },
    error => onError?.(error as Error),
  );
};

/** Live message stream for one conversation, oldest first for rendering. */
export const subscribeToMessages = (
  conversationId: string,
  onResult: (messages: ChatMessage[]) => void,
  onError?: (error: Error) => void,
  pageSize = 100,
) => {
  const id = normalizeId(conversationId);
  if (!id) return () => {};

  return onSnapshot(
    query(messagesRef(id), orderBy('createdAt', 'desc'), limitQuery(pageSize)),
    snapshot => {
      const messages = snapshot.docs
        .map(entry => {
          const value = entry.data();
          return {
            id: entry.id,
            text: String(value.text ?? ''),
            createdAt: toDate(value.createdAt),
            senderId: String(value.user?._id ?? value.senderId ?? ''),
            senderName: String(value.user?.name ?? ''),
            product: value.product ?? null,
          } satisfies ChatMessage;
        })
        .reverse();
      onResult(messages);
    },
    error => onError?.(error as Error),
  );
};

/**
 * Writes a message and updates the conversation summary + unread counters in
 * one batch, exactly as the mobile client does.
 */
export const sendMessage = async (input: {
  conversationId: string;
  text: string;
  senderId: string;
  senderName: string;
  memberIds: string[];
  product?: ChatMessage['product'];
}) => {
  const conversationId = normalizeId(input.conversationId);
  const senderId = normalizeId(input.senderId);
  const text = input.text.trim();

  if (!conversationId || !senderId) throw new Error('Missing conversation details');
  if (!text && !input.product) return;

  const ref = conversationRef(conversationId);
  const snapshot = await getDoc(ref);
  const existing = snapshot.exists() ? snapshot.data() : null;
  const members = normalizeMembers(
    existing?.members?.length ? existing.members : input.memberIds,
  );

  const batch = writeBatch(db);

  batch.set(doc(messagesRef(conversationId)), {
    text,
    createdAt: serverTimestamp(),
    user: {_id: senderId, name: input.senderName || 'User'},
    ...(input.product ? {product: input.product} : {}),
  });

  const userInfo = buildUserInfo(existing?.userInfo, members);
  userInfo[senderId] = {
    ...userInfo[senderId],
    id: senderId,
    unreadCount: 0,
    lastRead: serverTimestamp(),
  };
  members
    .filter(member => member !== senderId)
    .forEach(member => {
      userInfo[member] = {
        ...userInfo[member],
        id: member,
        unreadCount: Number(userInfo[member]?.unreadCount ?? 0) + 1,
      };
    });

  batch.set(
    ref,
    {
      members,
      userInfo,
      updatedAt: serverTimestamp(),
      lastMessage: {text: text || 'رسالة', senderId, createdAt: serverTimestamp()},
    },
    {merge: true},
  );

  await batch.commit();
};

export const markConversationAsRead = async (conversationId: string, userId: string) => {
  const id = normalizeId(conversationId);
  const normalizedUserId = normalizeId(userId);
  if (!id || !normalizedUserId) return;

  const ref = conversationRef(id);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return;

  const value = snapshot.data();
  const members = normalizeMembers(value.members);
  const userInfo = buildUserInfo(value.userInfo, members);
  userInfo[normalizedUserId] = {
    ...userInfo[normalizedUserId],
    id: normalizedUserId,
    unreadCount: 0,
    lastRead: serverTimestamp(),
  };

  await setDoc(ref, {userInfo}, {merge: true});
};

/** One-shot read used by the conversation header to resolve display names. */
export const fetchChatUser = async (userId: string) => {
  const id = normalizeId(userId);
  if (!id) return null;
  const snapshot = await getDoc(doc(collection(db, 'users'), id));
  return snapshot.exists() ? snapshot.data() : null;
};

/** Chat partners known to the backend, used to label conversations. */
export const fetchChatMembers = async (): Promise<
  {id: string; name?: string; avatar?: string}[]
> => {
  try {
    const {data} = await api.get('getChatMembers');
    const payload = data?.data ?? data?.members ?? [];
    return Array.isArray(payload) ? payload : [];
  } catch {
    return [];
  }
};

/** Total unread messages across all conversations, for the header badge. */
export const countUnread = (conversations: Conversation[]) =>
  conversations.reduce((total, conversation) => total + conversation.unreadCount, 0);

export const conversationExists = async (conversationId: string) => {
  const id = normalizeId(conversationId);
  if (!id) return false;
  const snapshot = await getDocs(
    query(conversationsRef(), where('__name__', '==', id), limitQuery(1)),
  );
  return !snapshot.empty;
};
