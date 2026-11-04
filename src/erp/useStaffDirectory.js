import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { rulesNotice } from './rulesNotice';

/**
 * The staff directory (ERP → Staff), live-loaded once for whichever admin
 * screen needs to pick people — project team assignment, sheet sending, etc.
 *
 * Returns [] in the dev session so pages keep their sample data and never
 * hit Firestore without a signed-in admin.
 */
export function useStaffDirectory() {
  const { isDevSession } = useAuth();
  const live = isFirebaseConfigured && !isDevSession;
  const [staff, setStaff] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!live) return undefined;
    return onSnapshot(collection(db, 'staff'),
      snap => {
        setStaff(snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .filter(s => !s.deleted && s.status !== 'inactive')
          .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))));
        setError('');
      },
      err => {
        console.error('Staff directory listener error', err);
        setError(err.code === 'permission-denied'
          ? rulesNotice('The staff list')
          : (err.message || "Couldn't load the staff list."));
      });
  }, [live]);

  return { staff, error, live };
}

/** Name lookup for the chips/avatars that only carry a staff id. */
export function staffNameOf(staff, id, fallback = '') {
  return staff.find(s => s.id === id)?.name || fallback || '—';
}
