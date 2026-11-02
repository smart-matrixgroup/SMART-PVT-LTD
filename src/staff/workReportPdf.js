// ── Staff work report as a real .pdf ────────────────────────────────────
// Same grouping the .xlsx export uses (one section per staff member, dates
// ascending, one canonical name per person), rendered through the shared
// branded report PDF so daily / weekly / monthly work reports can be handed
// over as a file instead of a print dialog.
import { saveTablePdf } from '../erp/utils/reportPdf.js';
import { groupReports, normalizeReport, hoursNumber, fmtHours, prettyDate } from './performanceReport.js';

const COLUMNS = [
  { label: 'DATE', width: 11, align: 'center' },
  { label: 'DAY', width: 9, align: 'center' },
  { label: 'IN', width: 7, align: 'center' },
  { label: 'OUT', width: 7, align: 'center' },
  { label: 'HOURS', width: 8, align: 'center' },
  { label: 'WORK / DESCRIPTION', width: 44, wrap: true },
  { label: 'STATUS', width: 11, align: 'center' },
];

const dash = v => {
  const s = String(v ?? '').trim();
  return s || '—';
};

export function saveWorkReportPdf(updates, {
  staffRecords = [],
  title = 'STAFF WORK REPORT',
  rangeLabel = '',
  generatedBy = '',
  fileName = '',
} = {}) {
  const rows = (Array.isArray(updates) ? updates : []).filter(Boolean).map(normalizeReport);
  const groups = groupReports(rows, staffRecords);
  const days = groups.reduce((n, g) => n + g.rows.length, 0);
  const totalHours = groups.reduce((n, g) => n + hoursNumber(g.summary.totalHours), 0);

  return saveTablePdf({
    title,
    subtitle: rangeLabel,
    orientation: 'landscape',
    sections: groups.map((g, gi) => ({
      heading: `${String(gi + 1).padStart(2, '0')} · ${g.name}${g.position ? ` — ${g.position}` : ''}   (${g.summary.days} day${g.summary.days === 1 ? '' : 's'} · ${g.summary.totalHours} · ${g.summary.tasks} task${g.summary.tasks === 1 ? '' : 's'})`,
      columns: COLUMNS,
      statusCol: 6,
      rows: g.rows.map(r => [
        prettyDate(r.date),
        r.day,
        r.arrival,
        r.departure,
        hoursNumber(r.totalWorkHours) ? fmtHours(hoursNumber(r.totalWorkHours)) : r.totalWorkHours,
        r.work,
        r.status,
      ].map(dash)),
    })),
    summary: [
      { label: 'Staff', value: String(groups.length) },
      { label: 'Days reported', value: String(days) },
      { label: 'Total hours', value: fmtHours(totalHours) },
      { label: 'Open tasks', value: String(groups.reduce((n, g) => n + g.summary.open, 0)) },
    ],
    footNote: 'Each block is one staff member, oldest day first. Hours are the recorded work duration for that day.',
    generatedBy,
    fileName,
  });
}
