import {api} from './client';
import type {AuthSession, AuthUser} from '@/types';

/**
 * Authentication against the shared Souqna identity system.
 *
 * These are the same endpoints and payloads the mobile app uses, so an account
 * created on either client works on both. No second user store exists.
 */

const asString = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
};

type Loose = Record<string, any>;

/**
 * Pulls the token/user pair out of a login response. The backend has grown
 * several response shapes over time (root, `data`, `legacy`), and the mobile
 * client tolerates all of them — the web client must do the same.
 */
export const extractSession = (payload: Loose): AuthSession | null => {
  const data: Loose = payload?.data ?? {};
  const rootUser: Loose | null =
    payload?.user && typeof payload.user === 'object' ? payload.user : null;
  const dataUser: Loose | null =
    data?.user && typeof data.user === 'object' ? data.user : null;
  const legacyUser: Loose | null =
    payload?.legacy?.user && typeof payload.legacy.user === 'object'
      ? payload.legacy.user
      : null;
  const user = dataUser ?? rootUser ?? legacyUser;

  const token =
    asString(payload?.token) ??
    asString(payload?.accessToken) ??
    asString(payload?.access_token) ??
    asString(data?.token) ??
    asString(data?.accessToken) ??
    asString(data?.access_token) ??
    asString(user?.token) ??
    asString(user?.accessToken) ??
    asString(user?.access_token);

  if (!token || !user) return null;

  const refreshToken =
    asString(payload?.refreshToken) ??
    asString(payload?.refresh_token) ??
    asString(data?.refreshToken) ??
    asString(data?.refresh_token) ??
    asString(user?.refreshToken) ??
    asString(user?.refresh_token);

  const role = Number(user.role ?? user.actualRole ?? 3);

  return {
    token,
    refreshToken,
    user: {
      id: String(user.id ?? user.userID ?? ''),
      name: asString(user.name) ?? '',
      email: asString(user.email) ?? '',
      avatar: asString(user.avatar),
      role: Number.isFinite(role) ? role : 3,
      actualRole: Number(user.actualRole ?? user.role ?? role) || undefined,
      phone: asString(user.phone) ?? asString(user.phoneNo),
      provider: asString(user.provider),
      status: user.status ?? null,
      created_at: asString(user.created_at),
      emailVerified: Boolean(user.email_verified_at ?? user.emailVerified),
    },
  };
};

export const login = async (email: string, password: string): Promise<AuthSession> => {
  const {data} = await api.post('auth/login', {
    email: email.trim().toLowerCase(),
    password: password.trim(),
    platform: 'web',
    deviceName: 'Souqna Web',
  });

  const session = extractSession(data);
  if (!data?.success || !session) {
    throw new Error(data?.message || 'Login failed');
  }
  return session;
};

export interface RegisterResult {
  requiresVerification: boolean;
  email: string;
  message?: string;
}

export const register = async (input: {
  name: string;
  email: string;
  password: string;
}): Promise<RegisterResult> => {
  const {data} = await api.post('auth/register', {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    password: input.password,
    platform: 'web',
    deviceName: 'Souqna Web',
  });

  if (!data?.success) throw new Error(data?.message || 'Registration failed');

  return {
    requiresVerification: Boolean(data?.data?.requiresVerification ?? data?.otpSent),
    email: data?.data?.email ?? input.email.trim().toLowerCase(),
    message: data?.message,
  };
};

/** Verifies the 4-digit code emailed at registration (or during a reset). */
export const verifyOtp = async (
  email: string,
  otp: string,
  resetPassword = false,
): Promise<{success: boolean; message?: string; token?: string; session?: AuthSession | null}> => {
  const {data} = await api.post('verifyRegisterOtp', {email, otp, resetPassword});
  return {
    success: Boolean(data?.success),
    message: data?.message,
    token: data?.token ?? data?.data?.token ?? data?.resetToken,
    session: data?.success ? extractSession(data) : null,
  };
};

export const resendOtp = async (email: string) => {
  const {data} = await api.post('resendOtp', {email});
  if (!data?.success) throw new Error(data?.message || 'Could not resend the code');
  return data;
};

export const forgotPassword = async (email: string) => {
  const {data} = await api.post('forgotPassword', {email: email.trim().toLowerCase()});
  if (!data?.success) throw new Error(data?.message || 'Could not send the reset code');
  return data;
};

export const resetPassword = async (input: {
  password: string;
  confirmationPassword: string;
  token: string;
}) => {
  const {data} = await api.post('resetPassword', input);
  if (!data?.success) throw new Error(data?.message || 'Could not reset the password');
  return data;
};

export const changePassword = async (oldPassword: string, newPassword: string) => {
  const {data} = await api.post('changePassword', {oldPassword, newPassword});
  if (!data?.success) throw new Error(data?.message || 'Could not change the password');
  return data;
};

/** Normalises a raw user record from the API into the client's shape. */
const toAuthUser = (raw: Loose | null | undefined): AuthUser | null => {
  if (!raw || typeof raw !== 'object' || !raw.id) return null;
  const role = Number(raw.role ?? raw.actualRole ?? 3);

  return {
    id: String(raw.id),
    name: asString(raw.name) ?? '',
    email: asString(raw.email) ?? '',
    avatar: asString(raw.avatar),
    role: Number.isFinite(role) ? role : 3,
    actualRole: Number(raw.actualRole ?? raw.role ?? role) || undefined,
    phone: asString(raw.phone) ?? asString(raw.phoneNo),
    provider: asString(raw.provider),
    status: raw.status ?? null,
    created_at: asString(raw.created_at),
    emailVerified: Boolean(raw.email_verified_at ?? raw.emailVerified),
  };
};

/** Re-reads the signed-in user's profile; the token comes from the interceptor. */
export const fetchCurrentUser = async (): Promise<AuthUser | null> => {
  const {data} = await api.get('auth/user');
  return toAuthUser(data?.data?.user ?? data?.user ?? data?.data ?? null);
};

export const logout = async () => {
  try {
    await api.post('auth/logout');
  } catch {
    /* the local session is cleared regardless of the server's answer */
  }
};

/**
 * Upgrades a buyer account to a seller account so the user can publish
 * listings. `sellerType` 1 = individual, 2 = business — same as mobile.
 */
export const switchToSeller = async (input: {
  password?: string;
  sellerType?: 1 | 2;
}): Promise<AuthSession | null> => {
  const {data} = await api.post('auth/switch-to-seller', {
    role: 2,
    sellerType: input.sellerType ?? 1,
    confirmed: true,
    ...(input.password ? {password: input.password} : {}),
  });
  if (!data?.success) throw new Error(data?.message || 'Could not switch to a seller account');
  return extractSession(data);
};

export const switchToBuyer = async (): Promise<AuthSession | null> => {
  const {data} = await api.post('auth/switch-to-buyer', {role: 3});
  if (!data?.success) throw new Error(data?.message || 'Could not switch to a buyer account');
  return extractSession(data);
};

export const deleteAccount = async () => {
  const {data} = await api.delete('deleteUserAccount');
  if (!data?.success) throw new Error(data?.message || 'Could not delete the account');
  return data;
};

export const updateProfile = async (input: {
  name?: string;
  email?: string;
  phone?: string;
  avatar?: File | null;
}) => {
  const form = new FormData();
  if (input.name) form.append('name', input.name);
  if (input.email) form.append('email', input.email);
  if (input.phone) form.append('phone', input.phone);
  if (input.avatar) form.append('avatar', input.avatar);

  const {data} = await api.post('updateProfile', form, {
    headers: {'Content-Type': 'multipart/form-data'},
  });
  if (!data?.success) throw new Error(data?.message || 'Could not update the profile');
  return data;
};
