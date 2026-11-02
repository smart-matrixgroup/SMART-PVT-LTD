// ─────────────────────────────────────────────────────────────────
//  Finance module sync helpers.
//  Every payment/receipt (invoice, quotation advance/part/final,
//  client-uploaded proof) automatically becomes a financeIncome row
//  so the Finance dashboard reflects money received without double
//  counting.  The doc id is the payment id, so re-processing the same
//  payment overwrites rather than duplicates.
// ─────────────────────────────────────────────────────────────────
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export const DEV_FINANCE_INCOME = [];
export const DEV_FINANCE_EXPENSES = [];

const DEFAULT_EXPENSE_CATEGORIES = [
  'Current Bill',
  'Water Bill',
  'WiFi',
  'Maintenance',
  'Furniture',
  'Stationery',
  'Transport',
  'Food / Refreshments',
  'Other',
];

export function defaultExpenseCategories() {
  return [...DEFAULT_EXPENSE_CATEGORIES];
}

// Quantity × unit price when both are given, a lone unit price is a single-item
// buy (never silently 0), otherwise the directly typed amount.
export function expenseTotal({ quantity = 0, unitPrice = 0, amount = 0 }) {
  const q = Number(quantity) || 0;
  const u = Number(unitPrice) || 0;
  if (u > 0) return (q > 0 ? q : 1) * u;
  return Number(amount) || 0;
}

// Firestore hands back a raw code; an admin needs the reason in one line.
export const RULES_DEPLOY_CMD = 'npx firebase deploy --only firestore:rules';

export function financeErrorText(err) {
  const code = String(err?.code || '');
  const msg = String(err?.message || '');
  if (code === 'permission-denied' || /insufficient permissions/i.test(msg)) {
    return `Firestore blocked the write — the Finance rules are not deployed on this project yet. Run: ${RULES_DEPLOY_CMD}`;
  }
  if (code === 'unavailable' || /offline|network|Failed to fetch/i.test(msg)) {
    return 'No connection to Firestore right now — check the network and save again.';
  }
  if (code === 'not-found') return 'The Finance settings document is missing — reopen the page and try again.';
  return msg || 'Could not save this record.';
}

function incomeStatusLabel({ kind, balanceBefore, balanceAfter, invoiceStatus }) {
  if (kind === 'Advance') return 'Advance Paid';
  if (kind === 'Final') return 'Full Paid';
  if (kind === 'Part') return 'Balance Paid';
  if (kind === 'Invoice') {
    if (invoiceStatus === 'paid') return 'Full Paid';
    // A "Mark Paid" invoice closes itself — only a known leftover balance
    // makes it a partial payment.
    if (balanceAfter != null && balanceAfter > 0) return 'Balance Paid';
    return 'Full Paid';
  }
  return kind || 'Received';
}

function incomeSourceLabel({ kind, invoiceNo, quotationNo, clientName }) {
  if (kind === 'Invoice') {
    return invoiceNo ? `Invoice payment — ${invoiceNo}` : 'Invoice payment';
  }
  const base = kind ? `Quotation ${kind.toLowerCase()}` : 'Client payment';
  const ref = quotationNo ? ` — ${quotationNo}` : '';
  return `${base}${ref}`;
}

export function buildFinanceIncomePayload({ paymentId, payment, adminName, adminEmail }) {
  const amt = payment.amount || 0;
  const qBalanceBefore = payment.balanceBefore ?? null;
  const qBalanceAfter = payment.balanceAfter ?? null;
  const status = incomeStatusLabel({
    kind: payment.kind,
    balanceBefore: qBalanceBefore,
    balanceAfter: qBalanceAfter,
    invoiceStatus: payment.invoiceStatus,
  });
  const source = incomeSourceLabel(payment);

  return {
    type: 'auto',
    source,
    status,
    category: 'Client Payment',
    amount: amt,
    date: payment.date,
    // The payment note / invoice description carries into the remark column.
    remark: payment.notes || '',
    method: payment.method || '',
    clientId: payment.clientId || '',
    clientName: payment.clientName || 'Client',
    clientCompany: payment.clientCompany || '',
    quotationId: payment.quotationId || '',
    quotationNo: payment.quotationNo || '',
    invoiceId: payment.invoiceId || '',
    invoiceNo: payment.invoiceNo || '',
    paymentId,
    receiptNo: payment.receiptNo || '',
    kind: payment.kind || '',
    balanceBefore: qBalanceBefore,
    balanceAfter: qBalanceAfter,
    recordedBy: adminName,
    recordedByEmail: adminEmail || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

export async function syncFinanceIncome({ paymentId, payment, adminName, adminEmail, live }) {
  const payload = buildFinanceIncomePayload({ paymentId, payment, adminName, adminEmail });
  if (live) {
    // Loaded lazily so the pure payload helpers stay testable without a
    // Firebase app instance.
    const { db } = await import('../../config/firebase.js');
    await setDoc(doc(db, 'financeIncome', paymentId), payload);
  } else {
    const idx = DEV_FINANCE_INCOME.findIndex(i => i.paymentId === paymentId);
    const row = { id: paymentId, ...payload, createdAt: new Date(), updatedAt: new Date() };
    if (idx >= 0) DEV_FINANCE_INCOME[idx] = row;
    else DEV_FINANCE_INCOME.unshift(row);
  }
}
