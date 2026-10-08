// ─────────────────────────────────────────────────────────────────
//  Staff Portal — Daily Routine Work Report Module.
//  Structured exactly as the standard SMART Pvt Ltd Daily Work Report:
//  • Top Header: Name, Position, Location, Date, Day, Work Mode.
//  • Attendance Bar: Arrival, Lunch Start, Lunch End, Lunch Duration,
//    Departure, Total Work Hours (auto-calculated).
//  • Routine Task Table: No, Start, End, Hours (auto), Work / Description,
//    Status (Completed / In Progress / Pending / On Hold).
//  • Remarks / Notes section.
//  • Printable / PDF preview matching the sheet layout.
// ─────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc,
  query, where, serverTimestamp
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { ERPPanel, ERPPanelHeader, ERPBtn, ERPEmpty, C } from '../../erp/components/ERPui';
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

const INITIAL_TASK_ROW = {
  no: 1,
  start: '09:00',
  end: '10:30',
  hours: '1.5 hrs',
  description: '',
  status: 'Completed',
};

const DEV_REPORTS = [
  {
    id: 'rep-1',
    date: todayKey(),
    day: getDayName(todayKey()),
    name: 'Ashan Perera',
    position: 'Software Associate - II',
    location: 'SMART Trincomalee',
    workMode: 'On-Site / Office',
    arrival: '08:30',
    lunchStart: '13:00',
    lunchEnd: '14:00',
    lunchDuration: '1.0 hrs',
    departure: '17:30',
    totalWorkHours: '8.0 hrs',
    tasks: [
      { no: 1, start: '08:30', end: '11:00', hours: '2.5 hrs', description: 'POS order screen development & state synchronization', status: 'Completed' },
      { no: 2, start: '11:00', end: '13:00', hours: '2.0 hrs', description: 'Fixing quotation PDF export alignment and barcode scaling', status: 'Completed' },
      { no: 3, start: '14:00', end: '16:00', hours: '2.0 hrs', description: 'Internal team sprint planning & sprint backlog review', status: 'Completed' },
      { no: 4, start: '16:00', end: '17:30', hours: '1.5 hrs', description: 'Bug fixing for client requirement forms validation', status: 'In Progress' },
    ],
    remarks: 'Code deployed to staging branch. Ready for QA test.',
    submittedAt: new Date().setHours(17, 30, 0, 0),
    authUid: 'dev-staff-001',
  }
];

export default function DailyUpdate() {
  const { staffProfile, isFirebaseConfigured, isDevSession } = useAuth();
  const live = isFirebaseConfigured && !isDevSession;
  const uid = staffProfile?.id || '';

  const [reports,   setReports]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(null);

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

  const handleDelete = async (reportId) => {
    if (!window.confirm('Are you sure you want to delete this daily work report?')) return;
    try {
      if (!live) {
        setReports(prev => prev.filter(r => r.id !== reportId));
      } else {
        await deleteDoc(doc(db, 'dailyUpdates', reportId));
      }
      if (editingId === reportId) handleResetForm();
    } catch (err) {
      alert('Delete failed: ' + (err.message || err));
    }
  };

  // Print Report Handler
  const handlePrintReport = (r) => {
    const rep = r || {
      name, position, location, date, day: dayName, workMode,
      arrival, lunchStart, lunchEnd, lunchDuration, departure, totalWorkHours,
      tasks: tasks.filter(t => t.description.trim().length > 0), remarks
    };

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>SMART Pvt Ltd — Daily Work Report (${rep.date})</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 24px; color: #040D1F; }
            .sheet { border: 2px solid #0E3A73; border-radius: 8px; overflow: hidden; max-width: 900px; margin: 0 auto; }
            .header { background: #0E3A73; color: #fff; padding: 12px; text-align: center; font-size: 16px; font-weight: 800; letter-spacing: 0.5px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #CBD5E1; padding: 8px 10px; }
            .meta-label { background: #F1F5F9; font-weight: 700; width: 15%; color: #1E293B; }
            .meta-val { width: 35%; font-weight: 600; }
            .time-th { background: #E2E8F0; font-weight: 700; text-align: center; color: #0F172A; }
            .time-td { text-align: center; font-weight: 700; background: #F8FAFC; }
            .total-td { background: #E8F5E9; color: #166534; font-weight: 800; font-size: 13px; text-align: center; }
            .task-th { background: #1B4D89; color: #fff; font-weight: 700; text-align: center; }
            .status-badge { display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: 700; }
            .status-Completed { background: #DCFCE7; color: #15803D; }
            .status-InProgress { background: #FEF3C7; color: #B45309; }
            .remarks-box { padding: 10px 12px; background: #F8FAFC; border-top: 1px solid #CBD5E1; font-size: 12px; }
            @media print { body { padding: 0; } .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="header">SMART PVT LTD • DAILY WORK REPORT - ${rep.date} (${rep.day || 'Day'})</div>
            <table>
              <tr>
                <td class="meta-label">NAME :</td>
                <td class="meta-val">${rep.name}</td>
                <td class="meta-label">DATE :</td>
                <td class="meta-val">${rep.date}</td>
              </tr>
              <tr>
                <td class="meta-label">POSITION :</td>
                <td class="meta-val">${rep.position}</td>
                <td class="meta-label">DAY :</td>
                <td class="meta-val">${rep.day || '—'}</td>
              </tr>
              <tr>
                <td class="meta-label">LOCATION :</td>
                <td class="meta-val">${rep.location}</td>
                <td class="meta-label">WORK MODE :</td>
                <td class="meta-val">${rep.workMode}</td>
              </tr>
            </table>

            <table>
              <tr>
                <td class="time-th">ARRIVAL</td>
                <td class="time-th">LUNCH START</td>
                <td class="time-th">LUNCH END</td>
                <td class="time-th">LUNCH DURATION</td>
                <td class="time-th">DEPARTURE</td>
                <td class="time-th">TOTAL WORK HRS</td>
              </tr>
              <tr>
                <td class="time-td">${rep.arrival || '—'}</td>
                <td class="time-td">${rep.lunchStart || '—'}</td>
                <td class="time-td">${rep.lunchEnd || '—'}</td>
                <td class="time-td">${rep.lunchDuration || '—'}</td>
                <td class="time-td">${rep.departure || '—'}</td>
                <td class="total-td">${rep.totalWorkHours || '—'}</td>
              </tr>
            </table>

            <table>
              <tr>
                <th class="task-th" style="width: 40px;">NO</th>
                <th class="task-th" style="width: 80px;">START</th>
                <th class="task-th" style="width: 80px;">END</th>
                <th class="task-th" style="width: 80px;">HOURS</th>
                <th class="task-th">WORK / DESCRIPTION</th>
                <th class="task-th" style="width: 110px;">STATUS</th>
              </tr>
              ${(rep.tasks || []).map((t, idx) => `
                <tr>
                  <td style="text-align: center; font-weight: 700;">${t.no || idx + 1}</td>
                  <td style="text-align: center;">${t.start || '—'}</td>
                  <td style="text-align: center;">${t.end || '—'}</td>
                  <td style="text-align: center; font-weight: 700; color: #0284C7;">${t.hours || '—'}</td>
                  <td>${t.description || '—'}</td>
                  <td style="text-align: center;">
                    <span class="status-badge status-${(t.status || 'Completed').replace(/\s/g, '')}">${t.status || 'Completed'}</span>
                  </td>
                </tr>
              `).join('')}
            </table>

            <div class="remarks-box">
              <strong>REMARKS:</strong> ${rep.remarks || 'None'}
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `);
    win.document.close();
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
              onClick={() => handlePrintReport()}
              style={{
                background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: 8, color: '#fff', padding: '5px 12px', fontSize: 11, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700
              }}
            >
              <Printer size={12} /> Print Sheet
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

          {/* ── Routine Task Breakdown Table ── */}
          <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            <div style={{
              background: 'rgba(10,24,56,0.9)', padding: '10px 14px', borderBottom: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: C.text, letterSpacing: 0.5 }}>
                DAILY ROUTINE WORK BREAKDOWN
              </span>
              <button
                type="button"
                onClick={handleAddTaskRow}
                style={{
                  background: 'rgba(0,102,255,0.15)', border: `1px solid ${C.borderHi}`, borderRadius: 6,
                  color: C.cyan, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4
                }}
              >
                <Plus size={12} /> Add Task Row
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'rgba(14,35,80,0.6)', color: C.muted, fontSize: 10.5, textTransform: 'uppercase' }}>
                    <th style={{ padding: '8px 10px', width: 45, textAlign: 'center', borderBottom: `1px solid ${C.border}` }}>NO</th>
                    <th style={{ padding: '8px 10px', width: 95, textAlign: 'center', borderBottom: `1px solid ${C.border}` }}>START</th>
                    <th style={{ padding: '8px 10px', width: 95, textAlign: 'center', borderBottom: `1px solid ${C.border}` }}>END</th>
                    <th style={{ padding: '8px 10px', width: 85, textAlign: 'center', borderBottom: `1px solid ${C.border}` }}>HOURS</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: `1px solid ${C.border}` }}>WORK / DESCRIPTION</th>
                    <th style={{ padding: '8px 10px', width: 140, textAlign: 'center', borderBottom: `1px solid ${C.border}` }}>STATUS</th>
                    <th style={{ padding: '8px 10px', width: 40, textAlign: 'center', borderBottom: `1px solid ${C.border}` }}></th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task, idx) => (
                    <tr key={idx} style={{ borderBottom: `1px solid ${C.border}20` }}>
                      <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 800, color: C.muted }}>
                        {task.no || idx + 1}
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <input
                          type="time"
                          value={task.start}
                          onChange={e => handleTaskChange(idx, 'start', e.target.value)}
                          style={{
                            width: '100%', background: 'rgba(4,13,31,0.8)', border: `1px solid ${C.border}`,
                            borderRadius: 6, padding: '6px 8px', color: C.text, fontSize: 11.5, outline: 'none'
                          }}
                        />
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <input
                          type="time"
                          value={task.end}
                          onChange={e => handleTaskChange(idx, 'end', e.target.value)}
                          style={{
                            width: '100%', background: 'rgba(4,13,31,0.8)', border: `1px solid ${C.border}`,
                            borderRadius: 6, padding: '6px 8px', color: C.text, fontSize: 11.5, outline: 'none'
                          }}
                        />
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700, color: C.cyan }}>
                        {task.hours || '—'}
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <input
                          type="text"
                          required
                          value={task.description}
                          onChange={e => handleTaskChange(idx, 'description', e.target.value)}
                          placeholder="Type routine work performed..."
                          style={{
                            width: '100%', boxSizing: 'border-box', background: 'rgba(4,13,31,0.8)', border: `1px solid ${C.border}`,
                            borderRadius: 6, padding: '6px 10px', color: C.text, fontSize: 12, outline: 'none'
                          }}
                        />
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <select
                          value={task.status}
                          onChange={e => handleTaskChange(idx, 'status', e.target.value)}
                          style={{
                            width: '100%', background: 'rgba(4,13,31,0.8)',
                            border: `1px solid ${task.status === 'Completed' ? 'rgba(24,199,122,0.4)' : C.border}`,
                            borderRadius: 6, padding: '6px 8px',
                            color: task.status === 'Completed' ? C.green : C.amber,
                            fontSize: 11, fontWeight: 700, outline: 'none', cursor: 'pointer'
                          }}
                        >
                          {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                        {tasks.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTaskRow(idx)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 3 }}
                            title="Remove row"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Remarks Section ── */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 6 }}>
              REMARKS / BLOCKERS / NOTES :
            </label>
            <textarea
              rows={2}
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
              style={{ minWidth: 220, justifyContent: 'center' }}
            >
              <Send size={13} /> {editingId ? 'Update Work Report' : 'Submit Daily Work Report'}
            </ERPBtn>
            <button
              type="button"
              onClick={() => handlePrintReport()}
              style={{
                background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`, borderRadius: 10,
                color: C.cyan, padding: '9px 16px', fontSize: 12, cursor: 'pointer', display: 'flex',
                alignItems: 'center', gap: 6, fontWeight: 700
              }}
            >
              <Printer size={13} /> Print / Save Sheet
            </button>
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
          action={<span style={{ fontSize: 11, color: C.muted }}>{history.length} records</span>}
        />

        {history.length === 0 ? (
          <ERPEmpty
            icon="📝"
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
                      <button
                        type="button"
                        onClick={() => handlePrintReport(r)}
                        style={{
                          background: 'rgba(0,102,255,0.1)', border: `1px solid ${C.borderHi}`,
                          borderRadius: 6, color: C.cyan, padding: '4px 8px', fontSize: 11, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 4
                        }}
                      >
                        <Printer size={11} /> Print
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditInit(r)}
                        style={{
                          background: 'rgba(0,102,255,0.1)', border: `1px solid ${C.borderHi}`,
                          borderRadius: 6, color: C.cyan, padding: '4px 8px', fontSize: 11, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 4
                        }}
                      >
                        <Edit3 size={11} /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(r.id)}
                        style={{
                          background: 'rgba(240,90,103,0.1)', border: '1px solid rgba(240,90,103,0.25)',
                          borderRadius: 6, color: C.red, padding: '4px 8px', fontSize: 11, cursor: 'pointer'
                        }}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>

                  {/* Summary of tasks */}
                  {r.tasks && r.tasks.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 4 }}>
                      {r.tasks.map((t, tIdx) => (
                        <div key={tIdx} style={{ fontSize: 11.5, color: C.subtle, display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ color: C.cyan, fontWeight: 700, width: 85 }}>{t.start}–{t.end}</span>
                          <span style={{ flex: 1 }}>{t.description}</span>
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
                </div>
              );
            })}
          </div>
        )}
      </ERPPanel>

    </div>
  );
}
