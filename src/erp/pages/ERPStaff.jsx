// ─────────────────────────────────────────────────────────────────
//  Phase 3 A — Staff Management (admin).
//  Tab shell hosting the five staff sub-pages; the Staff tab itself
//  implements the full profile CRUD (auto STF numbers), login account
//  provisioning, password reset and the secure KYC / HR document
//  manager (Storage + getBytes — files are never public URLs).
// ─────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc,
  serverTimestamp, getDocs, query, where, limit, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { ref, uploadBytes, getBytes, deleteObject, listAll } from 'firebase/storage';
import { sendPasswordResetEmail } from 'firebase/auth';
import { db, storage, auth, createStaffAuthAccount, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  ERPPanel, ERPPanelHeader, ERPBadge, ERPBtn, ERPModal, ERPInput, ERPSelect,
  ERPEmpty, ERPAvatar, C,
} from '../components/ERPui';
import {
  nextNumber, DOC_CATEGORIES, STAFF_STATUSES, computeNet,
} from '../../staff/staffUtils';
import { toInt, formatLKR, fmtDate, todayISO } from '../money';
import { Plus, Eye, Pencil, Trash2, KeyRound, Download, Upload, FileText, ShieldCheck, AlertTriangle } from 'lucide-react';
import ERPStaffWork        from './ERPStaffWork';
import ERPStaffAttendance  from './ERPStaffAttendance';
import ERPStaffUpdates     from './ERPStaffUpdates';
import ERPStaffSalary      from './ERPStaffSalary';

const DEPARTMENTS = ['Engineering', 'Design', 'Finance', 'Operations', 'Management'];
const AVATAR_COLORS = ['#0066FF', '#8B5CF6', '#18C77A', '#F5B942', '#F05A67', '#00D9FF'];

const EMPTY_FORM = {
  name: '', role: '', department: '', email: '', password: '',
  phone: '', address: '', joinedDate: todayISO(), education: '',
  basicSalary: '', allowances: '', deductions: '', status: 'active',
};

// Dev-mode only fixtures (never written to the DB).
const DEV_STAFF = [
  { id: 'dev-staff-001', staffId: 'STF-2026-0001', name: 'Ashan Perera', role: 'Full Stack Developer', department: 'Engineering',
    loginEmail: 'staff@smart.com', email: 'staff@smart.com', phone: '+94 77 111 2233', address: 'Colombo 05',
    joinedDate: '2026-01-12', education: 'BSc Computer Science, Univ. of Colombo',
    basicSalary: 120000, allowances: 10000, deductions: 8000, status: 'active', authUid: 'dev-staff-001', docs: [
      { id: 'd1', category: 'kyc', name: 'NIC-front.pdf', path: 'staff-docs/dev-staff-001/nic.pdf', size: 184320, uploadedAt: '2026-01-13T04:20:00.000Z' },
      { id: 'd2', category: 'certificate', name: 'AWS-CCP.pdf', path: 'staff-docs/dev-staff-001/aws.pdf', size: 96000, uploadedAt: '2026-02-02T06:10:00.000Z' },
    ] },
  { id: 'dev-staff-002', staffId: 'STF-2026-0002', name: 'Nimali Silva', role: 'UI/UX Designer', department: 'Design',
    loginEmail: 'nimali@smartpvtltd.com', email: 'nimali@smartpvtltd.com', phone: '+94 71 555 8890', address: 'Kandy',
    joinedDate: '2026-03-01', education: 'BA Visual Communication',
    basicSalary: 95000, allowances: 5000, deductions: 5000, status: 'busy', authUid: 'dev-staff-002', docs: [] },
  { id: 'dev-staff-003', staffId: 'STF-2026-0003', name: 'Ruwan Jayasuriya', role: 'Accountant', department: 'Finance',
    loginEmail: 'ruwan@smartpvtltd.com', email: 'ruwan@smartpvtltd.com', phone: '+94 76 234 1122', address: 'Trincomalee',
    joinedDate: '2026-05-20', education: 'CA Finalist',
    basicSalary: 110000, allowances: 8000, deductions: 9000, status: 'on-leave', authUid: 'dev-staff-003', docs: [] },
];

// ═════════════════════════════════════════════════════════════════
export default function ERPStaff() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'staff';
  const setTab = t => setParams(t === 'staff' ? {} : { tab: t });

  const TABS = [
    { id: 'staff',      label: 'Staff',           icon: '👥' },
    { id: 'work',       label: 'Work',            icon: '📋' },
    { id: 'attendance', label: 'Attendance',      icon: '🕒' },
    { id: 'updates',    label: 'Daily Updates',   icon: '📝' },
    { id: 'salary',     label: 'Salary & Payslips', icon: '💰' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            background: tab === t.id ? 'linear-gradient(135deg,#0066FF,#1787FF)' : 'rgba(10,24,56,0.8)',
            color: tab === t.id ? '#fff' : C.muted, border: tab === t.id ? 'none' : `1px solid ${C.border}`,
            boxShadow: tab === t.id ? '0 4px 14px rgba(0,102,255,0.35)' : 'none', transition: 'all 0.15s',
          }}>{t.icon} {t.label}</button>
        ))}
      </div>

      {tab === 'staff'      && <StaffTab />}
      {tab === 'work'       && <ERPStaffWork />}
      {tab === 'attendance' && <ERPStaffAttendance />}
      {tab === 'updates'    && <ERPStaffUpdates />}
      {tab === 'salary'     && <ERPStaffSalary />}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
//  STAFF TAB — profile CRUD + documents + login accounts
// ═════════════════════════════════════════════════════════════════
function StaffTab() {
  const { isFirebaseConfigured, isDevSession } = useAuth();
  const live = isFirebaseConfigured && !isDevSession;

  const [staff,     setStaff]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [detailId,  setDetailId]  = useState(null);
  const [showForm,  setShowForm]  = useState(false);
  const [editId,    setEditId]    = useState(null);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [confirmState, setConfirmState] = useState(null); // {type:'delete'|'resetpw'|'doc', staff, docEntry}
  const [busy,      setBusy]      = useState(false);
  const [notice,    setNotice]    = useState(null);   // {kind:'ok'|'error', msg}
  const [docCat,    setDocCat]    = useState('kyc');
  const fileRef     = useRef(null);

  useEffect(() => {
    if (!live) { setStaff([]); setLoading(false); return; }
    const unsub = onSnapshot(collection(db, 'staff'),
      snap => {
        setStaff(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.deleted));
        setLoading(false);
      },
      err => { console.error(err); setLoadError(`Could not load staff — ${err.message}`); setLoading(false); });
    return unsub;
  }, [live]);

  const sorted = [...staff].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  const detail = staff.find(s => s.id === detailId) || null;

  // ── create / edit ────────────────────────────────────────────────
  const openCreate = () => { setEditId(null); setForm(EMPTY_FORM); setNotice(null); setShowForm(true); };
  const openEdit = (s) => {
    setEditId(s.id); setNotice(null);
    setForm({
      name: s.name || '', role: s.role || '', department: s.department || '',
      email: s.loginEmail || s.email || '', password: '',
      phone: s.phone || '', address: s.address || '', joinedDate: s.joinedDate || '',
      education: s.education || '', basicSalary: s.basicSalary || '', allowances: s.allowances || '',
      deductions: s.deductions || '', status: s.status || 'active',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) return;
    if (!editId && live && !form.password) return;
    setBusy(true); setNotice(null);
    try {
      if (!live) {
        // Dev session — local mock only, nothing touches the DB.
        if (editId) setStaff(p => p.map(s => s.id === editId ? { ...s, ...form, basicSalary: toInt(form.basicSalary), allowances: toInt(form.allowances), deductions: toInt(form.deductions) } : s));
        else setStaff(p => [...p, { id: `dev-${Date.now()}`, staffId: `STF-DEV-${String(p.length + 1).padStart(4, '0')}`, authUid: `dev-${Date.now()}`, docs: [], ...form, basicSalary: toInt(form.basicSalary), allowances: toInt(form.allowances), deductions: toInt(form.deductions) }]);
        setShowForm(false);
        return;
      }
      if (editId) {
        await updateDoc(doc(db, 'staff', editId), {
          name: form.name.trim(), role: form.role.trim(), department: form.department,
          phone: form.phone.trim(), address: form.address.trim(),
          joinedDate: form.joinedDate, education: form.education.trim(),
          basicSalary: toInt(form.basicSalary), allowances: toInt(form.allowances),
          deductions: toInt(form.deductions), status: form.status,
          updatedAt: serverTimestamp(),
        });
        setNotice({ kind: 'ok', msg: `${form.name} updated.` });
      } else {
        // Provision the Firebase Auth account first (secondary app keeps
        // the admin signed in), then create staff/{uid} — doc id == uid.
        const uid = await createStaffAuthAccount(form.email.trim(), form.password);
        const staffId = await nextNumber('staff', 'STF');
        await setDoc(doc(db, 'staff', uid), {
          staffId, name: form.name.trim(), role: form.role.trim(), department: form.department,
          loginEmail: form.email.trim(), email: form.email.trim(),
          phone: form.phone.trim(), address: form.address.trim(),
          joinedDate: form.joinedDate, education: form.education.trim(),
          basicSalary: toInt(form.basicSalary), allowances: toInt(form.allowances),
          deductions: toInt(form.deductions),
          status: 'active', authUid: uid, docs: [], deleted: false,
          createdAt: serverTimestamp(),
        });
        setNotice({ kind: 'ok', msg: `${form.name} created with login account.` });
      }
      setShowForm(false);
    } catch (e) {
      console.error(e);
      const msg = e.code === 'auth/email-already-in-use'
        ? 'That email already has a login account. Use a different email.'
        : e.code === 'auth/weak-password'
        ? 'Password is too weak (minimum 6 characters).'
        : e.message || 'Save failed.';
      setNotice({ kind: 'error', msg });
    } finally { setBusy(false); }
  };

  // ── delete / soft delete ─────────────────────────────────────────
  const handleDelete = async (s) => {
    setBusy(true); setNotice(null);
    try {
      if (!live) { setStaff(p => p.filter(x => x.id !== s.id)); setConfirmState(null); return; }
      let linked = 0;
      for (const col of ['attendance', 'workAssignments', 'dailyUpdates', 'salaryPayments']) {
        const r = await getDocs(query(collection(db, col), where('staffId', '==', s.id), limit(1)));
        if (!r.empty) linked++;
      }
      if (linked > 0) {
        await updateDoc(doc(db, 'staff', s.id), { deleted: true, status: 'inactive', updatedAt: serverTimestamp() });
        setNotice({ kind: 'ok', msg: `${s.name} has attendance/work/salary records — deactivated (soft delete) instead of removed.` });
      } else {
        try {
          const folder = await listAll(ref(storage, `staff-docs/${s.id}`));
          await Promise.all(folder.items.map(item => deleteObject(item)));
        } catch { /* empty or missing folder is fine */ }
        await deleteDoc(doc(db, 'staff', s.id));
        setNotice({ kind: 'ok', msg: `${s.name} deleted (no linked records).` });
      }
      setDetailId(null);
    } catch (e) { console.error(e); setNotice({ kind: 'error', msg: e.message || 'Delete failed.' }); }
    finally { setBusy(false); setConfirmState(null); }
  };

  const handleResetPassword = async (s) => {
    setBusy(true); setNotice(null);
    try {
      await sendPasswordResetEmail(auth, s.loginEmail || s.email);
      setNotice({ kind: 'ok', msg: `Password reset email sent to ${s.loginEmail || s.email}.` });
    } catch (e) { setNotice({ kind: 'error', msg: e.message }); }
    finally { setBusy(false); setConfirmState(null); }
  };

  // ── secure documents ─────────────────────────────────────────────
  const handleUpload = async (s, file) => {
    if (!file) return;
    setBusy(true); setNotice(null);
    try {
      if (!live) { setNotice({ kind: 'error', msg: 'Document upload needs the live Firebase backend (not available in dev session).' }); return; }
      const safe = file.name.replace(/[^\w.\- ]+/g, '_');
      const path = `staff-docs/${s.id}/${Date.now()}_${safe}`;
      const snap = await uploadBytes(ref(storage, path), file, { contentType: file.type || 'application/octet-stream' });
      await updateDoc(doc(db, 'staff', s.id), {
        docs: arrayUnion({
          id: `${Date.now()}`, category: docCat, name: file.name,
          path: snap.ref.fullPath, size: file.size, uploadedAt: new Date().toISOString(),
        }),
      });
      setNotice({ kind: 'ok', msg: `${file.name} uploaded to ${DOC_CATEGORIES.find(c => c.id === docCat)?.label}.` });
    } catch (e) { console.error(e); setNotice({ kind: 'error', msg: e.message || 'Upload failed.' }); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const handleDownload = async (entry) => {
    try {
      const bytes = await getBytes(ref(storage, entry.path)); // rules-checked read, never a public URL
      const url = URL.createObjectURL(new Blob([bytes]));
      const a = document.createElement('a');
      a.href = url; a.download = entry.name; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setNotice({ kind: 'error', msg: `Download failed — ${e.message}` }); }
  };

  const handleDocDelete = async (s, entry) => {
    setBusy(true);
    try {
      try { await deleteObject(ref(storage, entry.path)); } catch { /* already gone is fine */ }
      await updateDoc(doc(db, 'staff', s.id), { docs: arrayRemove(entry) });
    } catch (e) { setNotice({ kind: 'error', msg: e.message }); }
    finally { setBusy(false); setConfirmState(null); }
  };

  // ── derived ──────────────────────────────────────────────────────
  const stats = {
    total: staff.length,
    active: staff.filter(s => s.status === 'active').length,
    away: staff.filter(s => s.status === 'busy' || s.status === 'on-leave').length,
    inactive: staff.filter(s => s.status === 'inactive').length,
  };

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: C.muted, fontSize: 13 }}>Loading staff…</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {loadError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10,
          background: 'rgba(240,90,103,0.1)', border: '1px solid rgba(240,90,103,0.35)', color: C.red, fontSize: 12 }}>
          <AlertTriangle size={14} /> {loadError}
        </div>
      )}
      {notice && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10,
          background: notice.kind === 'ok' ? 'rgba(24,199,122,0.1)' : 'rgba(240,90,103,0.1)',
          border: `1px solid ${notice.kind === 'ok' ? 'rgba(24,199,122,0.35)' : 'rgba(240,90,103,0.35)'}`,
          color: notice.kind === 'ok' ? C.green : C.red, fontSize: 12 }}>
          {notice.kind === 'ok' ? <ShieldCheck size={14} /> : <AlertTriangle size={14} />} {notice.msg}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160,1fr))', gap: 12 }}>
        {[
          { label: 'Total Staff', val: stats.total, color: C.cyan, icon: '👥' },
          { label: 'Active', val: stats.active, color: C.green, icon: '✅' },
          { label: 'Busy / On Leave', val: stats.away, color: C.amber, icon: '🌤️' },
          { label: 'Inactive', val: stats.inactive, color: C.muted, icon: '🚫' },
        ].map(s => (
          <div key={s.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 18px' }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 11, color: C.muted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Staff table */}
      <ERPPanel>
        <ERPPanelHeader title="Staff Members" icon="👥"
          action={<ERPBtn variant="primary" size="sm" onClick={openCreate}><Plus size={12} /> Add Staff</ERPBtn>} />
        {sorted.length === 0 ? (
          <ERPEmpty icon="👥" title="No staff yet"
            sub="Add your first staff member — a portal login account is created together with the profile."
            action={<ERPBtn variant="primary" onClick={openCreate}><Plus size={12} /> Add Staff</ERPBtn>} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Staff', 'Role / Dept', 'Contact', 'Joined', 'Docs', 'Net Salary', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.8px', color: C.muted, textAlign: 'left', background: 'rgba(10,24,56,0.5)',
                      borderBottom: `1px solid ${C.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((s, i) => (
                  <tr key={s.id} style={{ cursor: 'pointer' }}
                    onClick={() => { setDetailId(s.id); setDocCat('kyc'); }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,102,255,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <ERPAvatar name={s.name} color={AVATAR_COLORS[i % AVATAR_COLORS.length]} size={30} />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{s.name}</div>
                          <div style={{ fontSize: 10, color: C.cyan, fontFamily: 'monospace' }}>{s.staffId || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }}>
                      <div style={{ fontSize: 11, color: C.subtle }}>{s.role || '—'}</div>
                      <div style={{ fontSize: 10, color: C.muted }}>{s.department || ''}</div>
                    </td>
                    <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }}>
                      <div style={{ fontSize: 11, color: C.subtle }}>{s.loginEmail || s.email || '—'}</div>
                      <div style={{ fontSize: 10, color: C.muted }}>{s.phone || ''}</div>
                    </td>
                    <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }}>
                      <span style={{ fontSize: 11, color: C.muted }}>{fmtDate(s.joinedDate) || '—'}</span>
                    </td>
                    <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: (s.docs || []).length ? C.cyan : C.muted }}>
                        {(s.docs || []).length}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: C.text }}>
                        {formatLKR(computeNet(s.basicSalary, s.allowances, s.deductions))}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }}>
                      <ERPBadge status={s.status || 'active'} />
                    </td>
                    <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <ERPBtn size="sm" variant="ghost" onClick={() => { setDetailId(s.id); setDocCat('kyc'); }}><Eye size={12} /></ERPBtn>
                        <ERPBtn size="sm" variant="secondary" onClick={() => openEdit(s)}><Pencil size={12} /></ERPBtn>
                        <ERPBtn size="sm" variant="danger" onClick={() => setConfirmState({ type: 'delete', staff: s })}><Trash2 size={12} /></ERPBtn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ERPPanel>

      {/* ── Add / Edit modal ── */}
      <ERPModal isOpen={showForm} onClose={() => setShowForm(false)}
        title={editId ? 'Edit Staff Member' : 'Add Staff Member'} width={560}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <ERPInput label="Full Name" value={form.name} required onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Kasun Perera" />
            <ERPInput label="Role / Job Title" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} placeholder="e.g. Full Stack Developer" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <ERPSelect label="Department" value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))}
              placeholder="Select..." options={DEPARTMENTS} />
            <ERPSelect label="Status" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} options={STAFF_STATUSES} />
          </div>
          {!editId && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <ERPInput label="Login Email" value={form.email} type="email" required
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="staff@smartpvtltd.com" />
              <ERPInput label="One-Time Login Password" value={form.password} type="password" required={live}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="min 6 characters" />
            </div>
          )}
          {editId && (
            <div style={{ fontSize: 11, color: C.muted, padding: '8px 12px', borderRadius: 8, background: 'rgba(10,24,56,0.6)', border: `1px solid ${C.border}` }}>
              Login: <strong style={{ color: C.subtle }}>{form.email || '—'}</strong> — use “Reset Password” in the staff detail panel to change it.
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <ERPInput label="Phone" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+94 77 000 0000" />
            <ERPInput label="Joined Date" value={form.joinedDate} type="date" onChange={e => setForm(p => ({ ...p, joinedDate: e.target.value }))} />
          </div>
          <ERPInput label="Address" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="Street, City" />
          <ERPInput label="Education" value={form.education} onChange={e => setForm(p => ({ ...p, education: e.target.value }))} placeholder="e.g. BSc Computer Science" />
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.subtle, marginBottom: 6 }}>Salary Structure (LKR / month)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <ERPInput label="Basic" value={form.basicSalary} type="number" onChange={e => setForm(p => ({ ...p, basicSalary: e.target.value }))} placeholder="85000" />
              <ERPInput label="Allowances" value={form.allowances} type="number" onChange={e => setForm(p => ({ ...p, allowances: e.target.value }))} placeholder="5000" />
              <ERPInput label="Deductions" value={form.deductions} type="number" onChange={e => setForm(p => ({ ...p, deductions: e.target.value }))} placeholder="0" />
            </div>
            <div style={{ fontSize: 11, color: C.cyan, marginTop: 6, fontWeight: 700 }}>
              Net: {formatLKR(computeNet(form.basicSalary, form.allowances, form.deductions))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <ERPBtn variant="secondary" onClick={() => setShowForm(false)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</ERPBtn>
            <ERPBtn variant="primary" disabled={busy || !form.name.trim() || !form.email.trim() || (!editId && live && !form.password)}
              onClick={handleSave} style={{ flex: 1, justifyContent: 'center' }}>
              <Plus size={13} /> {editId ? 'Save Changes' : 'Create Staff + Login'}
            </ERPBtn>
          </div>
        </div>
      </ERPModal>

      {/* ── Detail modal (profile + documents + login) ── */}
      <ERPModal isOpen={!!detail} onClose={() => setDetailId(null)} title="Staff Profile" width={700}>
        {detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Identity */}
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <ERPAvatar name={detail.name} color="#0066FF" size={52} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: C.text }}>{detail.name}</div>
                <div style={{ fontSize: 11, color: C.muted }}>
                  <span style={{ fontFamily: 'monospace', color: C.cyan }}>{detail.staffId || detail.id}</span>
                  {' · '}{detail.role || '—'} · {detail.department || '—'}
                </div>
              </div>
              <ERPBadge status={detail.status || 'active'} />
            </div>

            {/* Employment details */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 }}>
              {[
                ['Login Email', detail.loginEmail || detail.email || '—'],
                ['Phone', detail.phone || '—'],
                ['Address', detail.address || '—'],
                ['Joined', fmtDate(detail.joinedDate) || '—'],
                ['Education', detail.education || '—'],
                ['Net Salary', formatLKR(computeNet(detail.basicSalary, detail.allowances, detail.deductions))],
              ].map(([l, v]) => (
                <div key={l} style={{ padding: '9px 12px', borderRadius: 10, background: 'rgba(10,24,56,0.6)', border: `1px solid ${C.border}30` }}>
                  <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.8px', color: C.muted, marginBottom: 3 }}>{l}</div>
                  <div style={{ fontSize: 11, color: C.subtle, fontWeight: 600, wordBreak: 'break-word' }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Documents */}
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px', flexWrap: 'wrap', borderBottom: `1px solid ${C.border}`, background: 'rgba(10,24,56,0.5)' }}>
                {DOC_CATEGORIES.map(c => (
                  <button key={c.id} onClick={() => setDocCat(c.id)} style={{
                    padding: '5px 12px', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                    background: docCat === c.id ? 'rgba(0,102,255,0.25)' : 'transparent',
                    color: docCat === c.id ? '#fff' : C.muted, border: `1px solid ${docCat === c.id ? C.borderHi : C.border}`,
                  }}>{c.label} ({(detail.docs || []).filter(d => d.category === c.id).length})</button>
                ))}
                <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
                  onChange={e => handleUpload(detail, e.target.files?.[0])} />
                <ERPBtn size="sm" variant="primary" disabled={busy} style={{ marginLeft: 'auto' }}
                  onClick={() => fileRef.current?.click()}>
                  <Upload size={11} /> Upload
                </ERPBtn>
              </div>
              {(detail.docs || []).filter(d => d.category === docCat).length === 0 ? (
                <div style={{ padding: '22px 16px', textAlign: 'center', fontSize: 11, color: C.muted }}>
                  No {DOC_CATEGORIES.find(c => c.id === docCat)?.label.toLowerCase()} uploaded yet.
                  {live && ' Images and PDFs up to 10 MB — stored privately, never public URLs.'}
                </div>
              ) : (detail.docs || []).filter(d => d.category === docCat).map(entry => (
                <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderTop: `1px solid ${C.border}20` }}>
                  <FileText size={15} style={{ color: C.cyan, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.subtle, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.name}</div>
                    <div style={{ fontSize: 9, color: C.muted }}>
                      {Math.round((entry.size || 0) / 1024)} KB · uploaded {fmtDate(entry.uploadedAt?.slice(0, 10))}
                    </div>
                  </div>
                  <ERPBtn size="sm" variant="secondary" onClick={() => handleDownload(entry)}><Download size={11} /></ERPBtn>
                  <ERPBtn size="sm" variant="danger" onClick={() => setConfirmState({ type: 'doc', staff: detail, docEntry: entry })}><Trash2 size={11} /></ERPBtn>
                </div>
              ))}
            </div>

            {/* Login & security */}
            <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <ShieldCheck size={14} style={{ color: C.violet }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Portal Login</span>
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>
                Account: <strong style={{ color: C.subtle }}>{detail.loginEmail || detail.email || '—'}</strong>
                {detail.authUid ? ' · linked to Firebase Auth' : ' · not linked'}
              </div>
              <ERPBtn size="sm" variant="secondary" disabled={busy}
                onClick={() => setConfirmState({ type: 'resetpw', staff: detail })}>
                <KeyRound size={11} /> Send Password Reset Email
              </ERPBtn>
            </div>

            {/* Footer actions */}
            <div style={{ display: 'flex', gap: 10 }}>
              <ERPBtn variant="secondary" onClick={() => openEdit(detail)} style={{ flex: 1, justifyContent: 'center' }}>
                <Pencil size={12} /> Edit Profile
              </ERPBtn>
              <ERPBtn variant="danger" onClick={() => setConfirmState({ type: 'delete', staff: detail })} style={{ flex: 1, justifyContent: 'center' }}>
                <Trash2 size={12} /> Delete Staff
              </ERPBtn>
            </div>
          </div>
        )}
      </ERPModal>

      {/* ── Confirm modal (delete / reset pw / doc delete) ── */}
      <ERPModal isOpen={!!confirmState} onClose={() => setConfirmState(null)} title="Please Confirm" width={420}>
        {confirmState?.type === 'delete' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', textAlign: 'center' }}>
            <div style={{ fontSize: 34 }}>🗑️</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Delete {confirmState.staff?.name}?</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>
                If this staff member has attendance, work, daily-update or salary records they will be
                <strong style={{ color: C.amber }}> deactivated instead</strong> (login blocked, history preserved).
                Staff with no records are removed permanently.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, width: '100%' }}>
              <ERPBtn variant="secondary" onClick={() => setConfirmState(null)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</ERPBtn>
              <ERPBtn variant="danger" disabled={busy} onClick={() => handleDelete(confirmState.staff)} style={{ flex: 1, justifyContent: 'center' }}>
                Confirm
              </ERPBtn>
            </div>
          </div>
        )}
        {confirmState?.type === 'resetpw' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', textAlign: 'center' }}>
            <div style={{ fontSize: 34 }}>🔑</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Send password reset?</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>
                An email with a reset link will be sent to <strong style={{ color: C.subtle }}>{confirmState.staff?.loginEmail || confirmState.staff?.email}</strong>.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, width: '100%' }}>
              <ERPBtn variant="secondary" onClick={() => setConfirmState(null)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</ERPBtn>
              <ERPBtn variant="primary" disabled={busy} onClick={() => handleResetPassword(confirmState.staff)} style={{ flex: 1, justifyContent: 'center' }}>
                Send Email
              </ERPBtn>
            </div>
          </div>
        )}
        {confirmState?.type === 'doc' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', textAlign: 'center' }}>
            <div style={{ fontSize: 34 }}>📄</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Delete “{confirmState.docEntry?.name}”?</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>The file is removed from secure storage and the staff profile.</div>
            </div>
            <div style={{ display: 'flex', gap: 10, width: '100%' }}>
              <ERPBtn variant="secondary" onClick={() => setConfirmState(null)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</ERPBtn>
              <ERPBtn variant="danger" disabled={busy} onClick={() => handleDocDelete(confirmState.staff, confirmState.docEntry)} style={{ flex: 1, justifyContent: 'center' }}>
                Delete
              </ERPBtn>
            </div>
          </div>
        )}
      </ERPModal>
    </div>
  );
}
