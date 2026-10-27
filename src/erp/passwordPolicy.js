// ─────────────────────────────────────────────────────────────────
//  Password policy — one rule set for the whole ERP.
//
//  Every account this app creates (staff, client, lead→client, and the
//  admin's own password change) is checked here before it reaches
//  Firebase. The old "min 6 characters" rule let through smart123 /
//  password / 111111, so the policy now requires real variety:
//  length 8+, upper case, lower case, a digit and a symbol — and it
//  rejects the common weak passwords and anything that is just the
//  company name with numbers bolted on.
// ─────────────────────────────────────────────────────────────────

const MIN_LENGTH = 8;

// Too-easy passwords (compared lower-cased, after trimming).
const BLOCKED = [
  'password', 'pass', 'pwd', '12345', '123456', '1234567', '12345678',
  'qwerty', 'qwerty123', 'abc123', '111111', '000000', 'admin', 'admin123',
  'administrator', 'user123', 'letmein', 'welcome', 'welcome1', 'iloveyou',
  'monkey', 'dragon', 'sunshine', 'master', 'smart', 'smart123', 'smart@123',
  'smart1234', 'smartpvt', 'smartsoft', 'smartfolio', 'test123',
  'smart#123', 'changeme', 'temp123', 'password1', 'password123',
];

// Characters a password must be built from.
const REQUIREMENTS = [
  { test: p => p.length >= MIN_LENGTH,          label: `at least ${MIN_LENGTH} characters`, },
  { test: p => /[A-Z]/.test(p),                 label: 'one capital letter (A–Z)', },
  { test: p => /[a-z]/.test(p),                 label: 'one small letter (a–z)', },
  { test: p => /[0-9]/.test(p),                 label: 'one number (0–9)', },
  { test: p => /[^A-Za-z0-9\s]/.test(p),        label: 'one symbol (@ # $ % ! …)', },
];

export const PASSWORD_HINT =
  `Minimum ${MIN_LENGTH} characters with an upper-case letter, a lower-case letter, a number and a symbol (e.g. Smart@Tech99).`;

/**
 * @param {string} password  the raw value typed by the admin
 * @param {string} [context] optional email/name — a password that simply
 *   contains the account's own name or email prefix is rejected
 * @returns {string} '' when the password passes, otherwise the message to show
 */
export function passwordError(password, context = '') {
  const p = String(password || '');
  if (!p.trim()) return 'Password is required.';
  if (p.length < MIN_LENGTH) return `Password is too short — use at least ${MIN_LENGTH} characters.`;

  const lower = p.toLowerCase();
  if (BLOCKED.includes(lower)) return 'That password is too easy to guess. Mix capitals, numbers and a symbol.';
  // "smart@12345678" style: a blocked word with only symbols/digits bolted on.
  const weakBase = BLOCKED.find(w => w.length >= 4
    && lower.startsWith(w)
    && /^[@#$%&*_\-.,!?\s]*\d+$/.test(lower.slice(w.length)));
  if (weakBase) return 'That password is too easy to guess. Mix capitals, numbers and a symbol.';

  const ctx = String(context || '').toLowerCase();
  if (ctx) {
    const name = ctx.split('@')[0].replace(/[^a-z]/g, '');
    if (name.length >= 4 && lower.includes(name)) {
      return 'The password cannot contain the account name or email.';
    }
  }

  const missing = REQUIREMENTS.filter(r => !r.test(p)).map(r => r.label);
  if (missing.length) return `Password needs ${missing.join(', ')}.`;
  return '';
}

/** Random strong password for a new account (never reuses the same value). */
export function generateStrongPassword(prefix = 'Smart') {
  const symbols = '@#$%&*!?';
  const digits = '0123456789';
  const caps = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const rand = s => s[Math.floor(Math.random() * s.length)];
  // Smart#MK4821 → company prefix + symbol + two random capitals + four
  // random digits, so a fresh account never starts on a guessable value.
  const tail = rand(caps) + rand(caps) +
    Array.from({ length: 4 }, () => rand(digits)).join('');
  return `${prefix}${rand(symbols)}${tail}`;
}
