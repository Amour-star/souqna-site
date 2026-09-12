import type {AxiosError} from 'axios';
import i18n from '@/lib/i18n';

/**
 * Turns a failed request into a message in the user's language.
 *
 * The backend answers in English, so showing `response.data.message` verbatim
 * put English text in front of Arabic users. This mirrors the mapping the
 * mobile app does in `src/util/errorMapper.js`, with one difference: mobile
 * hardcodes Arabic, while the web resolves through i18n so both languages are
 * served from the same table.
 */

/** Backend phrases, in priority order, mapped to translation keys. */
const BACKEND_PATTERNS: {pattern: RegExp; key: string}[] = [
  {pattern: /invalid credentials|unauthorized|unauthorised/i, key: 'error.invalidCredentials'},
  {
    pattern: /invalid or expired access token|session has expired|please login again|unauthenticated/i,
    key: 'error.sessionExpired',
  },
  {pattern: /forbidden/i, key: 'error.forbidden'},
  {pattern: /email.*(taken|already)/i, key: 'error.emailTaken'},
  {pattern: /password.*(min|short|at least|\b\d+\b characters)/i, key: 'error.passwordTooShort'},
  {pattern: /invalid sub.?category/i, key: 'error.invalidSubCategory'},
  {pattern: /invalid category/i, key: 'error.invalidCategory'},
  {
    pattern: /custom[_ ]?fields?.*invalid|invalid custom_fields|custom field must have name and value/i,
    key: 'error.invalidCustomFields',
  },
  {
    pattern: /image.*(size|type|max|upload)|greater than 2048 kilobytes|max:2048/i,
    key: 'error.imageTooLarge',
  },
  {pattern: /chat member|chat|conversation/i, key: 'error.chatStartFailed'},
  {pattern: /network error|timeout/i, key: 'error.network'},
  {pattern: /blocked|disabled/i, key: 'error.blocked'},
];

/** Laravel validation field names mapped to readable labels. */
const fieldLabel = (field: string): string => {
  const normalized = field.replace(/\.\d+$/, '').split('.')[0];
  const key = `field.${normalized}`;
  const translated = i18n.t(key);
  return translated === key ? i18n.t('field.generic') : translated;
};

/** Converts a Laravel `errors` bag into one readable sentence. */
const fromValidationErrors = (
  errors: Record<string, string[] | string> | undefined,
): string | null => {
  if (!errors || typeof errors !== 'object') return null;

  const first = Object.entries(errors)[0];
  if (!first) return null;

  const [field, messages] = first;
  const message = Array.isArray(messages) ? messages[0] : messages;
  const label = fieldLabel(field);

  if (typeof message !== 'string') return i18n.t('error.fieldInvalid', {field: label});
  if (/required/i.test(message)) return i18n.t('error.fieldRequired', {field: label});
  if (/image|mimes|mime|jpg|jpeg|png|gif|svg/i.test(message)) return i18n.t('error.imageFormat');
  if (/2048|kilobytes|max/i.test(message)) return i18n.t('error.imageTooLarge');

  // Try the generic phrase table before giving up on the server's wording.
  const matched = BACKEND_PATTERNS.find(entry => entry.pattern.test(message));
  if (matched) return i18n.t(matched.key);

  return i18n.t('error.fieldInvalid', {field: label});
};

interface ErrorBody {
  message?: string;
  error?: string;
  errors?: Record<string, string[] | string>;
}

/**
 * The single entry point for showing an error to the user.
 *
 * @param fallbackKey translation key used when nothing more specific matches.
 */
export const errorMessage = (error: unknown, fallbackKey = 'error.unexpected'): string => {
  const axiosError = error as AxiosError<ErrorBody>;
  const response = axiosError?.response;

  // Firestore and other non-HTTP failures carry a `code` instead.
  const code = (error as {code?: string})?.code;
  if (code && !response) {
    if (/permission.denied|unauthenticated|unauthorized/i.test(code)) {
      return i18n.t('error.sessionExpired');
    }
    if (/unavailable|network|deadline.exceeded|connection|ECONNABORTED/i.test(code)) {
      return i18n.t('error.network');
    }
  }

  if (!response) {
    // No response at all means the request never reached the server.
    if (axiosError?.isAxiosError) return i18n.t('error.network');
    return i18n.t(fallbackKey);
  }

  const validation = fromValidationErrors(response.data?.errors);
  if (validation) return validation;

  const serverMessage = response.data?.message || response.data?.error || '';
  const matched = BACKEND_PATTERNS.find(entry => entry.pattern.test(serverMessage));
  if (matched) return i18n.t(matched.key);

  switch (response.status) {
    case 401:
      return i18n.t('error.sessionExpired');
    case 403:
      return i18n.t('error.forbidden');
    case 404:
      return i18n.t('error.notFound');
    case 500:
    case 502:
    case 503:
      return i18n.t('error.serverError');
    default:
      break;
  }

  // Arabic responses from the backend are already in the right language; an
  // unmatched English one is still better than a generic message in English
  // mode, but not in Arabic mode.
  if (serverMessage) {
    const isArabicText = /[؀-ۿ]/.test(serverMessage);
    if (isArabicText || i18n.language !== 'ar') return serverMessage;
  }

  return i18n.t(fallbackKey);
};
