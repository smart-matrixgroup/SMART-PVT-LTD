// ─────────────────────────────────────────────────────────────────
//  StaffEmpty — colourful, animated empty state for the Staff Portal.
//
//  A modern drop-in replacement for the plain shared ERPEmpty inside
//  staff sections: a floating gradient icon disc with pulsing colour
//  rings, a soft glow blob and a gradient title. Each module passes
//  its own icon + colour theme so every screen looks distinct.
//
//  `icon` may be a lucide component OR an emoji string.
//  Relies on the opt-in motion classes (.sp-float / .sp-ring) defined
//  in src/styles/index.css.
// ─────────────────────────────────────────────────────────────────
import React from 'react';
import { C } from '../../erp/components/ERPui';

function isIconComponent(icon) {
  return typeof icon === 'function' ||
    (typeof icon === 'object' && icon !== null && (icon.$$typeof || icon.render));
}

export default function StaffEmpty({
  icon,
  from = '#00D9FF',
  to = '#8B5CF6',
  title,
  sub,
  action,
}) {
  return (
    <div style={{ padding: '34px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
      {/* soft colour glow blob */}
      <div style={{
        position: 'absolute', left: '50%', top: 6, transform: 'translateX(-50%)',
        width: 240, height: 130, borderRadius: '50%',
        background: `radial-gradient(circle, ${from}33, ${to}22 55%, transparent 72%)`,
        filter: 'blur(30px)',
      }} />

      {/* floating gradient disc + pulsing rings */}
      <div className="sp-float" style={{
        position: 'relative', width: 80, height: 80, margin: '0 auto 14px',
        borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span className="sp-ring" style={{ position: 'absolute', inset: 4, borderRadius: '50%', border: `2px solid ${from}88` }} />
        <span className="sp-ring" style={{ position: 'absolute', inset: 4, borderRadius: '50%', border: `2px solid ${to}88`, animationDelay: '1.3s' }} />
        <span style={{
          position: 'relative', width: 64, height: 64, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `linear-gradient(135deg, ${from}, ${to})`,
          boxShadow: `0 12px 30px -8px ${from}aa, inset 0 1px 0 rgba(255,255,255,0.4)`,
        }}>
          {isIconComponent(icon)
            ? React.createElement(icon, { size: 30, color: '#fff' })
            : <span style={{ fontSize: 30, lineHeight: 1 }}>{icon || '📭'}</span>}
        </span>
      </div>

      {/* gradient title */}
      <div style={{
        position: 'relative', fontSize: 15, fontWeight: 900,
        background: `linear-gradient(120deg, ${from}, ${to})`,
        WebkitBackgroundClip: 'text', backgroundClip: 'text',
        WebkitTextFillColor: 'transparent', color: 'transparent',
      }}>{title}</div>

      {sub && (
        <div style={{ position: 'relative', fontSize: 12, color: C.muted, maxWidth: 320, margin: '5px auto 0', lineHeight: 1.5 }}>
          {sub}
        </div>
      )}

      {action && <div style={{ position: 'relative', marginTop: 16, display: 'flex', justifyContent: 'center' }}>{action}</div>}
    </div>
  );
}
