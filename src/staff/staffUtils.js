// ─────────────────────────────────────────────────────────────────
//  Phase 3 — shared helpers for Staff Management (admin) and the
//  Staff Portal. No component-specific logic here: only pure
//  date/attendance/CSV/money utilities + shared constants.
// ─────────────────────────────────────────────────────────────────
import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { toInt } from '../erp/money.js';

/** Transactional unique number — same scheme as ERPQuotations:
 *  nextNumber('staff','STF') → 'STF-2026-0001'. Falls back to a
 *  timestamp number so a save is never blocked by a counter failure. */
export async function nextNumber(counterName, prefix) {
  const year = new Date().getFullYear();
  try {
    const counterRef = doc(db, 'counters', counterName);
    const val = await runTransaction(db, async (tx) => {
      const snap = await tx.get(counterRef);
      const next = (snap.exists() ? toInt(snap.data().value) : 0) + 1;
      tx.set(counterRef, { value: next, updatedAt: new Date() });
      return next;
    });
    return `${prefix}-${year}-${String(val).padStart(4, '0')}`;
  } catch (e) {
    console.error('counter transaction failed', e);
    return `${prefix}-${Date.now()}`;
  }
}

/** Accepts Firestore Timestamp | Date | millis | 'yyyy-mm-dd' | 'Oct 6, 2026' → epoch ms (0 when unknown). */
export function toMs(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object') {
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (typeof v.seconds === 'number') return v.seconds * 1000;
    if (v instanceof Date) return v.getTime();
  }
  const ms = new Date(v).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

/** Local 'yyyy-mm-dd' key for any date-ish value (or today). */
export function dateKeyOf(v) {
  const d = v ? new Date(toMs(v)) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const todayKey = () => dateKeyOf(new Date());

/** '2026-10' for month inputs, and 'October 2026' back out again. */
export const thisMonthKey = () => todayKey().slice(0, 7);

export function monthLabel(key) {
  if (!key) return '';
  const d = new Date(`${key}-15T00:00:00`);
  return Number.isNaN(d.getTime())
    ? key
    : d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/** minutes → '7h 30m' (never negative). */
export function fmtHours(mins) {
  const m = Math.max(0, Math.round(Number(mins) || 0));
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

export function fmtTime(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// ── Attendance rules ─────────────────────────────────────────────
// Standard start 08:30 with a grace window until 09:00; fewer than 4
// logged hours is a half day.
export const WORK_START = '08:30';
export const LATE_AFTER = '09:00';
export const AUTOCLOSE_TIME = '17:30';
const HALF_DAY_MINUTES = 4 * 60;

export function minutesBetween(inMs, outMs) {
  if (!inMs || !outMs) return 0;
  return Math.max(0, Math.round((outMs - inMs) / 60000));
}

/** 'Present' | 'Late' | 'Half Day' — or '' when there is no check-in yet. */
export function attendanceStatus(checkInMs, checkOutMs) {
  if (!checkInMs) return '';
  const inMins = new Date(checkInMs).getHours() * 60 + new Date(checkInMs).getMinutes();
  const [lh, lm] = LATE_AFTER.split(':').map(Number);
  let status = inMins <= lh * 60 + lm ? 'Present' : 'Late';
  if (checkOutMs && minutesBetween(checkInMs, checkOutMs) < HALF_DAY_MINUTES) {
    status = 'Half Day';
  }
  return status;
}

export const ATTENDANCE_STATUSES = ['Present', 'Late', 'Half Day', 'Absent'];

// ── Shared vocabularies ──────────────────────────────────────────
export const ASSIGNMENT_STATUSES = ['Assigned', 'In Progress', 'On Hold', 'Completed'];
export const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
export const STAFF_STATUSES = ['active', 'busy', 'on-leave', 'inactive'];

export const DOC_CATEGORIES = [
  { id: 'kyc',         label: 'KYC Documents' },
  { id: 'certificate', label: 'Certificates' },
  { id: 'education',   label: 'Education' },
  { id: 'hr',          label: 'Other HR' },
];

// ── CSV export (client-side, no dependency) ──────────────────────
function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** downloadCsv('report.csv', ['Date','Staff'], [['2026-10-06','Ashan']]) */
export function downloadCsv(filename, headers, rows) {
  const esc = s => `\uFEFF${s}`; // BOM so Excel opens UTF-8 correctly
  const body = [headers, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([esc(body)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Whole-rupee net pay for a salary structure (matches src/erp/money.js semantics). */
export function computeNet(basic, allowances, deductions) {
  return Math.max(0, (Number(basic) || 0) + (Number(allowances) || 0) - (Number(deductions) || 0));
}

// ── Daily Routine Work Log Helpers ────────────────────────────────
export const DAILY_LOG_STATUSES = ['Completed', 'Pending'];

export function parseLunchMinutes(lunchStr) {
  if (!lunchStr) return 0;
  const s = String(lunchStr).toLowerCase();
  if (s.includes('1.5') || s.includes('90 min')) return 90;
  if (s.includes('1 hr') || s.includes('1 hour') || s.includes('60 min')) return 60;
  if (s.includes('45 min')) return 45;
  if (s.includes('30 min')) return 30;
  // If time range like "1:00 - 2:00" or "13:00 - 14:00"
  if (s.includes('-')) {
    const parts = s.split('-');
    if (parts.length === 2) return 60; // standard 1 hr window
  }
  const match = s.match(/(\d+)\s*(?:m|min)/);
  if (match) return Number(match[1]);
  const hrMatch = s.match(/(\d+)\s*(?:h|hr|hour)/);
  if (hrMatch) return Number(hrMatch[1]) * 60;
  return 60; // default 1 hour if unspecified
}

export function calculateWorkHours(startTime, endTime, lunchStr = '1 hr') {
  if (!startTime || !endTime) return '—';
  const [sh, sm] = String(startTime).split(':').map(Number);
  const [eh, em] = String(endTime).split(':').map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return '—';
  let startMinutes = sh * 60 + sm;
  let endMinutes = eh * 60 + em;
  if (endMinutes < startMinutes) endMinutes += 24 * 60; // span midnight
  let totalMins = endMinutes - startMinutes;
  const breakMins = parseLunchMinutes(lunchStr);
  if (breakMins > 0 && totalMins > breakMins) {
    totalMins -= breakMins;
  }
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours} hrs`;
}

export function calculateTaskDuration(startTime, endTime) {
  if (!startTime || !endTime) return '—';
  const [sh, sm] = String(startTime).split(':').map(Number);
  const [eh, em] = String(endTime).split(':').map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return '—';
  let startMinutes = sh * 60 + sm;
  let endMinutes = eh * 60 + em;
  if (endMinutes < startMinutes) endMinutes += 24 * 60;
  const diff = endMinutes - startMinutes;
  const hrs = diff / 60;
  return Number.isInteger(hrs) ? `${hrs}.0 hrs` : `${hrs.toFixed(1)} hrs`;
}

export function calculateAttendanceHours(arrival, lunchStart, lunchEnd, departure) {
  let lunchDurationMins = 0;
  if (lunchStart && lunchEnd) {
    const [lsh, lsm] = String(lunchStart).split(':').map(Number);
    const [leh, lem] = String(lunchEnd).split(':').map(Number);
    if (!isNaN(lsh) && !isNaN(lsm) && !isNaN(leh) && !isNaN(lem)) {
      let ls = lsh * 60 + lsm;
      let le = leh * 60 + lem;
      if (le < ls) le += 24 * 60;
      lunchDurationMins = Math.max(0, le - ls);
    }
  }

  let totalWorkMins = 0;
  if (arrival && departure) {
    const [ah, am] = String(arrival).split(':').map(Number);
    const [dh, dm] = String(departure).split(':').map(Number);
    if (!isNaN(ah) && !isNaN(am) && !isNaN(dh) && !isNaN(dm)) {
      let a = ah * 60 + am;
      let d = dh * 60 + dm;
      if (d < a) d += 24 * 60;
      totalWorkMins = Math.max(0, d - a - lunchDurationMins);
    }
  }

  const lunchHrs = lunchDurationMins / 60;
  const workHrs = totalWorkMins / 60;

  return {
    lunchDuration: lunchDurationMins > 0 ? (Number.isInteger(lunchHrs) ? `${lunchHrs}.0 hrs` : `${lunchHrs.toFixed(1)} hrs`) : '—',
    totalWorkHours: totalWorkMins > 0 ? (Number.isInteger(workHrs) ? `${workHrs}.0 hrs` : `${workHrs.toFixed(1)} hrs`) : '—',
  };
}

export function getDayName(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { weekday: 'long' });
}
