// ─────────────────────────────────────────────────────────────────
//  SMART PVT LTD — Daily 6:00 PM WhatsApp Work Report Bot (Baileys)
//
//  No Chrome / No Puppeteer — pure Node.js WebSocket client.
//  Sender  : Your WhatsApp (0766051023) via terminal QR scan
//  Receiver: Sir's WhatsApp (0789999687 → 94789999687@s.whatsapp.net)
//  Sends   : Today's Work Report PDF in BOTH Mobile view & A4 view
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
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

import { buildWorkReportPdfA4 } from '../src/erp/utils/workReportPdfA4.js';
import { buildWorkReportPdfMobile } from '../src/erp/utils/workReportPdfMobile.js';
import { normalizeOfficialStaff } from '../src/staff/canonicalStaff.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load root .env (Firebase config) + local whatsapp-bot/.env (bot settings)
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '.env'), override: true });

// ── Health-check web server (keeps Render Free Web Service alive) ─
import http from 'http';
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('SMART WhatsApp Bot is running 24/7 (Target: ' + SIR_PHONE + ')');
}).listen(PORT, () => {
  console.log(`🌐 Health server listening on port ${PORT}`);
});

const SIR_PHONE = (process.env.SIR_PHONE || '94789999687').replace(/\D+/g, '');
const CC_PHONE = (process.env.CC_PHONE || '').replace(/\D+/g, '');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@findmysmart.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 18 * * 1-6';
const TIME_ZONE = process.env.TIME_ZONE || 'Asia/Colombo';
const TEST_NOW = process.argv.includes('--test-now');

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

/** Fetch today's updates + build Mobile & A4 PDFs + send via Baileys. */
async function sendDailyWorkReportPdfs(sock) {
  const todayIso = todayColomboIso();
  const period = prettyPeriod(todayIso);
  console.log(`\n📄 Preparing Daily Work Report for ${todayIso} (${period})...`);

  if (!auth.currentUser) {
    await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
  }

  const [staffSnap, updatesSnap] = await Promise.all([
    getDocs(collection(db, 'staff')),
    getDocs(query(collection(db, 'dailyUpdates'), where('date', '==', todayIso))),
  ]);

  const rawStaff = staffSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(s => s && s.deleted !== true);
  const staffRecords = normalizeOfficialStaff(rawStaff);

  const updates = updatesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`   Found ${updates.length} work report(s) for today.`);

  const recipients = [`${SIR_PHONE}@s.whatsapp.net`];
  if (CC_PHONE) recipients.push(`${CC_PHONE}@s.whatsapp.net`);

  if (updates.length === 0) {
    const emptyMsg = `Respected Sir,\n\n📊 *DAILY WORK REPORT — ${period}*\n\nNo staff work sheets have been submitted yet for today (${todayIso}).\n\n_Sent automatically from SMART ERP_`;
    for (const jid of recipients) {
      await sock.sendMessage(jid, { text: emptyMsg });
    }
    console.log('ℹ️ Sent notice (0 reports submitted today).');
    return;
  }

  const pdfOpts = {
    staffRecords,
    kind: 'DAILY WORK REPORT',
    period,
    generatedBy: ADMIN_EMAIL,
  };

  const mobileBuf = pdfToBuffer(buildWorkReportPdfMobile(updates, pdfOpts));
  const a4Buf = pdfToBuffer(buildWorkReportPdfA4(updates, pdfOpts));

  const introMsg = [
    'Respected Sir,',
    '',
    `📊 *DAILY WORK REPORT — ${period}*`,
    `Reports submitted: *${updates.length}*`,
    '',
    'Attached below:',
    '1️⃣ *Mobile View PDF* (Phone-friendly)',
    '2️⃣ *A4 View PDF* (Print / Laptop)',
    '',
    '_Automated 6:00 PM update from SMART ERP_',
  ].join('\n');

  for (const jid of recipients) {
    await sock.sendMessage(jid, { text: introMsg });
    await sock.sendMessage(jid, {
      document: mobileBuf,
      mimetype: 'application/pdf',
      fileName: `DAILY-WORK-REPORT-MOBILE-${todayIso}.pdf`,
      caption: `📱 Mobile View — ${period}`,
    });
    await sock.sendMessage(jid, {
      document: a4Buf,
      mimetype: 'application/pdf',
      fileName: `DAILY-WORK-REPORT-A4-${todayIso}.pdf`,
      caption: `🖨️ A4 Print View — ${period}`,
    });
    console.log(`✅ Sent Mobile + A4 PDFs to ${jid}`);
  }
}

let activeSock = null;
let cronStarted = false;
let testSent = false;

async function startBot() {
  const sessionDir = path.resolve(__dirname, 'whatsapp_session');
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: ['SMART ERP', 'Chrome', '1.0.0'],
    syncFullHistory: false,
    markOnlineOnConnect: false,
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
        cron.schedule(CRON_SCHEDULE, async () => {
          console.log(`⏰ Triggered scheduled job (${CRON_SCHEDULE} ${TIME_ZONE})...`);
          try {
            if (activeSock) await sendDailyWorkReportPdfs(activeSock);
          } catch (err) {
            console.error('❌ Scheduled send failed:', err);
          }
        }, { timezone: TIME_ZONE });
      }

      if (TEST_NOW && !testSent) {
        testSent = true;
        console.log('🧪 --test-now detected: sending today\'s PDFs right now...');
        try {
          await sendDailyWorkReportPdfs(sock);
        } catch (err) {
          console.error('❌ Test send failed:', err);
        }
      }
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`⚠️ Connection closed (code ${statusCode}). Reconnecting: ${shouldReconnect}`);
      if (shouldReconnect) {
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
