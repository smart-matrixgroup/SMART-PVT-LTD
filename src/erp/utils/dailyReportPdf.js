// ─────────────────────────────────────────────────────────────────
//  DAILY WORK REPORT → real PDF
//
//  The staff portal used to open a browser tab, write the sheet into it
//  and fire window.print(), which left the team staring at a "Save as PDF
//  / printer" dialog instead of a file. Every report in the ERP is drawn
//  through src/erp/utils/reportPdf.js instead, so a daily sheet — and a
//  whole week of them for one staff member (the week-end summary) — comes
//  out here as a downloadable .pdf with the same header band.
//
//  Pure module: no Firebase imports, so the QA tests can run it in node.
// ─────────────────────────────────────────────────────────────────
import { saveTablePdf, pdfSafe } from './reportPdf.js';

const dash = v => {
  const s = pdfSafe(String(v ?? '')).trim();
  return s || '—';
};

/** '2.0 hrs' / '2' / 2 → 2 (NaN-safe). */
export const hoursNumber = v => {
  const n = Number(String(v ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const fileKey = v => pdfSafe(String(v ?? '')).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'UNDATED';

/**
 * One row per task: NO · START · END · HOURS · WORK · STATUS.
 * Rows with no description are dropped — an empty pre-dated block from the
 * Google Sheet import is not work, and printing it made the report look half-blank.
 */
export function dailyReportRows(tasks = []) {
  return (Array.isArray(tasks) ? tasks : [])
    .filter(t => t && String(t.description || '').trim())
    .map((t, i) => [
      String(t.no || i + 1),
      dash(t.start),
      dash(t.end),
      dash(t.hours),
      dash(t.description),
      dash(t.status || 'Completed'),
    ]);
}

/**
 * A daily document can hold a real `tasks` array (the staff portal sheet) or
 * the older flat shape the Excel import wrote (`items` + one start/end pair).
 * Both must print as task rows, or the imported days come out blank.
 */
export function reportTasksOf(u = {}) {
  if (Array.isArray(u.tasks) && u.tasks.some(t => String(t?.description || '').trim())) return u.tasks;
  const items = Array.isArray(u.items) ? u.items : [];
  if (!items.length) return u.tasks || [];
  return items.map((description, i) => ({
    no: i + 1,
    start: u.startTime || u.arrival || '',
    end: u.endTime || u.departure || '',
    hours: u.totalHours || u.totalWorkHours || '',
    description: String(description || ''),
    status: u.status || 'Completed',
  }));
}

const TASK_COLUMNS = [
  { label: 'NO', width: 5, align: 'center' },
  { label: 'START', width: 11, align: 'center' },
  { label: 'END', width: 11, align: 'center' },
  { label: 'HOURS', width: 11, align: 'center' },
  { label: 'WORK / DESCRIPTION', width: 50, wrap: true },
  { label: 'STATUS', width: 12, align: 'center' },
];

/** Header lines every daily sheet carries (name / date / punches). */
export function dailyReportMeta(r = {}) {
  const lunch = (r.lunchStart || r.lunchEnd)
    ? `${dash(r.lunchStart)} to ${dash(r.lunchEnd)} (${dash(r.lunchDuration)})`
    : '—';
  return [
    `NAME: ${dash(r.name || r.staffName)}      DATE: ${dash(r.date)} (${dash(r.day)})`,
    `POSITION: ${dash(r.position)}      LOCATION: ${dash(r.location)}      WORK MODE: ${dash(r.workMode)}`,
    `ARRIVAL: ${dash(r.arrival)}      LUNCH: ${lunch}      DEPARTURE: ${dash(r.departure)}`,
  ];
}

/** One staff-day as a PDF (the staff portal's sheet and the admin's row). */
export function saveDailyReportPdf(r = {}, { generatedBy = '' } = {}) {
  const rows = dailyReportRows(reportTasksOf(r));
  const done = rows.filter(row => row[5] === 'Completed').length;

  const notes = [];
  if (String(r.remarks || '').trim()) notes.push(`REMARKS: ${dash(r.remarks)}`);
  if (String(r.planTomorrow || '').trim()) notes.push(`PLAN FOR TOMORROW: ${dash(r.planTomorrow)}`);

  return saveTablePdf({
    title: `DAILY WORK REPORT - ${dash(r.date)} (${dash(r.day)})`,
    subtitle: `${dash(r.name || r.staffName)} - ${dash(r.position)}`,
    meta: dailyReportMeta(r),
    columns: TASK_COLUMNS,
    rows,
    statusCol: 5,
    summary: [
      { label: 'Total work hours', value: dash(r.totalWorkHours) },
      { label: 'Tasks logged', value: String(rows.length) },
      { label: 'Completed', value: `${done}/${rows.length}` },
    ],
    footNote: [...notes, 'Arrival, lunch and departure come from this sheet; the hours shown are the ones the staff member filed.'].join('   '),
    generatedBy,
  }, `DAILY-WORK-REPORT-${fileKey(r.name || r.staffName)}-${fileKey(r.date)}.pdf`);
}

/**
 * A stretch of days for ONE staff member as a single PDF: every task keeps
 * its date, so a week reads top-to-bottom instead of as seven files.
 * This is the document the week-end summary sends out.
 */
export function periodReportRows(reports = []) {
  const out = [];
  (Array.isArray(reports) ? reports : [])
    .slice()
    .sort((a, b) => String(a?.date || '').localeCompare(String(b?.date || '')))
    .forEach(r => {
      dailyReportRows(reportTasksOf(r)).forEach(row => {
        out.push([dash(r.date), row[1], row[2], row[3], row[4], row[5]]);
      });
    });
  return out;
}

/** The task rows a UI list should show for one report (no empty blocks). */
export const dailyReportTasksOf = r => reportTasksOf(r || {}).filter(t => String(t?.description || '').trim());

export function saveStaffPeriodReportPdf({
  staffName = '', staffId = '', periodLabel = '', reports = [], generatedBy = '',
} = {}) {
  const list = Array.isArray(reports) ? reports : [];
  const rows = periodReportRows(list);
  const totalHours = list.reduce((a, r) => a + hoursNumber(r.totalWorkHours), 0);
  const done = rows.filter(row => row[5] === 'Completed').length;
  const days = [...new Set(list.map(r => r.date).filter(Boolean))].sort();

  return saveTablePdf({
    title: `WEEKLY WORK REPORT - ${dash(periodLabel)}`,
    subtitle: `${dash(staffName)}${staffId ? ` - ${dash(staffId)}` : ''}`,
    meta: [
      `STAFF: ${dash(staffName)}      STAFF ID: ${dash(staffId)}`,
      `PERIOD: ${dash(periodLabel)}      DAYS LOGGED: ${String(days.length)}${days.length ? ` (${dash(days[0])}${days.length > 1 ? ` to ${dash(days[days.length - 1])}` : ''})` : ''}`,
    ],
    columns: [
      { label: 'DATE', width: 12, align: 'center' },
      { label: 'START', width: 9, align: 'center' },
      { label: 'END', width: 9, align: 'center' },
      { label: 'HOURS', width: 10, align: 'center' },
      { label: 'WORK / DESCRIPTION', width: 50, wrap: true },
      { label: 'STATUS', width: 10, align: 'center' },
    ],
    rows,
    statusCol: 5,
    summary: [
      { label: 'Days logged', value: String(days.length) },
      { label: 'Total hours', value: `${(Math.round(totalHours * 10) / 10).toFixed(1)} hrs` },
      { label: 'Tasks completed', value: `${done}/${rows.length}` },
    ],
    footNote: 'One row per task, in date order. A day with no sheet does not appear; ask the staff member to file the missing day.',
    generatedBy,
  }, `WEEKLY-WORK-REPORT-${fileKey(staffName)}-${fileKey(periodLabel)}.pdf`);
}
