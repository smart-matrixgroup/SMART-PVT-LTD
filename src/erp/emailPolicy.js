// ─────────────────────────────────────────────────────────────────
//  Login email checks.
//  The staff / client sign-in address is typed by the admin, so the same
//  format rule is used by the Add/Edit form, the "change email" modal and
//  the staff portal confirmation. Pure text in, text out — no firebase —
//  so the QA suite can test it directly.
// ─────────────────────────────────────────────────────────────────

// '' when the address is usable, otherwise the line to show the admin.
export const emailError = (value = '') => {
  const v = String(value).trim();
  if (!v) return 'Email id is required.';
  if (/\s/.test(v)) return 'Email id cannot contain spaces.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Enter a valid email id, like name@company.com';
  return '';
};

// Firebase emails are case-insensitive, so "Kasun@Smart.com" and
// "kasun@smart.com" are the same account.
export const sameEmail = (a, b) =>
  String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

// The address a staff record currently signs in with.
export const loginMailOf = (s = {}) => String(s.loginEmail || s.email || '').trim();
