import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Values come from .env (see .env.example). Never hardcode real project
// keys here — Vite only exposes vars prefixed VITE_ to client code.
const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' && process.env ? process.env : {});

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

if (!isFirebaseConfigured && env.DEV) {
  console.warn(
    '[SMART] Firebase env vars are missing. Copy .env.example to .env and fill in ' +
    'your Firebase project config — see Firebase Console > Project Settings.'
  );
}

const dummyConfig = { apiKey: 'AIzaSyD-test-placeholder-key-0000000000', projectId: 'smart-pvt-ltd' };
const app = getApps().length ? getApps()[0] : initializeApp(isFirebaseConfigured ? firebaseConfig : dummyConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// ── Staff account provisioning ─────────────────────────────────────
// createUserWithEmailAndPassword signs the NEW user into the CURRENT
// auth instance, which would kick the admin out of their session.
// The standard workaround is a secondary Firebase app instance: create
// the account there, then sign out of it — the admin session on the
// primary app is untouched.
export async function createStaffAuthAccount(email, password) {
  const existing = getApps().find(a => a.name === 'Secondary');
  const secondary = existing || initializeApp(firebaseConfig, 'Secondary');
  const secondaryAuth = getAuth(secondary);
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    return cred.user.uid;
  } finally {
    await signOut(secondaryAuth).catch(() => {});
  }
}

export async function createClientAuthAccount(email, password) {
  return createStaffAuthAccount(email, password);
}

export default app;
