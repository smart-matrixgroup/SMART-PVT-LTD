// ─────────────────────────────────────────────────────────────────
//  Week arithmetic for the report scheduler (no firebase imports, so the
//  QA suite can run these directly).
//
//  The ERP's week is Monday → Sunday (same rule as
//  src/staff/staffUtils.js → periodRange('week')), and the ISO week number is
//  the label used in the mail subject and the weeklyReportRuns ledger id, so
//  "W45" means the same seven days everywhere.
// ─────────────────────────────────────────────────────────────────

const pad = n => String(n).padStart(2, '0');
const keyOf = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

// Asia/Colombo is UTC+5:30 and has no DST. Punches stored as a real instant
// are shifted before reading the calendar day, so a 23:40 log stays on the
// day the staff member filed it for instead of rolling to the next one.
const COLOMBO_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** 'YYYY-MM-DD' | Date | Firestore Timestamp | ms → 'YYYY-MM-DD' (null if junk). */
function dateKeyOf(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
  }
  const ms = typeof value.toDate === 'function'
    ? value.toDate().getTime()
    : (value instanceof Date ? value.getTime() : Number(value));
  if (!Number.isFinite(ms)) return null;
  return keyOf(new Date(ms + COLOMBO_OFFSET_MS));
}

/** ISO-8601 week number for a Monday (or any date in that week). */
function isoWeek(anyDay) {
  const target = new Date(Date.UTC(
    anyDay.getUTCFullYear(), anyDay.getUTCMonth(), anyDay.getUTCDate(), 12, 0, 0,
  ));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);   // nearest Thursday
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNr = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNr + 3);
  return 1 + Math.round((target - firstThursday) / (7 * 24 * 3600 * 1000));
}

/** Monday…Sunday bounds for the week containing dayKey ('YYYY-MM-DD'). */
function weekBounds(dayKey) {
  const parts = String(dayKey || '').split('-').map(Number);
  const anchor = new Date(Date.UTC(
    parts[0] || 1970, (parts[1] || 1) - 1, parts[2] || 1, 12, 0, 0,
  ));
  const dow = (anchor.getUTCDay() + 6) % 7;            // Monday = 0 … Sunday = 6
  const monday = new Date(anchor);
  monday.setUTCDate(anchor.getUTCDate() - dow);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { from: keyOf(monday), to: keyOf(sunday), number: isoWeek(monday) };
}

/** 'Mon 02 Nov 2026' — the printed form used in subjects and meta lines. */
function prettyDay(dayKey) {
  const parts = String(dayKey || '').split('-').map(Number);
  return new Date(Date.UTC(parts[0] || 1970, (parts[1] || 1) - 1, parts[2] || 1, 12))
    .toLocaleDateString('en-GB', {
      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
    // Node and the browser both insert the comma after the weekday; a subject
    // line reads better without it, and the PDF column is narrower with it.
    }).replace(',', '');
}

/** Today in the office time zone, as 'YYYY-MM-DD'. */
function todayKeyColombo(now = new Date()) {
  return keyOf(new Date(now.getTime() + COLOMBO_OFFSET_MS));
}

module.exports = { pad, keyOf, dateKeyOf, isoWeek, weekBounds, prettyDay, todayKeyColombo, COLOMBO_OFFSET_MS };
