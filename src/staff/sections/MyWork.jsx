// ─────────────────────────────────────────────────────────────────
//  Phase 3 C (portal side) — Assigned Work & Work Progress.
//  Staff see only their own workAssignments (Firestore rule filters
//  by authUid). Each assignment carries a snapshot of the client and
//  project it belongs to, so the staff member knows whose work they
//  are doing. Lifecycle: Assigned → Accept → Start → update progress.
//  Only status/progress/timestamps are writable here; the rules block
//  everything else, and the updates flow back to admin live.
//  variant: 'assigned' → actionable list · 'progress' → progress view
// ─────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, updateDoc, doc, query, where, serverTimestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { ERPPanel, ERPPanelHeader, ERPBadge, ERPBtn, ERPModal, ERPSelect, ERPEmpty, ERPProgress, C } from '../../erp/components/ERPui';
import { ASSIGNMENT_STATUSES, toMs, todayKey } from '../staffUtils';
import { Play, Pencil, AlertTriangle, Clock, CheckCircle2, Building } from 'lucide-react';

const DEV_ASSIGNMENTS = [
  { id: 'wa1', projectId: 'P001', projectTitle: 'Corporate Website Redesign', title: 'Home page component build',
    clientName: 'Demo Client', clientCompany: 'ABC Trading Pvt Ltd', serviceType: 'Corporate Business Website',
    description: 'Hero, features and footer sections', startDate: '2026-10-01', deadline: '2026-10-10',
    priority: 'High', status: 'In Progress', progress: 60, updatedAt: Date.now() },
  { id: 'wa2', projectId: 'P003', projectTitle: 'Restaurant POS System', title: 'Order screen UI',
    clientName: 'Rahul Mendis', clientCompany: 'RMG Trading Pvt Ltd', serviceType: 'ERP & POS System',
    description: '', startDate: '2026-09-28', deadline: '2026-10-04',
    priority: 'Critical', status: 'Accepted', progress: 0, updatedAt: Date.now() },
  { id: 'wa3', projectId: '', projectTitle: '', title: 'Code review — quotation print layout',
    clientName: 'Amali Senerath', clientCompany: 'AS Enterprises', serviceType: 'Mobile App',
    description: '', startDate: '2026-10-02', deadline: '2026-10-05',
    priority: 'Medium', status: 'Completed', progress: 100, updatedAt: Date.now() },
  { id: 'wa4', projectId: 'P004', projectTitle: 'Annual Tax Filing', title: 'VAT return preparation',
    clientName: 'Priya Nair', clientCompany: 'PN Accounting', serviceType: 'Accounting & Tax Services',
    description: '', startDate: '2026-10-03', deadline: '2026-10-12',
    priority: 'Low', status: 'Assigned', progress: 0, updatedAt: Date.now() },
];

export default function MyWork({ variant = 'assigned' }) {
  const { staffProfile, isFirebaseConfigured, isDevSession } = useAuth();
  const live = isFirebaseConfigured && !isDevSession;
  const uid = staffProfile?.id || '';

  const [assignments, setAssignments] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [form,      setForm]      = useState({ status: 'Assigned', progress: 0 });
  const [busy,      setBusy]      = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    if (!live) { setAssignments(DEV_ASSIGNMENTS); setLoading(false); return; }
    const unsub = onSnapshot(
      query(collection(db, 'workAssignments'), where('authUid', '==', uid)),
      snap => { setAssignments(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      err => { console.error(err); setLoadError(`Assigned work — ${err.message}`); setLoading(false); },
    );
    return unsub;
  }, [live, uid]);

  const today = todayKey();
  const sorted = [...assignments].sort((a, b) => {
    const active = x => (x.status === 'Completed' ? 1 : 0);
    return active(a) - active(b)
      || String(a.deadline || '9999').localeCompare(String(b.deadline || '9999'));
  });

  const stats = {
    total: assignments.length,
    active: assignments.filter(a => ['Assigned', 'Accepted', 'In Progress'].includes(a.status)).length,
    overdue: assignments.filter(a => a.status !== 'Completed' && a.deadline && a.deadline < today).length,
    avg: assignments.length
      ? Math.round(assignments.reduce((s, a) => s + (Number(a.progress) || 0), 0) / assignments.length)
      : 0,
  };

  const openUpdate = a => {
    setEditTarget(a); setFormError(null);
    setForm({ status: a.status || 'Assigned', progress: Number(a.progress) || 0 });
  };

  // Rules restrict staff updates to these keys only — never touch
  // title/staff/project fields from the portal.
  const saveUpdate = async (a, patch) => {
    setBusy(true); setFormError(null);
    try {
      // Dev mode keeps plain numbers in local state (no Firestore
      // Timestamps leak into JSX).
      const payload = live
        ? { ...patch, updatedAt: serverTimestamp() }
        : { ...patch, startedAt: patch.startedAt ? Date.now() : undefined, updatedAt: Date.now() };
      if (!live) setAssignments(p => p.map(x => x.id === a.id ? { ...x, ...payload, updatedAt: Date.now() } : x));
      else await updateDoc(doc(db, 'workAssignments', a.id), payload);
      setEditTarget(null);
    } catch (e) { console.error(e); setFormError(e.message || 'Update failed.'); }
    finally { setBusy(false); }
  };

  // Accept confirms the handover; Start begins the clock. Admin and the
  // client see both steps immediately.
  const acceptWork = a => saveUpdate(a, { status: 'Accepted' });
  const startWork = a => saveUpdate(a, { status: 'In Progress', progress: Math.max(a.progress || 0, 5), startedAt: serverTimestamp() });

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: C.muted, fontSize: 13 }}>Loading your work…</div>;

  const prioColor = p => p === 'Critical' ? C.red : p === 'High' ? C.amber : p === 'Low' ? C.muted : C.subtle;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {loadError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10,
          background: 'rgba(240,90,103,0.1)', border: '1px solid rgba(240,90,103,0.35)', color: C.red, fontSize: 12 }}>
          <AlertTriangle size={14} /> {loadError}
        </div>
      )}

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12 }}>
        {[
          { label: variant === 'progress' ? 'Average Progress' : 'Total Assigned', val: variant === 'progress' ? `${stats.avg}%` : stats.total, color: C.cyan, icon: '📋' },
          { label: 'Active',          val: stats.active,  color: C.blue,  icon: '⚙️' },
          { label: 'Overdue',         val: stats.overdue, color: C.red,   icon: '🔥' },
          { label: 'Completed',       val: stats.total - stats.active, color: C.green, icon: '✅' },
        ].map(s => (
          <div key={s.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 18px' }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 11, color: C.muted }}>{s.label}</div>
          </div>
        ))}
      </div>

      <ERPPanel>
        <ERPPanelHeader
          title={variant === 'progress' ? 'My Work Progress' : 'My Assigned Work'}
          icon={variant === 'progress' ? '📈' : '📋'}
          action={<span style={{ fontSize: 10, color: C.muted }}>{sorted.length} task{sorted.length === 1 ? '' : 's'}</span>} />
        {sorted.length === 0 ? (
          <ERPEmpty icon="📋" title="Nothing assigned yet"
            sub="When your team lead assigns work it appears here immediately." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {sorted.map((a, i) => {
              const overdue = a.status !== 'Completed' && a.deadline && a.deadline < today;
              return (
                <div key={a.id} style={{ padding: '16px 18px', borderTop: i > 0 ? `1px solid ${C.border}20` : 'none' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13.5, fontWeight: 800, color: C.text }}>{a.title}</span>
                        <ERPBadge status={a.status} label={a.status} size="sm" />
                        {overdue && (
                          <span style={{ fontSize: 10, fontWeight: 800, color: C.red, padding: '2px 8px', borderRadius: 20, background: 'rgba(240,90,103,0.12)', border: '1px solid rgba(240,90,103,0.35)' }}>
                            OVERDUE
                          </span>
                        )}
                      </div>
                      {a.projectTitle && <div style={{ fontSize: 11, color: C.cyan, marginTop: 2 }}>Project: {a.projectTitle}</div>}
                      {(a.clientName || a.clientCompany) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                          <Building size={11} style={{ color: C.muted }} />
                          <span style={{ fontSize: 11, color: C.subtle, fontWeight: 700 }}>
                            {a.clientName || 'Client'}{a.clientCompany ? ` — ${a.clientCompany}` : ''}
                          </span>
                          {a.serviceType && <span style={{ fontSize: 10, color: C.muted }}>· {a.serviceType}</span>}
                        </div>
                      )}
                      {a.description && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{a.description}</div>}
                      <div style={{ display: 'flex', gap: 14, marginTop: 7, flexWrap: 'wrap', fontSize: 10.5, color: C.muted }}>
                        <span>Priority: <strong style={{ color: prioColor(a.priority) }}>{a.priority || '—'}</strong></span>
                        <span>Start: {a.startDate || '—'}</span>
                        <span style={overdue ? { color: C.red, fontWeight: 700 } : null}>
                          Deadline: {a.deadline || '—'}{overdue ? ' ⚠' : ''}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200, flex: 1 }}>
                      <ERPProgress value={a.progress || 0} color={(a.progress || 0) >= 100 ? C.green : C.blue} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: (a.progress || 0) >= 100 ? C.green : C.cyan }}>{a.progress || 0}%</span>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {a.status === 'Assigned' && (
                            <ERPBtn size="sm" variant="primary" disabled={busy} onClick={() => acceptWork(a)}>
                              <CheckCircle2 size={11} /> Accept Work
                            </ERPBtn>
                          )}
                          {a.status === 'Accepted' && (
                            <ERPBtn size="sm" variant="success" disabled={busy} onClick={() => startWork(a)}>
                              <Play size={11} /> Start Work
                            </ERPBtn>
                          )}
                          {a.status !== 'Assigned' && (
                            <ERPBtn size="sm" variant="secondary" onClick={() => openUpdate(a)}>
                              <Pencil size={11} /> Update
                            </ERPBtn>
                          )}
                        </div>
                      </div>
                      {toMs(a.updatedAt) > 0 && (
                        <div style={{ fontSize: 9.5, color: C.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={9} /> last updated {new Date(toMs(a.updatedAt)).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ERPPanel>

      {/* Status / progress modal */}
      <ERPModal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title="Update Work Status" width={440}>
        {editTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            <div style={{ fontSize: 12, color: C.subtle, fontWeight: 700 }}>{editTarget.title}</div>
            <ERPSelect label="Status" value={form.status}
              onChange={e => setForm(p => ({
                ...p,
                status: e.target.value,
                progress: e.target.value === 'Completed' ? 100 : p.progress,
              }))}
              options={ASSIGNMENT_STATUSES} />
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.subtle, marginBottom: 6 }}>
                Progress — <span style={{ color: C.cyan, fontWeight: 800 }}>{form.progress}%</span>
              </label>
              <input type="range" min="0" max="100" step="5" value={form.progress}
                onChange={e => setForm(p => ({ ...p, progress: Number(e.target.value) }))}
                style={{ width: '100%', accentColor: '#0066FF', cursor: 'pointer' }} />
            </div>
            {formError && (
              <div style={{ fontSize: 11, color: C.red, padding: '8px 12px', borderRadius: 8, background: 'rgba(240,90,103,0.1)', border: '1px solid rgba(240,90,103,0.3)' }}>
                {formError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <ERPBtn variant="secondary" onClick={() => setEditTarget(null)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</ERPBtn>
              <ERPBtn variant="primary" disabled={busy} onClick={() => saveUpdate(editTarget, { status: form.status, progress: form.progress })}
                style={{ flex: 1, justifyContent: 'center' }}>Save Update</ERPBtn>
            </div>
            <div style={{ fontSize: 10, color: C.muted }}>
              Progress you set here is visible to admins on the project and work boards in real time.
            </div>
          </div>
        )}
      </ERPModal>
    </div>
  );
}
