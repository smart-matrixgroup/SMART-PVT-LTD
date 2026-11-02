// ── Report PDFs (attendance, payroll, client statements) ────────────────
// jsPDF is only used for the page primitives; the layout (branded header
// band, wrapping table cells, zebra rows, page numbers) lives here so every
// ERP report prints the same way. Everything is drawn in pt on A4.
import { jsPDF } from 'jspdf';

const NAVY = [16, 26, 51];
const BLUE = [0, 102, 255];
const HEAD = [236, 241, 249];
const ZEBRA = [247, 249, 253];
const INK = [32, 36, 43];
const MUTED = [110, 118, 131];
const LINE = [206, 214, 228];

// jsPDF's standard fonts are WinAnsi only — anything outside it would come
// out as a garbage glyph, so map the common ones to safe text first.
const GREEKS = { '₹': 'LKR ', '€': 'EUR ', '£': 'GBP ', '→': '->', '•': '-', '–': '-', '—': '-', '’': "'", '‘': "'", '“': '"', '”': '"', '×': 'x', '✓': 'v', '…': '...', '⬚': '[ ]', '°': 'deg' };
export const pdfSafe = v => String(v ?? '')
  .replace(/[\u20B9\u20AC\u00A3\u2192\u2022\u2013\u2014\u2019\u2018\u201C\u201D\u00D7\u2713\u2026\u00B0]/g, c => GREEKS[c] || '-')
  .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '');

const pad2 = n => String(n).padStart(2, '0');
export const pdfStamp = (d = new Date()) =>
  `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
export const pdfFileStamp = (d = new Date()) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** 'attendance report' + name → ATTENDANCE-REPORT-2026-11-02.pdf */
export const pdfFileName = (name, title) => pdfSafe(
  name || `${String(title || 'REPORT').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')}-${pdfFileStamp()}.pdf`
);

const fill = (doc, color, x, y, w, h) => {
  doc.setFillColor(color[0], color[1], color[2]);
  doc.rect(x, y, w, h, 'F');
};
const ink = (doc, color) => doc.setTextColor(color[0], color[1], color[2]);
const stroke = (doc, color, w = 0.6) => {
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(w);
};

/**
 * Build (and save) a branded table report.
 *
 * columns: [{ label, key?, width, align?, wrap? }]  — width is a share of the
 *          printable width, rows: array of equal-length arrays.
 * summary: [{ label, value }] shown as a band above the table.
 * sections: [{ heading, columns, rows, statusCol? }] — several tables on one
 *          document (used by the client report); it replaces columns/rows.
 */
export function buildTablePdf({
  title,
  subtitle = '',
  meta = [],
  columns = [],
  rows = [],
  sections = [],
  summary = [],
  footNote = '',
  orientation = 'portrait',
  statusCol = -1,
  generatedBy = '',
}) {
  const doc = new jsPDF({ orientation, unit: 'pt', format: 'a4' });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M = 34;
  const usable = PW - M * 2;

  // column widths are ratios of the printable width (a pt-looking width is
  // scaled the same way, so callers can just write readable numbers)
  const calcWidths = cols => {
    const raw = cols.map(c => Number(c.width) || 1);
    const sum = raw.reduce((a, b) => a + b, 0) || 1;
    return raw.map(w => (w / sum) * usable);
  };

  const STATUS_COLOR = {
    present: [22, 144, 87], completed: [22, 144, 87], paid: [22, 144, 87], accepted: [22, 144, 87],
    absent: [200, 40, 60], pending: [190, 120, 10], rework: [190, 120, 10], partial: [190, 120, 10],
    overdue: [200, 40, 60], unpaid: [200, 40, 60], 'on hold': [110, 118, 131], 'not started': [110, 118, 131],
  };

  let y = 0;
  const header = () => {
    fill(doc, NAVY, 0, 0, PW, 54);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); ink(doc, [255, 255, 255]);
    doc.text('SMART PVT LTD', M, 22);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
    doc.text(pdfSafe(title), M, 38);
    doc.setFontSize(8); ink(doc, [186, 200, 224]);
    doc.text(`Generated ${pdfStamp()}${generatedBy ? ` by ${generatedBy}` : ''}`, PW - M, 22, { align: 'right' });
    doc.text('smartfindme@gmail.com  ·  +94 76 202 45 45', PW - M, 38, { align: 'right' });
    y = 68;
    if (subtitle) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); ink(doc, MUTED);
      doc.text(pdfSafe(subtitle), M, y);
      y += 14;
    }
    meta.filter(Boolean).forEach(line => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); ink(doc, INK);
      doc.text(pdfSafe(line), M, y);
      y += 13;
    });
    if (summary.length) {
      const chipW = Math.min(150, (usable - 8 * (summary.length - 1)) / summary.length);
      summary.forEach((s, i) => {
        const x = M + i * (chipW + 8);
        fill(doc, HEAD, x, y, chipW, 34);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); ink(doc, BLUE);
        doc.text(pdfSafe(s.value), x + 9, y + 15);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); ink(doc, MUTED);
        doc.text(pdfSafe(s.label), x + 9, y + 26);
      });
      y += 46;
    }
  };

  const bottom = PH - 46;

  const newPage = () => {
    footer();
    doc.addPage();
    header();
  };

  // One table (cols/rows) — used for the single-table call and once per section.
  const renderTable = (cols, rs, sCol = -1) => {
    const widths = calcWidths(cols);
    const drawHead = () => {
      fill(doc, BLUE, M, y, usable, 22);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.2); ink(doc, [255, 255, 255]);
      let x = M;
      cols.forEach((c, i) => {
        const tx = c.align === 'right' ? x + widths[i] - 6 : c.align === 'center' ? x + widths[i] / 2 : x + 6;
        doc.text(pdfSafe(c.label), tx, y + 14, { align: c.align === 'right' ? 'right' : c.align === 'center' ? 'center' : 'left' });
        x += widths[i];
      });
      y += 22;
    };

    drawHead();
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.6);
    let zi = 0;
    (rs || []).forEach(r => {
      const cells = cols.map((c, i) => {
        const text = pdfSafe(r[i] ?? '');
        const maxW = widths[i] - 12;
        return c.wrap === false ? [text] : doc.splitTextToSize(text, maxW);
      });
      const ln = Math.max(1, ...cells.map(c => c.length));
      const h = Math.max(17, ln * 10.6 + 6);
      if (y + h > bottom) {
        stroke(doc, NAVY, 1); doc.line(M, y, M + usable, y);
        newPage();
        drawHead();
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.6);
        zi = 0;
      }
      fill(doc, zi % 2 ? ZEBRA : [255, 255, 255], M, y, usable, h);
      zi++;
      stroke(doc, LINE, 0.4);
      doc.line(M, y + h, M + usable, y + h);
      let x = M;
      cols.forEach((c, i) => {
        const st = i === sCol ? STATUS_COLOR[String(r[i] || '').toLowerCase()] : null;
        ink(doc, st || INK);
        if (i === sCol) doc.setFont('helvetica', 'bold');
        const tx = c.align === 'right' ? x + widths[i] - 6 : c.align === 'center' ? x + widths[i] / 2 : x + 6;
        doc.setFontSize(8.6);
        cells[i].forEach((l, li) => {
          doc.text(l, tx, y + 12 + li * 10.6, { align: c.align === 'right' ? 'right' : c.align === 'center' ? 'center' : 'left' });
        });
        doc.setFont('helvetica', 'normal');
        x += widths[i];
      });
      y += h;
    });

    stroke(doc, NAVY, 1);
    doc.line(M, y, M + usable, y);
  };

  header();
  if (sections.length) {
    sections.forEach(sec => {
      if (!sec.columns?.length) return;
      if (y + 60 > bottom) newPage();
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); ink(doc, NAVY);
      doc.text(pdfSafe(sec.heading || '').toUpperCase(), M, y + 2);
      y += 14;
      renderTable(sec.columns, sec.rows, sec.statusCol ?? -1);
      y += 16;
    });
  } else {
    renderTable(columns, rows, statusCol);
  }

  if (footNote) {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8); ink(doc, MUTED);
    doc.splitTextToSize(pdfSafe(footNote), usable).forEach(ln => {
      if (y + 14 > bottom) { footer(); doc.addPage(); header(); y = bottom - 40; }
      doc.text(ln, M, y + 14);
      y += 11;
    });
  }
  footer();

  function footer() {
    const total = doc.getNumberOfPages();
    const page = doc.getCurrentPageInfo().pageNumber;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.6); ink(doc, MUTED);
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      const h = doc.internal.pageSize.getHeight();
      stroke(doc, LINE, 0.4);
      doc.line(M, h - 32, PW - M, h - 32);
      doc.text('SMART PVT LTD  ·  Trincomalee  ·  ERP report', M, h - 20);
      doc.text(`Page ${p}${total > 1 ? ` of ${total}` : ''}`, PW - M, h - 20, { align: 'right' });
    }
    doc.setPage(page);
  }

  return doc;
}

/** Build then download: saveTablePdf({...}, 'ATTENDANCE-2026-11-02.pdf') */
export function saveTablePdf(opts, fileName) {
  const doc = buildTablePdf(opts);
  doc.save(pdfFileName(fileName || opts.fileName, opts.title));
  return doc;
}

/** A single slip (payslip / receipt) — header band, key-value blocks, table. */
export function buildSlipPdf({
  docTitle, docNo, heading = [], lines = [], blocks = [], table = null, note = '', fileName, signature = 'Authorised Signature',
}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M = 46;
  const usable = PW - M * 2;

  fill(doc, NAVY, 0, 0, PW, 86);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(17); ink(doc, [255, 255, 255]);
  doc.text('SMART PVT LTD', M, 34);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); ink(doc, [186, 200, 224]);
  doc.text('Software & Digital Solutions  ·  Trincomalee, Sri Lanka', M, 50);
  doc.text('+94 76 202 45 45  ·  smartfindme@gmail.com', M, 64);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); ink(doc, [255, 255, 255]);
  doc.text(pdfSafe(docTitle), PW - M, 34, { align: 'right' });
  doc.setFontSize(9); ink(doc, [186, 200, 224]);
  doc.text(pdfSafe(docNo || ''), PW - M, 50, { align: 'right' });
  doc.text(`Generated ${pdfStamp()}`, PW - M, 64, { align: 'right' });

  let y = 110;
  heading.forEach(h => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); ink(doc, BLUE);
    doc.text(pdfSafe(h), M, y);
    y += 15;
  });
  y += 4;

  blocks.forEach(b => {
    const cols = b.columns || 2;
    const cw = usable / cols;
    const rows = b.items || [];
    const height = rows.length * 15 + 24;
    if (y + height > PH - 90) { doc.addPage(); y = 60; }
    fill(doc, HEAD, M, y, usable, height);
    stroke(doc, LINE, 0.5); doc.rect(M, y, usable, height);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); ink(doc, MUTED);
    doc.text(pdfSafe(b.title || '').toUpperCase(), M + 10, y + 15);
    rows.forEach((it, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = M + 10 + col * cw;
      const ty = y + 32 + row * 15;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); ink(doc, MUTED);
      doc.text(pdfSafe(it.label), x, ty);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.2); ink(doc, INK);
      doc.text(pdfSafe(it.value), x + (it.labelWidth || 78), ty);
    });
    y += height + 16;
  });

  if (table && table.columns) {
    const widths = table.columns.map(c => (Number(c.width) || 1) / table.columns.reduce((a, c) => a + (Number(c.width) || 1), 0) * usable);
    fill(doc, BLUE, M, y, usable, 20);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.4); ink(doc, [255, 255, 255]);
    let x = M;
    table.columns.forEach((c, i) => {
      doc.text(pdfSafe(c.label), c.align === 'right' ? x + widths[i] - 6 : x + 6, y + 13, { align: c.align === 'right' ? 'right' : 'left' });
      x += widths[i];
    });
    y += 20;
    (table.rows || []).forEach((r, ri) => {
      const h = 18;
      fill(doc, ri % 2 ? ZEBRA : [255, 255, 255], M, y, usable, h);
      stroke(doc, LINE, 0.4); doc.line(M, y + h, M + usable, y + h);
      let xx = M;
      r.forEach((v, i) => {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.8); ink(doc, INK);
        doc.text(pdfSafe(v), (table.columns[i] || {}).align === 'right' ? xx + widths[i] - 6 : xx + 6, y + 12.5,
          { align: (table.columns[i] || {}).align === 'right' ? 'right' : 'left' });
        xx += widths[i];
      });
      y += h;
    });
    if (table.total) {
      fill(doc, HEAD, M, y, usable, 22);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.6); ink(doc, NAVY);
      doc.text(pdfSafe(table.total.label || 'TOTAL'), M + 8, y + 14.5);
      doc.text(pdfSafe(table.total.value), M + usable - 8, y + 14.5, { align: 'right' });
      y += 30;
    } else y += 16;
  }

  lines.forEach(l => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); ink(doc, INK);
    doc.splitTextToSize(pdfSafe(l), usable).forEach(ln => {
      if (y + 14 > PH - 90) { doc.addPage(); y = 60; }
      doc.text(ln, M, y + 12);
      y += 13;
    });
    y += 4;
  });

  if (note) {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8.2); ink(doc, MUTED);
    doc.splitTextToSize(pdfSafe(note), usable).forEach(ln => { doc.text(ln, M, y + 10); y += 11; });
  }

  stroke(doc, LINE, 0.6);
  doc.line(PW - M - 170, PH - 96, PW - M, PH - 96);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.2); ink(doc, MUTED);
  doc.text(pdfSafe(signature), PW - M, PH - 82, { align: 'right' });
  doc.setFontSize(8);
  doc.text('SMART PVT LTD  ·  this document was generated from the ERP', M, PH - 40);

  return doc;
}

/** Build a slip with {@link buildSlipPdf} and download it. */
export function saveSlipPdf(opts) {
  const doc = buildSlipPdf(opts);
  doc.save(pdfFileName(opts.fileName, opts.docTitle));
  return doc;
}
