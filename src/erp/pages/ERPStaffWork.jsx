// ─────────────────────────────────────────────────────────────────
//  Phase 3 C — Work assignments (admin side).
//  Lead → Project/Work → assign to staff. Staff see these in their
//  portal and can only move status/progress — those updates flow back
//  here live through onSnapshot.
// ─────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  ERPPanel, ERPPanelHeader, ERPBadge, ERPBtn, ERPModal, ERPInput, ERPSelect,
  ERPEmpty, ERPAvatar, ERPProgress, C,
} from '../components/ERPui';
import { PRIORITIES, ASSIGNMENT_STATUSES, toMs, dateKeyOf, todayKey } from '../../staff/staffUtils';
import { fmtDate } from '../money';
import { Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react';

const AVATAR_COLORS = ['#0066FF', '#8B5CF6', '#18C77A', '#F5B942', '#F05A67', '#00D9FF'];
const EMPTY_FORM = {
  projectId: '', projectTitle: '', title: '', description: '',
  staffId: '', startDate: todayKey(), deadline: '', priority: 'Medium', status: 'Assigned', progress: 0,
};

const DEV_ASSIGNMENTS = [
  { id: 'wa1', projectId: 'P001', projectTitle: 'Corporate Website Redesign', title: 'Home page component build', staffId: 'dev-staff-001', staffName: 'Ashan Perera', startDate: '2026-10-01', deadline: '2026-10-10', priority: 'High', status: 'In Progress', progress: 60 },
  { id: 'wa2', projectId: 'P003', projectTitle: 'Restaurant POS System', title: 'Order screen UI', staffId: 'dev-staff-002', staffName: 'Nimali Silva', startDate: '2026-09-28', deadline: '2026-10-04', priority: 'Critical', status: 'Assigned', progress: 0 },
  { id: 'wa3', projectId: '', projectTitle: '', title: 'September bookkeeping close', staffId: 'dev-staff-003', staffName: 'Ruwan Jayasuriya', startDate: '2026-10-01', deadline: '2026-10-07', priority: 'Medium', status: 'Completed', progress: 100 },
];

export default function ERPStaffWork() {
  const { isFirebaseConfigured, isDevSession } = useAuth();
  const live = isFirebaseConfigured && !isDevSession;

  const [assignments, setAssignments] = useState([]);
  const [staff,       setStaff]       = useState([]);
  const [projects,    setProjects]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState(null);
  const [fStaff,      setFStaff]      = useState('All');
  const [fStatus,     setFStatus]     = useState('All');
  const [showForm,    setShowForm]    = useState(false);
  const [editId,      setEditId]      = useState(null);
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [delTarget,   setDelTarget]   = useState(null);
  const [busy,        setBusy]        = useState(false);
  const [formError,   setFormError]   = useState(null);

  useEffect(() => {
    if (!live) {
      setAssignments(DEV_ASSIGNMENTS);
      setStaff([
        { id: 'dev-staff-001', name: 'Ashan Perera', role: 'Full Stack Developer', status: 'active' },
        { id: 'dev-staff-002', name: 'Nimali Silva', role: 'UI/UX Designer', status: 'busy' },
        { id: 'dev-staff-003', name: 'Ruwan Jayasuriya', role: 'Accountant', status: 'on-leave' },
      ]);
      setLoading(false);
      return;
    }
    const unsubs = [
      onSnapshot(collection(db, 'workAssignments'),
        snap => { setAssignments(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
        err => { console.error(err); setLoadError(`Work assignments — ${err.message}`); setLoading(false); }),
      onSnapshot(collection(db, 'staff'),
        snap => setStaff(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.deleted)),
        err => console.error(err)),
      onSnapshot(collection(db, 'projects'),
        snap => setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
        err => console.error(err)),
    ];
    return () => unsubs.forEach(u => u());
  }, [live]);

  const staffName = id => staff.find(s => s.id === id)?.name || '—';

  const filtered = assignments
    .filter(a => (fStaff === 'All' ? true : a.staffId === fStaff))
    .filter(a => (fStatus === 'All' ? true : a.status === fStatus))
    .sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt) || String(a.deadline).localeCompare(String(b.deadline)));

  const today = todayKey();
  const stats = {
    assigned: assignments.filter(a => a.status === 'Assigned').length,
    progress: assignments.filter(a => a.status === 'In Progress').length,
    done:     assignments.filter(a => a.status === 'Completed').length,
    overdue:  assignments.filter(a => a.status !== 'Completed' && a.deadline && a.deadline < today).length,
  };

  const openCreate = () => { setEditId(null); setForm(EMPTY_FORM); setFormError(null); setShowForm(true); };
  const openEdit = (a) => {
    setEditId(a.id); setFormError(null);
    setForm({
      projectId: a.projectId || '', projectTitle: a.projectTitle || '', title: a.title || '',
      description: a.description || '', staffId: a.staffId || '',
      startDate: a.startDate || todayKey(), deadline: a.deadline || '',
      priority: a.priority || 'Medium', status: a.status || 'Assigned', progress: a.progress || 0,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.staffId) return;
    const member = staff.find(s => s.id === form.staffId);
    const proj = projects.find(p => p.id === form.projectId);
    const payload = {
      projectId: proj?.id || '', projectTitle: proj?.title || '',
      title: form.title.trim(), description: form.description.trim(),
      staffId: form.staffId, staffName: member?.name || '—',
      authUid: member?.authUid || member?.id || '',
      startDate: form.startDate, deadline: form.deadline,
      priority: form.priority, status: form.status, progress: Number(form.progress) || 0,
      updatedAt: serverTimestamp(),
    };
    setBusy(true); setFormError(null);
    try {
      if (!live) {
        if (editId) setAssignments(p => p.map(a => a.id === editId ? { ...a, ...payload, updatedAt: Date.now() } : a));
        else setAssignments(p => [{ id: `dev-${Date.now()}`, ...payload, createdAt: Date.now() }, ...p]);
      } else if (editId) {
        await updateDoc(doc(db, 'workAssignments', editId), payload);
      } else {
        await addDoc(collection(db, 'workAssignments'), { ...payload, createdAt: serverTimestamp() });
      }
      setShowForm(false);
    } catch (e) { console.error(e); setFormError(e.message || 'Save failed.'); }
    finally { setBusy(false); }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      if (!live) setAssignments(p => p.filter(a => a.id !== delTarget.id));
      else await deleteDoc(doc(db, 'workAssignments', delTarget.id));
      setDelTarget(null);
    } catch (e) { console.error(e); }
    finally { setBusy(false); }
  };

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: C.muted, fontSize: 13 }}>Loading assignments…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {loadError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10,
          background: 'rgba(240,90,103,0.1)', border: '1px solid rgba(240,90,103,0.35)', color: C.red, fontSize: 12 }}>
          <AlertTriangle size={14} /> {loadError}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
        {[
          { label: 'Assigned', val: stats.assigned, color: C.blue, icon: '📥' },
          { label: 'In Progress', val: stats.progress, color: C.cyan, icon: '⚙️' },
          { label: 'Completed', val: stats.done, color: C.green, icon: '✅' },
          { label: 'Overdue', val: stats.overdue, color: C.red, icon: '🔥' },
        ].map(s => (
          <div key={s.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 18px' }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 11, color: C.muted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters + create */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 170 }}>
          <ERPSelect value={fStaff} onChange={e => setFStaff(e.target.value)}
            options={[{ value: 'All', label: 'All staff' }, ...staff.map(s => ({ value: s.id, label: s.name }))]} />
        </div>
        {['All', ...ASSIGNMENT_STATUSES].map(f => (
          <button key={f} onClick={() => setFStatus(f)} style={{
            padding: '7px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            background: fStatus === f ? 'linear-gradient(135deg,#0066FF,#1787FF)' : 'rgba(10,24,56,0.8)',
            color: fStatus === f ? '#fff' : C.muted, border: fStatus === f ? 'none' : `1px solid ${C.border}`,
          }}>{f}</button>
        ))}
        <ERPBtn variant="primary" onClick={openCreate} style={{ marginLeft: 'auto' }}>
          <Plus size={13} /> New Assignment
        </ERPBtn>
      </div>

      <ERPPanel>
        <ERPPanelHeader title="Work Assignments" icon="📋" />
        {filtered.length === 0 ? (
          <ERPEmpty icon="📋" title="No assignments" sub="Assign project work to staff — they will see it in their portal immediately."
            action={<ERPBtn variant="primary" onClick={openCreate}><Plus size={12} /> New Assignment</ERPBtn>} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Work / Project', 'Assigned To', 'Priority', 'Start', 'Deadline', 'Progress', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.8px', color: C.muted, textAlign: 'left', background: 'rgba(10,24,56,0.5)',
                      borderBottom: `1px solid ${C.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => {
                  const overdue = a.status !== 'Completed' && a.deadline && a.deadline < today;
                  return (
                    <tr key={a.id}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,102,255,0.04)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20`, maxWidth: 240 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{a.title}</div>
                        <div style={{ fontSize: 10, color: a.projectTitle ? C.cyan : C.muted }}>
                          {a.projectTitle || 'General work'}
                        </div>
                      </td>
                      <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <ERPAvatar name={a.staffName} color={AVATAR_COLORS[(a.staffName || '?').length % AVATAR_COLORS.length]} size={24} />
                          <span style={{ fontSize: 11, color: C.subtle, fontWeight: 600 }}>{a.staffName}</span>
                        </div>
                      </td>
                      <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color:
                          a.priority === 'Critical' ? C.red : a.priority === 'High' ? C.amber : a.priority === 'Low' ? C.muted : C.subtle }}>
                          {a.priority}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }}>
                        <span style={{ fontSize: 11, color: C.muted }}>{fmtDate(a.startDate) || '—'}</span>
                      </td>
                      <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }}>
                        <span style={{ fontSize: 11, color: overdue ? C.red : C.muted, fontWeight: overdue ? 700 : 400 }}>
                          {fmtDate(a.deadline) || '—'}{overdue ? ' ⚠' : ''}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20`, minWidth: 120 }}>
                        <ERPProgress value={a.progress || 0} color={a.progress >= 100 ? C.green : C.blue} />
                        <div style={{ fontSize: 10, color: C.cyan, marginTop: 3 }}>{a.progress || 0}%</div>
                      </td>
                      <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }}>
                        <ERPBadge status={a.status} label={a.status} />
                      </td>
                      <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <ERPBtn size="sm" variant="secondary" onClick={() => openEdit(a)}><Pencil size={12} /></ERPBtn>
                          <ERPBtn size="sm" variant="danger" onClick={() => setDelTarget(a)}><Trash2 size={12} /></ERPBtn>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ERPPanel>

      {/* Create / edit modal */}
      <ERPModal isOpen={showForm} onClose={() => setShowForm(false)}
        title={editId ? 'Edit Assignment' : 'New Work Assignment'} width={520}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          <ERPSelect label="Project (optional — leave empty for general work)"
            value={form.projectId}
            onChange={e => {
              const p = projects.find(x => x.id === e.target.value);
              setForm(prev => ({ ...prev, projectId: e.target.value, projectTitle: p?.title || '' }));
            }}
            placeholder="Select project..."
            options={projects.map(p => ({ value: p.id, label: p.title || p.id }))} />
          <ERPInput label="Work Title" value={form.title} required
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            placeholder="e.g. Build POS order screen components" />
          <ERPInput label="Description (optional)" value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="Short brief for the staff member" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <ERPSelect label="Assign To" value={form.staffId} required
              onChange={e => setForm(p => ({ ...p, staffId: e.target.value }))}
              placeholder="Select staff..."
              options={staff.map(s => ({ value: s.id, label: `${s.name}${s.role ? ` — ${s.role}` : ''}` }))} />
            <ERPSelect label="Priority" value={form.priority}
              onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} options={PRIORITIES} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <ERPInput label="Start Date" value={form.startDate} type="date"
              onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} />
            <ERPInput label="Deadline" value={form.deadline} type="date"
              onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))} />
          </div>
          {editId && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <ERPSelect label="Status" value={form.status}
                onChange={e => setForm(p => ({ ...p, status: e.target.value }))} options={ASSIGNMENT_STATUSES} />
              <ERPInput label="Progress %" value={form.progress} type="number" min="0" max="100"
                onChange={e => setForm(p => ({ ...p, progress: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }))} />
            </div>
          )}
          {formError && (
            <div style={{ fontSize: 11, color: C.red, padding: '8px 12px', borderRadius: 8, background: 'rgba(240,90,103,0.1)', border: '1px solid rgba(240,90,103,0.3)' }}>
              {formError}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <ERPBtn variant="secondary" onClick={() => setShowForm(false)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</ERPBtn>
            <ERPBtn variant="primary" disabled={busy || !form.title.trim() || !form.staffId}
              onClick={handleSave} style={{ flex: 1, justifyContent: 'center' }}>
              {editId ? 'Save Changes' : 'Assign Work'}
            </ERPBtn>
          </div>
        </div>
      </ERPModal>

      {/* Delete confirm */}
      <ERPModal isOpen={!!delTarget} onClose={() => setDelTarget(null)} title="Delete Assignment" width={400}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', textAlign: 'center' }}>
          <div style={{ fontSize: 34 }}>🗑️</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Delete “{delTarget?.title}”?</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
              Assigned to {delTarget?.staffName ? staffName(delTarget.staffId) === '—' ? delTarget.staffName : staffName(delTarget.staffId) : '—'}. The staff member will no longer see it in their portal.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
            <ERPBtn variant="secondary" onClick={() => setDelTarget(null)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</ERPBtn>
            <ERPBtn variant="danger" disabled={busy} onClick={handleDelete} style={{ flex: 1, justifyContent: 'center' }}>Delete</ERPBtn>
          </div>
        </div>
      </ERPModal>
    </div>
  );
}
