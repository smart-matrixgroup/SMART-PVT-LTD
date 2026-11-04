// ─────────────────────────────────────────────────────────────────
//  Moving a staff login address to a new email.
//
//  Firebase only lets an account change its own email while that very user
//  is signed in, and this app has no Admin-SDK backend, so an admin simply
//  cannot rewrite somebody else's login. The flow instead is:
//
//    1. admin types the new address on the staff profile → it is STAGED as
//       staff/{uid}.pendingLoginEmail and added to emailChangeLog;
//    2. the staff member (signed in with the old address) confirms it once
//       here, with their current password;
//    3. the Firebase Auth account moves to the new address and the staff
//       record is written to match, limited by firestore.rules to exactly
//       the staged value.
//
//  The auth uid never changes, so staff/{uid}, attendance, daily reports,
//  leave and salary history all keep pointing at the same person, and the
//  old address keeps working until step 2 succeeds.
// ─────────────────────────────────────────────────────────────────
import { EmailAuthProvider, reauthenticateWithCredential, updateEmail } from 'firebase/auth';
import { doc, getDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { emailError, loginMailOf, sameEmail } from '../erp/emailPolicy';
import { isRulesDenied, staffRulesNotice } from '../erp/rulesNotice';

/**
 * Move the signed-in staff account to `newEmail`.
 * Throws an Error with a message safe to show in the portal.
 */
export async function applyLoginEmailChange({ uid, newEmail, password }) {
  const to = String(newEmail || '').trim();
  const bad = emailError(to);
  if (bad) throw new Error(bad);
  if (!password) throw new Error('Enter your current password to confirm.');

  const user = auth.currentUser;
  if (!user) throw new Error('Your session ended — please sign in again and confirm.');
  if (sameEmail(user.email, to)) throw new Error('That is already your login email.');

  // Proof of identity first: changing an email is a sensitive operation and
  // Firebase refuses it on an old session.
  try {
    await reauthenticateWithCredential(
      user,
      EmailAuthProvider.credential(String(user.email || ''), password),
    );
  } catch (e) {
    if (e?.code === 'auth/wrong-password' || e?.code === 'auth/invalid-credential') {
      throw new Error('That password is not correct.');
    }
    if (e?.code === 'auth/user-not-found') throw new Error('This login account no longer exists.');
    throw new Error(e?.message || 'Could not verify your password.');
  }

  try {
    await updateEmail(user, to);
  } catch (e) {
    if (e?.code === 'auth/email-already-in-use') {
      throw new Error('Another account already uses that email. Ask your admin for a different one.');
    }
    if (e?.code === 'auth/requires-recent-login') {
      throw new Error('Please sign out and sign in again, then confirm the change right away.');
    }
    throw new Error(e?.message || 'Could not move the login email.');
  }

  // The auth account moved. Copy it onto the staff record — the rules only
  // accept the address the admin staged, so a mismatch here is rejected.
  const snap = await getDoc(doc(db, 'staff', uid));
  const before = snap.data() || {};
  const staged = String(before.pendingLoginEmail || '').trim();
  if (!staged) throw new Error('There is no email change waiting to be confirmed.');
  if (!sameEmail(staged, to)) throw new Error('Your admin staged a different address — ask them to re-check it.');

  const from = loginMailOf(before);
  try {
    await updateDoc(doc(db, 'staff', uid), {
      loginEmail: to,
      email: to,
      pendingLoginEmail: null,
      pendingLoginEmailAt: null,
      emailChangeLog: arrayUnion({
        from, to, state: 'Applied',
        by: from || 'staff portal',
        at: new Date().toISOString(),
      }),
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    // The Firebase account already moved, so say exactly what is left to do.
    if (isRulesDenied(e)) {
      throw new Error(`You can sign in as ${to} now, but ${staffRulesNotice('saving the staff record')}`);
    }
    throw new Error(e?.message || 'The login email changed but the staff record could not be saved.');
  }

  return to;
}
