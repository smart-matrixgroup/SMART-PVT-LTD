// ─────────────────────────────────────────────────────────────────
//  SMART PVT LTD — Daily 6:00 PM WhatsApp Work Report Bot (Baileys)
//
//  No Chrome / No Puppeteer — pure Node.js WebSocket client.
//  Sender  : Your WhatsApp (0766051023) via terminal QR scan
//  Receiver: Sir's WhatsApp + CC_PHONE (e.g. 94789999687@s.whatsapp.net)
//  Sends   : Today's Work Report PDF in Mobile view only
// ─────────────────────────────────────────────────────────────────
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import qrcode from 'qrcode-terminal';
import cron from 'node-cron';
import pino from 'pino';
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';

import { buildWorkReportPdfMobile } from '../src/erp/utils/workReportPdfMobile.js';
import { normalizeOfficialStaff } from '../src/staff/canonicalStaff.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load root .env (Firebase config) + local whatsapp-bot/.env (bot settings)
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '.env'), override: true });

// ── Health-check web server (keeps Render Free Web Service alive) ─
import http from 'http';
const PORT = process.env.PORT || 3000;
const healthServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('SMART WhatsApp Bot is running 24/7 (Target: ' + SIR_PHONE + ')');
});
healthServer.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.log(`⚠️ Port ${PORT} already in use; continuing without health server.`);
  } else {
    console.error('❌ Health server error:', err);
  }
});
healthServer.listen(PORT, () => {
  console.log(`🌐 Health server listening on port ${PORT}`);
});

const SIR_PHONE = (process.env.SIR_PHONE || '94789999687').replace(/\D+/g, '');
const CC_PHONE = (process.env.CC_PHONE || '').replace(/\D+/g, '');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@findmysmart.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 18 * * 1-6';
const AUTO_CHECKOUT_CRON = process.env.AUTO_CHECKOUT_CRON || '30 17 * * 1-6';
const TIME_ZONE = process.env.TIME_ZONE || 'Asia/Colombo';
const TEST_NOW = process.argv.includes('--test-now');
const testToArg = process.argv.find(a => a.startsWith('--test-to='));
const TEST_TO_PHONE = testToArg ? testToArg.split('=')[1].replace(/\D+/g, '') : '';
const testDateArg = process.argv.find(a => a.startsWith('--test-date='));
const TEST_DATE = testDateArg ? testDateArg.split('=')[1].trim() : '';

// Cache sent messages so Baileys can answer Signal retry receipts (prevents
// "Waiting for this message. This may take a while." on linked devices / phone).
const sentMessages = new Map();
const retryStore = new Map();
const msgRetryCounterCache = {
  get: key => retryStore.get(key),
  set: (key, val) => { retryStore.set(key, val); },
  del: key => { retryStore.delete(key); },
  flushAll: () => { retryStore.clear(); },
};

async function sendTracked(sock, jid, content) {
  const sent = await sock.sendMessage(jid, content);
  if (sent?.key?.id && sent?.message) {
    sentMessages.set(sent.key.id, sent.message);
    if (sentMessages.size > 200) {
      const oldest = sentMessages.keys().next().value;
      sentMessages.delete(oldest);
    }
  }
  return sent;
}

if (!ADMIN_PASSWORD) {
  console.error('❌ ADMIN_PASSWORD missing! Copy whatsapp-bot/.env.example to whatsapp-bot/.env and enter your ERP Admin password.');
  process.exit(1);
}

// ── Firebase setup ───────────────────────────────────────────────
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('❌ Root .env Firebase config (VITE_FIREBASE_*) not found!');
  process.exit(1);
}

const fbApp = initializeApp(firebaseConfig, 'whatsapp-bot');
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);

/** Today's YYYY-MM-DD in Asia/Colombo. */
function todayColomboIso() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const get = t => parts.find(p => p.type === t)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** '2026-11-25' → '25 Nov 2026 | Wednesday' */
function prettyPeriod(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  const datePart = dt.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
  const dayPart = dt.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
  return `${datePart} | ${dayPart}`;
}

/** Convert jsPDF doc → Buffer. */
function pdfToBuffer(doc) {
  return Buffer.from(doc.output('arraybuffer'));
}

/** Auto-checkout anyone who checked in today but did not check out by 5:30 PM. */
async function runAutoCheckout(todayIso = todayColomboIso()) {
  if (!auth.currentUser) {
    await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
  }
  const autoOutMs = new Date(`${todayIso}T17:30:00+05:30`).getTime();
  const attSnap = await getDocs(query(collection(db, 'attendance'), where('date', '==', todayIso)));
  let closedCount = 0;

  for (const d of attSnap.docs) {
    const r = d.data() || {};
    const inMs = Number(r.checkInMs || 0);
    const outMs = Number(r.checkOutMs || 0);
    if (inMs > 0 && outMs <= 0 && r.status !== 'Holiday' && r.status !== 'Leave') {
      const minutes = Math.max(0, Math.round((autoOutMs - inMs) / 60000));
      await updateDoc(doc(db, 'attendance', d.id), {
        checkOutMs: autoOutMs,
        minutes,
        autoClosed: true,
        updatedAt: serverTimestamp(),
      });
      closedCount++;
      console.log(`🕠 Auto checked-out ${r.staffName || r.staffId || d.id} at 05:30 PM`);
    }
  }
  return closedCount;
}

/** Fetch today's attendance + updates + build Mobile PDF + send via Baileys. */
async function sendDailyWorkReportPdfs(sock, overridePhone = '', overrideDate = '') {
  const todayIso = overrideDate || todayColomboIso();
  const period = prettyPeriod(todayIso);
  console.log(`\n📄 Preparing Daily Attendance & Work Report for ${todayIso} (${period})...`);

  if (!auth.currentUser) {
    await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
  }

  // Ensure any unclosed check-ins are auto-checked-out at 5:30 PM before building the report.
  if (!overridePhone) {
    await runAutoCheckout(todayIso);
  }

  const [staffSnap, updatesSnap, attSnap] = await Promise.all([
    getDocs(collection(db, 'staff')),
    getDocs(query(collection(db, 'dailyUpdates'), where('date', '==', todayIso))),
    getDocs(query(collection(db, 'attendance'), where('date', '==', todayIso))),
  ]);

  const rawStaff = staffSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(s => s && s.deleted !== true);
  const staffRecords = normalizeOfficialStaff(rawStaff);

  const updates = updatesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const attendanceRecords = attSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const activeAttendance = attendanceRecords.filter(
    r => r && (Number(r.checkInMs || 0) > 0 || (r.status && r.status !== 'Holiday' && r.status !== 'Leave'))
  );

  console.log(`   Found ${activeAttendance.length} check-in(s) and ${updates.length} work report(s) for today.`);

  // Holiday check: if nobody checked in AND nobody submitted a work report, skip sending.
  if (updates.length === 0 && activeAttendance.length === 0 && !overridePhone) {
    console.log(`🏖️ Holiday / no activity for ${todayIso} (0 check-ins, 0 reports). Skipping WhatsApp send.`);
    return;
  }

  const recipients = [];
  if (overridePhone) {
    recipients.push(`${overridePhone}@s.whatsapp.net`);
  } else {
    recipients.push(`${SIR_PHONE}@s.whatsapp.net`);
    if (CC_PHONE) {
      for (const extra of CC_PHONE.split(',').map(p => p.replace(/\D+/g, '')).filter(Boolean)) {
        const jid = `${extra}@s.whatsapp.net`;
        if (!recipients.includes(jid)) recipients.push(jid);
      }
    }
  }

  if (updates.length === 0 && activeAttendance.length === 0) {
    const emptyMsg = `Respected Sir,\n\n📊 *DAILY ATTENDANCE & WORK REPORT — ${period}*\n\nNo check-ins or work reports recorded yet for today (${todayIso}).\n\n_Test message from SMART ERP_`;
    for (const jid of recipients) {
      await sendTracked(sock, jid, { text: emptyMsg });
    }
    console.log('ℹ️ Sent test notice (0 check-ins, 0 reports).');
    return;
  }

  const pdfOpts = {
    staffRecords,
    attendanceRecords: activeAttendance,
    kind: 'DAILY ATTENDANCE & WORK REPORT',
    period,
    generatedBy: ADMIN_EMAIL,
  };

  const mobileBuf = pdfToBuffer(buildWorkReportPdfMobile(updates, pdfOpts));

  const introMsg = [
    'Respected Sir,',
    '',
    `Please find attached the SMART Daily Attendance and Work Sheet Report for *${period}*.`,
    '',
    `• Staff Checked In: *${activeAttendance.length}*`,
    `• Work Reports Submitted: *${updates.length}*`,
    '',
    '_Sent automatically from SMART ERP._',
  ].join('\n');

  for (const jid of recipients) {
    // Show typing indicator before sending the PDF
    await sock.sendPresenceUpdate('composing', jid);
    // Small realistic delay (2 seconds) to mimic human typing
    await new Promise(r => setTimeout(r, 2000));
    await sendTracked(sock, jid, {
      document: mobileBuf,
      mimetype: 'application/pdf',
      fileName: `SMART-DAILY-REPORT-${todayIso}.pdf`,
      caption: introMsg,
    });
    console.log(`✅ Sent single combined report PDF to ${jid}`);
  }
}

let activeSock = null;
let cronStarted = false;
let testSent = false;

async function startBot() {
  const sessionDir = path.resolve(__dirname, 'whatsapp_session');
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();

  const logger = pino({ level: 'silent' });
  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    logger,
    browser: ['Windows', 'Chrome', '120.0.0'],
    syncFullHistory: false,
    markOnlineOnConnect: false,
    msgRetryCounterCache,
    getMessage: async key => {
      const msg = sentMessages.get(key?.id);
      if (msg) console.log(`🔁 Answering retry receipt for message ${key.id}`);
      return msg;
    },
  });

  activeSock = sock;
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async update => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n📱 உங்க 0766051023 WhatsApp-ல Linked Devices -> Link a Device போய் இந்த QR Code-அ scan பண்ணுங்க:\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      console.log(`✅ WhatsApp Bot Connected! (Target Sir: ${SIR_PHONE}, Schedule: "${CRON_SCHEDULE}" ${TIME_ZONE})`);

      if (!cronStarted) {
        cronStarted = true;
        cron.schedule(AUTO_CHECKOUT_CRON, async () => {
          console.log(`🕠 Triggered 5:30 PM auto-checkout (${AUTO_CHECKOUT_CRON} ${TIME_ZONE})...`);
          try {
            const count = await runAutoCheckout();
            console.log(`✅ Auto-checkout finished (${count} record(s) closed).`);
          } catch (err) {
            console.error('❌ Auto-checkout failed:', err);
          }
        }, { timezone: TIME_ZONE });

        cron.schedule(CRON_SCHEDULE, async () => {
          console.log(`⏰ Triggered scheduled job (${CRON_SCHEDULE} ${TIME_ZONE})...`);
          try {
            if (activeSock) await sendDailyWorkReportPdfs(activeSock);
          } catch (err) {
            console.error('❌ Scheduled send failed:', err);
          }
        }, { timezone: TIME_ZONE });
      }

      if ((TEST_NOW || TEST_TO_PHONE) && !testSent) {
        testSent = true;
        console.log(`🧪 Test send triggered${TEST_TO_PHONE ? ` to ${TEST_TO_PHONE}` : ''}${TEST_DATE ? ` for ${TEST_DATE}` : ''}...`);
        try {
          await sendDailyWorkReportPdfs(sock, TEST_TO_PHONE, TEST_DATE);
          if (TEST_TO_PHONE) {
            console.log('⏳ Keeping connection open 30s for delivery/retry receipts...');
            setTimeout(() => process.exit(0), 30000);
          }
        } catch (err) {
          console.error('❌ Test send failed:', err);
          if (TEST_TO_PHONE) process.exit(1);
        }
      }
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect =
        statusCode !== DisconnectReason.loggedOut &&
        statusCode !== DisconnectReason.connectionReplaced;
      console.log(`⚠️ Connection closed (code ${statusCode}). Reconnecting: ${shouldReconnect}`);
      if (statusCode === DisconnectReason.connectionReplaced) {
        console.log('⚠️ Another WhatsApp Bot instance connected with this session. Stopping this instance to avoid conflict.');
      } else if (shouldReconnect) {
        setTimeout(() => startBot(), 3000);
      } else {
        console.log('❌ Logged out. Delete whatsapp_session folder and scan QR again.');
      }
    }
  });
}

console.log('🚀 Starting SMART Daily WhatsApp PDF Bot (Baileys)...');
startBot().catch(err => {
  console.error('❌ Bot failed to start:', err);
  process.exit(1);
});
