import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../config/firebase';

// Role is resolved by document existence, not Firebase custom claims —
// custom claims require a Cloud Functions / Admin SDK backend to mint,
// which this project doesn't run. Instead:
//   admins/{uid}   -> presence means the signed-in user is an admin
//   clients/{uid}  -> client profile (projects, invoices, tickets)
// See firestore.rules for the matching access rules.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [role, setRole] = useState(null);       // 'admin' | 'client' | null
  const [clientProfile, setClientProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
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

        // Authenticated with Firebase but no matching profile doc —
        // treat as unauthorized rather than silently granting access.
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

  const login = async (email, password) => {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const uid = credential.user.uid;

    const adminSnap = await getDoc(doc(db, 'admins', uid));
    if (adminSnap.exists()) return { role: 'admin' };

    const clientSnap = await getDoc(doc(db, 'clients', uid));
    if (clientSnap.exists()) return { role: 'client', profile: { id: clientSnap.id, ...clientSnap.data() } };

    // Signed in with valid Firebase credentials but has no admin/client
    // profile provisioned — sign out immediately and reject.
    await firebaseSignOut(auth);
    throw new Error('This account has no portal access assigned. Contact SMART support.');
  };

  const logout = () => firebaseSignOut(auth);

  const value = { currentUser, role, clientProfile, loading, login, logout, isFirebaseConfigured };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
