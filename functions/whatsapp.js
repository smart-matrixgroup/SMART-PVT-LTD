// ─────────────────────────────────────────────────────────────────
//  WhatsApp alerts — message wording, phone numbers and the sender.
//
//  Two jobs, both driven by Cloud Scheduler (see index.js), fully
//  automatic — nobody has to press anything:
//    · 15:30 every working day (Mon–Sat) — a confirmation to every
//      staff member who HAS checked in that day, sent to the WhatsApp
//      number in their profile.
//    · 09:00 on the 12th and 14th of every month — an alert to the
//      owner's number (076 210 0778) if any salary is still unmarked.
//
//  No secret lives in this file or in Firestore: the Cloud API token
//  and phone-number id are read from the Functions environment
//  (functions/.env → WHATSAPP_TOKEN / WHATSAPP_PHONE_ID). Without them
//  every alert is still written to the ledger with a wa.me link, so the
//  owner can send it from the ERP with one tap — nothing is lost.
//
//  Pure helpers at the top, so the QA suite can test them directly.
// ─────────────────────────────────────────────────────────────────

const TIME_ZONE = 'Asia/Colombo';
const OWNER_PHONE = '94762100778';          // 076 210 0778
const DEFAULT_START_MONTH = '2026-11';      // first payroll month that alerts
const CHECKIN_CRON = '30 15 * * 1-6';       // Mon–Sat 15:30
const SALARY_CRON = '0 9 12,14 * *';        // 12th and 14th, 09:00
const API_VERSION = 'v20.0';

/** Digits only, in international form. '076 210 0778' → '94762100778'. */
function normalizePhone(raw, countryCode = '94') {
  let d = String(raw || '').replace(/\D+/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = countryCode + d.slice(1);
  else if (!d.startsWith(countryCode) && d.length <= 10) d = countryCode + d;
  return d.length >= 10 && d.length <= 15 ? d : '';
}

/** The tap-to-send fallback link (works with no API at all). */
function waLink(phone, text) {
  const p = normalizePhone(phone);
  return p ? `https://wa.me/${p}?text=${encodeURIComponent(String(text || ''))}` : '';
}

/** '2026-11-04' → 'Wednesday, 04 November 2026' (no timezone drift). */
function prettyDay(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  return d.toLocaleDateString('en-GB', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

/** '2026-11' → 'November 2026'. */
function monthLabel(monthKey) {
  const m = String(monthKey || '').match(/^(\d{4})-(\d{2})/);
  if (!m) return String(monthKey || '');
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1, 12));
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/**
 * The 15:30 confirmation, sent only to staff whose attendance is already
 * recorded that day. It asks for the daily work report — not a check-out —
 * and stays forwardable: no emoji, no blame.
 */
function checkinConfirmation(name, dayIso, checkInMs) {
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
function checkInAt(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return '';
  return new Date(n).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: TIME_ZONE,
  }).toUpperCase();
}

/** The monthly payroll alert for the owner. */
function salaryPendingMessage(monthKey, names = [], extra = {}) {
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
function salaryWindow(dayIso) {
  const m = String(dayIso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const day = Number(m[3]);
  if (day !== 12 && day !== 14) return '';
  return `${m[1]}-${m[2]}`;
}

/** Skip payroll months before the first month the owner wants alerts. */
function afterStartMonth(monthKey, startMonth = DEFAULT_START_MONTH) {
  return String(monthKey || '') >= String(startMonth || DEFAULT_START_MONTH);
}

/**
 * Which staff have already checked in for the day — they are the ones who
 * get the 15:30 confirmation. `records` are today's attendance docs;
 * `staff` is the active roster. A staff member with no WhatsApp number on
 * their profile is left out (there is nowhere to send it).
 */
function checkedInStaff(staff = [], records = []) {
  const byStaff = new Map();
  records.forEach(r => {
    const key = r?.staffId || r?.authUid;
    if (key && !byStaff.has(key)) byStaff.set(key, r);
  });
  return staff
    .map(s => ({ ...s, attendance: byStaff.get(s.id) }))
    .filter(s => s.attendance && normalizePhone(s.phone));
}

/** Which staff have no payslip for the month. */
function unpaidStaff(staff = [], payments = []) {
  const paid = new Set(payments.map(p => p?.staffId).filter(Boolean));
  return staff.filter(s => !paid.has(s.id));
}

/**
 * Send one WhatsApp message through Meta's Cloud API.
 * `token` / `phoneId` empty → the caller keeps it manual instead.
 * Errors are returned, never thrown: one bad number must not stop a run.
 */
async function sendWhatsApp({ token, phoneId, to, text, template, params, language = 'en', version = API_VERSION }) {
  const phone = normalizePhone(to);
  if (!phone) return { ok: false, error: 'No valid WhatsApp number' };
  if (!token || !phoneId) return { ok: false, skipped: true, error: 'WhatsApp API not configured' };

  const body = template
    ? {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'template',
      template: {
        name: template,
        language: { code: language },
        components: params?.length
          ? [{ type: 'body', parameters: params.map(p => ({ type: 'text', text: String(p) })) }]
          : undefined,
      },
    }
    : { messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: String(text || '') } };

  try {
    const res = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const reason = data?.error?.message || `HTTP ${res.status}`;
      return { ok: false, error: String(reason).slice(0, 300) };
    }
    return { ok: true, id: data?.messages?.[0]?.id || '' };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err).slice(0, 300) };
  }
}

module.exports = {
  TIME_ZONE,
  OWNER_PHONE,
  DEFAULT_START_MONTH,
  CHECKIN_CRON,
  SALARY_CRON,
  API_VERSION,
  normalizePhone,
  waLink,
  prettyDay,
  monthLabel,
  checkinConfirmation,
  checkInAt,
  salaryPendingMessage,
  salaryWindow,
  afterStartMonth,
  checkedInStaff,
  unpaidStaff,
  sendWhatsApp,
};
