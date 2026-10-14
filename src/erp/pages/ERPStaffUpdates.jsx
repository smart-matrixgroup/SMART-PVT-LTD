// ─────────────────────────────────────────────────────────────────
//  Phase 3 D — Staff Daily Routine Work Reports (Admin Monitor).
//  Admins can view, search, filter, EDIT, DELETE, and PRINT staff
//  daily work reports matching the standard SMART Pvt Ltd sheet layout.
// ─────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef } from 'react';
import {
  collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, serverTimestamp
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  ERPPanel, ERPPanelHeader, ERPBtn, ERPModal, ERPEmpty, ERPAvatar, C
} from '../components/ERPui';
import {
  toMs, todayKey, calculateTaskDuration, calculateAttendanceHours, getDayName
} from '../../staff/staffUtils';
import { downloadWorkLogSheet } from '../../staff/workLogTemplate';
import { ref as storageRef, getBytes, deleteObject } from 'firebase/storage';
import { storage } from '../../config/firebase';
import {
  AlertTriangle, ClipboardList, Clock, Coffee, Check, Hourglass,
  Pencil, Trash2, Calendar, User, Search, Filter, RefreshCw, Printer,
  FileText, Building, Plus, X, Download, Upload, ChevronLeft, ChevronRight, Send, CheckCircle2
} from 'lucide-react';

const AVATAR_COLORS = ['#0066FF', '#8B5CF6', '#18C77A', '#F5B942', '#F05A67', '#00D9FF'];
const WORK_MODES = ['On-Site / Office', 'Remote / WFH', 'Hybrid'];
const TASK_STATUSES = ['Completed', 'In Progress', 'Pending', 'On Hold'];

// ── Week + CSV helpers (Weekly Report view & Excel import) ──────────────
const pad2 = n => String(n).padStart(2, '0');
const isoAdd = (dStr, n) => {
  const [y, m, d] = dStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
};
const mondayOf = dStr => {
  const [y, m, d] = dStr.split('-').map(Number);
  const dow = (new Date(y, m - 1, d).getDay() + 6) % 7; // Monday = 0
  return isoAdd(dStr, -dow);
};
const fmtShort = dStr => {
  const [y, m, d] = dStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};
// Quoted-CSV parser (Excel / Google-Sheets "save as CSV" compatible)
const parseCsv = text => {
  const rows = []; let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += ch;
    }
    else if (ch === '"') inQ = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    }
    else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim() !== ''));
};
// Reverse of the export format: "08:30-11:00: desc [Status] | ..." → tasks[]
const parseWorkSegments = wd => {
  if (!wd) return [];
  return wd.split('|').map(s => s.trim()).filter(Boolean).map((seg, i) => {
    const m = seg.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s*:\s*(.*)$/);
    const body = m ? m[3] : seg;
    const sm = body.match(/\s*\[([^\]]+)\]\s*$/);
    const status = sm ? sm[1].trim() : 'Completed';
    const description = (sm ? body.slice(0, sm.index) : body).trim();
    if (m) return { no: i + 1, start: m[1], end: m[2], hours: calculateTaskDuration(m[1], m[2]), description, status };
    return { no: i + 1, start: '', end: '', hours: '—', description, status };
  });
};

const REPORT_HEADERS = ['NAME', 'POSITION', 'DATE', 'DAY', 'LOCATION', 'WORK MODE',
  'ARRIVAL', 'LUNCH START', 'LUNCH END', 'LUNCH DURATION', 'DEPARTURE',
  'TOTAL WORK HRS', 'WORK / DESCRIPTION', 'REMARKS', 'PLAN FOR TOMORROW'];

// ── Month helpers (Monthly Report view) ─────────────────────────────────
const addMonths = (dStr, n) => {
  const [y, m] = dStr.split('-').map(Number);
  const dt = new Date(y, m - 1 + n, 1);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-01`;
};
const endOfMonth = dStr => {
  const [y, m] = dStr.split('-').map(Number);
  const dt = new Date(y, m, 0);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
};
const monthLabel = dStr => {
  const [y, m] = dStr.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
};

// ── Tolerant parser for the "DAILY WORK LOG" sheet style CSV ────────────
// (one profile block + one block per day: the format staff/sir already use)
const MONTHS_MAP = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const normTxt = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const nameMatches = (a, b) => {
  const x = normTxt(a), y = normTxt(b);
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
};
const to24h = v => {
  const m = String(v ?? '').trim().match(/^(\d{1,2})[:.](\d{2})\s*(am|pm)?$/i);
  if (!m) return '';
  let h = +m[1];
  const ap = (m[3] || '').toLowerCase();
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  return `${pad2(h)}:${m[2]}`;
};
const sheetDate = v => {
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${pad2(+m[2])}-${pad2(+m[3])}`;
  m = s.match(/^(\d{1,2})[-\/\s]([A-Za-z]{3,})[-\/\s](\d{4})$/);   // 28-Sep-2026
  if (m) { const mm = MONTHS_MAP[m[2].slice(0, 3).toLowerCase()]; if (mm) return `${m[3]}-${pad2(mm)}-${pad2(+m[1])}`; }
  m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);          // 28/09/2026
  if (m) return `${m[3]}-${pad2(+m[2])}-${pad2(+m[1])}`;
  return null;
};
// "2h 00m" / "8h 30m" → "2.0 hrs" ; "1:30" (already hrs) → kept
const normHours = v => {
  const s = String(v ?? '').trim();
  const m = s.match(/^(\d+)\s*h(?:ours?)?\s*(\d+)?\s*m?/i);
  if (m) return `${(parseInt(m[1], 10) + (m[2] ? parseInt(m[2], 10) / 60 : 0)).toFixed(1)} hrs`;
  return s;
};
const labelValue = (row, label) => {
  const idx = row.findIndex(c => normTxt(c) === normTxt(label));
  if (idx < 0) return '';
  const v = String(row[idx + 1] ?? '').trim();   // value always in the adjacent cell
  return /[:]\s*$/.test(v) ? '' : v;             // next cell is another "LABEL :" → no value
};
const parseSheetBlocks = rows => {
  const out = [];
  let cur = null, mode = null, timeCols = null, taskCols = null;
  const profile = { name: '', position: '', location: '' };
  const flush = () => {
    // keep a block only if that day actually has content (tasks / attendance / remarks),
    // so blank pre-dated day blocks in the template are ignored on import
    if (cur && cur.date && (cur.tasks.length || cur.arrival || cur.departure || cur.remarks)) {
      // day blocks may leave NAME/POSITION/LOCATION blank → inherit from Staff Profile
      ['name', 'position', 'location'].forEach(k => { if (!cur[k] && profile[k]) cur[k] = profile[k]; });
      out.push(cur);
    }
    cur = null; mode = null;
  };
  for (const row of rows) {
    const joined = row.join(' ').toUpperCase();
    if (joined.includes('DAILY WORK REPORT')) {
      flush();
      cur = { name: '', position: '', location: '', date: '', day: '', workMode: '', arrival: '', lunchStart: '', lunchEnd: '', lunchDuration: '', departure: '', totalWorkHours: '', tasks: [], remarks: '' };
      continue;
    }
    if (!cur) {
      // pre-block area = the Staff Profile box → remember name/position/location once
      const nv = labelValue(row, 'NAME');         if (nv && !profile.name)     profile.name = nv;
      const pv = labelValue(row, 'POSITION');     if (pv && !profile.position) profile.position = pv;
      const lv = labelValue(row, 'JOB LOCATION') || labelValue(row, 'LOCATION');
      if (lv && !profile.location) profile.location = lv;
      continue;
    }
    if (normTxt(row[0]).startsWith('remarks')) { const v = labelValue(row, 'REMARKS'); if (v) cur.remarks = v; mode = null; continue; }

    // 1. Time-of-day header bar (ARRIVAL / LUNCH START / ...)
    if (row.some(c => normTxt(c) === 'arrival')) {
      timeCols = {};
      row.forEach((c, i) => { const k = normTxt(c); if (k) timeCols[k] = i; });
      mode = 'time'; continue;
    }
    // 2. Task table header row
    if (row.some(c => normTxt(c) === 'workdescription')) {
      taskCols = {};
      row.forEach((c, i) => { const k = normTxt(c); if (k) taskCols[k] = i; });
      mode = 'tasks'; continue;
    }
    const at = (cols, key) => (cols && cols[key] != null && row[cols[key]] != null) ? String(row[cols[key]]).trim() : '';

    if (mode === 'time') {
      cur.arrival = to24h(at(timeCols, 'arrival')) || cur.arrival;
      cur.lunchStart = to24h(at(timeCols, 'lunchstart')) || cur.lunchStart;
      cur.lunchEnd = to24h(at(timeCols, 'lunchend')) || cur.lunchEnd;
      cur.lunchDuration = normHours(at(timeCols, 'lunchduration')) || cur.lunchDuration;
      cur.departure = to24h(at(timeCols, 'departure')) || cur.departure;
      cur.totalWorkHours = normHours(at(timeCols, 'totalworkhrs')) || cur.totalWorkHours;
      mode = null; continue;
    }
    if (mode === 'tasks') {
      const desc = at(taskCols, 'workdescription');
      const start = to24h(at(taskCols, 'start'));
      const end = to24h(at(taskCols, 'end'));
      if (!desc && !start) continue;   // blank task row (up to ~6 per day) → just skip it
      if (desc) {
        cur.tasks.push({
          no: cur.tasks.length + 1,
          start, end,
          hours: normHours(at(taskCols, 'hours')) || (start && end ? calculateTaskDuration(start, end) : '—'),
          description: desc,
          status: at(taskCols, 'status') || 'Completed',
        });
      }
      continue;
    }
    // 3. Meta rows inside the block (NAME / POSITION / LOCATION / DATE / DAY / WORK MODE)
    const nv = labelValue(row, 'NAME');       if (nv && !cur.name)     cur.name = nv;
    const pv = labelValue(row, 'POSITION');   if (pv && !cur.position) cur.position = pv;
    const lv = labelValue(row, 'LOCATION');   if (lv && !cur.location) cur.location = lv;
    const dv = labelValue(row, 'DATE');       if (dv && !cur.date)     cur.date = sheetDate(dv) || '';
    const dyv = labelValue(row, 'DAY');       if (dyv && !cur.day)     cur.day = dyv;
    const wv = labelValue(row, 'WORK MODE');  if (wv && !cur.workMode) cur.workMode = wv;
  }
  flush();
  return out;
};

// ── Read an .xlsx worksheet into the same 2-D string rows as parseCsv ──
const cellText = cell => {
  const v = cell && cell.value;
  if (v == null) return '';
  if (v instanceof Date) return `${v.getFullYear()}-${pad2(v.getMonth() + 1)}-${pad2(v.getDate())}`;
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map(t => t.text).join('');
    if (v.text != null) return String(v.text);
    if (v.result != null) return String(v.result);
    if (v.hyperlink) return String(v.text || v.hyperlink);
    return '';
  }
  return String(v);
};
const xlsxToRows = ws => {
  const rows = [];
  if (!ws) return rows;
  ws.eachRow({ includeEmpty: false }, row => {
    const arr = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => { arr[col - 1] = cellText(cell); });
    for (let i = 0; i < arr.length; i++) if (arr[i] == null) arr[i] = '';
    rows.push(arr);
  });
  return rows.filter(r => r.some(c => String(c).trim() !== ''));
};

const DEV_UPDATES = [];

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

  // Weekly/Monthly view + Excel import
  const [viewMode,   setViewMode]   = useState('daily');           // 'daily' | 'range'
  const [rangeMode,  setRangeMode]  = useState('week');            // 'week' | 'month'
  const [weekStart,  setWeekStart]  = useState(() => mondayOf(todayKey()));
  const [monthStart, setMonthStart] = useState(() => `${todayKey().slice(0, 7)}-01`);
  const [importing,  setImporting]  = useState(false);
  const [importMsg,  setImportMsg]  = useState(null);
  const fileRef = useRef(null);

  // Sent work-sheet requests (admin → staff → back)
  const [requests,   setRequests]   = useState([]);
  const [sendingReq, setSendingReq] = useState(false);
  const [reqMsg,     setReqMsg]     = useState(null);

  // Pick which staff the weekly/monthly sheet goes to (instead of always all)
  const [pickerOpen,       setPickerOpen]       = useState(false);
  const [selectedStaffIds, setSelectedStaffIds] = useState(() => new Set());

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
    planTomorrow: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError,  setEditError]  = useState('');

  useEffect(() => {
    if (!live) {
      setUpdates(DEV_UPDATES);
      setStaff([]);
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
      onSnapshot(
        collection(db, 'reportRequests'),
        snap => setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
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
      planTomorrow: log.planTomorrow || '',
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
        planTomorrow: (editForm.planTomorrow || '').trim(),
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
            ${u.planTomorrow ? `<div class="remarks-box" style="background:#F3EEFF;border-top:1px solid #DDD0FA;"><strong>PLAN FOR TOMORROW:</strong> ${u.planTomorrow}</div>` : ''}
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

  // ── Range aggregation (Weekly Mon–Sun, or Monthly) ──
  const rangeStart = rangeMode === 'week' ? weekStart : monthStart;
  const rangeEnd = rangeMode === 'week' ? isoAdd(weekStart, 6) : endOfMonth(monthStart);
  const rangeReports = updates
    .filter(u => u.date >= rangeStart && u.date <= rangeEnd)
    .sort((a, b) => String(a.name || a.staffName).localeCompare(String(b.name || b.staffName)) || String(a.date).localeCompare(String(b.date)));
  const rangeGroups = {};
  rangeReports.forEach(u => {
    const k = u.name || u.staffName || 'Staff';
    (rangeGroups[k] = rangeGroups[k] || []).push(u);
  });
  const rangeStaff = Object.entries(rangeGroups);
  const rangeLabel = rangeMode === 'week'
    ? `${fmtShort(rangeStart)} – ${fmtShort(rangeEnd)}, ${rangeEnd.slice(0, 4)}`
    : monthLabel(monthStart);

  // Sent work-sheet requests (newest first) + status colour
  const sortedRequests = [...requests].sort((a, b) => toMs(b.requestedAt || b.createdAt) - toMs(a.requestedAt || a.createdAt));
  const reqStatusColor = s => s === 'Returned' ? C.blue : s === 'Approved' ? C.green : C.amber;

  // ── Excel (CSV) export — columns match the STAFF PERFORMANCE REPORT sheet ──
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const toReportRow = u => {
    const tasks = u.tasks || (u.items ? u.items.map((it, i) => ({ no: i + 1, description: it, status: u.status || 'Completed' })) : []);
    const workDesc = tasks.map(t =>
      `${t.start || ''}${t.end ? `-${t.end}` : ''}: ${t.description}` +
      (t.status && t.status !== 'Completed' ? ` [${t.status}]` : '')
    ).join(' | ');
    return [
      u.name || u.staffName || '', u.position || '', u.date || '', u.day || getDayName(u.date),
      u.location || '', u.workMode || '', u.arrival || u.startTime || '',
      u.lunchStart || '', u.lunchEnd || '', u.lunchDuration || '',
      u.departure || u.endTime || '', u.totalWorkHours || '',
      workDesc, u.remarks || u.notes || '', u.planTomorrow || '',
    ];
  };
  const downloadCsv = (list, filename) => {
    // BOM so Excel opens Tamil/unicode text correctly
    const csv = '\uFEFF' + REPORT_HEADERS.map(esc).join(',') + '\r\n' +
      list.map(u => toReportRow(u).map(esc).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const exportExcel = () => downloadCsv(filtered, `STAFF-PERFORMANCE-REPORT-${todayKey()}.csv`);
  const exportRange = () => downloadCsv(rangeReports,
    `STAFF-${rangeMode === 'week' ? 'WEEKLY' : 'MONTHLY'}-REPORT-${rangeStart}.csv`);

  // ── Import template A — flat one-row-per-day CSV ──
  const downloadTemplate = () => {
    const example = [
      'Ashan Perera', 'Software Associate - II', todayKey(), getDayName(todayKey()),
      'SMART Trincomalee', 'On-Site / Office', '08:30', '13:00', '14:00', '1.0 hrs',
      '17:30', '8.0 hrs',
      '08:30-11:00: Example task — DELETE THIS ROW BEFORE IMPORT', 'Remarks here', 'Plan for tomorrow here',
    ].map(esc).join(',');
    const csv = '\uFEFF' + REPORT_HEADERS.map(esc).join(',') + '\r\n' + example;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'STAFF-REPORT-IMPORT-TEMPLATE.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ── Import template B — the "IT TEAM DAILY WORK LOG" sheet style, as a
  //    real .xlsx workbook (coloured banners, merged title, borders,
  //    column widths and STATUS dropdown — matches sir's Google Sheet).
  //    If `forStaff` is passed, name/position/location are pre-filled.
  //    The workbook itself is built by the shared workLogTemplate module so
  //    the Staff Portal renders the identical sheet from a sent request.
  // ──
  const downloadSheetTemplate = (forStaff) => downloadWorkLogSheet(forStaff || {}, {
    period: rangeMode,
    rangeStart: rangeMode === 'week' ? weekStart : monthStart,
  });

  // ── Core import routine — shared by file upload AND returned sheets ──
  //    Accepts BOTH formats:
  //      A) flat one-row-per-day template (NAME, DATE, WORK / DESCRIPTION…)
  //      B) the "IT TEAM DAILY WORK LOG" multi-block sheet (one block per day)
  //    Each imported day is routed to the matching staff member (name → authUid).
  const runImport = async (rows) => {
    if (!rows.length) throw new Error('The file is empty.');

    const head = rows[0].map(h => String(h).trim().toUpperCase());
    const idx = {};
    REPORT_HEADERS.forEach(h => { idx[h] = head.indexOf(h); });
    const flat = idx['NAME'] >= 0 && idx['DATE'] >= 0;
    const sheet = rows.some(r => r.join(' ').toUpperCase().includes('DAILY WORK REPORT'));

    // Normalise every source row/block into the same entry shape.
    let entries = [];
    if (flat) {
      const cell = (r, h) => { const i = idx[h]; return i >= 0 ? String(r[i] ?? '').trim() : ''; };
      entries = rows.slice(1).map(r => ({
        name: cell(r, 'NAME'), position: cell(r, 'POSITION'), location: cell(r, 'LOCATION'),
        date: sheetDate(cell(r, 'DATE')), rawDate: cell(r, 'DATE'), day: cell(r, 'DAY'),
        workMode: cell(r, 'WORK MODE'),
        arrival: to24h(cell(r, 'ARRIVAL')), lunchStart: to24h(cell(r, 'LUNCH START')),
        lunchEnd: to24h(cell(r, 'LUNCH END')), departure: to24h(cell(r, 'DEPARTURE')),
        lunchDuration: cell(r, 'LUNCH DURATION'), totalWorkHours: cell(r, 'TOTAL WORK HRS'),
        tasks: parseWorkSegments(cell(r, 'WORK / DESCRIPTION')),
        remarks: cell(r, 'REMARKS'), planTomorrow: cell(r, 'PLAN FOR TOMORROW'),
      }));
    } else if (sheet) {
      entries = parseSheetBlocks(rows);
    } else {
      throw new Error('Unrecognised format — download the "Excel Template" or "Sheet Template" and fill that.');
    }

    let added = 0, updated = 0, skipped = 0;
    const problems = [];
    for (const it of entries) {
      const name = String(it.name || '').trim();
      const date = it.date;
      if (!name || !date) { skipped++; if (name && it.rawDate) problems.push(`bad date "${it.rawDate}" (${name})`); continue; }

      const match = staff.find(s => nameMatches(s.name || '', name));
      const authUid = (match && (match.authUid || match.id)) || '';
      const arrival = it.arrival || '', lunchStart = it.lunchStart || '', lunchEnd = it.lunchEnd || '', departure = it.departure || '';
      const calc = arrival && departure
        ? calculateAttendanceHours(arrival, lunchStart, lunchEnd, departure) : {};
      const tasks = (it.tasks || []).map((t, i) => ({ no: i + 1, ...t }));

      const payload = {
        name,
        position: it.position || (match && match.role) || 'Staff',
        location: it.location || 'SMART Trincomalee',
        date,
        day: it.day || getDayName(date),
        workMode: it.workMode || 'On-Site / Office',
        arrival, lunchStart, lunchEnd, departure,
        lunchDuration: it.lunchDuration || calc.lunchDuration || '—',
        totalWorkHours: it.totalWorkHours || calc.totalWorkHours || '—',
        tasks,
        remarks: it.remarks || '',
        planTomorrow: it.planTomorrow || '',
        staffId: (match && match.id) || authUid,
        staffName: name,
        authUid,
        workDescription: tasks.map(t => `${t.start}${t.end ? `-${t.end}` : ''}: ${t.description}`).join(' | '),
        items: tasks.map(t => t.description),
        status: tasks.length && tasks.every(t => t.status === 'Completed') ? 'Completed' : 'Pending',
        updatedAt: serverTimestamp(),
      };

      const existing = updates.find(u => u.date === date && (
        (authUid && (u.authUid === authUid || u.staffId === authUid)) ||
        nameMatches(u.name || u.staffName || '', name)
      ));

      if (live) {
        if (existing) {
          await updateDoc(doc(db, 'dailyUpdates', existing.id), payload);
        } else {
          payload.submittedAt = serverTimestamp();
          payload.createdAt = serverTimestamp();
          await addDoc(collection(db, 'dailyUpdates'), payload);
        }
      } else if (existing) {
        setUpdates(prev => prev.map(u => u.id === existing.id ? { ...u, ...payload, updatedAt: Date.now() } : u));
      } else {
        setUpdates(prev => [{ id: `imp-${Date.now()}-${added}`, ...payload, submittedAt: Date.now() }, ...prev]);
      }
      existing ? updated++ : added++;
    }

    if (!added && !updated && !skipped) throw new Error('No dated rows found — make sure each day has a DATE cell.');
    return { added, updated, skipped, problems, label: flat ? 'Excel template' : 'Sheet format' };
  };

  const summarize = ({ added, updated, skipped, problems, label }) =>
    `Import complete (${label}) — ${added} new, ${updated} updated, ${skipped} skipped` +
    (problems.length ? ` (${problems.slice(0, 3).join('; ')}${problems.length > 3 ? '…' : ''})` : '');

  const handleImportFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      let rows;
      if (ext === 'xlsx' || ext === 'xls') {
        const ExcelJS = (await import('exceljs')).default;
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(await file.arrayBuffer());
        rows = xlsxToRows(wb.worksheets[0]);
      } else {
        rows = parseCsv((await file.text()).replace(/^\uFEFF/, ''));
      }
      const res = await runImport(rows);
      setImportMsg({ kind: res.problems.length ? 'warn' : 'ok', text: summarize(res) });
    } catch (err) {
      console.error(err);
      setImportMsg({ kind: 'err', text: `Import failed — ${err.message || err}` });
    } finally {
      setImporting(false);
    }
  };

  // ── Send a pre-filled work-log sheet to staff (one request per person) ──
  const sendSheet = async (targets) => {
    const list = (targets || []).filter(s => s && (s.authUid || s.id) && s.name);
    if (!list.length) { setReqMsg({ kind: 'err', text: 'No staff to send to.' }); return; }
    const period = rangeMode;
    const rangeStart = rangeMode === 'week' ? weekStart : monthStart;
    const end = rangeEnd;
    const label = rangeLabel;
    setSendingReq(true);
    setReqMsg(null);
    try {
      if (live) {
        for (const s of list) {
          const uid = s.authUid || s.id;
          await addDoc(collection(db, 'reportRequests'), {
            staffUid: uid,
            staffName: s.name,
            position: s.role || s.position || '',
            location: s.location || '',
            period, rangeStart, rangeEnd: end, rangeLabel: label,
            status: 'Requested',
            requestedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } else {
        setRequests(prev => [
          ...list.map((s, i) => ({
            id: `req-dev-${Date.now()}-${i}`, staffUid: s.authUid || s.id, staffName: s.name,
            position: s.role || '', location: s.location || '',
            period, rangeStart, rangeEnd: end, rangeLabel: label, status: 'Requested',
            requestedAt: Date.now(),
          })),
          ...prev,
        ]);
      }
      setReqMsg({ kind: 'ok', text: `Sheet sent to ${list.length} staff member${list.length > 1 ? 's' : ''} for ${label}. They'll see it in their portal under “Work Sheets”.` });
    } catch (err) {
      console.error(err);
      setReqMsg({ kind: 'err', text: `Could not send — ${err.message || err}` });
    } finally {
      setSendingReq(false);
    }
  };
  const sendToAll = () => sendSheet(staff);

  // ── Staff picker for "Send Sheet" ──────────────────────────────
  const staffKey = s => s.authUid || s.id;
  const toggleStaffPick = (s) => {
    const key = staffKey(s);
    setSelectedStaffIds(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };
  const selectAllStaff = () => setSelectedStaffIds(new Set(staff.map(staffKey)));
  const clearStaffPick   = () => setSelectedStaffIds(new Set());
  const sendToSelected = async () => {
    const targets = staff.filter(s => selectedStaffIds.has(staffKey(s)));
    if (!targets.length) { setReqMsg({ kind: 'err', text: 'Select at least one staff member first.' }); return; }
    await sendSheet(targets);
    setSelectedStaffIds(new Set());
    setPickerOpen(false);
  };

  // ── Download a staff's returned file (SDK read, never a public URL) ──
  const downloadReturned = async (req, mode = 'file') => {
    if (!req.returnedPath) return;
    try {
      const bytes = await getBytes(storageRef(storage, req.returnedPath));
      if (mode === 'import') {
        setImporting(true); setImportMsg(null);
        const ExcelJS = (await import('exceljs')).default;
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(bytes);
        const rows = xlsxToRows(wb.worksheets[0]);
        const res = await runImport(rows);
        setImportMsg({ kind: res.problems.length ? 'warn' : 'ok', text: `Returned sheet (${req.staffName}) — ${summarize(res)}` });
        return;
      }
      const url = URL.createObjectURL(new Blob([bytes]));
      const a = document.createElement('a');
      a.href = url; a.download = req.returnedName || `${req.staffName}-WORK-LOG.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setImportMsg({ kind: 'err', text: `Could not read the returned sheet — ${err.message || err}` });
    } finally {
      setImporting(false);
    }
  };

  const deleteRequest = async (req) => {
    if (!window.confirm(`Delete this request for ${req.staffName}?`)) return;
    try {
      if (live) {
        if (req.returnedPath) { try { await deleteObject(storageRef(storage, req.returnedPath)); } catch { /* ignore */ } }
        await deleteDoc(doc(db, 'reportRequests', req.id));
      } else {
        setRequests(prev => prev.filter(r => r.id !== req.id));
      }
    } catch (err) { alert('Delete failed: ' + (err.message || err)); }
  };

  const markApproved = async (req) => {
    try {
      if (live) await updateDoc(doc(db, 'reportRequests', req.id), { status: 'Approved', updatedAt: serverTimestamp() });
      else setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'Approved' } : r));
    } catch (err) { alert('Could not update: ' + (err.message || err)); }
  };


  // ── Print range sheet (all staff, selected week or month) ──
  const handlePrintWeek = () => {
    const rangeNoun = rangeMode === 'week' ? 'WEEKLY' : 'MONTHLY';
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>SMART Pvt Ltd — ${rangeMode === 'week' ? 'Weekly' : 'Monthly'} Work Report (${rangeLabel})</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 24px; color: #040D1F; }
            .sheet { border: 2px solid #0E3A73; border-radius: 8px; overflow: hidden; max-width: 960px; margin: 0 auto 20px; }
            .header { background: #0E3A73; color: #fff; padding: 12px; text-align: center; font-size: 15px; font-weight: 800; }
            .staff-name { background: #1B4D89; color: #fff; padding: 8px 12px; font-size: 13px; font-weight: 800; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #CBD5E1; padding: 6px 8px; }
            th { background: #E2E8F0; text-align: center; }
            .center { text-align: center; font-weight: 700; }
            .total-row td { background: #E8F5E9; font-weight: 800; color: #166534; }
            @media print { body { padding: 0; } .page-break { page-break-before: always; } }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="header">SMART PVT LTD • ${rangeNoun} WORK REPORT — ${rangeLabel}</div>
            ${rangeStaff.map(([name, reps]) => {
              const hrs = reps.reduce((t, u) => t + (parseFloat(u.totalWorkHours || u.totalHours) || 0), 0);
              return `
                <div class="staff-name">${name} — ${reps[0]?.position || 'Staff'} (${reps.length} days • ${hrs.toFixed(1)} hrs)</div>
                <table>
                  <tr><th>DAY</th><th>DATE</th><th>ARRIVAL</th><th>DEPARTURE</th><th>TOTAL HRS</th><th>WORK / DESCRIPTION</th><th>REMARKS</th></tr>
                  ${reps.map(r => `
                    <tr>
                      <td class="center">${r.day || getDayName(r.date)}</td>
                      <td class="center">${r.date}</td>
                      <td class="center">${r.arrival || r.startTime || '—'}</td>
                      <td class="center">${r.departure || r.endTime || '—'}</td>
                      <td class="center">${r.totalWorkHours || r.totalHours || '—'}</td>
                      <td>${r.workDescription || (r.tasks || []).map(t => t.description).join(' | ') || '—'}</td>
                      <td>${r.remarks || r.notes || '—'}</td>
                    </tr>
                  `).join('')}
                  <tr class="total-row"><td colspan="4" style="text-align:right;">${rangeMode === 'week' ? 'WEEK' : 'MONTH'} TOTAL</td><td class="center">${hrs.toFixed(1)} hrs</td><td colspan="2"></td></tr>
                </table>
              `;
            }).join('')}
          </div>
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  };

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

      {/* View mode toggle + Excel import tools */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', background: 'rgba(10,24,56,0.7)' }}>
          <button
            onClick={() => setViewMode('daily')}
            style={{
              padding: '8px 16px', fontSize: 11, fontWeight: 800, cursor: 'pointer', border: 'none',
              display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s ease',
              background: viewMode === 'daily' ? 'rgba(0,102,255,0.2)' : 'transparent',
              color: viewMode === 'daily' ? C.cyan : C.muted,
            }}
          >
            <FileText size={12} /> Daily Reports
          </button>
          <button
            onClick={() => setViewMode('range')}
            style={{
              padding: '8px 16px', fontSize: 11, fontWeight: 800, cursor: 'pointer', border: 'none',
              display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s ease',
              background: viewMode === 'range' ? 'rgba(139,92,246,0.2)' : 'transparent',
              color: viewMode === 'range' ? C.violet : C.muted,
            }}
          >
            <Calendar size={12} /> Weekly / Monthly Report
          </button>
        </div>

        <button
          onClick={downloadTemplate}
          title="Download the Excel/CSV template — fill one row per staff per day, then Import"
          style={{
            padding: '8px 14px', borderRadius: 10, fontSize: 11, fontWeight: 800, cursor: 'pointer',
            background: 'rgba(0,217,255,0.08)', color: C.cyan, border: `1px solid ${C.borderHi}`,
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <Download size={12} /> Excel Template
        </button>

        <button
          onClick={downloadSheetTemplate}
          title="Download a blank IT TEAM DAILY WORK LOG template (.xlsx) — one block per day, 6 task rows each, for the selected Week/Month"
          style={{
            padding: '8px 14px', borderRadius: 10, fontSize: 11, fontWeight: 800, cursor: 'pointer',
            background: 'rgba(0,217,255,0.08)', color: C.cyan, border: `1px solid ${C.borderHi}`,
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <FileText size={12} /> Blank Sheet Template
        </button>

        <button
          onClick={() => fileRef.current && fileRef.current.click()}
          disabled={importing}
          title="Import a filled template (.xlsx or .csv). Old data is added; same staff + date rows update existing reports."
          style={{
            padding: '8px 14px', borderRadius: 10, fontSize: 11, fontWeight: 800, cursor: 'pointer',
            background: importing ? 'rgba(10,24,56,0.4)' : 'rgba(139,92,246,0.12)',
            color: C.violet, border: '1px solid rgba(139,92,246,0.35)',
            display: 'flex', alignItems: 'center', gap: 6, opacity: importing ? 0.6 : 1,
          }}
        >
          <Upload size={12} /> {importing ? 'Importing…' : 'Import Excel (xlsx / csv)'}
        </button>
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleImportFile} style={{ display: 'none' }} />

        <span style={{ fontSize: 10.5, color: C.muted }}>
          Blank Template = anyone can fill. To send a sheet, open the Weekly/Monthly view and use “Send Sheet ▼” to pick specific staff (or “Send to All Staff”, or the per-person “Send Sheet” button) — it lands in their portal under “Work Sheets”, they fill it and send it back, then you download or import it here. Both .xlsx and .csv can be imported.
        </span>
      </div>

      {importMsg && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, fontSize: 12,
          background: importMsg.kind === 'err' ? 'rgba(240,90,103,0.1)' : importMsg.kind === 'warn' ? 'rgba(245,185,66,0.1)' : 'rgba(24,199,122,0.1)',
          border: `1px solid ${importMsg.kind === 'err' ? 'rgba(240,90,103,0.35)' : importMsg.kind === 'warn' ? 'rgba(245,185,66,0.35)' : 'rgba(24,199,122,0.35)'}`,
          color: importMsg.kind === 'err' ? C.red : importMsg.kind === 'warn' ? C.amber : C.green
        }}>
          {importMsg.kind === 'ok' ? <Check size={14} /> : <AlertTriangle size={14} />} {importMsg.text}
        </div>
      )}

      {viewMode === 'daily' && (
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

        <button
          onClick={exportExcel}
          disabled={filtered.length === 0}
          title="Download filtered reports as an Excel-openable sheet"
          style={{
            padding: '8px 14px', borderRadius: 10, fontSize: 11, fontWeight: 800, cursor: 'pointer',
            background: filtered.length === 0 ? 'rgba(10,24,56,0.4)' : 'rgba(24,199,122,0.12)',
            color: C.green, border: '1px solid rgba(24,199,122,0.35)',
            display: 'flex', alignItems: 'center', gap: 6, opacity: filtered.length === 0 ? 0.5 : 1,
          }}
        >
          <Download size={12} /> Export Excel ({filtered.length})
        </button>
      </div>
      )}

      {/* ── Weekly / Monthly Report view (per staff) ── */}
      {viewMode === 'range' && (
        <ERPPanel>
          <ERPPanelHeader
            title={`${rangeMode === 'week' ? 'Weekly' : 'Monthly'} Work Report — ${rangeLabel}`}
            icon="📅"
            action={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => { setPickerOpen(v => !v); setReqMsg(null); }}
                  disabled={sendingReq || staff.length === 0}
                  title="Choose which staff members receive this sheet"
                  style={{
                    padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: 'pointer',
                    background: 'rgba(34,211,238,0.12)', color: C.cyan, border: '1px solid rgba(34,211,238,0.35)',
                    display: 'flex', alignItems: 'center', gap: 5, opacity: (sendingReq || staff.length === 0) ? 0.6 : 1,
                  }}
                >
                  <Send size={12} /> Send Sheet {pickerOpen ? '▲' : '▼'}
                </button>
                <button
                  onClick={sendToAll}
                  disabled={sendingReq || staff.length === 0}
                  title={`Send this ${rangeMode === 'week' ? 'week' : 'month'}'s pre-filled sheet to ALL staff via their portal`}
                  style={{
                    padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: 'pointer',
                    background: 'rgba(139,92,246,0.14)', color: C.violet, border: '1px solid rgba(139,92,246,0.35)',
                    display: 'flex', alignItems: 'center', gap: 5, opacity: (sendingReq || staff.length === 0) ? 0.6 : 1,
                  }}
                >
                  <Send size={12} /> {sendingReq ? 'Sending…' : 'Send to All Staff'}
                </button>
                <button
                  onClick={exportRange}
                  disabled={rangeReports.length === 0}
                  style={{
                    padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: 'pointer',
                    background: 'rgba(24,199,122,0.12)', color: C.green, border: '1px solid rgba(24,199,122,0.35)',
                    display: 'flex', alignItems: 'center', gap: 5, opacity: rangeReports.length === 0 ? 0.5 : 1,
                  }}
                >
                  <Download size={12} /> {rangeMode === 'week' ? 'Week' : 'Month'} CSV
                </button>
                <button
                  onClick={handlePrintWeek}
                  disabled={rangeReports.length === 0}
                  style={{
                    padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: 'pointer',
                    background: 'rgba(255,255,255,0.08)', color: '#fff', border: `1px solid ${C.border}`,
                    display: 'flex', alignItems: 'center', gap: 5, opacity: rangeReports.length === 0 ? 0.5 : 1,
                  }}
                >
                  <Printer size={12} /> Print {rangeMode === 'week' ? 'Week' : 'Month'}
                </button>
              </div>
            }
          />

          {/* ── Staff picker (opens from "Send Sheet ▼") ── */}
          {pickerOpen && (
            <div style={{
              margin: '0 18px 4px', padding: 12, borderRadius: 10,
              background: 'rgba(34,211,238,0.05)', border: '1px solid rgba(34,211,238,0.25)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: C.cyan }}>
                  Select staff for <span style={{ color: C.text }}>{rangeLabel}</span> — {selectedStaffIds.size} of {staff.length} chosen
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={selectAllStaff} style={{ padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 800, cursor: 'pointer', background: 'rgba(255,255,255,0.06)', color: C.text, border: `1px solid ${C.border}` }}>Select All</button>
                  <button onClick={clearStaffPick} style={{ padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 800, cursor: 'pointer', background: 'transparent', color: C.muted, border: `1px solid ${C.border}` }}>Clear</button>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
                {staff.map(s => {
                  const key = staffKey(s);
                  const on = selectedStaffIds.has(key);
                  return (
                    <button
                      key={key}
                      onClick={() => toggleStaffPick(s)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 7, padding: '7px 11px', borderRadius: 8, cursor: 'pointer',
                        fontSize: 11, fontWeight: 700, transition: 'all .15s',
                        background: on ? 'rgba(34,211,238,0.16)' : 'rgba(255,255,255,0.04)',
                        color: on ? C.cyan : C.muted,
                        border: `1px solid ${on ? 'rgba(34,211,238,0.5)' : C.border + '40'}`,
                      }}
                    >
                      <span style={{
                        width: 15, height: 15, borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        background: on ? C.cyan : 'transparent', border: `1.5px solid ${on ? C.cyan : C.border}`, color: '#040D1F', fontSize: 10, fontWeight: 900,
                      }}>{on ? '✓' : ''}</span>
                      <span>
                        {s.name}
                        <span style={{ display: 'block', fontSize: 9, fontWeight: 600, color: on ? C.cyan : C.muted, opacity: .75 }}>{s.role || s.position || 'Staff'}</span>
                      </span>
                    </button>
                  );
                })}
                {staff.length === 0 && (
                  <span style={{ fontSize: 11, color: C.muted }}>No staff found — add staff in ERP → Staff first.</span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <button
                  onClick={sendToSelected}
                  disabled={sendingReq || selectedStaffIds.size === 0}
                  style={{
                    padding: '7px 14px', borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: 'pointer',
                    background: selectedStaffIds.size ? 'rgba(34,211,238,0.18)' : 'rgba(255,255,255,0.05)',
                    color: selectedStaffIds.size ? C.cyan : C.muted,
                    border: '1px solid rgba(34,211,238,0.4)', opacity: (sendingReq || selectedStaffIds.size === 0) ? 0.6 : 1,
                  }}
                >
                  {sendingReq ? 'Sending…' : `Send Sheet to ${selectedStaffIds.size} Staff`}
                </button>
                <button onClick={() => setPickerOpen(false)} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: 'transparent', color: C.muted, border: `1px solid ${C.border}` }}>Cancel</button>
                {reqMsg && (
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: reqMsg.kind === 'err' ? C.red : reqMsg.kind === 'warn' ? C.amber : C.green }}>{reqMsg.text}</span>
                )}
              </div>
            </div>
          )}

          {/* Week / Month mode + range navigator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderBottom: `1px solid ${C.border}30`, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
              {['week', 'month'].map(m => (
                <button
                  key={m}
                  onClick={() => setRangeMode(m)}
                  style={{
                    padding: '5px 12px', fontSize: 10.5, fontWeight: 800, cursor: 'pointer', border: 'none',
                    background: rangeMode === m ? 'rgba(139,92,246,0.22)' : 'transparent',
                    color: rangeMode === m ? C.violet : C.muted,
                  }}
                >
                  {m === 'week' ? 'Week' : 'Month'}
                </button>
              ))}
            </div>
            <button
              onClick={() => rangeMode === 'week'
                ? setWeekStart(w => isoAdd(w, -7))
                : setMonthStart(m => addMonths(m, -1))}
              style={{ padding: 6, borderRadius: 8, cursor: 'pointer', background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`, color: C.cyan, display: 'flex' }}
            >
              <ChevronLeft size={14} />
            </button>
            <div style={{ fontSize: 13, fontWeight: 900, color: C.text }}>{rangeLabel}</div>
            <button
              onClick={() => rangeMode === 'week'
                ? setWeekStart(w => isoAdd(w, 7))
                : setMonthStart(m => addMonths(m, 1))}
              style={{ padding: 6, borderRadius: 8, cursor: 'pointer', background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`, color: C.cyan, display: 'flex' }}
            >
              <ChevronRight size={14} />
            </button>
            <button
              onClick={() => rangeMode === 'week'
                ? setWeekStart(mondayOf(todayKey()))
                : setMonthStart(`${todayKey().slice(0, 7)}-01`)}
              style={{ padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700, background: 'rgba(0,102,255,0.12)', border: `1px solid ${C.borderHi}`, color: C.cyan }}
            >
              {rangeMode === 'week' ? 'This Week' : 'This Month'}
            </button>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: C.muted }}>
              <strong style={{ color: C.violet }}>{rangeStaff.length}</strong> staff • <strong style={{ color: C.cyan }}>{rangeReports.length}</strong> daily reports this {rangeMode}
            </span>
          </div>

          {rangeStaff.length === 0 ? (
            <ERPEmpty
              icon="📅"
              title={`No reports this ${rangeMode}`}
              sub={`Staff daily work reports for the selected ${rangeMode} appear here grouped per person as a ${rangeMode === 'week' ? 'weekly' : 'monthly'} summary.`}
            />
          ) : rangeStaff.map(([name, reps], gi) => {
            const hrs = reps.reduce((t, u) => t + (parseFloat(u.totalWorkHours || u.totalHours) || 0), 0);
            return (
              <div key={name} style={{ padding: '16px 18px', borderTop: gi > 0 ? `1px solid ${C.border}30` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                  <ERPAvatar name={name} size={30} />
                  <span style={{ fontSize: 13, fontWeight: 900, color: C.text }}>{name}</span>
                  <span style={{ fontSize: 11, color: C.subtle }}>{(reps[0] && reps[0].position) || 'Staff'}</span>
                  <div style={{ flex: 1 }} />
                  <button
                    onClick={() => downloadSheetTemplate({ name, position: (reps[0] && reps[0].position) || '', location: (reps[0] && reps[0].location) || '' })}
                    title={`Download a pre-filled ${rangeMode === 'week' ? 'weekly' : 'monthly'} sheet for ${name} to fill and send back`}
                    style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 800, cursor: 'pointer',
                      background: 'rgba(0,217,255,0.1)', color: C.cyan, border: `1px solid ${C.borderHi}`,
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <FileText size={11} /> Download Sheet
                  </button>
                  <button
                    onClick={() => sendSheet([{ name, authUid: reps[0] && (reps[0].authUid || reps[0].staffId), id: reps[0] && reps[0].staffId, position: reps[0] && reps[0].position, location: reps[0] && reps[0].location }])}
                    title={`Send the ${rangeMode === 'week' ? 'weekly' : 'monthly'} sheet to ${name} through their portal`}
                    style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 800, cursor: 'pointer',
                      background: 'rgba(139,92,246,0.12)', color: C.violet, border: '1px solid rgba(139,92,246,0.35)',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <Send size={11} /> Send Sheet
                  </button>
                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
                    background: 'rgba(24,199,122,0.12)', color: C.green, border: '1px solid rgba(24,199,122,0.3)'
                  }}>
                    {reps.length} days present
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
                    background: 'rgba(0,217,255,0.1)', color: C.cyan, border: `1px solid ${C.borderHi}`
                  }}>
                    {hrs.toFixed(1)} hrs total
                  </span>
                </div>
                <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                    <thead>
                      <tr style={{ background: 'rgba(14,35,80,0.6)', color: C.muted, textTransform: 'uppercase' }}>
                        <th style={{ padding: '6px 8px', width: 70, textAlign: 'center' }}>DAY</th>
                        <th style={{ padding: '6px 8px', width: 85, textAlign: 'center' }}>DATE</th>
                        <th style={{ padding: '6px 8px', width: 65, textAlign: 'center' }}>ARRIVAL</th>
                        <th style={{ padding: '6px 8px', width: 70, textAlign: 'center' }}>DEPARTURE</th>
                        <th style={{ padding: '6px 8px', width: 75, textAlign: 'center' }}>TOTAL HRS</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left' }}>WORK / DESCRIPTION</th>
                        <th style={{ padding: '6px 8px', width: 180, textAlign: 'left' }}>REMARKS / PLAN</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reps.map(r => (
                        <tr key={r.id} style={{ borderTop: `1px solid ${C.border}20` }}>
                          <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 800, color: C.subtle }}>{r.day || getDayName(r.date)}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'center', color: C.muted }}>{r.date}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'center' }}>{r.arrival || r.startTime || '—'}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'center' }}>{r.departure || r.endTime || '—'}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 800, color: C.green }}>{r.totalWorkHours || r.totalHours || '—'}</td>
                          <td style={{ padding: '6px 8px', color: C.text }}>
                            {r.workDescription || (r.tasks || []).map(t => t.description).join(' | ') || (r.items || []).join(' | ') || '—'}
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            {(r.remarks || r.notes) && <div style={{ color: C.amber, fontSize: 10.5 }}><strong>RMK:</strong> {r.remarks || r.notes}</div>}
                            {r.planTomorrow && <div style={{ color: C.violet, fontSize: 10.5 }}><strong>PLAN:</strong> {r.planTomorrow}</div>}
                            {!(r.remarks || r.notes || r.planTomorrow) && <span style={{ color: C.muted }}>—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </ERPPanel>
      )}

      {/* ── Sent Work Sheets — admin → staff → returned back ── */}
      {viewMode === 'range' && (
        <ERPPanel>
          <ERPPanelHeader
            title="Work Sheets Sent to Staff"
            icon="📤"
            action={<span style={{ fontSize: 11, color: C.muted }}>{sortedRequests.length} request{sortedRequests.length === 1 ? '' : 's'}</span>}
          />

          {reqMsg && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, margin: '12px 18px 0', padding: '10px 14px', borderRadius: 10, fontSize: 12,
              background: reqMsg.kind === 'err' ? 'rgba(240,90,103,0.1)' : 'rgba(24,199,122,0.1)',
              border: `1px solid ${reqMsg.kind === 'err' ? 'rgba(240,90,103,0.35)' : 'rgba(24,199,122,0.35)'}`,
              color: reqMsg.kind === 'err' ? C.red : C.green,
            }}>
              {reqMsg.kind === 'err' ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />} {reqMsg.text}
            </div>
          )}

          {sortedRequests.length === 0 ? (
            <ERPEmpty
              icon="📤"
              title="No sheets sent yet"
              sub="Pick a Week/Month above, then use “Send Sheet ▼” to choose specific staff (or “Send to All Staff” / the per-person “Send Sheet” button) — the sheet appears in each staff member's portal under “Work Sheets”, they fill it and send it back here."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {sortedRequests.map((req, i) => (
                <div
                  key={req.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                    padding: '14px 18px', borderTop: i > 0 ? `1px solid ${C.border}30` : 'none',
                  }}
                >
                  <ERPAvatar name={req.staffName || 'Staff'} size={30} />
                  <div style={{ minWidth: 180 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: C.text }}>{req.staffName || 'Staff'}</div>
                    <div style={{ fontSize: 10.5, color: C.muted }}>
                      {req.period === 'week' ? 'Weekly' : 'Monthly'} • {req.rangeLabel || `${req.rangeStart} → ${req.rangeEnd}`}
                    </div>
                  </div>

                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
                    background: `${reqStatusColor(req.status)}22`, color: reqStatusColor(req.status),
                    border: `1px solid ${reqStatusColor(req.status)}55`,
                  }}>
                    {req.status || 'Requested'}
                  </span>

                  <div style={{ flex: 1 }} />

                  {req.status === 'Requested' && (
                    <span style={{ fontSize: 10.5, color: C.muted }}>Waiting for staff to return the sheet…</span>
                  )}

                  {req.returnedPath && (
                    <>
                      <button
                        onClick={() => downloadReturned(req)}
                        title="Download the sheet the staff member sent back"
                        style={{
                          padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: 'pointer',
                          background: 'rgba(24,199,122,0.12)', color: C.green, border: '1px solid rgba(24,199,122,0.35)',
                          display: 'flex', alignItems: 'center', gap: 5,
                        }}
                      >
                        <Download size={12} /> Download Returned
                      </button>
                      <button
                        onClick={() => downloadReturned(req, 'import')}
                        disabled={importing}
                        title="Import the returned sheet into the daily reports"
                        style={{
                          padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: 'pointer',
                          background: 'rgba(0,217,255,0.1)', color: C.cyan, border: `1px solid ${C.borderHi}`,
                          display: 'flex', alignItems: 'center', gap: 5, opacity: importing ? 0.6 : 1,
                        }}
                      >
                        <Upload size={12} /> Import to Reports
                      </button>
                      {req.status !== 'Approved' && (
                        <button
                          onClick={() => markApproved(req)}
                          title="Mark this return as approved"
                          style={{
                            padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: 'pointer',
                            background: 'rgba(0,102,255,0.12)', color: C.cyan, border: `1px solid ${C.borderHi}`,
                            display: 'flex', alignItems: 'center', gap: 5,
                          }}
                        >
                          <Check size={12} /> Approve
                        </button>
                      )}
                    </>
                  )}

                  <button
                    onClick={() => deleteRequest(req)}
                    title="Delete this request"
                    style={{
                      padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: 'pointer',
                      background: 'rgba(240,90,103,0.12)', color: C.red, border: '1px solid rgba(240,90,103,0.3)',
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </ERPPanel>
      )}

      {viewMode === 'daily' && (
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

                  {/* Plan for Tomorrow */}
                  {u.planTomorrow && (
                    <div style={{
                      fontSize: 11, color: C.violet, padding: '6px 12px', borderRadius: 6,
                      background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.25)'
                    }}>
                      <strong>Plan for Tomorrow:</strong> {u.planTomorrow}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ERPPanel>
      )}

      {/* ── Admin Edit Modal ────────────────────────────────────── */}
      {editingLog && (
        <ERPModal
          isOpen
          title={`Edit Work Report — ${editForm.name}`}
          onClose={() => setEditingLog(null)}
          width={750}
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.subtle, marginBottom: 4 }}>Remarks / Notes</label>
                <textarea
                  rows={2}
                  value={editForm.remarks}
                  onChange={e => setEditForm(p => ({ ...p, remarks: e.target.value }))}
                  style={{ width: '100%', background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px', color: C.text, fontSize: 12, resize: 'vertical' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.violet, marginBottom: 4 }}>Plan for Tomorrow</label>
                <textarea
                  rows={2}
                  value={editForm.planTomorrow}
                  onChange={e => setEditForm(p => ({ ...p, planTomorrow: e.target.value }))}
                  style={{ width: '100%', background: 'rgba(10,24,56,0.8)', border: '1px solid rgba(139,92,246,0.35)', borderRadius: 8, padding: '8px', color: C.text, fontSize: 12, resize: 'vertical' }}
                />
              </div>
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
