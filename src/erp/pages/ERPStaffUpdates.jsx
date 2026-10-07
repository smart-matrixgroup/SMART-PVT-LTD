// ─────────────────────────────────────────────────────────────────
//  Phase 3 D — Daily work updates (admin monitor).
//  Staff submit date + list of work done + notes from the portal;
//  admins monitor everything here with date / staff filters.
// ─────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { ERPPanel, ERPPanelHeader, ERPEmpty, ERPAvatar, C } from '../components/ERPui';
import { toMs, todayKey, dateKeyOf } from '../../staff/staffUtils';
import { AlertTriangle, ClipboardList } from 'lucide-react';

const AVATAR_COLORS = ['#0066FF', '#8B5CF6', '#18C77A', '#F5B942', '#F05A67', '#00D9FF'];

const DEV_UPDATES = [
  { id: 'du1', staffId: 'dev-staff-001', staffName: 'Ashan Perera', date: todayKey(),
    items: ['Finished POS order-screen components', 'Fixed quotation print layout'], notes: 'Blocked on client logo assets.',
    submittedAt: new Date().setHours(17, 10, 0, 0) },
  { id: 'du2', staffId: 'dev-staff-002', staffName: 'Nimali Silva', date: todayKey(),
    items: ['Restaurant POS UI mockups v2'], notes: '',
    submittedAt: new Date().setHours(16, 45, 0, 0) },
];

export default function ERPStaffUpdates() {
  const { isFirebaseConfigured, isDevSession } = useAuth();
  const live = isFirebaseConfigured && !isDevSession;

  const [updates,  setUpdates]  = useState([]);
  const [staff,    setStaff]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [dateF,    setDateF]    = useState('');
  const [staffF,   setStaffF]   = useState('All');

  useEffect(() => {
    if (!live) { setUpdates(DEV_UPDATES); setStaff([
      { id: 'dev-staff-001', name: 'Ashan Perera' }, { id: 'dev-staff-002', name: 'Nimali Silva' },
    ]); setLoading(false); return; }
    const unsubs = [
      onSnapshot(collection(db, 'dailyUpdates'),
        snap => { setUpdates(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
        err => { console.error(err); setLoadError(`Daily updates — ${err.message}`); setLoading(false); }),
      onSnapshot(collection(db, 'staff'),
        snap => setStaff(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.deleted)),
        err => console.error(err)),
    ];
    return () => unsubs.forEach(u => u());
  }, [live]);

  const filtered = updates
    .filter(u => (dateF ? u.date === dateF : true))
    .filter(u => (staffF === 'All' ? true : u.staffId === staffF))
    .sort((a, b) => toMs(b.submittedAt) - toMs(a.submittedAt) || String(b.date).localeCompare(String(a.date)));

  const todayCount = updates.filter(u => u.date === todayKey()).length;

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: C.muted, fontSize: 13 }}>Loading daily updates…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {loadError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10,
          background: 'rgba(240,90,103,0.1)', border: '1px solid rgba(240,90,103,0.35)', color: C.red, fontSize: 12 }}>
          <AlertTriangle size={14} /> {loadError}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ width: 170 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.subtle, marginBottom: 6 }}>Date</label>
          <input type="date" value={dateF} onChange={e => setDateF(e.target.value)} style={{
            width: '100%', background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`, borderRadius: 10,
            padding: '9px 14px', color: C.text, fontSize: 12, outline: 'none', boxSizing: 'border-box',
          }} />
        </div>
        <div style={{ width: 190 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.subtle, marginBottom: 6 }}>Staff</label>
          <select value={staffF} onChange={e => setStaffF(e.target.value)} style={{
            width: '100%', background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`, borderRadius: 10,
            padding: '9px 14px', color: C.text, fontSize: 12, outline: 'none', boxSizing: 'border-box', cursor: 'pointer',
          }}>
            <option value="All">All staff</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        {dateF && (
          <button onClick={() => setDateF('')} style={{
            padding: '8px 14px', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer',
            background: 'rgba(10,24,56,0.8)', color: C.cyan, border: `1px solid ${C.border}`,
          }}>Clear date (show all)</button>
        )}
        <div style={{ marginLeft: 'auto', fontSize: 11, color: C.muted }}>
          <strong style={{ color: C.cyan }}>{todayCount}</strong> submitted today
        </div>
      </div>

      <ERPPanel>
        <ERPPanelHeader title="Staff Daily Updates" icon="📝"
          action={<span style={{ fontSize: 10, color: C.muted }}>{filtered.length} entr{filtered.length === 1 ? 'y' : 'ies'}</span>} />
        {filtered.length === 0 ? (
          <ERPEmpty icon="📝" title="No daily updates"
            sub={dateF || staffF !== 'All'
              ? 'Nothing matches the current filters — try clearing them.'
              : 'Staff submit these from their portal each day (Daily Work Update).'} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filtered.map((u, i) => (
              <div key={u.id} style={{
                display: 'flex', gap: 12, padding: '14px 16px',
                borderTop: i > 0 ? `1px solid ${C.border}20` : 'none',
              }}>
                <ERPAvatar name={u.staffName} color={AVATAR_COLORS[(u.staffName || '?').length % AVATAR_COLORS.length]} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: C.text }}>{u.staffName}</span>
                    <span style={{ fontSize: 10, color: C.cyan, fontWeight: 700 }}>{u.date}</span>
                    {u.date === todayKey() && (
                      <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 20, background: 'rgba(24,199,122,0.12)', color: C.green, border: '1px solid rgba(24,199,122,0.3)', fontWeight: 700 }}>
                        TODAY
                      </span>
                    )}
                    {toMs(u.submittedAt) > 0 && (
                      <span style={{ fontSize: 10, color: C.muted }}>
                        submitted {new Date(toMs(u.submittedAt)).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {(u.items || []).map((item, j) => (
                      <div key={j} style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                        <ClipboardList size={12} style={{ color: C.blue, marginTop: 2, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: C.subtle }}>{item}</span>
                      </div>
                    ))}
                  </div>
                  {u.notes && (
                    <div style={{ marginTop: 7, fontSize: 11, color: C.amber, padding: '7px 10px', borderRadius: 8, background: 'rgba(245,185,66,0.07)', border: '1px solid rgba(245,185,66,0.2)' }}>
                      Note: {u.notes}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ERPPanel>
    </div>
  );
}
