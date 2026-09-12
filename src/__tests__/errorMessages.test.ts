import {beforeEach, describe, expect, it} from 'vitest';
import i18n from '@/lib/i18n';
import {initI18n, changeLanguage} from '@/lib/i18n';
import {errorMessage} from '@/lib/api/errorMessages';

/**
 * The backend answers in English. An Arabic user must never see that raw
 * English text, so these cases pin the translation of the failures users
 * actually hit.
 */

const axiosError = (status: number, data: unknown) => ({
  isAxiosError: true,
  response: {status, data},
});

beforeEach(async () => {
  if (!i18n.isInitialized) await initI18n();
  await changeLanguage('ar');
});

describe('errorMessage in Arabic', () => {
  it('translates a taken-email validation error', async () => {
    const message = errorMessage(
      axiosError(422, {errors: {email: ['The email has already been taken.']}}),
    );
    expect(message).toBe('البريد الإلكتروني مستخدم بالفعل.');
    expect(message).not.toMatch(/[A-Za-z]{4}/);
  });

  it('translates a required-field error with the Arabic field label', () => {
    const message = errorMessage(
      axiosError(422, {errors: {price: ['The price field is required.']}}),
    );
    expect(message).toBe('يرجى إدخال السعر.');
  });

  it('translates invalid credentials', () => {
    expect(errorMessage(axiosError(401, {message: 'Invalid credentials'}))).toBe(
      'بيانات تسجيل الدخول غير صحيحة.',
    );
  });

  it('translates an expired session', () => {
    expect(errorMessage(axiosError(401, {message: 'Unauthenticated'}))).toBe(
      'انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى.',
    );
  });

  it('maps a bare 403 with no message', () => {
    expect(errorMessage(axiosError(403, {}))).toBe('غير مصرح لك بهذا الإجراء.');
  });

  it('maps a 500 to a server message', () => {
    expect(errorMessage(axiosError(500, {}))).toBe(
      'حدث خطأ في الخادم. حاول مرة أخرى بعد قليل.',
    );
  });

  it('reports a connection failure when no response arrived', () => {
    expect(errorMessage({isAxiosError: true})).toBe(
      'تعذر الاتصال بالخادم. تحقق من الإنترنت ثم حاول مرة أخرى.',
    );
  });

  it('translates a Firestore permission error', () => {
    expect(errorMessage({code: 'permission-denied'})).toBe(
      'انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى.',
    );
  });

  it('keeps an Arabic message the backend already sent', () => {
    const arabic = 'الإعلان غير موجود';
    expect(errorMessage(axiosError(422, {message: arabic}))).toBe(arabic);
  });

  it('never leaks an unmatched English backend message into Arabic', () => {
    const message = errorMessage(
      axiosError(422, {message: 'Some unmapped backend failure'}),
    );
    expect(message).toBe('حدث خطأ غير متوقع. حاول مرة أخرى.');
  });

  it('honours a caller-supplied fallback key', () => {
    expect(errorMessage({}, 'auth.invalidCredentials')).toBe(
      'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
    );
  });
});

describe('errorMessage in English', () => {
  beforeEach(async () => {
    await changeLanguage('en');
  });

  it('translates the same validation error into English', () => {
    expect(
      errorMessage(axiosError(422, {errors: {email: ['The email has already been taken.']}})),
    ).toBe('That email address is already registered.');
  });

  it('passes an unmatched backend message through in English mode', () => {
    expect(errorMessage(axiosError(422, {message: 'Some unmapped backend failure'}))).toBe(
      'Some unmapped backend failure',
    );
  });
});
