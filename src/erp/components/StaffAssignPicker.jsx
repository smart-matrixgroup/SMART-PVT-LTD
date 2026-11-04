import React from 'react';
import { C } from './ERPui';

/**
 * "Who works on this project" multi-select, used by the admin project
 * add/edit boxes. Value is an array of staff doc ids in the order they were
 * picked. Chips only — nothing here closes the modal, and clicking a chip
 * never moves the box.
 */
export default function StaffAssignPicker({
  label = 'Assigned Staff',
  staff = [],
  value = [],
  onChange,
  emptyHint = 'No staff yet — add them in ERP → Staff first.',
}) {
  const picked = Array.isArray(value) ? value : [];
  const toggle = (id) => {
    onChange?.(picked.includes(id) ? picked.filter(x => x !== id) : [...picked, id]);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.subtle }}>{label}</label>
        {picked.length > 0 && (
          <span style={{ fontSize: 10, fontWeight: 800, color: C.cyan }}>{picked.length} assigned</span>
        )}
      </div>

      {staff.length === 0 ? (
        <div style={{
          padding: '9px 12px', borderRadius: 9, fontSize: 11, color: C.muted,
          background: 'rgba(10,24,56,0.6)', border: `1px solid ${C.border}40`,
        }}>{emptyHint}</div>
      ) : (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 7, maxHeight: 158, overflowY: 'auto',
          padding: 8, borderRadius: 10, background: 'rgba(10,24,56,0.55)', border: `1px solid ${C.border}40`,
        }}>
          {staff.map(s => {
            const on = picked.includes(s.id);
            const role = s.role || s.position || 'Staff';
            const away = s.status === 'on-leave';
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggle(s.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7, padding: '6px 10px', borderRadius: 8,
                  cursor: 'pointer', fontSize: 11, fontWeight: 700, textAlign: 'left',
                  background: on ? 'rgba(34,211,238,0.16)' : 'rgba(255,255,255,0.04)',
                  color: on ? C.cyan : C.text,
                  border: `1px solid ${on ? 'rgba(34,211,238,0.5)' : `${C.border}40`}`,
                }}
              >
                <span style={{
                  width: 15, height: 15, borderRadius: 4, flexShrink: 0,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: on ? C.cyan : 'transparent',
                  border: `1.5px solid ${on ? C.cyan : C.border}`,
                  color: '#040D1F', fontSize: 10, fontWeight: 900,
                }}>{on ? '✓' : ''}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.name}{away ? ' · on leave' : ''}
                  </span>
                  <span style={{
                    display: 'block', fontSize: 9, fontWeight: 600,
                    color: on ? C.cyan : C.muted, opacity: 0.75,
                  }}>{role}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** The same selection as read-only chips (project cards / detail rows). */
export function StaffAssignChips({ ids = [], staff = [], names = [], size = 26 }) {
  const list = (ids || []).map((id, i) => ({
    key: id,
    name: staff.find(s => s.id === id)?.name || names?.[i] || 'Staff',
    role: staff.find(s => s.id === id)?.role || staff.find(s => s.id === id)?.position || '',
  }));
  if (!list.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {list.map(p => (
        <span key={p.key} title={`${p.name}${p.role ? ` — ${p.role}` : ''}`} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          height: size, padding: '0 10px 0 4px', borderRadius: 999,
          background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.3)',
          fontSize: 11, fontWeight: 700, color: C.cyan,
        }}>
          <span style={{
            width: size - 8, height: size - 8, borderRadius: '50%', flexShrink: 0,
            background: 'rgba(34,211,238,0.22)', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900,
          }}>{(p.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}</span>
          {p.name}
        </span>
      ))}
    </div>
  );
}
