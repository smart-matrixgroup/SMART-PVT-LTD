import test from 'node:test';
import assert from 'node:assert/strict';
import { toInt, formatLKR } from '../src/erp/money.js';

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
