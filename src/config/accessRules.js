// ─────────────────────────────────────────────────────────────────
//  Default Access Control Rules & Permissions Configuration
//  Admins manage these in ERP → Access Rules (/erp/access-rules).
//  Stored in Firestore at settings/accessRules.
// ─────────────────────────────────────────────────────────────────

export const DEFAULT_ACCESS_RULES = {
  // ── Staff Portal Permissions ───────────────────────────────────
  // When enabled/accepted by admin, staff can view client projects
  // When disabled/restricted, staff access to client pages is blocked
  allowStaffClientProjects: true,
  allowStaffDailyLog: true,
  allowStaffWork: true,
  allowStaffAttendance: true,
  allowStaffSalary: true,
  allowStaffDocuments: true,
  allowStaffMessages: true,

  // ── Client Portal Permissions ──────────────────────────────────
  allowClientProjects: true,
  allowClientQuotations: true,
  allowClientPayments: true,
  allowClientForms: true,
  allowClientMessages: true,

  // ── Member-specific overrides ──────────────────────────────────
  // { [uid]: { status: 'active' | 'restricted' | 'suspended', allowClientProjects?: boolean, ... } }
  memberOverrides: {},

  updatedAt: null,
  updatedBy: 'admin',
};

export const STAFF_PERMISSION_DEFINITIONS = [
  {
    key: 'allowStaffClientProjects',
    label: 'Client & Projects Page Access',
    category: 'Clients',
    description: 'Allow staff to view Client Projects directory, client requirements, and project scope. If restricted, staff portal locks this section.',
    badge: 'Key Rule',
  },
  {
    key: 'allowStaffDailyLog',
    label: 'Daily Routine Work Log',
    category: 'Work Reports',
    description: 'Allow staff to fill, submit, and view their daily routine work reports (start time, end time, lunch break, status).',
  },
  {
    key: 'allowStaffWork',
    label: 'Assigned Work & Tasks',
    category: 'Work Reports',
    description: 'Allow staff to view assigned projects and update task progress.',
  },
  {
    key: 'allowStaffAttendance',
    label: 'Attendance Check-in / Check-out',
    category: 'Time & Attendance',
    description: 'Allow staff to record daily check-in, check-out, and view attendance logs.',
  },
  {
    key: 'allowStaffSalary',
    label: 'Salary & Payslips',
    category: 'Compensation',
    description: 'Allow staff to view monthly earnings breakdown and download PDF payslips.',
  },
  {
    key: 'allowStaffDocuments',
    label: 'KYC & Certificate Uploads',
    category: 'Profile',
    description: 'Allow staff to upload and view verified KYC and education certificates.',
  },
  {
    key: 'allowStaffMessages',
    label: 'Direct Admin Messaging',
    category: 'Communication',
    description: 'Allow staff to initiate and respond to chat messages with the administrator.',
  },
];

export const CLIENT_PERMISSION_DEFINITIONS = [
  {
    key: 'allowClientProjects',
    label: 'Projects & Milestones',
    category: 'Projects',
    description: 'Allow client to monitor project progress, deliverables, and milestones.',
  },
  {
    key: 'allowClientQuotations',
    label: 'Quotations & Approvals',
    category: 'Commercials',
    description: 'Allow client to review project quotations, scope items, and accept quotes online.',
  },
  {
    key: 'allowClientPayments',
    label: 'Payments & Receipts',
    category: 'Commercials',
    description: 'Allow client to view payments, pending balance, and download official receipts.',
  },
  {
    key: 'allowClientForms',
    label: 'Requirement Questionnaires',
    category: 'Onboarding',
    description: 'Allow client to complete service requirement checklists and forms.',
  },
  {
    key: 'allowClientMessages',
    label: 'Direct Admin Messaging',
    category: 'Communication',
    description: 'Allow client to send direct messages to the SMART administration team.',
  },
];
