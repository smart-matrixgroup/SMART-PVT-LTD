// ── Client report PDFs ───────────────────────────────────────────────────
// One statement per client (profile + projects + work tracker) and one
// roster of every client. Both go through the shared branded table renderer
// so a client report looks like the attendance / payroll exports.
import { saveTablePdf } from './reportPdf.js';

const PROJECT_LABEL = {
  requirements_pending: 'Requirements Pending',
  quotation_sent: 'Quotation Sent',
  quotation_accepted: 'Quotation Accepted',
  advance_paid: 'Advance Paid',
  'In Progress': 'In Progress',
  Completed: 'Completed',
};
export const projectStatusLabel = v => PROJECT_LABEL[v] || v || '—';

// createdAt is a Firestore Timestamp in live data and a plain string in the
// dev fixtures — accept both.
const dateOnly = v => {
  const d = v?.toDate ? v.toDate() : v ? new Date(typeof v === 'object' && v.seconds ? v.seconds * 1000 : v) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};
const text = v => String(v ?? '').trim();

/**
 * saveClientStatementPdf({ client, projects, work, adminName })
 * work: the client's un-removed tracker items.
 */
export function saveClientStatementPdf({ client, projects = [], work = [], adminName = '' }) {
  const c = client || {};
  const done = work.filter(w => w.status === 'done').length;
  const pct = work.length ? Math.round((done / work.length) * 100) : 0;

  const meta = [
    `${text(c.name) || '—'}${text(c.company) ? `  ·  ${c.company}` : ''}`,
    [text(c.email), text(c.phone)].filter(Boolean).join('  ·  '),
    [text(c.address), c.clientSince ? `Client since ${c.clientSince}` : ''].filter(Boolean).join('  ·  '),
  ];

  const sections = [
    {
      heading: `Projects (${projects.length})`,
      columns: [
        { label: '#', width: 4, align: 'center' },
        { label: 'PROJECT', width: 34, wrap: true },
        { label: 'SERVICE', width: 18, wrap: true },
        { label: 'STATUS', width: 18, align: 'center' },
        { label: 'PROGRESS', width: 10, align: 'center' },
        { label: 'STARTED', width: 14, align: 'center' },
      ],
      rows: projects.map((p, i) => [
        String(i + 1),
        text(p.title) || '—',
        text(p.serviceType) || '—',
        projectStatusLabel(p.status),
        `${Number(p.completion) || 0}%`,
        dateOnly(p.createdAt) || '—',
      ]),
      statusCol: 3,
    },
    {
      heading: `Work Tracker (${done}/${work.length} done)`,
      columns: [
        { label: 'WORK ITEM', width: 30, wrap: true },
        { label: 'PROJECT', width: 20, wrap: true },
        { label: 'STATUS', width: 11, align: 'center' },
        { label: 'REMARK / NOTE', width: 27, wrap: true },
        { label: 'LAST UPDATE', width: 12, align: 'center' },
      ],
      rows: work.map(w => [
        text(w.title) || '—',
        text(w.project) || '—',
        w.status === 'done' ? 'Completed' : 'Pending',
        text(w.note) || '—',
        dateOnly(w.updatedAt || w.createdAt) || '—',
      ]),
      statusCol: 2,
    },
  ];

  return saveTablePdf({
    title: `CLIENT REPORT — ${text(c.name) || text(c.company) || 'CLIENT'}`,
    subtitle: `${text(c.company) || 'Client'}${c.status ? `  ·  ${String(c.status).toUpperCase()}` : ''}`,
    meta,
    sections,
    summary: [
      { label: 'Projects', value: String(projects.length) },
      { label: 'Work done', value: `${done}/${work.length}` },
      { label: 'Tracker progress', value: `${pct}%` },
    ],
    footNote: 'This report lists the projects and work items recorded in the SMART ERP for this client. Money receipts and invoices are issued separately.',
    generatedBy: adminName,
    fileName: `CLIENT-REPORT-${(text(c.name) || text(c.company) || 'CLIENT').replace(/[^A-Za-z0-9]+/g, '-')}.pdf`,
  });
}

/** saveClientsRosterPdf({ clients, projectCountOf, workOf }) — every client on one sheet. */
export function saveClientsRosterPdf({ clients = [], projectCountOf = () => 0, workOf = () => [], adminName = '' }) {
  const list = (Array.isArray(clients) ? clients : []).filter(Boolean);
  const active = list.filter(c => (c.status || 'active') === 'active').length;
  const portal = list.filter(c => c.hasPortalAccount || c.authUid).length;

  return saveTablePdf({
    title: 'CLIENTS REPORT',
    subtitle: `${list.length} client${list.length === 1 ? '' : 's'} in the ERP`,
    columns: [
      { label: 'CODE', width: 12 },
      { label: 'CLIENT', width: 18, wrap: true },
      { label: 'COMPANY', width: 18, wrap: true },
      { label: 'EMAIL', width: 20, wrap: true },
      { label: 'PHONE', width: 13 },
      { label: 'SINCE', width: 10 },
      { label: 'PROJECTS', width: 8, align: 'center' },
      { label: 'WORK DONE', width: 9, align: 'center' },
      { label: 'STATUS', width: 9, align: 'center' },
    ],
    rows: list.map(c => {
      const work = workOf(c).filter(w => !w.removed);
      const done = work.filter(w => w.status === 'done').length;
      return [
        text(c.code) || '—',
        text(c.name) || '—',
        text(c.company) || '—',
        text(c.loginEmail || c.email) || '—',
        text(c.phone) || '—',
        text(c.clientSince) || dateOnly(c.createdAt) || '—',
        String(projectCountOf(c) || 0),
        work.length ? `${done}/${work.length}` : '—',
        String(c.status || 'active'),
      ];
    }),
    statusCol: 8,
    summary: [
      { label: 'Total clients', value: String(list.length) },
      { label: 'Active', value: String(active) },
      { label: 'With portal login', value: String(portal) },
    ],
    footNote: 'Counts are taken from the ERP at the moment of export. Work Done shows completed items against the client tracker.',
    generatedBy: adminName,
    fileName: 'CLIENTS-REPORT.pdf',
  });
}
