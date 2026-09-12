import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  readStoredSession,
  setSessionExpiredHandler,
  writeStoredSession,
} from '@/lib/api/client';
import * as authApi from '@/lib/api/auth';
import {ROLE} from '@/lib/config';
import type {AuthSession, AuthUser} from '@/types';

/**
 * Session state for the web client.
 *
 * The token is the same JWT the mobile app receives, so a user who registered
 * in the app signs in here with the same credentials and vice versa.
 */

const USER_KEY = 'souqna.auth.user';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isSeller: boolean;
  /** True until the persisted session has been read back from storage. */
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (input: {
    name: string;
    email: string;
    password: string;
  }) => Promise<authApi.RegisterResult>;
  logout: () => Promise<void>;
  applySession: (session: AuthSession) => void;
  updateUser: (patch: Partial<AuthUser>) => void;
  becomeSeller: (input: {password?: string; sellerType?: 1 | 2}) => Promise<void>;
  becomeBuyer: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const readStoredUser = (): AuthUser | null => {
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
};

const writeStoredUser = (user: AuthUser | null) => {
  try {
    if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    else window.localStorage.removeItem(USER_KEY);
  } catch {
    /* storage unavailable */
  }
};

export const AuthProvider = ({children}: {children: ReactNode}) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = useCallback(() => {
    writeStoredSession(null);
    writeStoredUser(null);
    setUser(null);
  }, []);

  // Restore a persisted session on first paint, then confirm it with the API.
  useEffect(() => {
    const session = readStoredSession();
    const storedUser = readStoredUser();

    if (!session || !storedUser) {
      clearSession();
      setIsLoading(false);
      return;
    }

    setUser(storedUser);
    setIsLoading(false);

    // Refresh the profile in the background; a 401 clears the session via the
    // interceptor's expiry handler.
    authApi
      .fetchCurrentUser()
      .then(fresh => {
        if (!fresh) return;
        setUser(previous => {
          const next = {...previous, ...fresh} as AuthUser;
          writeStoredUser(next);
          return next;
        });
      })
      .catch(() => {
        /* offline or transient failure — keep the cached profile */
      });
  }, [clearSession]);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      writeStoredUser(null);
      setUser(null);
    });
    return () => setSessionExpiredHandler(null);
  }, []);

  const applySession = useCallback((session: AuthSession) => {
    writeStoredSession({
      token: session.token,
      refreshToken: session.refreshToken,
      userId: session.user.id,
    });
    writeStoredUser(session.user);
    setUser(session.user);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const session = await authApi.login(email, password);
      applySession(session);
      return session.user;
    },
    [applySession],
  );

  const register = useCallback(
    (input: {name: string; email: string; password: string}) =>
      authApi.register(input),
    [],
  );

  const logout = useCallback(async () => {
    await authApi.logout();
    clearSession();
    // Drop the paired Firebase session so the next user starts clean.
    const {resetFirebaseSession} = await import('@/lib/chat/firebaseAuth');
    await resetFirebaseSession();
  }, [clearSession]);

  const updateUser = useCallback((patch: Partial<AuthUser>) => {
    setUser(previous => {
      if (!previous) return previous;
      const next = {...previous, ...patch};
      writeStoredUser(next);
      return next;
    });
  }, []);

  const becomeSeller = useCallback(
    async (input: {password?: string; sellerType?: 1 | 2}) => {
      const session = await authApi.switchToSeller(input);
      if (session) applySession(session);
      else updateUser({role: ROLE.SELLER});
    },
    [applySession, updateUser],
  );

  const becomeBuyer = useCallback(async () => {
    const session = await authApi.switchToBuyer();
    if (session) applySession(session);
    else updateUser({role: ROLE.BUYER});
  }, [applySession, updateUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isSeller: Number(user?.role) === ROLE.SELLER,
      isLoading,
      login,
      register,
      logout,
      applySession,
      updateUser,
      becomeSeller,
      becomeBuyer,
    }),
    [
      user,
      isLoading,
      login,
      register,
      logout,
      applySession,
      updateUser,
      becomeSeller,
      becomeBuyer,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
};
