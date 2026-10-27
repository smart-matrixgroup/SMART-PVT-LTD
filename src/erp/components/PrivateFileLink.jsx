import React from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { usePrivateUrl } from '../usePrivateUrl';

// ─────────────────────────────────────────────────────────────────
//  PrivateFileLink — the only way the ERP opens an uploaded file.
//
//  New uploads store just the Storage PATH (…/payment-proofs/{uid}/…,
//  …/requirement-files/{uid}/…). This component pulls the bytes through
//  the SDK, so storage.rules check the signed-in user on EVERY click, and
//  hands the browser an in-memory blob: link that dies with the tab.
//
//  Older docs may still carry a `url:` value from getDownloadURL(). Those
//  are shown as-is so nothing breaks, but they are never written any more.
// ─────────────────────────────────────────────────────────────────
export default function PrivateFileLink({ file, label, style, iconSize = 12, loading = 'Opening…' }) {
  const path = file?.path || '';
  const legacyUrl = file?.url || '';
  const { url, busy, err } = usePrivateUrl(path, !!path);

  const href = path ? url : legacyUrl;
  const text = label || file?.name || 'Open file';

  if (err) {
    return (
      <span style={{ fontSize: 11, fontWeight: 700, color: '#EF4444', ...style }}>{err}</span>
    );
  }
  if (path && !href) {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#94A3B8', ...style }}>
        {busy ? <Loader2 size={iconSize} style={{ animation: 'spin 1s linear infinite' }} /> : <ExternalLink size={iconSize} />}
        {busy ? loading : text}
      </span>
    );
  }
  if (!href) {
    return (
      <span style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', ...style }}>{text}</span>
    );
  }
  return (
    <a href={href} target="_blank" rel="noreferrer"
      style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, textDecoration: 'none', ...style }}>
      <ExternalLink size={iconSize} /> {text}
    </a>
  );
}
