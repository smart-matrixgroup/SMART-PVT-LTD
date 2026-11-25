// ─────────────────────────────────────────────────────────────────
//  SMART PVT LTD — Staff Work Report PDF (A4 portrait, print-ready)
//
//  Direct JS port of report_template.py (ReportLab → jsPDF).
//  Layout: header, 5 summary cards, one navy-bar + table block per
//  staff member, open-tasks section, branded footer with correct page
//  counter.  Title / period line changes for daily vs range reports.
//
//  Pure module — no Firebase imports, safe for QA tests in node.
// ─────────────────────────────────────────────────────────────────
import { jsPDF } from 'jspdf';
import { pdfSafe, pdfStamp } from './reportPdf.js';

// ── Colours ──────────────────────────────────────────────────────
const C = {
  navy:    [31,  58,  95],
  teal:    [15, 118, 110],
  grey:    [107, 114, 128],
  light:   [243, 245, 248],
  line:    [217, 222, 229],
  green:   [21,  128,  61],
  amber:   [180,  83,   9],
  amberBg: [254, 243, 199],
  ink:     [17,  24,  39],
  white:   [255, 255, 255],
};

const fill  = (doc, c, x, y, w, h) => { doc.setFillColor(...c); doc.rect(x, y, w, h, 'F'); };
const ink   = (doc, c) => doc.setTextColor(...c);
const ln    = (doc, c, w = 0.5) => { doc.setDrawColor(...c); doc.setLineWidth(w); };

/** Convert "HH:MM - HH:MM" into decimal hours, NaN-safe. */
const slotHours = (slot = '') => {
  const m = String(slot).match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
  if (!m) return 0;
  const s = Number(m[1]) * 60 + Number(m[2]);
  let  e = Number(m[3]) * 60 + Number(m[4]);
  if (e < s) e += 12 * 60;          // simple AM/PM correction for bad data
  return Math.max(0, (e - s) / 60);
};

/** Total hours for one update doc. */
const totalHrsOf = u => {
  const raw = Number(String(u.totalWorkHours ?? u.totalHours ?? '').replace(/[^\d.]/g, ''));
  if (Number.isFinite(raw) && raw > 0) return raw;
  const tasks = Array.isArray(u.tasks) ? u.tasks : [];
  return tasks.reduce((s, t) => s + slotHours(t.start && t.end ? `${t.start} - ${t.end}` : t.slot || ''), 0);
};

/** Normalize a Firestore dailyUpdate doc into a shape the builder can use. */
const normDoc = u => ({
  date:   String(u.date || ''),
  inTime: String(u.arrival || u.startTime || u.in || '—'),
  out:    String(u.departure || u.endTime || u.out || '—'),
  hours:  totalHrsOf(u),
  status: (u.status === 'Pending') ? 'Pending' : 'Completed',
  tasks: (Array.isArray(u.tasks) ? u.tasks : []).filter(t => String(t?.description || '').trim()),
});

/** Group update docs by canonical staff, return sorted blocks. */
const groupByStaff = (updates, staffRecords = []) => {
  const byId = {};
  updates.forEach(u => {
    const uid = u.authUid || u.staffUid || u.staffId || u.name || '';
    if (!byId[uid]) {
      const sr = staffRecords.find(s => s.id === uid || s.authUid === uid ||
        s.name === (u.name || u.staffName) || s.id === (u.staffId || ''));
      byId[uid] = { name: sr?.name || u.name || u.staffName || uid, role: sr?.role || sr?.position || u.position || '', days: [] };
    }
    byId[uid].days.push(normDoc(u));
  });
  return Object.values(byId).map(g => ({
    ...g,
    days: g.days.sort((a, b) => a.date.localeCompare(b.date)),
  })).sort((a, b) => a.name.localeCompare(b.name));
};

/** Friendly date: "2026-11-24" → "24 Nov" / "24 Nov 2026". */
const fmtDay    = (iso, withYear = false) => {
  if (!iso) return '—';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const [y, m, d] = iso.split('-');
  const base = `${Number(d)} ${months[Number(m) - 1]}`;
  return withYear ? `${base} ${y}` : base;
};
const dayName   = iso => { if (!iso) return ''; const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']; const d = new Date(iso); return days[d.getDay()]; };

// ── Main builder ─────────────────────────────────────────────────
export function buildWorkReportPdfA4(updates, {
  staffRecords = [],
  kind         = 'STAFF WORK REPORT',   // 'DAILY WORK REPORT' | 'STAFF WORK REPORT'
  period       = '',
  generatedBy  = '',
} = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const PW = doc.internal.pageSize.getWidth();   // 595.28
  const PH = doc.internal.pageSize.getHeight();  // 841.89
  const M  = 39.69;    // 14 mm
  const UW = PW - M * 2;

  const groups    = groupByStaff(updates, staffRecords);
  const allDays   = groups.flatMap(g => g.days);
  const totHours  = allDays.reduce((s, d) => s + d.hours, 0);
  const totTasks  = allDays.reduce((s, d) => s + d.tasks.length, 0);
  const openItems = groups.flatMap(g => g.days.flatMap(d =>
    d.tasks.filter(t => t.status === 'In Progress' || t.inProgress).map(t => ({ staff: g.name, date: d.date, task: t }))
  ));

  // ── Page numbering state ──────────────────────────────────────
  // jsPDF can't rewrite pages, so we draw footer on every page at close.
  let currentY = 0;
  const BOTTOM = PH - 50;

  const drawFooters = () => {
    const total = doc.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      ln(doc, C.line, 0.5); doc.line(M, PH - 32, PW - M, PH - 32);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); ink(doc, C.grey);
      doc.text('SMART PVT LTD  |  Trincomalee  |  ERP report', M, PH - 20);
      doc.text(`Page ${p} of ${total}`, PW - M, PH - 20, { align: 'right' });
      // slim running header on page 2+
      if (p > 1) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); ink(doc, C.navy);
        doc.text('SMART PVT LTD', M, 11);
        doc.setFont('helvetica', 'normal'); ink(doc, C.grey);
        doc.text(`${kind}  |  ${period}`, PW - M, 11, { align: 'right' });
        ln(doc, C.line, 0.5); doc.line(M, 14, PW - M, 14);
      }
    }
    doc.setPage(doc.getNumberOfPages());
  };

  // ── Header (page 1) ───────────────────────────────────────────
  const drawHeader = () => {
    // Left: brand + contact
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); ink(doc, C.navy);
    doc.text('SMART PVT LTD', M, 26);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); ink(doc, C.grey);
    doc.text('smartfindme@gmail.com  |  +94 76 202 45 45', M, 38);
    // Right: title + period + stamp
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); ink(doc, C.teal);
    doc.text(pdfSafe(kind), PW - M, 24, { align: 'right' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); ink(doc, C.ink);
    doc.text(pdfSafe(period), PW - M, 36, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); ink(doc, C.grey);
    doc.text(`Generated ${pdfStamp()} by ${pdfSafe(generatedBy)}`, PW - M, 46, { align: 'right' });
    // Navy rule
    ln(doc, C.navy, 1.4); doc.line(M, 52, PW - M, 52);
    currentY = 60;
  };

  // ── Summary cards (5) — page 1 only ──────────────────────────
  const drawCards = () => {
    const cards = [
      { label: 'Staff',        value: String(groups.length) },
      { label: 'Days reported',value: String(allDays.length) },
      { label: 'Total hours',  value: `${(Math.round(totHours * 10) / 10).toFixed(1)}` },
      { label: 'Tasks logged', value: String(totTasks) },
      { label: 'Open tasks',   value: String(openItems.length) },
    ];
    const cw = (UW - 4 * 4) / 5;
    cards.forEach((c, i) => {
      const x = M + i * (cw + 4);
      fill(doc, C.light, x, currentY, cw, 36);
      ln(doc, C.line, 0.5); doc.rect(x, currentY, cw, 36);
      if (i < 4) { ln(doc, C.line, 0.5); doc.line(x + cw, currentY, x + cw, currentY + 36); }
      const valColor = i === 4 && openItems.length > 0 ? C.amber : C.navy;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(16); ink(doc, valColor);
      doc.text(c.value, x + cw / 2, currentY + 20, { align: 'center' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); ink(doc, C.grey);
      doc.text(c.label, x + cw / 2, currentY + 30, { align: 'center' });
    });
    currentY += 46;
  };

  // ── Table column widths (pt, sum = UW) ───────────────────────
  const COL_W = [
    56.69,    // DATE (20 mm)
    56.69,    // IN / OUT (20 mm)
    39.69,    // HRS (14 mm)
    UW - 56.69*2 - 39.69 - 59.53, // WORK DONE
    59.53,    // STATUS (21 mm)
  ];
  const COL_ALIGN = ['center', 'center', 'center', 'left', 'center'];
  const COL_LABEL = ['DATE', 'IN / OUT', 'HRS', 'WORK DONE', 'STATUS'];
  const TH = 20;    // table header row height

  const drawTableHeader = () => {
    fill(doc, C.light, M, currentY, UW, TH);
    ln(doc, C.navy, 0.8); doc.line(M, currentY + TH, M + UW, currentY + TH);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); ink(doc, C.navy);
    let x = M;
    COL_W.forEach((w, i) => {
      const tx = COL_ALIGN[i] === 'center' ? x + w / 2 : x + 6;
      doc.text(COL_LABEL[i], tx, currentY + 13, { align: COL_ALIGN[i] === 'center' ? 'center' : 'left' });
      x += w;
    });
    currentY += TH;
  };

  // ── Draw one data row ─────────────────────────────────────────
  const drawRow = (cells, isPending = false) => {
    const workLines = doc.splitTextToSize(pdfSafe(cells[3]), COL_W[3] - 10);
    const h = Math.max(18, workLines.length * 10 + 7);

    if (currentY + h > BOTTOM) {
      drawFooters();
      doc.addPage();
      currentY = 20;
      drawTableHeader();
    }

    fill(doc, isPending ? C.amberBg : C.white, M, currentY, UW, h);
    ln(doc, C.line, 0.4); doc.line(M, currentY + h, M + UW, currentY + h);

    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); ink(doc, C.ink);
    let x = M;
    cells.forEach((cell, i) => {
      if (i === 3) {
        // WORK DONE — rich text with teal slot prefix
        workLines.forEach((wl, li) => {
          doc.text(wl, x + 6, currentY + 12 + li * 10);
        });
      } else if (i === 4) {
        // STATUS — coloured
        const statColor = cell === 'Completed' ? C.green : C.amber;
        doc.setFont('helvetica', 'bold'); ink(doc, statColor);
        doc.text(pdfSafe(cell), x + COL_W[i] / 2, currentY + 12, { align: 'center' });
        doc.setFont('helvetica', 'normal'); ink(doc, C.ink);
      } else {
        const tx = COL_ALIGN[i] === 'center' ? x + COL_W[i] / 2 : x + 6;
        doc.text(pdfSafe(cell), tx, currentY + 12, { align: COL_ALIGN[i] === 'center' ? 'center' : 'left' });
      }
      x += COL_W[i];
    });
    currentY += h;
  };

  // ── Staff block ───────────────────────────────────────────────
  const drawStaffBlock = (g, idx) => {
    const days = g.days.length;
    const hrs  = g.days.reduce((s, d) => s + d.hours, 0);
    const tasks = g.days.reduce((s, d) => s + d.tasks.length, 0);

    if (currentY + 60 > BOTTOM) {
      drawFooters(); doc.addPage(); currentY = 20;
    }

    // Navy bar
    fill(doc, C.navy, M, currentY, UW, 28);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); ink(doc, C.white);
    doc.text(`${String(idx).padStart(2, '0')}  ${pdfSafe(g.name)}`, M + 8, currentY + 13);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); ink(doc, [203, 213, 225]);
    doc.text(pdfSafe(g.role), M + 8, currentY + 22);
    // Right stats
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); ink(doc, C.white);
    doc.text(
      `${days} day${days !== 1 ? 's' : ''}  |  ${(Math.round(hrs * 10) / 10).toFixed(1)} hrs  |  ${tasks} task${tasks !== 1 ? 's' : ''}`,
      PW - M - 8, currentY + 17, { align: 'right' }
    );
    currentY += 28;

    drawTableHeader();

    // Rows — one per DAY (all tasks merged into WORK DONE cell)
    g.days.forEach(d => {
      const workCell = d.tasks.map(t => {
        const slot = (t.start && t.end) ? `${t.start}-${t.end}  ` : (t.slot ? `${t.slot}  ` : '');
        const ip   = (t.status === 'In Progress' || t.inProgress) ? ' [IN PROGRESS]' : '';
        return `${slot}${String(t.description || '').trim()}${ip}`;
      }).join('\n') || '—';

      const inOut = `${d.inTime} / ${d.out}`;
      const hrsStr = d.hours > 0 ? `${(Math.round(d.hours * 10) / 10).toFixed(1)}` : '—';
      const dateLine = `${fmtDay(d.date)}\n${dayName(d.date)}`;

      drawRow([dateLine, inOut, hrsStr, workCell, d.status], d.status !== 'Completed');
    });

    currentY += 10;
  };

  // ── Open tasks section ────────────────────────────────────────
  const drawOpenTasks = () => {
    if (currentY + 60 > BOTTOM) { drawFooters(); doc.addPage(); currentY = 20; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); ink(doc, C.navy);
    doc.text('Open tasks needing follow-up', M, currentY + 10);
    currentY += 18;

    if (!openItems.length) {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); ink(doc, C.grey);
      doc.text('No open tasks. Everything reported is completed.', M, currentY + 10);
      currentY += 20;
      return;
    }

    // Mini table: STAFF | DATE | TASK
    const ow = [UW * 0.22, UW * 0.14, UW * 0.64];
    ['STAFF', 'DATE', 'TASK'].forEach((lbl, i) => {
      const x = M + ow.slice(0, i).reduce((a, b) => a + b, 0);
      fill(doc, C.amberBg, x, currentY, ow[i], 18);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); ink(doc, C.amber);
      doc.text(lbl, x + 6, currentY + 12);
    });
    ln(doc, C.line, 0.5); doc.line(M, currentY + 18, M + UW, currentY + 18);
    currentY += 18;

    openItems.forEach(item => {
      const taskLines = doc.splitTextToSize(pdfSafe(String(item.task?.description || '')), ow[2] - 10);
      const h = Math.max(16, taskLines.length * 10 + 6);
      if (currentY + h > BOTTOM) { drawFooters(); doc.addPage(); currentY = 20; }
      fill(doc, C.amberBg, M, currentY, UW, h);
      ln(doc, C.line, 0.4); doc.line(M, currentY + h, M + UW, currentY + h);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); ink(doc, C.ink);
      doc.text(pdfSafe(item.staff), M + 6, currentY + 11);
      doc.text(fmtDay(item.date, true), M + ow[0] + 6, currentY + 11);
      taskLines.forEach((tl, li) => doc.text(tl, M + ow[0] + ow[1] + 6, currentY + 11 + li * 10));
      currentY += h;
    });
  };

  // ── Assemble ──────────────────────────────────────────────────
  drawHeader();
  drawCards();

  groups.forEach((g, i) => drawStaffBlock(g, i + 1));
  drawOpenTasks();

  currentY += 8;
  doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); ink(doc, C.grey);
  doc.text('Each block is one staff member, oldest day first. Hours = recorded work duration for that day.', M, currentY);

  drawFooters();
  return doc;
}

/** Build + download A4 PDF. */
export function saveWorkReportPdfA4(updates, opts = {}) {
  const doc = buildWorkReportPdfA4(updates, opts);
  const name = opts.fileName || `STAFF-WORK-REPORT-A4-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(name);
  return doc;
}
