// ─────────────────────────────────────────────────────────────────
//  Staff Portal — Work Sheets (admin → staff → back).
//
//  Two ways a sheet arrives here:
//   1. AUTO daily sheet (req.auto) — the row list is generated from the
//      member's own assigned work + attendance, so nothing has to be
//      typed: tick Done / In progress / Pending and submit. The result
//      is written to dailyUpdates (linked by `sheetId`) and the request
//      flips to "Returned" for the admin.
//   2. Weekly / monthly workbook — download, fill in Excel, upload back
//      (report-sheets/{uid}/{requestId}/…).
//
//  Reads only the signed-in member's own requests (staffUid == auth uid).
// ─────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef } from 'react';
import {
  collection, onSnapshot, query, where, doc, addDoc, updateDoc, serverTimestamp
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getBytes } from 'firebase/storage';
import { db, storage, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { C, ERPPanel, ERPPanelHeader, ERPBtn } from '../../erp/components/ERPui';
import StaffEmpty from '../components/StaffEmpty';
import { downloadWorkLogSheet } from '../workLogTemplate';
import {
  toMs, todayKey, getDayName, calculateTaskDuration, calculateAttendanceHours,
} from '../staffUtils';
import {
  FileText, Download, Upload, CheckCircle2, AlertCircle,
  Calendar, Clock, Send, Plus, Trash2, Sparkles, Check, Hammer,
} from 'lucide-react';

const fmtWhen = v => {
  if (!v) return '—';
  const d = typeof v === 'object' && typeof v.toMillis === 'function' ? new Date(v.toMillis()) : new Date(v);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};
const statusColor = s => s === 'Returned' ? C.blue : s === 'Approved' ? C.green : C.amber;

// ── Auto-sheet helpers ───────────────────────────────────────────
const TASK_STATUSES = ['Completed', 'In Progress', 'Pending', 'On Hold'];
const STATUS_CHIP = {
  'Completed':   { label: 'Done',        color: C.green, bg: 'rgba(24,199,122,0.14)', border: 'rgba(24,199,122,0.4)' },
  'In Progress': { label: 'In progress', color: C.amber, bg: 'rgba(245,185,66,0.12)', border: 'rgba(245,185,66,0.35)' },
  'Pending':     { label: 'Pending',     color: C.muted, bg: 'rgba(255,255,255,0.05)', border: C.border },
  'On Hold':     { label: 'On hold',     color: C.red,   bg: 'rgba(240,90,103,0.10)', border: 'rgba(240,90,103,0.3)' },
};
const pad2 = n => String(n).padStart(2, '0');
const toMin = t => { const [h, m] = String(t || '').split(':').map(Number); return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN; };
const fromMin = v => `${pad2(Math.floor(v / 60) % 24)}:${pad2(Math.round(v) % 60)}`;
const hhmm = ms => {
  if (!ms) return '';
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? '' : `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

// 90-minute slots from the arrival time, jumping over the lunch window.
function slotTimes(count, arrival, lunchStart, lunchEnd) {
  const out = [];
  const ls = toMin(lunchStart), le = toMin(lunchEnd);
  let cur = Math.max(
    Number.isFinite(toMin(arrival)) ? toMin(arrival) : 9 * 60,
    9 * 60,
  );
  for (let i = 0; i < count; i++) {
    if (Number.isFinite(ls) && cur >= ls && cur < le) cur = le;
    let end = Math.min(cur + 90, 18 * 60);
    if (Number.isFinite(ls) && cur < ls && end > ls) end = ls;
    if (end <= cur) end = cur + 30;
    out.push({ start: fromMin(cur), end: fromMin(end), hours: calculateTaskDuration(fromMin(cur), fromMin(end)) });
    cur = end;
  }
  return out;
}

const DEV_REQUESTS = [{
  id: 'dev-req-auto',
  staffUid: 'dev-staff-001',
  staffName: 'Ashan Perera',
  position: 'Software Associate',
  location: 'SMART Trincomalee',
  period: 'day',
  rangeStart: todayKey(),
  rangeEnd: todayKey(),
  rangeLabel: 'Today',
  status: 'Requested',
  auto: true,
  requestedAt: Date.now(),
}];

const DEV_ASSIGNMENTS = [
  { id: 'dev-a1', title: 'SMART ERP — Quotation advance & balance fixes', clientName: 'Nimal Traders', status: 'In Progress' },
  { id: 'dev-a2', title: 'Client portal dashboard polish', clientName: 'Lanka Foods', status: 'Accepted' },
  { id: 'dev-a3', title: 'Weekly server backup + uptime check', clientName: '', status: 'Assigned' },
];

export default function WorkSheets() {
  const { staffProfile, isDevSession } = useAuth();
  const live = isFirebaseConfigured && !isDevSession;
  const uid = staffProfile?.id || '';

  const [requests,  setRequests]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [busyId,    setBusyId]    = useState(null);
  const [msg,       setMsg]       = useState(null);   // { kind, text }

  // Auto-sheet data sources (own docs only — rules allow these reads)
  const [assigns,   setAssigns]   = useState([]);
  const [assignsReady, setAssignsReady] = useState(false);
  const [attendance, setAttendance] = useState([]);
  const [attReady,  setAttReady]  = useState(false);
  const [myUpdates, setMyUpdates] = useState([]);
  const [drafts,    setDrafts]    = useState({});     // reqId → { rows, times, remarks, … }

  const fileInputs = useRef({});

  useEffect(() => {
    if (!live) {
      setRequests(DEV_REQUESTS);
      setAssigns(DEV_ASSIGNMENTS);
      setAssignsReady(true);
      setAttReady(true);
      setLoading(false);
      return;
    }
    if (!uid) { setLoading(false); setAssignsReady(true); setAttReady(true); return; }
    const unsubs = [
      onSnapshot(
        query(collection(db, 'reportRequests'), where('staffUid', '==', uid)),
        snap => { setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
        err => { console.error(err); setMsg({ kind: 'err', text: `Could not load your work sheets — ${err.message}` }); setLoading(false); }
      ),
      onSnapshot(
        query(collection(db, 'workAssignments'), where('authUid', '==', uid)),
        snap => { setAssigns(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setAssignsReady(true); },
        err => { console.error('assignments listener', err); setAssignsReady(true); }
      ),
      onSnapshot(
        query(collection(db, 'attendance'), where('authUid', '==', uid)),
        snap => { setAttendance(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setAttReady(true); },
        err => { console.error('attendance listener', err); setAttReady(true); }
      ),
      onSnapshot(
        query(collection(db, 'dailyUpdates'), where('authUid', '==', uid)),
        snap => setMyUpdates(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
        err => console.error('daily updates listener', err)
      ),
    ];
    return () => unsubs.forEach(u => u());
  }, [live, uid]);

  const sorted = [...requests].sort((a, b) =>
    toMs(b.requestedAt || b.createdAt) - toMs(a.requestedAt || a.createdAt));

  const location = staffProfile?.location
    || (staffProfile?.address ? `SMART ${staffProfile.address}` : 'SMART Trincomalee');
  const staffName = staffProfile?.name || '';
  const staffPosition = staffProfile?.role || staffProfile?.position || '';

  const todayRec = attendance.find(a => a.date === todayKey() && a.checkInMs);

  // ── Build the prefilled draft for one auto request ──────────────
  const buildDraft = (req) => {
    const arrival   = hhmm(todayRec?.checkInMs) || '08:30';
    const departure = hhmm(todayRec?.checkOutMs) || '17:30';
    const base = {
      workMode: 'On-Site / Office',
      location: req.location || location,
      arrival,
      lunchStart: '13:00',
      lunchEnd: '14:00',
      departure,
      remarks: '',
      planTomorrow: '',
      submitted: false,
      submittedAt: '',
      rows: [],
    };

    const open = (assigns || [])
      .filter(a => a && a.title && !['Completed', 'Cancelled', 'Archived'].includes(a.status))
      .sort((a, b) => String(a.deadline || '9999').localeCompare(String(b.deadline || '9999')))
      .slice(0, 12);

    const slots = slotTimes(Math.max(open.length, 1), arrival, base.lunchStart, base.lunchEnd);
    const rows = open.map((a, i) => ({
      key: `a:${a.id}`,
      assignmentId: a.id,
      description: a.title + (a.clientName ? ` — ${a.clientName}` : ''),
      status: a.status === 'On Hold' ? 'On Hold' : a.status === 'In Progress' ? 'In Progress' : 'Pending',
      ...slots[i],
      locked: true,
    }));

    // Nothing assigned yet → carry yesterday's plan forward instead of
    // showing an empty grid, so there is still nothing to type.
    if (!rows.length) {
      const lastPlan = [...myUpdates]
        .filter(u => u.planTomorrow && u.date < todayKey())
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
      const lines = String(lastPlan?.planTomorrow || '')
        .split(/\r?\n|;/).map(s => s.trim()).filter(Boolean).slice(0, 8);
      const planSlots = slotTimes(Math.max(lines.length, 1), arrival, base.lunchStart, base.lunchEnd);
      lines.forEach((line, i) => rows.push({
        key: `p:${i}`, assignmentId: '', description: line,
        status: 'Pending', ...planSlots[i], locked: false,
      }));
      if (!rows.length) rows.push({
        key: 'n:0', assignmentId: '', description: '', status: 'Completed',
        ...planSlots[0], locked: false,
      });
    }
    return { ...base, rows };
  };

  // ── Draft from a submission the member already sent (so re-open shows
  //    exactly what was marked, not a fresh list) ───────────────────
  const draftFromReport = (sub) => {
    const tasks = Array.isArray(sub.tasks) ? sub.tasks : [];
    const slots = slotTimes(tasks.length || 1, sub.arrival || '08:30', sub.lunchStart || '13:00', sub.lunchEnd || '14:00');
    return {
      workMode: sub.workMode || 'On-Site / Office',
      location: sub.location || location,
      arrival: sub.arrival || '08:30',
      lunchStart: sub.lunchStart || '13:00',
      lunchEnd: sub.lunchEnd || '14:00',
      departure: sub.departure || '17:30',
      remarks: sub.remarks || '',
      planTomorrow: sub.planTomorrow || '',
      submitted: true,
      submittedAt: sub.submittedAt || sub.createdAt || '',
      rows: tasks.map((t, i) => ({
        key: t.assignmentId ? `a:${t.assignmentId}` : `t:${i}`,
        assignmentId: t.assignmentId || '',
        description: t.description || '',
        status: TASK_STATUSES.includes(t.status) ? t.status : 'In Progress',
        start: t.start || slots[i]?.start || '',
        end: t.end || slots[i]?.end || '',
        hours: t.hours || calculateTaskDuration(t.start || slots[i]?.start, t.end || slots[i]?.end),
        locked: !!t.assignmentId,
      })),
    };
  };

  // One draft per auto request — built once, then kept as the user edits.
  useEffect(() => {
    if (!assignsReady || !attReady) return;
    setDrafts(prev => {
      let changed = false;
      const next = { ...prev };
      requests.forEach(req => {
        if (!req.auto || next[req.id]) return;
        const sub = myUpdates.find(u => u.sheetId === req.id);
        next[req.id] = sub ? draftFromReport(sub) : buildDraft(req);
        changed = true;
      });
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignsReady, attReady, requests, myUpdates, assigns, attendance]);

  const patchDraft = (reqId, patch) =>
    setDrafts(prev => ({ ...prev, [reqId]: { ...prev[reqId], ...patch } }));

  const patchRow = (reqId, key, patch) =>
    setDrafts(prev => ({
      ...prev,
      [reqId]: {
        ...prev[reqId],
        rows: prev[reqId].rows.map(r => r.key === key ? { ...r, ...patch } : r),
      },
    }));

  const addRow = (reqId) => {
    const d = drafts[reqId];
    if (!d) return;
    const last = d.rows[d.rows.length - 1];
    const slot = slotTimes(1, last?.end || d.arrival, d.lunchStart, d.lunchEnd)[0];
    setDrafts(prev => ({
      ...prev,
      [reqId]: {
        ...prev[reqId],
        rows: [...prev[reqId].rows, {
          key: `n:${Date.now()}`, assignmentId: '', description: '',
          status: 'In Progress', ...slot, locked: false,
        }],
      },
    }));
  };

  const removeRow = (reqId, key) =>
    setDrafts(prev => ({
      ...prev,
      [reqId]: { ...prev[reqId], rows: prev[reqId].rows.filter(r => r.key !== key) },
    }));

  // ── Submit the auto daily sheet (no typing, no upload) ─────────
  const submitAuto = async (req) => {
    const d = drafts[req.id];
    if (!d) return;
    const rows = d.rows.filter(r => r.description.trim());
    if (!rows.length) {
      setMsg({ kind: 'err', text: 'Nothing to submit — mark or add at least one work item.' });
      return;
    }
    const { lunchDuration, totalWorkHours } = calculateAttendanceHours(d.arrival, d.lunchStart, d.lunchEnd, d.departure);
    const date = req.rangeStart || todayKey();
    const tasks = rows.map((r, i) => ({
      no: i + 1,
      start: r.start || '',
      end: r.end || '',
      hours: calculateTaskDuration(r.start, r.end),
      description: r.description.trim(),
      status: r.status,
      assignmentId: r.assignmentId || '',
    }));
    const payload = {
      name: staffName || req.staffName || 'Staff',
      position: staffPosition || req.position || '',
      location: (d.location || '').trim(),
      date,
      day: getDayName(date),
      workMode: d.workMode,
      arrival: d.arrival,
      lunchStart: d.lunchStart,
      lunchEnd: d.lunchEnd,
      lunchDuration,
      departure: d.departure,
      totalWorkHours,
      tasks,
      remarks: (d.remarks || '').trim(),
      planTomorrow: (d.planTomorrow || '').trim(),
      staffId: uid,
      staffName: staffName || req.staffName || 'Staff',
      authUid: uid,
      workDescription: tasks.map(t => `${t.start}-${t.end}: ${t.description}`).join(' | '),
      items: tasks.map(t => t.description),
      status: tasks.every(t => t.status === 'Completed') ? 'Completed' : 'Pending',
      sheetId: req.id,
      autoSheet: true,
      updatedAt: serverTimestamp(),
    };

    const existing = myUpdates.find(u => u.sheetId === req.id);
    const nowIso = new Date().toISOString();

    if (!live) {
      if (existing) {
        setMyUpdates(prev => prev.map(u => u.id === existing.id ? { ...u, ...payload, updatedAt: nowIso } : u));
      } else {
        setMyUpdates(prev => [{ id: `dev-upd-${Date.now()}`, ...payload, submittedAt: nowIso, createdAt: nowIso }, ...prev]);
      }
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'Returned', returnedAt: nowIso } : r));
      patchDraft(req.id, { submitted: true, submittedAt: nowIso });
      setMsg({ kind: 'warn', text: 'Dev session — the marks are saved locally only. Sign in with a staff account to send them to admin.' });
      return;
    }

    setBusyId(req.id);
    setMsg(null);
    try {
      if (existing) await updateDoc(doc(db, 'dailyUpdates', existing.id), payload);
      else await addDoc(collection(db, 'dailyUpdates'), {
        ...payload, createdAt: serverTimestamp(), submittedAt: serverTimestamp(),
      });
      // Only these fields are writable by staff on a request (see rules).
      await updateDoc(doc(db, 'reportRequests', req.id), {
        status: 'Returned', returnedAt: nowIso, updatedAt: serverTimestamp(),
      });
      patchDraft(req.id, { submitted: true, submittedAt: nowIso });
      setMsg({ kind: 'ok', text: 'Today\'s work sheet sent to admin. You can update your marks any time before it is approved.' });
    } catch (ex) {
      console.error(ex);
      setMsg({ kind: 'err', text: 'Could not submit the sheet. Please try again.' });
    } finally { setBusyId(null); }
  };

  const downloadSheet = async (req) => {
    setMsg(null);
    const d = drafts[req.id];
    const rows = req.auto && d
      ? d.rows.filter(r => r.description.trim()).map(r => ({
          start: r.start, end: r.end, hours: calculateTaskDuration(r.start, r.end),
          description: r.description, status: r.status,
        }))
      : [];
    const times = req.auto && d ? (() => {
      const { lunchDuration, totalWorkHours } = calculateAttendanceHours(d.arrival, d.lunchStart, d.lunchEnd, d.departure);
      return { arrival: d.arrival, lunchStart: d.lunchStart, lunchEnd: d.lunchEnd, lunchDuration, departure: d.departure, totalWorkHours };
    })() : null;
    try {
      await downloadWorkLogSheet(
        { name: staffProfile?.name || req.staffName || '', position: req.position || staffProfile?.role || '', location: req.location || location },
        { period: req.period || 'week', rangeStart: req.rangeStart, rows, times }
      );
    } catch (err) {
      console.error(err);
      setMsg({ kind: 'err', text: 'Could not generate the sheet. Please try again.' });
    }
  };

  const onUpload = async (req, e) => {
    const file = e.target.files?.[0];
    if (fileInputs.current[req.id]) fileInputs.current[req.id].value = '';
    if (!file) return;
    setMsg(null);
    if (!live) { setMsg({ kind: 'warn', text: 'Dev session — uploading needs the live Firebase backend.' }); return; }

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      setMsg({ kind: 'err', text: 'Please upload the filled sheet as .xlsx, .xls or .csv.' });
      return;
    }
    setBusyId(req.id);
    try {
      const safe = file.name.replace(/[^\w.\- ]+/g, '_');
      const path = `report-sheets/${uid}/${req.id}/${Date.now()}_${safe}`;
      const snap = await uploadBytes(storageRef(storage, path), file, {
        contentType: file.type || 'application/octet-stream',
      });
      await updateDoc(doc(db, 'reportRequests', req.id), {
        status: 'Returned',
        returnedPath: snap.ref.fullPath,
        returnedName: file.name,
        returnedSize: file.size,
        returnedAt: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      });
      setMsg({ kind: 'ok', text: `${file.name} sent to admin. You can replace it any time before it's approved.` });
    } catch (ex) {
      console.error(ex);
      setMsg({
        kind: 'err',
        text: (ex?.code === 'storage/unauthorized' || ex?.code === 'permission-denied')
          ? 'Upload denied — ask your administrator to publish the latest security rules.'
          : 'Upload failed. Please try again.',
      });
    } finally { setBusyId(null); }
  };

  const downloadMyReturn = async (req) => {
    if (!req.returnedPath) return;
    setBusyId(req.id);
    try {
      const bytes = await getBytes(storageRef(storage, req.returnedPath));
      const url = URL.createObjectURL(new Blob([bytes]));
      const a = document.createElement('a');
      a.href = url; a.download = req.returnedName || 'work-log.xlsx'; a.click();
      URL.revokeObjectURL(url);
    } catch {
      setMsg({ kind: 'err', text: 'Could not download your returned sheet.' });
    } finally { setBusyId(null); }
  };

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: C.muted, fontSize: 13 }}>Loading your work sheets…</div>;
  }

  const inputStyle = {
    background: 'rgba(4,13,31,0.8)', border: `1px solid ${C.border}`, borderRadius: 8,
    padding: '7px 10px', color: C.text, fontSize: 11.5, outline: 'none',
    boxSizing: 'border-box', width: '100%',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ERPPanel>
        <ERPPanelHeader
          title="My Work Sheets"
          icon={FileText}
          action={<span style={{ fontSize: 11, color: C.muted }}>{sorted.length} request{sorted.length === 1 ? '' : 's'}</span>}
        />

        <div style={{
          display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 14px', borderRadius: 10,
          background: 'rgba(0,217,255,0.07)', border: `1px solid ${C.borderHi}`, color: C.cyan,
          fontSize: 11.5, margin: '0 18px 12px',
        }}>
          <Sparkles size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            Daily sheets are generated for you from your assigned work and check-in time — just tap Done / In progress / Pending and submit. Weekly &amp; monthly sheets still open in Excel.
          </span>
        </div>

        {msg && (
          <div style={{
            display: 'flex', gap: 8, alignItems: 'flex-start', margin: '0 18px 12px', padding: '10px 14px', borderRadius: 10, fontSize: 11.5,
            background: msg.kind === 'err' ? 'rgba(240,90,103,0.1)' : msg.kind === 'warn' ? 'rgba(245,185,66,0.1)' : 'rgba(24,199,122,0.1)',
            border: `1px solid ${msg.kind === 'err' ? 'rgba(240,90,103,0.35)' : msg.kind === 'warn' ? 'rgba(245,185,66,0.35)' : 'rgba(24,199,122,0.35)'}`,
            color: msg.kind === 'err' ? C.red : msg.kind === 'warn' ? C.amber : C.green,
          }}>
            {msg.kind === 'ok' ? <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: 1 }} /> : <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />}
            {msg.text}
          </div>
        )}

        {sorted.length === 0 ? (
          <StaffEmpty
            icon="📄"
            from="#00D9FF" to="#0066FF"
            title="No work sheets requested yet"
            sub="When your admin sends a daily auto sheet or a Weekly/Monthly work-log sheet, it will appear here."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {sorted.map((req, i) => {
              const d = drafts[req.id];
              const isAuto = !!req.auto;
              const sub = myUpdates.find(u => u.sheetId === req.id);
              const doneCount = d ? d.rows.filter(r => r.status === 'Completed').length : 0;
              const totalCount = d ? d.rows.filter(r => r.description.trim()).length : 0;
              const locked = req.status === 'Approved';

              return (
                <div
                  key={req.id}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 10,
                    padding: '16px 18px', borderTop: i > 0 ? `1px solid ${C.border}30` : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <Calendar size={15} color={C.blue} />
                    <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>
                      {isAuto ? 'Daily Auto Work Sheet' : req.period === 'week' ? 'Weekly Work Sheet' : 'Monthly Work Sheet'}
                    </span>
                    <span style={{ fontSize: 11.5, color: C.subtle }}>
                      {req.rangeLabel || `${req.rangeStart} → ${req.rangeEnd}`}
                    </span>
                    {isAuto && (
                      <span style={{
                        fontSize: 9.5, fontWeight: 800, padding: '2px 8px', borderRadius: 20,
                        background: 'rgba(139,92,246,0.14)', color: C.violet, border: '1px solid rgba(139,92,246,0.35)',
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                      }}>
                        <Sparkles size={9} /> auto-filled
                      </span>
                    )}
                    <span style={{
                      fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
                      background: `${statusColor(req.status)}22`, color: statusColor(req.status),
                      border: `1px solid ${statusColor(req.status)}55`,
                    }}>
                      {req.status || 'Requested'}
                    </span>
                    <div style={{ flex: 1 }} />
                    <span style={{ fontSize: 10.5, color: C.muted, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={11} /> sent {fmtWhen(req.requestedAt)}
                    </span>
                  </div>

                  {req.note && (
                    <div style={{ fontSize: 11.5, color: C.amber, padding: '6px 10px', borderRadius: 6, background: 'rgba(245,185,66,0.06)', border: '1px solid rgba(245,185,66,0.18)' }}>
                      <strong>Note from admin:</strong> {req.note}
                    </div>
                  )}

                  {/* ── AUTO SHEET — tap to mark, nothing to type ── */}
                  {isAuto && d && (
                    <div style={{
                      borderRadius: 12, border: `1px solid ${C.borderHi}`,
                      background: 'rgba(10,24,56,0.45)', padding: 12,
                      display: 'flex', flexDirection: 'column', gap: 10,
                    }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: 10.5, fontWeight: 800, color: C.cyan, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                          Today · {getDayName(req.rangeStart || todayKey())} {req.rangeStart || todayKey()}
                        </span>
                        <span style={{ fontSize: 10.5, color: C.subtle }}>
                          {d.rows.length} item{d.rows.length === 1 ? '' : 's'} · <strong style={{ color: C.green }}>{doneCount}</strong>/{totalCount || d.rows.length} done
                        </span>
                        <div style={{ flex: 1 }} />
                        {totalCount > 0 && (
                          <div style={{ width: 110, height: 6, borderRadius: 6, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                            <div style={{
                              width: `${Math.round((doneCount / Math.max(totalCount, 1)) * 100)}%`, height: '100%',
                              background: 'linear-gradient(90deg,#18C77A,#00D9FF)', transition: 'width .2s',
                            }} />
                          </div>
                        )}
                      </div>

                      {/* Header + attendance, prefilled from the staff profile / check-in */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 800, color: C.muted, textTransform: 'uppercase', marginBottom: 3 }}>Name</div>
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: C.text }}>{staffName || req.staffName || '—'}</div>
                          <div style={{ fontSize: 9.5, color: C.muted }}>{staffPosition || req.position || 'Staff'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 800, color: C.muted, textTransform: 'uppercase', marginBottom: 3 }}>Location</div>
                          <input value={d.location} disabled={locked}
                            onChange={e => patchDraft(req.id, { location: e.target.value })}
                            style={inputStyle} />
                        </div>
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 800, color: C.muted, textTransform: 'uppercase', marginBottom: 3 }}>Work mode</div>
                          <select value={d.workMode} disabled={locked}
                            onChange={e => patchDraft(req.id, { workMode: e.target.value })}
                            style={{ ...inputStyle, cursor: 'pointer' }}>
                            {['On-Site / Office', 'Remote / WFH', 'Hybrid'].map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 800, color: C.muted, textTransform: 'uppercase', marginBottom: 3 }}>Arrival</div>
                          <input type="time" value={d.arrival} disabled={locked}
                            onChange={e => patchDraft(req.id, { arrival: e.target.value })} style={inputStyle} />
                        </div>
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 800, color: C.muted, textTransform: 'uppercase', marginBottom: 3 }}>Lunch</div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <input type="time" value={d.lunchStart} disabled={locked}
                              onChange={e => patchDraft(req.id, { lunchStart: e.target.value })} style={inputStyle} />
                            <input type="time" value={d.lunchEnd} disabled={locked}
                              onChange={e => patchDraft(req.id, { lunchEnd: e.target.value })} style={inputStyle} />
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 800, color: C.muted, textTransform: 'uppercase', marginBottom: 3 }}>Departure</div>
                          <input type="time" value={d.departure} disabled={locked}
                            onChange={e => patchDraft(req.id, { departure: e.target.value })} style={inputStyle} />
                        </div>
                      </div>

                      {/* Work rows */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {d.rows.map((r, idx) => {
                          const chip = STATUS_CHIP[r.status] || STATUS_CHIP.Pending;
                          return (
                            <div key={r.key} style={{
                              display: 'flex', flexDirection: 'column', gap: 6,
                              padding: '9px 10px', borderRadius: 10,
                              background: r.status === 'Completed' ? 'rgba(24,199,122,0.06)' : 'rgba(255,255,255,0.035)',
                              border: `1px solid ${r.status === 'Completed' ? 'rgba(24,199,122,0.28)' : C.border + '60'}`,
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span style={{
                                  width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 9.5, fontWeight: 900,
                                  background: r.locked ? 'rgba(0,217,255,0.12)' : 'rgba(255,255,255,0.06)',
                                  color: r.locked ? C.cyan : C.muted,
                                }}>{idx + 1}</span>
                                {r.locked && (
                                  <span style={{ fontSize: 8.5, fontWeight: 800, color: C.cyan, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                    <Hammer size={9} /> assigned
                                  </span>
                                )}
                                <span style={{ fontSize: 10, color: C.muted }}>
                                  {r.start}–{r.end} · {calculateTaskDuration(r.start, r.end)}
                                </span>
                                <div style={{ flex: 1 }} />
                                <span style={{
                                  fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 20,
                                  background: chip.bg, color: chip.color, border: `1px solid ${chip.border}`,
                                }}>{chip.label}</span>
                                {!r.locked && !locked && (
                                  <button type="button" onClick={() => removeRow(req.id, r.key)} title="Remove this row"
                                    style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: 2 }}>
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                              <input
                                value={r.description}
                                disabled={locked}
                                placeholder="Work description…"
                                onChange={e => patchRow(req.id, r.key, { description: e.target.value })}
                                style={{ ...inputStyle, fontSize: 12, fontWeight: 600 }}
                              />
                              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                {TASK_STATUSES.map(s => {
                                  const c = STATUS_CHIP[s];
                                  const on = r.status === s;
                                  return (
                                    <button
                                      key={s}
                                      type="button"
                                      disabled={locked}
                                      onClick={() => patchRow(req.id, r.key, { status: s })}
                                      style={{
                                        padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 800,
                                        cursor: locked ? 'default' : 'pointer', transition: 'all .12s',
                                        background: on ? c.bg : 'transparent',
                                        color: on ? c.color : C.muted,
                                        border: `1px solid ${on ? c.border : C.border + '70'}`,
                                        opacity: locked ? 0.6 : 1,
                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                      }}
                                    >
                                      {on && <Check size={9} />}{c.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {!locked && (
                        <button type="button" onClick={() => addRow(req.id)}
                          style={{
                            alignSelf: 'flex-start', padding: '5px 11px', borderRadius: 8, fontSize: 10.5, fontWeight: 800,
                            cursor: 'pointer', background: 'rgba(0,102,255,0.12)', color: C.cyan, border: `1px solid ${C.borderHi}`,
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                          }}>
                          <Plus size={11} /> Extra work (optional)
                        </button>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 800, color: C.muted, textTransform: 'uppercase', marginBottom: 3 }}>Remarks (optional)</div>
                          <input value={d.remarks} disabled={locked} placeholder="Blockers, notes…"
                            onChange={e => patchDraft(req.id, { remarks: e.target.value })}
                            style={{ ...inputStyle, fontSize: 11.5, color: C.subtle }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 800, color: C.violet, textTransform: 'uppercase', marginBottom: 3 }}>Plan for tomorrow (optional)</div>
                          <input value={d.planTomorrow} disabled={locked} placeholder="Carried to tomorrow's auto sheet"
                            onChange={e => patchDraft(req.id, { planTomorrow: e.target.value })}
                            style={{ ...inputStyle, fontSize: 11.5, color: C.subtle }} />
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <ERPBtn variant="primary" disabled={locked || busyId === req.id} onClick={() => submitAuto(req)}>
                          <Send size={13} /> {busyId === req.id ? 'Sending…' : d.submitted ? 'Update my marks' : 'Submit today\'s sheet'}
                        </ERPBtn>
                        <ERPBtn variant="secondary" onClick={() => downloadSheet(req)}>
                          <Download size={13} /> Excel copy
                        </ERPBtn>
                        {sub && (
                          <span style={{ fontSize: 10.5, color: C.green, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle2 size={11} /> sent {fmtWhen(sub.submittedAt || sub.createdAt)}
                            {req.status === 'Approved' ? ' · approved' : ' · waiting for admin'}
                          </span>
                        )}
                        {!sub && req.status === 'Requested' && (
                          <span style={{ fontSize: 10.5, color: C.muted }}>
                            Nothing to type — just tick the status of each item.
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── Excel sheet (weekly / monthly, or manual copy) ── */}
                  {!isAuto && (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <ERPBtn variant="primary" onClick={() => downloadSheet(req)}>
                        <Download size={13} /> Download Sheet
                      </ERPBtn>

                      <input
                        ref={el => { fileInputs.current[req.id] = el; }}
                        type="file"
                        accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                        style={{ display: 'none' }}
                        onChange={e => onUpload(req, e)}
                      />
                      <ERPBtn
                        variant={req.returnedPath ? 'secondary' : 'primary'}
                        disabled={busyId === req.id}
                        onClick={() => fileInputs.current[req.id]?.click()}
                      >
                        {req.returnedPath ? <Upload size={13} /> : <Send size={13} />}
                        {busyId === req.id ? 'Uploading…' : (req.returnedPath ? 'Replace / send again' : 'Upload filled sheet & send')}
                      </ERPBtn>

                      {req.returnedPath && (
                        <button
                          type="button"
                          onClick={() => downloadMyReturn(req)}
                          style={{
                            background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`, borderRadius: 10,
                            color: C.cyan, padding: '9px 14px', fontSize: 12, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700,
                          }}
                        >
                          <Download size={13} /> My copy
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ERPPanel>
    </div>
  );
}
