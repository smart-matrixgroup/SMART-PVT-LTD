import { useEffect, useState } from 'react';
import { getStorage, ref, getBytes } from 'firebase/storage';

// ─────────────────────────────────────────────────────────────────
//  Private Storage viewer — no public URLs, ever.
//
//  getDownloadURL() hands out a long-lived tokenised link. Anyone who
//  sees it (browser history, a forwarded WhatsApp message, a screenshot)
//  can open that client's document without signing in. So the ERP stores
//  only the Storage PATH on the document and reads the bytes through the
//  SDK on demand — which makes the security rules run on every single
//  view — then shows a blob: URL that lives in this tab's memory only.
//
//  `rev` (a doc's renderImage.savedAt) is what makes a re-painted file refresh:
//  a quotation letterhead is OVERWRITTEN at the same path, so the path alone
//  cannot say "the bytes behind me changed", and an edited quotation would keep
//  showing its old picture until the page was reloaded.
// ─────────────────────────────────────────────────────────────────
// Firestore hands back a NEW Timestamp object on every snapshot, so a doc field
// cannot be used as `rev` directly — this flattens one to a stable scalar.
export const revOf = (v) => (v == null ? '' : v.seconds != null ? `${v.seconds}:${v.nanoseconds || 0}` : String(v));

export function usePrivateUrl(path, enabled = true, rev = '') {
  const [url,  setUrl]  = useState('');
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState('');

  useEffect(() => {
    let alive = true;
    let created = '';
    setUrl(''); setErr('');
    if (!enabled || !path) { setBusy(false); return; }
    setBusy(true);
    (async () => {
      try {
        const bytes = await getBytes(ref(getStorage(), path));
        if (!alive) return;
        const type = bytes.metadata?.contentType || 'image/jpeg';
        created = URL.createObjectURL(new Blob([bytes], { type }));
        setUrl(created);
      } catch (e) {
        if (!alive) return;
        setErr(e?.code === 'storage/unauthorized'
          ? 'You do not have permission to open this file.'
          : 'This file could not be loaded. Please try again.');
      } finally {
        if (alive) setBusy(false);
      }
    })();
    return () => { alive = false; if (created) URL.revokeObjectURL(created); };
  }, [path, enabled, rev]);

  return { url, busy, err };
}
