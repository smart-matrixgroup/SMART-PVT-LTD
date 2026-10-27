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
// ─────────────────────────────────────────────────────────────────
export function usePrivateUrl(path, enabled = true) {
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
  }, [path, enabled]);

  return { url, busy, err };
}
