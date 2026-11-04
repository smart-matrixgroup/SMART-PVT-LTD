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
// 'Accepted' sits between Assigned and In Progress: the staff member
// confirms the work in their portal before the clock starts.
export const ASSIGNMENT_STATUSES = ['Assigned', 'Accepted', 'In Progress', 'On Hold', 'Completed'];
export const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
export const STAFF_STATUSES = ['active', 'busy', 'on-leave', 'inactive'];

// ── Work matching ────────────────────────────────────────────────
// Which staff profile fits a client's project type. Matched against the
// staff role + department + skills text, so it works with whatever the
// admin typed when creating the staff member (no schema required).
const SERVICE_FIT = [
  { test: /mobile|android|ios|flutter|react native/i,
    fits: ['mobile', 'android', 'ios', 'flutter', 'engineering', 'developer', 'qa', 'testing'] },
  { test: /erp|pos|inventory|restaurant|hotel|software|system|api|backend|integrat/i,
    fits: ['erp', 'pos', 'backend', 'node', 'engineer', 'developer', 'full stack', 'software', 'qa', 'business analyst', 'project'] },
  { test: /website|web|landing|seo|e-?commerce|portfolio|blog/i,
    fits: ['web', 'front', 'full stack', 'react', 'engineer', 'developer', 'design', 'ui', 'ux', 'seo', 'content'] },
  { test: /design|brand|logo|ui\/?ux|graphic|video|creative/i,
    fits: ['design', 'ui', 'ux', 'graphic', 'brand', 'creative', 'content', 'video'] },
  { test: /account|tax|vat|audit|bookkeep|payroll|financ|statement/i,
    fits: ['account', 'tax', 'audit', 'finance', 'bookkeep', 'payroll', 'commerce'] },
  { test: /support|maintenance|hosting|training|manage/i,
    fits: ['support', 'operation', 'manage', 'project', 'devops', 'system'] },
];

/** True when this staff member's profile fits the project's service type.
 *  An unknown service type is never a blocker — everything fits. */
export function staffFitsService(staff, serviceType) {
  const rule = SERVICE_FIT.find(r => r.test.test(String(serviceType || '')));
  if (!rule) return true;
  const text = `${staff?.role || ''} ${staff?.department || ''} ${(staff?.skills || []).join(' ')}`.toLowerCase();
  if (!text.trim()) return true;                 // no profile info → don't hide them
  return rule.fits.some(k => text.includes(k));
}

/** Split a staff list into [suited, others] for the assignment picker. */
export function splitStaffByFit(staffList, serviceType) {
  const suited = staffList.filter(s => staffFitsService(s, serviceType));
  return { suited, others: staffList.filter(s => !suited.includes(s)) };
}

export const DOC_CATEGORIES = [
  { id: 'kyc',         label: 'KYC Documents' },
  { id: 'certificate', label: 'Certificates' },
  { id: 'education',   label: 'Education' },
  { id: 'hr',          label: 'Other HR' },
];

// ── Staff name matching (sheet imports, report grouping) ───────────────
// The same person arrives from a Google Sheet as "Thisha", "Thishalini",
// "Sathu", "Sathurshika", "Lukshi", "Luksikka"… A plain equality or
// "contains" check misses the shortened forms, so the importer used to
// create a brand new record instead of updating that person's days.
const nameToken = s => String(s ?? '')
  .toLowerCase()
  .replace(/[^a-z\s]/g, ' ')
  .trim()
  .split(/\s+/)
  .filter(Boolean);

const isSubsequence = (short, long) => {
  let i = 0;
  for (const ch of long) { if (i < short.length && ch === short[i]) i++; }
  return i === short.length;
};

/** 0 → no match, 1 → same name. Tolerant of typos and short forms. */
export function nameMatchScore(a, b) {
  const ta = nameToken(a), tb = nameToken(b);
  if (!ta.length || !tb.length) return 0;
  const na = ta.join(''), nb = tb.join('');
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  // Compare the shortest first names both sides ("thisha" ⊂ "thishalini")
  const pairs = [[ta[0], tb[0]], [tb[0], ta[0]]];
  for (const [short, long] of pairs) {
    if (short.length >= 4 && isSubsequence(short, long)) {
      return short === long ? 0.85 : 0.75;
    }
  }
  // Different first name but a shared surname ("Paththima Asra" / "Asra")
  const overlap = ta.filter(x => x.length > 2 && tb.includes(x)).length;
  if (overlap) return 0.8;
  // Spelling drift on the same name ("luksikka" / "lukshi" share "luks")
  const pa = ta[0], pb = tb[0];
  let prefix = 0;
  while (prefix < pa.length && prefix < pb.length && pa[prefix] === pb[prefix]) prefix++;
  if (prefix >= 4 && Math.abs(pa.length - pb.length) <= 4) return 0.7;
  return 0;
}

/** Find the staff record this sheet name refers to. */
export function findStaffBySheetName(staffList, name) {
  let best = null, bestScore = 0;
  (staffList || []).forEach(s => {
    const score = Math.max(nameMatchScore(s?.name, name), nameMatchScore(s?.staffName, name));
    if (score > bestScore) { bestScore = score; best = s; }
  });
  return bestScore >= 0.7 ? best : null;
}

/** True when two spellings mean the same person (used for de-duping). */
export const sameStaffName = (a, b) => nameMatchScore(a, b) >= 0.7;

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

export function compressImage(file, maxDimension = 360, quality = 0.85) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Please select a valid image file.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        canvas.toBlob(
          (blob) => {
            resolve({ dataUrl, blob, width, height });
          },
          'image/jpeg',
          quality
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export function getDayName(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { weekday: 'long' });
}

// ── Attendance / report periods ──────────────────────────────────────
// Week, month, year or the whole history, resolved from one anchor date the
// admin picked (a day input, a month input or a year). Shared by the admin
// attendance statement and the daily work reports so "this week" means the
// same thing on every page.
export const PERIOD_MODES = ['week', 'month', 'year', 'all'];

/** 'yyyy-mm-dd' shifted by n days (local-safe: noon avoids DST jumps). */
export function addDaysIso(iso, n) {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  d.setDate(d.getDate() + n);
  const p = k => String(k).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Monday of the week holding 'yyyy-mm-dd'. */
export function mondayOf(iso) {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const shift = (d.getDay() + 6) % 7;   // Sun=6, Mon=0 … Sat=5
  return addDaysIso(iso, -shift);
}

/** '2026-09-28' → '28-Sep-2026' (the format the owner reads off sheets). */
export function dayLabel(iso) {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso || '';
  const p = n => String(n).padStart(2, '0');
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
  return `${p(d.getDate())}-${mo}-${d.getFullYear()}`;
}

/**
 * {from, to, label} for a period. `anchor` is a day (week), 'yyyy-mm'
 * (month), a 4-digit year, or anything for 'all'. Empty from/to means
 * "no bound", so a filter can use them straight away.
 */
export function periodRange(mode, anchor) {
  const today = todayKey();
  if (mode === 'all') return { from: '', to: '', label: 'All records' };

  if (mode === 'year') {
    const y = String(anchor || today).slice(0, 4);
    return { from: `${y}-01-01`, to: `${y}-12-31`, label: `Year ${y}` };
  }

  if (mode === 'month') {
    const key = String(anchor || today).slice(0, 7);            // 'yyyy-mm'
    const last = new Date(`${key}-01T12:00:00`);
    const end = Number.isNaN(last.getTime())
      ? today
      : `${key}-${String(new Date(last.getFullYear(), last.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;
    return { from: `${key}-01`, to: end, label: monthLabel(key) };
  }

  const mon = mondayOf(String(anchor || today).slice(0, 10));
  const sun = addDaysIso(mon, 6);
  return { from: mon, to: sun, label: `${dayLabel(mon)} → ${dayLabel(sun)}` };
}

/**
 * Expected working days (Mon–Sat; the head office is closed on Sunday)
 * inside a range, as 'yyyy-mm-dd' keys. An open-ended range returns []
 * so a "full history" statement never claims days were missed.
 */
export function expectedWorkdays(from, to) {
  if (!from || !to) return [];
  const out = [];
  let cur = from;
  let guard = 0;
  while (cur <= to && guard < 400) {
    const d = new Date(`${cur}T12:00:00`).getDay();  // 0 = Sunday
    if (d !== 0) out.push(cur);
    cur = addDaysIso(cur, 1);
    guard += 1;
  }
  return out;
}

// ── Google Sheet / Excel cell readers ──────────────────────────────────
// Anything pasted or exported out of a sheet arrives in whatever shape the
// author's locale produced. These three turn that into ERP fields, and the
// day is always resolved to yyyy-mm-dd so an imported week cannot silently
// land on the wrong dates.
const MONTHS_MAP = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const p2 = n => String(n).padStart(2, '0');

/** "2026-10-28", "28/10/2026", "28-Oct-2026", "Oct 28, 2026",
 *  "2026-10-28T00:00:00" → 'yyyy-mm-dd'; anything unknown → null. */
export function sheetDate(v) {
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);          // 2026-10-28 [+ time]
  if (m) return `${m[1]}-${p2(+m[2])}-${p2(+m[3])}`;
  m = s.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})/);                     // 2026/10/28
  if (m) return `${m[1]}-${p2(+m[2])}-${p2(+m[3])}`;
  m = s.match(/^(\d{1,2})[-/\s]([A-Za-z]{3,})[-/\s,]*(\d{4})/);          // 28-Sep-2026 / 28 Sep 2026
  if (m) { const mm = MONTHS_MAP[m[2].slice(0, 3).toLowerCase()]; if (mm) return `${m[3]}-${p2(mm)}-${p2(+m[1])}`; }
  m = s.match(/^([A-Za-z]{3,})[-/\s,]*(\d{1,2})[-/\s,]*(\d{4})/);        // Sep 28, 2026
  if (m) { const mm = MONTHS_MAP[m[1].slice(0, 3).toLowerCase()]; if (mm) return `${m[3]}-${p2(mm)}-${p2(+m[2])}`; }
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:[T\s].*)?$/);      // 28/09/2026 (day first)
  if (m) return `${m[3]}-${p2(+m[2])}-${p2(+m[1])}`;
  return null;
}

/** "8:30 am" / "08.30" → '08:30' (24 h). Empty when unreadable. */
export function to24h(v) {
  const m = String(v ?? '').trim().match(/^(\d{1,2})[:.](\d{2})\s*(am|pm)?$/i);
  if (!m) return '';
  let h = +m[1];
  const ap = (m[3] || '').toLowerCase();
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  return `${p2(h)}:${m[2]}`;
}

/** "08:30-11:00: Analysed design | 11:00-13:00: Built login [In Progress]"
 *  → tasks[] with start/end/hours/description/status.
 *  `fallbackStatus` is the STATUS column of a filled template, used whenever
 *  a segment has no [In Progress] marker of its own. */
export function parseWorkSegments(wd, fallbackStatus = '') {
  if (!wd) return [];
  const fallback = String(fallbackStatus || '').trim();
  return String(wd).split('|').map(s => s.trim()).filter(Boolean).map((seg, i) => {
    const m = seg.match(/^(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})\s*[:;\-]?\s*(.*)$/);
    const body = m ? m[3] : seg;
    const sm = body.match(/\s*\[([^\]]+)\]\s*$/);
    const status = sm ? sm[1].trim() : (fallback || 'Completed');
    const description = (sm ? body.slice(0, sm.index) : body).trim();
    if (m) return { no: i + 1, start: m[1], end: m[2], hours: calculateTaskDuration(m[1], m[2]), description, status };
    return { no: i + 1, start: '', end: '', hours: '—', description, status };
  });
}

// ── Daily report import — flat "one row per staff per day" sheets ────────
// The importer reads whatever header the Google Sheet / Excel file actually
// has, so the office never has to rename columns before importing. Living
// next to the other sheet helpers means the page and the QA tests share the
// exact same parsing.
export const IMPORT_ALIASES = {
  NAME: ['NAME', 'STAFF NAME', 'STAFF', 'EMPLOYEE', 'EMPLOYEE NAME', 'TEAM MEMBER'],
  POSITION: ['POSITION', 'ROLE', 'DESIGNATION', 'JOB ROLE'],
  DATE: ['DATE', 'WORK DATE', 'DAY DATE'],
  DAY: ['DAY', 'WEEKDAY'],
  LOCATION: ['LOCATION', 'JOB LOCATION', 'SITE'],
  'WORK MODE': ['WORK MODE', 'MODE', 'WORK TYPE'],
  ARRIVAL: ['ARRIVAL', 'CHECK IN', 'CHECK-IN', 'IN TIME', 'START TIME'],
  'LUNCH START': ['LUNCH START', 'LUNCH IN'],
  'LUNCH END': ['LUNCH END', 'LUNCH OUT'],
  'LUNCH DURATION': ['LUNCH DURATION', 'LUNCH'],
  DEPARTURE: ['DEPARTURE', 'CHECK OUT', 'CHECK-OUT', 'OUT TIME', 'END TIME'],
  'TOTAL WORK HRS': ['TOTAL WORK HRS', 'TOTAL HOURS', 'WORK HOURS', 'HOURS'],
  'WORK / DESCRIPTION': ['WORK / DESCRIPTION', 'WORK DESCRIPTION', 'WORK', 'DESCRIPTION', 'TASK', 'TASKS', 'WORK DONE', 'TODAY WORK', 'UPDATE', 'DAILY UPDATE', 'PROGRESS', 'WORK UPDATE'],
  STATUS: ['STATUS', 'TASK STATUS'],
  REMARKS: ['REMARKS', 'NOTES', 'REMARK', 'COMMENTS'],
  'PLAN FOR TOMORROW': ['PLAN FOR TOMORROW', 'TOMORROW', 'NEXT DAY PLAN', 'PLAN'],
};

/** rows (2-D strings, row 0 = header) → { flat, sheet, entries[] }. */
export function buildImportEntries(rows) {
  const head = (rows[0] || []).map(h => String(h).replace(/\s+/g, ' ').trim().toUpperCase());
  const findCol = names => {
    for (const n of names) { const i = head.indexOf(n); if (i >= 0) return i; }
    for (const n of names) { const i = head.findIndex(h => h.startsWith(n)); if (i >= 0) return i; }
    return -1;
  };
  const idx = {};
  Object.entries(IMPORT_ALIASES).forEach(([key, names]) => { idx[key] = findCol(names); });
  const flat = idx.NAME >= 0 && idx.DATE >= 0;
  const sheet = (rows || []).some(r => r.join(' ').toUpperCase().includes('DAILY WORK REPORT'));
  if (!flat) return { flat: false, sheet, idx, head, entries: [] };

  const cell = (r, h) => { const i = idx[h]; return i >= 0 ? String(r[i] ?? '').trim() : ''; };
  const entries = (rows || []).slice(1).map(r => ({
    name: cell(r, 'NAME'), position: cell(r, 'POSITION'), location: cell(r, 'LOCATION'),
    date: sheetDate(cell(r, 'DATE')), rawDate: cell(r, 'DATE'), day: cell(r, 'DAY'),
    workMode: cell(r, 'WORK MODE'),
    arrival: to24h(cell(r, 'ARRIVAL')), lunchStart: to24h(cell(r, 'LUNCH START')),
    lunchEnd: to24h(cell(r, 'LUNCH END')), departure: to24h(cell(r, 'DEPARTURE')),
    lunchDuration: cell(r, 'LUNCH DURATION'), totalWorkHours: cell(r, 'TOTAL WORK HRS'),
    // A STATUS column applies to every task line that has no [marker].
    tasks: parseWorkSegments(cell(r, 'WORK / DESCRIPTION'), cell(r, 'STATUS')),
    remarks: cell(r, 'REMARKS'), planTomorrow: cell(r, 'PLAN FOR TOMORROW'),
  }));
  return { flat: true, sheet, idx, head, entries };
}

// ── Work Progress stages (staff portal → Work Progress) ──────────────
// Staff build their OWN list of the work they are going to do for an
// assigned project — one row per stage. They mark a stage Not Started →
// In Progress → Completed and leave the note of what they finished; the
// admin then approves (or sends back) each finished stage, and only
// approved stages are shown to the client on their portal.
export const STAGE_STATUSES = ['Not Started', 'In Progress', 'Completed', 'On Hold'];

/** The stage's own status — old rows without a status read as In Progress. */
export function stageStatusOf(item) {
  const s = String(item?.status || '').trim();
  if (STAGE_STATUSES.includes(s)) return s;
  return s ? s : 'In Progress';
}

/** Where the admin review stands for a stage (staff never set this). */
export function stageReviewOf(item) {
  const r = String(item?.reviewState || '').toLowerCase();
  if (r === 'accepted') return { key: 'accepted', label: 'Approved by admin', note: String(item?.reviewNote || '') };
  if (r === 'rework') return { key: 'rework', label: 'Rework needed', note: String(item?.reviewNote || '') };
  if (stageStatusOf(item) === 'Completed') return { key: 'pending', label: 'Awaiting admin approval', note: '' };
  return { key: 'none', label: '', note: '' };
}

/** Progress of one project's stage list, for staff, admin and client views. */
export function stageStats(items) {
  const list = Array.isArray(items) ? items : [];
  const total = list.length;
  const done = list.filter(i => stageStatusOf(i) === 'Completed').length;
  const accepted = list.filter(i => stageReviewOf(i).key === 'accepted').length;
  const rework = list.filter(i => stageReviewOf(i).key === 'rework').length;
  const proofs = list.reduce((s, i) => s + ((i?.proofs || []).length), 0);
  return {
    total, done, accepted, rework, proofs,
    open: total - done,
    pendingReview: list.filter(i => stageReviewOf(i).key === 'pending').length,
    pct: total ? Math.round((done / total) * 100) : 0,
    clientPct: total ? Math.round((accepted / total) * 100) : 0,
  };
}

/** Stage order is what the staff wrote it as: number → date → newest edit. */
export function sortStages(items) {
  return [...(Array.isArray(items) ? items : [])].sort((a, b) => {
    const no = x => Number(x?.stage || x?.no || 0) || 0;
    return (no(a) - no(b)) || String(a?.date || '').localeCompare(String(b?.date || ''))
      || (toMs(b?.updatedAt || b?.createdAt) - toMs(a?.updatedAt || a?.createdAt));
  });
}

/**
 * Group a staff member's stages by the project they belong to.
 * Rows with no project (general work) land in the last "General work" group.
 */
export function groupStagesByProject(items) {
  const out = new Map();
  (Array.isArray(items) ? items : []).forEach(it => {
    const projectId = String(it?.projectId || '').trim();
    const title = String(it?.projectTitle || '').trim();
    const key = projectId || title.toLowerCase() || '__general__';
    if (!out.has(key)) {
      out.set(key, { key, projectId, projectTitle: title, clientId: '', clientName: '', items: [] });
    }
    const g = out.get(key);
    // Older rows may carry an empty snapshot — the first row that has it wins,
    // so a project card never loses its client name because of add order.
    if (!g.projectTitle) g.projectTitle = title;
    if (!g.clientId)     g.clientId = String(it?.clientId || '').trim();
    if (!g.clientName)   g.clientName = String(it?.clientName || '').trim();
    g.items.push(it);
  });
  return [...out.values()]
    .map(g => ({
      ...g,
      projectTitle: g.projectTitle || (g.projectId ? 'Project' : 'General work'),
      items: sortStages(g.items),
      stats: stageStats(g.items),
    }))
    .sort((a, b) => (a.key === '__general__' ? 1 : b.key === '__general__' ? -1
      : b.stats.open - a.stats.open || a.projectTitle.localeCompare(b.projectTitle)));
}

/** Next stage number the staff should see when adding to a project list. */
export const nextStageNo = items => (Array.isArray(items) ? items : [])
  .reduce((mx, i) => Math.max(mx, Number(i?.stage || i?.no || 0) || 0), 0) + 1;

/** Append-only who/when trail — a stage log line is never rewritten. */
export const stageHistoryEntry = (by, text, at = Date.now()) => ({ at, by: String(by || ''), text: String(text || '') });

/** Is a stage the client is allowed to see? (approved by the admin) */
export const stageVisibleToClient = item => stageReviewOf(item).key === 'accepted';

// ── Dev-session stage store ────────────────────────────────────────
// The staff portal keeps its preview list here; in a dev session the admin
// screens read and review the very same list, so the whole
// staff lists → marks done → admin approves loop can be tried in the browser
// without touching Firestore. Real sessions never read this key.
export const DEV_STAGE_KEY = 'smart_dev_progress';

export function loadDevStages() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(window.sessionStorage.getItem(DEV_STAGE_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch { return []; }
}

export function saveDevStages(list) {
  if (typeof window === 'undefined') return;
  try { window.sessionStorage.setItem(DEV_STAGE_KEY, JSON.stringify(list)); } catch { /* private mode */ }
}
