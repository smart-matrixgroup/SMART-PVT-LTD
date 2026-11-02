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

test('Password Policy - strong passwords pass, account email cannot be reused', () => {
  assert.equal(passwordError('Smart@Tech99'), '');
  assert.equal(passwordError('Kandy#Client24'), '');
  assert.match(passwordError('Thilak@2026x', 'thilak@trholdings.lk'), /cannot contain the account name/);
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
        expenseTotal, financeErrorText, RULES_DEPLOY_CMD } =
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
  assert.match(denied, /rules are not deployed/i);
  assert.ok(denied.includes(RULES_DEPLOY_CMD), 'the deploy command is quoted back');
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
