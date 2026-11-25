// ─────────────────────────────────────────────────────────────────
//  Non-Disclosure Agreement → real A4 PDF.
//
//  Same paper as the offer letter: white sheet, letterhead, reference
//  and date, two-party recitals, numbered clauses and TWO signature
//  blocks (Company and Employee). jsPDF's built-in fonts are WinAnsi,
//  so every string is passed through pdfSafe() first.
// ─────────────────────────────────────────────────────────────────
import { jsPDF } from 'jspdf';
import { pdfSafe } from '../utils/reportPdf.js';
import { company } from '../../config/company.js';
import {
  prettyDate, resolvedPurpose, resolvedOpening, resolvedClosing, resolvedClauses,
} from './ndaModel.js';

const INK = [26, 32, 44];
const MUTED = [105, 115, 130];
const BLUE = [0, 102, 255];
const CYAN = [0, 178, 214];
const LINE = [208, 216, 230];
const WASH = [244, 248, 255];

const M = 52;
const BOTTOM = 64;

const ink = (doc, c) => doc.setTextColor(c[0], c[1], c[2]);
const rule = (doc, c, w = 0.7) => {
  doc.setDrawColor(c[0], c[1], c[2]);
  doc.setLineWidth(w);
};

const contactLines = () => [
  company.contact?.address,
  [company.contact?.phoneDisplay || company.contact?.phone, company.contact?.email]
    .filter(Boolean).join('  ·  '),
  company.website,
].filter(Boolean);

/**
 * Build the agreement without saving it — tests and the preview use this.
 * `logoDataUrl` is optional; without it the header is text only.
 */
export function buildNdaPdf(form = {}, { logoDataUrl = '', signerName = '' } = {}) {
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
    doc.text(pdfSafe(`${company.name} · Non-Disclosure Agreement${refNo ? ` · ${refNo}` : ''}`), M, PH - 34);
    doc.text(`Page ${page}`, PW - M, PH - 34, { align: 'right' });
  };

  const newPage = () => {
    footer();
    doc.addPage();
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); ink(doc, MUTED);
    doc.text(pdfSafe(`${company.name} · Non-Disclosure Agreement`), M, 40);
    if (refNo) doc.text(pdfSafe(`Ref: ${refNo}`), PW - M, 40, { align: 'right' });
    rule(doc, LINE, 0.5);
    doc.line(M, 48, PW - M, 48);
    y = 72;
  };

  const need = h => { if (y + h > PH - BOTTOM) newPage(); };

  const para = (text, {
    size = 10, font = 'normal', color = INK, lh = 14.5, indent = 0, after = 6,
  } = {}) => {
    doc.setFont('helvetica', font); doc.setFontSize(size); ink(doc, color);
    doc.splitTextToSize(pdfSafe(text), W - indent).forEach(line => {
      need(lh);
      doc.text(line, M + indent, y);
      y += lh;
    });
    y += after;
  };

  // ── Letterhead ───────────────────────────────────────────────────
  if (logoDataUrl) {
    try {
      const lw = 148;
      doc.addImage(logoDataUrl, 'PNG', M, 34, lw, lw * (809 / 1942));
    } catch { /* a broken logo must never block the document */ }
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

  // ── Title ────────────────────────────────────────────────────────
  y += 30;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); ink(doc, INK);
  const title = 'NON-DISCLOSURE AGREEMENT';
  doc.text(title, PW / 2, y, { align: 'center' });
  const tw = doc.getTextWidth(title);
  rule(doc, BLUE, 1.4);
  doc.line(PW / 2 - tw / 2, y + 5, PW / 2 + tw / 2, y + 5);
  y += 26;

  // ── Parties ──────────────────────────────────────────────────────
  const partyH = 84;
  need(partyH);
  doc.setFillColor(...WASH);
  doc.rect(M, y, W, partyH - 8, 'F');
  rule(doc, BLUE, 2);
  doc.line(M, y, M, y + partyH - 8);
  let py = y + 16;
  const partyLine = (label, value, bold = false) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.4); ink(doc, MUTED);
    doc.text(label, M + 12, py);
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); ink(doc, INK);
    doc.text(pdfSafe(String(value || '—')), M + 96, py, { maxWidth: W - 110 });
    py += 13;
  };
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.4); ink(doc, BLUE);
  doc.text('BETWEEN', M + 12, py - 2); py += 14;
  partyLine('Company', company.fullName || company.name);
  partyLine('Employee', form.staffName);
  partyLine('Position', form.position);
  partyLine('Staff ID', form.staffCode);
  partyLine('Effective', `${prettyDate(form.effectiveDate)}${Number(form.termYears) ? `  ·  confidential for ${Number(form.termYears)} year(s) after leaving` : ''}`);
  y += partyH + 8;

  // ── Recitals ─────────────────────────────────────────────────────
  resolvedOpening(form).split(/\n\n+/).forEach(p => para(p, { after: 8 }));
  para(resolvedPurpose(form), { after: 10 });

  // ── Clauses ──────────────────────────────────────────────────────
  need(30);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.6); ink(doc, BLUE);
  doc.text('NOW THEREFORE the parties agree as follows:', M, y); y += 17;

  resolvedClauses(form).forEach((c, i) => {
    need(24);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.4); ink(doc, INK);
    const head = `${i + 1}. ${c.title || 'Clause'}`;
    doc.splitTextToSize(pdfSafe(head), W).forEach(l => { need(13); doc.text(l, M, y); y += 13; });
    if (c.text) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.2); ink(doc, [52, 60, 74]);
      doc.splitTextToSize(pdfSafe(c.text), W - 14).forEach(line => {
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

  // ── Closing + both signatures ────────────────────────────────────
  resolvedClosing(form).split(/\n\n+/).forEach(p => para(p, { after: 12 }));
  need(120);
  y += 24;

  const colW = (W - 40) / 2;
  const block = (x, heading, name, note) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.8); ink(doc, MUTED);
    doc.text(heading, x, y);
    rule(doc, INK, 0.6);
    doc.line(x, y + 34, x + colW, y + 34);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.2); ink(doc, INK);
    doc.text(pdfSafe(name || '—'), x, y + 46);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.2); ink(doc, MUTED);
    doc.text(pdfSafe(note || ''), x, y + 57);
  };
  block(M, 'FOR THE COMPANY', signerName || form.companySignatory || 'Authorised Signatory',
    form.signerTitle || 'Managing Director');
  block(M + colW + 40, 'EMPLOYEE', form.staffName, `${prettyDate(form.date)}`);

  footer();
  return doc;
}

const fileSafe = s => String(s || 'STAFF').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export function ndaPdfFileName(form = {}) {
  return `NDA-${fileSafe(form.staffName)}-${fileSafe(form.refNo || prettyDate(form.date))}.pdf`;
}

export function saveNdaPdf(form, opts = {}) {
  const doc = buildNdaPdf(form, opts);
  doc.save(ndaPdfFileName(form));
  return doc;
}
