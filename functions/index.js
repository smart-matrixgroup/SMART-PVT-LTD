// ─────────────────────────────────────────────────────────────────
//  SMART PVT LTD — weekly staff report emails (Cloud Functions)
//
//  What this does
//    Every week end (Saturday 23:30, Asia/Colombo) the scheduler reads
//    `dailyUpdates` for Mon…Sun, builds ONE PDF per staff member
//    (weeklyReportPdf.js — same layout as the staff portal's sheet) and mails
//    each of them separately to the owner. Every run is written to
//    `weeklyReportRuns` — an append-only ledger of who was sent, when, with
//    which file, and what failed. The ERP's Daily Updates page shows that
//    ledger and can trigger the same run on demand ("Email this week now").
//
//  One-off setup (three steps, then nothing to remember)
//    1. Firebase console → this project → upgrade to the Blaze plan.
//       Cloud Scheduler (the cron part) is not available on the free Spark
//       plan; you only pay for what runs, and a weekly cron costs cents.
//    2. Google account → Security → 2-Step Verification → App passwords →
//       create one for "Mail". That 16-character password is the SMTP key;
//       it is NOT the Gmail login password.
//    3. From the project root:
//         npm --prefix functions install
//         npx firebase deploy --only functions
//       The CLI asks for GMAIL_APP_PASSWORD during the deploy
//       (sourceSecrets in firebase.json). Set it to the app password from
//       step 2. Later changes:
//         npx firebase functions:secrets:set GMAIL_APP_PASSWORD
//
//  What to change if the week end or the inbox changes
//    WEEK_CRON / TIME_ZONE below, and the address in DEFAULT_TO. A doc at
//    `reportEmailConfig/main` with { to, from, cc, enabled } overrides those
//    without a redeploy; the ERP shows which one is in effect.
//
//  Nothing here prints the SMTP key, and no secret is stored in Firestore.
// ─────────────────────────────────────────────────────────────────

const { setGlobalOptions } = require('firebase-functions/v2');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onRequest, onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const nodemailer = require('nodemailer');
const { jsPDF } = require('jspdf');
const { buildWeeklyReportPdf } = require('./weeklyReportPdf');
const { dateKeyOf, isoWeek, weekBounds, prettyDay, todayKeyColombo } = require('./weekUtils');
const { handleBossManagerApi } = require('./bossManagerApi');

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

// Same two addresses firestore.rules → isAdmin() accepts. A callable from
// anybody else is refused before a single email is composed.
const ADMIN_EMAILS = ['admin@smart.com', 'admin@findmysmart.com'];

const DEFAULT_TO = 'matrixgroup.smart@gmail.com';
const DEFAULT_FROM = 'matrixgroup.smart@gmail.com';
const TIME_ZONE = 'Asia/Colombo';
// minute hour day-of-month month day-of-week → Saturday 23:30, every week.
const WEEK_CRON = '30 23 * * 6';

setGlobalOptions({
  region: 'asia-south1',
  maxInstances: 1,           // one run at a time: no duplicate emails
  secrets: ['GMAIL_APP_PASSWORD'],
});

async function readConfig() {
  // A reportEmailConfig/main doc lets the owner retarget the mails without a
  // redeploy; absent that doc, the constants above are used.
  try {
    const snap = await db.collection('reportEmailConfig').doc('main').get();
    return snap.exists ? snap.data() || {} : {};
  } catch (err) {
    logger.warn('reportEmailConfig could not be read, using defaults', { message: err.message });
    return {};
  }
}

function mailTransport(appPassword, user) {
  return nodemailer.createTransport({
    service: 'Gmail',
    auth: { user, pass: appPassword },
  });
}

/**
 * Build + send one PDF per staff member for one week.
 * Shared by the scheduler and the "Email this week now" button so both write
 * the same ledger rows.
 */
async function runWeeklyReports({ weekOf, trigger }) {
  const cfg = await readConfig();
  if (cfg.enabled === false && trigger === 'schedule') {
    return { skipped: 'reportEmailConfig/main has enabled: false' };
  }

  const to = String(cfg.to || DEFAULT_TO).trim();
  const from = String(cfg.from || DEFAULT_FROM).trim();
  const cc = String(cfg.cc || '').trim();
  const smtpPass = process.env.GMAIL_APP_PASSWORD || '';
  if (!smtpPass) {
    throw new Error('GMAIL_APP_PASSWORD is not set. Run: npx firebase functions:secrets:set GMAIL_APP_PASSWORD');
  }

  const week = weekBounds(weekOf || todayKeyColombo());
  const periodLabel = `W${week.number} - ${prettyDay(week.from)} to ${prettyDay(week.to)}`;

  // Staff roster (the reports are grouped by uid, the roster supplies names
  // and the STF number printed on the letterhead).
  const staffSnap = await db.collection('staff').get();
  const roster = {};
  // Some rows carry the auth uid in `staffId`, others the printed STF code
  // (the Excel/Sheet imports wrote it that way). Both must land on the same
  // person, so the STF code is kept as an alias of the roster key.
  const alias = {};
  staffSnap.forEach(d => {
    const s = d.data();
    if (!s || s.deleted === true) return;
    roster[d.id] = { id: d.id, name: s.name || d.id, staffId: s.staffId || '', position: s.position || s.role || '' };
    if (s.staffId) alias[String(s.staffId).trim().toLowerCase()] = d.id;
  });
  const resolveUid = raw => {
    const key = String(raw || '').trim();
    if (!key) return 'unknown';
    if (roster[key]) return key;
    return alias[key.toLowerCase()] || key;
  };

  // One pass over dailyUpdates, filtered by the week in code: `date` has been
  // written as a string, a Date and a Timestamp depending on how the row
  // arrived (portal / Excel import / Sheet import), and a Firestore range
  // query would silently miss the odd types.
  const updatesSnap = await db.collection('dailyUpdates').get();
  const byStaff = new Map();
  updatesSnap.forEach(d => {
    const r = { id: d.id, ...d.data() };
    const key = dateKeyOf(r.date);
    if (!key || key < week.from || key > week.to) return;
    const uid = resolveUid(r.authUid || r.staffId);
    if (!byStaff.has(uid)) byStaff.set(uid, []);
    byStaff.get(uid).push({ ...r, date: key });
  });

  const transport = mailTransport(smtpPass, from);
  const generatedBy = `${trigger === 'schedule' ? 'SMART weekly scheduler' : 'SMART ERP (admin request)'} - ${new Date().toISOString()}`;
  const sent = [];
  const skipped = [];
  const failed = [];
  const weekId = `${week.from}_${week.to}`;

  for (const [uid, person] of Object.entries(roster)) {
    const reports = byStaff.get(uid) || [];
    const ledRef = db.collection('weeklyReportRuns').doc(`${weekId}_${uid}`);
    const base = {
      weekOf: week.from, weekStart: week.from, weekEnd: week.to, isoWeek: week.number,
      periodLabel, staffUid: uid, staffName: person.name, staffId: person.staffId,
      trigger, runAt: new Date().toISOString(),
    };

    if (!reports.length) {
      // Nobody files an empty report; the ledger records the gap instead and
      // the ERP shows it, so a missing sheet is visible rather than mailed.
      const row = { ...base, status: 'No reports filed', daysLogged: 0, to };
      await ledRef.set(row, { merge: true });
      skipped.push({ staff: person.name, reason: 'no sheet filed this week' });
      continue;
    }

    const built = buildWeeklyReportPdf({
      Doc: jsPDF,
      staffName: person.name,
      staffId: person.staffId,
      periodLabel,
      reports,
      sentTo: to,
      generatedBy,
    });
    const days = [...new Set(reports.map(r => r.date))].sort();

    try {
      await transport.sendMail({
        from: `SMART Work Reports <${from}>`,
        to,
        cc: cc || undefined,
        subject: `Weekly Work Report - ${person.name}${person.staffId ? ` (${person.staffId})` : ''} - ${periodLabel}`,
        text: [
          `Weekly work report for ${person.name}${person.staffId ? ` (${person.staffId})` : ''}.`,
          `Period : ${periodLabel}`,
          `Days logged : ${days.length} of 7 (${days.join(', ')})`,
          `Tasks in the PDF : ${built.rows}`,
          built.rows === 0 ? 'Note: the sheets exist but no task was described in them.' : '',
          '',
          `Attached: ${built.fileName}`,
          `Sent by ${generatedBy}`,
        ].filter(Boolean).join('\n'),
        attachments: [{ filename: built.fileName, content: built.buffer, contentType: 'application/pdf' }],
      });
      const row = {
        ...base, status: 'Sent', to, fileName: built.fileName,
        daysLogged: days.length, days, tasks: built.rows, pages: built.pages,
        bytes: built.buffer.length,
      };
      await ledRef.set(row, { merge: true });
      sent.push({ staff: person.name, fileName: built.fileName, daysLogged: days.length, tasks: built.rows });
    } catch (err) {
      const row = { ...base, status: 'Failed', to, error: String(err && err.message || err).slice(0, 400) };
      await ledRef.set(row, { merge: true });
      failed.push({ staff: person.name, error: row.error });
      logger.error('weekly report mail failed', { staff: person.name, message: row.error });
    }
  }

  const unknown = Array.from(byStaff.keys()).filter(uid => !roster[uid]);
  if (unknown.length) {
    // Reports whose author is no longer on the roster (deleted staff) still
    // get a PDF, so no filed work disappears from the week end post.
    for (const uid of unknown) {
      const reports = byStaff.get(uid) || [];
      const name = reports[0]?.name || reports[0]?.staffName || uid;
      const built = buildWeeklyReportPdf({ Doc: jsPDF, staffName: name, staffId: reports[0]?.staffId || '', periodLabel, reports, sentTo: to, generatedBy });
      try {
        await transport.sendMail({
          from: `SMART Work Reports <${from}>`, to, cc: cc || undefined,
          subject: `Weekly Work Report - ${name} - ${periodLabel} (former staff)`,
          text: `Work filed this week by ${name}, who is no longer on the staff roster.\nAttached: ${built.fileName}`,
          attachments: [{ filename: built.fileName, content: built.buffer, contentType: 'application/pdf' }],
        });
        sent.push({ staff: `${name} (not on roster)`, fileName: built.fileName, daysLogged: reports.length, tasks: built.rows });
      } catch (err) {
        failed.push({ staff: name, error: String(err && err.message || err).slice(0, 200) });
      }
    }
  }

  logger.info('weekly reports run finished', { week: periodLabel, trigger, sent: sent.length, skipped: skipped.length, failed: failed.length });
  return {
    periodLabel, weekStart: week.from, weekEnd: week.to, to, from,
    staff: Object.keys(roster).length, sent, skipped, failed,
  };
}

// ── the week end mail run ──────────────────────────────────────────
exports.sendWeeklyWorkReports = onSchedule(WEEK_CRON, { timeZone: TIME_ZONE }, async () => {
  const result = await runWeeklyReports({ trigger: 'schedule' });
  logger.info('scheduled weekly reports', { summary: JSON.stringify(result) });
});

// ── "Email this week now", from Daily Updates in the ERP ───────────
exports.sendWeeklyReportsNow = onCall({ timeoutSeconds: 300, memory: '512MiB' }, async request => {
  const email = String(request.auth?.token?.email || '').toLowerCase();
  // firestore.rules → isAdmin() accepts these two addresses (or an
  // admins/{uid} doc, which surfaces as token.admin in the auth claim).
  const isAdminCaller = ADMIN_EMAILS.includes(email) || request.auth?.token?.admin === true;
  if (!isAdminCaller) {
    throw new HttpsError('permission-denied', 'Only the administrator can trigger the report mails.');
  }
  try {
    return await runWeeklyReports({ weekOf: request.data?.weekOf, trigger: 'admin' });
  } catch (err) {
    const message = String(err && err.message || err);
    logger.error('manual weekly report run failed', { message });
    throw new HttpsError('internal', message);
  }
});

// ─────────────────────────────────────────────────────────────────
//  WhatsApp alerts
//    · 15:30 Mon–Sat → a confirmation to every active staff member who
//      has already checked in, to the number in their staff profile.
//    · 09:00 on the 12th and 14th → alert the owner (076 210 0778)
//      with everyone whose salary for the month is not marked yet.
//  Both run by themselves on Cloud Scheduler; nobody has to press
//  anything. Every attempt is written to whatsappAlerts with the composed
//  text and a wa.me link, so an unconfigured API still leaves the message
//  one tap away in the ERP. The API token never leaves the Functions
//  environment.
// ─────────────────────────────────────────────────────────────────
const wa = require('./whatsapp');

const WA_COLLECTION = 'whatsappAlerts';
const WA_CONFIG = 'whatsappConfig';

async function readWhatsAppConfig() {
  const defaults = {
    enabled: true,
    ownerPhone: wa.OWNER_PHONE,
    startMonth: wa.DEFAULT_START_MONTH,
    templateCheckin: '',
    templateSalary: '',
    language: 'en',
  };
  try {
    const snap = await db.collection(WA_CONFIG).doc('main').get();
    return snap.exists ? { ...defaults, ...(snap.data() || {}) } : defaults;
  } catch (err) {
    logger.warn('whatsappConfig could not be read, using defaults', { message: err.message });
    return defaults;
  }
}

async function whatsappRoster() {
  const snap = await db.collection('staff').get();
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(s => !s.deleted && (s.status || 'active') === 'active')
    .map(s => ({
      id: s.id,
      name: s.name || '',
      phone: s.phone || '',
      role: s.position || s.role || '',
    }));
}

/** One message per person; the doc id is deterministic, so a retry or a
 *  double schedule can never message the same person twice for one day. */
async function recordWhatsApp({ id, status, payload, extra = {} }) {
  try {
    await db.collection(WA_COLLECTION).doc(id).set({
      ...payload,
      ...extra,
      status,
      updatedAt: new Date(),
    }, { merge: true });
  } catch (err) {
    logger.error('whatsappAlerts write failed', { id, message: err.message });
  }
}

async function alreadySent(id) {
  try {
    const snap = await db.collection(WA_COLLECTION).doc(id).get();
    return snap.exists && snap.data().status === 'sent';
  } catch {
    return false;
  }
}

async function runCheckinReminders({ dayKey, trigger = 'schedule' } = {}) {
  const date = dayKey || todayKeyColombo();
  const cfg = await readWhatsAppConfig();
  const summary = { job: 'checkin', date, trigger, total: 0, sent: 0, manual: 0, failed: 0, skipped: 0 };
  if (!cfg.enabled) return { ...summary, disabled: true };

  const [staff, attSnap] = await Promise.all([
    whatsappRoster(),
    db.collection('attendance').where('date', '==', date).get(),
  ]);
  const records = attSnap.docs.map(d => d.data());
  const checkedIn = wa.checkedInStaff(staff, records);
  summary.total = checkedIn.length;

  const token = process.env.WHATSAPP_TOKEN || '';
  const phoneId = process.env.WHATSAPP_PHONE_ID || '';

  for (const person of checkedIn) {
    const id = `checkin_${date}_${person.id}`;
    if (await alreadySent(id)) { summary.skipped += 1; continue; }

    const message = wa.checkinConfirmation(person.name, date, person.attendance?.checkInMs);
    const first = String(person.name).trim().split(/\s+/)[0] || 'there';
    const res = await wa.sendWhatsApp({
      token,
      phoneId,
      to: person.phone,
      text: message,
      template: cfg.templateCheckin || '',
      params: [first, wa.prettyDay(date)],
      language: cfg.language || 'en',
    });
    const status = res.ok ? 'sent' : (res.skipped ? 'manual' : 'failed');
    summary[status] += 1;

    await recordWhatsApp({
      id,
      status,
      payload: {
        kind: 'checkin',
        date,
        staffId: person.id,
        staffName: person.name,
        phone: wa.normalizePhone(person.phone),
        checkInMs: person.attendance?.checkInMs || 0,
        message,
        waLink: wa.waLink(person.phone, message),
        template: cfg.templateCheckin || '',
        sentAt: res.ok ? new Date() : null,
        providerId: res.ok ? res.id : '',
        error: res.ok ? '' : String(res.error || ''),
        trigger,
      },
    });
  }

  logger.info('whatsapp check-in reminders', { summary: JSON.stringify(summary) });
  return summary;
}

async function runSalaryAlert({ dayKey, trigger = 'schedule' } = {}) {
  const today = dayKey || todayKeyColombo();
  const cfg = await readWhatsAppConfig();
  const month = wa.salaryWindow(today);
  const summary = { job: 'salary', date: today, month, trigger, pending: 0, status: 'skipped' };

  if (!month) return { ...summary, reason: 'not the 12th or 14th' };
  if (!wa.afterStartMonth(month, cfg.startMonth)) {
    return { ...summary, reason: `before the first alert month (${cfg.startMonth})` };
  }
  if (!cfg.enabled) return { ...summary, disabled: true };

  const [staff, paySnap] = await Promise.all([
    whatsappRoster(),
    db.collection('salaryPayments').where('month', '==', month).get(),
  ]);
  const unpaid = wa.unpaidStaff(staff, paySnap.docs.map(d => d.data()));
  summary.pending = unpaid.length;
  if (!unpaid.length) return { ...summary, reason: 'every salary is marked' };

  const id = `salary_${month}_${today}`;
  if (await alreadySent(id)) return { ...summary, reason: 'already alerted today' };

  const names = unpaid.map(s => `${s.name}${s.role ? ` (${s.role})` : ''}`);
  const message = wa.salaryPendingMessage(month, names);
  const to = cfg.ownerPhone || wa.OWNER_PHONE;
  const res = await wa.sendWhatsApp({
    token: process.env.WHATSAPP_TOKEN || '',
    phoneId: process.env.WHATSAPP_PHONE_ID || '',
    to,
    text: message,
    template: cfg.templateSalary || '',
    params: [wa.monthLabel(month), String(unpaid.length), names.join(', ')],
    language: cfg.language || 'en',
  });
  summary.status = res.ok ? 'sent' : (res.skipped ? 'manual' : 'failed');

  await recordWhatsApp({
    id,
    status: summary.status,
    payload: {
      kind: 'salary',
      date: today,
      month,
      staffName: `Payroll — ${wa.monthLabel(month)}`,
      phone: wa.normalizePhone(to),
      message,
      waLink: wa.waLink(to, message),
      pending: names,
      template: cfg.templateSalary || '',
      sentAt: res.ok ? new Date() : null,
      providerId: res.ok ? res.id : '',
      error: res.ok ? '' : String(res.error || ''),
      trigger,
    },
  });

  logger.info('whatsapp salary alert', { summary: JSON.stringify(summary) });
  return summary;
}

function assertAdminCaller(request) {
  const email = String(request.auth?.token?.email || '').toLowerCase();
  const ok = ADMIN_EMAILS.includes(email) || request.auth?.token?.admin === true;
  if (!ok) throw new HttpsError('permission-denied', 'Only the administrator can send WhatsApp alerts.');
}

exports.whatsappCheckinReminder = onSchedule(
  wa.CHECKIN_CRON, { timeZone: wa.TIME_ZONE }, async () => {
    try {
      await runCheckinReminders({ trigger: 'schedule' });
    } catch (err) {
      logger.error('scheduled check-in reminder failed', { message: String(err && err.message || err) });
    }
  },
);

exports.whatsappSalaryAlert = onSchedule(
  wa.SALARY_CRON, { timeZone: wa.TIME_ZONE }, async () => {
    try {
      await runSalaryAlert({ trigger: 'schedule' });
    } catch (err) {
      logger.error('scheduled salary alert failed', { message: String(err && err.message || err) });
    }
  },
);

exports.runWhatsAppCheckinNow = onCall({ timeoutSeconds: 120 }, async request => {
  assertAdminCaller(request);
  try {
    return await runCheckinReminders({ dayKey: request.data?.dayKey, trigger: 'admin' });
  } catch (err) {
    throw new HttpsError('internal', String(err && err.message || err));
  }
});

exports.runWhatsAppSalaryNow = onCall({ timeoutSeconds: 120 }, async request => {
  assertAdminCaller(request);
  try {
    return await runSalaryAlert({ dayKey: request.data?.dayKey, trigger: 'admin' });
  } catch (err) {
    throw new HttpsError('internal', String(err && err.message || err));
  }
});

/**
 * Boss & Manager Executive Connection API
 * Secure REST API for executive dashboard and 1-click approvals.
 */
exports.api = onRequest({ cors: true, timeoutSeconds: 60, region: 'asia-south1' }, async (req, res) => {
  return handleBossManagerApi(req, res, db);
});

// Re-exported for the QA tests (tests/qa.test.mjs requires this file).
exports._internals = { weekBounds, dateKeyOf, isoWeek, prettyDay, todayKeyColombo };
