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
import { ref, uploadBytes, getBytes, deleteObject, listAll, getDownloadURL } from 'firebase/storage';
import { sendPasswordResetEmail } from 'firebase/auth';
import { db, storage, auth, createStaffAuthAccount, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  ERPPanel, ERPPanelHeader, ERPBadge, ERPBtn, ERPModal, ERPInput, ERPSelect,
  ERPEmpty, ERPAvatar, ERPStatCard, ERPProgress, C,
} from '../components/ERPui';
import {
  nextNumber, DOC_CATEGORIES, STAFF_STATUSES, computeNet, compressImage, todayKey, getDayName,
  calculateTaskDuration, toMs, fmtHours, dateKeyOf,
} from '../../staff/staffUtils';
import { toInt, formatLKR, fmtDate, todayISO } from '../money';
import { toMillis } from '../formatWhen';
import { passwordError, PASSWORD_HINT } from '../passwordPolicy';
import {
  Plus, Eye, Pencil, Trash2, KeyRound, Download, Upload, FileText,
  ShieldCheck, AlertTriangle, CheckCircle2, Camera, Clock, Calendar,
  Coffee, Check, Hourglass, Search, ChevronDown, ChevronUp, User,
  Briefcase, DollarSign, Activity, Sparkles, FolderKanban, CheckSquare,
  X, RefreshCw, MapPin
} from 'lucide-react';
import ERPStaffWork        from './ERPStaffWork';
import ERPStaffAttendance  from './ERPStaffAttendance';
import ERPStaffUpdates     from './ERPStaffUpdates';
import ERPStaffSalary      from './ERPStaffSalary';

const DEPARTMENTS = ['Engineering', 'Design', 'Finance', 'Operations', 'Management', 'IT Intern'];
const AVATAR_COLORS = ['#0066FF', '#8B5CF6', '#18C77A', '#F5B942', '#F05A67', '#00D9FF'];

// Status → accent colour, used for the coloured left bar + hover glow on each
// staff row (gives the list a more colourful, slightly 3D feel).
const STATUS_ACCENT = {
  active:    '#18C77A',
  busy:      '#F5B942',
  'on-leave':'#8B5CF6',
  inactive:  '#8B93A7',
};
const accentFor = (status) => STATUS_ACCENT[status] || '#00D9FF';

// Daily-update normalisers (the portal stores `tasks`, older/imported rows
// may only carry `items` + a single status).
const tasksOf = (u) =>
  (u?.tasks?.length
    ? u.tasks
    : (u?.items || []).map((description, i) => ({ no: i + 1, description, status: u.status || 'Completed' })));

const hoursOf = (u) => {
  const n = parseFloat(u?.totalWorkHours);
  return Number.isFinite(n) ? n : 0;
};

const logStatus = (u, tasks) =>
  u?.status || (tasks.length && tasks.every(t => (t.status || 'Completed') === 'Completed') ? 'Completed' : 'Pending');

const dayLabel = (date) => {
  if (!date) return '—';
  const s = typeof date === 'string' ? date : dateKeyOf(date);
  const d = new Date(`${s}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? s
    : d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};

const shortDay = (date) => {
  if (!date) return { d: '—', m: '' };
  const s = typeof date === 'string' ? date : dateKeyOf(date);
  const dt = new Date(`${s}T12:00:00`);
  if (Number.isNaN(dt.getTime())) return { d: s.slice(8, 10) || '—', m: '' };
  return {
    d: String(dt.getDate()).padStart(2, '0'),
    m: dt.toLocaleDateString('en-US', { month: 'short' }),
  };
};

// Audit stamp — the exact date and clock time the staff member submitted this
// daily update (serverTimestamp), so the admin can see WHEN the work was logged,
// not only which day it covers.
const submittedStamp = (u) => {
  const ms = toMillis(u?.submittedAt || u?.createdAt || u?.updatedAt);
  if (!ms) return '';
  const d = new Date(ms);
  return `${d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })} · ` +
    `${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
};

const EMPTY_FORM = {
  name: '', role: '', department: '', email: '', password: '',
  phone: '', address: '', joinedDate: todayISO(), education: '',
  basicSalary: '', allowances: '', deductions: '', status: 'active',
  photoURL: '',
};

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
  const photoInputRef = useRef(null);
  const directPhotoInputRef = useRef(null);
  const [photoFile,    setPhotoFile]    = useState(null);
  const [photoBlob,    setPhotoBlob]    = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [clearPhoto,   setClearPhoto]   = useState(false);

  // Staff Profile Modal tabs & Live Work Progress
  const [activeProfileTab, setActiveProfileTab] = useState('updates'); // 'updates' | 'work' | 'profile' | 'docs'
  const [staffUpdates,      setStaffUpdates]      = useState([]);
  const [updatesLoading,    setUpdatesLoading]    = useState(false);
  const [staffProjects,     setStaffProjects]     = useState([]);
  const [historySearch,     setHistorySearch]     = useState('');
  const [historyDateFilter, setHistoryDateFilter] = useState('');
  const [expandedUpdateId,  setExpandedUpdateId]  = useState(null);

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

  // ── live daily updates for the open staff profile ────────────────
  // The portal writes `staffId` and `authUid` (both = staff doc id), but
  // imported/legacy rows sometimes carry only one of them — so listen to
  // both and merge by document id. onSnapshot means the admin sees a new
  // daily update the moment the staff member submits it, no refresh.
  useEffect(() => {
    if (!detailId || !live) { setStaffUpdates([]); setUpdatesLoading(false); return; }
    setUpdatesLoading(true);
    const maps = [new Map(), new Map()];
    const publish = () => {
      const merged = new Map();
      maps.forEach(m => m.forEach((v, k) => merged.set(k, v)));
      setStaffUpdates([...merged.values()]);
      setUpdatesLoading(false);
    };
    const listen = (field, slot) => onSnapshot(
      query(collection(db, 'dailyUpdates'), where(field, '==', detailId)),
      snap => { maps[slot] = new Map(snap.docs.map(d => [d.id, { id: d.id, ...d.data() }])); publish(); },
      err => { console.error('daily updates live sync failed', err); setUpdatesLoading(false); },
    );
    const unsubA = listen('staffId', 0);
    const unsubB = listen('authUid', 1);
    return () => { unsubA(); unsubB(); };
  }, [detailId, live]);

  // ── live work assignments for the open staff profile ────────────
  useEffect(() => {
    if (!detailId || !live) { setStaffProjects([]); return; }
    const unsub = onSnapshot(
      query(collection(db, 'workAssignments'), where('authUid', '==', detailId)),
      snap => setStaffProjects(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error('work assignments live sync failed', err),
    );
    return unsub;
  }, [detailId, live]);

  // ── create / edit ────────────────────────────────────────────────
  const resetPhotoDraft = (url = '') => {
    setPhotoBlob(null);
    setPhotoPreview(url || '');
    setClearPhoto(false);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const openCreate = () => {
    setEditId(null); setForm(EMPTY_FORM); setNotice(null);
    resetPhotoDraft('');
    setShowForm(true);
  };
  const openEdit = (s) => {
    setEditId(s.id); setNotice(null);
    setForm({
      name: s.name || '', role: s.role || '', department: s.department || '',
      email: s.loginEmail || s.email || '', password: '',
      phone: s.phone || '', address: s.address || '', joinedDate: s.joinedDate || '',
      education: s.education || '', basicSalary: s.basicSalary || '', allowances: s.allowances || '',
      deductions: s.deductions || '', status: s.status || 'active',
      photoURL: s.photoURL || '',
    });
    resetPhotoDraft(s.photoURL || '');
    setShowForm(true);
  };

  // Pick a photo in the Add/Edit form — compressed locally so a phone
  // photo becomes a ~40 KB square JPEG before it ever reaches Storage.
  const onFormPhotoPick = async (e) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!file) return;
    setNotice(null);
    if (!file.type.startsWith('image/')) { setNotice({ kind: 'error', msg: 'Please choose a JPG or PNG image.' }); return; }
    if (file.size > 5 * 1024 * 1024) { setNotice({ kind: 'error', msg: 'Photo is larger than 5 MB — please choose a smaller image.' }); return; }
    try {
      const { dataUrl, blob } = await compressImage(file, 480, 0.86);
      setPhotoBlob(blob);
      setPhotoPreview(dataUrl);
      setClearPhoto(false);
    } catch (err) {
      console.error(err);
      setNotice({ kind: 'error', msg: 'Could not read that image — try another file.' });
    }
  };

  // Upload/replace the avatar for an existing staff doc and stamp the URL
  // on the profile (public read via storage.rules → staff-photos).
  const uploadStaffPhoto = async (staffId, blob, oldPath) => {
    const snap = await uploadBytes(
      ref(storage, `staff-photos/${staffId}/avatar_${Date.now()}.jpg`),
      blob,
      { contentType: 'image/jpeg' },
    );
    const url = await getDownloadURL(snap.ref);
    await updateDoc(doc(db, 'staff', staffId), {
      photoURL: url,
      photoPath: snap.ref.fullPath,
      updatedAt: serverTimestamp(),
    });
    if (oldPath && oldPath !== snap.ref.fullPath) {
      try { await deleteObject(ref(storage, oldPath)); } catch { /* old avatar already gone */ }
    }
    return url;
  };

  // Storage/Firestore rule rejections surface as opaque SDK codes — translate
  // them into what the admin actually has to fix (signed-in account's email
  // must be in storage.rules isAdmin(), or an admins/{uid} doc must exist).
  const permErr = (err, fallback) => {
    const code = String(err?.code || '');
    if (code === 'storage/unauthorized' || code === 'permission-denied' || err?.status === 403) {
      return 'Permission denied by Firebase security rules. Sign in with an admin account whose email is listed in storage.rules → isAdmin() (or create its admins/{uid} document), then redeploy: npx firebase deploy --only firestore:rules,storage';
    }
    return err?.message || fallback;
  };

  const onDetailPhotoPick = async (e) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!file || !detail) return;
    setNotice(null);
    if (!file.type.startsWith('image/')) { setNotice({ kind: 'error', msg: 'Please choose a JPG or PNG image.' }); return; }
    if (file.size > 5 * 1024 * 1024) { setNotice({ kind: 'error', msg: 'Photo is larger than 5 MB — please choose a smaller image.' }); return; }
    if (!live) { setNotice({ kind: 'error', msg: 'Photo upload needs the live Firebase backend (not available in dev session).' }); return; }
    setBusy(true);
    try {
      const { blob } = await compressImage(file, 480, 0.86);
      await uploadStaffPhoto(detail.id, blob, detail.photoPath);
      setNotice({ kind: 'ok', msg: `Profile photo updated for ${detail.name}.` });
    } catch (err) {
      console.error(err);
      setNotice({ kind: 'error', msg: permErr(err, 'Photo upload failed.') });
    } finally { setBusy(false); }
  };

  const removeStaffPhoto = async () => {
    if (!detail) return;
    setBusy(true); setNotice(null);
    try {
      if (live) {
        await updateDoc(doc(db, 'staff', detail.id), { photoURL: '', photoPath: '', updatedAt: serverTimestamp() });
        if (detail.photoPath) {
          try { await deleteObject(ref(storage, detail.photoPath)); } catch { /* already gone */ }
        }
      }
      setNotice({ kind: 'ok', msg: `Profile photo removed for ${detail.name}.` });
    } catch (err) {
      console.error(err);
      setNotice({ kind: 'error', msg: permErr(err, 'Could not remove the photo.') });
    } finally { setBusy(false); }
  };

  const openDetail = (s) => {
    setDetailId(s.id);
    setDocCat('kyc');
    setActiveProfileTab('updates');
    setHistorySearch('');
    setHistoryDateFilter('');
    setExpandedUpdateId(null);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) return;
    if (!editId && live && !form.password) return;
    // New staff accounts must pass the shared password policy.
    if (!editId && live && form.password) {
      const pwErr = passwordError(form.password, form.email.trim());
      if (pwErr) { setNotice({ kind: 'error', msg: pwErr }); return; }
    }
    setBusy(true); setNotice(null);
    try {
      if (!live) {
        // Dev session — local mock only, nothing touches the DB.
        const photoURL = photoPreview || '';
        if (editId) setStaff(p => p.map(s => s.id === editId ? { ...s, ...form, photoURL, basicSalary: toInt(form.basicSalary), allowances: toInt(form.allowances), deductions: toInt(form.deductions) } : s));
        else setStaff(p => [...p, { id: `dev-${Date.now()}`, staffId: `STF-DEV-${String(p.length + 1).padStart(4, '0')}`, authUid: `dev-${Date.now()}`, docs: [], ...form, photoURL, basicSalary: toInt(form.basicSalary), allowances: toInt(form.allowances), deductions: toInt(form.deductions) }]);
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
        // Photo handling: new file → upload, removed → clear + delete old.
        const old = staff.find(s => s.id === editId);
        if (photoBlob) {
          await uploadStaffPhoto(editId, photoBlob, old?.photoPath);
        } else if (clearPhoto && old?.photoURL) {
          await updateDoc(doc(db, 'staff', editId), { photoURL: '', photoPath: '', updatedAt: serverTimestamp() });
          if (old?.photoPath) { try { await deleteObject(ref(storage, old.photoPath)); } catch { /* already gone */ } }
        }
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
          photoURL: '', photoPath: '',
          createdAt: serverTimestamp(),
        });
        if (photoBlob) await uploadStaffPhoto(uid, photoBlob);
        setNotice({ kind: 'ok', msg: `${form.name} created with login account${photoBlob ? ' and profile photo' : ''}.` });
      }
      resetPhotoDraft('');
      setShowForm(false);
    } catch (e) {
      console.error(e);
      const msg = e.code === 'auth/email-already-in-use'
        ? 'That email already has a login account. Use a different email.'
        : e.code === 'auth/weak-password'
        ? `Password is too weak. ${PASSWORD_HINT}`
        : permErr(e, 'Save failed.');
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
          status: 'Pending',
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

  // Admin review of a staff-uploaded KYC / certificate: mark it Verified.
  // (The staff portal shows the same status live via AuthContext.)
  const handleDocVerify = async (s, entry) => {
    setBusy(true); setNotice(null);
    try {
      const docs = (s.docs || []).map(d =>
        d.id === entry.id
          ? { ...d, status: 'Verified', verifiedAt: new Date().toISOString() }
          : d
      );
      await updateDoc(doc(db, 'staff', s.id), { docs, updatedAt: serverTimestamp() });
      setNotice({ kind: 'ok', msg: `${entry.name} verified — the staff member can see it now.` });
    } catch (e) {
      setNotice({ kind: 'error', msg: e.message || 'Could not verify the document.' });
    } finally { setBusy(false); }
  };

  // ── derived ──────────────────────────────────────────────────────
  const stats = {
    total: staff.length,
    active: staff.filter(s => s.status === 'active').length,
    away: staff.filter(s => s.status === 'busy' || s.status === 'on-leave').length,
    inactive: staff.filter(s => s.status === 'inactive').length,
  };

  // ── derived daily-log + assignment data for the open profile ─────
  const updatesSorted = [...staffUpdates].sort((a, b) =>
    String(b.date || '').localeCompare(String(a.date || '')) ||
    toMs(b.submittedAt || b.createdAt || b.updatedAt) - toMs(a.submittedAt || a.createdAt || a.updatedAt));
  const todayLog = updatesSorted.find(u => (u.date || dateKeyOf(u.submittedAt || u.createdAt)) === todayKey()) || null;
  const monthKey = todayKey().slice(0, 7);
  const monthLogs = updatesSorted.filter(u => String(u.date || '').slice(0, 7) === monthKey);
  const monthHours = monthLogs.reduce((sum, u) => sum + hoursOf(u), 0);
  const monthTasks = monthLogs.reduce((sum, u) => sum + tasksOf(u).length, 0);
  const monthDone = monthLogs.reduce((sum, u) => sum + tasksOf(u).filter(t => (t.status || 'Completed') === 'Completed').length, 0);
  const todayTasks = tasksOf(todayLog);
  const todayDone = todayTasks.filter(t => (t.status || 'Completed') === 'Completed').length;
  const searchQ = historySearch.trim().toLowerCase();
  const history = updatesSorted.filter(u => {
    if (historyDateFilter && (u.date || dateKeyOf(u.submittedAt || u.createdAt)) !== historyDateFilter) return false;
    if (!searchQ) return true;
    const hay = [u.date, u.day, u.remarks, u.planTomorrow, u.workMode, u.position,
      ...tasksOf(u).map(t => `${t.description || ''} ${t.status || ''}`)].join(' ').toLowerCase();
    return hay.includes(searchQ);
  });
  const workOpen = staffProjects.filter(p => p.status !== 'Completed');
  const workDone = staffProjects.filter(p => p.status === 'Completed');

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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        <ERPStatCard icon="👥" value={stats.total}  label="Total Staff"     color="#00D9FF" />
        <ERPStatCard icon="✅" value={stats.active} label="Active"         color="#18C77A" />
        <ERPStatCard icon="🌤️" value={stats.away}   label="Busy / On Leave" color="#F5B942" />
        <ERPStatCard icon="🚫" value={stats.inactive} label="Inactive"     color="#8B93A7" />
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
                    <th key={h} style={{ padding: '11px 14px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                      letterSpacing: '0.8px', color: '#BFE9FF', textAlign: 'left',
                      background: 'linear-gradient(135deg, rgba(0,102,255,0.28), rgba(139,92,246,0.22))',
                      borderBottom: '1px solid rgba(0,217,255,0.35)',
                      boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.06)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((s, i) => (
                  <tr key={s.id} style={{ cursor: 'pointer', transition: 'transform .12s ease, box-shadow .12s ease, background .12s ease',
                    borderLeft: `4px solid ${accentFor(s.status)}` }}
                    onClick={() => openDetail(s)}
                    onMouseEnter={e => {
                      const a = accentFor(s.status);
                      e.currentTarget.style.background = `linear-gradient(90deg, ${a}22, ${a}0d 40%, transparent)`;
                      e.currentTarget.style.boxShadow = `0 6px 18px -8px ${a}88, inset 4px 0 0 ${a}`;
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}>
                    <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ borderRadius: '50%', boxShadow: `0 0 0 2px ${accentFor(s.status)}55, 0 3px 8px -2px ${accentFor(s.status)}aa`, padding: 1 }}>
                          <ERPAvatar name={s.name} color={AVATAR_COLORS[i % AVATAR_COLORS.length]} size={30} src={s.photoURL || null} />
                        </div>
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
                        <ERPBtn size="sm" variant="ghost" onClick={() => openDetail(s)}><Eye size={12} /></ERPBtn>
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
          {/* Profile photo */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 14,
            background: 'linear-gradient(135deg, rgba(0,102,255,0.12), rgba(139,92,246,0.1))',
            border: '1px solid rgba(0,102,255,0.3)',
          }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <ERPAvatar name={form.name || '?'} color="#0066FF" size={62} src={photoPreview || null} />
              <button type="button" onClick={() => photoInputRef.current?.click()} title="Upload photo" style={{
                position: 'absolute', bottom: -4, right: -4, width: 23, height: 23, borderRadius: '50%',
                border: '2px solid #0A1838', background: 'linear-gradient(135deg,#0066FF,#8B5CF6)',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', padding: 0, boxShadow: '0 3px 8px rgba(0,0,0,0.4)',
              }}>
                <Camera size={11} />
              </button>
              <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFormPhotoPick} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: C.text }}>Profile Photo</div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 2, lineHeight: 1.5 }}>
                Professional headshot, face centred. JPG/PNG up to 5 MB — compressed automatically for the staff portal.
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <ERPBtn size="sm" variant="secondary" onClick={() => photoInputRef.current?.click()}>
                  <Upload size={11} /> {photoPreview ? 'Change photo' : 'Upload photo'}
                </ERPBtn>
                {photoPreview && (
                  <ERPBtn size="sm" variant="ghost" onClick={() => { setPhotoBlob(null); setPhotoPreview(''); setClearPhoto(true); }}>
                    <X size={11} /> Remove
                  </ERPBtn>
                )}
              </div>
            </div>
          </div>
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
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder="Min 8, caps + small + number + symbol" />
            </div>
          )}
          {!editId && (
            <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
              <ShieldCheck size={11} style={{ display:'inline', verticalAlign:'-1px', marginRight:4 }}/>
              Password policy: {PASSWORD_HINT} The staff member can change it after signing in.
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

      {/* ── Detail modal — live profile, daily progress, work, docs ── */}
      <ERPModal isOpen={!!detail} onClose={() => setDetailId(null)} title="Staff Profile" width={760}>
        {detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Identity */}
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <ERPAvatar name={detail.name} color="#0066FF" size={64} src={detail.photoURL || null} />
                <button type="button" onClick={() => directPhotoInputRef.current?.click()} disabled={busy} title="Upload / change photo" style={{
                  position: 'absolute', bottom: -4, right: -4, width: 24, height: 24, borderRadius: '50%',
                  border: '2px solid #0A1838', background: 'linear-gradient(135deg,#0066FF,#8B5CF6)',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: busy ? 'wait' : 'pointer', padding: 0, boxShadow: '0 3px 10px rgba(0,0,0,0.45)',
                }}>
                  <Camera size={11} />
                </button>
                <input ref={directPhotoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onDetailPhotoPick} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 900, color: C.text }}>{detail.name}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  <span style={{ fontFamily: 'monospace', color: C.cyan }}>{detail.staffId || detail.id}</span>
                  {' · '}{detail.role || '—'} · {detail.department || '—'}
                </div>
              </div>
              {detail.photoURL && (
                <ERPBtn size="sm" variant="ghost" disabled={busy} onClick={removeStaffPhoto} title="Remove photo">
                  <X size={12} /> Photo
                </ERPBtn>
              )}
              <ERPBadge status={detail.status || 'active'} />
            </div>

            {/* Tabs */}
            <div style={{
              display: 'flex', gap: 6, flexWrap: 'wrap', padding: 4, borderRadius: 12,
              background: 'rgba(10,24,56,0.65)', border: `1px solid ${C.border}`,
            }}>
              {[
                { id: 'updates', label: 'Daily Progress', icon: <Activity size={12} /> },
                { id: 'work',    label: `Work${workOpen.length ? ` (${workOpen.length})` : ''}`, icon: <Briefcase size={12} /> },
                { id: 'profile', label: 'Profile', icon: <User size={12} /> },
                { id: 'docs',    label: `Documents (${(detail.docs || []).length})`, icon: <FileText size={12} /> },
              ].map(t => (
                <button key={t.id} type="button" onClick={() => setActiveProfileTab(t.id)} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9,
                  fontSize: 11, fontWeight: 800, cursor: 'pointer', transition: 'all 0.15s',
                  background: activeProfileTab === t.id ? 'linear-gradient(135deg,#0066FF,#1787FF)' : 'transparent',
                  color: activeProfileTab === t.id ? '#fff' : C.muted,
                  border: activeProfileTab === t.id ? 'none' : `1px solid transparent`,
                  boxShadow: activeProfileTab === t.id ? '0 4px 14px rgba(0,102,255,0.35)' : 'none',
                }}>{t.icon} {t.label}</button>
              ))}
            </div>

            {/* ── Daily progress tab ── */}
            {activeProfileTab === 'updates' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 900,
                    letterSpacing: 0.8, textTransform: 'uppercase', color: live ? C.green : C.muted,
                  }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: 99, background: live ? C.green : C.muted,
                      boxShadow: live ? '0 0 0 4px rgba(24,199,122,0.16)' : 'none',
                    }} />
                    {live ? 'Live' : 'Preview'}
                  </span>
                  <span style={{ fontSize: 10.5, color: C.muted }}>
                    {live
                      ? 'Daily updates appear here the moment this staff member submits — no refresh needed.'
                      : 'Connect the live Firebase backend to see daily updates.'}
                  </span>
                  {updatesLoading && <span style={{ fontSize: 10, color: C.cyan }}>syncing…</span>}
                </div>

                {/* This month at a glance */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(112px, 1fr))', gap: 8 }}>
                  {[
                    { label: 'Updates',    value: monthLogs.length,          color: '#00D9FF', icon: <Calendar size={12} /> },
                    { label: 'Hours',      value: `${monthHours.toFixed(1)}h`, color: '#F5B942', icon: <Clock size={12} /> },
                    { label: 'Tasks done', value: `${monthDone}/${monthTasks}`, color: '#18C77A', icon: <CheckSquare size={12} /> },
                  ].map(s => (
                    <div key={s.label} style={{
                      padding: '9px 11px', borderRadius: 11, background: 'rgba(10,24,56,0.6)',
                      border: `1px solid ${s.color}44`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.7, color: C.muted }}>
                        <span style={{ color: s.color }}>{s.icon}</span> {s.label}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 900, color: C.text, marginTop: 3 }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Today's card */}
                {todayLog ? (
                  <div style={{
                    padding: 14, borderRadius: 14,
                    background: 'linear-gradient(135deg, rgba(0,102,255,0.16), rgba(139,92,246,0.12))',
                    border: '1px solid rgba(0,217,255,0.35)',
                    boxShadow: '0 10px 28px -16px rgba(0,217,255,0.8)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 9.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.9, color: C.cyan }}>
                          Today · {dayLabel(todayLog.date || todayKey())}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginTop: 3 }}>
                          {todayLog.workMode || 'On-Site / Office'}
                          {todayLog.position ? ` · ${todayLog.position}` : ''}
                        </div>
                        {submittedStamp(todayLog) && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9.5, color: C.muted, marginTop: 4 }}>
                            <Clock size={9} color={C.cyan} />
                            Submitted {submittedStamp(todayLog)}
                          </div>
                        )}
                      </div>
                      <ERPBadge status={logStatus(todayLog, todayTasks)} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: 8, marginTop: 12 }}>
                      {[
                        { icon: <Coffee size={11} />, label: 'Check-in',  value: todayLog.arrival || '—' },
                        { icon: <Hourglass size={11} />, label: 'Lunch', value: todayLog.lunchStart && todayLog.lunchEnd ? `${todayLog.lunchStart}–${todayLog.lunchEnd}` : (todayLog.lunchDuration || '—') },
                        { icon: <Clock size={11} />, label: 'Check-out', value: todayLog.departure || '—' },
                        { icon: <Activity size={11} />, label: 'Net hours', value: todayLog.totalWorkHours || '—' },
                      ].map(m => (
                        <div key={m.label} style={{ padding: '7px 9px', borderRadius: 9, background: 'rgba(4,13,31,0.55)', border: `1px solid ${C.border}30` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8.5, textTransform: 'uppercase', letterSpacing: 0.6, color: C.muted }}>
                            <span style={{ color: C.cyan }}>{m.icon}</span> {m.label}
                          </div>
                          <div style={{ fontSize: 11.5, fontWeight: 800, color: C.text, marginTop: 2 }}>{m.value}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, fontWeight: 800, color: C.muted, marginBottom: 5 }}>
                        <span>Tasks completed</span>
                        <span style={{ color: C.green }}>{todayDone}/{todayTasks.length}</span>
                      </div>
                      <ERPProgress value={todayTasks.length ? (todayDone / todayTasks.length) * 100 : 0} color={C.green} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                      {todayTasks.map((t, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 10.5, color: C.subtle }}>
                          <span style={{ fontFamily: 'monospace', color: C.cyan, flexShrink: 0 }}>{t.start || '—'}–{t.end || '—'}</span>
                          <span style={{ color: C.muted, flexShrink: 0 }}>{t.hours || calculateTaskDuration(t.start, t.end)}</span>
                          <span style={{ flex: 1, minWidth: 0 }}>{t.description || '—'}</span>
                          <span style={{
                            flexShrink: 0, padding: '1px 6px', borderRadius: 999, fontSize: 8.5, fontWeight: 800,
                            background: (t.status || 'Completed') === 'Completed' ? 'rgba(24,199,122,0.14)' : 'rgba(245,185,66,0.14)',
                            color: (t.status || 'Completed') === 'Completed' ? C.green : C.amber,
                            border: `1px solid ${(t.status || 'Completed') === 'Completed' ? 'rgba(24,199,122,0.4)' : 'rgba(245,185,66,0.4)'}`,
                          }}>{t.status || 'Completed'}</span>
                        </div>
                      ))}
                    </div>

                    {(todayLog.remarks || todayLog.planTomorrow) && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                        {todayLog.remarks && (
                          <div style={{ padding: '8px 10px', borderRadius: 9, background: 'rgba(4,13,31,0.55)', border: `1px solid ${C.border}30` }}>
                            <div style={{ fontSize: 8.5, textTransform: 'uppercase', letterSpacing: 0.7, color: C.muted, fontWeight: 800 }}>Remarks</div>
                            <div style={{ fontSize: 10.5, color: C.subtle, marginTop: 2, lineHeight: 1.55 }}>{todayLog.remarks}</div>
                          </div>
                        )}
                        {todayLog.planTomorrow && (
                          <div style={{ padding: '8px 10px', borderRadius: 9, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.28)' }}>
                            <div style={{ fontSize: 8.5, textTransform: 'uppercase', letterSpacing: 0.7, color: C.violet, fontWeight: 800 }}>Plan for tomorrow</div>
                            <div style={{ fontSize: 10.5, color: C.subtle, marginTop: 2, lineHeight: 1.55 }}>{todayLog.planTomorrow}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{
                    padding: '18px 16px', borderRadius: 14, textAlign: 'center',
                    background: 'rgba(10,24,56,0.4)', border: `1px dashed ${C.border}`,
                  }}>
                    <div style={{ fontSize: 24, marginBottom: 6 }}>📝</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: C.text }}>No daily update today yet</div>
                    <div style={{ fontSize: 10.5, color: C.muted, marginTop: 3 }}>
                      When {String(detail.name || 'the staff member').split(' ')[0]} submits the Daily Work Update in the staff portal,
                      it appears here automatically.
                    </div>
                  </div>
                )}

                {/* History */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 800, color: C.text }}>
                    <Calendar size={12} color={C.cyan} /> Daily History
                    <span style={{
                      fontSize: 9.5, fontWeight: 800, padding: '1px 7px', borderRadius: 999,
                      background: 'rgba(0,217,255,0.12)', color: C.cyan, border: '1px solid rgba(0,217,255,0.3)',
                    }}>{updatesSorted.length}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative' }}>
                      <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: C.muted }} />
                      <input
                        value={historySearch}
                        onChange={e => setHistorySearch(e.target.value)}
                        placeholder="Search work / remarks…"
                        style={{
                          width: 170, padding: '7px 10px 7px 27px', borderRadius: 9, fontSize: 10.5,
                          background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`, color: C.text, outline: 'none',
                        }}
                      />
                    </div>
                    <input
                      type="date"
                      value={historyDateFilter}
                      onChange={e => setHistoryDateFilter(e.target.value)}
                      style={{
                        padding: '6px 9px', borderRadius: 9, fontSize: 10.5,
                        background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`, color: C.text, outline: 'none',
                      }}
                    />
                    {(historySearch || historyDateFilter) && (
                      <button type="button" onClick={() => { setHistorySearch(''); setHistoryDateFilter(''); }} style={{
                        padding: '6px 10px', borderRadius: 9, fontSize: 10.5, fontWeight: 700, cursor: 'pointer',
                        background: 'transparent', border: `1px solid ${C.border}`, color: C.muted,
                      }}>Clear</button>
                    )}
                  </div>
                </div>

                {history.length === 0 ? (
                  <div style={{ padding: '22px 16px', textAlign: 'center', fontSize: 11, color: C.muted, border: `1px dashed ${C.border}`, borderRadius: 12 }}>
                    {updatesSorted.length === 0
                      ? 'No daily updates yet. Submitted work logs will build this history.'
                      : 'No updates match the search / date filter.'}
                  </div>
                ) : history.map(u => {
                  const tasks = tasksOf(u);
                  const done = tasks.filter(t => (t.status || 'Completed') === 'Completed').length;
                  const open = expandedUpdateId === u.id;
                  const sd = shortDay(u.date || dateKeyOf(u.submittedAt || u.createdAt));
                  return (
                    <div key={u.id} style={{
                      borderRadius: 12, overflow: 'hidden',
                      border: `1px solid ${open ? 'rgba(0,217,255,0.45)' : C.border}`,
                      background: open ? 'rgba(0,102,255,0.06)' : 'rgba(10,24,56,0.45)',
                      transition: 'border-color .15s, background .15s',
                    }}>
                      <button type="button" onClick={() => setExpandedUpdateId(open ? null : u.id)} style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                        background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'inherit',
                      }}>
                        <div style={{
                          width: 42, flexShrink: 0, textAlign: 'center', padding: '4px 0', borderRadius: 9,
                          background: 'rgba(0,102,255,0.16)', border: '1px solid rgba(0,102,255,0.35)',
                        }}>
                          <div style={{ fontSize: 14, fontWeight: 900, color: C.text, lineHeight: 1.1 }}>{sd.d}</div>
                          <div style={{ fontSize: 8, fontWeight: 800, textTransform: 'uppercase', color: C.cyan, letterSpacing: 0.5 }}>{sd.m}</div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11.5, fontWeight: 800, color: C.text }}>
                            {dayLabel(u.date || dateKeyOf(u.submittedAt || u.createdAt))}
                          </div>
                          <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>
                            {tasks.length} task{tasks.length === 1 ? '' : 's'} · {done} done · {u.totalWorkHours || '—'} · {u.workMode || 'Office'}
                          </div>
                          {submittedStamp(u) && (
                            <div style={{ fontSize: 9, color: C.subtle, marginTop: 2, opacity: 0.85 }}>
                              Logged {submittedStamp(u)}
                            </div>
                          )}
                        </div>
                        <ERPBadge status={logStatus(u, tasks)} />
                        {open ? <ChevronUp size={14} color={C.muted} /> : <ChevronDown size={14} color={C.muted} />}
                      </button>

                      {open && (
                        <div style={{ padding: '4px 12px 12px', borderTop: `1px solid ${C.border}30` }}>
                          {tasks.length === 0 ? (
                            <div style={{ padding: '10px 0', fontSize: 10.5, color: C.muted }}>No task details on this entry.</div>
                          ) : tasks.map((t, idx) => (
                            <div key={idx} style={{
                              display: 'grid', gridTemplateColumns: '44px 44px 58px minmax(0,1fr) 66px',
                              gap: 6, alignItems: 'center', padding: '6px 0',
                              borderTop: idx === 0 ? 'none' : `1px solid ${C.border}20`,
                            }}>
                              <span style={{ fontFamily: 'monospace', fontSize: 9.5, color: C.cyan }}>{t.start || '—'}</span>
                              <span style={{ fontFamily: 'monospace', fontSize: 9.5, color: C.cyan }}>{t.end || '—'}</span>
                              <span style={{ fontSize: 9, color: C.muted }}>{t.hours || calculateTaskDuration(t.start, t.end)}</span>
                              <span style={{ fontSize: 10.5, color: C.subtle }}>{t.description || '—'}</span>
                              <span style={{
                                textAlign: 'center', padding: '1px 5px', borderRadius: 999, fontSize: 8.5, fontWeight: 800,
                                background: (t.status || 'Completed') === 'Completed' ? 'rgba(24,199,122,0.14)' : 'rgba(245,185,66,0.14)',
                                color: (t.status || 'Completed') === 'Completed' ? C.green : C.amber,
                                border: `1px solid ${(t.status || 'Completed') === 'Completed' ? 'rgba(24,199,122,0.4)' : 'rgba(245,185,66,0.4)'}`,
                              }}>{t.status || 'Completed'}</span>
                            </div>
                          ))}
                          {u.remarks && (
                            <div style={{ marginTop: 9, padding: '7px 9px', borderRadius: 8, background: 'rgba(4,13,31,0.5)', border: `1px solid ${C.border}30` }}>
                              <span style={{ fontSize: 8.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.7, color: C.muted }}>Remarks: </span>
                              <span style={{ fontSize: 10.5, color: C.subtle, lineHeight: 1.5 }}>{u.remarks}</span>
                            </div>
                          )}
                          {u.planTomorrow && (
                            <div style={{ marginTop: 6, padding: '7px 9px', borderRadius: 8, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.28)' }}>
                              <span style={{ fontSize: 8.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.7, color: C.violet }}>Next day: </span>
                              <span style={{ fontSize: 10.5, color: C.subtle, lineHeight: 1.5 }}>{u.planTomorrow}</span>
                            </div>
                          )}
                          {submittedStamp(u) && (
                            <div style={{
                              marginTop: 9, paddingTop: 7, borderTop: `1px dashed ${C.border}55`,
                              display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 9, color: C.muted,
                            }}>
                              <span>📅 Work date: <strong style={{ color: C.subtle }}>{u.date || dateKeyOf(u.submittedAt || u.createdAt) || '—'}</strong></span>
                              <span>🕒 Submitted: <strong style={{ color: C.subtle }}>{submittedStamp(u)}</strong></span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Work tab ── */}
            {activeProfileTab === 'work' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 10.5, color: C.muted }}>
                  Live from Work assignments — progress updates from the staff portal show here instantly.
                  {' '}<strong style={{ color: C.subtle }}>{workOpen.length} open</strong> · {workDone.length} completed.
                </div>
                {staffProjects.length === 0 ? (
                  <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 11, color: C.muted, border: `1px dashed ${C.border}`, borderRadius: 12 }}>
                    No work assigned to {detail.name} yet. Assign work from Staff → Work.
                  </div>
                ) : [...workOpen, ...workDone].map(p => {
                  const pct = Math.max(0, Math.min(100, Number(p.progress) || 0));
                  return (
                    <div key={p.id} style={{
                      padding: 12, borderRadius: 12, background: 'rgba(10,24,56,0.5)',
                      border: `1px solid ${p.status === 'Completed' ? 'rgba(24,199,122,0.35)' : C.border}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: C.text }}>
                            {p.title || p.projectTitle || 'Work item'}
                          </div>
                          <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                            {p.projectTitle || p.serviceType || '—'}
                            {(p.clientCompany || p.clientName) ? ` · ${p.clientCompany || p.clientName}` : ''}
                          </div>
                        </div>
                        <ERPBadge status={p.status || 'Assigned'} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <ERPProgress value={pct} color={p.status === 'Completed' ? C.green : C.blue} />
                        </div>
                        <span style={{ fontSize: 10.5, fontWeight: 900, color: pct >= 100 ? C.green : C.blue, width: 38, textAlign: 'right' }}>{pct}%</span>
                      </div>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, fontSize: 9.5, color: C.muted }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Calendar size={10} /> Due {fmtDate(p.deadline) || '—'}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Activity size={10} /> {p.priority || 'Medium'} priority</span>
                        {p.serviceType && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><FolderKanban size={10} /> {p.serviceType}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Profile tab ── */}
            {activeProfileTab === 'profile' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
              </div>
            )}

            {/* ── Documents tab ── */}
            {activeProfileTab === 'docs' && (
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px', flexWrap: 'wrap', borderBottom: `1px solid ${C.border}`, background: 'rgba(10,24,56,0.5)' }}>
                  {DOC_CATEGORIES.map(c => (
                    <button key={c.id} type="button" onClick={() => setDocCat(c.id)} style={{
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
                      <div style={{ fontSize: 9, color: C.muted, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span>{Math.round((entry.size || 0) / 1024)} KB · uploaded {fmtDate(entry.uploadedAt?.slice(0, 10))}</span>
                        <span style={{
                          padding: '1px 6px', borderRadius: 999, fontWeight: 800,
                          background: entry.status === 'Verified' ? 'rgba(24,199,122,0.14)' : 'rgba(245,185,66,0.14)',
                          color: entry.status === 'Verified' ? C.green : C.amber,
                          border: `1px solid ${entry.status === 'Verified' ? 'rgba(24,199,122,0.4)' : 'rgba(245,185,66,0.4)'}`,
                        }}>
                          {entry.status === 'Verified' ? 'Verified' : 'Pending'}
                        </span>
                      </div>
                    </div>
                    {entry.status !== 'Verified' && (
                      <ERPBtn size="sm" variant="success" disabled={busy} onClick={() => handleDocVerify(detail, entry)}>
                        <CheckCircle2 size={11} /> Accept
                      </ERPBtn>
                    )}
                    <ERPBtn size="sm" variant="secondary" onClick={() => handleDownload(entry)}><Download size={11} /></ERPBtn>
                    <ERPBtn size="sm" variant="danger" onClick={() => setConfirmState({ type: 'doc', staff: detail, docEntry: entry })}><Trash2 size={11} /></ERPBtn>
                  </div>
                ))}
              </div>
            )}

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
