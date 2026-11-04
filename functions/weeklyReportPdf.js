// ─────────────────────────────────────────────────────────────────
//  WEEKLY WORK REPORT → PDF bytes (Node / Cloud Functions build)
//
//  Same document as the browser-side src/erp/utils/dailyReportPdf.js, but
//  this one runs on the server: it returns a Buffer instead of triggering a
//  download, because the scheduler has no browser to save into. Layout is
//  duplicated on purpose — the client bundle is ESM + jsPDF browser build,
//  the function runtime is CommonJS + the jsPDF node build, and sharing one
//  file across both would need a bundler step this project does not have.
//
//  Keep the two in step when the printed sheet changes: header band, the six
//  columns NO/START/END/HOURS/WORK/STATUS (the week view swaps NO for DATE),
//  zebra rows, summary block and the generated-by footer.
//
//  jsPDF's standard fonts are WinAnsi only, so pdfSafe() maps the symbols we
//  use (₹ – — ’ • →) to safe text before drawing.
// ─────────────────────────────────────────────────────────────────

const NAVY = [16, 26, 51];
const BLUE = [0, 102, 255];
const HEAD = [236, 241, 249];
const ZEBRA = [247, 249, 253];
const INK = [32, 36, 43];
const MUTED = [110, 118, 131];
const LINE = [206, 214, 228];

const GREEKS = {
  '₹': 'LKR ', '€': 'EUR ', '£': 'GBP ', '→': '->', '•': '-', '–': '-',
  '—': '-', '’': "'", '‘': "'", '“': '"', '”': '"', '×': 'x', '✓': 'v',
  '…': '...', '⬚': '[ ]', '°': 'deg', '\u00a0': ' ',
};

function pdfSafe(value) {
  let out = String(value == null ? '' : value);
  for (const k of Object.keys(GREEKS)) out = out.split(k).join(GREEKS[k]);
  // Drop anything still outside WinAnsi rather than printing a garbage glyph.
  return out.replace(/[^\x09\x0a\x0d\x20-\x7e\xa0-\xff]/g, '');
}

const dash = v => {
  const s = pdfSafe(v == null ? '' : v).trim();
  return s || '-';
};

const hoursNumber = v => {
  const n = Number(String(v == null ? '' : v).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const fileKey = v => pdfSafe(v).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'UNDATED';

// Same rules as the portal: a task row needs a description, and the older
// imported sheets that only carry `items` still have to print.
function tasksOf(report) {
  const r = report || {};
  if (Array.isArray(r.tasks) && r.tasks.some(t => String((t && t.description) || '').trim())) return r.tasks;
  const items = Array.isArray(r.items) ? r.items : [];
  if (!items.length) return Array.isArray(r.tasks) ? r.tasks : [];
  return items.map((description, i) => ({
    no: i + 1,
    start: r.startTime || r.arrival || '',
    end: r.endTime || r.departure || '',
    hours: r.totalHours || r.totalWorkHours || '',
    description: String(description || ''),
    status: r.status || 'Completed',
  }));
}

/** One row per task across the whole week, oldest day first. */
function weekRows(reports) {
  const out = [];
  (Array.isArray(reports) ? reports : [])
    .slice()
    .sort((a, b) => String((a && a.date) || '').localeCompare(String((b && b.date) || '')))
    .forEach(r => {
      tasksOf(r)
        .filter(t => t && String(t.description || '').trim())
        .forEach(t => {
          out.push([
            dash(r.date),
            dash(t.start),
            dash(t.end),
            dash(t.hours),
            dash(t.description),
            dash(t.status || 'Completed'),
          ]);
        });
    });
  return out;
}

const COLUMNS = [
  { label: 'DATE', width: 12, align: 'center' },
  { label: 'START', width: 9, align: 'center' },
  { label: 'END', width: 9, align: 'center' },
  { label: 'HOURS', width: 10, align: 'center' },
  { label: 'WORK / DESCRIPTION', width: 50, align: 'left', wrap: true },
  { label: 'STATUS', width: 10, align: 'center' },
];

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 42;
const TABLE_W = PAGE_W - MARGIN * 2;

function cellLines(doc, text, width) {
  const usable = Math.max(14, width - 8);
  const fits = s => !s || doc.getTextWidth(s) <= usable;
  const words = pdfSafe(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [''];

  // Greedy word wrap first; a word that does not fit on its own (a long URL,
  // a file path) is then split character by character. Both passes matter —
  // without the second one a single long token ran past the cell edge.
  const wrapped = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (fits(candidate)) { line = candidate; continue; }
    if (line) { wrapped.push(line); line = ''; }
    if (fits(word)) { line = word; continue; }
    let chunk = '';
    for (const ch of word) {
      if (chunk && !fits(chunk + ch)) { wrapped.push(chunk); chunk = ch; }
      else chunk += ch;
    }
    line = chunk;
  }
  if (line) wrapped.push(line);

  if (wrapped.length <= 6) return wrapped;
  const shown = wrapped.slice(0, 6);
  shown[5] = `${shown[5]}...`;
  return shown;
}

/**
 * Draw one staff week.
 * Returns { fileName, buffer, pages, rows, days } — buffer is the .pdf body.
 */
exports.buildWeeklyReportPdf = function buildWeeklyReportPdf({
  Doc,
  staffName = '',
  staffId = '',
  periodLabel = '',
  reports = [],
  sentTo = '',
  generatedBy = '',
  scheduleNote = '',
} = {}) {
  if (!Doc) throw new Error('buildWeeklyReportPdf needs the jsPDF constructor passed in');
  const doc = new Doc({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const rows = weekRows(reports);
  const days = [...new Set((Array.isArray(reports) ? reports : []).map(r => r && r.date).filter(Boolean))].sort();
  const totalHours = (Array.isArray(reports) ? reports : [])
    .reduce((a, r) => a + hoursNumber(r && r.totalWorkHours), 0);
  const done = rows.filter(r => r[5] === 'Completed').length;

  const widths = COLUMNS.map(c => (c.width / 100) * TABLE_W);
  let y = 0;

  const headerBand = () => {
    doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.rect(0, 34, PAGE_W, 62, 'F');
    doc.setFillColor(BLUE[0], BLUE[1], BLUE[2]);
    doc.rect(0, 96, PAGE_W, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('SMART PVT LTD  |  IT TEAM WEEKLY WORK REPORT', MARGIN, 58);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(pdfSafe(`WEEKLY WORK REPORT - ${dash(periodLabel)}`), MARGIN, 78);
    y = 118;
  };

  const tableHead = () => {
    doc.setFillColor(HEAD[0], HEAD[1], HEAD[2]);
    doc.rect(MARGIN, y, TABLE_W, 20, 'F');
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    let x = MARGIN;
    COLUMNS.forEach((c, i) => {
      const label = pdfSafe(c.label);
      if (c.align === 'center') doc.text(label, x + widths[i] / 2, y + 13, { align: 'center' });
      else doc.text(label, x + 4, y + 13);
      x += widths[i];
    });
    y += 20;
    doc.setFont('helvetica', 'normal');
  };

  headerBand();

  // Identity block (who / which week / how many days)
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(pdfSafe(`${dash(staffName)}${staffId ? ` - ${dash(staffId)}` : ''}`), MARGIN, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  [
    `PERIOD: ${dash(periodLabel)}      DAYS LOGGED: ${String(days.length)}${days.length ? ` (${dash(days[0])}${days.length > 1 ? ` to ${dash(days[days.length - 1])}` : ''})` : ''}`,
    sentTo ? `SENT TO: ${pdfSafe(sentTo)}` : '',
    scheduleNote ? `${pdfSafe(scheduleNote)}` : '',
  ].filter(Boolean).forEach(line => { doc.text(line, MARGIN, y); y += 13; });
  y += 6;

  tableHead();

  if (!rows.length) {
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.setFontSize(9.5);
    doc.text('No task was filed for this week - the staff member logged nothing in these seven days.', MARGIN, y + 14);
    y += 34;
  }

  rows.forEach((row, idx) => {
    // 8.8pt is the row font — set it before measuring, or the wrap is wrong.
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.8);
    const lineSets = row.map((cell, i) => (COLUMNS[i].wrap ? cellLines(doc, cell, widths[i]) : [pdfSafe(cell)]));
    const height = Math.max(18, Math.max(...lineSets.map(l => l.length)) * 11 + 7);
    if (y + height > PAGE_H - 96) {
      doc.addPage();
      headerBand();
      tableHead();
    }
    if (idx % 2 === 1) {
      doc.setFillColor(ZEBRA[0], ZEBRA[1], ZEBRA[2]);
      doc.rect(MARGIN, y, TABLE_W, height, 'F');
    }
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.line(MARGIN, y + height, MARGIN + TABLE_W, y + height);

    let x = MARGIN;
    doc.setFontSize(8.8);
    lineSets.forEach((lines, i) => {
      doc.setTextColor(INK[0], INK[1], INK[2]);
      if (i === 5) {
        // STATUS gets a colour cue instead of a badge image.
        const s = row[5].toLowerCase();
        if (s === 'completed' || s === 'done') doc.setTextColor(20, 150, 95);
        else if (s === 'pending' || s === 'in progress') doc.setTextColor(200, 135, 10);
        else if (s === 'blocked') doc.setTextColor(200, 60, 70);
        doc.setFont('helvetica', 'bold');
      } else doc.setFont('helvetica', 'normal');
      const start = y + 12;
      lines.forEach((ln, li) => {
        if (COLUMNS[i].align === 'center') doc.text(ln, x + widths[i] / 2, start + li * 11, { align: 'center' });
        else doc.text(ln, x + 4, start + li * 11);
      });
      x += widths[i];
    });
    y += height;
  });

  // Summary block
  const summary = [
    ['Days logged', String(days.length)],
    ['Total hours', `${(Math.round(totalHours * 10) / 10).toFixed(1)} hrs`],
    ['Tasks completed', `${done}/${rows.length}`],
  ];
  if (y + 74 > PAGE_H - 96) { doc.addPage(); headerBand(); }
  y += 10;
  doc.setFillColor(HEAD[0], HEAD[1], HEAD[2]);
  doc.rect(MARGIN, y, TABLE_W, 52, 'F');
  doc.setDrawColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.line(MARGIN, y, MARGIN, y + 52);
  doc.line(MARGIN, y, MARGIN + 3, y);
  doc.line(MARGIN, y + 52, MARGIN + 3, y + 52);
  let sx = MARGIN + 16;
  summary.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(pdfSafe(String(label).toUpperCase()), sx, y + 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(pdfSafe(value), sx, y + 38);
    sx += TABLE_W / 3;
  });
  y += 66;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(
    'One row per task, in date order. A day with no sheet does not appear - ask the staff member to file the missing day.',
    MARGIN, y, { maxWidth: TABLE_W },
  );
  y += 14;
  if (generatedBy) { doc.text(pdfSafe(`Generated by ${generatedBy}`), MARGIN, y); y += 12; }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(pdfSafe(`Page ${p} of ${pages}`), PAGE_W - MARGIN, PAGE_H - 26, { align: 'right' });
    doc.text('SMART PVT LTD - Technology That Makes Business Smarter', MARGIN, PAGE_H - 26);
  }

  return {
    fileName: `WEEKLY-WORK-REPORT-${fileKey(staffName)}-${fileKey(periodLabel)}.pdf`,
    buffer: Buffer.from(doc.output('arraybuffer')),
    pages,
    rows: rows.length,
    days: days.length,
  };
};

exports.weekRows = weekRows;
exports._pdfSafe = pdfSafe;
