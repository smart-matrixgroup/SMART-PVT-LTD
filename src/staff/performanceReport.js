// ─────────────────────────────────────────────────────────────────
//  Staff work-report EXPORT — the "neat and professional" version.
//
//  The old export was a plain CSV: Excel gave every column the same
//  narrow width, the long WORK / DESCRIPTION text ran on one line and
//  visually spilled into the neighbouring cells, rows arrived in random
//  order, and the same person showed up with two different positions.
//
//  This module builds a real .xlsx workbook instead:
//    • fixed column widths + wrapped cells (nothing spills)
//    • one task per line inside WORK / DESCRIPTION
//    • rows grouped per staff member, oldest date first, dates ascending
//    • a coloured band above each staff member with their day/hour totals
//    • one position per person (taken from the staff record)
//    • row heights sized to the text, frozen header, landscape print fit
//    • a second "SUMMARY" sheet: days, total hours, avg hours, tasks
//
//  Everything that decides *what* goes in the sheet is a pure helper so
//  the Node QA suite can test it; only downloadPerformanceReport() touches
//  exceljs / the browser.
// ─────────────────────────────────────────────────────────────────
import { getDayName, calculateTaskDuration, findStaffBySheetName } from './staffUtils.js';

// Tabs / NBSP / repeated spaces are what make copied sheet text ragged.
export const cleanText = v => String(v ?? '')
  .replace(/[\t\u00a0]+/g, ' ')
  .replace(/\s*\n\s*/g, ' ')
  .replace(/ {2,}/g, ' ')
  .trim();

export const prettyDate = dStr => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dStr || '').trim());
  if (!m) return cleanText(dStr);
  return `${m[3]}-${m[2]}-${m[1]}`;   // DD-MM-YYYY
};

export const hoursNumber = v => {
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d+)\s*[:.](\d{2})$/);              // "8.30" / "8:30" hrs style
  if (m) return parseInt(m[1], 10) + parseInt(m[2], 10) / 60;
  m = s.match(/^(\d+)\s*h(?:ours?|rs?)?\s*(\d+)?\s*m?/i); // "8.5 hrs" / "8h 30m"
  if (m) return parseInt(m[1], 10) + (m[2] ? parseInt(m[2], 10) / 60 : 0);
  m = s.match(/^(\d+(?:\.\d+)?)\s*(?:hrs?|hours?|h)?$/i);
  if (m) return parseFloat(m[1]);
  return 0;
};

export const fmtHours = n => `${(Math.round(n * 10) / 10).toFixed(1)} hrs`;

// A report row may carry tasks[], items[] or the flat "WORK / DESCRIPTION"
// string — read whichever exists and always return task objects.
export function tasksOf(u) {
  if (Array.isArray(u.tasks) && u.tasks.length) {
    return u.tasks.map((t, i) => ({
      no: i + 1,
      start: cleanText(t.start || t.from || ''),
      end: cleanText(t.end || t.to || ''),
      description: cleanText(t.description || t.work || ''),
      status: cleanText(t.status) || 'Completed',
      hours: t.hours || calculateTaskDuration(t.start || '', t.end || ''),
    })).filter(t => t.description);
  }
  if (Array.isArray(u.items) && u.items.length) {
    return u.items.map((d, i) => ({
      no: i + 1, start: '', end: '', description: cleanText(d), status: cleanText(u.status) || 'Completed', hours: '—',
    })).filter(t => t.description);
  }
  const raw = cleanText(u.workDescription || u.work || u.description || '');
  if (!raw) return [];
  return raw.split('|').map(s => s.trim()).filter(Boolean).map((seg, i) => {
    const m = seg.match(/^(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})\s*[:;\-]?\s*(.*)$/);
    const body = m ? m[3] : seg;
    const sm = body.match(/\[([^\]]+)\]\s*$/);
    return {
      no: i + 1,
      start: m ? m[1] : '',
      end: m ? m[2] : '',
      description: cleanText(sm ? body.slice(0, sm.index) : body),
      status: sm ? sm[1].trim() : cleanText(u.status) || 'Completed',
      hours: m ? calculateTaskDuration(m[1], m[2]) : '—',
    };
  }).filter(t => t.description);
}

// "08:30 – 14:30  Updated the website  [In Progress]" — one line per task.
export function taskLine(t) {
  const span = t.start && t.end ? `${t.start} – ${t.end}` : (t.start || '');
  const status = t.status && t.status !== 'Completed' ? `  [${t.status}]` : '';
  return `${span}${span ? '  ' : ''}${t.description}${status}`;
}

export const workText = tasks => tasks.map(taskLine).join('\n');

// Excel does not auto-fit wrapped rows written by a library, so estimate:
// chars that fit ≈ column width, plus one line per hard break.
export function estimatedLines(text, width) {
  const w = Math.max(12, Math.floor(width * 1.02));
  return String(text || '').split('\n').reduce((n, line) => n + Math.max(1, Math.ceil(line.length / w)), 0);
}

export function rowHeightFor(cells) {
  const lines = Math.max(1, ...cells.map(c => estimatedLines(c.text, c.width)));
  return Math.min(320, 15 + lines * 13.5);
}

// One export row = one staff-day.
export function normalizeReport(u) {
  const date = cleanText(u.date);
  const tasks = tasksOf(u);
  return {
    name: cleanText(u.name || u.staffName) || 'Staff',
    position: cleanText(u.position),
    date,
    day: cleanText(u.day) || (date ? getDayName(date) : ''),
    location: cleanText(u.location),
    workMode: cleanText(u.workMode),
    arrival: cleanText(u.arrival || u.startTime),
    lunchStart: cleanText(u.lunchStart),
    lunchEnd: cleanText(u.lunchEnd),
    lunchDuration: cleanText(u.lunchDuration),
    departure: cleanText(u.departure || u.endTime),
    totalWorkHours: cleanText(u.totalWorkHours),
    tasks,
    work: workText(tasks),
    status: tasks.length && tasks.every(t => t.status === 'Completed')
      ? cleanText(u.status) || 'Completed'
      : (cleanText(u.status) || (tasks.some(t => t.status === 'Pending') ? 'Pending' : 'In Progress')),
    remarks: cleanText(u.remarks || u.notes),
    planTomorrow: cleanText(u.planTomorrow || u.planForTomorrow),
    submittedAt: u.submittedAt || u.createdAt || null,
  };
}

// Grouped, professional ordering: staff A→Z, then oldest date first.
export function sortReports(rows) {
  return [...rows].sort((a, b) =>
    a.name.localeCompare(b.name) || String(a.date).localeCompare(String(b.date)));
}

// Positions are typed per day, so the same person can appear as
// "Software Associate" one day and "Software Developer Associate II" the
// next. The staff record wins; otherwise use their newest description.
export function positionResolver(staffRecords) {
  const byName = {};
  (staffRecords || []).forEach(s => {
    if (!s || !s.name) return;
    const role = cleanText(s.role || s.position);
    if (role) byName[cleanText(s.name).toLowerCase()] = role;
  });
  return (rows) => {
    const fromRecord = byName[rows[0].name.toLowerCase()];
    if (fromRecord) return fromRecord;
    const withPos = rows.filter(r => r.position);
    const newest = withPos.sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    return newest ? newest.position : '';
  };
}

export function summarizeStaff(rows) {
  const totalHours = rows.reduce((n, r) => n + hoursNumber(r.totalWorkHours), 0);
  const tasks = rows.reduce((n, r) => n + r.tasks.length, 0);
  const open = rows.reduce((n, r) => n + r.tasks.filter(t => t.status !== 'Completed').length, 0);
  return {
    days: rows.length,
    totalHours: fmtHours(totalHours),
    avgHours: rows.length ? fmtHours(totalHours / rows.length) : '0.0 hrs',
    tasks,
    open,
  };
}

// One name per person: a sheet written by hand has "Lukshi" and "Luksikka"
// for the same member, which would split into two report sections.
export function canonicalize(rows, staffRecords = []) {
  return sortReports(rows.map(r => {
    const rec = staffRecords.length ? findStaffBySheetName(staffRecords, r.name) : null;
    return rec ? { ...r, name: rec.name } : r;
  }));
}

// [{ name, position, rows, summary }] — the export sections, staff A→Z.
export function groupReports(rows, staffRecords = []) {
  const map = new Map();
  canonicalize(rows, staffRecords).forEach(r => {
    if (!map.has(r.name)) map.set(r.name, []);
    map.get(r.name).push(r);
  });
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, list]) => ({
      name,
      position: positionResolver(staffRecords)(list),
      rows: list,
      summary: summarizeStaff(list),
    }));
}

export const REPORT_COLUMNS = [
  { key: 'sn',            label: 'S/N',             width: 5,  align: 'center' },
  { key: 'name',          label: 'NAME',            width: 20 },
  { key: 'position',      label: 'POSITION',        width: 24, wrap: true },
  { key: 'date',          label: 'DATE',            width: 12, align: 'center' },
  { key: 'day',           label: 'DAY',             width: 11, align: 'center' },
  { key: 'location',      label: 'LOCATION',        width: 24, wrap: true },
  { key: 'workMode',      label: 'WORK MODE',       width: 15, align: 'center', wrap: true },
  { key: 'arrival',       label: 'ARRIVAL',         width: 10, align: 'center' },
  { key: 'lunchStart',    label: 'LUNCH START',     width: 12, align: 'center' },
  { key: 'lunchEnd',      label: 'LUNCH END',       width: 11, align: 'center' },
  { key: 'lunchDuration', label: 'LUNCH DURATION',  width: 13, align: 'center', wrap: true },
  { key: 'departure',     label: 'DEPARTURE',       width: 11, align: 'center' },
  { key: 'totalWorkHours',label: 'TOTAL WORK HRS',  width: 13, align: 'center', wrap: true },
  { key: 'work',          label: 'WORK / DESCRIPTION', width: 62, wrap: true },
  { key: 'status',        label: 'STATUS',          width: 13, align: 'center', wrap: true },
  { key: 'remarks',       label: 'REMARKS',         width: 22, wrap: true },
  { key: 'planTomorrow',  label: 'PLAN FOR TOMORROW', width: 24, wrap: true },
];

const cellValue = (row, col, sn) => {
  switch (col.key) {
    case 'sn':    return sn;
    case 'date':  return prettyDate(row.date);
    case 'day':   return row.day || (row.date ? getDayName(row.date) : '');
    default:      return row[col.key] ?? '';
  }
};

// ── CSV export — same columns, but every cell forced onto ONE line so a
//    plain CSV reader (Sheets, old Excel) never sees a broken row. Tasks
//    stay separated by " | " and the rows arrive grouped A→Z by staff. ──
export function buildCsv(rows, groups) {
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const posOf = name => (groups.find(g => g.name === name) || {}).position || '';
  const out = [REPORT_COLUMNS.map(c => esc(c.label)).join(',')];
  sortReports(rows).forEach((row, i) => {
    const line = REPORT_COLUMNS.map((col) => {
      if (col.key === 'sn') return i + 1;
      if (col.key === 'position') return posOf(row.name);
      if (col.key === 'work') return row.tasks.map(taskLine).join(' | ');
      return cleanText(cellValue(row, col, i + 1));
    });
    out.push(line.map(v => esc(v)).join(','));
  });
  return '\uFEFF' + out.join('\r\n') + '\r\n';
}

// ── The workbook ───────────────────────────────────────────────────────
export async function buildPerformanceWorkbook(rows, groups, meta = {}) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SMART Pvt Ltd — ERP';
  wb.created = new Date();

  const NAVY = 'FF1F3864', BLUE = 'FF2E75B6', BAND = 'FFDCE6F1', HEAD = 'FFF2F2F2';
  const ZEBRA = 'FFF7FAFD', WHITE = 'FFFFFFFF', LINE = 'FFB4C6E7';
  const THIN = { style: 'thin', color: { argb: LINE } };
  const border = { top: THIN, left: THIN, bottom: THIN, right: THIN };
  const solid = argb => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
  const STATUS_COLOR = {
    Completed: 'FF1E7B34', 'In Progress': 'FFB26A00', Pending: 'FFB00020', 'On Hold': 'FF6A6A6A',
  };

  const ws = wb.addWorksheet('WORK REPORT', { views: [{ showGridLines: false }] });
  ws.columns = REPORT_COLUMNS.map(c => ({ width: c.width }));

  const last = REPORT_COLUMNS.length;
  const put = (r, c, value, o = {}) => {
    const cell = ws.getCell(r, c);
    if (value !== undefined && value !== null && value !== '') cell.value = value;
    cell.border = border;
    if (o.fill) cell.fill = solid(o.fill);
    if (o.numFmt) cell.numFmt = o.numFmt;
    cell.font = {
      name: 'Calibri', size: o.size || 10, bold: !!o.bold, italic: !!o.italic,
      color: { argb: o.color || 'FF20242B' },
    };
    cell.alignment = {
      horizontal: o.align || (o.wrapAll ? 'left' : (REPORT_COLUMNS[c - 1] || {}).align || 'left'),
      vertical: o.vertical || 'top',
      wrapText: o.wrap === undefined ? !!(REPORT_COLUMNS[c - 1] || {}).wrap : !!o.wrap,
    };
    return cell;
  };
  const span = (r, c1, c2, value, o = {}) => {
    ws.mergeCells(r, c1, r, c2);
    for (let c = c1; c <= c2; c++) put(r, c, c === c1 ? value : '', o);
    return ws.getCell(r, c1);
  };

  let r = 1;
  span(r, 1, last, meta.title || 'SMART PVT LTD · STAFF PERFORMANCE WORK REPORT',
    { fill: NAVY, color: WHITE, bold: true, size: 15, align: 'center', vertical: 'middle', wrap: false });
  ws.getRow(r).height = 30; r++;
  span(r, 1, last, `${meta.rangeLabel || 'All reported dates'}   ·   ${groups.length} staff member${groups.length === 1 ? '' : 's'}   ·   ${rows.length} daily report${rows.length === 1 ? '' : 's'}`,
    { fill: BLUE, color: WHITE, size: 10, align: 'center', vertical: 'middle', wrap: false });
  ws.getRow(r).height = 19; r++;
  if (meta.generatedBy) {
    span(r, 1, last, `Generated ${meta.generatedOn || ''} by ${meta.generatedBy}`,
      { italic: true, color: 'FF6A6A6A', align: 'right', vertical: 'middle', wrap: false, fill: HEAD });
    ws.getRow(r).height = 16; r++;
  }
  r++; // breathing room

  const headerRow = r;
  REPORT_COLUMNS.forEach((c, i) => put(r, i + 1, c.label,
    { fill: BLUE, color: WHITE, bold: true, size: 9, align: 'center', vertical: 'middle', wrap: true }));
  ws.getRow(r).height = 28;
  r++;
  ws.views = [{ state: 'frozen', xSplit: 2, ySplit: headerRow, showGridLines: false }];

  let n = 0;
  groups.forEach((g, gi) => {
    span(r, 1, last,
      `${String(gi + 1).padStart(2, '0')} · ${g.name}${g.position ? ` — ${g.position}` : ''}` +
      `      ${g.summary.days} day${g.summary.days === 1 ? '' : 's'} · ${g.summary.totalHours} total · avg ${g.summary.avgHours}/day · ${g.summary.tasks} task${g.summary.tasks === 1 ? '' : 's'}${g.summary.open ? ` · ${g.summary.open} not completed` : ''}`,
      { fill: BAND, bold: true, size: 11, vertical: 'middle', wrap: false });
    ws.getRow(r).height = 22; r++;

    g.rows.forEach((row, ri) => {
      n++;
      const bg = ri % 2 ? ZEBRA : WHITE;
      const cells = [];
      REPORT_COLUMNS.forEach((col, ci) => {
        // DATE and TOTAL WORK HRS go in as real date/number cells so Excel
        // can sort and SUM them; everything else stays readable text.
        const iso = /^\d{4}-\d{2}-\d{2}$/.test(row.date);
        if (col.key === 'date' && iso) {
          const [y, m, d] = row.date.split('-').map(Number);
          // Excel serial dates are timezone-free: local midnight shifts a
          // day backwards when exported from timezones such as Sri Lanka.
          put(r, ci + 1, new Date(Date.UTC(y, m - 1, d)), { fill: bg, align: 'center', numFmt: 'dd-mm-yyyy' });
          return;
        }
        const hrs = col.key === 'totalWorkHours' ? hoursNumber(row.totalWorkHours) : 0;
        if (col.key === 'totalWorkHours' && hrs > 0) {
          put(r, ci + 1, hrs, { fill: bg, bold: true, align: 'center', numFmt: '0.0' });
          return;
        }
        const value = col.key === 'sn' ? n
          : col.key === 'position' ? g.position
            : col.key === 'work' ? row.work
              : cellValue(row, col, n);
        const text = col.key === 'work' ? String(value) : cleanText(value);
        const isStatus = col.key === 'status';
        put(r, ci + 1, text, {
          fill: bg,
          color: isStatus ? (STATUS_COLOR[text] || 'FF20242B') : 'FF20242B',
          bold: isStatus || col.key === 'name' || col.key === 'totalWorkHours',
        });
        if (col.wrap) cells.push({ text, width: col.width });
      });
      ws.getRow(r).height = rowHeightFor(cells);
      r++;
    });
    r++; // gap between staff members
  });

  ws.pageSetup = {
    orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    paperSize: 9, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };
  ws.headerFooter = { oddRight: 'Page &P of &N' };

  // ── SUMMARY sheet ────────────────────────────────────────────────────
  const sum = wb.addWorksheet('SUMMARY', { views: [{ showGridLines: false }] });
  const SH = ['STAFF MEMBER', 'POSITION', 'DAYS REPORTED', 'TOTAL WORK HRS', 'AVG HRS / DAY', 'TASKS', 'NOT COMPLETED'];
  sum.columns = [{ width: 24 }, { width: 30 }, { width: 15 }, { width: 16 }, { width: 15 }, { width: 10 }, { width: 16 }];
  span2(sum, 0, SH.length, 'SMART PVT LTD · STAFF PERFORMANCE SUMMARY', NAVY, WHITE, 14);
  sum.getRow(1).height = 28;
  SH.forEach((h, i) => {
    const cell = sum.getCell(2, i + 1);
    cell.value = h;
    cell.fill = solid(BLUE);
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: WHITE } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = border;
  });
  sum.getRow(2).height = 26;
  let sr = 3;
  let tDays = 0, tHours = 0, tTasks = 0, tOpen = 0;
  groups.forEach((g, gi) => {
    const hrs = hoursNumber(g.summary.totalHours);
    tDays += g.summary.days; tHours += hrs; tTasks += g.summary.tasks; tOpen += g.summary.open;
    const vals = [g.name, g.position, g.summary.days, hrs, parseFloat(g.summary.avgHours), g.summary.tasks, g.summary.open];
    vals.forEach((v, i) => {
      const cell = sum.getCell(sr, i + 1);
      cell.value = v;
      cell.font = { name: 'Calibri', size: 10, bold: i === 0 };
      cell.alignment = { horizontal: i === 0 || i === 1 ? 'left' : 'center', vertical: 'middle' };
      cell.border = border;
      cell.fill = solid(gi % 2 ? ZEBRA : WHITE);
      if (i >= 2 && i <= 4) cell.numFmt = i === 4 ? '0.0' : '0';
      if (i === 6 && v > 0) cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFB00020' } };
    });
    sr++;
  });
  const totals = ['TOTAL', '', tDays, Math.round(tHours * 10) / 10,
    tDays ? Math.round((tHours / tDays) * 10) / 10 : 0, tTasks, tOpen];
  totals.forEach((v, i) => {
    const cell = sum.getCell(sr, i + 1);
    cell.value = v;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: WHITE } };
    cell.fill = solid(NAVY);
    cell.alignment = { horizontal: i === 0 ? 'left' : 'center', vertical: 'middle' };
    cell.border = border;
    if (i >= 2 && i <= 4) cell.numFmt = i === 4 ? '0.0' : '0';
  });
  sum.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  return wb;
}

function span2(ws, row, cols, text, bg, fg, size) {
  ws.mergeCells(row + 1, 1, row + 1, cols);
  const cell = ws.getCell(row + 1, 1);
  cell.value = text;
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
  cell.font = { name: 'Calibri', size, bold: true, color: { argb: fg } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
}

// ── Download helpers ───────────────────────────────────────────────────
const triggerDownload = (blob, filename) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
};

export async function downloadPerformanceReport(updates, {
  staffRecords = [], title, rangeLabel, generatedBy, generatedOn, filename,
} = {}) {
  const rows = canonicalize(updates.map(normalizeReport), staffRecords);
  const groups = groupReports(rows, staffRecords);
  const wb = await buildPerformanceWorkbook(rows, groups, { title, rangeLabel, generatedBy, generatedOn });
  const buf = await wb.xlsx.writeBuffer();
  triggerDownload(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    filename || 'STAFF-PERFORMANCE-REPORT.xlsx',
  );
  return { rows: rows.length, groups: groups.length };
}

export function downloadPerformanceCsv(updates, { staffRecords = [], filename } = {}) {
  const rows = sortReports(updates.map(normalizeReport));
  const groups = groupReports(rows, staffRecords);
  triggerDownload(new Blob([buildCsv(rows, groups)], { type: 'text/csv;charset=utf-8;' }),
    filename || 'STAFF-PERFORMANCE-REPORT.csv');
  return { rows: rows.length, groups: groups.length };
}

// ── Import template ────────────────────────────────────────────────────
// One row per staff per day, same columns as the report. HEADERS STAY ON
// ROW 1 — the ERP importer reads row 1 as the header line, so no banner.
export async function buildTemplateWorkbook(example) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SMART Pvt Ltd — ERP';
  const ws = wb.addWorksheet('REPORT TEMPLATE', { views: [{ showGridLines: false, state: 'frozen', ySplit: 1 }] });
  ws.columns = REPORT_COLUMNS.map(c => ({ width: c.width }));
  const THIN = { style: 'thin', color: { argb: 'FFB4C6E7' } };
  const border = { top: THIN, left: THIN, bottom: THIN, right: THIN };

  REPORT_COLUMNS.forEach((c, i) => {
    const cell = ws.getCell(1, i + 1);
    cell.value = c.label;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } };
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = border;
  });
  ws.getRow(1).height = 28;

  const sample = example || {
    name: 'Ashan Perera', position: 'Software Associate - II', date: 'DD-MM-YYYY', day: 'Monday',
    location: 'SMART Trincomalee', workMode: 'On-Site / Office', arrival: '08:30',
    lunchStart: '13:00', lunchEnd: '14:00', lunchDuration: '1.0 hrs', departure: '17:30',
    totalWorkHours: '8.0 hrs',
    work: '08:30-11:00: Example task — DELETE THIS ROW BEFORE IMPORT | 11:00-13:00: Second example task',
    status: 'Completed', remarks: 'Remarks here', planTomorrow: 'Plan for tomorrow here',
  };
  for (let r = 2; r <= 6; r++) {
    REPORT_COLUMNS.forEach((col, i) => {
      const cell = ws.getCell(r, i + 1);
      if (r === 2 && col.key !== 'sn') cell.value = sample[col.key] ?? '';
      cell.border = border;
      cell.font = { name: 'Calibri', size: 10, italic: r === 2, color: { argb: r === 2 ? 'FF808080' : 'FF20242B' } };
      cell.alignment = {
        horizontal: col.align || 'left', vertical: 'top',
        wrapText: !!col.wrap,
      };
    });
    ws.getRow(r).height = r === 2 ? 42 : 18;
  }

  return wb;
}

export async function downloadReportTemplate(example, filename = 'STAFF-REPORT-IMPORT-TEMPLATE.xlsx') {
  const wb = await buildTemplateWorkbook(example);
  const buf = await wb.xlsx.writeBuffer();
  triggerDownload(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    filename,
  );
}
