import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  User,
  linkWithPopup,
} from 'firebase/auth';
import firebaseAppletConfig from '../../firebase-applet-config.json';

// Authoritative Firebase Configuration from provisioned applet
const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY as string) || firebaseAppletConfig.apiKey,
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string) || firebaseAppletConfig.authDomain,
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string) || firebaseAppletConfig.projectId,
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string) || firebaseAppletConfig.storageBucket,
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || firebaseAppletConfig.messagingSenderId,
  appId: (import.meta.env.VITE_FIREBASE_APP_ID as string) || firebaseAppletConfig.appId,
};

export const databaseId = (import.meta.env.VITE_FIREBASE_DATABASE_ID as string) || firebaseAppletConfig.firestoreDatabaseId;
export const oAuthClientId = firebaseAppletConfig.oAuthClientId;

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Use the specific provisioned Firestore database ID
export const db = getFirestore(app, databaseId);
export const storage = getStorage(app);
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Sign in using Google OAuth with automatic fallback to GIS
 */
export const signInWithGoogle = async (): Promise<User | null> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err: any) {
    const code = err?.code || '';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      console.info('Google sign-in popup dismissed by user');
      return null;
    }

    console.warn('Firebase popup encountered notice, trying Google Identity Services fallback...', err);

    // Fallback: Google Identity Services (GIS)
    const gWindow = window as any;
    if (gWindow.google?.accounts?.id && oAuthClientId) {
      return new Promise<User | null>((resolve, reject) => {
        try {
          gWindow.google.accounts.id.initialize({
            client_id: oAuthClientId,
            auto_select: false,
            callback: async (tokenResponse: any) => {
              if (tokenResponse?.credential) {
                try {
                  const credential = GoogleAuthProvider.credential(tokenResponse.credential);
                  const cred = await signInWithCredential(auth, credential);
                  resolve(cred.user);
                } catch (credErr) {
                  reject(credErr);
                }
              } else {
                resolve(null);
              }
            },
          });
          gWindow.google.accounts.id.prompt((notification: any) => {
            if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
              // Try oauth2 token client fallback
              if (gWindow.google?.accounts?.oauth2) {
                try {
                  const client = gWindow.google.accounts.oauth2.initTokenClient({
                    client_id: oAuthClientId,
                    scope: 'email profile openid',
                    callback: async (tResp: any) => {
                      if (tResp?.access_token) {
                        try {
                          const credential = GoogleAuthProvider.credential(null, tResp.access_token);
                          const cred = await signInWithCredential(auth, credential);
                          resolve(cred.user);
                        } catch (cErr) {
                          reject(cErr);
                        }
                      } else {
                        resolve(null);
                      }
                    },
                    error_callback: () => resolve(null),
                  });
                  client.requestAccessToken({ prompt: 'select_account' });
                } catch (oauthErr) {
                  reject(oauthErr);
                }
              } else {
                resolve(null);
              }
            }
          });
        } catch (gisErr) {
          reject(gisErr);
        }
      });
    }

    throw err;
  }
};

/**
 * Link current user session to Google Account
 */
export const linkGoogleAccount = async (): Promise<User | null> => {
  if (auth.currentUser && !auth.currentUser.isAnonymous) {
    try {
      const result = await linkWithPopup(auth.currentUser, googleProvider);
      return result.user;
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/credential-already-in-use' || code === 'auth/provider-already-linked') {
        const result = await signInWithPopup(auth, googleProvider);
        return result.user;
      }
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return null;
      }
      throw err;
    }
  }
  return signInWithGoogle();
};

/**
 * Sign in using Firebase Email & Password
 */
export const signInWithEmailPassword = async (email: string, pass: string): Promise<User> => {
  const result = await signInWithEmailAndPassword(auth, email.trim(), pass);
  return result.user;
};

/**
 * Create a new account using Firebase Email & Password
 */
export const signUpWithEmailPassword = async (
  email: string,
  pass: string,
  displayName?: string
): Promise<User> => {
  const result = await createUserWithEmailAndPassword(auth, email.trim(), pass);
  if (displayName?.trim() && result.user) {
    try {
      await updateProfile(result.user, { displayName: displayName.trim() });
    } catch (e) {
      console.warn('Could not update user display name:', e);
    }
  }
  return result.user;
};

/**
 * Sign out the current user session
 */
export const signOutUser = async (): Promise<void> => {
  localStorage.removeItem('civicpulse_email_user');
  localStorage.removeItem('civicpulse_admin_user');
  await signOut(auth);
};

// Initialize or retrieve persistent device/client UID for voting & reporting
export const ensureAuth = async (): Promise<string> => {
  if (auth.currentUser) {
    return auth.currentUser.uid;
  }
  // Check if a municipal administrator is signed in
  const adminUserRaw = localStorage.getItem('civicpulse_admin_user');
  if (adminUserRaw) {
    try {
      const adminUser = JSON.parse(adminUserRaw);
      if (adminUser?.uid) return adminUser.uid;
    } catch {
      // ignore
    }
  }
  // Check if an email resident citizen is signed in
  const emailUserRaw = localStorage.getItem('civicpulse_email_user');
  if (emailUserRaw) {
    try {
      const emailUser = JSON.parse(emailUserRaw);
      if (emailUser?.uid) return emailUser.uid;
    } catch {
      // ignore
    }
  }
  let guestId = localStorage.getItem('civicpulse_guest_id');
  if (!guestId) {
    guestId = 'citizen_' + Math.random().toString(36).substring(2, 10);
    localStorage.setItem('civicpulse_guest_id', guestId);
  }
  return guestId;
};
