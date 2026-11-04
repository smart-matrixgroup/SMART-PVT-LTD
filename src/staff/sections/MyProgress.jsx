// ─────────────────────────────────────────────────────────────────
//  Staff portal → Work Progress (the staff member's own stage list)
//
//  When a project is assigned to them, the staff writes the list of work
//  they are going to do on that project — one row per stage. Each stage
//  moves Not Started → In Progress → Completed, and a finished stage
//  carries the note of what was done plus photo / PDF proof. The admin
//  approves (or sends back) a completed stage in Staff → profile →
//  Work Progress, and only an approved stage reaches the client portal.
//
//  Firestore: staffProgress/{itemId} — one doc per stage, staffUid == auth uid.
//  The project snapshot fields (projectId / projectTitle / clientId /
//  clientName) are copied from that staff member's own workAssignments row.
//  Storage: staff-progress/{uid}/{itemId}/{file} — private paths only,
//  opened through PrivateFileLink (getBytes, rules on every view).
// ─────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  collection, onSnapshot, query, where, doc, setDoc, updateDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, deleteObject } from 'firebase/storage';
import { db, storage, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  ERPPanel, ERPPanelHeader, ERPBtn, ERPModal, ERPInput, ERPTextarea, ERPSelect, ERPProgress, C,
} from '../../erp/components/ERPui';
import PrivateFileLink from '../../erp/components/PrivateFileLink';
import { staffRulesNotice } from '../../erp/rulesNotice';
import StaffEmpty from '../components/StaffEmpty';
import {
  compressImage, todayKey, toMs, STAGE_STATUSES, stageStatusOf, stageReviewOf, stageStats,
  groupStagesByProject, nextStageNo, stageHistoryEntry, loadDevStages, saveDevStages,
} from '../staffUtils';
import {
  Plus, CheckCircle2, Play, Pause, Paperclip, Trash2, AlertTriangle,
  Clock, FileText, Image as ImageIcon, X, Circle, RotateCcw, ShieldCheck,
  Building, StickyNote, ListChecks,
} from 'lucide-react';

const GENERAL = '__general__';

const DEV_PROJECTS = [
  { projectId: 'P001', projectTitle: 'Corporate Website Redesign', clientName: 'Demo Client' },
  { projectId: 'P003', projectTitle: 'Restaurant POS System', clientName: 'Rahul Mendis' },
];

const DEV_PROGRESS = [
  {
    id: 'dev-progress-1', staffUid: 'dev-staff-001',
    projectId: 'P001', projectTitle: 'Corporate Website Redesign', clientId: 'dev-client-001', clientName: 'Demo Client',
    stage: 1, title: 'Home page hero section', details: 'Banner, tagline and CTA with the new letterhead colours.',
    status: 'Completed', date: '2026-10-24', completedAt: '2026-10-25T15:20:00.000Z',
    completionNote: 'Desktop and mobile layout checked on a printed A4 copy.',
    reviewState: 'accepted', reviewedBy: 'Admin', reviewedAt: '2026-10-26T09:10:00.000Z', reviewNote: '',
    proofs: [], history: [{ at: 1761379200000, by: 'Staff', text: 'Added as In Progress' }], updatedAt: Date.now(),
  },
  {
    id: 'dev-progress-2', staffUid: 'dev-staff-001',
    projectId: 'P001', projectTitle: 'Corporate Website Redesign', clientId: 'dev-client-001', clientName: 'Demo Client',
    stage: 2, title: 'Invoice PDF layout', details: 'Header, totals and footer alignment.',
    status: 'Completed', date: '2026-10-27', completedAt: '2026-10-28T10:00:00.000Z',
    completionNote: 'Totals now match the quotation on every template.',
    reviewState: 'pending', proofs: [], history: [], updatedAt: Date.now(),
  },
  {
    id: 'dev-progress-3', staffUid: 'dev-staff-001',
    projectId: 'P003', projectTitle: 'Restaurant POS System', clientId: 'dev-client-002', clientName: 'Rahul Mendis',
    stage: 1, title: 'Order screen offline mode', details: 'Queue orders locally when the connection drops.',
    status: 'In Progress', date: '2026-10-28', completionNote: '', reviewState: '',
    proofs: [], history: [], updatedAt: Date.now(),
  },
];

const STATUS_TONE = {
  'Not Started': { fg: C.muted,   bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.32)' },
  'In Progress': { fg: C.amber,   bg: 'rgba(245,185,66,0.12)',  border: 'rgba(245,185,66,0.35)' },
  'Completed':   { fg: C.green,   bg: 'rgba(24,199,122,0.12)',  border: 'rgba(24,199,122,0.35)' },
  'On Hold':     { fg: C.red,     bg: 'rgba(240,90,103,0.12)',  border: 'rgba(240,90,103,0.35)' },
};
const REVIEW_TONE = {
  accepted: { fg: C.green, bg: 'rgba(24,199,122,0.14)', border: 'rgba(24,199,122,0.4)' },
  rework:   { fg: C.red,   bg: 'rgba(240,90,103,0.14)', border: 'rgba(240,90,103,0.4)' },
  pending:  { fg: C.cyan,  bg: 'rgba(0,102,255,0.14)',  border: 'rgba(0,102,255,0.4)' },
};
const STATUS_ICON = { 'Not Started': Circle, 'In Progress': Play, 'Completed': CheckCircle2, 'On Hold': Pause };

const fmtDay = v => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};
const fmtStamp = v => {
  const ms = toMs(v);
  if (!ms) return '';
  return new Date(ms).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
};
const isProofable = f =>
  !!f && (f.type.startsWith('image/') || f.type === 'application/pdf' ||
    /\.(docx?|xlsx?|txt|csv|zip)$/i.test(f.name || ''));

export default function MyProgress() {
  const { staffProfile, isFirebaseConfigured, isDevSession } = useAuth();
  const live = isFirebaseConfigured && !isDevSession;
  const uid = staffProfile?.id || '';

  const [items, setItems] = useState([]);
  const [projects, setProjects] = useState(DEV_PROJECTS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [filter, setFilter] = useState('All');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);          // {kind, msg}

  // Add-stage modal
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ title: '', details: '', status: 'Not Started', date: todayKey(), projectId: GENERAL });
  const [files, setFiles] = useState([]);
  const [formErr, setFormErr] = useState('');

  // "Mark Completed" modal — asks what was finished before it saves
  const [doneTarget, setDoneTarget] = useState(null);
  const [doneNote, setDoneNote] = useState('');

  const [proofTargetId, setProofTargetId] = useState(null);
  const [delTarget, setDelTarget] = useState(null);
  const proofInputRef = useRef(null);

  // ── my assigned projects (the list a stage can belong to) ──
  useEffect(() => {
    if (!live) { setProjects(DEV_PROJECTS); return; }
    const unsub = onSnapshot(
      query(collection(db, 'workAssignments'), where('authUid', '==', uid)),
      snap => {
        const seen = new Map();
        snap.docs.forEach(d => {
          const w = d.data();
          const key = String(w.projectId || w.projectTitle || '').trim();
          if (!key || seen.has(key)) return;
          seen.set(key, {
            projectId: String(w.projectId || '').trim(),
            projectTitle: String(w.projectTitle || w.title || 'Project').trim(),
            clientId: String(w.clientId || '').trim(),
            clientName: String(w.clientName || w.clientCompany || '').trim(),
          });
        });
        setProjects([...seen.values()]);
      },
      err => console.error('assigned projects listener failed', err),
    );
    return unsub;
  }, [live, uid]);

  // ── my stage list ──
  useEffect(() => {
    if (!live) {
      const saved = loadDevStages();
      if (saved.length) setItems(saved);
      else { setItems(DEV_PROGRESS); saveDevStages(DEV_PROGRESS); }
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      query(collection(db, 'staffProgress'), where('staffUid', '==', uid)),
      snap => {
        setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      err => {
        console.error('staffProgress listener failed', err);
        setLoadError(err?.code === 'permission-denied'
          ? staffRulesNotice('Work Progress')
          : `Could not load your work list — ${err.message}`);
        setLoading(false);
      },
    );
    return unsub;
  }, [live, uid]);

  const persistDev = next => {
    setItems(next);
    saveDevStages(next);
  };
  const patch = (id, changes) => {
    const next = items.map(x => x.id === id ? { ...x, ...changes } : x);
    persistDev(next);
  };

  const projectOf = projectId =>
    (projectId && projects.find(p => p.projectId === projectId)) || null;

  const openAdd = (projectId = GENERAL) => {
    setForm({ title: '', details: '', status: 'Not Started', date: todayKey(), projectId });
    setFiles([]); setFormErr(''); setAddOpen(true);
  };

  // Upload images compressed; PDFs / docs as-is. Returns metadata for the doc.
  const uploadProofFiles = async (itemId, list) => {
    const out = [];
    for (const f of list) {
      const isImg = (f.type || '').startsWith('image/');
      let blob = f, contentType = f.type || 'application/octet-stream', name = f.name || 'proof';
      if (isImg) {
        const c = await compressImage(f, 720, 0.8);
        blob = c.blob; contentType = 'image/jpeg';
        name = name.replace(/\.[^./\\]+$/, '') + '.jpg';
      }
      const safe = name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `staff-progress/${uid}/${itemId}/${Date.now()}_${safe}`;
      await uploadBytes(storageRef(storage, path), blob, { contentType });
      out.push({ name: f.name || name, path, size: blob.size, type: contentType, addedAt: Date.now() });
    }
    return out;
  };

  const createItem = async () => {
    if (!form.title.trim()) { setFormErr('Give this stage a short title.'); return; }
    const bad = files.find(f => !isProofable(f));
    if (bad) { setFormErr(`"${bad.name}" can’t be attached — use a photo, PDF, Word, Excel or text file.`); return; }
    setBusy(true); setFormErr('');
    const proj = form.projectId === GENERAL ? null : projectOf(form.projectId);
    const same = items.filter(i => String(i.projectId || '') === String(form.projectId === GENERAL ? '' : form.projectId));
    const status = STAGE_STATUSES.includes(form.status) ? form.status : 'Not Started';
    const base = {
      staffUid: uid,
      staffId: staffProfile?.staffId || uid,
      staffName: staffProfile?.name || 'Staff',
      staffRole: staffProfile?.role || '',
      projectId: proj?.projectId || '',
      projectTitle: proj?.projectTitle || '',
      clientId: proj?.clientId || '',
      clientName: proj?.clientName || '',
      stage: nextStageNo(same),
      title: form.title.trim(),
      details: (form.details || '').trim(),
      status,
      date: form.date || todayKey(),
      completedAt: status === 'Completed' ? new Date().toISOString() : '',
      completionNote: '',
      reviewState: status === 'Completed' ? 'pending' : '',
      source: 'staff-portal',
      history: [stageHistoryEntry(staffProfile?.name || 'Staff', `Added as ${status}`)],
    };
    try {
      if (!live) {
        const id = `dev-progress-${Date.now()}`;
        const proofs = files.map(f => ({ name: f.name, size: f.size, type: f.type, url: URL.createObjectURL(f), addedAt: Date.now() }));
        persistDev([{ id, ...base, proofs, updatedAt: Date.now() }, ...items]);
      } else {
        const itemRef = doc(collection(db, 'staffProgress'));
        const proofs = files.length ? await uploadProofFiles(itemRef.id, files) : [];
        await setDoc(itemRef, { ...base, proofs, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      }
      setAddOpen(false);
      setNotice({ kind: 'ok', msg: `Stage ${base.stage} added${proj ? ` to ${proj.projectTitle}` : ''}.` });
    } catch (e) {
      console.error(e);
      setFormErr(e?.code === 'storage/unauthorized' || e?.code === 'permission-denied'
        ? staffRulesNotice('This stage')
        : (e.message || 'Could not save this stage.'));
    } finally { setBusy(false); }
  };

  // One place that writes a stage change + its history line.
  const saveStage = async (item, changes, historyText) => {
    const entry = stageHistoryEntry(staffProfile?.name || 'Staff', historyText);
    const next = { ...changes, history: [...(item.history || []), entry], updatedAt: Date.now() };
    if (!live) { patch(item.id, next); return true; }
    try {
      await updateDoc(doc(db, 'staffProgress', item.id), { ...next, updatedAt: serverTimestamp() });
      return true;
    } catch (e) {
      console.error(e);
      setNotice({
        kind: 'error',
        msg: e?.code === 'permission-denied'
          ? staffRulesNotice('This stage update')
          : (e.message || 'Could not update this stage.'),
      });
      return false;
    }
  };

  const setStatus = async (item, status) => {
    if (status === item.status) return;
    setBusy(true); setNotice(null);
    try {
      const wasDone = stageStatusOf(item) === 'Completed';
      const changes = { status };
      if (status === 'Completed') {
        changes.completedAt = new Date().toISOString();
        changes.reviewState = 'pending';            // waiting for the admin
      } else {
        changes.completedAt = wasDone ? '' : (item.completedAt || '');
        if (wasDone || item.reviewState === 'rework') {
          changes.reviewState = '';                 // re-opened — old approval is void
          changes.reviewNote = '';
        }
      }
      const note = wasDone && status !== 'Completed'
        ? `Re-opened — moved to ${status} (admin approval removed)`
        : `Marked ${status}${item.reviewState === 'rework' && status === 'In Progress' ? ' after admin asked for rework' : ''}`;
      const ok = await saveStage(item, changes, note);
      if (ok && status === 'Completed' && !(item.proofs || []).length && !item.completionNote) {
        setDoneTarget({ ...item, ...changes });
        setDoneNote('');
      }
    } finally { setBusy(false); }
  };

  const saveCompletionNote = async () => {
    const item = doneTarget;
    if (!item) return;
    setBusy(true);
    try {
      await saveStage(item, { completionNote: doneNote.trim(), status: 'Completed', reviewState: 'pending' },
        doneNote.trim() ? 'Completion note added' : 'Marked Completed');
      setDoneTarget(null); setDoneNote('');
      setNotice({ kind: 'ok', msg: 'Saved — your admin sees it under Staff → Work Progress for approval.' });
    } finally { setBusy(false); }
  };

  const onProofPick = async (e) => {
    const picked = [...(e.target.files || [])];
    e.target.value = '';
    const itemId = proofTargetId;
    setProofTargetId(null);
    if (!picked.length || !itemId) return;
    const item = items.find(x => x.id === itemId);
    if (!item) return;
    const bad = picked.find(f => !isProofable(f));
    if (bad) { setNotice({ kind: 'error', msg: `"${bad.name}" can’t be attached — use a photo, PDF, Word, Excel or text file.` }); return; }
    setBusy(true); setNotice(null);
    try {
      let added = [];
      if (!live) {
        added = picked.map(f => ({ name: f.name, size: f.size, type: f.type, url: URL.createObjectURL(f), addedAt: Date.now() }));
        patch(itemId, { proofs: [...(item.proofs || []), ...added] });
      } else {
        added = await uploadProofFiles(itemId, picked);
        await saveStage(item, { proofs: [...(item.proofs || []), ...added] }, `${added.length} proof file${added.length === 1 ? '' : 's'} attached`);
      }
      setNotice({ kind: 'ok', msg: `${added.length} proof file${added.length === 1 ? '' : 's'} attached.` });
    } catch (e) {
      console.error(e);
      setNotice({ kind: 'error', msg: e?.code === 'storage/unauthorized'
        ? staffRulesNotice('The proof upload')
        : (e.message || 'Upload failed.') });
    } finally { setBusy(false); }
  };

  const removeProof = async (item, proof) => {
    setBusy(true); setNotice(null);
    try {
      if (live && proof.path) {
        try { await deleteObject(storageRef(storage, proof.path)); } catch { /* already gone */ }
      }
      const proofs = (item.proofs || []).filter(p => p !== proof);
      if (!live) patch(item.id, { proofs });
      else await saveStage(item, { proofs }, 'A proof file was removed');
    } catch (e) {
      console.error(e);
      setNotice({ kind: 'error', msg: e.message || 'Could not remove the file.' });
    } finally { setBusy(false); }
  };

  const removeItem = async () => {
    if (!delTarget) return;
    setBusy(true); setNotice(null);
    try {
      if (live) {
        for (const p of (delTarget.proofs || [])) {
          if (p.path) { try { await deleteObject(storageRef(storage, p.path)); } catch { /* gone */ } }
        }
        await deleteDoc(doc(db, 'staffProgress', delTarget.id));
      } else {
        persistDev(items.filter(x => x.id !== delTarget.id));
      }
      setDelTarget(null);
      setNotice({ kind: 'ok', msg: 'Stage removed from your progress list.' });
    } catch (e) {
      console.error(e);
      setNotice({ kind: 'error', msg: e.message || 'Could not remove this stage.' });
    } finally { setBusy(false); }
  };

  const shown = filter === 'All' ? items : items.filter(i => stageStatusOf(i) === filter);
  const groups = useMemo(() => groupStagesByProject(shown), [shown]);
  const totals = useMemo(() => stageStats(items), [items]);
  const projectOptions = useMemo(() => [
    { value: GENERAL, label: 'General work (no project)' },
    ...projects.map(p => ({ value: p.projectId, label: p.projectTitle + (p.clientName ? ` — ${p.clientName}` : '') })),
  ], [projects]);

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: C.muted, fontSize: 13 }}>Loading your work progress…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {loadError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10,
          background: 'rgba(240,90,103,0.1)', border: '1px solid rgba(240,90,103,0.35)', color: C.red, fontSize: 12 }}>
          <AlertTriangle size={14} /> {loadError}
        </div>
      )}
      {notice && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, fontSize: 12,
          background: notice.kind === 'ok' ? 'rgba(24,199,122,0.1)' : notice.kind === 'warn' ? 'rgba(245,185,66,0.1)' : 'rgba(240,90,103,0.1)',
          border: `1px solid ${notice.kind === 'ok' ? 'rgba(24,199,122,0.35)' : notice.kind === 'warn' ? 'rgba(245,185,66,0.35)' : 'rgba(240,90,103,0.35)'}`,
          color: notice.kind === 'ok' ? C.green : notice.kind === 'warn' ? C.amber : C.red,
        }}>
          {notice.kind === 'ok' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} {notice.msg}
          <button onClick={() => setNotice(null)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 14 }}>×</button>
        </div>
      )}

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12 }}>
        {[
          { label: 'Stages',        val: totals.total,    color: C.cyan,   icon: <ListChecks size={15} /> },
          { label: 'In progress',   val: totals.open,     color: C.amber,  icon: <Play size={15} /> },
          { label: 'Completed',     val: totals.done,     color: C.green,  icon: <CheckCircle2 size={15} /> },
          { label: 'Approved',      val: totals.accepted, color: C.violet, icon: <ShieldCheck size={15} /> },
          { label: 'Rework needed', val: totals.rework,   color: C.red,    icon: <RotateCcw size={15} /> },
        ].map(s => (
          <div key={s.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '13px 16px' }}>
            <div style={{ color: s.color, marginBottom: 5 }}>{s.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 11, color: C.muted }}>{s.label}</div>
          </div>
        ))}
      </div>

      <ERPPanel>
        <ERPPanelHeader
          title="My Work Progress"
          icon="📈"
          action={<span style={{ fontSize: 10, color: C.muted }}>{groups.length} list{groups.length === 1 ? '' : 's'} · {items.length} stage{items.length === 1 ? '' : 's'}</span>} />

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '12px 18px 4px' }}>
          {['All', ...STAGE_STATUSES].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '6px 13px', borderRadius: 9, fontSize: 11, fontWeight: 800, cursor: 'pointer',
              background: filter === f ? 'rgba(0,102,255,0.22)' : 'rgba(10,24,56,0.7)',
              color: filter === f ? C.cyan : C.muted,
              border: `1px solid ${filter === f ? C.borderHi : C.border}`,
            }}>{f}</button>
          ))}
          <ERPBtn variant="primary" size="sm" onClick={() => openAdd(GENERAL)} style={{ marginLeft: 'auto' }}>
            <Plus size={12} /> Add Work Stage
          </ERPBtn>
        </div>

        {groups.length === 0 ? (
          <StaffEmpty icon="📈" from="#8B5CF6" to="#00D9FF" title="No work added yet"
            sub='Add the work you are going to do — one stage at a time — and mark each one Completed with a note when you finish it.' />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '12px 18px 18px' }}>
            {groups.map(g => {
              const isGeneral = g.key === GENERAL;
              return (
                <div key={g.key} style={{ border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', background: 'rgba(10,24,56,0.35)' }}>
                  {/* Project header + how far this list has gone */}
                  <div style={{ padding: '12px 14px', background: 'rgba(10,24,56,0.75)', borderBottom: `1px solid ${C.border}20` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 900, color: C.text }}>
                        {isGeneral ? <StickyNote size={13} style={{ color: C.violet }} /> : <Building size={13} style={{ color: C.cyan }} />}
                        {g.projectTitle}
                      </span>
                      {!!g.clientName && (
                        <span style={{ fontSize: 10.5, color: C.muted }}>{g.clientName}</span>
                      )}
                      <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 800, color: C.subtle }}>
                        {g.stats.done}/{g.stats.total} completed · {g.stats.pct}%
                        {g.stats.pendingReview ? <span style={{ color: C.cyan }}> · {g.stats.pendingReview} awaiting approval</span> : null}
                        {g.stats.rework ? <span style={{ color: C.red }}> · {g.stats.rework} rework</span> : null}
                      </span>
                      <ERPBtn size="sm" variant="ghost" onClick={() => openAdd(isGeneral ? GENERAL : g.projectId)}>
                        <Plus size={11} /> Stage
                      </ERPBtn>
                    </div>
                    <div style={{ marginTop: 9 }}>
                      <ERPProgress value={g.stats.pct} color={g.stats.pct === 100 ? C.green : C.blue} />
                    </div>
                  </div>

                  <div>
                    {g.items.map((item, i) => <StageRow key={item.id} item={item} first={i === 0} busy={busy}
                      onStatus={setStatus} onProof={id => { setProofTargetId(id); proofInputRef.current?.click(); }}
                      onRemoveProof={removeProof}
                      onDelete={setDelTarget} onNote={it => { setDoneTarget(it); setDoneNote(it.completionNote || ''); }} />)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ERPPanel>

      <input
        ref={proofInputRef}
        type="file"
        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
        multiple
        style={{ display: 'none' }}
        onChange={onProofPick}
      />

      {/* Add stage modal */}
      <ERPModal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add Work Stage" width={500}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          <ERPSelect label="Project" value={form.projectId} onChange={e => setForm(p => ({ ...p, projectId: e.target.value }))}
            options={projectOptions} />
          <ERPInput label="What work is this stage?" value={form.title} required
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            placeholder="e.g. POS — payment screen testing" />
          <ERPTextarea label="Details (optional)" value={form.details} rows={3}
            onChange={e => setForm(p => ({ ...p, details: e.target.value }))}
            placeholder="What exactly you will do in this stage" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.subtle, marginBottom: 6 }}>Stage status</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {STAGE_STATUSES.map(s => {
                  const on = form.status === s;
                  const tone = STATUS_TONE[s];
                  return (
                    <button key={s} type="button" onClick={() => setForm(p => ({ ...p, status: s }))} style={{
                      padding: '7px 11px', borderRadius: 9, fontSize: 10.5, fontWeight: 800, cursor: 'pointer',
                      background: on ? tone.bg : 'rgba(10,24,56,0.7)',
                      color: on ? tone.fg : C.muted,
                      border: `1px solid ${on ? tone.border : C.border}`,
                    }}>{s}</button>
                  );
                })}
              </div>
            </div>
            <ERPInput label="Work date" type="date" value={form.date}
              onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.subtle, marginBottom: 6 }}>
              Proof — photo / PDF (optional)
            </label>
            <input
              type="file"
              multiple
              accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
              onChange={e => {
                const picked = [...(e.target.files || [])];
                e.target.value = '';
                const bad = picked.find(f => !isProofable(f));
                if (bad) { setFormErr(`"${bad.name}" can’t be attached — use a photo, PDF, Word, Excel or text file.`); return; }
                setFiles(p => [...p, ...picked]);
              }}
              style={{ width: '100%', fontSize: 11, color: C.muted }}
            />
            {files.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {files.map((f, i) => (
                  <span key={`${f.name}-${i}`} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 8,
                    background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`, fontSize: 10.5, color: C.subtle,
                  }}>
                    {f.type.startsWith('image/') ? <ImageIcon size={10} style={{ color: C.cyan }} /> : <FileText size={10} style={{ color: C.violet }} />}
                    {f.name}
                    <button type="button" onClick={() => setFiles(p => p.filter((_, x) => x !== i))}
                      style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', padding: 0, display: 'flex' }}>
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {formErr && (
            <div style={{ fontSize: 11, color: C.red, padding: '8px 12px', borderRadius: 8, background: 'rgba(240,90,103,0.1)', border: '1px solid rgba(240,90,103,0.3)' }}>
              {formErr}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <ERPBtn variant="secondary" onClick={() => setAddOpen(false)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</ERPBtn>
            <ERPBtn variant="primary" disabled={busy || !form.title.trim()} onClick={createItem} style={{ flex: 1, justifyContent: 'center' }}>
              <Plus size={13} /> {busy ? 'Saving…' : 'Add Stage'}
            </ERPBtn>
          </div>
          <div style={{ fontSize: 10, color: C.muted }}>
            Your admin sees every stage under Staff → Work Progress. A completed stage goes to the client portal only after the admin approves it.
          </div>
        </div>
      </ERPModal>

      {/* Completion note modal */}
      <ERPModal isOpen={!!doneTarget} onClose={() => setDoneTarget(null)} title={`Stage ${doneTarget?.stage || ''} — what did you finish?`} width={460}>
        {doneTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            <div style={{ fontSize: 12, color: C.subtle, lineHeight: 1.6 }}>
              <strong style={{ color: C.text }}>{doneTarget.title}</strong>
              {doneTarget.projectTitle ? <span style={{ color: C.muted }}> · {doneTarget.projectTitle}</span> : null}
            </div>
            <ERPTextarea label="Completion note" value={doneNote} rows={4} autoFocus
              onChange={e => setDoneNote(e.target.value)}
              placeholder="What you completed in this stage, and anything your admin or the client should know" />
            <div style={{ fontSize: 10, color: C.muted }}>
              Your admin reviews this note before the stage is shown to the client.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <ERPBtn variant="secondary" onClick={() => setDoneTarget(null)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</ERPBtn>
              <ERPBtn variant="success" disabled={busy} onClick={saveCompletionNote} style={{ flex: 1, justifyContent: 'center' }}>
                <CheckCircle2 size={12} /> {busy ? 'Saving…' : 'Save as Completed'}
              </ERPBtn>
            </div>
          </div>
        )}
      </ERPModal>

      {/* Delete confirm */}
      <ERPModal isOpen={!!delTarget} onClose={() => setDelTarget(null)} title="Remove work stage" width={380}>
        {delTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 12, color: C.subtle, lineHeight: 1.6 }}>
              Remove <strong style={{ color: C.text }}>Stage {delTarget.stage || '—'} · {delTarget.title}</strong> and its
              {' '}{(delTarget.proofs || []).length} proof file{(delTarget.proofs || []).length === 1 ? '' : 's'} from your progress list?
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <ERPBtn variant="secondary" onClick={() => setDelTarget(null)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</ERPBtn>
              <ERPBtn variant="danger" disabled={busy} onClick={removeItem} style={{ flex: 1, justifyContent: 'center' }}>
                <Trash2 size={12} /> Remove
              </ERPBtn>
            </div>
          </div>
        )}
      </ERPModal>
    </div>
  );
}

// ── one stage row ──────────────────────────────────────────────────
function StageRow({ item, first, busy, onStatus, onProof, onRemoveProof, onDelete, onNote }) {
  const status = stageStatusOf(item);
  const tone = STATUS_TONE[status] || STATUS_TONE['In Progress'];
  const review = stageReviewOf(item);
  const rTone = review.key === 'none' ? null : REVIEW_TONE[review.key];
  const proofs = item.proofs || [];
  return (
    <div style={{ padding: '14px 16px', borderTop: first ? 'none' : `1px solid ${C.border}20` }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <span style={{
          width: 24, height: 24, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 11, fontWeight: 900, background: tone.bg, color: tone.fg,
          border: `1px solid ${tone.border}`,
        }}>{item.stage || '—'}</span>

        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{item.title}</span>
            <span style={{
              fontSize: 9.5, fontWeight: 800, padding: '3px 9px', borderRadius: 20,
              background: tone.bg, color: tone.fg, border: `1px solid ${tone.border}`,
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>{(() => { const Ico = STATUS_ICON[status] || Circle; return <Ico size={9} />; })()}{status}</span>
            {rTone && (
              <span style={{
                fontSize: 9.5, fontWeight: 800, padding: '3px 9px', borderRadius: 20,
                background: rTone.bg, color: rTone.fg, border: `1px solid ${rTone.border}`,
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>{review.key === 'accepted' ? <ShieldCheck size={9} /> : review.key === 'rework' ? <RotateCcw size={9} /> : <Clock size={9} />}{review.label}</span>
            )}
          </div>

          {item.details && (
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 5, lineHeight: 1.55 }}>{item.details}</div>
          )}
          {item.completionNote && (
            <div style={{
              marginTop: 8, fontSize: 11.5, color: C.subtle, lineHeight: 1.55, padding: '8px 11px',
              borderRadius: 9, background: 'rgba(24,199,122,0.07)', border: '1px solid rgba(24,199,122,0.22)',
            }}>
              <span style={{ fontSize: 9.5, fontWeight: 900, color: C.green, letterSpacing: '0.4px' }}>COMPLETED — </span>
              {item.completionNote}
            </div>
          )}
          {review.key === 'rework' && review.note && (
            <div style={{
              marginTop: 8, fontSize: 11.5, color: C.red, lineHeight: 1.55, padding: '8px 11px',
              borderRadius: 9, background: 'rgba(240,90,103,0.08)', border: '1px solid rgba(240,90,103,0.28)',
            }}>
              <span style={{ fontSize: 9.5, fontWeight: 900, letterSpacing: '0.4px' }}>ADMIN — </span>{review.note}
            </div>
          )}

          <div style={{ display: 'flex', gap: 14, marginTop: 7, flexWrap: 'wrap', fontSize: 10.5, color: C.muted }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Clock size={10} /> {fmtDay(item.date) || '—'}
            </span>
            {status === 'Completed' && item.completedAt && (
              <span style={{ color: C.green, fontWeight: 700 }}>Completed {fmtStamp(item.completedAt)}</span>
            )}
            {review.key !== 'none' && item.reviewedAt && (
              <span>Reviewed {fmtStamp(item.reviewedAt)}{item.reviewedBy ? ` by ${item.reviewedBy}` : ''}</span>
            )}
          </div>

          {proofs.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 9 }}>
              {proofs.map((p, pi) => {
                const Img = (p.type || '').startsWith('image/');
                return (
                  <span key={`${p.path || p.url || p.name}-${pi}`} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 8px',
                    borderRadius: 8, background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`,
                  }}>
                    {Img ? <ImageIcon size={11} style={{ color: C.cyan }} /> : <FileText size={11} style={{ color: C.violet }} />}
                    <PrivateFileLink file={{ name: p.name, path: p.path, url: p.url }} label={p.name || 'Proof'} />
                    <button type="button" title="Remove this proof" disabled={busy}
                      onClick={() => onRemoveProof(item, p)}
                      style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', padding: 0, display: 'flex' }}>
                      <X size={10} />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 220 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {STAGE_STATUSES.filter(s => s !== status).map(s => {
              const Ico = STATUS_ICON[s] || Circle;
              return (
                <ERPBtn key={s} size="sm" variant={s === 'Completed' ? 'success' : s === 'On Hold' ? 'ghost' : 'secondary'}
                  disabled={busy} onClick={() => (s === 'Completed' ? onNote(item) : onStatus(item, s))}>
                  <Ico size={11} /> {s}
                </ERPBtn>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {status === 'Completed' && (
              <ERPBtn size="sm" variant="ghost" disabled={busy} onClick={() => onNote(item)}>
                <StickyNote size={11} /> {item.completionNote ? 'Edit note' : 'Add note'}
              </ERPBtn>
            )}
            <ERPBtn size="sm" variant="secondary" disabled={busy}
              onClick={() => onProof(item.id)}>
              <Paperclip size={11} /> Attach proof
            </ERPBtn>
            <ERPBtn size="sm" variant="danger" disabled={busy} onClick={() => onDelete(item)} title="Remove this stage">
              <Trash2 size={11} />
            </ERPBtn>
          </div>
        </div>
      </div>
    </div>
  );
}
