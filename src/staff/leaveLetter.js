// ─────────────────────────────────────────────────────────────────
//  Staff leave application — the paper letter, drawn on canvas.
//
//  The staff member fills the small form in their portal; this module
//  paints that answer sheet as one A4-shaped image (the same hand-drawn
//  canvas approach the invoice / quotation image studio uses — no
//  html2canvas, no print dialog). The PNG is uploaded to
//  staff-docs/{uid}/leave_… .png and its PATH is what the leave document
//  keeps, so opening it runs the storage rules every time.
//
//  When the owner's printed leave format arrives, the layout below is the
//  only thing that changes: the fields, the blob helper and the stored
//  path all stay as they are.
// ─────────────────────────────────────────────────────────────────
// The .js extension is deliberate: qa.test.mjs imports this module straight
// into Node, where an extensionless specifier does not resolve.
import { company } from '../config/company.js';

export const LEAVE_TYPES = ['Casual', 'Sick', 'Family Emergency', 'Other'];
export const LEAVE_STATUSES = ['Pending', 'Approved', 'Rejected'];

const INK = '#16233D';
const MUTED = '#5A6B8C';
const BLUE = '#0066FF';
const LINE = '#C9D5EC';

const p2 = n => String(n).padStart(2, '0');

/** 'yyyy-mm-dd' → '02-Nov-2026' (the way the printed form writes a date). */
export function letterDate(iso) {
  const d = new Date(`${String(iso || '').slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso || '—';
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
  return `${p2(d.getDate())}-${mo}-${d.getFullYear()}`;
}

/** Inclusive day count between two 'yyyy-mm-dd' keys (same day = 1, reversed = 0). */
export function leaveDays(from, to) {
  const a = new Date(`${String(from || '').slice(0, 10)}T12:00:00`);
  const b = new Date(`${String(to || from || '').slice(0, 10)}T12:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  if (b < a) return 0;   // an end day before the start day is not a period at all
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

/** Every 'yyyy-mm-dd' the leave covers — used by the attendance statement. */
export function leaveDateList(from, to) {
  const n = leaveDays(from, to);
  if (!n) return [];
  const out = [];
  const d = new Date(`${String(from).slice(0, 10)}T12:00:00`);
  for (let i = 0; i < n; i++) {
    out.push(`${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`);
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function setFont(ctx, size, weight = 'normal') {
  // The weight must be followed by a space: '700' + '13px' would glue into
  // '70013px', which CSS reads as a 70013-point font — the letter then draws
  // one giant glyph that smears across the whole page.
  const w = weight === 'bold' ? '700 ' : weight === 'italic' ? 'italic ' : '';
  ctx.font = `${w}${size}px Arial, "Helvetica Neue", sans-serif`;
}

function wrap(ctx, text, maxW) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const out = [];
  let line = '';
  words.forEach(w => {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > maxW && line) { out.push(line); line = w; }
    else line = next;
  });
  if (line) out.push(line);
  return out;
}

function loadImage(src) {
  return new Promise(resolve => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Paint the application letter into `canvas` (an A4-shaped canvas the caller
 * sizes; 1000 x 1414 draws crisply and stays under a megabyte as PNG).
 *
 * d = { staffName, staffRole, staffId, contact, type, from, to, days,
 *       reason, handover, appliedOn }
 */
export async function drawLeaveLetter(canvas, d = {}) {
  const W = canvas.width || 1000;
  const H = canvas.height || Math.round(W * 1.414);
  const ctx = canvas.getContext('2d');
  const M = Math.round(W * 0.085);
  const CW = W - M * 2;
  const s = k => Math.round((W / 1000) * k);   // scale against the 1000-wide design

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  // ── letterhead ─────────────────────────────────────────────
  ctx.fillStyle = '#0B1F44';
  ctx.fillRect(0, 0, W, s(132));
  ctx.fillStyle = BLUE;
  ctx.fillRect(0, s(132), W, s(5));

  const logo = await loadImage(company.logos?.lightMode);
  let textX = M;
  if (logo) {
    const h = s(78);
    const w = Math.min(s(220), (logo.width / logo.height) * h);
    ctx.drawImage(logo, M, s(28), w, h);
    textX = M + w + s(20);
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  setFont(ctx, s(27), 'bold');
  ctx.fillText(company.fullName || 'SMART Pvt Ltd', textX, s(58));
  setFont(ctx, s(13));
  ctx.fillStyle = '#C7D6F2';
  ctx.fillText(`${company.contact?.address || ''}`, textX, s(82));
  ctx.fillText(`${company.contact?.phone || ''}  ·  ${company.contact?.email || ''}`, textX, s(102));

  let y = s(190);

  // ── title + date ───────────────────────────────────────────
  ctx.fillStyle = INK;
  setFont(ctx, s(26), 'bold');
  ctx.fillText('LEAVE APPLICATION', M, y);
  setFont(ctx, s(14));
  ctx.fillStyle = MUTED;
  const applied = d.appliedOn || new Date().toISOString().slice(0, 10);
  const dateTxt = `Date: ${letterDate(applied)}`;
  ctx.textAlign = 'right';
  ctx.fillText(dateTxt, W - M, y);
  ctx.textAlign = 'left';

  y += s(22);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(W - M, y); ctx.stroke();

  y += s(40);
  setFont(ctx, s(15));
  ctx.fillStyle = INK;
  ['To: The Manager / Administration', `${company.fullName} — Head Office, Trincomalee`].forEach(line => {
    ctx.fillText(line, M, y); y += s(24);
  });

  // ── applicant block ────────────────────────────────────────
  y += s(14);
  ctx.fillStyle = '#F4F7FE';
  ctx.fillRect(M, y, CW, s(116));
  ctx.strokeStyle = LINE;
  ctx.strokeRect(M, y, CW, s(116));
  const rows = [
    ['Name', d.staffName || '—'],
    ['Designation', d.staffRole || '—'],
    ['Staff ID', d.staffId || '—'],
    ['Contact number', d.contact || '—'],
  ];
  setFont(ctx, s(14));
  rows.forEach((r, i) => {
    const ry = y + s(28) + i * s(26);
    ctx.fillStyle = MUTED;
    setFont(ctx, s(13), 'bold');
    ctx.fillText(String(r[0]).toUpperCase(), M + s(18), ry);
    ctx.fillStyle = INK;
    setFont(ctx, s(15));
    ctx.fillText(String(r[1]), M + s(220), ry);
  });
  y += s(116) + s(38);

  // ── subject + body ─────────────────────────────────────────
  ctx.fillStyle = INK;
  setFont(ctx, s(16), 'bold');
  const days = d.days || leaveDays(d.from, d.to);
  const span = String(d.from || '') === String(d.to || '')
    ? letterDate(d.from)
    : `${letterDate(d.from)} to ${letterDate(d.to)}`;
  ctx.fillText(`Subject: ${d.type || 'Casual'} leave for ${days} day${days === 1 ? '' : 's'} (${span})`, M, y);
  y += s(38);

  setFont(ctx, s(15));
  ctx.fillStyle = INK;
  ['Respected Sir/Madam,', ''].forEach(line => { ctx.fillText(line, M, y); y += s(26); });

  const para = `I request ${days} day${days === 1 ? '' : 's'} of ${String(d.type || 'Casual').toLowerCase()} leave from ${letterDate(d.from)} to ${letterDate(d.to)} on account of the following:`;
  wrap(ctx, para, CW).forEach(line => { ctx.fillText(line, M, y); y += s(26); });

  y += s(8);
  ctx.fillStyle = '#FBFCFF';
  const reasonLines = wrap(ctx, d.reason || '—', CW - s(36));
  ctx.fillRect(M, y - s(18), CW, reasonLines.length * s(26) + s(24));
  ctx.strokeStyle = LINE;
  ctx.strokeRect(M, y - s(18), CW, reasonLines.length * s(26) + s(24));
  ctx.fillStyle = INK;
  reasonLines.forEach(line => { ctx.fillText(line, M + s(18), y + s(2)); y += s(26); });
  y += s(34);

  if (String(d.handover || '').trim()) {
    setFont(ctx, s(15));
    wrap(ctx, d.handover.trim(), CW).forEach(line => { ctx.fillText(line, M, y); y += s(26); });
    y += s(10);
  }

  setFont(ctx, s(15));
  ['Thank you for your consideration.', '', 'Yours sincerely,'].forEach(line => {
    ctx.fillStyle = INK;
    ctx.fillText(line, M, y); y += s(26);
  });

  // ── signature ──────────────────────────────────────────────
  y += s(34);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(M + s(250), y); ctx.stroke();
  setFont(ctx, s(13));
  ctx.fillStyle = MUTED;
  ctx.fillText(`${d.staffName || ''} — Applicant signature`, M, y + s(22));

  // ── office use box ─────────────────────────────────────────
  y += s(78);
  const boxH = s(170);
  ctx.fillStyle = '#F4F7FE';
  ctx.fillRect(M, y, CW, boxH);
  ctx.strokeStyle = BLUE;
  ctx.lineWidth = 1.6;
  ctx.strokeRect(M, y, CW, boxH);
  setFont(ctx, s(13), 'bold');
  ctx.fillStyle = BLUE;
  ctx.fillText('FOR OFFICE USE ONLY', M + s(18), y + s(28));
  setFont(ctx, s(15));
  ctx.fillStyle = INK;
  // Real drawn boxes — a "□" character depends on the font and can land as
  // tofu, which would ruin the office-use section.
  const tick = (label, x, baseline) => {
    ctx.fillStyle = INK;
    setFont(ctx, s(15));
    ctx.fillText(label, x, baseline);
    const lw = ctx.measureText(label).width;
    const bx = x + lw + s(10);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.strokeRect(bx, baseline - s(13), s(16), s(16));
    return bx + s(16);
  };
  const afterApproved = tick('Approved', M + s(18), y + s(64));
  tick('Not Approved', afterApproved + s(28), y + s(64));
  ctx.fillStyle = INK;
  setFont(ctx, s(15));
  ctx.fillText('Leave period confirmed: ______ / ______ / __________', M + s(18), y + s(96));
  ctx.fillText('Manager discussion / remarks:', M + s(18), y + s(128));
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(M + s(240), y + s(146)); ctx.lineTo(M + CW - s(18), y + s(146));
  ctx.stroke();
  setFont(ctx, s(13));
  ctx.fillStyle = MUTED;
  ctx.fillText('Manager signature', M + s(18), y + s(158));

  return canvas;
}

/** The painted letter as a PNG blob, ready for uploadBytes. */
export async function leaveLetterBlob(d) {
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 1414;
  await drawLeaveLetter(canvas, d);
  return new Promise(resolve => canvas.toBlob(b => resolve(b), 'image/png'));
}
