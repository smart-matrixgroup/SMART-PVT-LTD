// ─────────────────────────────────────────────────────────────────
//  SMART PVT LTD — Staff Work Report PDF (MOBILE / phone-size)
//
//  JS port of mobile_template.py v2 (ReportLab → jsPDF).
//  Page: 100 × 215 mm (phone ratio), 6 mm margins.
//  Card layout per day, week groups, hours bar chart, PDF bookmarks.
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
  slate:   [203, 213, 225],
  pendBg:  [255, 251, 235],
};

const mm   = 2.8346;   // 1 mm in pt
const PW   = 100 * mm;
const PH   = 215 * mm;
const MG   = 6 * mm;
const W    = PW - MG * 2;

const fill = (doc, c, x, y, w, h) => { doc.setFillColor(...c); doc.rect(x, y, w, h, 'F'); };
const ink  = (doc, c) => doc.setTextColor(...c);
const ln   = (doc, c, w = 0.5) => { doc.setDrawColor(...c); doc.setLineWidth(w); };

// ── Helpers ──────────────────────────────────────────────────────
const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const fmtDay = iso => { if (!iso) return '—'; const [y,m,d] = iso.split('-'); return `${dayNames[new Date(iso).getDay()]}, ${Number(d)} ${months[Number(m)-1]} ${y}`; };
const fmtShort = iso => { if (!iso) return '—'; const [,m,d] = iso.split('-'); return `${Number(d)} ${months[Number(m)-1]}`; };

const slotHours = (slot = '') => {
  const m = String(slot).match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
  if (!m) return 0;
  const s = Number(m[1]) * 60 + Number(m[2]);
  let  e = Number(m[3]) * 60 + Number(m[4]);
  if (e < s) e += 12 * 60;
  return Math.max(0, (e - s) / 60);
};

const totalHrsOf = u => {
  const raw = Number(String(u.totalWorkHours ?? u.totalHours ?? '').replace(/[^\d.]/g, ''));
  if (Number.isFinite(raw) && raw > 0) return raw;
  const tasks = Array.isArray(u.tasks) ? u.tasks : [];
  return tasks.reduce((s, t) => s + slotHours(t.start && t.end ? `${t.start} - ${t.end}` : t.slot || ''), 0);
};

const normDoc = u => ({
  date:   String(u.date || ''),
  inTime: String(u.arrival || u.startTime || u.in || '—'),
  out:    String(u.departure || u.endTime || u.out || '—'),
  hours:  totalHrsOf(u),
  status: (u.status === 'Pending') ? 'Pending' : 'Completed',
  tasks: (Array.isArray(u.tasks) ? u.tasks : []).filter(t => String(t?.description || '').trim()),
});

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

/** ISO week start (Monday). */
const weekStart = iso => {
  const d = new Date(iso);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
};

/** Group days into ISO weeks. */
const groupWeeks = days => {
  const weeks = {};
  days.forEach(d => {
    const ws = weekStart(d.date);
    if (!weeks[ws]) weeks[ws] = [];
    weeks[ws].push(d);
  });
  return Object.entries(weeks).sort(([a],[b]) => a.localeCompare(b));
};

// ── Main builder ─────────────────────────────────────────────────
export function buildWorkReportPdfMobile(updates, {
  staffRecords = [],
  kind         = 'STAFF WORK REPORT',
  period       = '',
  generatedBy  = '',
} = {}) {
  const doc = new jsPDF({ unit: 'pt', format: [PW, PH] });
  const groups    = groupByStaff(updates, staffRecords);
  const allDays   = groups.flatMap(g => g.days);
  const totHours  = allDays.reduce((s, d) => s + d.hours, 0);
  const totTasks  = allDays.reduce((s, d) => s + d.tasks.length, 0);
  const openItems = groups.flatMap(g => g.days.flatMap(d =>
    d.tasks.filter(t => t.status === 'In Progress' || t.inProgress).map(t => ({ staff: g.name, date: d.date, task: t }))
  ));
  const nDone = allDays.filter(d => d.status === 'Completed').length;

  let y = MG;
  let pageNum = 0;
  const BOTTOM = PH - 14 * mm;

  const needPage = (need = 30) => {
    if (y + need > BOTTOM) { doc.addPage([PW, PH]); y = MG; pageNum++; }
  };

  // ── Header ────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); ink(doc, C.navy);
  doc.text('SMART PVT LTD', MG, y + 12); y += 14;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); ink(doc, C.grey);
  doc.text('smartfindme@gmail.com | +94 76 202 45 45', MG, y + 7); y += 12;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); ink(doc, C.teal);
  doc.text(pdfSafe(kind), MG, y + 9); y += 12;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); ink(doc, C.ink);
  doc.text(pdfSafe(period), MG, y + 8); y += 10;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); ink(doc, C.grey);
  doc.text(`Generated ${pdfStamp()} by ${pdfSafe(generatedBy)}`, MG, y + 7); y += 10;

  // Navy line
  ln(doc, C.navy, 1.2); doc.line(MG, y, PW - MG, y); y += 6;

  // ── Summary cards (3 + 2) ─────────────────────────────────────
  const cards = [
    [groups.length, 'Staff'], [allDays.length, 'Days'], [`${(Math.round(totHours*10)/10).toFixed(1)}`, 'Total hrs'],
    [totTasks, 'Tasks'], [openItems.length, 'Open tasks'],
  ];
  const cw3 = (W - 2 * 3) / 3;
  const cw2 = (W - 3) / 2;

  // Row 1: 3 cards
  for (let i = 0; i < 3; i++) {
    const x = MG + i * (cw3 + 3);
    fill(doc, C.light, x, y, cw3, 30);
    ln(doc, C.line, 0.5); doc.rect(x, y, cw3, 30);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); ink(doc, C.navy);
    doc.text(String(cards[i][0]), x + cw3 / 2, y + 15, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); ink(doc, C.grey);
    doc.text(cards[i][1], x + cw3 / 2, y + 24, { align: 'center' });
  }
  y += 33;
  // Row 2: 2 cards
  for (let i = 0; i < 2; i++) {
    const x = MG + i * (cw2 + 3);
    fill(doc, C.light, x, y, cw2, 30);
    ln(doc, C.line, 0.5); doc.rect(x, y, cw2, 30);
    const valColor = (i === 1 && openItems.length > 0) ? C.amber : C.navy;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); ink(doc, valColor);
    doc.text(String(cards[3 + i][0]), x + cw2 / 2, y + 15, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); ink(doc, C.grey);
    doc.text(cards[3 + i][1], x + cw2 / 2, y + 24, { align: 'center' });
  }
  y += 34;

  // At-a-glance line
  const avgHrs = allDays.length ? (totHours / allDays.length) : 0;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); ink(doc, C.ink);
  const glanceTxt = `${avgHrs.toFixed(1)} hrs/day avg  |  ${nDone} of ${allDays.length} days completed`;
  doc.text(glanceTxt, PW / 2, y + 5, { align: 'center' }); y += 12;

  // ── Per-staff block ───────────────────────────────────────────
  groups.forEach((g, gi) => {
    const nd = g.days.length;
    const sh = g.days.reduce((s, d) => s + d.hours, 0);
    const stn = g.days.reduce((s, d) => s + d.tasks.length, 0);
    const hasChart = nd >= 5;

    needPage(hasChart ? 90 : 55);

    // Navy staff bar
    const barH = 36;
    fill(doc, C.navy, MG, y, W, barH);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); ink(doc, C.white);
    doc.text(`${String(gi + 1).padStart(2, '0')}  ${pdfSafe(g.name)}`, MG + 6, y + 12);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); ink(doc, C.slate);
    doc.text(pdfSafe(g.role), MG + 6, y + 21);
    doc.setFontSize(7.5); ink(doc, C.white);
    doc.text(`${nd} day${nd > 1 ? 's' : ''} | ${(Math.round(sh*10)/10).toFixed(1)} hrs | ${stn} tasks`, MG + 6, y + 30);
    y += barH + 4;

    // ── Hours bar chart (5+ days) ────────────────────────────────
    if (hasChart) {
      needPage(55);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6); ink(doc, C.grey);
      doc.text('Hours per day', MG, y + 5); y += 8;
      const chartH = 32;
      const maxH = 10;
      const scale = chartH / maxH;
      const barSlot = W / nd;
      const bw = Math.min(barSlot * 0.7, 12);

      // 8-hr dotted line
      const y8 = y + chartH - 8 * scale;
      ln(doc, C.grey, 0.4);
      for (let dx = MG; dx < PW - MG; dx += 4) {
        doc.line(dx, y8, Math.min(dx + 2, PW - MG), y8);
      }
      doc.setFontSize(5.5); doc.text('8h', MG, y8 - 2);

      // Bars
      g.days.forEach((d, di) => {
        const bx = MG + di * barSlot + (barSlot - bw) / 2;
        const bh = Math.min(d.hours, maxH) * scale;
        const bc = d.status === 'Completed' ? C.teal : C.amber;
        fill(doc, bc, bx, y + chartH - bh, bw, bh);
        // Day number label
        const day = Number(d.date.split('-')[2]);
        doc.setFontSize(5); ink(doc, C.grey);
        doc.text(String(day), bx + bw / 2, y + chartH + 7, { align: 'center' });
      });
      y += chartH + 12;
    }

    // ── Week groups ──────────────────────────────────────────────
    const weeks = groupWeeks(g.days);
    weeks.forEach(([, wDays]) => {
      // Week header (only for ranged reports with chart)
      if (hasChart && wDays.length > 0) {
        needPage(20);
        const wh = wDays.reduce((s, d) => s + d.hours, 0);
        fill(doc, C.light, MG, y, W, 14);
        ln(doc, C.navy, 0.6); doc.line(MG, y + 14, PW - MG, y + 14);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7); ink(doc, C.navy);
        doc.text(`WEEK  ${fmtShort(wDays[0].date)} - ${fmtShort(wDays[wDays.length - 1].date)}`, MG + 5, y + 9);
        doc.setFont('helvetica', 'normal'); ink(doc, C.grey);
        doc.text(`${wDays.length} day${wDays.length > 1 ? 's' : ''} | ${wh.toFixed(1)} hrs`, PW - MG - 5, y + 9, { align: 'right' });
        y += 17;
      }

      // Day cards
      wDays.forEach(d => {
        const done = d.status === 'Completed';
        const borderCol = done ? C.green : C.amber;
        const bgCol = done ? C.white : C.pendBg;

        // Compute exact card height (must match rendering increments below)
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
        let cardH = 28; // header rows: 14 + 11 + 3
        const preparedTasks = d.tasks.map(t => {
          const slotStr = (t.start && t.end) ? `${t.start} - ${t.end}` : (t.slot || '');
          const desc = pdfSafe(String(t.description || ''));
          const ip = (t.status === 'In Progress' || t.inProgress);
          const descLines = doc.splitTextToSize(desc, W - 20);
          cardH += (slotStr ? 10 : 0) + descLines.length * 9 + 5;
          return { slotStr, descLines, ip };
        });
        if (!preparedTasks.length) cardH += 12;

        needPage(cardH + 5);

        fill(doc, bgCol, MG, y, W, cardH);
        ln(doc, C.line, 0.5); doc.rect(MG, y, W, cardH);
        // Left green/amber border
        fill(doc, borderCol, MG, y, 2.5, cardH);

        // Row 1: date + status
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); ink(doc, C.ink);
        doc.text(fmtDay(d.date), MG + 7, y + 11);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
        ink(doc, done ? C.green : C.amber);
        doc.text(d.status, PW - MG - 5, y + 11, { align: 'right' });
        y += 14;

        // Row 2: in-out + hours
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); ink(doc, C.grey);
        doc.text(`${d.inTime} - ${d.out}  |  ${d.hours.toFixed(1)} hrs`, MG + 7, y + 7);
        y += 11;

        // Thin separator
        ln(doc, C.line, 0.3); doc.line(MG + 5, y, PW - MG - 5, y);
        y += 3;

        // Tasks
        if (!preparedTasks.length) {
          doc.setFont('helvetica', 'italic'); doc.setFontSize(8); ink(doc, C.grey);
          doc.text('No tasks logged', MG + 7, y + 8);
          y += 12;
        } else {
          preparedTasks.forEach(({ slotStr, descLines, ip }) => {
            if (slotStr) {
              doc.setFont('helvetica', 'bold'); doc.setFontSize(7); ink(doc, C.teal);
              doc.text(pdfSafe(slotStr), MG + 7, y + 7);
              y += 10;
            }
            doc.setFont('helvetica', 'normal'); doc.setFontSize(8); ink(doc, C.ink);
            descLines.forEach((dl, li) => {
              doc.text(dl, MG + 7, y + 7 + li * 9);
            });
            if (ip) {
              const lastLineW = doc.getTextWidth(descLines[descLines.length - 1] || '');
              doc.setFont('helvetica', 'bold'); doc.setFontSize(6); ink(doc, C.amber);
              doc.text('[IN PROGRESS]', MG + 7 + lastLineW + 3, y + 7 + (descLines.length - 1) * 9);
            }
            y += descLines.length * 9 + 5;
          });
        }

        y += 4;
      });
    });

    y += 6;
  });

  // ── Open tasks section ────────────────────────────────────────
  needPage(40);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); ink(doc, C.navy);
  doc.text('Open tasks', MG, y + 9); y += 14;

  if (!openItems.length) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); ink(doc, C.grey);
    doc.text('No open tasks.', MG, y + 7); y += 12;
  } else {
    openItems.forEach(item => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
      const desc = pdfSafe(String(item.task?.description || ''));
      const descLines = doc.splitTextToSize(desc, W - 16);
      const h = 16 + descLines.length * 9;
      needPage(h + 4);
      fill(doc, C.amberBg, MG, y, W, h);
      fill(doc, C.amber, MG, y, 2.5, h);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); ink(doc, C.ink);
      doc.text(pdfSafe(item.staff), MG + 7, y + 10);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); ink(doc, C.grey);
      doc.text(fmtShort(item.date), PW - MG - 5, y + 10, { align: 'right' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); ink(doc, C.ink);
      descLines.forEach((dl, li) => doc.text(dl, MG + 7, y + 20 + li * 9));
      y += h + 4;
    });
  }

  // ── Footer note ───────────────────────────────────────────────
  y += 4;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); ink(doc, C.grey);
  doc.text('Hours = recorded work duration for that day.', MG, y + 5);

  // ── Page numbering (all pages) ────────────────────────────────
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); ink(doc, C.grey);
    doc.text('SMART PVT LTD | ERP report', MG, PH - 8);
    doc.text(`Page ${p} of ${total}`, PW - MG, PH - 8, { align: 'right' });
  }
  doc.setPage(total);

  return doc;
}

/** Build + download mobile PDF. */
export function saveWorkReportPdfMobile(updates, opts = {}) {
  const doc = buildWorkReportPdfMobile(updates, opts);
  const name = opts.fileName || `STAFF-WORK-REPORT-MOBILE-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(name);
  return doc;
}
