import axios, {AxiosError, AxiosRequestConfig} from 'axios';
import {API_BASE_URL} from '@/lib/config';

/**
 * Shared axios instance for the Souqna API.
 *
 * Auth mirrors the mobile client: a JWT access token in the `Authorization`
 * header, refreshed through `auth/refresh` when the API answers 401.
 */
export const api = axios.create({
  baseURL: `${API_BASE_URL}/`,
  timeout: 20000,
  headers: {Accept: 'application/json'},
});

const TOKEN_KEY = 'souqna.auth.session';

export interface StoredSession {
  token: string;
  refreshToken: string | null;
  userId?: string;
}

let inMemorySession: StoredSession | null = null;
let onSessionExpired: (() => void) | null = null;

export const readStoredSession = (): StoredSession | null => {
  if (inMemorySession) return inMemorySession;
  try {
    const raw = window.localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    inMemorySession = parsed?.token ? parsed : null;
    return inMemorySession;
  } catch {
    return null;
  }
};

export const writeStoredSession = (session: StoredSession | null) => {
  inMemorySession = session;
  try {
    if (session) {
      window.localStorage.setItem(TOKEN_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    /* storage can be unavailable in private browsing — session stays in memory */
  }
};

export const setSessionExpiredHandler = (handler: (() => void) | null) => {
  onSessionExpired = handler;
};

export const getAccessToken = () => readStoredSession()?.token ?? null;

api.interceptors.request.use(config => {
  const token = getAccessToken();
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshInFlight: Promise<string | null> | null = null;

const refreshAccessToken = async (): Promise<string | null> => {
  const session = readStoredSession();
  if (!session?.refreshToken) return null;

  if (!refreshInFlight) {
    refreshInFlight = axios
      .post(
        `${API_BASE_URL}/auth/refresh`,
        {refreshToken: session.refreshToken, refresh_token: session.refreshToken},
        {headers: {Accept: 'application/json'}},
      )
      .then(response => {
        const payload = response.data ?? {};
        const data = payload.data ?? payload;
        const token: string | undefined =
          data.token ?? data.accessToken ?? data.access_token;
        if (!token) return null;
        writeStoredSession({
          token,
          refreshToken:
            data.refreshToken ?? data.refresh_token ?? session.refreshToken,
          userId: session.userId,
        });
        return token;
      })
      .catch(() => null)
      .finally(() => {
        refreshInFlight = null;
      });
  }

  return refreshInFlight;
};

api.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    const original = error.config as (AxiosRequestConfig & {_retried?: boolean}) | undefined;
    const status = error.response?.status;

    if (status === 401 && original && !original._retried && readStoredSession()) {
      original._retried = true;
      const token = await refreshAccessToken();
      if (token) {
        original.headers = {...original.headers, Authorization: `Bearer ${token}`};
        return api.request(original);
      }
      writeStoredSession(null);
      onSessionExpired?.();
    }

    return Promise.reject(error);
  },
);
