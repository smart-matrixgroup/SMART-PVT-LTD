// ─────────────────────────────────────────────────────────────────
//  WhatsApp alert wording — the ERP's copy.
//
//  The Cloud Function (functions/whatsapp.js) sends exactly this text;
//  this module exists so the admin can read the same message before it
//  goes out, and so the manual wa.me button never drifts from the
//  automatic one. tests/qa.test.mjs compares the two wordings.
// ─────────────────────────────────────────────────────────────────

export const OWNER_PHONE = '94762100778';          // 076 210 0778
export const DEFAULT_START_MONTH = '2026-11';

/** Digits only, in international form. '076 210 0778' → '94762100778'. */
export function normalizePhone(raw, countryCode = '94') {
  let d = String(raw || '').replace(/\D+/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = countryCode + d.slice(1);
  else if (!d.startsWith(countryCode) && d.length <= 10) d = countryCode + d;
  return d.length >= 10 && d.length <= 15 ? d : '';
}

export function waLink(phone, text) {
  const p = normalizePhone(phone);
  return p ? `https://wa.me/${p}?text=${encodeURIComponent(String(text || ''))}` : '';
}

export function prettyDay(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  return d.toLocaleDateString('en-GB', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

export function monthLabel(monthKey) {
  const m = String(monthKey || '').match(/^(\d{4})-(\d{2})/);
  if (!m) return String(monthKey || '');
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1, 12));
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function checkinConfirmation(name, dayIso, checkInMs) {
  const first = String(name || 'there').trim().split(/\s+/)[0];
  const at = checkInAt(checkInMs);
  return [
    `Dear ${first},`,
    '',
    `Your attendance for today, ${prettyDay(dayIso)}, has been recorded${at ? ` — check-in at ${at}` : ''}.`,
    'Please submit your daily work report on the staff portal before the end of the day.',
    '',
    'Thank you,',
    'SMART Pvt Ltd',
  ].join('\n');
}

/** Epoch ms → '08:32 AM' in Colombo time; '' when missing. */
export function checkInAt(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return '';
  return new Date(n).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Colombo',
  }).toUpperCase();
}

export function salaryPendingMessage(monthKey, names = [], extra = {}) {
  const list = names.filter(Boolean);
  const month = monthLabel(monthKey);
  if (!list.length) {
    return `SMART payroll check — ${month}.\n\nEvery staff member on the roster has a payslip recorded in the ERP. No action needed.`;
  }
  const lines = [
    `SMART payroll alert — ${month}`,
    '',
    `Salary has not been marked in the ERP for ${list.length} staff member${list.length === 1 ? '' : 's'}:`,
    ...list.map((n, i) => `${i + 1}. ${n}`),
    '',
    'Please open ERP → Staff Salary and record each payment before the payroll deadline.',
  ];
  if (extra.note) lines.push('', String(extra.note));
  return lines.join('\n');
}

/** Is today the 12th or the 14th? Returns the payroll month or ''. */
export function salaryWindow(dayIso) {
  const m = String(dayIso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const day = Number(m[3]);
  if (day !== 12 && day !== 14) return '';
  return `${m[1]}-${m[2]}`;
}

export function afterStartMonth(monthKey, startMonth = DEFAULT_START_MONTH) {
  return String(monthKey || '') >= String(startMonth || DEFAULT_START_MONTH);
}

export function checkedInStaff(staff = [], records = []) {
  const byStaff = new Map();
  records.forEach(r => {
    const key = r?.staffId || r?.authUid;
    if (key && !byStaff.has(key)) byStaff.set(key, r);
  });
  return staff
    .map(s => ({ ...s, attendance: byStaff.get(s.id) }))
    .filter(s => s.attendance && normalizePhone(s.phone));
}

export function unpaidStaff(staff = [], payments = []) {
  const paid = new Set(payments.map(p => p?.staffId).filter(Boolean));
  return staff.filter(s => !paid.has(s.id));
}

/** Today in Asia/Colombo as 'YYYY-MM-DD' (matches the attendance date key). */
export const todayKeyColombo = (now = new Date()) => {
  const shifted = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const pad = n => String(n).padStart(2, '0');
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
};

/** 'YYYY-MM' of the payroll month currently being recorded. */
export const thisMonthKey = () => todayKeyColombo().slice(0, 7);
