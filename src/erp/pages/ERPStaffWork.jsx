// ─────────────────────────────────────────────────────────────────
//  Phase 3 C — Work assignments (admin side).
//  Lead → Client → Project/Work → assign to one or more staff whose
//  profile fits that service. Each assignment embeds a snapshot of the
//  client and the staff member, so:
//    · the staff portal shows whose client/project they are working on
//    · the client portal shows their team and live progress
//  Staff move status/progress only — that flows back here via onSnapshot.
// ─────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  ERPPanel, ERPPanelHeader, ERPBadge, ERPBtn, ERPModal, ERPInput, ERPSelect,
  ERPEmpty, ERPAvatar, ERPProgress, C,
} from '../components/ERPui';
import { getConversationId } from '../messagingUtils';
import { PRIORITIES, ASSIGNMENT_STATUSES, toMs, dateKeyOf, todayKey, splitStaffByFit } from '../../staff/staffUtils';
import { fmtDate } from '../money';
import { Plus, Pencil, Trash2, AlertTriangle, Search, Users, MessageSquare } from 'lucide-react';

const AVATAR_COLORS = ['#0066FF', '#8B5CF6', '#18C77A', '#F5B942', '#F05A67', '#00D9FF'];
const EMPTY_FORM = {
  clientId: '', clientName: '', clientCompany: '', serviceType: '',
  projectId: '', projectTitle: '', title: '', description: '',
  staffId: '', startDate: todayKey(), deadline: '', priority: 'Medium', status: 'Assigned', progress: 0,
};

// Dev preview data removed — the Work tab starts empty so nobody mistakes a
// scripted row (fake staff, client or project) for real ERP data.
const DEV_CLIENTS = [];

const DEV_PROJECTS = [];

const DEV_ASSIGNMENTS = [];

export default function ERPStaffWork() {
  const { isFirebaseConfigured, isDevSession } = useAuth();
  const live = isFirebaseConfigured && !isDevSession;

  const [assignments, setAssignments] = useState([]);
  const [staff,       setStaff]       = useState([]);
  const [projects,    setProjects]    = useState([]);
  const [clients,     setClients]     = useState([]);
  const [syncBusy,    setSyncBusy]    = useState(false);
  const [syncedAt,    setSyncedAt]    = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState(null);
  const [fStaff,      setFStaff]      = useState('All');
  const [fStatus,     setFStatus]     = useState('All');
  const [fClient,     setFClient]     = useState('All');
  const [showForm,    setShowForm]    = useState(false);
  const [editId,      setEditId]      = useState(null);
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [clientQ,     setClientQ]     = useState('');    // client search text
  const [selStaff,    setSelStaff]    = useState([]);    // staff ids picked
  const [showAllStaff, setShowAllStaff] = useState(false);
  const [delTarget,   setDelTarget]   = useState(null);
  const [busy,        setBusy]        = useState(false);
  const [formError,   setFormError]   = useState(null);

  useEffect(() => {
    if (!live) {
      setAssignments(DEV_ASSIGNMENTS);
      setStaff([]);
      setClients(DEV_CLIENTS);
      setProjects(DEV_PROJECTS);
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
      onSnapshot(collection(db, 'clients'),
        snap => setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => c.status !== 'deleted')),
        err => console.error(err)),
    ];
    return () => unsubs.forEach(u => u());
  }, [live]);

  const staffName = id => staff.find(s => s.id === id)?.name || '—';

  const filtered = assignments
    .filter(a => (fStaff === 'All' ? true : a.staffId === fStaff))
    .filter(a => (fStatus === 'All' ? true : a.status === fStatus))
    .filter(a => (fClient === 'All' ? true : a.clientId === fClient))
    .sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt) || String(a.deadline).localeCompare(String(b.deadline)));

  const today = todayKey();
  const stats = {
    assigned:  assignments.filter(a => a.status === 'Assigned').length,
    accepted:  assignments.filter(a => a.status === 'Accepted').length,
    progress:  assignments.filter(a => a.status === 'In Progress').length,
    done:      assignments.filter(a => a.status === 'Completed').length,
    overdue:   assignments.filter(a => a.status !== 'Completed' && a.deadline && a.deadline < today).length,
  };

  // ── Picker data for the modal ────────────────────────────────────
  const clientOptions = clients
    .filter(c => {
      const q = clientQ.trim().toLowerCase();
      return !q || `${c.name || ''} ${c.company || ''}`.toLowerCase().includes(q);
    })
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

  // Projects belonging to the client picked above (falls back to the
  // current form's project so editing an old row never empties the list).
  const clientProjects = projects.filter(p =>
    !form.clientId || p.clientId === form.clientId || p.id === form.projectId);

  const { suited, others } = splitStaffByFit(
    staff,
    form.serviceType || projects.find(p => p.id === form.projectId)?.serviceType || ''
  );
  const staffPool = showAllStaff ? [...suited, ...others] : suited;
  const unavailable = s => s.status === 'on-leave' || s.status === 'inactive';

  const openCreate = () => {
    setEditId(null); setForm(EMPTY_FORM); setSelStaff([]); setClientQ(''); setShowAllStaff(false);
    setFormError(null); setShowForm(true);
  };
  const openEdit = (a) => {
    setEditId(a.id); setFormError(null); setShowAllStaff(true); setClientQ('');
    setSelStaff(a.staffId ? [a.staffId] : []);
    setForm({
      clientId: a.clientId || '', clientName: a.clientName || '', clientCompany: a.clientCompany || '',
      serviceType: a.serviceType || '',
      projectId: a.projectId || '', projectTitle: a.projectTitle || '', title: a.title || '',
      description: a.description || '', staffId: a.staffId || '',
      startDate: a.startDate || todayKey(), deadline: a.deadline || '',
      priority: a.priority || 'Medium', status: a.status || 'Assigned', progress: a.progress || 0,
    });
    setShowForm(true);
  };

  // Create mode → assign the same work to several staff at once (one
  // assignment doc each). Edit mode → single staff, replaces the row's own.
  const toggleStaff = (id) => {
    if (editId) { setSelStaff([id]); return; }
    setSelStaff(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  };

  // Grant assigned staff chat access on the client's conversation doc.
  // Firestore rules let an assigned staff member read/post in
  // conversations/admin_client_{clientId} only via assignedStaffUids.
  const syncChatAccess = async (list) => {
    const byClient = {};
    list.forEach(a => {
      if (a.clientId && a.authUid) {
        (byClient[a.clientId] = byClient[a.clientId] || { uids: new Set(), name: a.clientName || a.clientCompany || 'Client' })
          .uids.add(a.authUid);
      }
    });
    for (const [clientId, info] of Object.entries(byClient)) {
      const convId = getConversationId('client', clientId);
      await setDoc(doc(db, 'conversations', convId), {
        id: convId, type: 'client',
        participantUid: clientId, participantName: info.name, participantRole: 'client',
        assignedStaffUids: arrayUnion(...info.uids),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }
  };

  const handleSave = async () => {
    if (!form.title.trim())          { setFormError('Enter a work title.'); return; }
    if (!selStaff.length)            { setFormError('Pick at least one staff member.'); return; }
    const proj = projects.find(p => p.id === form.projectId);
    const client = clients.find(c => c.id === form.clientId);
    const picks = selStaff.map(id => staff.find(s => s.id === id)).filter(Boolean);
    const shared = {
      clientId:     client?.id || form.clientId || '',
      clientName:   client?.name || form.clientName || '',
      clientCompany:client?.company || form.clientCompany || '',
      serviceType:  proj?.serviceType || form.serviceType || '',
      projectId:    proj?.id || '', projectTitle: proj?.title || '',
      title: form.title.trim(), description: form.description.trim(),
      startDate: form.startDate, deadline: form.deadline,
      priority: form.priority, progress: Number(form.progress) || 0,
      updatedAt: serverTimestamp(),
    };
    setBusy(true); setFormError(null);
    try {
      if (editId) {
        const m = picks[0];
        const payload = {
          ...shared, status: form.status || 'Assigned',
          staffId: m.id, staffName: m.name || '—', staffRole: m.role || '',
          staffEmail: m.loginEmail || m.email || '', staffPhone: m.phone || '',
          authUid: m.authUid || m.id || '',
        };
        if (!live) setAssignments(p => p.map(a => a.id === editId ? { ...a, ...payload, updatedAt: Date.now() } : a));
        else await updateDoc(doc(db, 'workAssignments', editId), payload);
      } else {
        for (const m of picks) {
          const payload = {
            ...shared, status: 'Assigned',
            staffId: m.id, staffName: m.name || '—', staffRole: m.role || '',
            staffEmail: m.loginEmail || m.email || '', staffPhone: m.phone || '',
            authUid: m.authUid || m.id || '',
          };
          if (!live) setAssignments(p => [{ id: `dev-${Date.now()}-${m.id}`, ...payload, createdAt: Date.now() }, ...p]);
          else await addDoc(collection(db, 'workAssignments'), { ...payload, createdAt: serverTimestamp() });
        }
        // The team being assigned IS the work starting — move the client's
        // project out of the pre-work state so their dashboard shows it live.
        if (live && proj && !['In Progress', 'Completed', 'archived'].includes(proj.status)) {
          try { await updateDoc(doc(db, 'projects', proj.id), { status: 'In Progress', updatedAt: serverTimestamp() }); }
          catch (e) { console.error('project status sync skipped', e); }
        }
      }
      // Give the assigned staff chat access to that client's thread.
      if (live && shared.clientId) {
        try {
          await syncChatAccess(picks.map(m => ({
            clientId: shared.clientId,
            clientName: shared.clientName || shared.clientCompany || 'Client',
            authUid: m.authUid || m.id || '',
          })));
        } catch (e) { console.error('Chat access sync skipped:', e); }
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
          { label: 'Assigned', val: stats.assigned, color: C.violet, icon: '📥' },
          { label: 'Accepted', val: stats.accepted, color: C.cyan, icon: '🤝' },
          { label: 'In Progress', val: stats.progress, color: C.blue, icon: '⚙️' },
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
        <div style={{ minWidth: 180 }}>
          <ERPSelect value={fClient} onChange={e => setFClient(e.target.value)}
            options={[{ value: 'All', label: 'All clients' },
              ...clients.map(c => ({ value: c.id, label: c.name || c.company || c.id }))]} />
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
        <ERPPanelHeader title="Work Assignments" icon="📋"
          action={live ? (
            <ERPBtn size="sm" variant="ghost" onClick={async () => {
              setSyncBusy(true);
              try { await syncChatAccess(assignments); setSyncedAt(Date.now()); }
              catch (e) { console.error(e); }
              finally { setSyncBusy(false); }
            }}>
              <MessageSquare size={12} /> {syncBusy ? 'Syncing…' : syncedAt ? '✓ Chat Access Synced' : 'Sync Chat Access'}
            </ERPBtn>
          ) : null} />
        {filtered.length === 0 ? (
          <ERPEmpty icon="📋" title="No assignments" sub="Assign project work to staff — they will see it in their portal immediately."
            action={<ERPBtn variant="primary" onClick={openCreate}><Plus size={12} /> New Assignment</ERPBtn>} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Work / Project', 'Client', 'Assigned To', 'Priority', 'Start', 'Deadline', 'Progress', 'Status', ''].map(h => (
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
                      <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20`, maxWidth: 170 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.subtle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.clientName || '—'}
                        </div>
                        <div style={{ fontSize: 10, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.clientCompany || a.serviceType || ''}
                        </div>
                      </td>
                      <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <ERPAvatar name={a.staffName} color={AVATAR_COLORS[(a.staffName || '?').length % AVATAR_COLORS.length]} size={24} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 11, color: C.subtle, fontWeight: 600 }}>{a.staffName}</div>
                            {a.staffRole && <div style={{ fontSize: 9.5, color: C.muted }}>{a.staffRole}</div>}
                          </div>
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
        title={editId ? 'Edit Assignment' : 'New Work Assignment'} width={620}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>

          {/* 1 · Which client's work is this? */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.subtle, marginBottom: 6 }}>Client</div>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <Search size={13} style={{ position: 'absolute', left: 11, top: 10, color: C.muted }} />
              <input value={clientQ} onChange={e => setClientQ(e.target.value)}
                placeholder="Search client by name or company…"
                style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(10,24,56,0.8)',
                  border: `1px solid ${C.border}`, borderRadius: 9, padding: '8px 12px 8px 32px',
                  color: C.text, fontSize: 12, outline: 'none' }} />
            </div>
            <ERPSelect value={form.clientId} placeholder="Select client..."
              onChange={e => {
                const c = clients.find(x => x.id === e.target.value);
                setForm(p => ({ ...p, clientId: e.target.value, clientName: c?.name || '',
                  clientCompany: c?.company || '', projectId: '', projectTitle: '',
                  serviceType: c ? p.serviceType : '' }));
              }}
              options={clientOptions.map(c => ({ value: c.id, label: `${c.name || c.id}${c.company ? ` — ${c.company}` : ''}` }))} />
            {clientOptions.length === 0 && clients.length > 0 && (
              <div style={{ fontSize: 10.5, color: C.muted, marginTop: 5 }}>No client matches “{clientQ}”.</div>
            )}
          </div>

          <ERPSelect label="Project (optional — leave empty for general work)"
            value={form.projectId}
            onChange={e => {
              const p = projects.find(x => x.id === e.target.value);
              setForm(prev => ({ ...prev, projectId: e.target.value, projectTitle: p?.title || '',
                serviceType: p?.serviceType || '',
                clientName: prev.clientName || p?.clientName || '',
                clientCompany: prev.clientCompany || p?.clientCompany || '',
                clientId: prev.clientId || p?.clientId || '' }));
            }}
            placeholder="Select project..."
            options={clientProjects.map(p => ({
              value: p.id,
              label: `${p.title || p.id}${p.status ? ` · ${p.status}` : ''}`,
            }))} />
          {form.clientId && clientProjects.length === 0 && (
            <div style={{ fontSize: 10.5, color: C.amber }}>
              This client has no project record yet — you can still assign the work as general work.
            </div>
          )}

          <ERPInput label="Work Title" value={form.title} required
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            placeholder="e.g. Build POS order screen components" />
          <ERPInput label="Description (optional)" value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="Short brief for the staff member" />

          {/* 2 · Who fits this work? */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 7, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.subtle }}>
                Assign To {form.serviceType && (
                  <span style={{ color: C.muted, fontWeight: 400 }}>
                    — staff suited to “{form.serviceType}”
                  </span>
                )}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: C.muted, cursor: 'pointer' }}>
                <input type="checkbox" checked={showAllStaff} onChange={e => setShowAllStaff(e.target.checked)}
                  style={{ accentColor: '#0066FF' }} />
                Show all staff
              </label>
            </div>

            {staffPool.length === 0 ? (
              <div style={{ fontSize: 11.5, color: C.muted, padding: '12px 14px', borderRadius: 10,
                background: 'rgba(10,24,56,0.6)', border: `1px solid ${C.border}` }}>
                No staff profile matches this service{!showAllStaff ? ' — tick “Show all staff” to see the rest.' : ' yet. Add staff from ERP → Staff → Add Staff.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {staffPool.map(s => {
                  const on = selStaff.includes(s.id);
                  const blocked = unavailable(s) && !showAllStaff;
                  return (
                    <button key={s.id} onClick={() => !blocked && toggleStaff(s.id)}
                      disabled={blocked}
                      title={blocked ? `${s.name} is ${s.status}` : ''}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 22,
                        cursor: blocked ? 'not-allowed' : 'pointer', fontSize: 11.5, fontWeight: 700,
                        opacity: blocked ? 0.45 : 1,
                        background: on ? 'linear-gradient(135deg,#0066FF,#1787FF)' : 'rgba(10,24,56,0.8)',
                        color: on ? '#fff' : C.subtle,
                        border: `1px solid ${on ? 'transparent' : C.border}`,
                      }}>
                      <ERPAvatar name={s.name} size={20}
                        color={AVATAR_COLORS[(s.name || '?').length % AVATAR_COLORS.length]} />
                      {s.name}
                      {s.role && <span style={{ fontWeight: 400, opacity: 0.75, fontSize: 10 }}>· {s.role}</span>}
                      {s.status && s.status !== 'active' && (
                        <ERPBadge status={s.status} label={s.status} />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {!editId && selStaff.length > 0 && (
              <div style={{ fontSize: 10.5, color: C.cyan, marginTop: 7 }}>
                {selStaff.length} staff member{selStaff.length > 1 ? 's' : ''} will get this work in their portal.
              </div>
            )}
            {!editId && suited.length === 0 && others.length > 0 && !showAllStaff && (
              <div style={{ fontSize: 10.5, color: C.muted, marginTop: 7 }}>
                Nobody's role matches this service — tick “Show all staff” to pick manually.
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <ERPSelect label="Priority" value={form.priority}
              onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} options={PRIORITIES} />
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
            <ERPBtn variant="primary" disabled={busy || !form.title.trim() || selStaff.length === 0}
              onClick={handleSave} style={{ flex: 1, justifyContent: 'center' }}>
              <Users size={13} /> {editId ? 'Save Changes' : `Assign Work${selStaff.length > 1 ? ` (${selStaff.length})` : ''}`}
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
