// ─────────────────────────────────────────────────────────────────
//  Week end report mails — the admin side of functions/index.js.
//
//  The scheduler mails one PDF per staff member every Sunday night. This
//  module is how the ERP talks to that backend: it reads the
//  `weeklyReportRuns` ledger (who was sent, who filed nothing, what failed)
//  and offers "Email this week now" through the sendWeeklyReportsNow
//  callable.
//
//  The week arithmetic and the ledger summarising are pure — the QA suite
//  imports this file in plain node. Firestore / Functions handles are pulled
//  in with dynamic import() inside the two async functions, so nothing here
//  touches Firebase until the panel is actually used.
// ─────────────────────────────────────────────────────────────────

const pad = n => String(n).padStart(2, '0');

/** ISO-8601 week number (Monday-first) for any 'YYYY-MM-DD'. */
export function isoWeekNumber(dayKey) {
  const [y, m, d] = String(dayKey || '').split('-').map(Number);
  const target = new Date(Date.UTC(y || 1970, (m || 1) - 1, d || 1, 12));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);          // nearest Thursday
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNr = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNr + 3);
  return 1 + Math.round((target - firstThursday) / (7 * 24 * 3600 * 1000));
}

/** Monday and Sunday keys of the week containing dayKey. */
export function weekBounds(dayKey) {
  const [y, m, d] = String(dayKey || '').split('-').map(Number);
  const anchor = new Date(Date.UTC(y || 1970, (m || 1) - 1, d || 1, 12));
  const dow = (anchor.getUTCDay() + 6) % 7;                     // Mon = 0 … Sun = 6
  const monday = new Date(anchor);
  monday.setUTCDate(anchor.getUTCDate() - dow);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const key = x => `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
  return { from: key(monday), to: key(sunday), number: isoWeekNumber(key(monday)) };
}

/** 'Mon 02 Nov 2026' — the same printed shape the scheduler uses. */
export const prettyDay = dayKey => {
  const [y, m, d] = String(dayKey || '').split('-').map(Number);
  return new Date(Date.UTC(y || 1970, (m || 1) - 1, d || 1, 12))
    .toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .replace(',', '');
};

/** The label the mail subject, the PDF heading and the ledger row all share. */
export const periodLabelOf = dayKey => {
  const w = weekBounds(dayKey);
  return `W${w.number} - ${prettyDay(w.from)} to ${prettyDay(w.to)}`;
};

export const WEEK_COLLECTION = 'weeklyReportRuns';
export const WEEK_FUNCTION = 'sendWeeklyReportsNow';

/**
 * Ledger row → UI tone. 'No reports filed' is deliberately amber, not red:
 * the mail run worked, the staff member simply did not file a sheet.
 */
export const RUN_STATUS = {
  Sent:             { label: 'PDF mailed',        tone: 'green' },
  Failed:           { label: 'Mail failed',       tone: 'red' },
  'No reports filed': { label: 'Nothing filed',   tone: 'amber' },
};
export const runStatusOf = row => RUN_STATUS[String(row?.status || '').trim()]
  || { label: row?.status || 'Not run', tone: 'muted' };

/**
 * The ledger keyed by staff uid, newest run kept per person. The scheduler
 * writes one doc per (week, staff), so a re-run overwrites the same row —
 * this only guards against a partial week having several trigger rows.
 */
export function summariseWeekRuns(rows = []) {
  const byStaff = new Map();
  (Array.isArray(rows) ? rows : []).forEach(r => {
    const uid = String(r?.staffUid || 'unknown');
    const prev = byStaff.get(uid);
    if (!prev || String(r?.runAt || '') > String(prev?.runAt || '')) byStaff.set(uid, r);
  });
  const list = [...byStaff.values()].sort((a, b) =>
    String(a?.staffName || '').localeCompare(String(b?.staffName || '')));
  return {
    rows: list,
    sent: list.filter(r => r.status === 'Sent').length,
    failed: list.filter(r => r.status === 'Failed').length,
    empty: list.filter(r => r.status === 'No reports filed').length,
    tasks: list.reduce((a, r) => a + (Number(r?.tasks) || 0), 0),
  };
}

/** One plain sentence for the callable's return value. */
export function describeMailRun(result = {}) {
  const sent = result?.sent?.length || 0;
  const failed = result?.failed?.length || 0;
  const skipped = result?.skipped?.length || 0;
  const parts = [`${periodLabelOf(result?.weekStart || '')} → ${result?.to || ''}: ${sent} PDF${sent === 1 ? '' : 's'} mailed`];
  if (skipped) parts.push(`${skipped} staff filed no sheet`);
  if (failed) parts.push(`${failed} failed`);
  return parts.join(', ') + '.';
}

/**
 * Why the ledger / the button cannot be used, in the owner's terms. Three
 * different causes look identical from the console (a rejected promise), so
 * each one gets its own sentence instead of a raw permission-denied.
 */
export function mailRunProblem(err) {
  const code = String(err?.code || err?.type || '');
  const msg = String(err?.message || err);
  if (/offline|unavailable|network|Failed to fetch/i.test(msg + code)) {
    return 'No network just now — the week end mail status could not be read.';
  }
  if (code === 'permission-denied' || /permission-denied/i.test(msg)) {
    return `The weeklyReportRuns rules block is not deployed yet. Run: npx firebase deploy --only firestore:rules,storage`;
  }
  if (code === 'functions/not-found' || /not-found|does not exist|404/i.test(msg)) {
    return `The week end mail function is not deployed yet. Run: npm --prefix functions install && npx firebase deploy --only functions`;
  }
  if (/GMAIL_APP_PASSWORD/i.test(msg)) {
    return 'The Gmail app password is not stored in Functions yet. Run: npx firebase functions:secrets:set GMAIL_APP_PASSWORD';
  }
  if (/Blaze|plan|cloud scheduler|billing/i.test(msg)) {
    return 'Cloud Functions need the Blaze plan on this Firebase project (the free plan cannot run the scheduler).';
  }
  // A callable that fails server-side only reports 'internal' — the reason
  // lives in the Functions log, so say where to look instead of echoing
  // the word back at the admin.
  if (code === 'internal' || /^functions\/internal|^internal\b/i.test(msg)) {
    return 'The mail run failed on the server. Firebase console → Functions → Logs → sendWeeklyReportsNow has the reason (a wrong Gmail app password shows up here).';
  }
  const clean = msg.replace(/^functions\/[a-z-]+:\s*/i, '').replace(/\s*\[[^\]]*\]\s*$/, '').trim();
  return clean ? `The mail run did not finish: ${clean}` : 'The mail run did not finish — check the Cloud Functions logs.';
}

/** Read this week's ledger rows. Rejects with a code mailRunProblem() understands. */
export async function fetchWeekRuns(dayKey) {
  const { collection, getDocs, query, where } = await import('firebase/firestore');
  const { db } = await import('../config/firebase');
  const w = weekBounds(dayKey);
  const snap = await getDocs(query(collection(db, WEEK_COLLECTION), where('weekOf', '==', w.from)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Ask the backend to build and mail every staff PDF for this week. */
export async function emailWeekNow(dayKey) {
  const { httpsCallable } = await import('firebase/functions');
  const { functionsApp } = await import('../config/firebase');
  const call = httpsCallable(functionsApp(), WEEK_FUNCTION);
  const res = await call({ weekOf: dayKey });
  return res?.data || {};
}
