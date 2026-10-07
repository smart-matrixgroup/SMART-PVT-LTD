// ─────────────────────────────────────────────────────────────────
//  SMART ERP — Shared UI Components
//  Dark 3D design system for all ERP pages
// ─────────────────────────────────────────────────────────────────
import React from 'react';

// ── Colors ────────────────────────────────────────────────────────
export const C = {
  bg:        '#040D1F',
  surface:   'rgba(6,17,43,0.85)',
  surfaceHi: 'rgba(10,24,56,0.9)',
  border:    'rgba(32,52,93,0.5)',
  borderHi:  'rgba(0,102,255,0.35)',
  text:      '#ffffff',
  muted:     '#91A0BC',
  subtle:    '#C4D6ED',
  blue:      '#0066FF',
  cyan:      '#00D9FF',
  green:     '#18C77A',
  amber:     '#F5B942',
  red:       '#F05A67',
  violet:    '#8B5CF6',
};

// ── Status config ──────────────────────────────────────────────────
export const STATUS = {
  'New':                  { color: C.blue,   bg: 'rgba(0,102,255,0.12)',   border: 'rgba(0,102,255,0.3)',   label: 'New'                },
  'Accepted':             { color: C.green,  bg: 'rgba(24,199,122,0.12)', border: 'rgba(24,199,122,0.3)', label: 'Accepted'           },
  'Rejected':             { color: C.red,    bg: 'rgba(240,90,103,0.12)', border: 'rgba(240,90,103,0.3)', label: 'Rejected'           },
  'requirements_pending': { color: C.amber,  bg: 'rgba(245,185,66,0.12)', border: 'rgba(245,185,66,0.3)', label: 'Requirements'       },
  'quotation_sent':       { color: C.cyan,   bg: 'rgba(0,217,255,0.1)',   border: 'rgba(0,217,255,0.3)',  label: 'Quote Sent'         },
  'quotation_accepted':   { color: C.violet, bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.3)', label: 'Quote Accepted'     },
  'advance_paid':         { color: C.green,  bg: 'rgba(24,199,122,0.12)', border: 'rgba(24,199,122,0.3)', label: 'Advance Paid'       },
  'In Progress':          { color: C.blue,   bg: 'rgba(0,102,255,0.12)',  border: 'rgba(0,102,255,0.3)',  label: 'In Progress'        },
  'Completed':            { color: C.green,  bg: 'rgba(24,199,122,0.12)', border: 'rgba(24,199,122,0.3)', label: 'Completed'          },
  'Paid':                 { color: C.green,  bg: 'rgba(24,199,122,0.12)', border: 'rgba(24,199,122,0.3)', label: 'Paid'               },
  'Pending':              { color: C.amber,  bg: 'rgba(245,185,66,0.12)', border: 'rgba(245,185,66,0.3)', label: 'Pending'            },
  'active':               { color: C.green,  bg: 'rgba(24,199,122,0.12)', border: 'rgba(24,199,122,0.3)', label: 'Active'             },
  'archived':             { color: C.muted,  bg: 'rgba(145,160,188,0.1)', border: 'rgba(145,160,188,0.3)',label: 'Archived'           },
  'inactive':             { color: C.muted,  bg: 'rgba(145,160,188,0.1)', border: 'rgba(145,160,188,0.3)',label: 'Inactive'           },
  'busy':                 { color: C.amber,  bg: 'rgba(245,185,66,0.12)', border: 'rgba(245,185,66,0.3)', label: 'Busy'               },
  'on-leave':             { color: C.muted,  bg: 'rgba(145,160,188,0.1)', border: 'rgba(145,160,188,0.3)',label: 'On Leave'           },
  'draft':                { color: C.muted,  bg: 'rgba(145,160,188,0.1)', border: 'rgba(145,160,188,0.3)',label: 'Draft'              },
  'sent':                 { color: C.cyan,   bg: 'rgba(0,217,255,0.1)',   border: 'rgba(0,217,255,0.3)',  label: 'Sent'               },
  // Quotation lifecycle (stored capitalized on the quotation doc)
  'Draft':                { color: C.muted,  bg: 'rgba(145,160,188,0.1)', border: 'rgba(145,160,188,0.3)',label: 'Draft'              },
  'Sent':                 { color: C.cyan,   bg: 'rgba(0,217,255,0.1)',   border: 'rgba(0,217,255,0.3)',  label: 'Sent'               },
};

// ── Badge ──────────────────────────────────────────────────────────
export function ERPBadge({ status, label, size = 'sm' }) {
  const cfg = STATUS[status] || { color: C.muted, bg: 'rgba(145,160,188,0.1)', border: 'rgba(145,160,188,0.3)', label: status };
  const text = label || cfg.label;
  return (
    <span style={{
      display: 'inline-block',
      padding: size === 'sm' ? '2px 9px' : '4px 12px',
      borderRadius: 20,
      fontSize: size === 'sm' ? 10 : 11,
      fontWeight: 700,
      color: cfg.color,
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      whiteSpace: 'nowrap',
    }}>{text}</span>
  );
}

// ── Panel ──────────────────────────────────────────────────────────
export function ERPPanel({ children, style = {}, className = '' }) {
  return (
    <div className={className} style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 16,
      backdropFilter: 'blur(12px)',
      overflow: 'hidden',
      position: 'relative',
      ...style,
    }}>
      {/* Top shimmer */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(0,102,255,0.3), transparent)',
        pointerEvents: 'none',
      }} />
      {children}
    </div>
  );
}

// ── Icon Helper ────────────────────────────────────────────────────
function renderERPIcon(icon, defaultSize = 16, defaultColor = C.cyan) {
  if (!icon) return null;
  if (typeof icon === 'string') return icon;
  if (React.isValidElement(icon)) return icon;
  if (typeof icon === 'function' || (typeof icon === 'object' && icon !== null && (icon.$$typeof || icon.render))) {
    const IconComponent = icon;
    return <IconComponent size={defaultSize} color={defaultColor} style={{ flexShrink: 0 }} />;
  }
  return null;
}

// ── Panel Header ───────────────────────────────────────────────────
export function ERPPanelHeader({ title, action, icon }) {
  return (
    <div style={{
      padding: '14px 18px',
      borderBottom: `1px solid ${C.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon && (
          <span style={{ fontSize: 14, display: 'inline-flex', alignItems: 'center' }}>
            {renderERPIcon(icon, 15, C.cyan)}
          </span>
        )}
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{title}</span>
      </div>
      {action && (
        <span style={{ fontSize: 10, color: C.cyan, cursor: 'pointer', fontWeight: 600 }}>
          {action}
        </span>
      )}
    </div>
  );
}

// ── Stat Card (3D) ─────────────────────────────────────────────────
export function ERPStatCard({ icon, value, label, change, changeUp, color = C.blue, bg, onClick }) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: C.surface,
        border: `1px solid ${hovered ? C.borderHi : C.border}`,
        borderRadius: 16, padding: 18,
        backdropFilter: 'blur(12px)',
        position: 'relative', overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: hovered ? '0 12px 35px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,102,255,0.2)' : '0 4px 15px rgba(0,0,0,0.2)',
        transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
      }}>
      {/* Top glow */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: `linear-gradient(90deg, transparent, ${color}66, transparent)`,
      }} />
      {/* BG glow blob */}
      <div style={{
        position: 'absolute', top: -20, right: -20,
        width: 100, height: 100, borderRadius: '50%',
        background: bg || `${color}10`,
        filter: 'blur(30px)',
        transition: 'opacity 0.3s',
        opacity: hovered ? 1 : 0.5,
      }} />

      <div style={{
        width: 40, height: 40, borderRadius: 11, marginBottom: 14,
        background: bg || `${color}18`,
        border: `1px solid ${color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, position: 'relative',
        boxShadow: `0 4px 12px ${color}25`,
      }}>{renderERPIcon(icon, 20, color)}</div>

      <div style={{ fontSize: 28, fontWeight: 900, color: C.text, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{label}</div>
      {change && (
        <div style={{ fontSize: 10, color: changeUp ? C.green : C.red, marginTop: 6, fontWeight: 600 }}>
          {changeUp ? '↑' : '↓'} {change}
        </div>
      )}
    </div>
  );
}

// ── Button ─────────────────────────────────────────────────────────
export function ERPBtn({ children, onClick, variant = 'primary', size = 'md', disabled, style = {} }) {
  const [hovered, setHovered] = React.useState(false);
  const variants = {
    primary: {
      background: hovered ? 'linear-gradient(135deg,#0052CC,#0066FF)' : 'linear-gradient(135deg,#0066FF,#1787FF)',
      color: '#fff', border: 'none',
      boxShadow: hovered ? '0 6px 20px rgba(0,102,255,0.5)' : '0 4px 14px rgba(0,102,255,0.35)',
    },
    secondary: {
      background: hovered ? 'rgba(32,52,93,0.7)' : 'rgba(10,24,56,0.8)',
      color: '#C4D6ED', border: `1px solid ${C.border}`,
    },
    danger: {
      background: hovered ? 'rgba(240,90,103,0.25)' : 'rgba(240,90,103,0.15)',
      color: C.red, border: '1px solid rgba(240,90,103,0.3)',
    },
    success: {
      background: hovered ? 'rgba(24,199,122,0.25)' : 'rgba(24,199,122,0.15)',
      color: C.green, border: '1px solid rgba(24,199,122,0.3)',
    },
    ghost: {
      background: hovered ? 'rgba(32,52,93,0.4)' : 'transparent',
      color: C.muted, border: `1px solid ${hovered ? C.border : 'transparent'}`,
    },
  };
  const sizes = {
    sm: { padding: '5px 12px', fontSize: 11 },
    md: { padding: '8px 16px', fontSize: 12 },
    lg: { padding: '11px 22px', fontSize: 13 },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...variants[variant],
        ...sizes[size],
        borderRadius: 10, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s', opacity: disabled ? 0.5 : 1,
        display: 'inline-flex', alignItems: 'center', gap: 6,
        ...style,
      }}>
      {children}
    </button>
  );
}

// ── Input ──────────────────────────────────────────────────────────
export function ERPInput({ label, value, onChange, placeholder, type='text', required, style={} }) {
  const [focused, setFocused] = React.useState(false);
  return (
    <div style={style}>
      {label && <label style={{ display:'block', fontSize:11, fontWeight:600, color:C.subtle, marginBottom:6 }}>
        {label}{required && <span style={{ color:C.red, marginLeft:3 }}>*</span>}
      </label>}
      <input
        type={type} value={value} onChange={onChange} placeholder={placeholder}
        required={required}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          width:'100%', background:'rgba(10,24,56,0.8)',
          border: `1px solid ${focused ? 'rgba(0,102,255,0.5)' : C.border}`,
          borderRadius:10, padding:'9px 14px', color:C.text, fontSize:12,
          outline:'none', boxSizing:'border-box',
          transition:'border-color 0.15s',
        }}
      />
    </div>
  );
}

// ── Textarea ───────────────────────────────────────────────────────
export function ERPTextarea({ label, value, onChange, placeholder, rows=3, required, style={} }) {
  const [focused, setFocused] = React.useState(false);
  return (
    <div style={style}>
      {label && <label style={{ display:'block', fontSize:11, fontWeight:600, color:C.subtle, marginBottom:6 }}>
        {label}{required && <span style={{ color:C.red, marginLeft:3 }}>*</span>}
      </label>}
      <textarea
        value={value} onChange={onChange} placeholder={placeholder}
        rows={rows} required={required}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          width:'100%', background:'rgba(10,24,56,0.8)',
          border: `1px solid ${focused ? 'rgba(0,102,255,0.5)' : C.border}`,
          borderRadius:10, padding:'9px 14px', color:C.text, fontSize:12,
          outline:'none', resize:'none', boxSizing:'border-box',
          transition:'border-color 0.15s', fontFamily:'inherit',
        }}
      />
    </div>
  );
}

// ── Select ─────────────────────────────────────────────────────────
export function ERPSelect({ label, value, onChange, options=[], placeholder, required, style={} }) {
  const [focused, setFocused] = React.useState(false);
  return (
    <div style={style}>
      {label && <label style={{ display:'block', fontSize:11, fontWeight:600, color:C.subtle, marginBottom:6 }}>
        {label}{required && <span style={{ color:C.red, marginLeft:3 }}>*</span>}
      </label>}
      <select
        value={value} onChange={onChange} required={required}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          width:'100%', background:'rgba(10,24,56,0.8)',
          border: `1px solid ${focused ? 'rgba(0,102,255,0.5)' : C.border}`,
          borderRadius:10, padding:'9px 14px', color: value ? C.text : C.muted, fontSize:12,
          outline:'none', boxSizing:'border-box', cursor:'pointer',
          transition:'border-color 0.15s', appearance:'none',
        }}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => (
          <option key={o.value||o} value={o.value||o} style={{ background:'#0A1838' }}>
            {o.label||o}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Avatar ─────────────────────────────────────────────────────────
export function ERPAvatar({ name='?', color='#0066FF', size=32 }) {
  const initial = name?.[0]?.toUpperCase() || '?';
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.28,
      background: `linear-gradient(135deg, ${color}, ${color}99)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 800, fontSize: size * 0.38,
      boxShadow: `0 3px 10px ${color}40`, flexShrink: 0,
    }}>{initial}</div>
  );
}

// ── Table ──────────────────────────────────────────────────────────
export function ERPTable({ headers=[], rows=[], onRowClick }) {
  const [hovered, setHovered] = React.useState(null);
  return (
    <table style={{ width:'100%', borderCollapse:'collapse' }}>
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th key={i} style={{
              padding:'10px 16px', fontSize:10, fontWeight:700,
              textTransform:'uppercase', letterSpacing:'0.8px',
              color:C.muted, textAlign:'left',
              background:'rgba(10,24,56,0.5)',
              borderBottom:`1px solid ${C.border}`,
            }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}
            onClick={() => onRowClick && onRowClick(row)}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{
              cursor: onRowClick ? 'pointer' : 'default',
              background: hovered === i ? 'rgba(0,102,255,0.05)' : 'transparent',
              transition: 'background 0.1s',
            }}>
            {row.cells?.map((cell, j) => (
              <td key={j} style={{
                padding:'11px 16px', fontSize:12,
                borderTop:`1px solid ${C.border}30`,
                color: C.subtle,
              }}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Empty state ────────────────────────────────────────────────────
export function ERPEmpty({ icon='📭', title, sub, action }) {
  return (
    <div style={{ padding:'48px 24px', textAlign:'center' }}>
      <div style={{ fontSize:36, marginBottom:12, display:'flex', alignItems:'center', justifyContent:'center' }}>
        {renderERPIcon(icon, 36, C.muted)}
      </div>
      <div style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:6 }}>{title}</div>
      {sub && <div style={{ fontSize:12, color:C.muted, maxWidth:280, margin:'0 auto' }}>{sub}</div>}
      {action && <div style={{ marginTop:16 }}>{action}</div>}
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────
export function ERPModal({ isOpen, onClose, title, children, width=520 }) {
  if (!isOpen) return null;
  return (
    <div style={{
      position:'fixed', inset:0, zIndex:200,
      background:'rgba(0,0,0,0.75)', backdropFilter:'blur(8px)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:16,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        width:'100%', maxWidth:width, maxHeight:'90vh',
        background:'rgba(6,17,43,0.98)',
        border:'1px solid rgba(32,52,93,0.6)',
        borderRadius:18,
        boxShadow:'0 25px 80px rgba(0,0,0,0.6)',
        overflow:'hidden', display:'flex', flexDirection:'column',
        position:'relative',
      }}>
        {/* Top glow */}
        <div style={{
          position:'absolute', top:0, left:0, right:0, height:1,
          background:'linear-gradient(90deg, transparent, rgba(0,217,255,0.5), transparent)',
        }} />
        {/* Header */}
        <div style={{
          padding:'16px 20px', borderBottom:'1px solid rgba(32,52,93,0.5)',
          display:'flex', alignItems:'center', justifyContent:'space-between',
        }}>
          <span style={{ fontSize:14, fontWeight:700, color:'#fff' }}>{title}</span>
          <button onClick={onClose} style={{
            background:'rgba(32,52,93,0.5)', border:'none', borderRadius:8,
            color:'#91A0BC', cursor:'pointer', padding:'5px 8px', fontSize:12,
          }}>✕</button>
        </div>
        {/* Body */}
        <div style={{ overflowY:'auto', flex:1, padding:20 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Progress bar ───────────────────────────────────────────────────
export function ERPProgress({ value=0, color=C.blue }) {
  return (
    <div style={{ height:6, background:'rgba(32,52,93,0.5)', borderRadius:4, overflow:'hidden' }}>
      <div style={{
        height:'100%', width:`${Math.min(100, value)}%`,
        background:`linear-gradient(90deg, ${color}, ${color}bb)`,
        borderRadius:4, transition:'width 0.5s ease',
      }} />
    </div>
  );
}
