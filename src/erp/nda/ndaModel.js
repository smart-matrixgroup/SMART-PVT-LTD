// ─────────────────────────────────────────────────────────────────
//  Non-Disclosure Agreements — the data rules.
//
//  One NDA per staff member (a second copy is possible after a role
//  change, so this is a list, not a staff field). Everything is filled
//  from the staff record when the admin picks a name, then stays
//  editable — the saved draft is the truth, not the staff record.
//
//  Pure helpers only: no React, no Firebase, so the QA suite can test
//  the wording and the numbering without a browser.
// ─────────────────────────────────────────────────────────────────
import { company } from '../../config/company.js';

export const NDA_COLLECTION = 'ndaLetters';

export const NDA_STATUSES = ['Draft', 'Issued', 'Signed', 'Declined'];

export const EMPTY_NDA = {
  staffId: '',
  staffCode: '',
  staffName: '',
  email: '',
  phone: '',
  address: '',

  refNo: '',
  date: '',
  effectiveDate: '',
  position: '',
  department: '',

  companySignatory: '',
  signerTitle: 'Managing Director',
  governingLaw: 'Sri Lanka',
  jurisdiction: 'Kalmunai',

  purpose: '',
  termYears: '3',
  opening: '',      // blank → auto-written
  clauses: [],      // blank → defaultNdaClauses()
  closing: '',      // blank → auto-written
  notes: '',

  status: 'Draft',
};

export const todayIso = (d = new Date()) => {
  const date = d instanceof Date ? d : new Date(d);
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** '2026-11-15' → '15 November 2026' (timezone-safe). */
export function prettyDate(iso) {
  if (!iso) return '';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(iso);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

const pad3 = n => String(Math.max(1, Math.round(Number(n) || 1))).padStart(3, '0');

/** SMART/HR/NDA/2026/001 */
export function makeNdaRefNo(seq, date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const year = Number.isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
  return `SMART/HR/NDA/${year}/${pad3(seq)}`;
}

/** Next sequence from the agreements already saved (refs carry the number). */
export function nextNdaSequence(list = []) {
  let max = 0;
  list.forEach(n => {
    const m = String(n?.refNo || '').match(/\/NDA\/\d{4}\/(\d+)\s*$/);
    if (m) max = Math.max(max, Number(m[1]) || 0);
  });
  return max + 1;
}

/** Every value the staff record already knows, into the agreement. */
export function ndaFromStaff(staff = {}, extra = {}) {
  return {
    ...EMPTY_NDA,
    ...extra,
    staffId: staff.id || staff.staffId || '',
    staffCode: staff.staffId || '',
    staffName: staff.name || '',
    email: staff.email || staff.loginEmail || '',
    phone: staff.phone || '',
    address: staff.address || '',
    position: staff.position || staff.role || '',
    department: staff.department || '',
    effectiveDate: staff.joinedDate || extra.date || todayIso(),
    date: extra.date || todayIso(),
    refNo: extra.refNo || '',
  };
}

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
/** 3 → 'three (3) years', 1 → 'one (1) year', 15 → '15 (15) years'. */
const yearsWord = n => {
  const y = Number(n) || 0;
  const word = NUMBER_WORDS[y] ? `${NUMBER_WORDS[y]} (${y})` : `${y} (${y})`;
  return `${word} ${y === 1 ? 'year' : 'years'}`;
};

/** The purpose sentence — what the employee may see and why. */
export function autoPurpose(form = {}) {
  const role = form.position || 'the role assigned to them';
  return `During ${form.staffName ? `${form.staffName}'s` : 'the Employee\'s'} employment as ${role}, the Employee will have access to the Company's software, client records, pricing, designs, business plans and other confidential information. This Agreement sets out how that information must be protected.`;
}

export const resolvedPurpose = form => (String(form?.purpose || '').trim() || autoPurpose(form));

/**
 * The nine standard clauses. Nothing here depends on money or dates,
 * so an edited figure elsewhere can never leave a stale sentence.
 */
export function defaultNdaClauses(form = {}) {
  const company = companyDefinedName();
  return [
    {
      title: 'Confidential Information',
      text: `"Confidential Information" means all information disclosed by or on behalf of ${company} to the Employee, in any form, including source code, databases, system designs, client lists and contacts, quotations and pricing, contracts, financial information, passwords and access keys, marketing plans, and any information marked or reasonably understood to be confidential.`,
    },
    {
      title: 'Obligations of the Employee',
      text: 'The Employee must keep all Confidential Information strictly private; use it only for the performance of their duties; not copy, photograph, transmit or store it outside the Company\'s systems without written approval; and not disclose it to any person, including other staff, unless that person needs it for the same purpose.',
    },
    {
      title: 'Exclusions',
      text: 'Confidential Information does not include information that is already public without breach of this Agreement, was lawfully known to the Employee before joining the Company, or is independently developed by the Employee without using Confidential Information.',
    },
    {
      title: 'Return of Materials',
      text: 'On the last working day, or earlier if requested, the Employee must return every device, document, storage medium and access key belonging to the Company, and must not keep copies in personal email, cloud drives, phones or portable storage.',
    },
    {
      title: 'Intellectual Property',
      text: `All software, code, designs, documents and work products created by the Employee in the course of employment belong exclusively to ${company}. The Employee assigns all such rights to the Company and will sign any document needed to record that assignment.`,
    },
    {
      title: 'Client and Staff Non-Solicitation',
      text: `During employment and for ${yearsWord(form.termYears)} afterwards, the Employee must not directly or indirectly solicit any client or staff member of ${company} for a competing business, or encourage any of them to end their relationship with the Company.`,
    },
    {
      title: 'Term',
      text: `This Agreement starts on the effective date and continues during employment. The obligations of confidentiality and non-solicitation survive the end of employment and remain in force for ${yearsWord(form.termYears)} from the last working day.`,
    },
    {
      title: 'Remedies',
      text: 'The Employee acknowledges that a breach may cause loss that money cannot fully repair, and that the Company may seek an injunction, damages and any other remedy available in law in addition to disciplinary action and termination of employment.',
    },
    {
      title: 'Governing Law',
      text: `This Agreement is governed by the laws of ${form.governingLaw || 'Sri Lanka'}, and the courts of ${form.jurisdiction || 'Kalmunai'} have exclusive jurisdiction over any dispute arising from it.`,
    },
  ];
}

export const resolvedClauses = form => (Array.isArray(form?.clauses) && form.clauses.length
  ? form.clauses
  : defaultNdaClauses(form));

export function autoOpening(form = {}) {
  const company = companyDefinedName();
  const name = form.staffName || 'the Employee';
  return `THIS NON-DISCLOSURE AGREEMENT is made on ${prettyDate(form.date) || 'the date below'} between ${company}, of its registered office (the "Company"), and ${name}${form.position ? `, ${form.position}` : ''} (the "Employee").`;
}

export function autoClosing(form = {}) {
  return `IN WITNESS WHEREOF, the parties have read and understood this Agreement and sign it voluntarily on the date first written above.\n\nFor and on behalf of ${companyDefinedName()}`;
}

export const resolvedOpening = form => (String(form?.opening || '').trim() || autoOpening(form));
export const resolvedClosing = form => (String(form?.closing || '').trim() || autoClosing(form));

/** '' when the agreement is complete, else the one thing still missing. */
export function ndaProblem(form = {}) {
  if (!String(form.staffName || '').trim()) return 'Choose the staff member this agreement is for.';
  if (!String(form.position || '').trim()) return 'Enter the staff member\'s position.';
  if (!String(form.date || '').trim()) return 'Enter the date of the agreement.';
  if (!String(form.effectiveDate || '').trim()) return 'Enter the effective date.';
  if (!(Number(form.termYears) > 0)) return 'Enter how many years the confidentiality lasts.';
  return '';
}

export const ndaSummary = form => {
  const y = Number(form?.termYears) || 0;
  return y ? `Confidential for ${y} year${y === 1 ? '' : 's'} after leaving` : 'Term not set';
};

/** Append-only history for the fields people later argue about. */
export function diffNda(prev, next, by = '') {
  const watched = [
    ['position', 'Position'], ['effectiveDate', 'Effective date'],
    ['termYears', 'Confidentiality term'], ['status', 'Status'],
  ];
  const entries = [];
  watched.forEach(([key, label]) => {
    const before = String(prev?.[key] ?? '');
    const after = String(next?.[key] ?? '');
    if (before !== after) entries.push({ field: label, from: before, to: after, by, at: Date.now() });
  });
  return entries;
}

/** Prefer the plain legal-looking name over the bracketed brand mark. */
function companyDefinedName() {
  return company.fullName || company.name || 'SMART (Pvt) Ltd';
}
