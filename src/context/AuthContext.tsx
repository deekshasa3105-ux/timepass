import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import {
  auth,
  db,
  signInWithGoogle as firebaseGoogleSignIn,
  linkGoogleAccount as firebaseLinkGoogle,
  signInWithEmailPassword as firebaseEmailSignIn,
  signUpWithEmailPassword as firebaseEmailSignUp,
  signOutUser as firebaseSignOut,
} from '../firebase/config';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  isAnonymous?: boolean;
  providerData?: { providerId: string; email?: string | null }[];
  isGoogle?: boolean;
  role?: 'admin' | 'citizen' | 'company';
  isAdmin?: boolean;
  isCompany?: boolean;
  companyName?: string;
}

export const AUTHORIZED_ADMIN_EMAILS = [
  'admin@gmail.com',
];
export const ADMIN_EMAIL = 'admin@gmail.com';
export const ADMIN_PASSWORD = '123456';

interface AuthContextType {
  user: User | AppUser | null;
  loading: boolean;
  isGoogleUser: boolean;
  isEmailUser: boolean;
  isAdmin: boolean;
  isCompany: boolean;
  companyName: string | null;
  adminEmail: string;
  adminPassword: string;
  authorizedAdminEmails: string[];
  signInWithGoogle: () => Promise<User | null>;
  linkGoogleAccount: () => Promise<User | null>;
  signInWithEmailPassword: (email: string, password: string) => Promise<User | null>;
  signUpWithEmailPassword: (email: string, password: string, displayName?: string) => Promise<User | null>;
  signInWithSimpleEmail: (email: string, displayName?: string) => Promise<AppUser>;
  signInAsAdmin: (email: string, password: string) => Promise<AppUser>;
  signInAsCompany: (companyName: string, email: string, password?: string) => Promise<AppUser>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isGoogleUser: false,
  isEmailUser: false,
  isAdmin: false,
  isCompany: false,
  companyName: null,
  adminEmail: ADMIN_EMAIL,
  adminPassword: ADMIN_PASSWORD,
  authorizedAdminEmails: AUTHORIZED_ADMIN_EMAILS,
  signInWithGoogle: async () => null,
  linkGoogleAccount: async () => null,
  signInWithEmailPassword: async () => null,
  signUpWithEmailPassword: async () => null,
  signInWithSimpleEmail: async () => ({} as AppUser),
  signInAsAdmin: async () => ({} as AppUser),
  signInAsCompany: async () => ({} as AppUser),
  signOutUser: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Link any locally reported incidents on this device to the authenticated Google account
  const linkLocalReportsToUser = async (googleUser: User) => {
    try {
      const stored = localStorage.getItem('civicpulse_my_report_ids');
      if (!stored) return;
      const ids: string[] = JSON.parse(stored);
      if (Array.isArray(ids) && ids.length > 0 && googleUser.email) {
        for (const reportId of ids) {
          try {
            const reportRef = doc(db, 'issues', reportId);
            await updateDoc(reportRef, {
              reportedBy: googleUser.uid,
              reporterEmail: googleUser.email,
              reporterName: googleUser.displayName || googleUser.email.split('@')[0],
              reporterPhotoUrl: googleUser.photoURL || null,
              isGoogleVerified: true,
            });
          } catch {
            // non-fatal
          }
        }
      }
    } catch {
      // non-fatal
    }
  };

  // Sync authenticated user into Firestore `users` collection
  const syncUserToFirestore = async (fbUser: User | AppUser, isGoogle: boolean) => {
    try {
      const userRef = doc(db, 'users', fbUser.uid);
      await setDoc(
        userRef,
        {
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Verified Citizen',
          photoURL: fbUser.photoURL || null,
          isGoogleVerified: isGoogle,
          isEmailVerified: !isGoogle && Boolean(fbUser.email),
          lastActiveAt: serverTimestamp(),
        },
        { merge: true }
      );

      if (isGoogle && 'getIdToken' in fbUser) {
        await linkLocalReportsToUser(fbUser as User);
      }
    } catch (e) {
      console.warn('Could not sync user profile to Firestore:', e);
    }
  };

  useEffect(() => {
    // Check if a company user was previously signed in
    const storedCompanyUser = localStorage.getItem('civicpulse_company_user');
    if (storedCompanyUser) {
      try {
        const parsed = JSON.parse(storedCompanyUser);
        if (parsed?.uid && (parsed?.role === 'company' || parsed?.isCompany)) {
          setUser(parsed);
          setLoading(false);
          return;
        }
      } catch {
        // ignore
      }
    }

    // Check if a municipal administrator was previously signed in
    const storedAdminUser = localStorage.getItem('civicpulse_admin_user');
    if (storedAdminUser) {
      try {
        const parsed = JSON.parse(storedAdminUser);
        if (parsed?.uid && (parsed?.role === 'admin' || parsed?.isAdmin)) {
          setUser(parsed);
          setLoading(false);
          return;
        }
      } catch {
        // ignore
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser && !currentUser.isAnonymous) {
        setUser(currentUser);
        setLoading(false);
        const isGoogle = currentUser.providerData.some(
          (p) => p.providerId === 'google.com' || p.providerId === 'google'
        );
        await syncUserToFirestore(currentUser, isGoogle);
      } else {
        // Check if a company was previously signed in
        const storedComp = localStorage.getItem('civicpulse_company_user');
        if (storedComp) {
          try {
            const parsed = JSON.parse(storedComp);
            if (parsed?.uid && (parsed?.role === 'company' || parsed?.isCompany)) {
              setUser(parsed);
              setLoading(false);
              return;
            }
          } catch {
            // ignore
          }
        }

        // Check if an email resident citizen was previously signed in
        const storedEmailUser = localStorage.getItem('civicpulse_email_user');
        if (storedEmailUser) {
          try {
            const parsed = JSON.parse(storedEmailUser);
            if (parsed?.uid && parsed?.email) {
              setUser(parsed);
            } else {
              setUser(null);
            }
          } catch {
            setUser(null);
          }
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const isGoogleUser = Boolean(
    user &&
    !user.isAnonymous &&
    ((user as any).isGoogle ||
      user.providerData?.some((p) => p.providerId === 'google.com' || p.providerId === 'google'))
  );

  const isAdmin = Boolean(
    user &&
    (AUTHORIZED_ADMIN_EMAILS.some((adm) => adm.toLowerCase() === user.email?.toLowerCase()) ||
      (user as any).role === 'admin' ||
      (user as any).isAdmin === true)
  );

  const isCompany = Boolean(
    user &&
    ((user as any).role === 'company' ||
      (user as any).isCompany === true)
  );

  const companyName = isCompany ? (user as any).companyName || user?.displayName || null : null;

  const isEmailUser = Boolean(user && !isGoogleUser && !isAdmin && !isCompany && Boolean(user.email));

  const signInWithGoogle = async (): Promise<User | null> => {
    try {
      localStorage.removeItem('civicpulse_email_user');
      localStorage.removeItem('civicpulse_admin_user');
      localStorage.removeItem('civicpulse_company_user');
      const loggedUser = await firebaseGoogleSignIn();
      if (loggedUser) {
        setUser(loggedUser);
        await syncUserToFirestore(loggedUser, true);
      }
      return loggedUser;
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        console.info('Google sign-in popup dismissed by user');
        return null;
      }
      console.error('Google Sign-in failed:', err);
      throw err;
    }
  };

  const linkGoogleAccount = async (): Promise<User | null> => {
    try {
      localStorage.removeItem('civicpulse_email_user');
      localStorage.removeItem('civicpulse_company_user');
      const loggedUser = await firebaseLinkGoogle();
      if (loggedUser) {
        setUser(loggedUser);
        await syncUserToFirestore(loggedUser, true);
      }
      return loggedUser;
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return null;
      }
      console.error('Link Google account failed:', err);
      throw err;
    }
  };

  const signInWithEmailPassword = async (email: string, pass: string): Promise<User | null> => {
    const cleanEmail = email.trim().toLowerCase();
    localStorage.removeItem('civicpulse_email_user');
    localStorage.removeItem('civicpulse_admin_user');
    localStorage.removeItem('civicpulse_company_user');

    if (cleanEmail === ADMIN_EMAIL.toLowerCase() && pass === ADMIN_PASSWORD) {
      const adminUser = await signInAsAdmin(cleanEmail, pass);
      return adminUser as unknown as User;
    }

    const loggedUser = await firebaseEmailSignIn(email, pass);
    if (loggedUser) {
      setUser(loggedUser);
      await syncUserToFirestore(loggedUser, false);
    }
    return loggedUser;
  };

  const signUpWithEmailPassword = async (
    email: string,
    pass: string,
    displayName?: string
  ): Promise<User | null> => {
    localStorage.removeItem('civicpulse_email_user');
    localStorage.removeItem('civicpulse_admin_user');
    localStorage.removeItem('civicpulse_company_user');
    const newUser = await firebaseEmailSignUp(email, pass, displayName);
    if (newUser) {
      setUser(newUser);
      await syncUserToFirestore(newUser, false);
    }
    return newUser;
  };

  const signInWithSimpleEmail = async (email: string, displayName?: string): Promise<AppUser> => {
    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail === ADMIN_EMAIL.toLowerCase()) {
      throw new Error('This administrator account requires password verification. Please sign in via Admin Access.');
    }
    const name = displayName?.trim() || cleanEmail.split('@')[0];

    // Compute consistent citizen ID
    let hash = 0;
    for (let i = 0; i < cleanEmail.length; i++) {
      hash = (hash << 5) - hash + cleanEmail.charCodeAt(i);
      hash |= 0;
    }
    const cleanUid = 'citizen_' + Math.abs(hash).toString(36) + '_' + cleanEmail.replace(/[^a-z0-9]/g, '').slice(0, 10);

    const citizenUser: AppUser = {
      uid: cleanUid,
      email: cleanEmail,
      displayName: name,
      photoURL: null,
      isGoogle: false,
      role: 'citizen',
      isAdmin: false,
      isCompany: false,
      providerData: [{ providerId: 'password', email: cleanEmail }],
    };

    localStorage.removeItem('civicpulse_admin_user');
    localStorage.removeItem('civicpulse_company_user');
    localStorage.setItem('civicpulse_email_user', JSON.stringify(citizenUser));
    setUser(citizenUser);
    await syncUserToFirestore(citizenUser, false);
    return citizenUser;
  };

  const signInAsAdmin = async (email: string, pass: string): Promise<AppUser> => {
    const cleanEmail = email.trim().toLowerCase();

    // Enforce designated municipal administrator email
    const isAuthorized = AUTHORIZED_ADMIN_EMAILS.some((adm) => adm.toLowerCase() === cleanEmail);
    if (!isAuthorized) {
      throw new Error(
        'Access Denied: Special admin access is restricted to authorized municipal administrator accounts.'
      );
    }

    if (pass !== ADMIN_PASSWORD) {
      throw new Error('Invalid administrator password. Access denied.');
    }

    const adminUser: AppUser = {
      uid: 'admin_municipal_' + Math.abs(cleanEmail.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)).toString(36),
      email: cleanEmail,
      displayName: 'Municipal Authority / City Admin',
      photoURL: null,
      isGoogle: false,
      role: 'admin',
      isAdmin: true,
      isCompany: false,
      providerData: [{ providerId: 'password', email: cleanEmail }],
    };

    localStorage.removeItem('civicpulse_email_user');
    localStorage.removeItem('civicpulse_company_user');
    localStorage.setItem('civicpulse_admin_user', JSON.stringify(adminUser));
    setUser(adminUser);
    await syncUserToFirestore(adminUser, false);
    return adminUser;
  };

  const signInAsCompany = async (
    compName: string,
    email: string,
    _pass?: string
  ): Promise<AppUser> => {
    const cleanName = compName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      throw new Error('Please enter your Company Name.');
    }
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      throw new Error('Please enter a valid company contact email address.');
    }

    // Generate consistent company UID from email & company name
    let hash = 0;
    const combinedStr = cleanEmail + '_' + cleanName.toLowerCase();
    for (let i = 0; i < combinedStr.length; i++) {
      hash = (hash << 5) - hash + combinedStr.charCodeAt(i);
      hash |= 0;
    }
    const cleanSuffix = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
    const cleanUid = 'company_' + Math.abs(hash).toString(36) + (cleanSuffix ? '_' + cleanSuffix : '');

    const companyUser: AppUser = {
      uid: cleanUid,
      email: cleanEmail,
      displayName: cleanName,
      companyName: cleanName,
      photoURL: null,
      isGoogle: false,
      role: 'company',
      isCompany: true,
      isAdmin: false,
      providerData: [{ providerId: 'company', email: cleanEmail }],
    };

    localStorage.removeItem('civicpulse_email_user');
    localStorage.removeItem('civicpulse_admin_user');
    localStorage.setItem('civicpulse_company_user', JSON.stringify(companyUser));
    setUser(companyUser);
    await syncUserToFirestore(companyUser, false);
    return companyUser;
  };

  const signOutUser = async (): Promise<void> => {
    try {
      localStorage.removeItem('civicpulse_email_user');
      localStorage.removeItem('civicpulse_admin_user');
      localStorage.removeItem('civicpulse_company_user');
      await firebaseSignOut();
      setUser(null);
    } catch (err) {
      console.error('Sign out error:', err);
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isGoogleUser,
        isEmailUser,
        isAdmin,
        isCompany,
        companyName,
        adminEmail: ADMIN_EMAIL,
        adminPassword: ADMIN_PASSWORD,
        authorizedAdminEmails: AUTHORIZED_ADMIN_EMAILS,
        signInWithGoogle,
        linkGoogleAccount,
        signInWithEmailPassword,
        signUpWithEmailPassword,
        signInWithSimpleEmail,
        signInAsAdmin,
        signInAsCompany,
        signOutUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
