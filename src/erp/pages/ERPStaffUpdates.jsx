// ─────────────────────────────────────────────────────────────────
//  Phase 3 D — Staff Daily Routine Work Reports (Admin Monitor).
//  Admins can view, search, filter, EDIT, DELETE, and PRINT staff
//  daily work reports matching the standard SMART Pvt Ltd sheet layout.
// ─────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import {
  collection, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  ERPPanel, ERPPanelHeader, ERPBtn, ERPModal, ERPEmpty, ERPAvatar, C
} from '../components/ERPui';
import {
  toMs, todayKey, calculateTaskDuration, calculateAttendanceHours, getDayName
} from '../../staff/staffUtils';
import {
  AlertTriangle, ClipboardList, Clock, Coffee, Check, Hourglass,
  Pencil, Trash2, Calendar, User, Search, Filter, RefreshCw, Printer,
  FileText, Building, Plus, X
} from 'lucide-react';

const AVATAR_COLORS = ['#0066FF', '#8B5CF6', '#18C77A', '#F5B942', '#F05A67', '#00D9FF'];
const WORK_MODES = ['On-Site / Office', 'Remote / WFH', 'Hybrid'];
const TASK_STATUSES = ['Completed', 'In Progress', 'Pending', 'On Hold'];

const DEV_UPDATES = [
  {
    id: 'rep-1',
    date: todayKey(),
    day: getDayName(todayKey()),
    name: 'Ashan Perera',
    staffId: 'dev-staff-001',
    staffName: 'Ashan Perera',
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

export default function ERPStaffUpdates() {
  const { isFirebaseConfigured, isDevSession } = useAuth();
  const live = isFirebaseConfigured && !isDevSession;

  const [updates,   setUpdates]   = useState([]);
  const [staff,     setStaff]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Filters
  const [dateF,   setDateF]   = useState('');
  const [staffF,  setStaffF]  = useState('All');
  const [statusF, setStatusF] = useState('All');
  const [search,  setSearch]  = useState('');

  // Edit Modal State
  const [editingLog, setEditingLog] = useState(null);
  const [editForm,   setEditForm]   = useState({
    name: '',
    position: '',
    location: '',
    date: '',
    workMode: 'On-Site / Office',
    arrival: '08:30',
    lunchStart: '13:00',
    lunchEnd: '14:00',
    departure: '17:30',
    tasks: [],
    remarks: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError,  setEditError]  = useState('');

  useEffect(() => {
    if (!live) {
      setUpdates(DEV_UPDATES);
      setStaff([
        { id: 'dev-staff-001', name: 'Ashan Perera' },
        { id: 'dev-staff-002', name: 'Nimali Silva' },
      ]);
      setLoading(false);
      return;
    }

    const unsubs = [
      onSnapshot(
        collection(db, 'dailyUpdates'),
        snap => {
          setUpdates(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          setLoading(false);
        },
        err => {
          console.error(err);
          setLoadError(`Daily updates — ${err.message}`);
          setLoading(false);
        }
      ),
      onSnapshot(
        collection(db, 'staff'),
        snap => setStaff(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.deleted)),
        err => console.error(err)
      ),
    ];
    return () => unsubs.forEach(u => u());
  }, [live]);

  // Open Edit Modal
  const handleOpenEdit = (log) => {
    setEditingLog(log);
    setEditForm({
      name: log.name || log.staffName || '',
      position: log.position || 'Software Associate',
      location: log.location || 'SMART Trincomalee',
      date: log.date || todayKey(),
      workMode: log.workMode || 'On-Site / Office',
      arrival: log.arrival || log.startTime || '08:30',
      lunchStart: log.lunchStart || '13:00',
      lunchEnd: log.lunchEnd || '14:00',
      departure: log.departure || log.endTime || '17:30',
      tasks: log.tasks && log.tasks.length > 0 ? log.tasks : [
        { no: 1, start: '09:00', end: '11:00', hours: '2.0 hrs', description: log.workDescription || '', status: log.status || 'Completed' }
      ],
      remarks: log.remarks || log.notes || '',
    });
    setEditError('');
  };

  const handleEditTaskChange = (index, field, value) => {
    setEditForm(prev => {
      const updated = [...prev.tasks];
      const row = { ...updated[index], [field]: value };
      if (field === 'start' || field === 'end') {
        row.hours = calculateTaskDuration(row.start, row.end);
      }
      updated[index] = row;
      return { ...prev, tasks: updated };
    });
  };

  const handleAddEditTaskRow = () => {
    setEditForm(prev => {
      const nextNo = prev.tasks.length + 1;
      const last = prev.tasks[prev.tasks.length - 1];
      const start = last ? last.end : '09:00';
      return {
        ...prev,
        tasks: [
          ...prev.tasks,
          { no: nextNo, start, end: '18:00', hours: calculateTaskDuration(start, '18:00'), description: '', status: 'Completed' }
        ]
      };
    });
  };

  const handleRemoveEditTaskRow = (index) => {
    setEditForm(prev => ({
      ...prev,
      tasks: prev.tasks.filter((_, i) => i !== index).map((r, i) => ({ ...r, no: i + 1 }))
    }));
  };

  // Save Edit (Admin)
  const handleSaveEdit = async () => {
    if (!editingLog) return;
    if (!editForm.date) {
      setEditError('Date is required.');
      return;
    }
    setSavingEdit(true);
    setEditError('');
    try {
      const { lunchDuration, totalWorkHours } = calculateAttendanceHours(
        editForm.arrival, editForm.lunchStart, editForm.lunchEnd, editForm.departure
      );
      const cleanTasks = editForm.tasks.filter(t => t.description.trim().length > 0);
      const day = getDayName(editForm.date);

      const payload = {
        name: editForm.name,
        position: editForm.position,
        location: editForm.location,
        date: editForm.date,
        day,
        workMode: editForm.workMode,
        arrival: editForm.arrival,
        lunchStart: editForm.lunchStart,
        lunchEnd: editForm.lunchEnd,
        lunchDuration,
        departure: editForm.departure,
        totalWorkHours,
        tasks: cleanTasks,
        remarks: editForm.remarks.trim(),
        workDescription: cleanTasks.map(t => `${t.start}-${t.end}: ${t.description}`).join(' | '),
        items: cleanTasks.map(t => t.description),
        status: cleanTasks.every(t => t.status === 'Completed') ? 'Completed' : 'Pending',
        updatedAt: serverTimestamp(),
      };

      if (!live) {
        setUpdates(prev => prev.map(u => u.id === editingLog.id ? { ...u, ...payload, updatedAt: Date.now() } : u));
      } else {
        await updateDoc(doc(db, 'dailyUpdates', editingLog.id), payload);
      }

      setEditingLog(null);
    } catch (err) {
      console.error(err);
      setEditError(err.message || 'Failed to update daily work report.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete Log (Admin)
  const handleDeleteLog = async (logId, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Are you sure you want to permanently delete this daily work report from the database?')) {
      return;
    }
    try {
      if (!live) {
        setUpdates(prev => prev.filter(u => u.id !== logId));
      } else {
        await deleteDoc(doc(db, 'dailyUpdates', logId));
      }
    } catch (err) {
      console.error(err);
      alert('Failed to delete report: ' + (err.message || err));
    }
  };

  // Print Report Handler
  const handlePrintSheet = (u) => {
    const win = window.open('', '_blank');
    if (!win) return;
    const tasks = u.tasks || (u.items ? u.items.map((item, i) => ({ no: i + 1, start: u.startTime || '09:00', end: u.endTime || '18:00', hours: u.totalHours || '—', description: item, status: u.status || 'Completed' })) : []);

    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>SMART Pvt Ltd — Daily Work Report (${u.date})</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 24px; color: #040D1F; }
            .sheet { border: 2px solid #0E3A73; border-radius: 8px; overflow: hidden; max-width: 900px; margin: 0 auto; }
            .header { background: #0E3A73; color: #fff; padding: 12px; text-align: center; font-size: 16px; font-weight: 800; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #CBD5E1; padding: 8px 10px; }
            .meta-label { background: #F1F5F9; font-weight: 700; width: 15%; color: #1E293B; }
            .meta-val { width: 35%; font-weight: 600; }
            .time-th { background: #E2E8F0; font-weight: 700; text-align: center; }
            .time-td { text-align: center; font-weight: 700; background: #F8FAFC; }
            .total-td { background: #E8F5E9; color: #166534; font-weight: 800; font-size: 13px; text-align: center; }
            .task-th { background: #1B4D89; color: #fff; font-weight: 700; text-align: center; }
            .remarks-box { padding: 10px 12px; background: #F8FAFC; border-top: 1px solid #CBD5E1; font-size: 12px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="header">SMART PVT LTD • DAILY WORK REPORT - ${u.date} (${u.day || getDayName(u.date)})</div>
            <table>
              <tr>
                <td class="meta-label">NAME :</td>
                <td class="meta-val">${u.name || u.staffName}</td>
                <td class="meta-label">DATE :</td>
                <td class="meta-val">${u.date}</td>
              </tr>
              <tr>
                <td class="meta-label">POSITION :</td>
                <td class="meta-val">${u.position || 'Staff'}</td>
                <td class="meta-label">DAY :</td>
                <td class="meta-val">${u.day || getDayName(u.date)}</td>
              </tr>
              <tr>
                <td class="meta-label">LOCATION :</td>
                <td class="meta-val">${u.location || 'Trincomalee'}</td>
                <td class="meta-label">WORK MODE :</td>
                <td class="meta-val">${u.workMode || 'On-Site'}</td>
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
                <td class="time-td">${u.arrival || u.startTime || '—'}</td>
                <td class="time-td">${u.lunchStart || '—'}</td>
                <td class="time-td">${u.lunchEnd || '—'}</td>
                <td class="time-td">${u.lunchDuration || u.lunchBreak || '—'}</td>
                <td class="time-td">${u.departure || u.endTime || '—'}</td>
                <td class="total-td">${u.totalWorkHours || u.totalHours || '—'}</td>
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
              ${tasks.map((t, idx) => `
                <tr>
                  <td style="text-align: center; font-weight: 700;">${t.no || idx + 1}</td>
                  <td style="text-align: center;">${t.start || '—'}</td>
                  <td style="text-align: center;">${t.end || '—'}</td>
                  <td style="text-align: center; font-weight: 700; color: #0284C7;">${t.hours || '—'}</td>
                  <td>${t.description || '—'}</td>
                  <td style="text-align: center; font-weight: 700;">${t.status || 'Completed'}</td>
                </tr>
              `).join('')}
            </table>

            <div class="remarks-box">
              <strong>REMARKS:</strong> ${u.remarks || u.notes || 'None'}
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

  // Filtered List
  const filtered = updates
    .filter(u => (dateF ? u.date === dateF : true))
    .filter(u => (staffF === 'All' ? true : (u.staffId === staffF || u.name === staffF || u.staffName === staffF)))
    .filter(u => (statusF === 'All' ? true : (u.status || 'Completed') === statusF))
    .filter(u => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (u.name || u.staffName || '').toLowerCase().includes(q) ||
        (u.workDescription || '').toLowerCase().includes(q) ||
        (u.remarks || u.notes || '').toLowerCase().includes(q) ||
        (u.tasks || []).some(t => (t.description || '').toLowerCase().includes(q))
      );
    })
    .sort((a, b) => toMs(b.submittedAt || b.createdAt) - toMs(a.submittedAt || a.createdAt) || String(b.date).localeCompare(String(a.date)));

  const todayCount = updates.filter(u => u.date === todayKey()).length;
  const completedCount = updates.filter(u => (u.status || 'Completed') === 'Completed').length;
  const pendingCount = updates.filter(u => u.status === 'Pending').length;

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: C.muted, fontSize: 13 }}>Loading staff daily reports…</div>;
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

      {/* Summary metrics row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <div style={{
          padding: '14px 18px', borderRadius: 12, background: 'rgba(10,24,56,0.7)',
          border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 4
        }}>
          <div style={{ fontSize: 11, color: C.muted }}>Total Daily Reports</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.text }}>{updates.length}</div>
        </div>
        <div style={{
          padding: '14px 18px', borderRadius: 12, background: 'rgba(24,199,122,0.06)',
          border: '1px solid rgba(24,199,122,0.2)', display: 'flex', flexDirection: 'column', gap: 4
        }}>
          <div style={{ fontSize: 11, color: C.green }}>Completed Reports</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.green }}>{completedCount}</div>
        </div>
        <div style={{
          padding: '14px 18px', borderRadius: 12, background: 'rgba(245,185,66,0.06)',
          border: '1px solid rgba(245,185,66,0.2)', display: 'flex', flexDirection: 'column', gap: 4
        }}>
          <div style={{ fontSize: 11, color: C.amber }}>Pending / In Progress</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.amber }}>{pendingCount}</div>
        </div>
        <div style={{
          padding: '14px 18px', borderRadius: 12, background: 'rgba(0,102,255,0.06)',
          border: `1px solid ${C.borderHi}`, display: 'flex', flexDirection: 'column', gap: 4
        }}>
          <div style={{ fontSize: 11, color: C.cyan }}>Submitted Today</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.cyan }}>{todayCount}</div>
        </div>
      </div>

      {/* Filters row */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ width: 160 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.subtle, marginBottom: 5 }}>Date</label>
          <input
            type="date"
            value={dateF}
            onChange={e => setDateF(e.target.value)}
            style={{
              width: '100%', background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`, borderRadius: 10,
              padding: '9px 12px', color: C.text, fontSize: 12, outline: 'none', boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{ width: 170 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.subtle, marginBottom: 5 }}>Staff Member</label>
          <select
            value={staffF}
            onChange={e => setStaffF(e.target.value)}
            style={{
              width: '100%', background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`, borderRadius: 10,
              padding: '9px 12px', color: C.text, fontSize: 12, outline: 'none', boxSizing: 'border-box', cursor: 'pointer'
            }}
          >
            <option value="All">All Staff</option>
            {staff.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
        </div>

        <div style={{ width: 150 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.subtle, marginBottom: 5 }}>Status</label>
          <select
            value={statusF}
            onChange={e => setStatusF(e.target.value)}
            style={{
              width: '100%', background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`, borderRadius: 10,
              padding: '9px 12px', color: C.text, fontSize: 12, outline: 'none', boxSizing: 'border-box', cursor: 'pointer'
            }}
          >
            <option value="All">All Statuses</option>
            <option value="Completed">Completed</option>
            <option value="Pending">Pending</option>
          </select>
        </div>

        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.subtle, marginBottom: 5 }}>Search Description</label>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 12, top: 11, color: C.muted }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by keywords or task..."
              style={{
                width: '100%', background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`, borderRadius: 10,
                padding: '9px 12px 9px 34px', color: C.text, fontSize: 12, outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        {(dateF || staffF !== 'All' || statusF !== 'All' || search) && (
          <button
            onClick={() => { setDateF(''); setStaffF('All'); setStatusF('All'); setSearch(''); }}
            style={{
              padding: '8px 14px', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              background: 'rgba(10,24,56,0.8)', color: C.cyan, border: `1px solid ${C.border}`
            }}
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Main List Panel */}
      <ERPPanel>
        <ERPPanelHeader
          title="Staff Daily Routine Work Reports (Official Sheets)"
          icon="📝"
          action={
            <span style={{ fontSize: 11, color: C.muted }}>
              Showing <strong style={{ color: C.cyan }}>{filtered.length}</strong> of {updates.length} reports
            </span>
          }
        />

        {filtered.length === 0 ? (
          <ERPEmpty
            icon="📝"
            title="No daily work reports found"
            sub={
              dateF || staffF !== 'All' || statusF !== 'All' || search
                ? 'No reports match your current filters. Try resetting the filters.'
                : 'Staff submit their routine work reports from the Staff Portal.'
            }
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filtered.map((u, i) => {
              const displayName = u.name || u.staffName || 'Staff';
              const displayDate = u.date || '—';
              const displayDay = u.day || getDayName(u.date);
              const tasks = u.tasks || (u.items ? u.items.map((item, idx) => ({ no: idx + 1, start: u.startTime || '09:00', end: u.endTime || '18:00', hours: u.totalHours || '—', description: item, status: u.status || 'Completed' })) : []);

              return (
                <div
                  key={u.id}
                  style={{
                    padding: '20px',
                    borderTop: i > 0 ? `1px solid ${C.border}30` : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12
                  }}
                >
                  {/* Top Sheet Header Bar */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', borderRadius: 8, background: 'rgba(9,32,74,0.6)',
                    border: `1px solid ${C.borderHi}`, flexWrap: 'wrap', gap: 10
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <ERPAvatar name={displayName} size={32} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 900, color: C.text }}>
                          {displayName} • {u.position || 'Software Associate'}
                        </div>
                        <div style={{ fontSize: 11, color: C.cyan, fontWeight: 700 }}>
                          {displayDate} ({displayDay}) • {u.location || 'SMART Trincomalee'} • {u.workMode || 'On-Site'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        onClick={() => handlePrintSheet(u)}
                        style={{
                          background: 'rgba(255,255,255,0.08)', border: `1px solid ${C.border}`,
                          borderRadius: 6, color: '#fff', padding: '4px 10px', fontSize: 11, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700
                        }}
                      >
                        <Printer size={12} /> Print Sheet
                      </button>
                      <button
                        onClick={() => handleOpenEdit(u)}
                        style={{
                          background: 'rgba(0,102,255,0.12)', border: `1px solid ${C.borderHi}`,
                          borderRadius: 6, color: C.cyan, padding: '4px 10px', fontSize: 11, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700
                        }}
                      >
                        <Pencil size={12} /> Edit
                      </button>
                      <button
                        onClick={(e) => handleDeleteLog(u.id, e)}
                        style={{
                          background: 'rgba(240,90,103,0.12)', border: '1px solid rgba(240,90,103,0.3)',
                          borderRadius: 6, color: C.red, padding: '4px 10px', fontSize: 11, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700
                        }}
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </div>

                  {/* Attendance Bar */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                    gap: 8, padding: '10px 14px', borderRadius: 8, background: 'rgba(10,24,56,0.6)',
                    border: `1px solid ${C.border}`
                  }}>
                    <div>
                      <span style={{ fontSize: 9.5, color: C.muted, fontWeight: 700, display: 'block' }}>ARRIVAL</span>
                      <strong style={{ fontSize: 12, color: C.text }}>{u.arrival || u.startTime || '—'}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: 9.5, color: C.muted, fontWeight: 700, display: 'block' }}>LUNCH START</span>
                      <strong style={{ fontSize: 12, color: C.text }}>{u.lunchStart || '—'}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: 9.5, color: C.muted, fontWeight: 700, display: 'block' }}>LUNCH END</span>
                      <strong style={{ fontSize: 12, color: C.text }}>{u.lunchEnd || '—'}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: 9.5, color: C.muted, fontWeight: 700, display: 'block' }}>LUNCH DURATION</span>
                      <strong style={{ fontSize: 12, color: C.subtle }}>{u.lunchDuration || u.lunchBreak || '—'}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: 9.5, color: C.muted, fontWeight: 700, display: 'block' }}>DEPARTURE</span>
                      <strong style={{ fontSize: 12, color: C.text }}>{u.departure || u.endTime || '—'}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: 9.5, color: C.green, fontWeight: 800, display: 'block' }}>TOTAL WORK HRS</span>
                      <strong style={{ fontSize: 13, color: C.green }}>{u.totalWorkHours || u.totalHours || '—'}</strong>
                    </div>
                  </div>

                  {/* Tasks Table */}
                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                      <thead>
                        <tr style={{ background: 'rgba(14,35,80,0.6)', color: C.muted, textTransform: 'uppercase' }}>
                          <th style={{ padding: '6px 8px', width: 35, textAlign: 'center' }}>NO</th>
                          <th style={{ padding: '6px 8px', width: 75, textAlign: 'center' }}>START</th>
                          <th style={{ padding: '6px 8px', width: 75, textAlign: 'center' }}>END</th>
                          <th style={{ padding: '6px 8px', width: 75, textAlign: 'center' }}>HOURS</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>WORK / DESCRIPTION</th>
                          <th style={{ padding: '6px 8px', width: 110, textAlign: 'center' }}>STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tasks.map((t, idx) => (
                          <tr key={idx} style={{ borderTop: `1px solid ${C.border}20` }}>
                            <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 800, color: C.muted }}>{t.no || idx + 1}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'center' }}>{t.start || '—'}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'center' }}>{t.end || '—'}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700, color: C.cyan }}>{t.hours || '—'}</td>
                            <td style={{ padding: '6px 8px', color: C.text }}>{t.description || '—'}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                              <span style={{
                                fontSize: 9.5, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                                background: t.status === 'Completed' ? 'rgba(24,199,122,0.12)' : 'rgba(245,185,66,0.12)',
                                color: t.status === 'Completed' ? C.green : C.amber,
                                border: `1px solid ${t.status === 'Completed' ? 'rgba(24,199,122,0.3)' : 'rgba(245,185,66,0.3)'}`
                              }}>
                                {t.status || 'Completed'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Remarks */}
                  {(u.remarks || u.notes) && (
                    <div style={{
                      fontSize: 11, color: C.amber, padding: '6px 12px', borderRadius: 6,
                      background: 'rgba(245,185,66,0.06)', border: '1px solid rgba(245,185,66,0.2)'
                    }}>
                      <strong>Remarks:</strong> {u.remarks || u.notes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ERPPanel>

      {/* ── Admin Edit Modal ────────────────────────────────────── */}
      {editingLog && (
        <ERPModal
          title={`Edit Work Report — ${editForm.name}`}
          onClose={() => setEditingLog(null)}
          maxWidth={750}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {editError && (
              <div style={{
                padding: '9px 12px', borderRadius: 8, background: 'rgba(240,90,103,0.1)',
                border: '1px solid rgba(240,90,103,0.3)', color: C.red, fontSize: 12
              }}>
                {editError}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.subtle, marginBottom: 4 }}>Staff Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                  style={{ width: '100%', background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px', color: C.text, fontSize: 12 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.subtle, marginBottom: 4 }}>Position</label>
                <input
                  type="text"
                  value={editForm.position}
                  onChange={e => setEditForm(p => ({ ...p, position: e.target.value }))}
                  style={{ width: '100%', background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px', color: C.text, fontSize: 12 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.subtle, marginBottom: 4 }}>Date</label>
                <input
                  type="date"
                  value={editForm.date}
                  onChange={e => setEditForm(p => ({ ...p, date: e.target.value }))}
                  style={{ width: '100%', background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px', color: C.cyan, fontSize: 12 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.subtle, marginBottom: 4 }}>Work Mode</label>
                <select
                  value={editForm.workMode}
                  onChange={e => setEditForm(p => ({ ...p, workMode: e.target.value }))}
                  style={{ width: '100%', background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px', color: C.text, fontSize: 12 }}
                >
                  {WORK_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            {/* Attendance inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: C.subtle, marginBottom: 3 }}>Arrival</label>
                <input
                  type="time"
                  value={editForm.arrival}
                  onChange={e => setEditForm(p => ({ ...p, arrival: e.target.value }))}
                  style={{ width: '100%', background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px', color: C.text, fontSize: 12 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: C.subtle, marginBottom: 3 }}>Lunch Start</label>
                <input
                  type="time"
                  value={editForm.lunchStart}
                  onChange={e => setEditForm(p => ({ ...p, lunchStart: e.target.value }))}
                  style={{ width: '100%', background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px', color: C.text, fontSize: 12 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: C.subtle, marginBottom: 3 }}>Lunch End</label>
                <input
                  type="time"
                  value={editForm.lunchEnd}
                  onChange={e => setEditForm(p => ({ ...p, lunchEnd: e.target.value }))}
                  style={{ width: '100%', background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px', color: C.text, fontSize: 12 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: C.subtle, marginBottom: 3 }}>Departure</label>
                <input
                  type="time"
                  value={editForm.departure}
                  onChange={e => setEditForm(p => ({ ...p, departure: e.target.value }))}
                  style={{ width: '100%', background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px', color: C.text, fontSize: 12 }}
                />
              </div>
            </div>

            {/* Tasks list */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.subtle }}>Tasks Breakdown</label>
                <button
                  type="button"
                  onClick={handleAddEditTaskRow}
                  style={{
                    background: 'rgba(0,102,255,0.15)', border: `1px solid ${C.borderHi}`, borderRadius: 6,
                    color: C.cyan, padding: '3px 8px', fontSize: 10.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                  }}
                >
                  <Plus size={11} /> Add Row
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                {editForm.tasks.map((task, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: C.muted, width: 18, textAlign: 'center' }}>{idx + 1}</span>
                    <input
                      type="time"
                      value={task.start}
                      onChange={e => handleEditTaskChange(idx, 'start', e.target.value)}
                      style={{ width: 85, background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px', color: C.text, fontSize: 11 }}
                    />
                    <input
                      type="time"
                      value={task.end}
                      onChange={e => handleEditTaskChange(idx, 'end', e.target.value)}
                      style={{ width: 85, background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px', color: C.text, fontSize: 11 }}
                    />
                    <input
                      type="text"
                      value={task.description}
                      placeholder="Task description..."
                      onChange={e => handleEditTaskChange(idx, 'description', e.target.value)}
                      style={{ flex: 1, background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 8px', color: C.text, fontSize: 11.5 }}
                    />
                    <select
                      value={task.status}
                      onChange={e => handleEditTaskChange(idx, 'status', e.target.value)}
                      style={{ width: 105, background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px', color: C.text, fontSize: 11 }}
                    >
                      {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {editForm.tasks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveEditTaskRow(idx)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 3 }}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.subtle, marginBottom: 4 }}>Remarks / Notes</label>
              <textarea
                rows={2}
                value={editForm.remarks}
                onChange={e => setEditForm(p => ({ ...p, remarks: e.target.value }))}
                style={{ width: '100%', background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px', color: C.text, fontSize: 12, resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              <ERPBtn variant="secondary" onClick={() => setEditingLog(null)}>
                Cancel
              </ERPBtn>
              <ERPBtn variant="primary" disabled={savingEdit} onClick={handleSaveEdit}>
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </ERPBtn>
            </div>
          </div>
        </ERPModal>
      )}

    </div>
  );
}
