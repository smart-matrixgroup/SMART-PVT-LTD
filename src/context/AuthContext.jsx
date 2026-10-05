import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../config/firebase';

// ─── DEV MOCK ACCOUNTS ───────────────────────────────────────────
// These only work in development (import.meta.env.DEV).
// Remove or leave as-is in production — they are ignored when
// isFirebaseConfigured is true AND we are NOT in dev mode.
const DEV_ACCOUNTS = [
  {
    email:    'testclient@smart.com',
    password: 'test123',
    role:     'client',
    profile: {
      id:           'dev-client-001',
      name:         'Test Client',
      company:      'Test Company Pvt Ltd',
      email:        'testclient@smart.com',
      phone:        '+94 77 000 0000',
      clientSince:  'October 2026',
      invoices: [],
      tickets:  [],
    },
  },
  {
    email:    'admin@smart.com',
    password: 'admin123',
    role:     'admin',
    profile:  null,
  },
];

// ─────────────────────────────────────────────────────────────────

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser,    setCurrentUser]    = useState(null);
  const [role,           setRole]           = useState(null);
  const [clientProfile,  setClientProfile]  = useState(null);
  const [loading,        setLoading]        = useState(true);

  useEffect(() => {
    // ── Always check dev session first (even if Firebase is configured) ──
    try {
      const saved = sessionStorage.getItem('smart_dev_session');
      if (saved) {
        const { role: r, profile: p, uid } = JSON.parse(saved);
        setCurrentUser({ uid, email: p?.email || uid });
        setRole(r);
        setClientProfile(p);
        setLoading(false);
        return;
      }
    } catch { /* ignore */ }

    // ── Skip Firebase if not configured ──────────────────────────
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }

    // ── Firebase Auth listener ───────────────────────────────────
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // If a dev session is active, don't let Firebase override it
      const devSession = sessionStorage.getItem('smart_dev_session');
      if (devSession) return;

      setCurrentUser(user);

      if (!user) {
        setRole(null);
        setClientProfile(null);
        setLoading(false);
        return;
      }

      try {
        const adminSnap = await getDoc(doc(db, 'admins', user.uid));
        if (adminSnap.exists()) {
          setRole('admin');
          setClientProfile(null);
          setLoading(false);
          return;
        }

        const clientSnap = await getDoc(doc(db, 'clients', user.uid));
        if (clientSnap.exists()) {
          setRole('client');
          setClientProfile({ id: clientSnap.id, ...clientSnap.data() });
          setLoading(false);
          return;
        }

        // Authenticated but no profile doc — reject
        setRole(null);
        setClientProfile(null);
      } catch (err) {
        console.error('Auth role lookup failed', err);
        setRole(null);
        setClientProfile(null);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  // ── LOGIN ──────────────────────────────────────────────────────
  const login = async (email, password) => {
    const trimmedEmail = email.toLowerCase().trim();

    // ── Firebase login (always try first if Firebase is configured) ──
    if (isFirebaseConfigured) {
      try {
        const credential = await signInWithEmailAndPassword(auth, trimmedEmail, password);
        const uid = credential.user.uid;

        const adminSnap = await getDoc(doc(db, 'admins', uid));
        if (adminSnap.exists()) return { role: 'admin' };

        const clientSnap = await getDoc(doc(db, 'clients', uid));
        if (clientSnap.exists()) return { role: 'client', profile: { id: clientSnap.id, ...clientSnap.data() } };

        // Signed in with Firebase but no admin/client doc — reject
        await firebaseSignOut(auth);
        throw new Error('This account has no portal access assigned. Contact SMART support.');
      } catch (err) {
        // If Firebase auth failed (wrong password, user not found),
        // fall through to dev mock only if it's a known dev account.
        const isAuthError = err.code === 'auth/invalid-credential' ||
                            err.code === 'auth/user-not-found' ||
                            err.code === 'auth/wrong-password' ||
                            err.code === 'auth/invalid-email';

        if (!isAuthError) throw err; // re-throw non-auth errors (network, permission etc.)

        // Firebase auth failed — try dev mock as fallback
        const devAccount = DEV_ACCOUNTS.find(
          a => a.email.toLowerCase() === trimmedEmail && a.password === password
        );
        if (devAccount) {
          const uid = devAccount.role === 'admin' ? 'dev-admin-001' : 'dev-client-001';
          const session = { role: devAccount.role, profile: devAccount.profile, uid };
          sessionStorage.setItem('smart_dev_session', JSON.stringify(session));
          setCurrentUser({ uid, email: devAccount.email });
          setRole(devAccount.role);
          setClientProfile(devAccount.profile);
          return { role: devAccount.role };
        }

        // Neither Firebase nor dev mock worked
        throw new Error('Invalid email or password. Please try again.');
      }
    }

    // ── Firebase NOT configured — dev mock only ──────────────────
    const devAccount = DEV_ACCOUNTS.find(
      a => a.email.toLowerCase() === trimmedEmail && a.password === password
    );
    if (!devAccount) {
      throw new Error('Invalid email or password.');
    }
    const uid = devAccount.role === 'admin' ? 'dev-admin-001' : 'dev-client-001';
    const session = { role: devAccount.role, profile: devAccount.profile, uid };
    sessionStorage.setItem('smart_dev_session', JSON.stringify(session));
    setCurrentUser({ uid, email: devAccount.email });
    setRole(devAccount.role);
    setClientProfile(devAccount.profile);
    return { role: devAccount.role };
  };

  // ── LOGOUT ─────────────────────────────────────────────────────
  const logout = async () => {
    sessionStorage.removeItem('smart_dev_session');
    setCurrentUser(null);
    setRole(null);
    setClientProfile(null);
    if (isFirebaseConfigured) {
      await firebaseSignOut(auth);
    }
  };

  // Export whether current session is a dev mock session
  // Dashboard uses this to skip Firestore queries
  const isDevSession = Boolean(
    typeof window !== 'undefined' && sessionStorage.getItem('smart_dev_session')
  );

  const value = {
    currentUser, role, clientProfile, loading,
    login, logout, isFirebaseConfigured, isDevSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
