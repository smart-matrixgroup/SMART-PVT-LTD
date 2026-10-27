import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
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

// ─── SESSION TIMEOUT ─────────────────────────────────────────────
// Auto sign-out is switched OFF: a signed-in portal stays open until the
// user signs out or closes the tab. Set SESSION_MAX_MINUTES to a positive
// number (e.g. 30) to bring the hard cap back — the clock lives in
// sessionStorage (per browser tab, survives refreshes) so refreshing cannot
// buy extra time, and SessionTimeout.jsx renders the countdown + the
// "session ended" dialog automatically whenever the cap is enabled.
export const SESSION_MAX_MINUTES = 0;   // 0 = never cut the session
const SESSION_MAX_MS  = SESSION_MAX_MINUTES * 60 * 1000;
const SESSION_WARN_MS = 5 * 60 * 1000;   // banner starts at 5 minutes left
const START_KEY       = 'smart_session_started';

function readSessionStart() {
  try { return Number(sessionStorage.getItem(START_KEY) || 0); } catch { return 0; }
}
function writeSessionStart(ts) {
  try { sessionStorage.setItem(START_KEY, String(ts)); } catch { /* ignore */ }
}
function clearSessionStart() {
  try { sessionStorage.removeItem(START_KEY); } catch { /* ignore */ }
}

// Shared dev-mock login state setter (Firebase not configured / dev accounts)
function makeDevSessionSetter(setters) {
  return (devAccount) => {
    const uid = devAccount.role === 'admin' ? 'dev-admin-001'
      : devAccount.role === 'staff' ? 'dev-staff-001' : 'dev-client-001';
    const session = { role: devAccount.role, profile: devAccount.profile, uid };
    sessionStorage.setItem('smart_dev_session', JSON.stringify(session));
    writeSessionStart(Date.now());
    setters.setSessionExpiredMsg?.('');
    setters.setCurrentUser({ uid, email: devAccount.email });
    setters.setRole(devAccount.role);
    setters.setClientProfile(devAccount.role === 'client' ? devAccount.profile : null);
    setters.setStaffProfile(devAccount.role === 'staff' ? devAccount.profile : null);
    return { role: devAccount.role };
  };
}

export function AuthProvider({ children }) {
  const [currentUser,    setCurrentUser]    = useState(null);
  const [role,           setRole]           = useState(null);
  const [clientProfile,  setClientProfile]  = useState(null);
  const [staffProfile,   setStaffProfile]   = useState(null);
  const [loading,        setLoading]        = useState(true);
  // Milliseconds left in this tab's session window (null = not signed in,
  // or the cap is switched off — see SESSION_MAX_MINUTES)
  const [sessionRemainingMs, setSessionRemainingMs] = useState(null);
  // Set when the timer ended the session, so the UI can explain itself
  const [sessionExpiredMsg,  setSessionExpiredMsg]  = useState('');

  // ── Absolute session timer (only runs when a cap is configured) ──
  useEffect(() => {
    if (!currentUser) {
      setSessionRemainingMs(null);
      return;
    }
    if (!SESSION_MAX_MINUTES) {
      // Auto sign-out is off. Clear any clock left over from an earlier
      // build so re-enabling the cap later measures from the next login.
      clearSessionStart();
      setSessionRemainingMs(null);
      return;
    }
    let cancelled = false;

    const endSession = () => {
      if (cancelled) return;
      clearSessionStart();
      setSessionRemainingMs(null);
      setSessionExpiredMsg(
        `Your session automatically ended after ${SESSION_MAX_MINUTES} minutes ` +
        'of being signed in, to keep client and staff data safe.'
      );
      setCurrentUser(null);
      setRole(null);
      setClientProfile(null);
      setStaffProfile(null);
      sessionStorage.removeItem('smart_dev_session');
      if (isFirebaseConfigured) firebaseSignOut(auth).catch(err => console.error('auto sign-out failed', err));
    };

    const tick = () => {
      const start = readSessionStart();
      if (!start) { writeSessionStart(Date.now()); return; }
      const left = start + SESSION_MAX_MS - Date.now();
      if (left <= 0) { endSession(); return; }
      setSessionRemainingMs(left);
    };

    tick();
    const iv = setInterval(tick, 1000);   // 1s so the countdown reads smoothly
    return () => { cancelled = true; clearInterval(iv); };
  }, [currentUser]);

  useEffect(() => {
    // ── Always check dev session first (even if Firebase is configured) ──
    try {
      const saved = sessionStorage.getItem('smart_dev_session');
      if (saved) {
        const { role: r, profile: p, uid } = JSON.parse(saved);
        setCurrentUser({ uid, email: p?.email || uid });
        setRole(r);
        setClientProfile(r === 'client' ? p : null);
        setStaffProfile(r === 'staff' ? p : null);
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

      // If role is already set (by login() above), skip re-fetching
      // unless this is a page refresh (currentUser would be null initially)
      setCurrentUser(user);

      if (!user) {
        setRole(null);
        setClientProfile(null);
        setStaffProfile(null);
        setLoading(false);
        return;
      }

      // Only fetch role from Firestore on page refresh (loading=true means fresh load)
      try {
        const adminSnap = await getDoc(doc(db, 'admins', user.uid));
        if (adminSnap.exists() || user.email === 'admin@smart.com') {
          setRole('admin');
          setClientProfile(null);
          setStaffProfile(null);
          setLoading(false);
          return;
        }

        // Staff portal account: staff/{uid} doc, doc id == auth uid
        const staffSnap = await getDoc(doc(db, 'staff', user.uid));
        if (staffSnap.exists() && !staffSnap.data().deleted) {
          setRole('staff');
          setStaffProfile({ id: staffSnap.id, ...staffSnap.data() });
          setClientProfile(null);
          setLoading(false);
          return;
        }

        const clientSnap = await getDoc(doc(db, 'clients', user.uid));
        if (clientSnap.exists()) {
          setRole('client');
          setClientProfile({ id: clientSnap.id, ...clientSnap.data() });
          setStaffProfile(null);
          setLoading(false);
          return;
        }

        setRole(null);
        setClientProfile(null);
        setStaffProfile(null);
      } catch (err) {
        console.error('Auth role lookup failed', err);
        setRole(null);
        setClientProfile(null);
        setStaffProfile(null);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  // ── Live staff profile ───────────────────────────────────────────
  // The role lookup above reads staff/{uid} once. Documents uploaded from
  // the staff portal (and admin verify/delete actions) must appear without
  // a page reload, so keep the staff record in sync while signed in.
  useEffect(() => {
    if (role !== 'staff' || !currentUser?.uid) return;
    if (sessionStorage.getItem('smart_dev_session')) return;
    const un = onSnapshot(doc(db, 'staff', currentUser.uid), snap => {
      if (snap.exists() && !snap.data().deleted) {
        setStaffProfile({ id: snap.id, ...snap.data() });
      }
    }, err => console.error('staff profile live sync failed', err));
    return un;
  }, [role, currentUser?.uid]);

  // ── LOGIN ──────────────────────────────────────────────────────
  const login = async (email, password) => {
    const trimmedEmail = email.toLowerCase().trim();
    const applyDevAccount = makeDevSessionSetter({
      setCurrentUser, setRole, setClientProfile, setStaffProfile, setSessionExpiredMsg,
    });

    // ── Firebase login (always try first if Firebase is configured) ──
    if (isFirebaseConfigured) {
      try {
        const credential = await signInWithEmailAndPassword(auth, trimmedEmail, password);
        sessionStorage.removeItem('smart_dev_session');
        const uid = credential.user.uid;
        // Start this tab's session clock (only used when the cap is on).
        writeSessionStart(Date.now());
        setSessionExpiredMsg('');

        const adminSnap = await getDoc(doc(db, 'admins', uid));
        if (adminSnap.exists() || credential.user.email === 'admin@smart.com') {
          // Set state immediately so ProtectedRoute sees role before redirect
          setCurrentUser(credential.user);
          setRole('admin');
          setClientProfile(null);
          setStaffProfile(null);
          return { role: 'admin' };
        }

        // Staff portal account (staff/{uid}, doc id == auth uid)
        const staffSnap = await getDoc(doc(db, 'staff', uid));
        if (staffSnap.exists() && !staffSnap.data().deleted) {
          const profile = { id: staffSnap.id, ...staffSnap.data() };
          setCurrentUser(credential.user);
          setRole('staff');
          setStaffProfile(profile);
          setClientProfile(null);
          return { role: 'staff', profile };
        }

        const clientSnap = await getDoc(doc(db, 'clients', uid));
        if (clientSnap.exists()) {
          const profile = { id: clientSnap.id, ...clientSnap.data() };
          setCurrentUser(credential.user);
          setRole('client');
          setClientProfile(profile);
          setStaffProfile(null);
          return { role: 'client', profile };
        }

        // Signed in with Firebase but no admin/staff/client doc — reject
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
        if (devAccount) return applyDevAccount(devAccount);

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
    return applyDevAccount(devAccount);
  };

  // ── LOGOUT ─────────────────────────────────────────────────────
  const logout = async () => {
    sessionStorage.removeItem('smart_dev_session');
    clearSessionStart();
    setSessionRemainingMs(null);
    setCurrentUser(null);
    setRole(null);
    setClientProfile(null);
    setStaffProfile(null);
    if (isFirebaseConfigured) {
      await firebaseSignOut(auth);
    }
  };

  // Called from the session-ended dialog so the message clears on the way
  // back to a login screen.
  const dismissSessionExpiry = () => setSessionExpiredMsg('');

  // Export whether current session is a dev mock session
  // Dashboard uses this to skip Firestore queries
  const isDevSession = Boolean(
    typeof window !== 'undefined' && sessionStorage.getItem('smart_dev_session')
  );

  const value = {
    currentUser, role, clientProfile, staffProfile, loading,
    login, logout, isFirebaseConfigured, isDevSession,
    // session timeout: remaining ms, warning threshold, expiry notice
    sessionRemainingMs, sessionWarnMs: SESSION_WARN_MS,
    sessionMaxMinutes: SESSION_MAX_MINUTES,
    sessionExpiredMsg, dismissSessionExpiry,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
