import React from 'react';
import { Loader2 } from 'lucide-react';
import { usePrivateUrl } from '../usePrivateUrl';
import { C } from './ERPui';

// ─────────────────────────────────────────────────────────────────
//  PrivateImage — an uploaded picture shown without a public URL.
//
//  Storage holds only the PATH on the document; this pulls the bytes
//  through the SDK (so storage.rules check the signed-in user on every
//  view) and paints an in-memory blob: URL that dies with the tab.
//  `localUrl` is the dev-session escape hatch: a blob drawn in this
//  browser that was never uploaded anywhere.
// ─────────────────────────────────────────────────────────────────
export default function PrivateImage({ file, alt = 'Document', maxWidth = 460, style }) {
  const path = file?.path || '';
  const { url, busy, err } = usePrivateUrl(path, !!path);

  const src = path ? url : (file?.localUrl || '');

  if (!src && err) {
    return <div style={{ fontSize: 11, color: C.red }}>{err}</div>;
  }
  if (!src && path && busy) {
    return (
      <div style={{ fontSize: 11, color: C.muted, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Loader2 size={12} /> Opening…
      </div>
    );
  }
  if (!src) {
    return <div style={{ fontSize: 11, color: C.muted }}>Nothing attached.</div>;
  }
  return (
    <a href={src} target="_blank" rel="noreferrer" title="Open full size" style={{ display: 'block' }}>
      <img src={src} alt={alt} style={{
        width: '100%', maxWidth, borderRadius: 10, border: `1px solid ${C.border}`,
        background: '#fff', display: 'block', ...style,
      }} />
    </a>
  );
}
