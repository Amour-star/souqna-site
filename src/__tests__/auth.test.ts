import {describe, expect, it} from 'vitest';
import {extractSession} from '@/lib/api/auth';

/**
 * The backend has returned several login response shapes over time. The mobile
 * client tolerates all of them, so these cases pin the same behaviour here —
 * a regression would lock web users out of accounts that work in the app.
 */
describe('extractSession', () => {
  const user = {id: 'u1', name: 'Amer', email: 'a@b.com', role: 2};

  it('reads a token from the response root', () => {
    const session = extractSession({success: true, token: 'jwt', user});
    expect(session?.token).toBe('jwt');
    expect(session?.user.id).toBe('u1');
    expect(session?.user.role).toBe(2);
  });

  it('reads a token nested under data', () => {
    const session = extractSession({success: true, data: {token: 'jwt', user}});
    expect(session?.token).toBe('jwt');
  });

  it('reads a token carried on the user object', () => {
    const session = extractSession({success: true, user: {...user, access_token: 'jwt'}});
    expect(session?.token).toBe('jwt');
  });

  it('falls back to the legacy envelope', () => {
    const session = extractSession({success: true, legacy: {user: {...user, token: 'jwt'}}});
    expect(session?.token).toBe('jwt');
  });

  it('picks up a refresh token under either casing', () => {
    expect(
      extractSession({token: 'jwt', refresh_token: 'r1', user})?.refreshToken,
    ).toBe('r1');
    expect(
      extractSession({token: 'jwt', refreshToken: 'r2', user})?.refreshToken,
    ).toBe('r2');
  });

  it('returns null when there is no token or no user', () => {
    expect(extractSession({success: true, user})).toBeNull();
    expect(extractSession({success: true, token: 'jwt'})).toBeNull();
  });

  it('defaults to the buyer role when the API omits it', () => {
    const session = extractSession({token: 'jwt', user: {id: 'u1', name: 'A', email: 'a@b'}});
    expect(session?.user.role).toBe(3);
  });
});
