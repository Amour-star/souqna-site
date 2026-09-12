import {api} from '@/lib/api/client';
import {FEATURES} from '@/lib/config';
import {firebaseApp} from './firebase';

/**
 * Bridges the Souqna session into Firebase.
 *
 * Chat lives in Firestore, but users authenticate against the Laravel API, so
 * Firestore has no idea who is calling. This exchanges the Laravel JWT for a
 * Firebase custom token whose uid is the same Souqna user id already stored in
 * each conversation's `members` array — which is what lets the security rules
 * in `backend-patch/security/firestore.rules` enforce membership.
 *
 * Until that backend endpoint is deployed the whole thing is a deliberate
 * no-op: chat continues to work under the current rules, and nothing throws.
 */

let signInPromise: Promise<boolean> | null = null;

const requestCustomToken = async (): Promise<string | null> => {
  try {
    const {data} = await api.post('firebase-token');
    const token = data?.data?.token ?? data?.token;
    return typeof token === 'string' && token ? token : null;
  } catch {
    // A 404 simply means the endpoint is not deployed yet.
    return null;
  }
};

/**
 * Signs in to Firebase if the feature is enabled. Resolves to whether a
 * Firebase session is now active. Safe to call repeatedly.
 */
export const ensureFirebaseSession = async (): Promise<boolean> => {
  if (!FEATURES.firebaseAuth) return false;

  if (!signInPromise) {
    signInPromise = (async () => {
      try {
        const token = await requestCustomToken();
        if (!token) return false;

        // Imported lazily so the Firebase Auth SDK is only downloaded by
        // signed-in users on builds where this is switched on.
        const {getAuth, signInWithCustomToken} = await import('firebase/auth');
        await signInWithCustomToken(getAuth(firebaseApp), token);
        return true;
      } catch (error) {
        // Chat must not break because the bridge failed; the rules in force
        // today do not require it.
        console.warn('[chat] Firebase sign-in unavailable:', error);
        return false;
      }
    })();
  }

  return signInPromise;
};

/** Clears the cached attempt so the next login re-authenticates. */
export const resetFirebaseSession = async () => {
  signInPromise = null;
  if (!FEATURES.firebaseAuth) return;
  try {
    const {getAuth, signOut} = await import('firebase/auth');
    await signOut(getAuth(firebaseApp));
  } catch {
    /* nothing to sign out of */
  }
};
