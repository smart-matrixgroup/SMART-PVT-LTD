// ─────────────────────────────────────────────────────────────────
//  NotificationAlert — a modern, animated "you have new updates"
//  banner shown when a user lands on their dashboard.
//
//  Purely presentational + role-agnostic: each dashboard computes an
//  `items` array and renders <NotificationAlert items={...} />.
//  Uses only inline styles + a tiny local <style> for keyframes, so it
//  works in the ERP (admin), staff portal and client portal alike.
// ─────────────────────────────────────────────────────────────────
import React, { useState, useMemo } from 'react';

const KEYFRAMES = `
@keyframes na-slide-in { from { opacity:0; transform: translateX(24px) scale(.98);} to {opacity:1; transform: translateX(0) scale(1);} }
@keyframes na-pop     { 0%{transform:scale(.6);opacity:0;} 60%{transform:scale(1.15);} 100%{transform:scale(1);opacity:1;} }
@keyframes na-glow    { 0%,100%{box-shadow:0 0 0 0 rgba(24,199,122,.0);} 50%{box-shadow:0 0 22px 2px rgba(24,199,122,.28);} }
@keyframes na-halo    { 0%,100%{box-shadow:0 0 0 0 var(--na-halo,rgba(0,217,255,0));} 50%{box-shadow:0 0 0 6px var(--na-halo,rgba(0,217,255,0)),0 0 20px 2px var(--na-halo,rgba(0,217,255,0));} }
@keyframes na-sheen   { 0%{transform:translateX(-120%);} 60%,100%{transform:translateX(220%);} }
`;

function hexA(hex, a) {
  // #RRGGBB + alpha → rgba()
  const h = (hex || '#00D9FF').replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${a})`;
}

export default function NotificationAlert({ items = [], heading = 'New updates for you', sub }) {
  const [dismissed, setDismissed] = useState(false);

  const list = useMemo(() => (items || []).filter(Boolean).slice(0, 5), [items]);
  const total = useMemo(
    () => list.reduce((t, i) => t + (Number(i.count) || 1), 0),
    [list]
  );

  if (dismissed || list.length === 0) return null;

  return (
    <div style={{ position: 'relative', zIndex: 30 }}>
      <style>{KEYFRAMES}</style>
      <div
        style={{
          position: 'relative', overflow: 'hidden',
          borderRadius: 18, padding: '16px 18px',
          background: 'linear-gradient(135deg, rgba(10,24,56,0.92), rgba(16,32,66,0.92))',
          border: '1px solid rgba(0,217,255,0.28)',
          boxShadow: '0 18px 40px -18px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)',
          animation: 'na-slide-in .45s ease both',
        }}
      >
        {/* soft glow blobs for depth */}
        <div style={{ position: 'absolute', right: -40, top: -50, width: 180, height: 180, borderRadius: '50%', background: 'rgba(0,102,255,0.14)', filter: 'blur(46px)' }} />
        <div style={{ position: 'absolute', left: -30, bottom: -60, width: 160, height: 160, borderRadius: '50%', background: 'rgba(24,199,122,0.10)', filter: 'blur(46px)' }} />

        {/* header row */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 34, height: 34, borderRadius: 10, fontSize: 17,
              background: 'rgba(24,199,122,0.16)', border: '1px solid rgba(24,199,122,0.4)',
              animation: 'na-glow 2.4s ease-in-out infinite',
            }}>🔔</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#EAF3FF', letterSpacing: .2 }}>
                {heading}
                <span style={{
                  marginLeft: 8, display: 'inline-block', padding: '1px 9px', borderRadius: 999,
                  fontSize: 11, fontWeight: 900, color: '#040D1F', background: 'linear-gradient(135deg,#00D9FF,#18C77A)',
                  animation: 'na-pop .5s ease both', verticalAlign: 'middle',
                }}>{total}</span>
              </div>
              {sub && <div style={{ fontSize: 11, color: 'rgba(234,243,255,0.55)', marginTop: 1 }}>{sub}</div>}
            </div>
          </div>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            style={{
              cursor: 'pointer', width: 26, height: 26, borderRadius: 8, fontSize: 14, lineHeight: 1,
              background: 'rgba(255,255,255,0.06)', color: 'rgba(234,243,255,0.7)', border: '1px solid rgba(255,255,255,0.12)',
            }}
          >×</button>
        </div>

        {/* item cards */}
        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {list.map((it, idx) => {
            const accent = it.accent || '#00D9FF';
            const pulse = !!it.pulse;
            return (
              <div
                key={it.id || idx}
                style={{
                  position: 'relative',
                  display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', borderRadius: 13,
                  background: `linear-gradient(120deg, ${hexA(accent, 0.16)}, ${hexA(accent, 0.05)} 55%, rgba(255,255,255,0.02))`,
                  border: `1px solid ${hexA(accent, 0.36)}`,
                  boxShadow: pulse
                    ? `0 8px 22px -12px ${hexA(accent, 0.95)}, inset 3px 0 0 ${accent}`
                    : `0 8px 20px -14px ${hexA(accent, 0.9)}, inset 3px 0 0 ${accent}`,
                  cursor: it.onAction ? 'pointer' : 'default',
                  transition: 'transform .12s ease, box-shadow .12s ease',
                  animation: pulse
                    ? `na-slide-in .5s ${0.06 * idx}s ease both, na-halo 2.4s ${0.06 * idx + 0.4}s ease-in-out infinite`
                    : `na-slide-in .5s ${0.06 * idx}s ease both`,
                  ['--na-halo']: hexA(accent, 0.22),
                  overflow: 'hidden',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 14px 26px -14px ${hexA(accent, 0.95)}, inset 3px 0 0 ${accent}`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = pulse ? `0 8px 22px -12px ${hexA(accent, 0.95)}, inset 3px 0 0 ${accent}` : `0 8px 20px -14px ${hexA(accent, 0.9)}, inset 3px 0 0 ${accent}`; }}
                onClick={() => it.onAction && it.onAction()}
              >
                {/* glossy sheen sweep */}
                <span style={{
                  position: 'absolute', top: 0, bottom: 0, width: 32, left: '-40%', pointerEvents: 'none',
                  background: `linear-gradient(90deg, transparent, ${hexA(accent, 0.25)}, transparent)`,
                  animation: `na-sheen 4.5s ${0.06 * idx + 1}s ease-in-out infinite`,
                }} />
                {/* icon badge — image or emoji */}
                <span style={{
                  position: 'relative', flex: '0 0 auto', width: 42, height: 42, borderRadius: 12, fontSize: 20,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                  background: `linear-gradient(135deg, ${hexA(accent, 0.28)}, ${hexA(accent, 0.1)})`,
                  border: `1px solid ${hexA(accent, 0.5)}`,
                  boxShadow: `0 4px 12px -4px ${hexA(accent, 0.8)}, inset 0 1px 0 rgba(255,255,255,0.12)`,
                }}>
                  {it.img
                    ? <img src={it.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : (it.icon || '🔔')}
                </span>
                <div style={{ position: 'relative', minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: '#EAF3FF', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</span>
                    {Number(it.count) > 0 && (
                      <span style={{
                        flex: '0 0 auto', minWidth: 20, textAlign: 'center', padding: '0 6px', borderRadius: 999,
                        fontSize: 10.5, fontWeight: 900, color: '#040D1F', background: accent,
                      }}>{it.count}</span>
                    )}
                  </div>
                  {it.body && (
                    <div style={{ fontSize: 11, color: 'rgba(234,243,255,0.6)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.body}</div>
                  )}
                </div>
                {it.actionLabel && (
                  <span style={{ position: 'relative', flex: '0 0 auto', fontSize: 10.5, fontWeight: 900, color: accent, whiteSpace: 'nowrap' }}>
                    {it.actionLabel} →
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
