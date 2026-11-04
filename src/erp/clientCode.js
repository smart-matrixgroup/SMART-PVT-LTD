// ─────────────────────────────────────────────────────────────────
//  Client code series — the number the office writes on every file.
//
//  Two series run side by side, exactly as the office keeps them:
//      Individual / person  →  SM/2026/111, SM/2026/112, …
//      Company              →  SM/2026/1111, SM/2026/1112, …
//
//  The number is never typed and never repeated. Two things guard it:
//   1. a transactional counter document (counters/clientIndividual,
//      counters/clientCompany) so two admins adding clients at the same
//      moment cannot both take the same number;
//   2. a scan of the codes already on the client list, which covers the
//      counter being missing/reset and old hand-written numbers.
//  The next value is therefore max(counter, highest code in use, the
//  series starting number − 1) + 1.
// ─────────────────────────────────────────────────────────────────
import { doc, runTransaction } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase.js';
import { toInt } from './money.js';

export const CODE_PREFIX = 'SM';

/** The two series, in the order the form shows them. */
export const CLIENT_KINDS = [
  { value: 'individual', label: 'Individual / Person' },
  { value: 'company',    label: 'Company' },
];

/** Where each series begins — the office already used 001–110 by hand. */
export const CODE_START = { individual: 111, company: 1111 };

/** counters/{…} document holding the last issued number of a series. */
export const CODE_COUNTER = { individual: 'clientIndividual', company: 'clientCompany' };

export const currentCodeYear = (d = new Date()) => d.getFullYear();

/** Format a number the way the office writes it. */
export const makeClientCode = (kind, num, year = currentCodeYear()) =>
  `${CODE_PREFIX}/${year}/${num}`;

/** Highest number already taken this year, across BOTH series (a person
 *  must never land on a number a company already holds). */
export function highestCodeInUse(clients, year = currentCodeYear()) {
  return (clients || []).reduce((hi, c) => {
    const code = typeof c === 'string' ? c : (c?.code || c?.clientCode);
    const m = String(code || '').trim().match(/^SM\/(\d{4})\/(\d+)$/i);
    if (!m || toInt(m[1]) !== toInt(year)) return hi;
    return Math.max(hi, toInt(m[2]));
  }, 0);
}

/** The number the NEXT client of this series will get — pure, so the form
 *  can show it before anything is saved. */
export function nextClientCodeValue(kind, clients, year = currentCodeYear(), counterValue = 0) {
  const start = CODE_START[kind] ?? CODE_START.individual;
  const floor = Math.max(start - 1, highestCodeInUse(clients, year));
  return Math.max(toInt(counterValue), floor) + 1;
}

/** Live preview text for the Add Client form. */
export const previewClientCode = (kind, clients, year = currentCodeYear()) =>
  makeClientCode(kind, nextClientCodeValue(kind, clients, year), year);

/**
 * Take the next number of a series and remember it.
 * `clients` is the current client list (their codes) — no extra read.
 * Throws nothing: without Firebase (dev session) or when the counter
 * write fails, the code still comes from the scanned list.
 */
export async function allocateClientCode(kind, clients, year = currentCodeYear()) {
  const fromList = nextClientCodeValue(kind, clients, year);
  if (!isFirebaseConfigured) return makeClientCode(kind, fromList, year);

  const counterName = CODE_COUNTER[kind] ?? CODE_COUNTER.individual;
  try {
    const counterRef = doc(db, 'counters', counterName);
    const val = await runTransaction(db, async (tx) => {
      const snap = await tx.get(counterRef);
      // The list scan decides the floor, the stored counter breaks a tie —
      // whichever is higher wins, so a used number is never handed out twice.
      const next = Math.max(toInt(snap?.data()?.value), fromList - 1) + 1;
      tx.set(counterRef, { value: next, updatedAt: new Date() });
      return next;
    });
    return makeClientCode(kind, val, year);
  } catch (err) {
    console.error('client code counter failed', err);
    return makeClientCode(kind, fromList, year);
  }
}
