import axios from 'axios';
import {api} from './client';
import i18n from '@/lib/i18n';
import {errorMessage} from './errorMessages';

/**
 * Client for the seller-initiated "import my ads from Doushesh" flow.
 *
 * The seller proves the Doushesh profile is theirs by placing a one-time code
 * in one of their own Doushesh ads; only then does the server read their ads.
 * Nothing here talks to Doushesh directly, and no secret lives in this bundle.
 */

/** Only profile links of this exact shape are accepted (mirrors the server). */
const PROFILE_URL = /^https:\/\/(?:www\.)?doushesh\.com\/users\/[A-Za-z0-9_-]{3,64}\/?$/;

export const isDoushProfileUrl = (raw: string): boolean => PROFILE_URL.test(raw.trim());

export type ImportStatus =
  | 'checking'
  | 'pending'
  | 'verifying'
  | 'running'
  | 'importing'
  | 'imported'
  | 'rejected'
  | 'failed'
  | 'expired';

/** States in which the server is still working, so the page keeps polling. */
export const IN_PROGRESS: ImportStatus[] = ['verifying', 'running', 'importing'];

export interface ImportStart {
  requestId: string;
  /** Shown once, e.g. "SOUQNA-482913". The server keeps only a hash of it. */
  code: string;
  expiresAt: string;
  expiresInMinutes: number;
  profileId: string;
  sellerName: string | null;
  maxAttempts: number;
}

export interface ImportProgress {
  requestId: string;
  status: ImportStatus;
  /** Stable machine code for the last problem, e.g. `code_not_found`. */
  error: string | null;
  attemptsLeft: number;
  expiresAt: string;
  phoneMasked: string | null;
  adsFound: number;
  imported: number;
  skipped: number;
  duplicates: number;
}

/** Server error codes the page can explain in the user's language. */
export const IMPORT_ERROR_CODES = [
  'disabled',
  'validation',
  'consent_required',
  'invalid_profile_url',
  'rate_limited_ip',
  'rate_limited_profile',
  'already_running',
  'profile_not_found',
  'no_ads',
  'source_unavailable',
  'not_found',
  'code_expired',
  'too_many_attempts',
  'not_pending',
  'code_not_found',
  'no_phone_on_ad',
  'phone_mismatch',
  'internal_error',
  'job_failed',
  'timeout',
] as const;

/** Turns a server error code into a message in the current language. */
export const importErrorText = (code: string | null | undefined): string | null => {
  if (!code) return null;
  const key = `import.error.${code}`;
  const text = i18n.t(key);
  return text === key ? i18n.t('import.error.generic') : text;
};

/** Failed request -> message. Prefers the server's stable `code`, then falls back to the shared mapper. */
export const importErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const code = (error.response?.data as {code?: string} | undefined)?.code;
    const text = importErrorText(code);
    if (text) return text;
  }
  return errorMessage(error);
};

interface RawProgress {
  request_id: string;
  status: ImportStatus;
  error: string | null;
  attempts_left: number;
  expires_at: string;
  phone_masked: string | null;
  ads_found: number;
  imported: number;
  skipped: number;
  duplicates: number;
}

const toProgress = (raw: RawProgress): ImportProgress => ({
  requestId: raw.request_id,
  status: raw.status,
  error: raw.error ?? null,
  attemptsLeft: raw.attempts_left,
  expiresAt: raw.expires_at,
  phoneMasked: raw.phone_masked ?? null,
  adsFound: raw.ads_found ?? 0,
  imported: raw.imported ?? 0,
  skipped: raw.skipped ?? 0,
  duplicates: raw.duplicates ?? 0,
});

/** Step 1: ask for a code for this profile. `consent` must be true; the server records when and from where. */
export const startImport = async (profileUrl: string, consent: boolean): Promise<ImportStart> => {
  const {data} = await api.post('import/start', {profile_url: profileUrl.trim(), consent});
  const d = data.data;
  return {
    requestId: d.request_id,
    code: d.code,
    expiresAt: d.expires_at,
    expiresInMinutes: d.expires_in_minutes,
    profileId: d.profile_id,
    sellerName: d.seller_name ?? null,
    maxAttempts: d.max_attempts,
  };
};

/** Step 2: "I added the code" -- the server queues the check and the import. */
export const verifyImport = async (requestId: string): Promise<ImportProgress> => {
  const {data} = await api.post('import/verify', {request_id: requestId});
  return toProgress(data.data);
};

export const getImportStatus = async (requestId: string): Promise<ImportProgress> => {
  const {data} = await api.get(`import/status/${encodeURIComponent(requestId)}`);
  return toProgress(data.data);
};

// --- keeping the code across a page reload -------------------------------------------------------
// The server shows the code only once. If the seller reloads before finishing they would otherwise lose it
// and burn one of their hourly requests. sessionStorage is per-tab and is cleared when the tab closes.

const KEY = 'souqna.import.pending';

export const saveImportSession = (start: ImportStart) => {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(start));
  } catch {
    /* private mode: the flow still works, it just cannot survive a reload */
  }
};

export const loadImportSession = (): ImportStart | null => {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ImportStart;
    if (!parsed?.requestId || !parsed.code || Date.parse(parsed.expiresAt) <= Date.now()) {
      window.sessionStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const clearImportSession = () => {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
};
