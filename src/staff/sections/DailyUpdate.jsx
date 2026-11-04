// ─────────────────────────────────────────────────────────────────
//  Staff Portal — Daily Routine Work Report Module.
//  Structured exactly as the standard SMART Pvt Ltd Daily Work Report:
//  • Top Header: Name, Position, Location, Date, Day, Work Mode.
//  • Attendance Bar: Arrival, Lunch Start, Lunch End, Lunch Duration,
//    Departure, Total Work Hours (auto-calculated).
//  • Routine Task Table: No, Start, End, Hours (auto), Work / Description,
//    Status (Completed / In Progress / Pending / On Hold).
//  • Remarks / Notes section.
//  • Every sheet downloads as a real branded PDF (dailyReportPdf.js) — the
//    browser print dialog is never opened.
//
//  On a phone the task breakdown turns into stacked cards: the seven-column
//  table cannot fit a 520 px screen, and the STATUS + remove column used to
//  sit past the right edge, unreachable.
// ─────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc,
  query, where, serverTimestamp
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { staffRulesNotice } from '../../erp/rulesNotice';
import { ERPPanel, ERPPanelHeader, ERPBtn, ERPModal, C } from '../../erp/components/ERPui';
import { saveDailyReportPdf, dailyReportTasksOf } from '../../erp/utils/dailyReportPdf';
import StaffEmpty from '../components/StaffEmpty';
import {
  toMs, todayKey, calculateTaskDuration, calculateAttendanceHours, getDayName
} from '../staffUtils';
import {
  Plus, Trash2, Send, AlertTriangle, CheckCircle2, Clock,
  Coffee, Check, Hourglass, Edit3, X, Calendar, Printer, FileText,
  Building, User, Briefcase, MapPin, Eye, ChevronDown
} from 'lucide-react';

const WORK_MODES = ['On-Site / Office', 'Remote / WFH', 'Hybrid'];
const TASK_STATUSES = ['Completed', 'In Progress', 'Pending', 'On Hold'];

// One task per row on a laptop: NO · START · END · HOURS · WORK · STATUS · remove.
const TASK_GRID = '40px minmax(84px, 1fr) minmax(84px, 1fr) 70px minmax(170px, 2.4fr) 132px 36px';

const cellField = { display: 'block', minWidth: 0 };
const cellLabel = { display: 'block', fontSize: 10, fontWeight: 700, color: C.muted, marginBottom: 4, minHeight: 12 };
const cellInput = {
  width: '100%', boxSizing: 'border-box', background: 'rgba(4,13,31,0.8)',
  border: `1px solid ${C.border}`, borderRadius: 6, padding: '7px 9px',
  color: C.text, fontSize: 11.5, outline: 'none',
};

// One task: a sheet row on a laptop, a wrapping card on a phone.
const rowBox = { display: 'grid', gridTemplateColumns: TASK_GRID, gap: 8, alignItems: 'center', padding: '8px 12px', minWidth: 620 };
const cardBox = {
  display: 'flex', flexWrap: 'wrap', gap: 10, padding: '14px 12px',
  background: 'rgba(10,24,56,0.35)', borderRadius: 10,
};

const INITIAL_TASK_ROW = {
  no: 1,
  start: '09:00',
  end: '10:30',
  hours: '1.5 hrs',
  description: '',
  status: 'Completed',
};

const DEV_REPORTS = [];

/** The portal is opened on phones as much as on laptops. */
const useNarrow = (px = 780) => {
  const read = () => (typeof window === 'undefined' ? false : window.innerWidth <= px);
  const [narrow, setNarrow] = useState(read);
  useEffect(() => {
    const onResize = () => setNarrow(read());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return narrow;
};

// Exact submission stamp (server time) shown on each saved report, so the
// staff member can see the date AND time their update reached the admin.
const submittedStampOf = (r) => {
  const ms = toMs(r?.submittedAt || r?.createdAt);
  if (!ms) return '';
  const d = new Date(ms);
  return `${d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })} · ` +
    `${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
};

export default function DailyUpdate() {
  const { staffProfile, isFirebaseConfigured, isDevSession } = useAuth();
  const live = isFirebaseConfigured && !isDevSession;
  const uid = staffProfile?.id || '';
  const narrow = useNarrow();

  const [reports,   setReports]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Deleting one filed report (a test entry) — its own confirm box, never
  // the browser's window.confirm.
  const [delTarget, setDelTarget] = useState(null);
  const [delBusy, setDelBusy] = useState(false);
  const [delErr, setDelErr] = useState('');

  // Form Fields
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState(staffProfile?.name || 'Staff Member');
  const [position, setPosition] = useState(staffProfile?.role || 'Software Associate');
  const [location, setLocation] = useState(staffProfile?.address ? `SMART ${staffProfile.address}` : 'SMART Trincomalee');
  const [date, setDate] = useState(todayKey());
  const [workMode, setWorkMode] = useState('On-Site / Office');

  // Attendance times
  const [arrival, setArrival] = useState('08:30');
  const [lunchStart, setLunchStart] = useState('13:00');
  const [lunchEnd, setLunchEnd] = useState('14:00');
  const [departure, setDeparture] = useState('17:30');

  // Tasks list
  const [tasks, setTasks] = useState([
    { no: 1, start: '09:00', end: '11:00', hours: '2.0 hrs', description: '', status: 'Completed' },
    { no: 2, start: '11:00', end: '13:00', hours: '2.0 hrs', description: '', status: 'Completed' },
    { no: 3, start: '14:00', end: '16:00', hours: '2.0 hrs', description: '', status: 'In Progress' },
  ]);

  const [remarks, setRemarks] = useState('');
  const [planTomorrow, setPlanTomorrow] = useState('');
  const [busy, setBusy] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Sync with user profile on load
  useEffect(() => {
    if (staffProfile) {
      if (staffProfile.name) setName(staffProfile.name);
      if (staffProfile.role) setPosition(staffProfile.role);
    }
  }, [staffProfile]);

  // Load from Firestore
  useEffect(() => {
    if (!live) {
      setReports(DEV_REPORTS);
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(
      query(collection(db, 'dailyUpdates'), where('authUid', '==', uid)),
      (snap) => {
        setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setLoadError(`Daily work reports — ${err.message}`);
        setLoading(false);
      }
    );
    return unsub;
  }, [live, uid]);

  // Compute attendance stats
  const { lunchDuration, totalWorkHours } = calculateAttendanceHours(arrival, lunchStart, lunchEnd, departure);
  const dayName = getDayName(date);

  // Task row handlers
  const handleTaskChange = (index, field, value) => {
    setTasks(prev => {
      const updated = [...prev];
      const row = { ...updated[index], [field]: value };
      if (field === 'start' || field === 'end') {
        row.hours = calculateTaskDuration(row.start, row.end);
      }
      updated[index] = row;
      return updated;
    });
  };

  const handleAddTaskRow = () => {
    setTasks(prev => {
      const nextNo = prev.length + 1;
      const lastRow = prev[prev.length - 1];
      const start = lastRow ? lastRow.end : '09:00';
      return [
        ...prev,
        {
          no: nextNo,
          start,
          end: '18:00',
          hours: calculateTaskDuration(start, '18:00'),
          description: '',
          status: 'Completed',
        }
      ];
    });
  };

  const handleRemoveTaskRow = (index) => {
    if (tasks.length <= 1) return;
    setTasks(prev => prev.filter((_, i) => i !== index).map((r, i) => ({ ...r, no: i + 1 })));
  };

  const handleResetForm = () => {
    setEditingId(null);
    setDate(todayKey());
    setArrival('08:30');
    setLunchStart('13:00');
    setLunchEnd('14:00');
    setDeparture('17:30');
    setTasks([
      { no: 1, start: '09:00', end: '11:00', hours: '2.0 hrs', description: '', status: 'Completed' },
      { no: 2, start: '11:00', end: '13:00', hours: '2.0 hrs', description: '', status: 'Completed' },
    ]);
    setRemarks('');
    setPlanTomorrow('');
    setErrorMsg(null);
  };

  const handleEditInit = (r) => {
    setEditingId(r.id);
    setName(r.name || staffProfile?.name || 'Staff');
    setPosition(r.position || staffProfile?.role || 'Associate');
    setLocation(r.location || 'SMART Trincomalee');
    setDate(r.date || todayKey());
    setWorkMode(r.workMode || 'On-Site / Office');
    setArrival(r.arrival || '08:30');
    setLunchStart(r.lunchStart || '13:00');
    setLunchEnd(r.lunchEnd || '14:00');
    setDeparture(r.departure || '17:30');
    setTasks(r.tasks && r.tasks.length > 0 ? r.tasks : [INITIAL_TASK_ROW]);
    setRemarks(r.remarks || r.notes || '');
    setPlanTomorrow(r.planTomorrow || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const cleanTasks = tasks.filter(t => t.description.trim().length > 0);
    if (cleanTasks.length === 0) {
      setErrorMsg('Please describe at least one task in the work table.');
      return;
    }

    setBusy(true);
    setErrorMsg(null);
    setSuccessMsg(false);

    try {
      const payload = {
        name: name.trim(),
        position: position.trim(),
        location: location.trim(),
        date,
        day: dayName,
        workMode,
        arrival,
        lunchStart,
        lunchEnd,
        lunchDuration,
        departure,
        totalWorkHours,
        tasks: cleanTasks,
        remarks: remarks.trim(),
        planTomorrow: planTomorrow.trim(),
        // Backwards compatibility fields for ERP dashboard
        staffId: uid,
        staffName: name.trim(),
        authUid: uid,
        workDescription: cleanTasks.map(t => `${t.start}-${t.end}: ${t.description}`).join(' | '),
        items: cleanTasks.map(t => t.description),
        status: cleanTasks.every(t => t.status === 'Completed') ? 'Completed' : 'Pending',
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        if (!live) {
          setReports(prev => prev.map(r => r.id === editingId ? { ...r, ...payload, updatedAt: Date.now() } : r));
        } else {
          await updateDoc(doc(db, 'dailyUpdates', editingId), payload);
        }
      } else {
        payload.createdAt = serverTimestamp();
        payload.submittedAt = serverTimestamp();
        if (!live) {
          setReports(p => [{ id: `rep-${Date.now()}`, ...payload, submittedAt: Date.now() }, ...p]);
        } else {
          await addDoc(collection(db, 'dailyUpdates'), payload);
        }
      }

      setSuccessMsg(true);
      setTimeout(() => setSuccessMsg(false), 4500);
      handleResetForm();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Submission failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!delTarget) return;
    setDelBusy(true);
    setDelErr('');
    try {
      if (live) await deleteDoc(doc(db, 'dailyUpdates', delTarget.id));
      setReports(prev => prev.filter(r => r.id !== delTarget.id));
      if (editingId === delTarget.id) handleResetForm();
      setDelTarget(null);
    } catch (err) {
      console.error(err);
      setDelErr(err?.code === 'permission-denied'
        ? staffRulesNotice('This deletion')
        : (err.message || 'Could not delete the report.'));
    } finally {
      setDelBusy(false);
    }
  };

  // The sheet as a real PDF document — the same branded layout every ERP
  // report uses. No browser tab and no printer dialog is ever opened.
  const handleReportPdf = (r) => {
    const rep = r || {
      name, position, location, date, day: dayName, workMode,
      arrival, lunchStart, lunchEnd, lunchDuration, departure, totalWorkHours,
      tasks: tasks.filter(t => t.description.trim().length > 0), remarks, planTomorrow
    };
    try {
      saveDailyReportPdf({ ...rep, day: rep.day || getDayName(rep.date || "") },
        { generatedBy: rep.name || name });
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "Could not create the PDF.");
    }
  };

  const history = [...reports]
    .sort((a, b) => toMs(b.submittedAt || b.createdAt) - toMs(a.submittedAt || a.createdAt) || String(b.date).localeCompare(String(a.date)))
    .slice(0, 15);

  const submittedToday = reports.some(r => r.date === todayKey());

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: C.muted, fontSize: 13 }}>Loading daily work reports…</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {loadError && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10,
          background: 'rgba(240,90,103,0.1)', border: '1px solid rgba(240,90,103,0.35)', color: C.red, fontSize: 12
        }}>
          <AlertTriangle size={14} /> {loadError}
        </div>
      )}

      {/* ── Daily Work Report Form Sheet ─────────────────────────── */}
      <ERPPanel style={{ overflow: 'hidden' }}>
        {/* Title Bar styled like the document header */}
        <div style={{
          background: 'linear-gradient(135deg, #09204A, #0066FF)',
          padding: '14px 20px',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileText size={18} style={{ color: '#00D9FF' }} />
            <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: 0.5 }}>
              SMART PVT LTD • DAILY WORK REPORT — {date} ({dayName})
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {submittedToday && !editingId && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                background: 'rgba(24,199,122,0.2)', color: C.green, border: '1px solid rgba(24,199,122,0.4)'
              }}>
                ✓ Submitted Today
              </span>
            )}
            <button
              type="button"
              onClick={() => handleReportPdf()}
              style={{
                background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: 8, color: '#fff', padding: '5px 12px', fontSize: 11, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700
              }}
            >
              <Printer size={12} /> Sheet PDF
            </button>
            {editingId && (
              <button
                type="button"
                onClick={handleResetForm}
                style={{
                  background: 'rgba(240,90,103,0.2)', border: '1px solid rgba(240,90,103,0.4)',
                  borderRadius: 8, color: '#fff', padding: '5px 12px', fontSize: 11, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700
                }}
              >
                <X size={12} /> Cancel Edit
              </button>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ── Top Meta Section (Name, Position, Location, Date, Day, Work Mode) ── */}
          <div style={{
            background: 'rgba(10,24,56,0.6)', borderRadius: 12, border: `1px solid ${C.border}`,
            padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12
          }}>
            <div>
              <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>
                NAME :
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box', background: 'rgba(4,13,31,0.8)', border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: '8px 12px', color: C.text, fontSize: 12, fontWeight: 700, outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>
                POSITION :
              </label>
              <input
                type="text"
                required
                value={position}
                onChange={e => setPosition(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box', background: 'rgba(4,13,31,0.8)', border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: '8px 12px', color: C.text, fontSize: 12, fontWeight: 600, outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>
                LOCATION :
              </label>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box', background: 'rgba(4,13,31,0.8)', border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: '8px 12px', color: C.text, fontSize: 12, outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>
                DATE :
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box', background: 'rgba(4,13,31,0.8)', border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: '8px 12px', color: C.cyan, fontSize: 12, fontWeight: 700, outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>
                DAY :
              </label>
              <div style={{
                background: 'rgba(4,13,31,0.8)', border: `1px solid ${C.border}`, borderRadius: 8,
                padding: '8px 12px', color: C.text, fontSize: 12, fontWeight: 700
              }}>
                {dayName || '—'}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>
                WORK MODE :
              </label>
              <select
                value={workMode}
                onChange={e => setWorkMode(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box', background: 'rgba(4,13,31,0.8)', border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: '8px 12px', color: C.text, fontSize: 12, outline: 'none', cursor: 'pointer'
                }}
              >
                {WORK_MODES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* ── Time & Attendance Row (Arrival, Lunch, Departure, Total Work Hrs) ── */}
          <div style={{
            background: 'rgba(0,102,255,0.06)', borderRadius: 12, border: `1px solid ${C.borderHi}`,
            padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10
          }}>
            <div>
              <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: C.cyan, marginBottom: 4 }}>
                ARRIVAL
              </label>
              <input
                type="time"
                value={arrival}
                onChange={e => setArrival(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box', background: 'rgba(4,13,31,0.8)', border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: '7px 10px', color: C.text, fontSize: 12, fontWeight: 700, outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: C.muted, marginBottom: 4 }}>
                LUNCH START
              </label>
              <input
                type="time"
                value={lunchStart}
                onChange={e => setLunchStart(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box', background: 'rgba(4,13,31,0.8)', border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: '7px 10px', color: C.text, fontSize: 12, outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: C.muted, marginBottom: 4 }}>
                LUNCH END
              </label>
              <input
                type="time"
                value={lunchEnd}
                onChange={e => setLunchEnd(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box', background: 'rgba(4,13,31,0.8)', border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: '7px 10px', color: C.text, fontSize: 12, outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: C.muted, marginBottom: 4 }}>
                LUNCH DURATION
              </label>
              <div style={{
                background: 'rgba(4,13,31,0.8)', border: `1px solid ${C.border}`, borderRadius: 8,
                padding: '7px 10px', color: C.subtle, fontSize: 12, fontWeight: 700
              }}>
                {lunchDuration}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: C.cyan, marginBottom: 4 }}>
                DEPARTURE
              </label>
              <input
                type="time"
                value={departure}
                onChange={e => setDeparture(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box', background: 'rgba(4,13,31,0.8)', border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: '7px 10px', color: C.text, fontSize: 12, fontWeight: 700, outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 10.5, fontWeight: 800, color: C.green, marginBottom: 4 }}>
                TOTAL WORK HRS
              </label>
              <div style={{
                background: 'rgba(24,199,122,0.12)', border: '1px solid rgba(24,199,122,0.3)', borderRadius: 8,
                padding: '7px 10px', color: C.green, fontSize: 13, fontWeight: 900
              }}>
                {totalWorkHours}
              </div>
            </div>
          </div>

          {/* ── Routine Task Breakdown ──
              On a laptop this is the printed sheet: one row per task under its
              column heads. On a phone the same fields stack as cards, because a
              seven-column row cannot fit 520 px and the STATUS / remove column
              used to fall off the right edge. */}
          <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            <div style={{
              background: 'rgba(10,24,56,0.9)', padding: '10px 14px', borderBottom: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap'
            }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: C.text, letterSpacing: 0.5 }}>
                DAILY ROUTINE WORK BREAKDOWN
              </span>
              <ERPBtn type="button" size="sm" variant="secondary" onClick={handleAddTaskRow}>
                <Plus size={12} /> Add Task Row
              </ERPBtn>
            </div>

            <div style={narrow ? null : { overflowX: 'auto' }}>
            {!narrow && (
              <div style={{
                display: 'grid', gridTemplateColumns: TASK_GRID, gap: 8, alignItems: 'center',
                minWidth: 620,
                padding: '8px 12px', background: 'rgba(14,35,80,0.6)',
                borderBottom: `1px solid ${C.border}`, fontSize: 10.5, fontWeight: 800,
                color: C.muted, textTransform: 'uppercase',
              }}>
                <span style={{ textAlign: 'center' }}>NO</span>
                <span>START</span>
                <span>END</span>
                <span style={{ textAlign: 'center' }}>HOURS</span>
                <span>WORK / DESCRIPTION</span>
                <span>STATUS</span>
                <span />
              </div>
            )}

            {tasks.map((task, idx) => (
              <div key={idx} style={{
                ...(narrow ? cardBox : rowBox),
                borderBottom: idx < tasks.length - 1 ? `1px solid ${C.border}20` : 'none',
              }}>
                <div style={{ fontWeight: 800, color: C.muted, fontSize: 12, textAlign: narrow ? 'left' : 'center' }}>
                  {narrow ? `Task ${task.no || idx + 1}` : (task.no || idx + 1)}
                </div>

                {narrow && (
                  <>
                    <div style={{ fontWeight: 800, color: C.cyan, fontSize: 12, marginLeft: 'auto' }}>
                      {task.hours || '—'}
                    </div>
                    {/* line break: the two times get their own row below */}
                    <div style={{ flexBasis: '100%', height: 0 }} />
                  </>
                )}

                <label style={{ ...cellField, ...(narrow ? { flex: '1 1 42%' } : null) }}>
                  {narrow && <span style={cellLabel}>START</span>}
                  <input
                    type="time"
                    value={task.start}
                    onChange={e => handleTaskChange(idx, 'start', e.target.value)}
                    style={cellInput}
                  />
                </label>

                <label style={{ ...cellField, ...(narrow ? { flex: '1 1 42%' } : null) }}>
                  {narrow && <span style={cellLabel}>END</span>}
                  <input
                    type="time"
                    value={task.end}
                    onChange={e => handleTaskChange(idx, 'end', e.target.value)}
                    style={cellInput}
                  />
                </label>

                {!narrow && (
                  <div style={{ textAlign: 'center', fontWeight: 700, color: C.cyan, fontSize: 12 }}>
                    {task.hours || '—'}
                  </div>
                )}

                <label style={{ ...cellField, ...(narrow ? { flex: '1 1 100%' } : null) }}>
                  <span style={cellLabel}>{narrow ? 'WORK / DESCRIPTION' : ''}</span>
                  <input
                    type="text"
                    required
                    value={task.description}
                    onChange={e => handleTaskChange(idx, 'description', e.target.value)}
                    placeholder="Type routine work performed..."
                    style={cellInput}
                  />
                </label>

                <label style={{ ...cellField, ...(narrow ? { flex: '1 1 55%' } : null) }}>
                  {narrow && <span style={cellLabel}>STATUS</span>}
                  <select
                    value={task.status}
                    onChange={e => handleTaskChange(idx, 'status', e.target.value)}
                    style={{
                      ...cellInput,
                      border: `1px solid ${task.status === 'Completed' ? 'rgba(24,199,122,0.4)' : C.border}`,
                      color: task.status === 'Completed' ? C.green : C.amber,
                      cursor: 'pointer',
                    }}
                  >
                    {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>

                <div style={narrow
                  ? { flex: '0 0 auto', marginLeft: 'auto', alignSelf: 'flex-end' }
                  : { textAlign: 'center' }}>
                  {tasks.length > 1 && (
                    <ERPBtn type="button" size="sm" variant="danger" onClick={() => handleRemoveTaskRow(idx)}>
                      <Trash2 size={12} />{narrow ? ' Remove' : ''}
                    </ERPBtn>
                  )}
                </div>
              </div>
            ))}
            </div>
          </div>

          {/* ── Remarks Section ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 6 }}>
                REMARKS / BLOCKERS / NOTES :
              </label>
              <textarea
                rows={3}
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder="Enter any blockers, pending items, or notes for your lead..."
                style={{
                  width: '100%', boxSizing: 'border-box', background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`,
                  borderRadius: 10, padding: '10px 12px', color: C.text, fontSize: 12, outline: 'none',
                  fontFamily: 'inherit', resize: 'vertical'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.violet, marginBottom: 6 }}>
                PLAN FOR TOMORROW :
              </label>
              <textarea
                rows={3}
                value={planTomorrow}
                onChange={e => setPlanTomorrow(e.target.value)}
                placeholder="What work do you plan to do tomorrow? (one line per task)"
                style={{
                  width: '100%', boxSizing: 'border-box', background: 'rgba(10,24,56,0.8)',
                  border: '1px solid rgba(139,92,246,0.35)',
                  borderRadius: 10, padding: '10px 12px', color: C.text, fontSize: 12, outline: 'none',
                  fontFamily: 'inherit', resize: 'vertical'
                }}
              />
            </div>
          </div>

          {/* Feedback messages */}
          {successMsg && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.green,
              padding: '10px 14px', borderRadius: 8, background: 'rgba(24,199,122,0.1)', border: '1px solid rgba(24,199,122,0.3)'
            }}>
              <CheckCircle2 size={15} /> Daily routine work report saved successfully! Admin can view and review your report.
            </div>
          )}
          {errorMsg && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.red,
              padding: '10px 14px', borderRadius: 8, background: 'rgba(240,90,103,0.1)', border: '1px solid rgba(240,90,103,0.3)'
            }}>
              <AlertTriangle size={15} /> {errorMsg}
            </div>
          )}

          {/* Submit bar */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', paddingTop: 6 }}>
            <ERPBtn
              type="submit"
              variant="primary"
              disabled={busy}
              style={{ flex: narrow ? '1 1 100%' : '0 0 auto', minWidth: narrow ? undefined : 220, justifyContent: 'center' }}
            >
              <Send size={13} /> {editingId ? 'Update Work Report' : 'Submit Daily Work Report'}
            </ERPBtn>
            <ERPBtn
              type="button"
              variant="secondary"
              onClick={() => handleReportPdf()}
              style={{ flex: narrow ? '1 1 auto' : '0 0 auto', justifyContent: 'center' }}
            >
              <Printer size={13} /> Sheet PDF
            </ERPBtn>
            {editingId && (
              <ERPBtn type="button" variant="secondary" onClick={handleResetForm}>
                Cancel Edit
              </ERPBtn>
            )}
          </div>

        </form>
      </ERPPanel>

      {/* ── My Past Submitted Daily Work Reports ─────────────────── */}
      <ERPPanel>
        <ERPPanelHeader
          title="My Submitted Daily Work Reports"
          icon="🗂️"
          action={(
            <span style={{ fontSize: 11, color: C.muted }}>
              {reports.length} total{history.length < reports.length ? ` · last ${history.length} shown` : ''}
            </span>
          )}
        />

        {history.length === 0 ? (
          <StaffEmpty
            icon="📝"
            from="#8B5CF6" to="#0066FF"
            title="No work reports logged yet"
            sub="Fill and submit your daily work report using the sheet above."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {history.map((r, i) => {
              const isToday = r.date === todayKey();
              return (
                <div
                  key={r.id}
                  style={{
                    padding: '16px 20px',
                    borderTop: i > 0 ? `1px solid ${C.border}20` : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Calendar size={14} style={{ color: C.cyan }} />
                      <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>
                        {r.date} ({r.day || getDayName(r.date)})
                      </span>

                      {isToday && (
                        <span style={{
                          fontSize: 9, padding: '2px 8px', borderRadius: 20, background: 'rgba(24,199,122,0.15)',
                          color: C.green, border: '1px solid rgba(24,199,122,0.3)', fontWeight: 700
                        }}>
                          TODAY
                        </span>
                      )}

                      {submittedStampOf(r) && (
                        <span
                          title="The exact date and time this report was sent to the admin"
                          style={{
                            fontSize: 9.5, padding: '2px 8px', borderRadius: 6,
                            background: 'rgba(0,217,255,0.10)', color: C.cyan,
                            border: '1px solid rgba(0,217,255,0.28)', fontWeight: 700
                          }}>
                          🕒 {submittedStampOf(r)}
                        </span>
                      )}

                      <span style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 6, background: 'rgba(10,24,56,0.8)',
                        color: C.subtle, border: `1px solid ${C.border}`
                      }}>
                        {r.workMode || 'On-Site'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 800, color: C.green, padding: '2px 9px', borderRadius: 6,
                        background: 'rgba(24,199,122,0.1)', border: '1px solid rgba(24,199,122,0.25)'
                      }}>
                        {r.totalWorkHours || '—'}
                      </span>
                      <ERPBtn type="button" size="sm" variant="secondary" onClick={() => handleReportPdf(r)}>
                        <Printer size={11} /> PDF
                      </ERPBtn>
                      <ERPBtn type="button" size="sm" variant="secondary" onClick={() => handleEditInit(r)}>
                        <Edit3 size={11} /> Edit
                      </ERPBtn>
                      <ERPBtn type="button" size="sm" variant="danger" onClick={() => { setDelTarget(r); setDelErr(''); }}>
                        <Trash2 size={11} />
                      </ERPBtn>
                    </div>
                  </div>

                  {/* Summary of tasks — only the rows that actually hold work;
                      an empty pre-dated block from the sheet import is noise. */}
                  {dailyReportTasksOf(r).length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 4 }}>
                      {dailyReportTasksOf(r).map((t, tIdx) => (
                        <div key={tIdx} style={{ fontSize: 11.5, color: C.subtle, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          {(t.start || t.end) && (
                            <span style={{ color: C.cyan, fontWeight: 700, whiteSpace: 'nowrap' }}>
                              {t.start || '—'} to {t.end || '—'}
                            </span>
                          )}
                          <span style={{ flex: 1, minWidth: 140 }}>{t.description}</span>
                          <span style={{
                            fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                            background: t.status === 'Completed' ? 'rgba(24,199,122,0.1)' : 'rgba(245,185,66,0.1)',
                            color: t.status === 'Completed' ? C.green : C.amber
                          }}>
                            {t.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {r.remarks && (
                    <div style={{
                      fontSize: 11, color: C.amber, padding: '5px 10px', borderRadius: 6,
                      background: 'rgba(245,185,66,0.06)', border: '1px solid rgba(245,185,66,0.15)'
                    }}>
                      Remarks: {r.remarks}
                    </div>
                  )}

                  {r.planTomorrow && (
                    <div style={{
                      fontSize: 11, color: C.violet, padding: '5px 10px', borderRadius: 6,
                      background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.2)'
                    }}>
                      Plan for tomorrow: {r.planTomorrow}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ERPPanel>

      {/* ── Delete one filed report ── */}
      <ERPModal isOpen={!!delTarget} onClose={() => setDelTarget(null)}
        title="Delete this work report?" width={420}>
        {delTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            <div style={{ fontSize: 12, color: C.subtle, lineHeight: 1.6 }}>
              <strong style={{ color: C.text }}>{delTarget.date} ({delTarget.day || getDayName(delTarget.date)})</strong><br />
              {delTarget.totalWorkHours || '—'} · {String(delTarget.workMode || 'On-Site')} ·{' '}
              {dailyReportTasksOf(delTarget).length} tasks
            </div>
            <div style={{ padding: '10px 12px', borderRadius: 10, fontSize: 11.5, lineHeight: 1.55,
              background: 'rgba(240,90,103,0.1)', border: '1px solid rgba(240,90,103,0.35)', color: C.red }}>
              The report goes out of the admin view, the attendance statement and every work report.
            </div>

            {delErr && (
              <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(245,185,66,0.1)',
                border: '1px solid rgba(245,185,66,0.35)', fontSize: 11, color: C.amber, lineHeight: 1.5 }}>
                {delErr}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <ERPBtn variant="secondary" onClick={() => setDelTarget(null)} style={{ flex: 1, justifyContent: 'center' }}>Keep it</ERPBtn>
              <ERPBtn variant="danger" disabled={delBusy} onClick={handleDelete} style={{ flex: 1, justifyContent: 'center' }}>
                <Trash2 size={12} /> {delBusy ? 'Deleting…' : 'Delete'}
              </ERPBtn>
            </div>
          </div>
        )}
      </ERPModal>
    </div>
  );
}
