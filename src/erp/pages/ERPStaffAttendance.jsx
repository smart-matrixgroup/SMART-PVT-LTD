// ─────────────────────────────────────────────────────────────────
//  Phase 3 E — Attendance (admin side).
//  Portal staff check in/out themselves; admins here can filter by
//  date/staff, fix times manually, and download Daily / Monthly /
//  Staff-wise reports as CSV or printable PDF.
// ─────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, deleteObject } from 'firebase/storage';
import { db, storage, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { ERPPanel, ERPPanelHeader, ERPBadge, ERPBtn, ERPModal, ERPInput, ERPSelect, ERPTextarea, ERPEmpty, ERPAvatar, C } from '../components/ERPui';
import { rulesNotice } from '../rulesNotice';
import PrivateImage from '../components/PrivateImage';
import PrivateFileLink from '../components/PrivateFileLink';
import { leaveDateList, leaveDays, letterDate } from '../../staff/leaveLetter';
import {
  attendanceStatus, minutesBetween, fmtTime, fmtHours, downloadCsv,
  todayKey, thisMonthKey, monthLabel, periodRange, expectedWorkdays, dayLabel,
  getDayName, addDaysIso, toMs,
} from '../../staff/staffUtils';
import { company } from '../../config/company';
import { saveTablePdf } from '../utils/reportPdf';
import {
  getStaffCheckInPublicUrl, generateStaffCheckInQRCodeDataUrl, downloadStaffCheckInQRPng,
} from '../../utils/qrUtils';
import { Pencil, AlertTriangle, Download, Printer, QrCode, ExternalLink, Copy, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';

const AVATAR_COLORS = ['#0066FF', '#8B5CF6', '#18C77A', '#F5B942', '#F05A67', '#00D9FF'];

// Dev preview shows no invented attendance rows.
const DEV_ATT = [];

const REPORT_HEADERS = ['Date', 'Staff', 'Check In', 'Check Out', 'Hours', 'Status'];
const ATT_PDF_COLUMNS = [
  { label: 'DATE', width: 12 },
  { label: 'STAFF', width: 27, wrap: true },
  { label: 'CHECK IN', width: 10, align: 'center' },
  { label: 'CHECK OUT', width: 10, align: 'center' },
  { label: 'HOURS', width: 9, align: 'center' },
  { label: 'STATUS', width: 12, align: 'center' },
];
const reportRows = records => records.map(r => [
  r.date,
  r.staffName,
  r.checkInMs ? fmtTime(r.checkInMs) : '—',
  r.checkOutMs ? fmtTime(r.checkOutMs) : '—',
  fmtHours(minutesBetween(r.checkInMs, r.checkOutMs)),
  r.status || attendanceStatus(r.checkInMs, r.checkOutMs) || '—',
]);

// Per-staff statement (week / month / year / full) — the day name is in the
// row because a weekly statement is read Monday to Sunday.
const STMT_HEADERS = ['Date', 'Day', 'Check In', 'Check Out', 'Hours', 'Status'];
const STMT_PDF_COLUMNS = [
  { label: 'DATE', width: 13 },
  { label: 'DAY', width: 8, align: 'center' },
  { label: 'CHECK IN', width: 11, align: 'center' },
  { label: 'CHECK OUT', width: 11, align: 'center' },
  { label: 'HOURS', width: 10, align: 'center' },
  { label: 'STATUS', width: 13, align: 'center' },
];
const statusOf = r => r.status || attendanceStatus(r.checkInMs, r.checkOutMs) || '—';
const stmtRows = records => records.map(r => [
  dayLabel(r.date),
  getDayName(r.date).slice(0, 3),
  r.checkInMs ? fmtTime(r.checkInMs) : '—',
  r.checkOutMs ? fmtTime(r.checkOutMs) : '—',
  fmtHours(minutesBetween(r.checkInMs, r.checkOutMs)),
  statusOf(r),
]);

export default function ERPStaffAttendance() {
  const { isFirebaseConfigured, isDevSession, currentUser } = useAuth();
  const live = isFirebaseConfigured && !isDevSession;
  const adminName = currentUser?.displayName || currentUser?.email || 'Admin';

  const [records,  setRecords]  = useState([]);
  const [staff,    setStaff]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [dateF,    setDateF]    = useState(todayKey());
  const [staffF,   setStaffF]   = useState('All');
  const [monthF,   setMonthF]   = useState(thisMonthKey());
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ date: '', in: '', out: '' });
  const [preview,  setPreview]  = useState(null); // {title, rows}
  const [busy,     setBusy]     = useState(false);

  // ── Per-staff attendance statement (week / month / year / full) ──
  const [stStaff, setStStaff] = useState('All');
  const [stMode,  setStMode]  = useState('month');   // week | month | year | all
  const [stWeek,  setStWeek]  = useState(todayKey());
  const [stMonth, setStMonth] = useState(thisMonthKey());
  const [stYear,  setStYear]  = useState(String(new Date().getFullYear()));

  // ── Leave applications sent from the staff portal ──
  const [leaves,    setLeaves]    = useState([]);
  const [leavesErr, setLeavesErr] = useState('');
  const [lvFilter,  setLvFilter]  = useState('Pending');
  const [lvTarget,  setLvTarget]  = useState(null);
  const [lvNote,    setLvNote]    = useState('');
  const [lvErr,     setLvErr]     = useState('');
  const [lvBusy,    setLvBusy]    = useState(false);
  // Deleting a leave application (a test record, or one the staff member
  // withdrew) — its painted letter goes with it.
  const [lvDel,     setLvDel]     = useState(null);
  const [lvDelBusy, setLvDelBusy] = useState(false);
  const [lvDelErr,  setLvDelErr]  = useState('');

  // Deleting an attendance punch (a test check-in, or a wrong day) —
  // admins only; the staff member keeps their own punches.
  const [attDel,     setAttDel]     = useState(null);
  const [attDelBusy, setAttDelBusy] = useState(false);
  const [attDelErr,  setAttDelErr]  = useState('');

  // Office attendance QR — staff scan this at the office entrance.
  const [checkInQr, setCheckInQr] = useState(null);
  const checkInUrl = getStaffCheckInPublicUrl();

  useEffect(() => {
    let mounted = true;
    generateStaffCheckInQRCodeDataUrl({ width: 640 }).then(dataUrl => {
      if (mounted && dataUrl) setCheckInQr(dataUrl);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!live) {
      setRecords(DEV_ATT);
      setStaff([]);
      setLoading(false);
      return;
    }
    const unsubs = [
      onSnapshot(collection(db, 'attendance'),
        snap => { setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
        err => { console.error(err); setLoadError(`Attendance — ${err.message}`); setLoading(false); }),
      onSnapshot(collection(db, 'staff'),
        snap => setStaff(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.deleted)),
        err => console.error(err)),
      onSnapshot(collection(db, 'leaves'),
        snap => { setLeaves(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLeavesErr(''); },
        err => {
          console.error(err);
          setLeavesErr(err.code === 'permission-denied'
            ? rulesNotice('Leave requests')
            : `Leave requests — ${err.message}`);
        }),
    ];
    return () => unsubs.forEach(u => u());
  }, [live]);

  const filtered = records
    .filter(r => r.date === dateF)
    .filter(r => (staffF === 'All' ? true : r.staffId === staffF))
    .sort((a, b) => String(a.staffName || '').localeCompare(String(b.staffName || '')));

  // month-scoped records for the monthly / staff-wise reports
  const monthRecords = records
    .filter(r => (r.date || '').startsWith(monthF))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.staffName || '').localeCompare(String(b.staffName || '')));

  const runReport = kind => {
    const base = kind.replace('-pdf', ''); // CSV & PDF of a period share one preview
    let title = '', rows = [];
    if (base === 'daily') {
      title = `Daily Attendance — ${dateF}`;
      rows = reportRows(filtered);
    } else if (base === 'monthly') {
      title = `Monthly Attendance — ${monthLabel(monthF)}`;
      rows = reportRows(monthRecords);
    } else {
      const name = staffF === 'All' ? 'All Staff' : staff.find(s => s.id === staffF)?.name || staffF;
      title = `Staff-wise Attendance — ${name} — ${monthLabel(monthF)}`;
      rows = reportRows(monthRecords.filter(r => (staffF === 'All' ? true : r.staffId === staffF)));
    }
    const data = { title, rows };
    setPreview(data);
    // "-pdf" now produces the file straight away (still shows the preview).
    if (kind.endsWith('-pdf')) savePreviewPdf(data);
  };

  const downloadPreview = () => {
    const stamp = preview.title.replace(/[^\w]+/g, '_');
    downloadCsv(`${stamp}.csv`, REPORT_HEADERS, preview.rows);
  };

  // A real .pdf file, not the browser print dialog.
  const savePreviewPdf = (data = preview) => {
    if (!data) return;
    const hours = data.rows.reduce((n, r) => n + (parseFloat(r[4]) || 0), 0);
    const present = data.rows.filter(r => /present/i.test(r[5])).length;
    const absent = data.rows.filter(r => /absent/i.test(r[5])).length;
    saveTablePdf({
      title: data.title,
      subtitle: `${data.rows.length} attendance record${data.rows.length === 1 ? '' : 's'}`,
      columns: ATT_PDF_COLUMNS,
      rows: data.rows,
      summary: [
        { label: 'Records', value: String(data.rows.length) },
        { label: 'Total hours', value: `${Math.round(hours * 10) / 10}` },
        { label: 'Present', value: String(present) },
        { label: 'Absent', value: String(absent) },
      ],
      statusCol: 5,
      footNote: 'Check-in and check-out punches come from the office attendance QR / staff portal. Manual corrections by an admin are included.',
      generatedBy: adminName,
    }, `${data.title.replace(/[^\w]+/g, '-')}.pdf`);
  };

  // ── Full attendance statement: any staff member, week / month / year / all ──
  const shiftMonthKey = (key, n) => {
    const [y, m] = String(key || thisMonthKey()).split('-').map(Number);
    const d = new Date(y, (m || 1) - 1 + n, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const stNameOf = id => (id === 'All' ? 'All Staff' : staff.find(s => s.id === id)?.name || id);
  const stBase  = records.filter(r => (stStaff === 'All' ? true : r.staffId === stStaff));
  const stDates = stBase.map(r => String(r.date || '')).filter(Boolean).sort();
  const stYears = Array.from(new Set(stDates.map(d => d.slice(0, 4)))).sort().reverse();
  const stAnchor = stMode === 'week' ? stWeek : stMode === 'month' ? stMonth : stMode === 'year' ? stYear : '';
  const stRange  = periodRange(stMode, stAnchor);
  // 'Full' has no fixed bounds, so it runs from the first punch on record to
  // the last one this person has.
  const stFrom = stRange.from || (stDates[0] || '');
  const stTo   = stRange.to   || (stDates[stDates.length - 1] || '');
  const stHits = stBase
    .filter(r => (!stFrom || String(r.date) >= stFrom) && (!stTo || String(r.date) <= stTo))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  // Approved leave is overlaid on the statement, so a working day with no
  // punch says "Approved leave" instead of the vaguer "Not recorded".
  // Keyed 'staffUid|yyyy-mm-dd' — the staff portal writes staffUid.
  const approvedLeaveMap = {};
  leaves.filter(l => l.status === 'Approved').forEach(l => {
    const uid = l.staffUid || l.staffId || '';
    leaveDateList(l.from, l.to).forEach(d => { approvedLeaveMap[`${uid}|${d}`] = l; });
  });
  const leaveCover = d => (stStaff === 'All' ? null : approvedLeaveMap[`${stStaff}|${d}`] || null);

  // Office is closed Sundays, so a Mon–Sat day with no punch is worth naming
  // instead of quietly missing from the statement. 'Full' skips this because
  // the history starts wherever the first record starts.
  const stMissing = stMode === 'all'
    ? []
    : expectedWorkdays(stFrom, stTo).filter(d => !stHits.some(r => String(r.date) === d));
  const stLeaveDays = stMissing.filter(d => leaveCover(d));
  const stNoPunch   = stMissing.filter(d => !leaveCover(d));

  const stRows = [
    ...stHits.map(r => ({ date: r.date, missing: false, cells: stmtRows([r])[0] })),
    ...stMissing.map(d => {
      const lv = leaveCover(d);
      return {
        date: d, missing: true, onLeave: !!lv,
        cells: [dayLabel(d), getDayName(d).slice(0, 3), '—', '—', '—',
          lv ? 'Approved leave' : 'Not recorded'],
      };
    }),
  ].sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const stTotalMin = stHits.reduce((n, r) => n + minutesBetween(r.checkInMs, r.checkOutMs), 0);
  const stCount = label => stHits.filter(r => statusOf(r) === label).length;
  const stStats = [
    { label: 'Days present',  value: stCount('Present'),   color: C.green },
    { label: 'Late entries',  value: stCount('Late'),      color: C.amber },
    { label: 'Half days',     value: stCount('Half Day'),  color: C.amber },
    { label: 'Marked absent', value: stCount('Absent'),    color: C.red },
    { label: 'Approved leave', value: stLeaveDays.length,  color: C.cyan },
    { label: 'Not recorded',  value: stNoPunch.length,     color: C.muted },
    { label: 'Total hours',   value: Math.round((stTotalMin / 60) * 10) / 10, color: C.cyan },
  ];

  const stStep = dir => {
    if (stMode === 'week')  setStWeek(addDaysIso(stWeek, dir * 7));
    if (stMode === 'month') setStMonth(shiftMonthKey(stMonth, dir));
    if (stMode === 'year')  setStYear(String(Number(stYear) + dir));
  };

  const statementFileName = `Attendance-${stNameOf(stStaff).replace(/[^\w]+/g, '-')}-${stMode}-${stFrom || 'all'}`;

  const statementPdf = () => {
    saveTablePdf({
      title: `Attendance Statement — ${stNameOf(stStaff)}`,
      subtitle: `${stMode === 'all' ? 'Full record' : stRange.label}${stFrom ? ` · ${dayLabel(stFrom)} → ${dayLabel(stTo)}` : ''}`,
      meta: [
        `Staff: ${stNameOf(stStaff)}`,
        `Period: ${stMode === 'all' ? 'All records' : stRange.label}`,
        `Records: ${stHits.length} · Approved leave days: ${stLeaveDays.length} · Days not recorded: ${stNoPunch.length}`,
      ],
      columns: STMT_PDF_COLUMNS,
      rows: stRows.map(r => r.cells),
      summary: [
        { label: 'Days present', value: String(stCount('Present')) },
        { label: 'Late', value: String(stCount('Late')) },
        { label: 'Half days', value: String(stCount('Half Day')) },
        { label: 'Approved leave', value: String(stLeaveDays.length) },
        { label: 'Total hours', value: String(Math.round((stTotalMin / 60) * 10) / 10) },
      ],
      statusCol: 5,
      footNote: 'Check-in / check-out punches come from the office attendance QR or the staff portal; manual corrections by an admin are included. "Approved leave" is a working day covered by a leave application the admin approved. "Not recorded" is a working day (Mon–Sat) with no punch for this staff member.',
      generatedBy: adminName,
    }, `${statementFileName}.pdf`);
  };

  const statementCsv = () => {
    downloadCsv(`${statementFileName}.csv`, STMT_HEADERS, stRows.map(r => r.cells));
  };

  // ── Leave applications from the staff portal ──────────────────────
  // The staff member draws their letter, it lands here as a PNG (private
  // storage path) and the admin's decision is appended to the doc's history —
  // the original application is never rewritten.
  const lvCounts = ['Pending', 'Approved', 'Rejected']
    .map(label => ({ label, count: leaves.filter(l => (l.status || 'Pending') === label).length }));
  const lvList = leaves
    .filter(l => (lvFilter === 'All' ? true : (l.status || 'Pending') === lvFilter))
    .sort((a, b) => {
      const byStatus = String(a.status || 'Pending').localeCompare(String(b.status || 'Pending'));
      if (byStatus !== 0) return byStatus;
      return String(b.from || '').localeCompare(String(a.from || ''));
    });

  const openLeave = l => {
    setLvTarget(l);
    setLvNote(l.adminNote || '');
    setLvErr('');
  };

  const reviewLeave = async decision => {
    if (!lvTarget) return;
    const status = decision === 'approve' ? 'Approved' : 'Rejected';
    const note = String(lvNote || '').trim();
    setLvBusy(true);
    setLvErr('');
    try {
      const entry = {
        at: Date.now(),
        by: adminName,
        text: `${status} · ${status === 'Approved' ? 'Leave approved' : 'Leave not approved'}${note ? ` — ${note}` : ''}`,
      };
      const payload = {
        status,
        adminNote: note,
        reviewedBy: adminName,
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        history: [...(Array.isArray(lvTarget.history) ? lvTarget.history : []), entry],
      };
      if (!live) {
        setLeaves(p => p.map(l => (l.id === lvTarget.id ? { ...l, ...payload, reviewedAt: entry.at } : l)));
      } else {
        await updateDoc(doc(db, 'leaves', lvTarget.id), payload);
      }
      setLvTarget(null);
      setLvNote('');
    } catch (e) {
      console.error(e);
      setLvErr(e?.code === 'permission-denied'
        ? rulesNotice('This leave decision')
        : (e?.message || 'Could not save the decision.'));
    } finally {
      setLvBusy(false);
    }
  };

  // Remove an application and the letter files it painted. Test records the
  // admin filed while checking the flow live here — the Firestore rules
  // already allow admins to delete leaves, the Storage rules cover
  // staff-docs/{uid}/leave_*.
  const removeLeave = async () => {
    if (!lvDel) return;
    setLvDelBusy(true);
    setLvDelErr('');
    try {
      if (live) {
        const paths = [...(Array.isArray(lvDel.files) ? lvDel.files : []), lvDel.letter]
          .map(f => f?.path).filter(Boolean);
        await Promise.all(paths.map(p => deleteObject(storageRef(storage, p)).catch(() => {})));
        await deleteDoc(doc(db, 'leaves', lvDel.id));
      }
      setLeaves(p => p.filter(l => l.id !== lvDel.id));
      if (lvTarget?.id === lvDel.id) { setLvTarget(null); setLvNote(''); }
      setLvDel(null);
    } catch (e) {
      console.error(e);
      setLvDelErr(e?.code === 'permission-denied'
        ? rulesNotice('This delete')
        : (e?.message || "Couldn't delete the application."));
    } finally {
      setLvDelBusy(false);
    }
  };

  // One staff member's approved leave periods, shown under the request list.
  const lvNameOf = l => l.staffName || staff.find(s => s.id === (l.staffUid || l.staffId))?.name || l.staffUid || '—';
  const appliedAt = l => {
    const ms = toMs(l.createdAt) || toMs(l.updatedAt);
    return ms ? new Date(ms).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  };

  const openEdit = r => {
    setEditTarget(r);
    const t = ms => {
      if (!ms) return '';
      const x = new Date(ms);
      return `${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`;
    };
    setEditForm({ date: r.date, in: t(r.checkInMs), out: t(r.checkOutMs) });
  };

  const handleEditSave = async () => {
    setBusy(true);
    try {
      const toMsOfDay = (date, time) => (date && time ? new Date(`${date}T${time}:00`).getTime() : 0);
      const checkInMs = toMsOfDay(editForm.date, editForm.in);
      const checkOutMs = toMsOfDay(editForm.date, editForm.out);
      const payload = {
        date: editForm.date, checkInMs, checkOutMs,
        minutes: minutesBetween(checkInMs, checkOutMs),
        status: checkInMs ? (attendanceStatus(checkInMs, checkOutMs) || 'Present') : 'Absent',
        autoClosed: false, updatedAt: serverTimestamp(),
      };
      if (!live) setRecords(p => p.map(r => (r.id === editTarget.id ? { ...r, ...payload } : r)));
      else await updateDoc(doc(db, 'attendance', editTarget.id), payload);
      setEditTarget(null);
    } catch (e) { console.error(e); }
    finally { setBusy(false); }
  };

  // Delete one attendance record and close both the confirm and the editor.
  const removeAttendance = async () => {
    if (!attDel) return;
    setAttDelBusy(true);
    setAttDelErr('');
    try {
      if (live) await deleteDoc(doc(db, 'attendance', attDel.id));
      setRecords(p => p.filter(r => r.id !== attDel.id));
      setAttDel(null);
      setEditTarget(null);
    } catch (e) {
      console.error(e);
      setAttDelErr(e?.code === 'permission-denied'
        ? rulesNotice('This delete')
        : (e.message || "Couldn't delete the attendance record."));
    } finally {
      setAttDelBusy(false);
    }
  };

  const handlePrintCheckInQR = () => {
    if (!checkInQr) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>SMART Pvt Ltd — Office Attendance QR</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; text-align: center; margin: 0; padding: 40px; color: #040D1F; }
            .card { border: 2px solid #0066FF; border-radius: 22px; padding: 32px 30px; max-width: 420px; margin: 0 auto; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            .logo { height: 44px; margin-bottom: 8px; }
            .company { font-size: 16px; font-weight: 900; }
            .title { font-size: 21px; font-weight: 800; color: #0066FF; margin: 10px 0 4px; }
            .sub { font-size: 12px; color: #475569; margin-bottom: 14px; line-height: 1.5; }
            .qr-img { width: 265px; height: 265px; margin: 0 auto; display: block; border-radius: 12px; }
            .steps { font-size: 12px; font-weight: 700; margin-top: 14px; color: #040D1F; }
            .steps span { color: #0066FF; }
            .url { font-size: 10.5px; font-family: monospace; color: #64748B; margin-top: 12px; word-break: break-all; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="card">
            <img src="/logos/SMART_LOGO_LM.png" class="logo" alt="SMART Pvt Ltd" onerror="this.style.display='none'" />
            <div class="company">${company.fullName}</div>
            <div class="title">Office Attendance</div>
            <div class="sub">Scan with your phone, sign in with your staff email, and check in / check out.</div>
            <img src="${checkInQr}" class="qr-img" alt="Attendance QR" />
            <div class="steps">1. Scan &nbsp;•&nbsp; 2. Sign in &nbsp;•&nbsp; 3. Check In / Out</div>
            <div class="url">${checkInUrl}</div>
          </div>
          <script>window.onload = function() { window.print(); };</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: C.muted, fontSize: 13 }}>Loading attendance…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {loadError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10,
          background: 'rgba(240,90,103,0.1)', border: '1px solid rgba(240,90,103,0.35)', color: C.red, fontSize: 12 }}>
          <AlertTriangle size={14} /> {loadError}
        </div>
      )}

      {/* Office attendance QR — print / put up at the office entrance */}
      <ERPPanel>
        <ERPPanelHeader title="Office Attendance QR" icon={<QrCode size={15} style={{ color: C.cyan }} />}
          action={<span style={{
            fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
            background: 'rgba(0,217,255,0.12)', color: C.cyan, border: '1px solid rgba(0,217,255,0.3)',
          }}>Check-in only</span>} />
        <div style={{ padding: '18px 20px', display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ background: '#FFFFFF', padding: 12, borderRadius: 14, boxShadow: '0 8px 26px rgba(0,102,255,0.22)', flexShrink: 0 }}>
            {checkInQr ? (
              <img src={checkInQr} alt="Office attendance QR" style={{ width: 132, height: 132, display: 'block', borderRadius: 6 }} />
            ) : (
              <div style={{ width: 132, height: 132, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', fontSize: 10 }}>
                Generating…
              </div>
            )}
          </div>

          <div style={{ flex: '1 1 260px', minWidth: 220 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>Staff scan → sign in → check in / out</div>
            <div style={{ fontSize: 11.5, color: C.subtle, lineHeight: 1.65, marginTop: 4 }}>
              Print this QR and keep it at the office entrance. Staff scan it with their phone, sign in with
              their staff email and password, and only the check-in / check-out screen appears — no other portal pages.
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, padding: '7px 10px',
              borderRadius: 8, background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`,
            }}>
              <span style={{ fontSize: 10.5, fontFamily: 'monospace', color: C.subtle, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {checkInUrl}
              </span>
              <button onClick={() => navigator.clipboard?.writeText(checkInUrl)} title="Copy link"
                style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', display: 'flex', padding: 0 }}>
                <Copy size={12} />
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <ERPBtn size="sm" variant="primary" disabled={!checkInQr} onClick={() => downloadStaffCheckInQRPng(checkInQr)}>
                <Download size={12} /> Download PNG
              </ERPBtn>
              <ERPBtn size="sm" variant="secondary" disabled={!checkInQr} onClick={handlePrintCheckInQR}>
                <Printer size={12} /> Print
              </ERPBtn>
              <a href={checkInUrl} target="_blank" rel="noopener noreferrer" style={{
                padding: '6px 11px', borderRadius: 8, fontSize: 10.5, fontWeight: 700, textDecoration: 'none',
                background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`, color: C.muted,
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <ExternalLink size={11} /> Open page
              </a>
            </div>
          </div>
        </div>
      </ERPPanel>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ width: 170 }}>
          <ERPInput label="Date" value={dateF} type="date" onChange={e => setDateF(e.target.value)} />
        </div>
        <div style={{ width: 190 }}>
          <ERPSelect label="Staff" value={staffF} onChange={e => setStaffF(e.target.value)}
            options={[{ value: 'All', label: 'All staff' }, ...staff.map(s => ({ value: s.id, label: s.name }))]} />
        </div>
      </div>

      {/* Day records */}
      <ERPPanel>
        <ERPPanelHeader title={`Attendance — ${dateF}`} icon="🕒"
          action={<span style={{ fontSize: 10, color: C.muted }}>{filtered.length} record{filtered.length === 1 ? '' : 's'}</span>} />
        {filtered.length === 0 ? (
          <ERPEmpty icon="🕒" title="No records for this day"
            sub="Staff check in/out from their portal appears here automatically." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Staff', 'Check In', 'Check Out', 'Hours', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.8px', color: C.muted, textAlign: 'left', background: 'rgba(10,24,56,0.5)',
                      borderBottom: `1px solid ${C.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,102,255,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ERPAvatar name={r.staffName} color={AVATAR_COLORS[(r.staffName || '?').length % AVATAR_COLORS.length]} size={24} />
                        <span style={{ fontSize: 12, color: C.subtle, fontWeight: 600 }}>{r.staffName}</span>
                      </div>
                    </td>
                    <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }}>
                      <span style={{ fontSize: 12, color: C.subtle }}>{fmtTime(r.checkInMs)}</span>
                    </td>
                    <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }}>
                      <span style={{ fontSize: 12, color: r.autoClosed ? C.amber : C.subtle }}>
                        {fmtTime(r.checkOutMs)}{r.autoClosed ? ' (auto)' : ''}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>
                        {fmtHours(minutesBetween(r.checkInMs, r.checkOutMs))}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }}>
                      <ERPBadge status={r.status === 'Present' ? 'Paid' : r.status === 'Late' ? 'Pending' : 'Rejected'}
                        label={r.status || '—'} />
                    </td>
                    <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }}>
                      <ERPBtn size="sm" variant="secondary" onClick={() => openEdit(r)}><Pencil size={12} /></ERPBtn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ERPPanel>

      {/* ── Attendance statement: one staff member, week / month / year / full ── */}
      <ERPPanel>
        <ERPPanelHeader title="Attendance Statement" icon="🗓"
          action={<span style={{ fontSize: 10, fontWeight: 800, color: C.cyan }}>
            {stMode === 'all' ? 'Full record' : stRange.label}
          </span>} />
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ width: 190 }}>
              <ERPSelect label="Staff member" value={stStaff} onChange={e => setStStaff(e.target.value)}
                options={[{ value: 'All', label: 'All staff' }, ...staff.map(s => ({ value: s.id, label: s.name }))]} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.subtle, marginBottom: 6 }}>Wise</label>
              <div style={{ display: 'flex', border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
                {[['week', 'Week'], ['month', 'Month'], ['year', 'Year'], ['all', 'Full']].map(([key, lbl]) => (
                  <button key={key} onClick={() => setStMode(key)} style={{
                    padding: '8px 14px', fontSize: 11, fontWeight: 800, cursor: 'pointer', border: 'none',
                    background: stMode === key ? 'rgba(0,217,255,0.16)' : 'transparent',
                    color: stMode === key ? C.cyan : C.muted,
                  }}>{lbl}</button>
                ))}
              </div>
            </div>

            {stMode === 'week' && (
              <div style={{ width: 170 }}>
                <ERPInput label="Any day of the week" value={stWeek} type="date"
                  onChange={e => setStWeek(e.target.value)} />
              </div>
            )}
            {stMode === 'month' && (
              <div style={{ width: 170 }}>
                <ERPInput label="Month" value={stMonth} type="month"
                  onChange={e => setStMonth(e.target.value)} />
              </div>
            )}
            {stMode === 'year' && (
              <div style={{ width: 140 }}>
                <ERPSelect label="Year" value={stYear} onChange={e => setStYear(e.target.value)}
                  options={(stYears.length ? stYears : [String(new Date().getFullYear())])
                    .map(y => ({ value: y, label: y }))} />
              </div>
            )}

            {stMode !== 'all' && (
              <div style={{ display: 'flex', gap: 6 }}>
                <ERPBtn size="sm" variant="secondary" onClick={() => stStep(-1)}><ChevronLeft size={13} /></ERPBtn>
                <ERPBtn size="sm" variant="secondary" onClick={() => stStep(1)}><ChevronRight size={13} /></ERPBtn>
              </div>
            )}

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <ERPBtn variant="primary" onClick={statementPdf} disabled={!stRows.length}>
                <Download size={12} /> Statement PDF
              </ERPBtn>
              <ERPBtn variant="secondary" onClick={statementCsv} disabled={!stRows.length}>
                <Download size={12} /> CSV
              </ERPBtn>
            </div>
          </div>

          {/* Period totals for the person above */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {stStats.map(s => (
              <div key={s.label} style={{
                padding: '7px 12px', borderRadius: 9, background: 'rgba(10,24,56,0.7)',
                border: `1px solid ${C.border}40`, display: 'flex', alignItems: 'baseline', gap: 7,
              }}>
                <span style={{ fontSize: 13, fontWeight: 900, color: s.color }}>{s.value}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: C.muted }}>{s.label}</span>
              </div>
            ))}
          </div>

          {stRows.length === 0 ? (
            <div style={{ fontSize: 11.5, color: C.muted }}>
              No attendance in this period{stStaff !== 'All' ? ` for ${stNameOf(stStaff)}` : ''}.
            </div>
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {STMT_HEADERS.map(h => (
                      <th key={h} style={{ padding: '9px 14px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.8px', color: C.muted, textAlign: 'left',
                        background: 'rgba(10,24,56,0.5)', borderBottom: `1px solid ${C.border}`,
                        position: 'sticky', top: 0 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stRows.map((row, i) => (
                    <tr key={`${row.date}-${i}`}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,102,255,0.04)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      {row.cells.map((cell, j) => (
                        <td key={j} style={{
                          padding: '10px 14px', borderTop: `1px solid ${C.border}20`, fontSize: 12,
                          color: row.missing ? C.muted : (j === 4 ? C.text : C.subtle),
                          fontWeight: j === 4 ? 700 : 600,
                          opacity: row.missing ? 0.8 : 1,
                        }}>
                          {j === 5
                            ? <ERPBadge status={cell === 'Present' ? 'Paid' : cell === 'Absent' ? 'Rejected' : cell === 'Late' || cell === 'Half Day' ? 'Pending' : cell === 'Approved leave' ? 'on-leave' : 'archived'} label={cell} />
                            : cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </ERPPanel>

      {/* ── Leave requests filed from the staff portal ── */}
      <ERPPanel>
        <ERPPanelHeader title="Leave Requests" icon="📝"
          action={
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[['Pending', 'Pending'], ['Approved', 'Approved'], ['Rejected', 'Rejected'], ['All', 'All']]
                .map(([key, lbl]) => (
                  <button key={key} onClick={() => setLvFilter(key)} style={{
                    padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 800, cursor: 'pointer',
                    border: `1px solid ${lvFilter === key ? 'rgba(0,217,255,0.45)' : C.border}`,
                    background: lvFilter === key ? 'rgba(0,217,255,0.14)' : 'transparent',
                    color: lvFilter === key ? C.cyan : C.muted,
                  }}>
                    {lbl}{key === 'All' ? '' : ` (${lvCounts.find(c => c.label === key)?.count || 0})`}
                  </button>
                ))}
            </div>
          } />
        {leavesErr && (
          <div style={{ margin: '0 16px 12px', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
            borderRadius: 10, background: 'rgba(245,185,66,0.1)', border: '1px solid rgba(245,185,66,0.35)',
            color: C.amber, fontSize: 11.5 }}>
            <AlertTriangle size={14} /> {leavesErr}
          </div>
        )}
        {lvList.length === 0 ? (
          <ERPEmpty icon="📝" title={live ? `No ${lvFilter.toLowerCase()} leave applications` : 'Leave applications appear here'}
            sub={live ? 'Staff file these from their portal — Time → Leave Application.' : ''} />
        ) : (
          <div style={{ padding: '4px 0 8px' }}>
            {lvList.map(l => {
              const pending = (l.status || 'Pending') === 'Pending';
              return (
                <div key={l.id}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,102,255,0.04)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px',
                    borderTop: `1px solid ${C.border}20`, flexWrap: 'wrap' }}>
                  <ERPAvatar name={lvNameOf(l)} color={AVATAR_COLORS[String(lvNameOf(l)).length % AVATAR_COLORS.length]} size={26} />
                  <div style={{ minWidth: 150 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: C.text }}>{lvNameOf(l)}</div>
                    <div style={{ fontSize: 10, color: C.muted }}>{l.staffRole || l.staffId || '—'}</div>
                  </div>
                  <div style={{ minWidth: 170 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.subtle }}>{l.type || 'Leave'} · {l.days || leaveDays(l.from, l.to)} day{l.days === 1 ? '' : 's'}</div>
                    <div style={{ fontSize: 10.5, color: C.muted }}>{letterDate(l.from)} → {letterDate(l.to)}</div>
                  </div>
                  <div style={{ fontSize: 10.5, color: C.muted, minWidth: 110 }}>Applied {appliedAt(l)}</div>
                  {l.letter?.path || l.letter?.localUrl ? (
                    <span style={{ fontSize: 10, fontWeight: 800, color: C.cyan }}>Letter attached</span>
                  ) : (
                    <span style={{ fontSize: 10, fontWeight: 700, color: C.muted }}>No letter</span>
                  )}
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ERPBadge status={pending ? 'Pending' : l.status === 'Approved' ? 'Paid' : 'Rejected'} label={l.status || 'Pending'} />
                    <ERPBtn size="sm" variant={pending ? 'primary' : 'secondary'} onClick={() => openLeave(l)}>
                      <Pencil size={11} /> {pending ? 'Review' : 'Open'}
                    </ERPBtn>
                    <ERPBtn size="sm" variant="danger" onClick={() => { setLvDel(l); setLvDelErr(''); }}>
                      <Trash2 size={11} />
                    </ERPBtn>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ padding: '0 18px 14px', fontSize: 10, color: C.muted }}>
          Approved leave fills the matching days in the attendance statement above as "Approved leave".
        </div>
      </ERPPanel>

      {/* Reports */}
      <ERPPanel>
        <ERPPanelHeader title="Reports" icon="📊" />
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ width: 190 }}>
            <ERPInput label="Report Month" value={monthF} type="month" onChange={e => setMonthF(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <ERPBtn variant="secondary" onClick={() => runReport('daily')}><Download size={12} /> Daily CSV</ERPBtn>
            <ERPBtn variant="secondary" onClick={() => runReport("daily-pdf")}><Download size={12} /> Daily PDF</ERPBtn>
            <ERPBtn variant="secondary" onClick={() => runReport('monthly')}><Download size={12} /> Monthly CSV</ERPBtn>
            <ERPBtn variant="secondary" onClick={() => runReport("monthly-pdf")}><Download size={12} /> Monthly PDF</ERPBtn>
            <ERPBtn variant="secondary" onClick={() => runReport('staffwise')}><Download size={12} /> Staff-wise CSV</ERPBtn>
            <ERPBtn variant="secondary" onClick={() => runReport("staffwise-pdf")}><Download size={12} /> Staff-wise PDF</ERPBtn>
          </div>
          <div style={{ fontSize: 10, color: C.muted }}>
            CSV/PDF buttons for the same period share one preview — download CSV from the preview too. Daily uses the
            date filter above; Monthly / Staff-wise use the report month{staffF !== 'All' ? ' and selected staff' : ''}.
          </div>
        </div>
      </ERPPanel>

      {/* Edit modal */}
      <ERPModal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title="Fix Attendance" width={420}>
        {editTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            <div style={{ fontSize: 12, color: C.muted }}>
              {editTarget.staffName} — manual correction (hours and status are recalculated automatically).
            </div>
            <ERPInput label="Date" value={editForm.date} type="date"
              onChange={e => setEditForm(p => ({ ...p, date: e.target.value }))} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <ERPInput label="Check In" value={editForm.in} type="time"
                onChange={e => setEditForm(p => ({ ...p, in: e.target.value }))} />
              <ERPInput label="Check Out" value={editForm.out} type="time"
                onChange={e => setEditForm(p => ({ ...p, out: e.target.value }))} />
            </div>
            <div style={{ fontSize: 11, color: C.cyan }}>
              Hours: {fmtHours(minutesBetween(
                editForm.date && editForm.in ? new Date(`${editForm.date}T${editForm.in}:00`).getTime() : 0,
                editForm.date && editForm.out ? new Date(`${editForm.date}T${editForm.out}:00`).getTime() : 0))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <ERPBtn variant="secondary" onClick={() => setEditTarget(null)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</ERPBtn>
              <ERPBtn variant="primary" disabled={busy || !editForm.in} onClick={handleEditSave} style={{ flex: 1, justifyContent: 'center' }}>Save</ERPBtn>
            </div>
            {live && (
              <div style={{ display: 'flex', justifyContent: 'center', borderTop: `1px solid ${C.border}25`, paddingTop: 12 }}>
                <ERPBtn size="sm" variant="danger" onClick={() => { setAttDel(editTarget); setAttDelErr(''); }}>
                  <Trash2 size={11} /> Delete this record
                </ERPBtn>
              </div>
            )}
          </div>
        )}
      </ERPModal>

      {/* Delete one attendance record (test punches / wrong days) */}
      <ERPModal isOpen={!!attDel} onClose={() => setAttDel(null)} title="Delete Attendance Record?" width={420}>
        {attDel && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            <div style={{ fontSize: 12, color: C.subtle, lineHeight: 1.6 }}>
              <strong style={{ color: C.text }}>{attDel.staffName}</strong> — {attDel.date}<br />
              {fmtHours(attDel.minutes || 0)} · {attDel.status || 'Present'}
            </div>
            <div style={{ padding: '10px 12px', borderRadius: 10, fontSize: 11.5, lineHeight: 1.55,
              background: 'rgba(240,90,103,0.1)', border: '1px solid rgba(240,90,103,0.35)', color: C.red }}>
              The day disappears from the attendance list, the salary total and every report.
            </div>

            {attDelErr && (
              <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(245,185,66,0.1)',
                border: '1px solid rgba(245,185,66,0.35)', fontSize: 11, color: C.amber, lineHeight: 1.5 }}>
                {attDelErr}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <ERPBtn variant="secondary" onClick={() => setAttDel(null)} style={{ flex: 1, justifyContent: 'center' }}>Keep it</ERPBtn>
              <ERPBtn variant="danger" disabled={attDelBusy} onClick={removeAttendance} style={{ flex: 1, justifyContent: 'center' }}>
                <Trash2 size={12} /> {attDelBusy ? 'Deleting…' : 'Delete'}
              </ERPBtn>
            </div>
          </div>
        )}
      </ERPModal>

      {/* Leave application review — the painted letter + the decision */}
      <ERPModal isOpen={!!lvTarget} onClose={() => { setLvTarget(null); setLvErr(''); }}
        title={lvTarget ? `Leave Application — ${lvNameOf(lvTarget)}` : 'Leave Application'} width={880}>
        {lvTarget && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 380px) 1fr', gap: 20, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', color: C.muted }}>
                Application letter
              </div>
              <div style={{ padding: 12, borderRadius: 12, background: 'rgba(10,24,56,0.6)', border: `1px solid ${C.border}` }}>
                <PrivateImage file={lvTarget.letter} alt="Leave application letter" maxWidth={340} />
              </div>
              {(lvTarget.files || []).filter(f => f && f !== lvTarget.letter).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', color: C.muted }}>
                    Attachments
                  </div>
                  {lvTarget.files.filter(f => f && f !== lvTarget.letter).map((f, i) => (
                    <PrivateFileLink key={i} file={f} style={{ color: C.cyan }} />
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <ERPBadge status={(lvTarget.status || 'Pending') === 'Pending' ? 'Pending' : lvTarget.status === 'Approved' ? 'Paid' : 'Rejected'}
                  label={lvTarget.status || 'Pending'} />
                <span style={{ fontSize: 12, fontWeight: 800, color: C.text }}>
                  {lvTarget.type || 'Leave'} · {lvTarget.days || leaveDays(lvTarget.from, lvTarget.to)} day{(lvTarget.days || leaveDays(lvTarget.from, lvTarget.to)) === 1 ? '' : 's'}
                </span>
                <span style={{ fontSize: 11.5, color: C.subtle }}>{letterDate(lvTarget.from)} → {letterDate(lvTarget.to)}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 11.5 }}>
                {[
                  ['Staff', lvNameOf(lvTarget)],
                  ['Designation', lvTarget.staffRole || '—'],
                  ['Contact', lvTarget.contact || '—'],
                  ['Applied on', appliedAt(lvTarget)],
                ].map(([k, v]) => (
                  <div key={k} style={{ padding: '8px 11px', borderRadius: 9, background: 'rgba(10,24,56,0.6)', border: `1px solid ${C.border}40` }}>
                    <div style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', color: C.muted }}>{k}</div>
                    <div style={{ fontSize: 12, color: C.subtle, fontWeight: 600, marginTop: 2 }}>{v}</div>
                  </div>
                ))}
              </div>

              <div>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', color: C.muted, marginBottom: 5 }}>
                  Reason
                </div>
                <div style={{ fontSize: 12, color: C.subtle, lineHeight: 1.6, padding: '10px 12px', borderRadius: 9,
                  background: 'rgba(10,24,56,0.6)', border: `1px solid ${C.border}40`, whiteSpace: 'pre-wrap' }}>
                  {lvTarget.reason || '—'}
                </div>
              </div>

              {lvTarget.handover && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', color: C.muted, marginBottom: 5 }}>
                    Work handover
                  </div>
                  <div style={{ fontSize: 12, color: C.subtle, lineHeight: 1.6 }}>{lvTarget.handover}</div>
                </div>
              )}

              <ERPTextarea label={lvTarget.status === 'Pending' ? 'Remarks for the staff member (optional)' : 'Remarks'}
                rows={3} value={lvNote} onChange={e => setLvNote(e.target.value)}
                placeholder="Reason for rejection, adjustment note, etc." />

              {lvErr && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 9,
                  background: 'rgba(240,90,103,0.1)', border: '1px solid rgba(240,90,103,0.35)', color: C.red, fontSize: 11.5 }}>
                  <AlertTriangle size={13} /> {lvErr}
                </div>
              )}

              {(Array.isArray(lvTarget.history) && lvTarget.history.length > 0) && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', color: C.muted, marginBottom: 6 }}>
                    History
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 132, overflowY: 'auto' }}>
                    {lvTarget.history.map((h, i) => (
                      <div key={i} style={{ fontSize: 11, color: C.muted, lineHeight: 1.5, paddingLeft: 9, borderLeft: `2px solid ${C.border}` }}>
                        {h.text}
                        <span style={{ color: C.subtle }}> — {h.by}, {h.at ? new Date(h.at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                <ERPBtn variant="success" disabled={lvBusy || lvTarget.status === 'Approved'} onClick={() => reviewLeave('approve')}>
                  Approve leave
                </ERPBtn>
                <ERPBtn variant="danger" disabled={lvBusy || lvTarget.status === 'Rejected'} onClick={() => reviewLeave('reject')}>
                  Reject
                </ERPBtn>
                <ERPBtn variant="secondary" onClick={() => { setLvTarget(null); setLvErr(''); }} style={{ marginLeft: 'auto' }}>
                  Close
                </ERPBtn>
              </div>
            </div>
          </div>
        )}
      </ERPModal>

      {/* Delete one leave application (and its letter files) */}
      <ERPModal isOpen={!!lvDel} onClose={() => { setLvDel(null); setLvDelErr(''); }}
        title="Delete Leave Application?" width={430}>
        {lvDel && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 12, color: C.subtle, lineHeight: 1.6 }}>
              <strong style={{ color: C.text }}>{lvNameOf(lvDel)}</strong> · {lvDel.type || 'Leave'} ·{' '}
              {letterDate(lvDel.from)}{lvDel.to && lvDel.to !== lvDel.from ? ` → ${letterDate(lvDel.to)}` : ''}
              <br />Status: {lvDel.status || 'Pending'}
            </div>
            <div style={{ padding: '10px 12px', borderRadius: 10, fontSize: 11, lineHeight: 1.6,
              background: 'rgba(240,90,103,0.08)', border: '1px solid rgba(240,90,103,0.3)', color: C.red }}>
              The application and its letter image are removed together. The staff member will have to apply again.
            </div>
            {lvDelErr && (
              <div style={{ padding: '10px 12px', borderRadius: 10, fontSize: 11, color: C.amber,
                background: 'rgba(245,185,66,0.1)', border: '1px solid rgba(245,185,66,0.35)', lineHeight: 1.5 }}>
                {lvDelErr}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <ERPBtn variant="secondary" onClick={() => { setLvDel(null); setLvDelErr(''); }} style={{ flex: 1, justifyContent: 'center' }}>
                Cancel
              </ERPBtn>
              <ERPBtn variant="danger" onClick={removeLeave} disabled={lvDelBusy} style={{ flex: 1, justifyContent: 'center' }}>
                <Trash2 size={12} /> {lvDelBusy ? 'Deleting…' : 'Delete'}
              </ERPBtn>
            </div>
          </div>
        )}
      </ERPModal>

      {/* Report preview (white printable doc) */}
      <ERPModal isOpen={!!preview} onClose={() => setPreview(null)} title="Report Preview" width={760}>
        {preview && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="report-print" style={{ background: '#fff', color: '#16233D', borderRadius: 10, padding: '26px 30px', fontFamily: 'Arial, sans-serif' }}>
              <style>{`
                @media print {
                  body * { visibility: hidden !important; }
                  .report-print, .report-print * { visibility: visible !important; }
                  .report-print { position: fixed; left: 0; top: 0; width: 100%; background: #fff; }
                }
              `}</style>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '3px solid #0066FF', paddingBottom: 12, marginBottom: 14 }}>
                <img src={company.logos.lightMode} alt="" style={{ height: 44, objectFit: 'contain' }}
                  onError={e => { e.currentTarget.style.display = 'none'; }} />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#0B1F44' }}>{company.fullName}</div>
                  <div style={{ fontSize: 12, color: '#5A6B8C' }}>{preview.title}</div>
                  <div style={{ fontSize: 10, color: '#5A6B8C' }}>{company.contact.address} · {company.contact.phone}</div>
                </div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr>
                    {REPORT_HEADERS.map(h => (
                      <th key={h} style={{ textAlign: 'left', background: '#0B1F44', color: '#fff', padding: '7px 10px', fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.length === 0 ? (
                    <tr><td colSpan={REPORT_HEADERS.length} style={{ border: '1px solid #D7DFEE', padding: '12px 10px', textAlign: 'center', color: '#5A6B8C' }}>
                      No records for this period.
                    </td></tr>
                  ) : preview.rows.map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j} style={{ border: '1px solid #D7DFEE', padding: '7px 10px' }}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 20, fontSize: 10, color: '#5A6B8C' }}>
                Generated by SMART ERP — {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <ERPBtn variant="secondary" onClick={downloadPreview} style={{ flex: 1, justifyContent: 'center' }}>
                <Download size={13} /> Download CSV
              </ERPBtn>
              <ERPBtn variant="primary" onClick={() => savePreviewPdf()} style={{ flex: 1, justifyContent: 'center' }}>
                <Download size={13} /> Save PDF
              </ERPBtn>
            </div>
          </div>
        )}
      </ERPModal>
    </div>
  );
}
