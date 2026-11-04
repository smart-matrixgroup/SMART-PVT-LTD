// ─────────────────────────────────────────────────────────────────
//  Job offer letters — the data rules.
//
//  One offer letter per staff member (but the same person can get a new
//  letter after a promotion, so it is a list, not a staff field). The
//  letter is filled from the staff record the moment the admin picks a
//  name, then every value stays editable — the stored draft is the truth,
//  not the staff record.
//
//  Pure text/number helpers only, so the QA suite can test them without
//  React or Firebase.
// ─────────────────────────────────────────────────────────────────

import { company } from '../../config/company.js';

export const OFFER_COLLECTION = 'offerLetters';

export const OFFER_STATUSES = ['Draft', 'Issued', 'Accepted', 'Declined'];

export const EMPLOYMENT_TYPES = ['Permanent', 'Contract', 'Internship', 'Trainee', 'Probation'];
export const EMPLOYMENT_KINDS = ['Full-time', 'Part-time', 'Remote', 'Hybrid'];

export const EMPTY_OFFER = {
  staffId: '',
  staffCode: '',
  staffName: '',
  email: '',
  phone: '',
  address: '',

  refNo: '',
  date: '',
  position: '',
  department: '',
  employmentType: 'Permanent',
  employmentKind: 'Full-time',
  startDate: '',
  probationMonths: '3',
  location: 'Kalmunai, Sri Lanka',
  reportingTo: 'Managing Director',

  basicSalary: '',
  allowances: '',
  deductions: '',
  payFrequency: 'Monthly',

  subject: 'Letter of Appointment',
  opening: '',      // blank → auto-written from the fields above
  closing: '',      // blank → auto-written
  terms: [],        // blank → defaultTerms()
  notes: '',

  status: 'Draft',
};

export const money = n => {
  const v = Number(String(n ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(v) ? v : 0;
};

/** Basic + allowances − deductions, floored at 0. */
export const netSalary = form => Math.max(
  0,
  money(form?.basicSalary) + money(form?.allowances) - money(form?.deductions),
);

/** 105000 → "One Hundred and Five Thousand Rupees Only". */
export function amountInWords(amount) {
  const total = Math.round(money(amount) * 100) / 100;
  if (!Number.isFinite(total) || total <= 0) return '';
  const rupees = Math.floor(total);
  const cents = Math.round((total - rupees) * 100);

  const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'];
  const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const under1000 = n => {
    let out = '';
    if (n >= 100) {
      out += `${ONES[Math.floor(n / 100)]} Hundred`;
      n %= 100;
      if (n) out += ' and ';
    }
    if (n >= 20) {
      out += TENS[Math.floor(n / 10)];
      if (n % 10) out += `-${ONES[n % 10]}`;
    } else if (n > 0) {
      out += ONES[n];
    }
    return out;
  };

  const groups = [[1e9, 'Billion'], [1e6, 'Million'], [1e3, 'Thousand']];
  let rest = rupees;
  const parts = [];
  groups.forEach(([size, name]) => {
    const q = Math.floor(rest / size);
    if (q) { parts.push(`${under1000(q)} ${name}`); rest %= size; }
  });
  if (rest) parts.push(under1000(rest));
  const body = parts.join(' ') || 'Zero';

  return `${body} Rupees${cents ? ` and ${under1000(cents)} Cents` : ''} Only`;
}

const pad3 = n => String(Math.max(1, Math.round(Number(n) || 1))).padStart(3, '0');

/** SMART/HR/OL/2026/001 — readable on paper, unique per sequence number. */
export function makeRefNo(seq, date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const year = Number.isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
  return `SMART/HR/OL/${year}/${pad3(seq)}`;
}

/** Next sequence from the letters already saved (refs carry the number). */
export function nextSequence(offers = []) {
  let max = 0;
  offers.forEach(o => {
    const m = String(o?.refNo || '').match(/\/OL\/\d{4}\/(\d+)\s*$/);
    if (m) max = Math.max(max, Number(m[1]) || 0);
  });
  return max + 1;
}

export const todayIso = (d = new Date()) => {
  const date = d instanceof Date ? d : new Date(d);
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** '2026-11-15' → '15 November 2026' (never shifted by the timezone). */
export function prettyDate(iso) {
  if (!iso) return '';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(iso);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** Take every value the staff record already knows into the letter. */
export function offerFromStaff(staff = {}, extra = {}) {
  const name = staff.name || '';
  return {
    ...EMPTY_OFFER,
    ...extra,
    staffId: staff.id || staff.staffId || '',
    staffCode: staff.staffId || '',
    staffName: name,
    email: staff.email || staff.loginEmail || '',
    phone: staff.phone || '',
    address: staff.address || '',
    position: staff.position || staff.role || '',
    department: staff.department || '',
    startDate: staff.joinedDate || extra.date || todayIso(),
    basicSalary: staff.basicSalary != null ? String(staff.basicSalary) : '',
    allowances: staff.allowances != null ? String(staff.allowances) : '',
    deductions: staff.deductions != null ? String(staff.deductions) : '',
    refNo: extra.refNo || '',
    date: extra.date || todayIso(),
  };
}

/**
 * The six commitments SMART puts in every letter. Money is NOT in here —
 * it is read live from the salary fields, so changing the offer cannot
 * leave a stale figure in a saved bullet.
 */
export function defaultTerms(form = {}) {
  const probation = Math.max(0, Math.round(Number(form.probationMonths) || 0));
  return [
    {
      title: 'Probation and confirmation',
      text: probation
        ? `Your first ${probation} month${probation === 1 ? '' : 's'} in service will be treated as a probationary period. Confirmation will follow a performance review, and either party may end the appointment during probation by giving one week's written notice.`
        : 'Your appointment takes effect on the date of joining shown above, subject to a performance review at the end of the first three months.',
    },
    {
      title: 'Working hours and place of work',
      text: `Your normal place of work is ${form.location || 'the company office'}. Working hours follow the company's standard schedule and may be adjusted by management where client delivery requires it.`,
    },
    {
      title: 'Remuneration',
      text: 'Your salary is paid monthly to the bank account you provide. Statutory contributions (EPF and ETF) are deducted and remitted as required by law, and any allowance shown above is paid with your monthly salary.',
    },
    {
      title: 'Leave',
      text: 'You are entitled to annual, casual and sick leave in line with company policy and the applicable labour law. Leave must be applied for in advance through the staff portal and approved by your reporting officer.',
    },
    {
      title: 'Confidentiality and company property',
      text: 'Client information, source code, pricing, passwords and internal documents are confidential. You must not copy, share or remove them during or after your employment, and all company property issued to you must be returned on your last working day.',
    },
    {
      title: 'Code of conduct and dual employment',
      text: 'You will follow the company code of conduct and may not take up any other paid employment or freelance work without written approval, as this may conflict with your duties to SMART.',
    },
    {
      title: 'Termination',
      text: 'After confirmation, either party may end this appointment by giving one month\'s written notice or salary in lieu of notice. The company may dismiss an employee without notice for misconduct or a serious breach of policy, after a fair inquiry.',
    },
  ];
}

/** The standard paragraphs — used whenever the admin has not typed their own. */
export function autoOpening(form = {}) {
  const name = form.staffName || 'Candidate';
  const position = form.position || 'the position discussed';
  const dept = form.department ? ` in the ${form.department} Department` : '';
  const place = form.location ? ` at our office in ${form.location}` : '';
  return `Dear ${name},\n\nWith reference to your application and the interview held with our management, we are pleased to offer you the post of ${position}${dept} at ${company.name}${place}. Your appointment is subject to the terms set out below.`;
}

export function autoClosing(form = {}) {
  const name = form.staffName ? form.staffName.split(' ')[0] : 'you';
  return `We look forward to welcoming ${name} to the team and to a long, productive working relationship. Please sign and return the duplicate copy of this letter to confirm your acceptance.\n\nYours sincerely,\nFor ${company.name}`;
}

export const resolvedOpening = form => (String(form?.opening || '').trim() || autoOpening(form));
export const resolvedClosing = form => (String(form?.closing || '').trim() || autoClosing(form));
export const resolvedTerms = form => (Array.isArray(form?.terms) && form.terms.length
  ? form.terms
  : defaultTerms(form));

/** Returns '' when the letter is complete, else the one thing still missing. */
export function offerProblem(form = {}) {
  if (!String(form.staffName || '').trim()) return 'Choose the staff member this letter is for.';
  if (!String(form.position || '').trim()) return 'Enter the job title being offered.';
  if (!String(form.date || '').trim()) return 'Enter the date on the letter.';
  if (!String(form.startDate || '').trim()) return 'Enter the date of joining.';
  if (money(form.basicSalary) <= 0) return 'Enter the basic salary.';
  if (money(form.deductions) > money(form.basicSalary) + money(form.allowances)) {
    return 'Deductions are larger than the salary — check the figures.';
  }
  return '';
}

/** The salary table rows shown in the letter and in the preview. */
export const salaryRows = form => ([
  { label: 'Basic salary', value: money(form.basicSalary) },
  { label: 'Allowances', value: money(form.allowances) },
  { label: 'Deductions', value: -money(form.deductions) },
  { label: 'Net monthly salary', value: netSalary(form), strong: true },
].filter(r => r.label === 'Net monthly salary' || r.value !== 0));

/** Short one-line summary for the list row. */
export const offerSummary = form => {
  const net = netSalary(form);
  return net ? `LKR ${net.toLocaleString('en-LK')} / month` : 'Salary not set';
};

/**
 * Append-only history. Money and dates are the values people later argue
 * about, so any edit records who changed what, keeping the old value.
 */
export function diffOffer(prev, next, by = '') {
  const watched = [
    ['basicSalary', 'Basic salary'], ['allowances', 'Allowances'],
    ['deductions', 'Deductions'], ['position', 'Job title'],
    ['startDate', 'Date of joining'], ['status', 'Status'],
  ];
  const entries = [];
  watched.forEach(([key, label]) => {
    const before = String(prev?.[key] ?? '');
    const after = String(next?.[key] ?? '');
    if (before !== after) entries.push({ field: label, from: before, to: after, by, at: Date.now() });
  });
  return entries;
}
