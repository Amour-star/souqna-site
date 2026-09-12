import {getApp, getApps, initializeApp} from 'firebase/app';
import {getFirestore} from 'firebase/firestore';

/**
 * The same Firebase project the mobile app uses. Chat documents written from
 * the web are read by the app and vice versa, so this config must not diverge
 * from `src/config/firebase.ts` in the React Native repository.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyBpgnYdvj7nzNDqOYXKWP2lL1lgxK_cLUM',
  authDomain: 'souqnaapp-2c1da.firebaseapp.com',
  projectId: 'souqnaapp-2c1da',
  storageBucket: 'souqnaapp-2c1da.firebasestorage.app',
  messagingSenderId: '560637546499',
  appId: '1:560637546499:web:3f157609cf958e89e8fe36',
  measurementId: 'G-DK9MB4K8KW',
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);
