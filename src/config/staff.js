// ============================================================
//  SMART PVT LTD — Staff Profiles
//
//  HOW TO ADD A NEW STAFF MEMBER:
//  1. Below array-ல் new object add பண்ணு
//  2. id        → unique (STAFF-XXX format)
//  3. name      → full name
//  4. role      → job title
//  5. skills    → array of skill strings
//  6. email     → work email
//  7. phone     → contact number
//  8. avatar    → first letter of name (auto-used for avatar)
//  9. status    → 'active' | 'busy' | 'on-leave'
//  10. firestoreUid → Firebase Auth UID (set when staff Firebase
//                     account is created — leave '' until then)
//
//  When Firebase is ready: store in Firestore 'staff/{uid}' collection
//  and read from there instead of this file.
// ============================================================

export const staffList = [
  {
    id:           'STAFF-001',
    name:         'Ashan Perera',
    role:         'Full Stack Developer',
    department:   'Engineering',
    skills:       ['React', 'Node.js', 'Firebase', 'PostgreSQL'],
    email:        'ashan@smartpvtltd.com',
    phone:        '+94 77 111 2233',
    avatar:       'A',
    avatarColor:  'bg-blue-500',
    status:       'active',
    joinedDate:   'January 2024',
    firestoreUid: '',
  },
  {
    id:           'STAFF-002',
    name:         'Nimal Fernando',
    role:         'UI/UX Designer',
    department:   'Design',
    skills:       ['Figma', 'Tailwind CSS', 'Adobe XD', 'React'],
    email:        'nimal@smartpvtltd.com',
    phone:        '+94 76 222 3344',
    avatar:       'N',
    avatarColor:  'bg-violet-500',
    status:       'active',
    joinedDate:   'March 2024',
    firestoreUid: '',
  },
  {
    id:           'STAFF-003',
    name:         'Kavitha Rajah',
    role:         'Accounting & Tax Consultant',
    department:   'Finance',
    skills:       ['IRD Filing', 'VAT', 'Financial Statements', 'Audit'],
    email:        'kavitha@smartpvtltd.com',
    phone:        '+94 75 333 4455',
    avatar:       'K',
    avatarColor:  'bg-emerald-500',
    status:       'active',
    joinedDate:   'June 2024',
    firestoreUid: '',
  },
  {
    id:           'STAFF-004',
    name:         'Ruwan Silva',
    role:         'Mobile App Developer',
    department:   'Engineering',
    skills:       ['React Native', 'Android', 'iOS', 'Firebase'],
    email:        'ruwan@smartpvtltd.com',
    phone:        '+94 71 444 5566',
    avatar:       'R',
    avatarColor:  'bg-amber-500',
    status:       'busy',
    joinedDate:   'August 2024',
    firestoreUid: '',
  },
  {
    id:           'STAFF-005',
    name:         'Dilani Wickrama',
    role:         'Project Manager',
    department:   'Operations',
    skills:       ['Project Planning', 'Client Communication', 'Agile', 'Jira'],
    email:        'dilani@smartpvtltd.com',
    phone:        '+94 77 555 6677',
    avatar:       'D',
    avatarColor:  'bg-rose-500',
    status:       'active',
    joinedDate:   'February 2024',
    firestoreUid: '',
  },

  // ── ADD NEW STAFF HERE ──────────────────────────────────────
  // {
  //   id:           'STAFF-006',
  //   name:         'Staff Name',
  //   role:         'Job Title',
  //   department:   'Department',
  //   skills:       ['Skill 1', 'Skill 2'],
  //   email:        'staff@smartpvtltd.com',
  //   phone:        '+94 77 000 0000',
  //   avatar:       'S',
  //   avatarColor:  'bg-cyan-500',
  //   status:       'active',
  //   joinedDate:   'Month Year',
  //   firestoreUid: '',
  // },
];

// ── Helpers ───────────────────────────────────────────────────
export const getStaffById     = (id)  => staffList.find(s => s.id === id) || null;
export const getActiveStaff   = ()    => staffList.filter(s => s.status !== 'on-leave');
export const getStaffByIds    = (ids) => ids.map(id => getStaffById(id)).filter(Boolean);

export const STATUS_COLORS = {
  'active':   'bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30',
  'busy':     'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
  'on-leave': 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30',
};
