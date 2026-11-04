// ─────────────────────────────────────────────────────────────────
//  Job offer letter → real A4 PDF.
//
//  Unlike the table reports this is a letter: white paper, company
//  letterhead at the top, reference + date, addressed body, a salary
//  table, numbered terms and a signature block. jsPDF's built-in fonts
//  are WinAnsi, so every string goes through pdfSafe() first.
// ─────────────────────────────────────────────────────────────────
import { jsPDF } from 'jspdf';
import { pdfSafe } from '../utils/reportPdf.js';
import { company } from '../../config/company.js';
import {
  salaryRows, netSalary, amountInWords, prettyDate, money,
  resolvedOpening, resolvedClosing, resolvedTerms,
} from './offerLetterModel.js';

const INK = [26, 32, 44];
const MUTED = [105, 115, 130];
const BLUE = [0, 102, 255];
const CYAN = [0, 178, 214];
const LINE = [208, 216, 230];
const WASH = [244, 248, 255];

const M = 52;          // side margin, pt
const BOTTOM = 64;     // keep the footer clear

const ink = (doc, c) => doc.setTextColor(c[0], c[1], c[2]);
const rule = (doc, c, w = 0.7) => {
  doc.setDrawColor(c[0], c[1], c[2]);
  doc.setLineWidth(w);
};

const lkr = n => `LKR ${Math.round(Number(n) || 0).toLocaleString('en-LK')}`;

/** Company contact block — pulled from the same config as the website. */
const contactLines = () => [
  company.contact?.address,
  [company.contact?.phoneDisplay || company.contact?.phone, company.contact?.email]
    .filter(Boolean).join('  ·  '),
  company.website,
].filter(Boolean);

/**
 * Build the document (without saving) so tests and the preview can both
 * use it. `logoDataUrl` is optional — without it the header is text only.
 */
export function buildOfferLetterPdf(form = {}, { logoDataUrl = '', signerName = '', signerTitle = 'Managing Director' } = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const W = PW - M * 2;
  const refNo = form.refNo || '';
  let y = 0;

  const footer = () => {
    const page = doc.internal.getNumberOfPages();
    rule(doc, LINE, 0.5);
    doc.line(M, PH - 46, PW - M, PH - 46);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); ink(doc, MUTED);
    doc.text(pdfSafe(`${company.name} · ${refNo}`), M, PH - 34);
    doc.text(`Page ${page}`, PW - M, PH - 34, { align: 'right' });
  };

  const newPage = () => {
    footer();
    doc.addPage();
    // continuation header keeps the letter identifiable on page 2+
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); ink(doc, MUTED);
    doc.text(pdfSafe(`${company.name} · ${form.position || 'Letter of Appointment'}`), M, 40);
    if (refNo) doc.text(pdfSafe(`Ref: ${refNo}`), PW - M, 40, { align: 'right' });
    rule(doc, LINE, 0.5);
    doc.line(M, 48, PW - M, 48);
    y = 72;
  };

  /** Reserve vertical space; a new page when a block would overhang. */
  const need = h => {
    if (y + h > PH - BOTTOM) newPage();
  };

  /** Wrapped paragraph; returns the y below the last line. */
  const para = (text, {
    size = 10, font = 'normal', color = INK, lh = 14.5, indent = 0, after = 6, align = 'left',
  } = {}) => {
    doc.setFont('helvetica', font); doc.setFontSize(size); ink(doc, color);
    const lines = doc.splitTextToSize(pdfSafe(text), W - indent);
    lines.forEach(line => {
      need(lh);
      doc.text(line, M + indent, y, align === 'center' ? { align: 'center' } : undefined);
      y += lh;
    });
    y += after;
    return y;
  };

  // ── Letterhead ───────────────────────────────────────────────────
  if (logoDataUrl) {
    try {
      const lw = 148;
      const lh = lw * (809 / 1942);
      doc.addImage(logoDataUrl, 'PNG', M, 34, lw, lh);
    } catch { /* a broken logo must never block the letter */ }
  } else {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); ink(doc, INK);
    doc.text('SMART [PVT] LTD', M, 50);
  }

  const right = PW - M;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); ink(doc, INK);
  doc.text('SMART [PVT] LTD', right, 44, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8); ink(doc, MUTED);
  contactLines().forEach((line, i) => doc.text(pdfSafe(line), right, 57 + i * 10, { align: 'right' }));

  y = 112;
  rule(doc, BLUE, 2.4);
  doc.line(M, y, PW - M, y);
  rule(doc, CYAN, 0.8);
  doc.line(M, y + 3.5, M + W * 0.38, y + 3.5);

  // ── Reference + date ─────────────────────────────────────────────
  y += 24;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); ink(doc, MUTED);
  doc.text('REF:', M, y);
  doc.setFont('helvetica', 'normal'); ink(doc, INK);
  doc.text(pdfSafe(refNo || '—'), M + 26, y);
  doc.setFont('helvetica', 'bold'); ink(doc, MUTED);
  doc.text('DATE:', right - 92, y);
  doc.setFont('helvetica', 'normal'); ink(doc, INK);
  doc.text(pdfSafe(prettyDate(form.date)), right, y, { align: 'right' });

  // ── Addressee ────────────────────────────────────────────────────
  y += 26;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); ink(doc, INK);
  doc.text(pdfSafe(form.staffName || '—'), M, y); y += 13;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.3); ink(doc, MUTED);
  [form.position && `${form.position}${form.department ? `, ${form.department}` : ''}`,
    form.address, [form.phone, form.email].filter(Boolean).join('  ·  ')]
    .filter(Boolean).forEach(line => {
      doc.text(pdfSafe(line), M, y);
      y += 12;
    });

  // ── Subject ──────────────────────────────────────────────────────
  y += 14;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); ink(doc, INK);
  const subject = String(form.subject || 'Letter of Appointment').toUpperCase();
  doc.text(pdfSafe(subject), PW / 2, y, { align: 'center' });
  const sw = doc.getTextWidth(pdfSafe(subject));
  rule(doc, LINE, 0.6);
  doc.line(PW / 2 - sw / 2, y + 4, PW / 2 + sw / 2, y + 4);
  y += 22;

  // ── Body ─────────────────────────────────────────────────────────
  resolvedOpening(form).split(/\n\n+/).forEach(p => para(p, { after: 8 }));

  // ── Appointment details table ────────────────────────────────────
  const details = [
    ['Position', form.position],
    ['Department', form.department],
    ['Employment type', [form.employmentType, form.employmentKind].filter(Boolean).join(' · ')],
    ['Date of joining', prettyDate(form.startDate)],
    ['Probation', money(form.probationMonths) ? `${money(form.probationMonths)} month${money(form.probationMonths) === 1 ? '' : 's'}` : '—'],
    ['Place of work', form.location],
    ['Reporting to', form.reportingTo],
  ].filter(([, v]) => String(v || '').trim());

  const rowH = 17;
  const blockH = 26 + details.length * rowH + 10;
  need(blockH + 10);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.6); ink(doc, BLUE);
  doc.text('APPOINTMENT DETAILS', M, y); y += 10;
  doc.setFillColor(...WASH);
  doc.rect(M, y, W, details.length * rowH + 4, 'F');
  rule(doc, BLUE, 2);
  doc.line(M, y, M, y + details.length * rowH + 4);
  let ry = y + 17;
  details.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); ink(doc, MUTED);
    doc.text(pdfSafe(label), M + 12, ry);
    doc.setFont('helvetica', 'bold'); ink(doc, INK);
    doc.text(pdfSafe(String(value)), M + 148, ry, { maxWidth: W - 160 });
    ry += rowH;
  });
  y += details.length * rowH + 18;

  // ── Salary ───────────────────────────────────────────────────────
  const rows = salaryRows(form);
  need(34 + rows.length * 16 + 26);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.6); ink(doc, BLUE);
  doc.text('REMUNERATION', M, y); y += 12;
  rows.forEach(r => {
    doc.setFont('helvetica', r.strong ? 'bold' : 'normal');
    doc.setFontSize(r.strong ? 10 : 9.2);
    ink(doc, r.strong ? INK : MUTED);
    doc.text(pdfSafe(r.label), M + 4, y);
    doc.setFont('helvetica', r.strong ? 'bold' : 'normal');
    ink(doc, r.strong ? BLUE : INK);
    const sign = r.value < 0 ? '-' : '';
    doc.text(`${sign}${lkr(Math.abs(r.value))}${form.payFrequency ? ` / ${String(form.payFrequency).toLowerCase()}` : ''}`,
      PW - M - 4, y, { align: 'right' });
    if (r.strong) {
      rule(doc, LINE, 0.6);
      doc.line(M + 4, y - 10, PW - M - 4, y - 10);
    }
    y += r.strong ? 22 : 15;
  });
  const words = amountInWords(netSalary(form));
  if (words) para(`In words: ${words}.`, { size: 8.8, font: 'italic', color: MUTED, after: 10 });

  // ── Terms ────────────────────────────────────────────────────────
  need(30);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.6); ink(doc, BLUE);
  doc.text('TERMS OF APPOINTMENT', M, y); y += 16;

  resolvedTerms(form).forEach((t, i) => {
    const title = `${i + 1}. ${t.title || 'Term'}`;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.3); ink(doc, INK);
    const titleLines = doc.splitTextToSize(pdfSafe(title), W);
    titleLines.forEach(l => { need(13); doc.text(l, M, y); y += 13; });
    if (t.text) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.2); ink(doc, [52, 60, 74]);
      doc.splitTextToSize(pdfSafe(t.text), W - 14).forEach(line => {
        need(13.5);
        doc.text(line, M + 14, y);
        y += 13.5;
      });
    }
    y += 6;
  });

  if (String(form.notes || '').trim()) {
    y += 2;
    para(form.notes, { size: 9.2, color: [52, 60, 74], after: 8 });
  }

  // ── Closing + signature ──────────────────────────────────────────
  y += 6;
  resolvedClosing(form).split(/\n\n+/).forEach(p => para(p, { after: 12 }));
  need(96);
  y += 26;
  rule(doc, INK, 0.6);
  doc.line(M, y, M + 190, y);
  y += 13;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.2); ink(doc, INK);
  doc.text(pdfSafe(signerName || 'Authorised Signatory'), M, y); y += 12;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.4); ink(doc, MUTED);
  doc.text(pdfSafe(signerTitle), M, y);

  // Acceptance block on the right
  const ax = PW - M - 200;
  const ay = y - 37;
  rule(doc, LINE, 0.6);
  doc.rect(ax, ay - 12, 200, 54);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.6); ink(doc, MUTED);
  doc.text('ACCEPTED BY', ax + 10, ay);
  rule(doc, LINE, 0.5);
  doc.line(ax + 10, ay + 26, ax + 190, ay + 26);
  doc.setFontSize(7); ink(doc, MUTED);
  doc.text('Signature & date', ax + 10, ay + 36);

  footer();
  return doc;
}

const fileSafe = s => String(s || 'STAFF').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export function offerPdfFileName(form = {}) {
  return `OFFER-LETTER-${fileSafe(form.staffName)}-${fileSafe(form.refNo || prettyDate(form.date))}.pdf`;
}

export function saveOfferLetterPdf(form, opts = {}) {
  const doc = buildOfferLetterPdf(form, opts);
  doc.save(offerPdfFileName(form));
  return doc;
}

/** Fetch a public logo into a data URL for jsPDF (fails softly). */
export async function loadLogoDataUrl(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return '';
    const blob = await res.blob();
    return await new Promise(resolve => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ''));
      fr.onerror = () => resolve('');
      fr.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}
