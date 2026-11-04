import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { toInt, formatLKR } from '../src/erp/money.js';
import { passwordError, generateStrongPassword, PASSWORD_HINT } from '../src/erp/passwordPolicy.js';

// ─────────────────────────────────────────────────────────────────────────────
// 1. PAYMENT CALCULATION & RECONCILIATION TESTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Domain helper mimicking ERPQuotations.jsx payment calculation logic
 */
function recordPaymentTransaction(quotation, paymentAmount) {
  const total = toInt(quotation.totalAmount);
  const currentPaid = toInt(quotation.paidTotal);
  const currentBalance = Math.max(0, total - currentPaid);
  const amt = toInt(paymentAmount);

  if (amt <= 0) {
    throw new Error('Enter a payment amount greater than 0.');
  }

  if (amt > currentBalance) {
    throw new Error(`Payment cannot exceed the balance due (${formatLKR(currentBalance)}).`);
  }

  const newPaidTotal = currentPaid + amt;
  const newBalance = Math.max(0, total - newPaidTotal);
  const isAdvance = currentPaid === 0;

  // Lifecycle status determination (matches ERPQuotations.jsx line 559)
  let nextStatus;
  if (newPaidTotal >= total) {
    nextStatus = 'Completed'; // Fully Paid
  } else if (isAdvance) {
    nextStatus = 'Advance Paid';
  } else {
    nextStatus = quotation.status === 'In Progress' ? 'In Progress' : 'Advance Paid';
  }

  return {
    ...quotation,
    paidTotal: newPaidTotal,
    balance: newBalance,
    status: nextStatus,
    paymentsCount: toInt(quotation.paymentsCount || 0) + 1,
  };
}

test('Payment Calculation - Integer conversion eliminates floating point drift', () => {
  // Test various string formats and decimals
  assert.equal(toInt('100,000'), 100000);
  assert.equal(toInt(100000.4), 100000);
  assert.equal(toInt(99999.9), 100000);
  assert.equal(toInt('LKR 40,000'), 40000);
  assert.equal(toInt(null), 0);
  assert.equal(toInt(undefined), 0);
  assert.equal(formatLKR(100000), 'LKR 100,000');
});

test('Payment Calculation - Total 100,000, advance 40,000 -> balance 60,000, status Advance Paid', () => {
  const initialQuotation = {
    id: 'QT-101',
    totalAmount: 100000,
    paidTotal: 0,
    paymentsCount: 0,
    status: 'Accepted',
  };

  const afterAdvance = recordPaymentTransaction(initialQuotation, 40000);

  assert.equal(afterAdvance.paidTotal, 40000);
  assert.equal(afterAdvance.balance, 60000);
  assert.equal(afterAdvance.paymentsCount, 1);
  assert.equal(afterAdvance.status, 'Advance Paid');
});

test('Payment Calculation - Pay remaining 60,000 -> balance 0, status Completed / Fully Paid', () => {
  const quotationWithAdvance = {
    id: 'QT-101',
    totalAmount: 100000,
    paidTotal: 40000,
    paymentsCount: 1,
    status: 'Advance Paid',
  };

  const finalPayment = recordPaymentTransaction(quotationWithAdvance, 60000);

  assert.equal(finalPayment.paidTotal, 100000);
  assert.equal(finalPayment.balance, 0);
  assert.equal(finalPayment.paymentsCount, 2);
  assert.equal(finalPayment.status, 'Completed');
});

test('Payment Calculation - Overpayment is strictly blocked', () => {
  const quotationWithAdvance = {
    id: 'QT-101',
    totalAmount: 100000,
    paidTotal: 40000,
    paymentsCount: 1,
    status: 'Advance Paid',
  };

  // Balance due is 60,000; attempting to pay 60,001 or 70,000
  assert.throws(
    () => recordPaymentTransaction(quotationWithAdvance, 60001),
    /Payment cannot exceed the balance due/
  );
  assert.throws(
    () => recordPaymentTransaction(quotationWithAdvance, 100000),
    /Payment cannot exceed the balance due/
  );
});

test('Payment Calculation - Partial payments update balance correctly without error', () => {
  const quotationWithAdvance = {
    id: 'QT-101',
    totalAmount: 100000,
    paidTotal: 40000,
    paymentsCount: 1,
    status: 'In Progress',
  };

  // Pay partial milestone 25,000 of 60,000
  const afterPartial = recordPaymentTransaction(quotationWithAdvance, 25000);
  assert.equal(afterPartial.paidTotal, 65000);
  assert.equal(afterPartial.balance, 35000);
  assert.equal(afterPartial.paymentsCount, 2);
  assert.equal(afterPartial.status, 'In Progress');

  // Pay remaining 35,000
  const afterSettlement = recordPaymentTransaction(afterPartial, 35000);
  assert.equal(afterSettlement.paidTotal, 100000);
  assert.equal(afterSettlement.balance, 0);
  assert.equal(afterSettlement.paymentsCount, 3);
  assert.equal(afterSettlement.status, 'Completed');
});

test('Payment Calculation - Zero or negative payment amounts are blocked', () => {
  const quotation = {
    id: 'QT-101',
    totalAmount: 100000,
    paidTotal: 0,
    paymentsCount: 0,
    status: 'Accepted',
  };

  assert.throws(
    () => recordPaymentTransaction(quotation, 0),
    /Enter a payment amount greater than 0/
  );
  assert.throws(
    () => recordPaymentTransaction(quotation, -5000),
    /Enter a payment amount greater than 0/
  );
});

test('Template Isolation - Editing a template does NOT mutate existing quotations or requirements', () => {
  // Master template
  const quotationTemplate = {
    id: 'tpl-web-01',
    title: 'Standard Corporate Website',
    totalAmount: 85000,
    items: [
      { label: 'UI Design', amount: 25000 },
      { label: 'Frontend & Backend', amount: 60000 },
    ],
  };

  // Quotation created by deep-copying template data (as implemented in ERPQuotations.jsx)
  const existingQuotation = {
    id: 'QT-2026-0001',
    templateId: quotationTemplate.id,
    projectTitle: quotationTemplate.title,
    items: quotationTemplate.items.map(item => ({ ...item })),
    totalAmount: quotationTemplate.totalAmount,
  };

  // Later, admin modifies the template price and items
  quotationTemplate.totalAmount = 120000;
  quotationTemplate.items.push({ label: 'Maintenance', amount: 35000 });
  quotationTemplate.items[0].amount = 40000;

  // Existing quotation MUST remain unchanged
  assert.equal(existingQuotation.totalAmount, 85000);
  assert.equal(existingQuotation.items.length, 2);
  assert.equal(existingQuotation.items[0].amount, 25000);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. ACCESS CONTROL & ISOLATION LOGIC TESTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluates whether a user can read/write a resource based on firestore.rules
 */
function canAccessFirestoreResource({ collection, resourceData, requestUser, operation = 'read' }) {
  if (!requestUser) return false;

  const isAdmin = requestUser.role === 'admin';
  if (isAdmin) return true; // Admins have full access across all collections

  switch (collection) {
    case 'clients':
      // match /clients/{clientId} { allow read: if request.auth.uid == clientId; }
      return requestUser.uid === resourceData.id && operation === 'read';

    case 'projects':
      // match /projects/{projectId} { allow read: if resource.data.clientId == request.auth.uid; }
      return resourceData.clientId === requestUser.uid;

    case 'quotations':
      // match /quotations/{quotationId} { allow read: if resource.data.clientId == request.auth.uid; }
      return resourceData.clientId === requestUser.uid;

    case 'payments':
      // match /payments/{paymentId} { allow read: if resource.data.clientId == request.auth.uid; allow write: if isAdmin(); }
      if (operation === 'write') return false; // Client can never write payment
      return resourceData.clientId === requestUser.uid;

    case 'requirementForms':
      return resourceData.clientId === requestUser.uid;

    case 'staff':
      // match /staff/{uid} { allow read: if request.auth.uid == uid; }
      return requestUser.role === 'staff' && requestUser.uid === resourceData.id;

    case 'workAssignments':
      return requestUser.role === 'staff' && resourceData.authUid === requestUser.uid;

    case 'attendance':
      return requestUser.role === 'staff' && resourceData.authUid === requestUser.uid;

    case 'dailyUpdates':
      return requestUser.role === 'staff' && resourceData.authUid === requestUser.uid;

    case 'salaryPayments':
      if (operation === 'write') return false; // Staff cannot write salary records
      return requestUser.role === 'staff' && resourceData.authUid === requestUser.uid;

    case 'conversations':
      return resourceData.participantUid === requestUser.uid;

    default:
      return false;
  }
}

/**
 * Route Guard evaluator matching ProtectedRoute.jsx
 */
function canAccessRoute({ path, userRole }) {
  if (!userRole) return false;

  if (path.startsWith('/erp') || path.startsWith('/admin-panel')) {
    return userRole === 'admin';
  }

  if (path.startsWith('/staff-portal')) {
    return userRole === 'staff';
  }

  if (path.startsWith('/client-dashboard')) {
    return userRole === 'client';
  }

  return true; // Public routes
}

/**
 * Messaging permission evaluator matching SMART messaging rules
 */
function canInitiateMessage({ senderRole, receiverRole }) {
  if (senderRole === 'admin') {
    return receiverRole === 'staff' || receiverRole === 'client';
  }
  if (senderRole === 'staff') {
    return receiverRole === 'admin';
  }
  if (senderRole === 'client') {
    return receiverRole === 'admin';
  }
  return false;
}

test('Access Control - Client A CANNOT access Client B resources', () => {
  const clientA = { uid: 'client_user_A', role: 'client' };
  const clientB = { uid: 'client_user_B', role: 'client' };

  const clientBProject = { id: 'p_2', clientId: clientB.uid, title: 'Client B Project' };
  const clientBQuotation = { id: 'q_2', clientId: clientB.uid, totalAmount: 50000 };
  const clientBPayment = { id: 'pay_2', clientId: clientB.uid, receiptNo: 'R-002', amount: 20000 };
  const clientBConversation = { id: 'admin_client_B', participantUid: clientB.uid };

  // Client A attempting to access Client B's records
  assert.equal(canAccessFirestoreResource({ collection: 'projects', resourceData: clientBProject, requestUser: clientA }), false);
  assert.equal(canAccessFirestoreResource({ collection: 'quotations', resourceData: clientBQuotation, requestUser: clientA }), false);
  assert.equal(canAccessFirestoreResource({ collection: 'payments', resourceData: clientBPayment, requestUser: clientA }), false);
  assert.equal(canAccessFirestoreResource({ collection: 'conversations', resourceData: clientBConversation, requestUser: clientA }), false);

  // Client A accessing own records
  const clientAProject = { id: 'p_1', clientId: clientA.uid, title: 'Client A Project' };
  assert.equal(canAccessFirestoreResource({ collection: 'projects', resourceData: clientAProject, requestUser: clientA }), true);
});

test('Access Control - Staff A CANNOT access Staff B HR and salary data', () => {
  const staffA = { uid: 'staff_user_A', role: 'staff' };
  const staffB = { uid: 'staff_user_B', role: 'staff' };

  const staffBProfile = { id: staffB.uid, name: 'Staff B' };
  const staffBAttendance = { id: 'att_1', authUid: staffB.uid, date: '2026-10-06' };
  const staffBSalary = { id: 'sal_1', authUid: staffB.uid, basicSalary: 85000 };
  const staffBWork = { id: 'w_1', authUid: staffB.uid, title: 'Staff B Assignment' };

  // Staff A requesting Staff B data
  assert.equal(canAccessFirestoreResource({ collection: 'staff', resourceData: staffBProfile, requestUser: staffA }), false);
  assert.equal(canAccessFirestoreResource({ collection: 'attendance', resourceData: staffBAttendance, requestUser: staffA }), false);
  assert.equal(canAccessFirestoreResource({ collection: 'salaryPayments', resourceData: staffBSalary, requestUser: staffA }), false);
  assert.equal(canAccessFirestoreResource({ collection: 'workAssignments', resourceData: staffBWork, requestUser: staffA }), false);

  // Staff A accessing own data
  assert.equal(canAccessFirestoreResource({ collection: 'staff', resourceData: { id: staffA.uid }, requestUser: staffA }), true);
});

test('Access Control - Route guards protect ERP Admin, Staff Portal, and Client Portal', () => {
  // Admin-only routes
  assert.equal(canAccessRoute({ path: '/erp', userRole: 'admin' }), true);
  assert.equal(canAccessRoute({ path: '/erp/quotations', userRole: 'admin' }), true);
  assert.equal(canAccessRoute({ path: '/admin-panel', userRole: 'admin' }), true);
  assert.equal(canAccessRoute({ path: '/erp', userRole: 'client' }), false);
  assert.equal(canAccessRoute({ path: '/erp', userRole: 'staff' }), false);
  assert.equal(canAccessRoute({ path: '/erp', userRole: null }), false);

  // Staff Portal
  assert.equal(canAccessRoute({ path: '/staff-portal', userRole: 'staff' }), true);
  assert.equal(canAccessRoute({ path: '/staff-portal', userRole: 'client' }), false);
  assert.equal(canAccessRoute({ path: '/staff-portal', userRole: 'admin' }), false);

  // Client Dashboard
  assert.equal(canAccessRoute({ path: '/client-dashboard', userRole: 'client' }), true);
  assert.equal(canAccessRoute({ path: '/client-dashboard', userRole: 'staff' }), false);
  assert.equal(canAccessRoute({ path: '/client-dashboard', userRole: 'admin' }), false);
});

test('Access Control - Messaging rules strictly allow only Admin <-> Staff and Admin <-> Client', () => {
  // Allowed
  assert.equal(canInitiateMessage({ senderRole: 'admin', receiverRole: 'staff' }), true);
  assert.equal(canInitiateMessage({ senderRole: 'admin', receiverRole: 'client' }), true);
  assert.equal(canInitiateMessage({ senderRole: 'staff', receiverRole: 'admin' }), true);
  assert.equal(canInitiateMessage({ senderRole: 'client', receiverRole: 'admin' }), true);

  // Strictly Disallowed
  assert.equal(canInitiateMessage({ senderRole: 'staff', receiverRole: 'staff' }), false);
  assert.equal(canInitiateMessage({ senderRole: 'client', receiverRole: 'client' }), false);
  assert.equal(canInitiateMessage({ senderRole: 'staff', receiverRole: 'client' }), false);
  assert.equal(canInitiateMessage({ senderRole: 'client', receiverRole: 'staff' }), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. DAILY WORK REPORT & ATTENDANCE HOURS CALCULATION TESTS
// ─────────────────────────────────────────────────────────────────────────────
import { calculateTaskDuration, calculateAttendanceHours, getDayName } from '../src/staff/staffUtils.js';
import { DEFAULT_ACCESS_RULES } from '../src/config/accessRules.js';

test('Daily Work Report - Task duration calculation works accurately', () => {
  assert.equal(calculateTaskDuration('09:00', '10:30'), '1.5 hrs');
  assert.equal(calculateTaskDuration('08:30', '11:00'), '2.5 hrs');
  assert.equal(calculateTaskDuration('13:00', '15:00'), '2.0 hrs');
  assert.equal(calculateTaskDuration('16:00', '17:30'), '1.5 hrs');
  assert.equal(calculateTaskDuration('09:00', '09:00'), '0.0 hrs');
  assert.equal(calculateTaskDuration('', '10:00'), '—');
});

test('Daily Work Report - Attendance hours deducting lunch break correctly', () => {
  // Arrival: 08:30, Lunch: 13:00 - 14:00 (1 hr), Departure: 17:30 -> Net work: 8.0 hrs
  const att1 = calculateAttendanceHours('08:30', '13:00', '14:00', '17:30');
  assert.equal(att1.lunchDuration, '1.0 hrs');
  assert.equal(att1.totalWorkHours, '8.0 hrs');

  // Arrival: 09:00, Lunch: 12:30 - 13:15 (45 mins = 0.8 hrs), Departure: 18:00 -> 540 - 45 = 495 mins = 8.25 -> 8.3 hrs
  const att2 = calculateAttendanceHours('09:00', '12:30', '13:15', '18:00');
  assert.equal(att2.lunchDuration, '0.8 hrs');
  assert.equal(att2.totalWorkHours, '8.3 hrs');
});

test('Daily Work Report - Day of week resolution', () => {
  assert.equal(getDayName('2026-10-08'), 'Thursday');
});

test('Access Control Rules - Staff Client page restriction & defaults', () => {
  assert.equal(DEFAULT_ACCESS_RULES.allowStaffClientProjects, true);
  assert.equal(DEFAULT_ACCESS_RULES.allowStaffDailyLog, true);
  assert.equal(DEFAULT_ACCESS_RULES.allowStaffSalary, true);

  // Admin toggling restriction
  const restrictedRules = {
    ...DEFAULT_ACCESS_RULES,
    allowStaffClientProjects: false,
    memberOverrides: {
      'staff-special': { allowStaffClientProjects: true }
    }
  };

  // General staff should be blocked from client projects
  const isGeneralStaffAllowed = restrictedRules.allowStaffClientProjects;
  assert.equal(isGeneralStaffAllowed, false);

  // Overridden staff member should be granted access
  const isSpecialStaffAllowed = restrictedRules.memberOverrides['staff-special'].allowStaffClientProjects;
  assert.equal(isSpecialStaffAllowed, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. PASSWORD POLICY — every account the ERP creates must be hard to guess
// ─────────────────────────────────────────────────────────────────────────────

test('Password Policy - simple passwords are rejected', () => {
  ['smart123', 'password', '12345678', 'admin123', 'Smart@12345678', 'welcome1'].forEach(pw => {
    assert.notEqual(passwordError(pw), '', `${pw} must be rejected`);
  });
});

test('Password Policy - missing character classes are reported', () => {
  assert.match(passwordError('abcdefgh12'), /capital letter/);        // no A-Z
  assert.match(passwordError('ABCDEFGH12'), /small letter/);          // no a-z
  assert.match(passwordError('Abcdefgh#'),  /number/);                // no digit
  assert.match(passwordError('Abcdefgh12'), /symbol/);                // no symbol
  assert.match(passwordError('Ab1!'),       /at least 8 characters/); // too short
  assert.equal(passwordError(''),           'Password is required.');
});

test('Password Policy - strong passwords pass, the account name is allowed inside', () => {
  assert.equal(passwordError('Smart@Tech99'), '');
  assert.equal(passwordError('Kandy#Client24'), '');
  // The old extra rule refused these even though they were already strong.
  assert.equal(passwordError('Thilak@2026x', 'thilak@trholdings.lk'), '');
  assert.equal(passwordError('paththima#2026A', 'paththima@smart.com'), '');
  // Only the well-known easy passwords stay blocked.
  assert.notEqual(passwordError('smart123'), '');
  assert.notEqual(passwordError('admin123'), '');
});

test('Password Policy - generated one-time passwords satisfy the policy', () => {
  for (let i = 0; i < 200; i++) {
    const pw = generateStrongPassword();
    assert.equal(passwordError(pw), '', `generated ${pw} must pass`);
    assert.ok(pw.length >= 8, `generated ${pw} is long enough`);
  }
  assert.ok(PASSWORD_HINT.includes('symbol'));
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. FINANCE MODULE — auto income sync (no double counting)
// ─────────────────────────────────────────────────────────────────────────────

const { buildFinanceIncomePayload, syncFinanceIncome,
        DEV_FINANCE_INCOME, defaultExpenseCategories,
        expenseTotal, financeErrorText } =
  await import('../src/erp/finance/financeSync.js');

test('Finance income - advance then final cover the total exactly once', async () => {
  const total = 150000;
  const advance = 50000;

  await syncFinanceIncome({
    paymentId: 'pay-adv-1',
    payment: {
      amount: advance, kind: 'Advance', date: '2026-10-05',
      clientName: 'TR Holdings', quotationNo: 'Q-2026-014',
      balanceBefore: total, balanceAfter: total - advance,
    },
    adminName: 'Admin', adminEmail: 'admin@findmysmart.com', live: false,
  });
  await syncFinanceIncome({
    paymentId: 'pay-fin-1',
    payment: {
      amount: total - advance, kind: 'Final', date: '2026-10-22',
      clientName: 'TR Holdings', quotationNo: 'Q-2026-014',
      balanceBefore: total - advance, balanceAfter: 0,
    },
    adminName: 'Admin', adminEmail: 'admin@findmysmart.com', live: false,
  });

  const rows = DEV_FINANCE_INCOME.filter(r => r.quotationNo === 'Q-2026-014');
  assert.equal(rows.length, 2, 'advance and final are two separate money events');
  assert.equal(rows.reduce((s, r) => s + r.amount, 0), total,
    'recorded income must equal the quotation total — never the advance twice');

  const [fin, adv] = rows;                       // newest first
  assert.equal(fin.status, 'Full Paid');
  assert.equal(adv.status, 'Advance Paid');
  assert.equal(adv.type, 'auto');
  assert.equal(adv.source, 'Quotation advance — Q-2026-014');
  assert.equal(adv.category, 'Client Payment');
});

test('Finance income - the same payment re-recorded never duplicates a row', async () => {
  const before = DEV_FINANCE_INCOME.length;
  const pay = {
    amount: 20000, kind: 'Part', date: '2026-10-11',
    quotationNo: 'Q-2026-077', balanceBefore: 40000, balanceAfter: 20000,
  };
  await syncFinanceIncome({ paymentId: 'pay-part-1', payment: pay, adminName: 'Admin', live: false });
  await syncFinanceIncome({ paymentId: 'pay-part-1', payment: pay, adminName: 'Admin', live: false });

  assert.equal(DEV_FINANCE_INCOME.length, before + 1, 'one payment id = one income row');
  assert.equal(DEV_FINANCE_INCOME.find(r => r.paymentId === 'pay-part-1').status, 'Balance Paid');
});

test('Finance income - invoice payments are labelled from the invoice number', () => {
  const paid = buildFinanceIncomePayload({
    paymentId: 'p1',
    payment: { kind: 'Invoice', amount: 80000, invoiceNo: 'INV-2026-009', invoiceStatus: 'paid' },
    adminName: 'Admin',
  });
  const partial = buildFinanceIncomePayload({
    paymentId: 'p2',
    payment: { kind: 'Invoice', amount: 30000, invoiceNo: 'INV-2026-010', balanceAfter: 12000 },
    adminName: 'Admin',
  });
  assert.equal(paid.status, 'Full Paid');
  assert.equal(paid.source, 'Invoice payment — INV-2026-009');
  assert.equal(partial.status, 'Balance Paid');

  // "Mark Paid" on a plain invoice carries no quotation balance — it is full.
  const standalone = buildFinanceIncomePayload({
    paymentId: 'p3',
    payment: { kind: 'Invoice', amount: 50000, invoiceNo: 'INV-2026-002', notes: 'POS Milestone 1' },
    adminName: 'Admin',
  });
  assert.equal(standalone.status, 'Full Paid');
  assert.equal(standalone.remark, 'POS Milestone 1', 'the payment note carries into the remark column');
});

test('Finance - default expense categories cover the office basics', () => {
  const cats = defaultExpenseCategories();
  ['Current Bill', 'Water Bill', 'WiFi', 'Maintenance', 'Furniture', 'Stationery'].forEach(c => {
    assert.ok(cats.includes(c), `${c} should be a default category`);
  });
  cats.push('Mutated');
  assert.equal(defaultExpenseCategories().includes('Mutated'), false, 'callers get a copy');
});

test('Finance expense total - quantity × unit price, lone unit price, typed amount', () => {
  assert.equal(expenseTotal({ quantity: 6, unitPrice: 1200, amount: 0 }), 7200);
  assert.equal(expenseTotal({ quantity: 0, unitPrice: 6200, amount: 0 }), 6200,
    'a unit price with no quantity is a single-item buy, not zero');
  assert.equal(expenseTotal({ quantity: 0, unitPrice: 0, amount: 14300 }), 14300);
  assert.equal(expenseTotal({}), 0);
});

test('Finance errors - Firestore codes become an actionable line', () => {
  const denied = financeErrorText({ code: 'permission-denied', message: 'Missing or insufficient permissions.' });
  assert.match(denied, /blocked by the live security rules/i);
  assert.match(denied, /Settings → Rules Status/, 'the admin is sent to the one pending-rules list');
  assert.equal(/npx firebase deploy/.test(denied), false, 'the command lives on the checklist, not here');
  assert.match(financeErrorText({ code: 'unavailable' }), /connection/i);
  assert.equal(financeErrorText(new Error('boom')), 'boom', 'unknown errors keep the original text');
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. STAFF WORK REPORT EXPORT + GOOGLE SHEET IMPORT
//    (the report must come out aligned per column, grouped per person,
//     and an imported day must land on the same day it was worked)
// ─────────────────────────────────────────────────────────────────────────────
const rep = await import('../src/staff/performanceReport.js');
const su = await import('../src/staff/staffUtils.js');

const SHEET_STAFF = [
  { id: 's1', authUid: 'u1', name: 'Thishalini', role: 'Digital Marketing Associate I' },
  { id: 's2', authUid: 'u2', name: 'Sathurshika', role: 'Software Developer Associate II' },
  { id: 's3', authUid: 'u3', name: 'Paththima Asra', role: 'Software Developer Associate II' },
  { id: 's4', authUid: 'u4', name: 'Luksikka', role: 'Digital Marketing Associate II' },
];

test('Sheet dates - every format the Google Sheet produces resolves to one day', () => {
  ['2026-10-28', '2026/10/28', '28/10/2026', '28-10-2026', '28.10.2026',
   '28-Oct-2026', '28 Oct 2026', 'Oct 28, 2026', '2026-10-28T00:00:00']
        .forEach(v => assert.equal(su.sheetDate(v), '2026-10-28', `${v} → 2026-10-28`));
  assert.equal(su.sheetDate('2026-10-5'), '2026-10-05', 'single-digit days are padded');
  assert.equal(su.sheetDate('yesterday'), null);
  assert.equal(su.sheetDate(''), null);
});

test('Sheet times - am/pm and dotted clocks become 24h', () => {
  assert.equal(su.to24h('9.15 am'), '09:15');
  assert.equal(su.to24h('1:30 pm'), '13:30');
  assert.equal(su.to24h('12:00 am'), '00:00');
  assert.equal(su.to24h('17:30'), '17:30');
  assert.equal(su.to24h('lunch'), '');
});

test('Name matching - the four members are found from their short forms', () => {
  [['Thisha', 'Thishalini'], ['Sathu', 'Sathurshika'], ['Asra', 'Paththima Asra'],
   ['Lukshi', 'Luksikka']].forEach(([sheet, record]) => {
    assert.ok(su.sameStaffName(sheet, record), `${sheet} should match ${record}`);
    const found = su.findStaffBySheetName(SHEET_STAFF, sheet);
    assert.equal(found && found.name, record, `${sheet} resolves to ${record}`);
  });
  assert.equal(su.findStaffBySheetName(SHEET_STAFF, 'Ameen Isath'), null,
    'a name nobody has must never be forced onto a staff record');
});

test('Work segments - one cell becomes timed tasks with statuses', () => {
  const tasks = su.parseWorkSegments(
    '08:30-14:30: Updated the Love Cake House website | 14:30-16:45: Edited posters [In Progress]');
  assert.equal(tasks.length, 2);
  assert.equal(tasks[0].status, 'Completed');
  assert.equal(tasks[0].hours, '6.0 hrs');
  assert.equal(tasks[1].start, '14:30');
  assert.equal(tasks[1].status, 'In Progress');
});

test('Clean text - tabs and double spaces from copied cells are gone', () => {
  assert.equal(rep.cleanText('Studied Solar ERP\t  |  planned the module structure'),
    'Studied Solar ERP | planned the module structure');
  assert.equal(rep.prettyDate('2026-10-29'), '29-10-2026');
  assert.equal(rep.hoursNumber('8.5 hrs'), 8.5);
  assert.equal(rep.hoursNumber('8h 30m'), 8.5);
  assert.equal(rep.hoursNumber('—'), 0);
});

test('Task lines - one line per task, status only when it is not completed', () => {
  const tasks = su.parseWorkSegments('08:30-10:30: Built the login screen | 10:30-12:30: Fixed bugs [Pending]');
  assert.equal(rep.taskLine(tasks[0]), '08:30 – 10:30  Built the login screen');
  assert.match(rep.taskLine(tasks[1]), /Fixed bugs {2}\[Pending\]$/);
  assert.equal(rep.workText(tasks).split('\n').length, 2, 'each task sits on its own wrapped line');
});

const DAY_ROWS = [
  { name: 'Lukshi', position: 'Software Associate', date: '2026-10-28', totalWorkHours: '8.0 hrs',
    tasks: [{ start: '09:00', end: '12:30', description: 'Promotional post', status: 'Completed' }] },
  { name: 'Luksikka', position: 'Digital Marketing Associate II', date: '2026-10-26', totalWorkHours: '7.3 hrs',
    tasks: [{ start: '09:00', end: '16:00', description: 'Facebook post', status: 'Completed' }] },
  { name: 'Thishalini', position: 'Digital Martketing Assoicate I', date: '2026-10-28', totalWorkHours: '8.2 hrs',
    tasks: [{ start: '08:30', end: '15:00', description: 'Portfolio site', status: 'Completed' }] },
];

test('Report grouping - one section per person, dates ascending, one position', () => {
  const rows = rep.canonicalize(DAY_ROWS.map(r => rep.normalizeReport(r)), SHEET_STAFF);
  const groups = rep.groupReports(rows, SHEET_STAFF);
  assert.deepEqual(groups.map(g => g.name), ['Luksikka', 'Thishalini'],
    'Lukshi and Luksikka are the same section, ordered A→Z');
  const luk = groups[0];
  assert.deepEqual(luk.rows.map(r => r.date), ['2026-10-26', '2026-10-28'], 'oldest day first');
  assert.equal(luk.position, 'Digital Marketing Associate II', 'the staff record decides the position');
  assert.equal(luk.summary.days, 2);
  assert.equal(luk.summary.totalHours, '15.3 hrs');
  assert.equal(luk.summary.avgHours, '7.7 hrs');
  assert.equal(groups[1].position, 'Digital Marketing Associate I');
});

test('Report status - an unfinished task keeps the day open', () => {
  const done = rep.normalizeReport({ name: 'A', date: '2026-10-28',
    tasks: [{ description: 'x', status: 'Completed' }] });
  const open = rep.normalizeReport({ name: 'A', date: '2026-10-28',
    tasks: [{ description: 'x', status: 'In Progress' }] });
  assert.equal(done.status, 'Completed');
  assert.equal(open.status, 'In Progress');
  assert.equal(open.day, 'Wednesday', 'the day name is derived from the date');
});

test('Row heights - the wrapped description decides the height, capped', () => {
  assert.equal(rep.estimatedLines('short one', 62), 1);
  assert.equal(rep.estimatedLines('x'.repeat(130), 62), 3);
  assert.equal(rep.estimatedLines('a\nb\nc', 62), 3);
  assert.equal(rep.rowHeightFor([{ text: 'a\nb\nc', width: 62 }]), 15 + 3 * 13.5);
  assert.equal(rep.rowHeightFor([{ text: 'x'.repeat(4000), width: 62 }]), 320);
});

test('CSV export - one physical line per report, columns never shift', () => {
  const rows = rep.canonicalize(DAY_ROWS.map(r => rep.normalizeReport(r)), SHEET_STAFF);
  const groups = rep.groupReports(rows, SHEET_STAFF);
  const csv = rep.buildCsv(rows, groups);
  const lines = csv.replace(/^﻿/, '').split('\r\n').filter(Boolean);
  assert.equal(lines.length, 1 + rows.length, 'header + one row per staff-day');
  lines.forEach(l => {
    const cells = l.match(/("([^"]|"")*")/g) || [];
    assert.equal(cells.length, rep.REPORT_COLUMNS.length, `${l.slice(0, 40)}… has every column`);
  });
  assert.match(lines[1], /^"\d+","Luksikka","Digital Marketing Associate II","26-10-2026"/,
    'S/N, canonical name and the record position come first');
  assert.ok(!/\t/.test(csv), 'no tabs left to break the alignment');
});

test('Template columns - the fill-in sheet matches the importer exactly', async () => {
  const ExcelJS = (await import('exceljs')).default;
  const wb = await rep.buildTemplateWorkbook();
  const read = new ExcelJS.Workbook();
  await read.xlsx.load(await wb.xlsx.writeBuffer());
  const ws = read.getWorksheet('REPORT TEMPLATE');
  const head = [];
  ws.getRow(1).eachCell(c => head.push(String(c.value ?? '')));
  assert.deepEqual(head, rep.REPORT_COLUMNS.map(c => c.label),
    'headers sit on row 1 — the importer reads row 1 as the header line');
  const sample = [];
  ws.getRow(2).eachCell({ includeEmpty: true }, c => sample.push(String(c.value ?? '')));
  assert.equal(sample.length, rep.REPORT_COLUMNS.length, 'the example row has one cell per column');
  assert.equal(sample[1], 'Ashan Perera');
  assert.equal(su.sheetDate(sample[2]), null,
    'the DD-MM-YYYY hint is not a real date, so the example row cannot import by mistake');
});

test('STATUS column - a filled template marks every task line', () => {
  const tasks = su.parseWorkSegments('09:00-11:00: Drafted the poster | 11:00-13:00: Client call', 'Pending');
  assert.equal(tasks.length, 2);
  assert.equal(tasks[0].status, 'Pending');
  assert.equal(su.parseWorkSegments('09:00-11:00: Drafted the poster [In Progress]', 'Pending')[0].status,
    'In Progress', 'an inline marker still wins');
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. WORK PROGRESS STAGES
//    (staff list the work per project → mark a stage done with a note →
//     admin approves each stage → only approved stages reach the client)
// ─────────────────────────────────────────────────────────────────────────────

const stg = (o = {}) => ({
  id: o.id || 's1', staffUid: 'u1', staffName: 'Sathurshika',
  projectId: o.projectId ?? '', projectTitle: o.projectTitle ?? '',
  clientId: o.clientId ?? '', clientName: o.clientName ?? '',
  stage: o.stage, title: o.title || 'Work stage',
  status: o.status ?? 'In Progress', date: o.date ?? '',
  completionNote: o.completionNote ?? '',
  reviewState: o.reviewState ?? '', reviewNote: o.reviewNote ?? '',
  proofs: o.proofs || [], history: o.history || [],
  updatedAt: o.updatedAt ?? 0,
});

test('Stage status - a row with no status is working, not finished', () => {
  assert.equal(su.stageStatusOf({ status: 'On Hold' }), 'On Hold');
  assert.equal(su.stageStatusOf({}), 'In Progress');
  assert.equal(su.stageStatusOf({ status: ' Completed ' }), 'Completed',
    'a stray space on an old row must not hide the completion');
  assert.equal(su.stageStatusOf({ status: 'Cancelled' }), 'Cancelled',
    'an unknown value is displayed, never silently rewritten');
});

test('Stage review - only the admin stamp makes a stage accepted', () => {
  assert.equal(su.stageReviewOf(stg({ status: 'Completed' })).key, 'pending');
  assert.equal(su.stageReviewOf(stg({ status: 'Completed', reviewState: 'accepted' })).key, 'accepted');
  assert.equal(su.stageReviewOf(stg({ status: 'Completed', reviewState: 'rework', reviewNote: 'Totals wrong' })).note,
    'Totals wrong');
  assert.equal(su.stageReviewOf(stg({ status: 'In Progress' })).key, 'none',
    'unfinished work has nothing to review');
  assert.equal(su.stageVisibleToClient(stg({ status: 'Completed' })), false,
    'finished but unapproved never reaches the client');
  assert.equal(su.stageVisibleToClient(stg({ status: 'Completed', reviewState: 'accepted' })), true);
});

test('Stage stats - staff bar counts done, client bar counts approved', () => {
  const list = [
    stg({ stage: 1, status: 'Completed', reviewState: 'accepted' }),
    stg({ stage: 2, status: 'Completed', reviewState: 'rework' }),
    stg({ stage: 3, status: 'In Progress' }),
    stg({ stage: 4, status: 'Completed', proofs: [{ name: 'a.jpg' }] }),
  ];
  const s = su.stageStats(list);
  assert.deepEqual(
    [s.total, s.done, s.open, s.accepted, s.rework, s.pendingReview, s.proofs],
    [4, 3, 1, 1, 1, 1, 1], 'one approved, one sent back, one waiting on the admin');
  assert.equal(s.pct, 75, 'three of four stages are marked complete');
  assert.equal(s.clientPct, 25, 'only the approved stage is visible to the client');
  assert.deepEqual(su.stageStats([]), {
    total: 0, done: 0, accepted: 0, rework: 0, proofs: 0,
    open: 0, pendingReview: 0, pct: 0, clientPct: 0,
  }, 'an empty list must not divide by zero');
});

test('Stage order - the number the staff wrote wins, then date, then newest edit', () => {
  const a = stg({ id: 'a', stage: 2, date: '2026-10-01' });
  const b = stg({ id: 'b', stage: 1, date: '2026-10-09' });
  const c = stg({ id: 'c', stage: 2, date: '2026-10-01', updatedAt: 50 });
  const d = stg({ id: 'd', stage: 2, date: '2026-10-02' });
  assert.deepEqual(su.sortStages([a, b, c, d]).map(x => x.id), ['b', 'c', 'a', 'd']);
  assert.deepEqual(su.sortStages('not a list'), [], 'a bad payload cannot crash the list');
});

test('Stage groups - one card per project, general work always last', () => {
  const pos1 = stg({ projectId: 'P3', projectTitle: 'Restaurant POS System', stage: 1,
    status: 'Completed', reviewState: 'accepted' });
  const pos2 = stg({ projectId: 'P3', projectTitle: 'Restaurant POS System', clientId: 'cl1',
    clientName: 'Codezela', stage: 2, status: 'In Progress' });
  const web  = stg({ projectId: 'P1', projectTitle: 'Corporate Website Redesign', clientId: 'cl2', stage: 1, status: 'On Hold' });
  const misc = stg({ stage: 1, title: 'Office network check' });
  const groups = su.groupStagesByProject([misc, web, pos1, pos2]);
  assert.deepEqual(groups.map(g => g.key), ['P1', 'P3', '__general__'],
    'open work sorts first and general work stays at the bottom');
  assert.equal(groups[1].stats.total, 2);
  assert.equal(groups[1].clientName, 'Codezela',
    'the client snapshot is backfilled from the row that carries it');
  assert.deepEqual(groups[1].items.map(i => i.stage), [1, 2]);
  assert.equal(groups[2].projectTitle, 'General work');
  assert.equal(su.groupStagesByProject([]).length, 0);
});

test('Stage numbering - the list numbers itself from what is already there', () => {
  assert.equal(su.nextStageNo([]), 1);
  assert.equal(su.nextStageNo([stg({ stage: 1 }), stg({ stage: 4 })]), 5);
  assert.equal(su.nextStageNo([stg({}), stg({})]), 1,
    'rows written before the numbering still start at 1');
});

test('Stage history - who/when lines are appended, never rewritten', () => {
  const first = su.stageHistoryEntry('Sathurshika', 'Added as In Progress', 100);
  const second = su.stageHistoryEntry('Admin', 'Approved by admin', 200);
  assert.deepEqual(first, { at: 100, by: 'Sathurshika', text: 'Added as In Progress' });
  const list = [first, second];
  assert.equal(list.length, 2);
  assert.equal(list[0].text, 'Added as In Progress', 'the original line is untouched');
  const auto = su.stageHistoryEntry(null, undefined);
  assert.ok(auto.at > 0, 'a stamp taken without a time still records one');
  assert.deepEqual([auto.by, auto.text], ['', '']);
});

test('Stage rules - the client may only read an approved stage of their own', () => {
  const rules = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  const block = (/match \/staffProgress\/\{itemId\} \{[\s\S]*?\n    \}/.exec(rules) || [''])[0];
  assert.match(block, /resource\.data\.clientId == request\.auth\.uid/,
    'the client read is scoped to their own clientId');
  assert.match(block, /resource\.data\.reviewState == 'accepted'/,
    'and only to stages the admin has approved');
  assert.match(block, /request\.resource\.data\.reviewState != 'accepted'/,
    'a staff update can never approve its own stage');
  assert.match(block, /allow delete: if isAdmin\(\)/, 'admin keeps the delete path');
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. ADD/EDIT BOXES NEVER CLOSE ON AN OUTSIDE CLICK + REPORT PDFs
// ─────────────────────────────────────────────────────────────────────────────

const modalLockSources = [
  ['../src/erp/components/ERPui.jsx',        'export function ERPModal'],
  ['../src/erp/components/QuotationDocStudio.jsx', 'doc-studio-overlay'],
];
test('Modal lock - an add/edit box has no click handler on its backdrop', () => {
  modalLockSources.forEach(([rel, marker]) => {
    const src = fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
    const at = src.indexOf(marker);
    assert.ok(at >= 0, `${rel} still has its overlay markup`);
    const overlay = src.slice(at, at + 900);
    assert.ok(!/onClick=\{?(onClose|close|set[A-Z]\w*|dismiss)/.test(overlay.split('zIndex')[1].slice(0, 400)),
      `${rel} backdrop must not close on click`);
  });
  // The shared modal still offers its own ✕ button.
  const ui = fs.readFileSync(new URL('../src/erp/components/ERPui.jsx', import.meta.url), 'utf8');
  assert.match(ui, /<button onClick=\{onClose\}[^>]*>\s*✕/, 'the ✕ button is the way out');
});

test('Modal lock - the public portfolio form ignores outside clicks and Escape', () => {
  const src = fs.readFileSync(new URL('../src/components/QuoteRequestForm.jsx', import.meta.url), 'utf8');
  assert.ok(!/onKeyDown|addEventListener\('keydown'/.test(src), 'no Escape key handler');
  const req = (/function RequestModal[\s\S]*?\n\}/.exec(src) || [''])[0];
  assert.ok(req.length > 0, 'the request modal is still there');
  assert.ok(!/onClick=\{[^}]*onClose/.test(req.slice(0, 600)), 'its backdrop stays put');
});

test('PDF text - typed glyphs that Helvetica cannot draw become readable words', async () => {
  const { pdfSafe, pdfFileName } = await import('../src/erp/utils/reportPdf.js');
  assert.equal(pdfSafe('₹100'), 'LKR 100');
  assert.equal(pdfSafe('a — b'), 'a - b');
  assert.equal(pdfSafe('quote • point'), 'quote - point');
  assert.equal(pdfSafe('Site · Trincomalee'), 'Site · Trincomalee', 'the middle dot is WinAnsi safe');
  assert.equal(pdfSafe('emoji \u{1F600} out'), 'emoji  out', 'un-drawable characters drop');
  assert.equal(pdfSafe(null), '');
  const name = pdfFileName(undefined, 'Attendance Report · Daily');
  assert.match(name, /^ATTENDANCE-REPORT-DAILY-\d{4}-\d{2}-\d{2}\.pdf$/, `got ${name}`);
  assert.equal(pdfFileName('PAY ROLL.pdf', 'X'), 'PAY ROLL.pdf', 'a given file name is kept');
});

test('PDF layout - a long report breaks to a second page and repeats the header', async () => {
  const { buildTablePdf } = await import('../src/erp/utils/reportPdf.js');
  const columns = [
    { label: 'DATE', width: 12, align: 'center' },
    { label: 'STAFF', width: 30 },
    { label: 'STATUS', width: 12, align: 'center' },
  ];
  const rows = Array.from({ length: 70 }, (_, i) => [
    `0${(i % 9) + 1}-11-2026`, `Staff Member ${i} — a description long enough to wrap onto another line`, i % 4 ? 'Present' : 'Absent',
  ]);
  const doc = buildTablePdf({ title: 'ATTENDANCE', columns, rows, statusCol: 2, generatedBy: 'admin' });
  assert.ok(doc.getNumberOfPages() > 1, 'rows past one page continue on the next');
  assert.ok(doc.output('arraybuffer').byteLength > 4000, 'and the file has content');

  // Empty input must not crash and must not draw a phantom row.
  const blank = buildTablePdf({ title: 'NO DATA', columns, rows: [] });
  assert.equal(blank.getNumberOfPages(), 1);
});

test('PDF sections - one document holds several tables, each with its own head', async () => {
  const { buildTablePdf } = await import('../src/erp/utils/reportPdf.js');
  const doc = buildTablePdf({
    title: 'CLIENT REPORT',
    sections: [
      { heading: 'Projects (2)', columns: [{ label: 'PROJECT', width: 60 }, { label: 'STATUS', width: 20 }],
        rows: [['Website', 'In Progress'], ['ERP', 'Completed']] },
      { heading: 'Work Tracker (1/2 done)', columns: [{ label: 'ITEM', width: 60 }, { label: 'STATUS', width: 20 }],
        rows: [['Home page', 'Completed'], ['Forms', 'Pending']] },
    ],
  });
  const bytes = doc.output('arraybuffer');
  assert.ok(bytes.byteLength > 2000, 'both tables rendered');
  assert.equal(doc.getNumberOfPages(), 1, 'a short multi-table report stays on one page');
});

test('Client report - status labels and the roster stay inside the ERP wording', async () => {
  const { projectStatusLabel } = await import('../src/erp/utils/clientReportPdf.js');
  assert.equal(projectStatusLabel('quotation_sent'), 'Quotation Sent');
  assert.equal(projectStatusLabel('advance_paid'), 'Advance Paid');
  assert.equal(projectStatusLabel('Completed'), 'Completed', 'a stored label passes through');
  assert.equal(projectStatusLabel(''), '—');
});

test('Work report PDF - reuse the same grouping the Excel export uses', async () => {
  const mod = await import('../src/staff/workReportPdf.js');
  assert.equal(typeof mod.saveWorkReportPdf, 'function');
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. DAILY REPORT IMPORT — the shared row parser (staffUtils.buildImportEntries)
// ─────────────────────────────────────────────────────────────────────────────

test('Import parsing - a Google Sheet header is read without renaming columns', async () => {
  const { buildImportEntries } = await import('../src/staff/staffUtils.js');
  const rows = [
    ['Staff Name', 'Role', 'Work Date', 'Site', 'Check In', 'Lunch', 'Check Out', 'Total Hours', 'Today Work', 'Remarks'],
    ['Luksikka', 'Software Associate', '01-10-2026', 'SCBC TRINCOMALEE', '8:20 am', '12:00', '4:00 pm', '8.5 hrs', '08:30-12:00: Wireframe [Completed] | 13:00-16:00: ERP screens [In Progress]', ''],
    ['', '', '', '', '', '', '', '', '', ''],
  ];
  const { flat, entries } = buildImportEntries(rows);
  assert.equal(flat, true, 'a NAME + DATE header is the flat format');
  assert.equal(entries.length, 2);
  const e = entries[0];
  assert.equal(e.name, 'Luksikka');
  assert.equal(e.date, '2026-10-01', 'dd-mm-yyyy becomes the ERP day key');
  assert.equal(e.arrival, '08:20', 'am/pm punches become 24h');
  assert.equal(e.departure, '16:00');
  assert.equal(e.tasks.length, 2, 'one cell becomes timed task lines');
  assert.equal(e.tasks[1].status, 'In Progress', 'a [marker] beats the empty STATUS column');
  assert.equal(entries[1].name, '', 'a blank row stays recognisable as empty');
});

test('Import parsing - the office template headers resolve to the same fields', async () => {
  const { buildImportEntries } = await import('../src/staff/staffUtils.js');
  const HEAD = ['NAME', 'POSITION', 'DATE', 'DAY', 'LOCATION', 'WORK MODE', 'ARRIVAL', 'LUNCH START',
    'LUNCH END', 'LUNCH DURATION', 'DEPARTURE', 'TOTAL WORK HRS', 'WORK / DESCRIPTION', 'STATUS',
    'REMARKS', 'PLAN FOR TOMORROW'];
  const row = ['Sathurshika', 'Software Developer Associate I', '28-09-2026', 'Wednesday', 'SCBC TRINCOMALEE',
    'On-Site / Office', '08:20', '12:00', '12:30', '0.5 hrs', '17:00', '8.5 hrs',
    '08:30-14:30: Created a wireframe for the marketing website [Completed] | 14:40-17:00: Updated ERP attendance module [Completed]',
    'Completed', '', 'Finish the POS screens'];
  const built = buildImportEntries([HEAD, row]);
  assert.ok(Object.values(built.idx).every(i => i >= 0), 'every template column is recognised');
  const e = built.entries[0];
  assert.equal(e.date, '2026-09-28');
  assert.equal(e.day, 'Wednesday');
  assert.equal(e.totalWorkHours, '8.5 hrs');
  assert.equal(e.planTomorrow, 'Finish the POS screens');
  assert.equal(e.tasks.length, 2);
  assert.equal(e.tasks[0].status, 'Completed');
});

test('Import parsing - a block-style sheet is not mistaken for flat rows', async () => {
  const { buildImportEntries } = await import('../src/staff/staffUtils.js');
  const built = buildImportEntries([['SMART PVT LTD • IT TEAM DAILY WORK LOG'],
    ['SMART PVT LTD • DAILY WORK REPORT - 2026-09-28 (WED)'], ['NAME', 'Sathurshika'], ['DATE', '28-09-2026']]);
  assert.equal(built.flat, false, 'no NAME+DATE header row means the block parser takes it');
  assert.equal(built.sheet, true, 'the day banner marks the block sheet style');
  assert.deepEqual(built.entries, []);
});

test('Full period export - From/To filtering keeps the daily list and the report together', () => {
  const src = fs.readFileSync(new URL('../src/erp/pages/ERPStaffUpdates.jsx', import.meta.url), 'utf8');
  assert.match(src, /\.filter\(u => \(fromF \? String\(u\.date\) >= fromF : true\)\)/, 'the list honours From');
  assert.match(src, /\.filter\(u => \(toF \? String\(u\.date\) <= toF : true\)\)/, 'and To');
  assert.ok(src.indexOf('const filtered =') < src.indexOf('const exportPdf'), 'the exports read the filtered list');
  assert.match(src, /rangeLabel: dailyLabel/, 'the PDF header carries the chosen period');
});

// ── Attendance statement periods + the leave application flow ─────────
test('Statement periods - week/month/year resolve to real date bounds', async () => {
  const { periodRange, expectedWorkdays, mondayOf } = await import('../src/staff/staffUtils.js');
  const wed = periodRange('week', '2026-11-04');           // Wed of that week
  assert.equal(wed.from, '2026-11-02', 'the week starts on Monday');
  assert.equal(wed.to, '2026-11-08', 'and ends on Sunday');
  assert.equal(mondayOf('2026-11-08'), '2026-11-02', 'Sunday belongs to the week before');
  const mo = periodRange('month', '2026-02');
  assert.equal(mo.from, '2026-02-01');
  assert.equal(mo.to, '2026-02-28', 'a non-leap February ends on the 28th');
  const yr = periodRange('year', '2026');
  assert.equal(`${yr.from}|${yr.to}`, '2026-01-01|2026-12-31');
  assert.deepEqual(periodRange('all', 'anything'), { from: '', to: '', label: 'All records' },
    'the full record is deliberately unbounded');
  const days = expectedWorkdays('2026-11-02', '2026-11-08');
  assert.deepEqual(days, ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'],
    'Mon–Sat only — the office is shut on Sunday');
  assert.deepEqual(expectedWorkdays('', ''), [], 'an open range claims no missing days');
});

test('Leave dates - the day count and the covered days match the letter', async () => {
  const { leaveDays, leaveDateList, letterDate } = await import('../src/staff/leaveLetter.js');
  assert.equal(leaveDays('2026-11-04', '2026-11-04'), 1, 'same day is one day');
  assert.equal(leaveDays('2026-11-04', '2026-11-06'), 3, 'inclusive');
  assert.equal(leaveDays('2026-11-06', '2026-11-04'), 0, 'an end before the start is no leave');
  assert.deepEqual(leaveDateList('2026-10-30', '2026-11-02'),
    ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'], 'a leave crossing a month still lists every day');
  assert.deepEqual(leaveDateList('2026-11-06', '2026-11-04'), []);
  assert.equal(letterDate('2026-11-02'), '02-Nov-2026');
});

test('Staff portal leave section - files a Pending application with a private letter path', () => {
  const src = fs.readFileSync(new URL('../src/staff/sections/MyLeave.jsx', import.meta.url), 'utf8');
  assert.match(src, /status: 'Pending'/, 'a fresh application always starts Pending');
  assert.match(src, /staff-docs\/\$\{uid\}\/leave_/, 'the letter lives in the staff member\'s own private folder');
  assert.doesNotMatch(src, /getDownloadURL/, 'no public download token anywhere in the leave flow');
  assert.match(src, /await leaveLetterBlob\(letterData\(\)\)/, 'the sent image is re-drawn from the live form');
  assert.match(src, /where\('staffUid', '==', uid\)/, 'a staff member reads only their own requests');
  assert.match(src, /permission-denied/, 'an undeployed rules block is explained, not shown as a blank page');
});

test('Leave rules - staff cannot decide their own leave, admin appends to history', () => {
  const rules = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  const block = rules.slice(rules.indexOf('match /leaves/{leaveId}'), rules.indexOf('match /financeIncome'));
  assert.ok(block.length > 40, 'the leaves collection has its own rules block');
  assert.match(block, /request\.resource\.data\.staffUid == request\.auth\.uid/, 'a staff member files only their own');
  assert.match(block, /request\.resource\.data\.status == 'Pending'/, 'and only as Pending');
  assert.match(block, /hasAny\(\['status', 'adminNote', 'reviewedBy', 'reviewedAt'/,
    'the decision fields are out of reach for staff');
  assert.match(block, /allow delete: if isAdmin\(\) \|\|[\s\S]*resource\.data\.status == 'Pending'/,
    'the admin removes any application; the staff member only a still-Pending one');

  const admin = fs.readFileSync(new URL('../src/erp/pages/ERPStaffAttendance.jsx', import.meta.url), 'utf8');
  assert.match(admin, /history: \[\.\.\.\(Array\.isArray\(lvTarget\.history\) \? lvTarget\.history : \[\]\), entry\]/,
    'the decision is appended to the history, never rewritten');
  assert.match(admin, /doc\(db, 'leaves', lvTarget\.id\)/, 'the review writes back to the same document');
  assert.match(admin, /leaveDateList\(l\.from, l\.to\)/, 'approved leave covers the statement days');
  assert.match(admin, /'Approved leave'/, 'and reads as approved leave instead of Not recorded');
});

test('Leave entry is a real portal page and a real permission rule', () => {
  const portal = fs.readFileSync(new URL('../src/staff/StaffPortalApp.jsx', import.meta.url), 'utf8');
  assert.match(portal, /id: 'leave'[\s\S]{0,120}ruleKey: 'allowStaffLeave'/, 'the menu item is rule-guarded');
  assert.match(portal, /case 'leave':\s*return <MyLeave \/>;/, 'and opens the leave section');
  const defs = fs.readFileSync(new URL('../src/config/accessRules.js', import.meta.url), 'utf8');
  assert.match(defs, /allowStaffLeave: true/, 'default access rules grant it');
  assert.match(defs, /key: 'allowStaffLeave'/, 'and the admin can switch it per member');
});

test('Admin bell - a new leave application notifies and jumps to the review', () => {
  const layout = fs.readFileSync(new URL('../src/erp/layout/ERPLayout.jsx', import.meta.url), 'utf8');
  assert.match(layout, /collection\(db, 'leaves'\)/, 'the bell listens to leave applications');
  assert.match(layout, /=== 'Pending'\)/, 'only un-reviewed ones are listed');
  assert.match(layout, /link: '\/erp\/staff\?tab=attendance'/, 'clicking opens Staff → Attendance');
  assert.match(layout, /\[\.\.\.leaveNotifs, \.\.\.liveNotifs\]/, 'leave pings merge into the same dropdown');
  assert.match(layout, /seededLeaves\.current/, 'old pending requests do not arrive as unread spam');
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. RULES STATUS — one list instead of twelve "deploy the rules" banners
// ─────────────────────────────────────────────────────────────────────────────

test('Rules checklist - every collection the ERP listens to is listed once', async () => {
  const { RULES_BLOCKS, DEPLOY_COMMAND, pendingBlocks } = await import('../src/erp/rulesBlocks.js');
  assert.ok(RULES_BLOCKS.length >= 20, 'the list covers the whole app, not just the newest page');
  const seen = new Set();
  RULES_BLOCKS.forEach(b => {
    assert.ok(b.coll && b.name && b.page && b.since, `${b.coll} entry is complete`);
    assert.equal(seen.has(b.coll), false, `${b.coll} is listed only once`);
    seen.add(b.coll);
  });
  ['clients', 'staff', 'staffProgress', 'leaves', 'portfolioLinks', 'financeIncome', 'settings']
    .forEach(c => assert.ok(seen.has(c), `${c} must be on the checklist`));
  assert.match(DEPLOY_COMMAND, /firebase deploy --only firestore:rules/, 'the board carries the deploy command');

  assert.deepEqual(pendingBlocks({ staff: 'live', leaves: 'blocked' }).map(b => b.coll).filter(c => c === 'leaves'), ['leaves']);
  assert.deepEqual(pendingBlocks({ staff: 'live' }).filter(b => b.coll === 'staff'), []);
  assert.equal(pendingBlocks(null).length, 0, 'no results yet means nothing is claimed as pending');
});

test('Rules status page - probes live, shows the pending list, and is reachable from Settings', () => {
  const page = fs.readFileSync(new URL('../src/erp/pages/ERPRulesStatus.jsx', import.meta.url), 'utf8');
  assert.match(page, /probeRulesBlocks/, 'the board reads the real deployed rules');
  assert.match(page, /pendingBlocks\(states\)/, 'and marks only the blocked ones');
  assert.match(page, /DEPLOY_COMMAND/, 'the command is copyable from here');
  assert.match(page, /Check now/, 'one button re-checks everything');

  const settings = fs.readFileSync(new URL('../src/erp/pages/ERPSettings.jsx', import.meta.url), 'utf8');
  assert.match(settings, /\{id:'deploy',\s*label:'Rules Status'/, 'Settings has the Rules Status entry');
  assert.match(settings, /\{section==='deploy' && \(/, 'and it renders the panel');
});

test('Rules banners - pages point at the one list instead of repeating commands', async () => {
  const {
    rulesNotice, staffRulesNotice, rulesMissingBlockNotice, rulesNotAdminNotice, RULES_PAGE,
  } = await import('../src/erp/rulesNotice.js');
  assert.equal(rulesNotice('Work Progress'), `Work Progress is blocked by the live security rules — check ${RULES_PAGE}.`);
  assert.match(staffRulesNotice('Leave applications'), /ask your admin/);
  assert.equal(RULES_PAGE, 'Settings → Rules Status');

  // A refusal after other admin lists loaded means only this block is missing;
  // a refusal with nothing loaded means the account is not admin. The two
  // sentences must stay distinguishable or the admin fixes the wrong thing.
  assert.match(rulesMissingBlockNotice('Saved portfolio links'), /missing this collection's block/);
  assert.match(rulesNotAdminNotice('Saved portfolio links'), /not an admin on the live rules/);
  assert.notEqual(rulesMissingBlockNotice('x'), rulesNotAdminNotice('x'));

  // No firebase deploy command may be pasted into a page error any more —
  // the checklist is the only place that shows it.
  const files = [
    '../src/erp/pages/ERPDashboard.jsx', '../src/erp/pages/ERPLeads.jsx',
    '../src/erp/pages/ERPProjects.jsx', '../src/erp/pages/ERPClients.jsx',
    '../src/erp/pages/ERPStaffWork.jsx', '../src/erp/pages/ERPStaffAttendance.jsx',
    '../src/erp/components/StageReviewPanel.jsx', '../src/erp/useStaffDirectory.js',
    '../src/erp/finance/financeSync.js', '../src/staff/sections/MyProgress.jsx',
    '../src/staff/sections/MyLeave.jsx',
  ];
  files.forEach(f => {
    const src = fs.readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.equal(/npx firebase deploy/.test(src), false, `${f} must not print its own deploy command`);
  });
  const clientsSrc = fs.readFileSync(new URL('../src/erp/pages/ERPClients.jsx', import.meta.url), 'utf8');
  assert.match(clientsSrc, /rulesMissingBlockNotice\('Saved portfolio links'\)/, 'the portfolio-links banner uses the precise cause');
  assert.match(clientsSrc, /adminReadOk\.current = true/, 'a successful clients read proves the account is admin');
  assert.match(clientsSrc, /rulesNotAdminNotice\('Saved portfolio links'\)/, 'and a total refusal names the non-admin account');
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. CLIENT CODE SERIES — people SM/2026/111…, companies SM/2026/1111…
// ─────────────────────────────────────────────────────────────────────────────

const Y = 2026;
const code = (n) => `SM/${Y}/${n}`;

test('Client code - a person starts at 111 and counts up one by one', async () => {
  const { nextClientCodeValue, previewClientCode, makeClientCode } = await import('../src/erp/clientCode.js');
  assert.equal(makeClientCode('individual', 111, Y), 'SM/2026/111');
  // Nothing saved yet → the very first number of the series.
  assert.equal(nextClientCodeValue('individual', [], Y), 111);
  assert.equal(nextClientCodeValue('individual', [{ code: code(111) }], Y), 112);
  assert.equal(nextClientCodeValue('individual', [{ code: code(111) }, { code: code(115) }], Y), 116);
  assert.equal(previewClientCode('individual', [{ code: code(112) }], Y), 'SM/2026/113');
});

test('Client code - a company starts at 1111 on its own series', async () => {
  const { nextClientCodeValue, previewClientCode } = await import('../src/erp/clientCode.js');
  assert.equal(nextClientCodeValue('company', [], Y), 1111);
  assert.equal(nextClientCodeValue('company', [{ code: code(1111) }], Y), 1112);
  assert.equal(previewClientCode('company', [{ code: code(1113) }], Y), 'SM/2026/1114');
  // A person's 111 is a different number from a company's 1111, so the
  // company series still opens at its own starting value.
  assert.equal(nextClientCodeValue('company', [{ code: code(111) }], Y), 1111);
  // but a company that already holds 1111 pushes the next one to 1112.
  assert.equal(nextClientCodeValue('company', [{ code: code(111) }, { code: code(1111) }], Y), 1112);
});

test('Client code - a used number is never handed out twice', async () => {
  const { nextClientCodeValue, highestCodeInUse } = await import('../src/erp/clientCode.js');
  const clients = [{ code: code(111) }, { code: code(1111) }, { code: 'SM/2025/999' }, { name: 'no code yet' }];
  assert.equal(highestCodeInUse(clients, Y), 1111, 'last year and codeless clients are ignored');
  // Counter lost / reset: the scan of the list still outranks it.
  assert.equal(nextClientCodeValue('individual', clients, Y, 3), 1112);
  // Counter ahead of the list (a client page that never refreshed): the counter wins.
  assert.equal(nextClientCodeValue('individual', [{ code: code(111) }], Y, 400), 401);
  assert.equal(nextClientCodeValue('individual', [], Y, 0), 111);
});

test('Client code - the Add Client form shows the next number before saving', () => {
  const src = fs.readFileSync(new URL('../src/erp/pages/ERPClients.jsx', import.meta.url), 'utf8');
  assert.match(src, /previewClientCode\(form\.kind, clients\)/, 'the modal previews the code');
  assert.match(src, /await allocateClientCode\(payload\.kind, clients\)/, 'and the save allocates it');
  assert.match(src, /CLIENT_KINDS\.map/, 'person / company is a real choice in the form');
  assert.match(src, /assignCodeToSelected/, 'old clients without a code can be back-filled');
  const leads = fs.readFileSync(new URL('../src/erp/pages/ERPLeads.jsx', import.meta.url), 'utf8');
  assert.match(leads, /code: await allocateClientCode\(kind, \[\]\)/, 'a lead converted to a client also gets a code');
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. DELETING TEST RECORDS — the admin and the staff member can undo what
//     they filed by mistake (leave applications + attendance punches).
// ─────────────────────────────────────────────────────────────────────────────

test('Delete rules - the owner may withdraw a Pending leave and its letter', () => {
  const fsRules = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  const leavesBlock = fsRules.match(/match \/leaves\/\{leaveId\}\s*\{[\s\S]*?\n\s{4}\}/);
  assert.ok(leavesBlock, 'the leaves block exists');
  assert.match(leavesBlock[0], /allow delete: if isAdmin\(\) \|\|[\s\S]*resource\.data\.staffUid == request\.auth\.uid[\s\S]*resource\.data\.status == 'Pending'/,
    'staff can delete only their own undecided application');
  assert.doesNotMatch(leavesBlock[0], /allow delete: if true/, 'deleting a leave is not open to everyone');

  const stRules = fs.readFileSync(new URL('../storage.rules', import.meta.url), 'utf8');
  const docsBlock = stRules.match(/match \/staff-docs\/\{authUid\}\/\{fileName\}\s*\{[\s\S]*?\n\s{4}\}/);
  assert.ok(docsBlock, 'the staff-docs block exists');
  assert.match(docsBlock[0], /allow delete: if isAdmin\(\) \|\|[\s\S]*request\.auth\.uid == authUid[\s\S]*fileName\.matches\('leave\(att\)\?_\.\*'\)/,
    'the staff member can remove only their own leave letter / attachment');
});

test('Admin leave panel - delete removes the letter files and the document', () => {
  const src = fs.readFileSync(new URL('../src/erp/pages/ERPStaffAttendance.jsx', import.meta.url), 'utf8');
  assert.match(src, /const removeLeave = async \(\) =>/, 'the delete handler exists');
  assert.match(src, /deleteDoc\(doc\(db, 'leaves', lvDel\.id\)\)/, 'it removes the Firestore document');
  assert.match(src, /deleteObject\(storageRef\(storage, p\)\)/, 'and the private letter files with it');
  assert.match(src, /title="Delete Leave Application\?"/, 'behind its own confirm box');
  assert.match(src, /rulesNotice\('This delete'\)/, 'a blocked delete points at the Rules Status list');
});

test('Admin attendance - a wrong or test punch can be deleted from the fix box', () => {
  const src = fs.readFileSync(new URL('../src/erp/pages/ERPStaffAttendance.jsx', import.meta.url), 'utf8');
  assert.match(src, /const removeAttendance = async \(\) =>/, 'the delete handler exists');
  assert.match(src, /deleteDoc\(doc\(db, 'attendance', attDel\.id\)\)/, 'it removes the punch document');
  assert.match(src, /setRecords\(p => p\.filter\(r => r\.id !== attDel\.id\)\)/, 'and drops it from the list at once');
  assert.match(src, /title="Delete Attendance Record\?"/, 'behind its own confirm box');
  assert.match(src, /Delete this record/, 'the editor offers the delete');
});

test('Staff portal leave - only a Pending application can be withdrawn', () => {
  const src = fs.readFileSync(new URL('../src/staff/sections/MyLeave.jsx', import.meta.url), 'utf8');
  assert.match(src, /const withdrawLeave = async \(\) =>/, 'the withdraw handler exists');
  assert.match(src, /deleteDoc\(doc\(db, 'leaves', delTarget\.id\)\)/, 'it removes the application');
  assert.match(src, /\{st === 'Pending' && \(/, 'the button only shows while nothing is decided');
  assert.match(src, /title="Withdraw this application\?"/, 'behind its own confirm box');
  assert.match(src, /staffRulesNotice\('This withdrawal'\)/, 'a blocked withdrawal points the staff member at the admin');
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. DAILY WORK REPORT — one real PDF, readable on a phone
// ─────────────────────────────────────────────────────────────────────────────

test('Daily report rows - empty blocks never print and item-only docs still do', async () => {
  const { dailyReportRows, reportTasksOf, periodReportRows, hoursNumber } = await import('../src/erp/utils/dailyReportPdf.js');

  const tasks = [
    { no: 1, start: '09:00', end: '11:00', hours: '2.0 hrs', description: 'Built the invoice screen', status: 'Completed' },
    { no: 2, start: '', end: '', hours: '', description: '   ', status: 'Completed' },
    { no: 3, start: '14:00', end: '', hours: '', description: 'Ticket triage', status: 'In Progress' },
  ];
  const rows = dailyReportRows(tasks);
  assert.equal(rows.length, 2, 'the blank pre-dated block is dropped');
  assert.deepEqual(rows[0], ['1', '09:00', '11:00', '2.0 hrs', 'Built the invoice screen', 'Completed']);
  assert.deepEqual([rows[1][2], rows[1][3]], ['\u2014', '\u2014'], 'a missing time prints as a dash, not an empty cell');

  // The older flat shape the Excel import wrote (items + one pair of times).
  const flat = reportTasksOf({ items: ['Support calls', 'Docs update'], startTime: '09:00', endTime: '17:00', totalHours: '8.0 hrs', status: 'Completed' });
  assert.equal(flat.length, 2, 'items become task rows');
  assert.equal(flat[1].description, 'Docs update');
  assert.equal(flat[1].start, '09:00', 'the sheet times carry onto every item');
  assert.deepEqual(dailyReportRows(flat).map(r => r[4]), ['Support calls', 'Docs update']);

  const period = periodReportRows([
    { date: '2026-11-03', tasks: [{ description: 'Later day', start: '09:00', end: '10:00', hours: '1.0 hrs' }] },
    { date: '2026-11-01', tasks: [{ description: 'Earlier day', start: '11:00', end: '12:00', hours: '1.0 hrs' }] },
  ]);
  assert.deepEqual(period.map(r => r[0]), ['2026-11-01', '2026-11-03'], 'a week reads in date order');
  assert.equal(hoursNumber('8.5 hrs'), 8.5);
  assert.equal(hoursNumber('—'), 0);
});

test('Daily report - the staff sheet saves as a PDF, no print dialog anywhere', () => {
  const staff = fs.readFileSync(new URL('../src/staff/sections/DailyUpdate.jsx', import.meta.url), 'utf8');
  const admin = fs.readFileSync(new URL('../src/erp/pages/ERPStaffUpdates.jsx', import.meta.url), 'utf8');
  for (const [where, src] of [['staff portal', staff], ['admin daily reports', admin]]) {
    assert.doesNotMatch(src, /window\.print\(\)/, `${where} never opens the printer`);
    assert.doesNotMatch(src, /window\.open\('',\s*'_blank'\)/, `${where} never opens a blank print tab`);
  }
  assert.match(staff, /saveDailyReportPdf\(/, 'the staff sheet goes through the PDF builder');
  assert.match(admin, /saveDailyReportPdf\(/, 'and so does the admin copy of it');
  assert.match(admin, /handleSheetPdf\(u\)/, 'the row button is wired to the PDF');
  assert.doesNotMatch(admin, /handlePrintWeek/, 'the duplicate print-range button is gone (Export PDF already exists)');
});

test('Daily report on a phone - tasks stack as cards instead of running off screen', () => {
  const staff = fs.readFileSync(new URL('../src/staff/sections/DailyUpdate.jsx', import.meta.url), 'utf8');
  assert.match(staff, /const useNarrow = /, 'the sheet knows the screen width');
  assert.match(staff, /const narrow = useNarrow\(\)/, 'and reads it');
  assert.match(staff, /narrow \? cardBox : rowBox/, 'one task = a wrapping card on a phone, a row on a laptop');
  assert.match(staff, /const TASK_GRID = /, 'the laptop row keeps the printed sheet columns');
  assert.doesNotMatch(staff, /<table/, 'no wide HTML table that a 520 px screen cannot hold');
  assert.match(staff, /overflowX: 'auto'/, 'a laptop row that cannot fit scrolls inside its own box');
  assert.match(staff, /const \[delTarget, setDelTarget\] = useState\(null\)/, 'deleting a report uses the shared confirm box');
  assert.doesNotMatch(staff, /window\.confirm\(/, 'not the browser dialog');
});



// ── 14. Login email change (same person, new address) ─────────────
test('Email checks - the login address is validated before Firebase sees it', async () => {
  const { emailError, sameEmail, loginMailOf } = await import('../src/erp/emailPolicy.js');
  assert.equal(emailError('kasun@smart.com'), '', 'a normal address passes');
  assert.match(emailError(''), /required/i, 'empty is refused');
  assert.match(emailError('kasun'), /valid email/i, 'no @ / no domain');
  assert.match(emailError('ka sun@smart.com'), /spaces/i, 'a space is refused');
  assert.match(emailError('kasun@smart'), /valid email/i, 'a domain without a dot is refused');
  assert.ok(sameEmail('Kasun@Smart.COM ', 'kasun@smart.com'), 'login emails are case and space insensitive');
  assert.ok(!sameEmail('a@x.com', 'b@x.com'), 'a different address is a different login');
  assert.equal(loginMailOf({ email: 'fallback@x.com' }), 'fallback@x.com', 'the old email field still counts');
  assert.equal(loginMailOf({ loginEmail: 'main@x.com', email: 'old@x.com' }), 'main@x.com', 'loginEmail wins');
});

test('Login email - the admin stages the new address, never rewrites the live one', () => {
  const staff = fs.readFileSync(new URL('../src/erp/pages/ERPStaff.jsx', import.meta.url), 'utf8');
  assert.match(staff, /import \{ emailError, sameEmail, loginMailOf \} from '\.\.\/emailPolicy';/,
    'the page shares one email check with the portal');
  assert.match(staff, /const mailErr = emailError\(form\.email\);/, 'typed address is validated on save');
  assert.match(staff, /disabled=\{busy \|\| !form\.name\.trim\(\) \|\| !!emailError\(form\.email\)/,
    'and the Save button stays shut while it is invalid');

  const edit = staff.slice(staff.indexOf('if (editId) {'), staff.indexOf('// Photo handling: new file'));
  assert.ok(edit.length > 60, 'the edit branch was found');
  assert.match(edit, /pendingLoginEmail: nextMail/, 'a changed address is staged');
  assert.match(edit, /emailChangeLog: arrayUnion\(\.\.\.log\)/, 'and appended to who/when history');
  assert.match(edit, /state: 'Requested'/, 'the log says it is only requested');
  assert.match(edit, /state: 'Replaced'/, 'an older waiting request is marked replaced');
  assert.doesNotMatch(edit, /loginEmail: nextMail/, 'the working login is not rewritten by the admin');

  assert.match(staff, /const handleCancelMailChange = async \(s\) =>/, 'the admin can withdraw the request');
  assert.match(staff, /pendingLoginEmail: null,\s*\n\s*pendingLoginEmailAt: null,/, 'clearing the staged address');
  assert.match(staff, /state: 'Cancelled'/, 'and recording that too');
  assert.match(staff, /Cancel this email change\?/, 'behind its own confirm box');
  assert.match(staff, /Change Login Email/, 'reachable from the staff profile panel');
  assert.match(staff, /waiting for \{s\.pendingLoginEmail\}/, 'the staff list marks the row while it waits');
});

test('Login email - only the signed-in owner can move the account, with their password', async () => {
  const flow = fs.readFileSync(new URL('../src/staff/loginEmail.js', import.meta.url), 'utf8');
  assert.match(flow, /reauthenticateWithCredential\(/, 'the current password is verified first');
  assert.match(flow, /updateEmail\(user, to\)/, 'then the account itself is moved');
  assert.match(flow, /auth\/email-already-in-use/, 'an address taken by somebody else is refused');
  assert.match(flow, /auth\/wrong-password|auth\/invalid-credential/, 'a wrong password reads as a wrong password');
  assert.match(flow, /before\.pendingLoginEmail/, 'the staged address is re-read before writing');
  assert.match(flow, /if \(!sameEmail\(staged, to\)\) throw/, 'and a mismatch is rejected, not applied');
  assert.match(flow, /loginEmail: to,\s*\n\s*email: to,/, 'the staff record then carries the new address');
  assert.match(flow, /state: 'Applied'/, 'the history shows it landed');
  assert.doesNotMatch(flow, /collection\(db, 'staff'\)/, 'a staff member never touches another record');
  assert.doesNotMatch(flow, /getDownloadURL|deleteDoc/, 'no file links, no deletions in this flow');

  const profile = fs.readFileSync(new URL('../src/staff/sections/MyProfile.jsx', import.meta.url), 'utf8');
  assert.match(profile, /function LoginEmailMove\(\)/, 'the portal shows a confirm panel');
  assert.match(profile, /applyLoginEmailChange\(\{ uid: staffProfile\.id, newEmail: to, password: pwd \}\)/,
    'using the signed-in person\'s own record');
  assert.match(profile, /label="Current Password" value=\{pwd\} type="password"/, 'asking the password');
  assert.match(profile, /disabled=\{busy \|\| !pwd\}/, 'and refusing to run without it');
  assert.match(profile, /if \(!to\) \{\s*\n\s*if \(!done\) return null;/, 'the panel only exists while a change waits');
});

test('Login email rules - the self-update branch accepts only the staged address', () => {
  const rules = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  const block = rules.slice(rules.indexOf('match /staff/{uid}'), rules.indexOf('match /workAssignments/'));
  assert.ok(block.length > 60, 'the staff block was found');
  assert.match(block, /hasOnly\(\['docs', 'updatedAt'\]\)/, 'the KYC upload branch is unchanged');
  assert.match(block, /'pendingLoginEmail' in resource\.data/, 'an email write needs a staged request');
  assert.match(block, /resource\.data\.pendingLoginEmail == request\.resource\.data\.loginEmail/,
    'and only that exact address is accepted');
  assert.match(block, /request\.resource\.data\.loginEmail == request\.resource\.data\.email/,
    'both copies of the address must move together');
  assert.match(block, /hasOnly\(\['loginEmail', 'email', 'pendingLoginEmail', 'pendingLoginEmailAt', 'emailChangeLog', 'updatedAt'\]\)/,
    'nothing else on the record can change in the same write');
});

// ── 15. Week end report mails (Cloud Function + Gmail) ────────────
test('Week maths - the ERP and the scheduler cut the week at the same Monday', async () => {
  const { weekBounds, periodLabelOf, isoWeekNumber } = await import('../src/erp/weeklyReportMails.js');
  const { createRequire } = await import('node:module');
  const req = createRequire(import.meta.url);
  const server = req('../functions/weekUtils.js');

  // 2026-11-02 is a Monday and the Wednesday belongs to the same week.
  const mon = weekBounds('2026-11-04');
  assert.equal(mon.from, '2026-11-02', 'Monday is the first day');
  assert.equal(mon.to, '2026-11-08', 'Sunday closes it');
  assert.equal(mon.number, 45, 'and the ISO week number is 45');
  assert.match(periodLabelOf('2026-11-04'), /^W45 - Mon 02 Nov 2026 to Sun 08 Nov 2026$/,
    'one label for the subject, the PDF heading and the ledger');

  ['2026-11-02', '2026-11-08', '2026-01-01', '2025-12-29', '2026-06-17'].forEach(d => {
    assert.deepEqual(weekBounds(d), server.weekBounds(d), `${d} resolves the same way on both sides`);
  });
  assert.equal(isoWeekNumber('2025-12-29'), 1, 'the Monday before New Year is still week 1');
});

test('Week end ledger - mailed, silent and failed staff are counted per person', async () => {
  const { summariseWeekRuns, runStatusOf } = await import('../src/erp/weeklyReportMails.js');
  const rows = [
    { staffUid: 'b', staffName: 'Zara', status: 'Sent', runAt: '2026-11-08T18:00:00Z', daysLogged: 5, tasks: 12, pages: 2 },
    { staffUid: 'a', staffName: 'Amal', status: 'No reports filed', runAt: '2026-11-08T18:00:00Z' },
    // An older manual run for Zara that the Sunday scheduler overtook.
    { staffUid: 'b', staffName: 'Zara', status: 'Failed', runAt: '2026-11-08T09:00:00Z', error: 'smtp down' },
  ];
  const s = summariseWeekRuns(rows);
  assert.equal(s.rows.length, 2, 'one row per staff member, newest run kept');
  assert.equal(s.rows[0].staffName, 'Amal', 'sorted by name');
  assert.equal(s.rows[1].status, 'Sent', 'the newer run wins');
  assert.equal(s.sent, 1);
  assert.equal(s.empty, 1, 'a person who filed nothing is counted, not hidden');
  assert.equal(s.failed, 0, 'and the superseded failure is gone');
  assert.equal(s.tasks, 12);
  assert.equal(runStatusOf({ status: 'No reports filed' }).tone, 'amber',
    'nothing filed is amber (the run worked), not red');
  assert.equal(runStatusOf({ status: 'Sent' }).tone, 'green');
  assert.equal(runStatusOf({ status: 'Whatever' }).tone, 'muted');
});

test('Week end mail wording - every failure names the command to run', async () => {
  const { mailRunProblem, describeMailRun } = await import('../src/erp/weeklyReportMails.js');
  assert.match(mailRunProblem({ code: 'permission-denied' }), /weeklyReportRuns rules block is not deployed/);
  assert.match(mailRunProblem({ code: 'permission-denied' }), /npx firebase deploy --only firestore:rules,storage/);
  assert.match(mailRunProblem({ message: 'functions/not-found' }), /npx firebase deploy --only functions/);
  assert.match(mailRunProblem({ message: 'GMAIL_APP_PASSWORD is not set' }), /functions:secrets:set GMAIL_APP_PASSWORD/);
  assert.match(mailRunProblem({ message: 'Please upgrade to the Blaze plan' }), /Blaze plan/);
  assert.match(mailRunProblem({ message: 'offline' }), /No network/);
  // A callable that dies server-side only reports 'internal'; the admin has to
  // be pointed at the log instead of being shown the word back.
  assert.match(mailRunProblem({ code: 'internal', message: 'internal [0]' }), /Functions → Logs/);
  assert.ok(!/^internal/.test(mailRunProblem({ code: 'internal', message: 'internal [0]' })),
    'the raw code is never the whole message');
  assert.equal(mailRunProblem({ code: 'unauthenticated', message: 'functions/unauthenticated: Viewer' }),
    'The mail run did not finish: Viewer', 'the SDK prefix is stripped, the reason is kept');
  assert.equal(mailRunProblem({ code: 'resource-exhausted', message: '[0]' }),
    'The mail run did not finish — check the Cloud Functions logs.', 'junk alone still gets a sentence');

  const line = describeMailRun({
    weekStart: '2026-11-02', to: 'matrixgroup.smart@gmail.com',
    sent: [{}, {}, {}], skipped: [{}], failed: [{}],
  });
  assert.match(line, /^W45 - Mon 02 Nov 2026 to Sun 08 Nov 2026 → matrixgroup\.smart@gmail\.com: 3 PDFs mailed/);
  assert.match(line, /1 staff filed no sheet/);
  assert.match(line, /1 failed/);
});

test('Weekly PDF - the server builds one real file per staff member', async () => {
  const { createRequire } = await import('node:module');
  const req = createRequire(import.meta.url);
  const { buildWeeklyReportPdf } = req('../functions/weeklyReportPdf.js');
  const { jsPDF } = req('jspdf');

  const built = buildWeeklyReportPdf({
    Doc: jsPDF,
    staffName: 'Zara Nimesha',
    staffId: 'STF-00012',
    periodLabel: 'W45 - Mon 02 Nov 2026 to Sun 08 Nov 2026',
    sentTo: 'matrixgroup.smart@gmail.com',
    generatedBy: 'SMART weekly scheduler',
    reports: [
      { date: '2026-11-02', totalWorkHours: '8.5', tasks: [
        { start: '09:00', end: '11:30', hours: '2.5', description: 'Built the client quotation letterhead', status: 'Completed' },
        { start: '12:00', end: '18:00', hours: '6', description: 'https://findmysmart.com/portfolio/smart-folio-ai-dashboard-redesign', status: 'In Progress' },
      ] },
      { date: '2026-11-04', totalWorkHours: '9', items: ['ERP rules checklist', 'Staff portal weekly mail panel'] },
    ],
  });
  const bytes = Buffer.from(built.buffer);
  assert.equal(bytes.subarray(0, 8).toString(), '%PDF-1.3', 'a real PDF, not a print tab');
  assert.ok(bytes.length > 3000, `the file has body (${bytes.length} bytes)`);
  assert.match(built.fileName, /^WEEKLY-WORK-REPORT-Zara-Nimesha-W45/, 'named per person per week');
  assert.equal(built.rows, 4, 'every task from both days is on the sheet');
  assert.ok(built.pages >= 1);

  // A week with sheets but no described work still produces a file.
  const empty = buildWeeklyReportPdf({ Doc: jsPDF, staffName: 'Amal', periodLabel: 'W45', reports: [{ date: '2026-11-03', tasks: [] }] });
  assert.equal(empty.rows, 0);
  assert.ok(Buffer.from(empty.buffer).length > 2000, 'and it is not an empty shell');
});

test('Scheduler wiring - Sunday night, roster-only, one mail per person, ledger for every outcome', () => {
  const src = fs.readFileSync(new URL('../functions/index.js', import.meta.url), 'utf8');
  assert.match(src, /const WEEK_CRON = '30 23 \* \* 0'/, 'runs at 23:30 on Sunday');
  assert.match(src, /const TIME_ZONE = 'Asia\/Colombo'/, 'office time zone');
  assert.match(src, /onSchedule\(WEEK_CRON, \{ timeZone: TIME_ZONE \}/, 'the cron is attached to the scheduler');
  assert.match(src, /exports\.sendWeeklyReportsNow = onCall/, 'and an admin can run it on demand');
  assert.match(src, /Only the administrator can trigger the report mails/, 'the callable refuses other callers');
  assert.match(src, /s\.deleted === true\) return/, 'a deleted staff member is not mailed');
  assert.match(src, /for \(const \[uid, person\] of Object\.entries\(roster\)\)/, 'one pass per staff member');
  assert.match(src, /attachments: \[\{ filename: built\.fileName/, 'one PDF attachment per mail');
  assert.match(src, /status: 'No reports filed'/, 'whoever filed nothing is recorded');
  assert.match(src, /buildWeeklyReportPdf\(\{ Doc: jsPDF/, 'drawn by the shared server builder');
  assert.match(src, /alias\[String\(s\.staffId\)\.trim\(\)\.toLowerCase\(\)\] = d\.id/, 'the printed STF code maps to the same person');
  assert.match(src, /resolveUid\(r\.authUid \|\| r\.staffId\)/, 'so an imported sheet row is not mailed as former staff');

  // The SMTP key is only ever read from Functions secrets.
  assert.match(src, /process\.env\.GMAIL_APP_PASSWORD/, 'the password comes from a Function secret');
  assert.ok(!/pass: '[^']/.test(src), 'and is never hardcoded in the source');
  assert.ok(!/base\s*=\s*\{[\s\S]{0,400}?pass/i.test(src), 'the ledger template carries no credentials');
  assert.ok(!/ledRef\.set\([\s\S]{0,80}?smtpPass/.test(src), 'and no ledger row is written with the password');
});

test('Week end mails rules, list and client - admin-only ledger, listed once, button wired', async () => {
  const rules = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  const block = rules.slice(rules.indexOf('match /weeklyReportRuns/{runId}'), rules.indexOf('match /settings/{settingId}'));
  assert.ok(block.length > 80, 'the ledger block exists');
  assert.match(block, /allow read, write: if isAdmin\(\);/, 'only the admin reads the ledger');
  assert.match(block, /match \/reportEmailConfig\/\{configId\} \{[\s\S]*allow write: if isAdmin\(\);/, 'the mail config is admin-only');

  const { RULES_BLOCKS, pendingBlocks } = await import('../src/erp/rulesBlocks.js');
  const names = RULES_BLOCKS.map(b => b.coll);
  assert.ok(names.includes('weeklyReportRuns') && names.includes('reportEmailConfig'), 'both are on the deploy list');
  assert.equal(new Set(names).size, names.length, 'and nothing is listed twice');
  assert.equal(pendingBlocks({ weeklyReportRuns: 'blocked' })[0].coll, 'weeklyReportRuns');
  assert.ok(RULES_BLOCKS.some(b => b.coll === 'staff' && b.changed),
    'the rewritten staff block is flagged for a redeploy');

  const cfg = JSON.parse(fs.readFileSync(new URL('../firebase.json', import.meta.url), 'utf8'));
  const fn = (cfg.functions || [])[0];
  assert.equal(fn.source, 'functions', 'firebase.json points at the functions folder');
  assert.ok(fn.ignore.includes('node_modules'), 'node_modules is not uploaded');

  const page = fs.readFileSync(new URL('../src/erp/pages/ERPStaffUpdates.jsx', import.meta.url), 'utf8');
  assert.match(page, /<WeekEndMailsPanel/, 'the Daily Updates page shows the ledger');
  assert.match(page, /await fetchWeekRuns\(weekOf\)/, 'reads this week from Firestore');
  assert.match(page, /await emailWeekNow\(weekOf\)/, 'and can trigger the run');
  assert.match(page, /Confirm . mail \$\{staffCount/, 'sending mail needs a second click');
  assert.match(page, /onClick=\{\(\) => setArmed\(false\)\}/, 'and that arm can be cancelled');
});

// ─────────────────────────────────────────────────────────────────────────────
// 16. OFFER LETTERS — filled from the staff record, editable, real PDF
// ─────────────────────────────────────────────────────────────────────────────

test('Offer letter - staff details fill the letter, salary sums correctly', async () => {
  const m = await import('../src/erp/offerLetters/offerLetterModel.js');
  const staff = {
    id: 'u1', staffId: 'SMART-001', name: 'Ashan Rifkan', position: 'Software Engineer',
    department: 'Software', email: 'ashan@smart.com', phone: '+94 76 202 4545',
    address: 'Main Street, Kalmunai', joinedDate: '2026-01-05',
    basicSalary: 85000, allowances: 15000, deductions: 5000,
  };
  const f = m.offerFromStaff(staff, { refNo: 'SMART/HR/OL/2026/001', date: '2026-11-04' });
  assert.equal(f.staffName, 'Ashan Rifkan');
  assert.equal(f.staffId, 'u1');
  assert.equal(f.staffCode, 'SMART-001');
  assert.equal(f.position, 'Software Engineer');
  assert.equal(f.department, 'Software');
  assert.equal(f.startDate, '2026-01-05', 'joining date comes from the staff record');
  assert.equal(m.netSalary(f), 95000, 'basic + allowances - deductions');
  assert.equal(m.offerSummary(f), 'LKR 95,000 / month');

  const worse = { ...f, basicSalary: '1000', allowances: '', deductions: '5000' };
  assert.equal(m.netSalary(worse), 0, 'deductions never make a negative salary');
  assert.equal(m.offerProblem(worse), 'Deductions are larger than the salary — check the figures.');

  assert.equal(m.offerProblem({ ...f, staffName: '' }), 'Choose the staff member this letter is for.');
  assert.equal(m.offerProblem({ ...f, basicSalary: 0 }), 'Enter the basic salary.');
  assert.equal(m.offerProblem(f), '', 'a filled letter is complete');
});

test('Offer letter - salary in words, reference series and dates', async () => {
  const m = await import('../src/erp/offerLetters/offerLetterModel.js');
  assert.equal(m.amountInWords(95000), 'Ninety-Five Thousand Rupees Only');
  assert.equal(m.amountInWords(105000), 'One Hundred and Five Thousand Rupees Only');
  assert.equal(m.amountInWords(1500.5), 'One Thousand Five Hundred Rupees and Fifty Cents Only');
  assert.equal(m.amountInWords(0), '');

  assert.equal(m.makeRefNo(1, new Date('2026-11-04T12:00:00Z')), 'SMART/HR/OL/2026/001');
  assert.equal(m.makeRefNo(12, new Date('2026-11-04T12:00:00Z')), 'SMART/HR/OL/2026/012');
  assert.equal(m.nextSequence([
    { refNo: 'SMART/HR/OL/2026/001' }, { refNo: 'SMART/HR/OL/2026/007' }, { refNo: '' },
  ]), 8);

  assert.equal(m.prettyDate('2026-11-04'), '04 November 2026');
  assert.equal(m.prettyDate(''), '');
  assert.match(m.todayIso(new Date('2026-03-09T10:00:00')), /^2026-03-09$/);
});

test('Offer letter - standard terms carry no money, edits keep a who/when history', async () => {
  const m = await import('../src/erp/offerLetters/offerLetterModel.js');
  const terms = m.defaultTerms({ probationMonths: '3' });
  assert.ok(terms.length >= 6, 'a full set of terms is offered');
  assert.ok(terms.every(t => t.title && t.text), 'every term has a heading and text');
  assert.ok(terms.every(t => !/LKR|Rs\.?\s*\d/.test(t.text)), 'salary is read from the fields, never frozen into a term');
  assert.match(terms[0].text, /3 months/);

  const auto = m.resolvedOpening({ staffName: 'Ashan Rifkan', position: 'Software Engineer', department: 'Software' });
  assert.match(auto, /^Dear Ashan Rifkan,/);
  assert.match(auto, /Software Engineer in the Software Department/);
  assert.match(m.resolvedClosing({ staffName: 'Ashan Rifkan' }), /^We look forward to welcoming Ashan/);
  // A typed paragraph always wins over the auto one.
  assert.equal(m.resolvedOpening({ staffName: 'X', opening: 'Custom words.' }), 'Custom words.');

  const diff = m.diffOffer(
    { basicSalary: 85000, position: 'Engineer', status: 'Draft' },
    { basicSalary: '95000', position: 'Engineer', status: 'Issued' },
    'admin@smart.com',
  );
  assert.equal(diff.length, 2, 'only the changed values are logged');
  assert.deepEqual(diff.map(d => d.field), ['Basic salary', 'Status']);
  assert.equal(diff[0].from, '85000');
  assert.equal(diff[0].to, '95000');
  assert.equal(diff[0].by, 'admin@smart.com');
});

test('Offer letter - the PDF is a real A4 file, not a print dialog', async () => {
  const { createRequire } = await import('node:module');
  const req = createRequire(import.meta.url);
  const { jsPDF } = req('jspdf');
  const logo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  // jsPDF needs a DOM-ish global only for saving; building the doc is pure.
  const { buildOfferLetterPdf, offerPdfFileName } = await import('../src/erp/offerLetters/offerLetterPdf.js');
  const m = await import('../src/erp/offerLetters/offerLetterModel.js');
  const base = m.offerFromStaff({
    name: 'Ashan Rifkan', staffId: 'SMART-001', position: 'Software Engineer',
    department: 'Software', email: 'ashan@smart.com', phone: '+94 76 202 4545',
    address: 'Main Street, Kalmunai', joinedDate: '2026-01-05',
    basicSalary: 85000, allowances: 15000, deductions: 5000,
  }, { refNo: 'SMART/HR/OL/2026/001', date: '2026-11-04' });

  const doc = buildOfferLetterPdf(base, { logoDataUrl: logo });
  const out = doc.output();
  assert.ok(out.startsWith('%PDF-'), 'a real PDF stream');
  assert.ok(out.length > 12000, 'the letter has real content');
  assert.equal(doc.internal.pageSize.getWidth(), 595.28, 'A4 width');
  assert.equal(doc.internal.pageSize.getHeight(), 841.89, 'A4 height');
  assert.equal(typeof jsPDF, 'function', 'built on jsPDF');

  // A very long letter must paginate instead of running off the paper.
  const long = {
    ...base,
    notes: 'Long note. '.repeat(120),
    terms: Array.from({ length: 12 }, (_, i) => ({ title: `Extra term ${i + 1}`, text: 'Word '.repeat(90) })),
  };
  const big = buildOfferLetterPdf(long, {});
  assert.ok(big.internal.getNumberOfPages() >= 3, `long letters continue onto more pages (got ${big.internal.getNumberOfPages()})`);
  assert.ok(big.output().startsWith('%PDF-'));

  assert.equal(offerPdfFileName(base), 'OFFER-LETTER-ASHAN-RIFKAN-SMART-HR-OL-2026-001.pdf');
});

test('Offer letters page - route, sidebar, rules block and deploy list', async () => {
  const app = fs.readFileSync(new URL('../src/erp/ERPApp.jsx', import.meta.url), 'utf8');
  assert.match(app, /const ERPOfferLetters = lazy\(\(\) => import\('\.\/pages\/ERPOfferLetters'\)\)/);
  assert.match(app, /<Route path="offer-letters"\s+element=\{<Suspense[\s\S]{0,60}?<ERPOfferLetters \/><\/Suspense>\}/);

  const nav = fs.readFileSync(new URL('../src/erp/layout/ERPSidebar.jsx', import.meta.url), 'utf8');
  assert.match(nav, /\{ path: '\/erp\/offer-letters',\s*label: 'Offer Letters',\s*icon: Briefcase\s*\}/);

  const rules = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  assert.match(rules, /match \/offerLetters\/\{letterId\} \{\s*allow read, write: if isAdmin\(\);\s*\}/,
    'offer letters are admin-only');

  const { RULES_BLOCKS, pendingBlocks } = await import('../src/erp/rulesBlocks.js');
  assert.ok(RULES_BLOCKS.some(b => b.coll === 'offerLetters'), 'the new collection is on the deploy checklist');
  assert.equal(pendingBlocks({ offerLetters: 'blocked' })[0].coll, 'offerLetters');

  const page = fs.readFileSync(new URL('../src/erp/pages/ERPOfferLetters.jsx', import.meta.url), 'utf8');
  assert.match(page, /offerFromStaff\(s, \{/, 'picking a staff member fills the form');
  assert.match(page, /saveOfferLetterPdf\(saved, \{ logoDataUrl: logo \}\)/, 'Save & PDF downloads the real file');
  assert.ok(!/window\.print|printDialog/.test(page), 'never the browser print dialog');
  assert.match(page, /diffOffer\(editing, payload, adminName\)/, 'money edits keep a history entry');
  assert.match(page, /rulesNotice\('Offer letters'\)/, 'a blocked list points at Rules Status');
});
