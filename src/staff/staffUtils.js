// ─────────────────────────────────────────────────────────────────
//  Phase 3 — shared helpers for Staff Management (admin) and the
//  Staff Portal. No component-specific logic here: only pure
//  date/attendance/CSV/money utilities + shared constants.
// ─────────────────────────────────────────────────────────────────
import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../config/firebase';
import { toInt } from '../erp/money';

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
