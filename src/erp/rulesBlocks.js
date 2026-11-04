// ─────────────────────────────────────────────────────────────────
//  The security-rules checklist data — kept free of any firebase import
//  so the QA suite (plain node ESM) can read it, and Settings → Rules
//  Status can render it, without starting the app.
//
//  rulesChecklist.js adds the live probe on top of this list.
// ─────────────────────────────────────────────────────────────────

export const DEPLOY_COMMAND = 'npx firebase deploy --only firestore:rules,storage';

/**
 * coll   — Firestore collection the page listens to
 * name   — what to call it in the UI
 * page   — where the admin/staff actually uses it
 * since  — the feature that added the block (oldest first)
 */
export const RULES_BLOCKS = [
  { coll: 'clients',            name: 'Clients',                 page: 'Clients list, client portal login', since: 'first build' },
  { coll: 'projects',           name: 'Projects',                page: 'Projects, client portal tracker', since: 'first build' },
  { coll: 'staff',              name: 'Staff profiles',          page: 'Staff Management, staff portal', since: 'first build', changed: 'Rule text widened: a signed-in staff member may now confirm their own new login email. The probe passes with the OLD rule too, so deploy this even when it shows live.' },
  { coll: 'attendance',         name: 'Attendance',              page: 'Check-in/out, attendance statement', since: 'first build' },
  { coll: 'dailyUpdates',       name: 'Daily work updates',      page: 'Daily Updates, work sheets', since: 'first build' },
  { coll: 'workAssignments',    name: 'Work assignments',        page: 'Assigned Work, project staff list', since: 'first build' },
  { coll: 'quotations',         name: 'Quotations',              page: 'Quotations, client portal quotes', since: 'first build' },
  { coll: 'payments',           name: 'Payments & receipts',     page: 'Quotation payments, receipts', since: 'first build' },
  { coll: 'invoices',           name: 'Invoices',                page: 'Invoice Centre', since: 'first build' },
  { coll: 'counters',           name: 'Number counters',         page: 'Quotation / receipt / client code numbers', since: 'first build' },
  { coll: 'conversations',      name: 'Messages',                page: 'Messages (admin ↔ staff ↔ client)', since: 'first build' },
  { coll: 'leads',              name: 'Website leads',           page: 'Leads inbox', since: 'first build' },
  { coll: 'requirementForms',   name: 'Requirement forms',       page: 'Requirements, client portal forms', since: 'requirement forms' },
  { coll: 'reportRequests',     name: 'Sent daily work sheets',  page: 'Daily Updates → Send auto sheet', since: 'auto work sheet' },
  { coll: 'paymentProofs',      name: 'Advance payment proofs',  page: 'Client uploads a slip, admin verifies', since: 'advance receipt' },
  { coll: 'portfolioLinks',     name: 'Portfolio request links', page: 'Clients → Portfolio Link', since: 'portfolio links' },
  { coll: 'portfolioRequests',  name: 'Portfolio submissions',   page: 'Public form → auto client + project', since: 'portfolio links' },
  { coll: 'staffProgress',      name: 'Work Progress stages',    page: 'Staff portal → Work Progress, admin review', since: 'work stages' },
  { coll: 'financeIncome',      name: 'Finance — income',        page: 'Finance module income rows', since: 'finance module' },
  { coll: 'financeExpenses',    name: 'Finance — expenses',      page: 'Finance module expense rows', since: 'finance module' },
  { coll: 'leaves',             name: 'Leave applications',      page: 'Staff portal → Leave, admin review', since: 'leave application' },
  { coll: 'weeklyReportRuns',   name: 'Weekly report mail ledger', page: 'Daily Updates → Week end mails', since: 'weekly report mails' },
  { coll: 'reportEmailConfig',  name: 'Week end mail settings',  page: 'Daily Updates → Week end mails', since: 'weekly report mails' },
  { coll: 'offerLetters',       name: 'Offer letters',           page: 'Team → Offer Letters', since: 'offer letters' },
  { coll: 'settings',           name: 'Settings & access rules', page: 'Settings, bank details, access rules', since: 'first build' },
];

/**
 * Blocks whose rule TEXT changed rather than being newly added. A read probe
 * still passes on the older deployed rule, so these must be deployed even
 * when the row shows live — the list spells that out in the UI.
 */
export const changedBlocks = RULES_BLOCKS.filter(b => b.changed);

/**
 * Bump this string whenever a block above is rewritten (not merely added).
 * The rewritten-rule reminder is hidden only after the admin confirms they
 * ran the deploy for THIS revision, so it comes back on the next rewrite
 * instead of nagging forever after one deploy.
 */
export const RULES_REVISION = 'offer-letters-1';

/** The blocks that still need deploying, in the order they were added. */
export const pendingBlocks = results =>
  RULES_BLOCKS.filter(b => results?.[b.coll] === 'blocked' || results?.[b.coll] === 'error');
