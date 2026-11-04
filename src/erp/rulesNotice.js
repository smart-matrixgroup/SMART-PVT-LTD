// ─────────────────────────────────────────────────────────────────
//  One wording for every "security rules are not deployed yet" banner.
//
//  Each page used to print its own long sentence with a firebase command
//  pasted inside it, so the admin saw the same problem twelve times in
//  twelve different phrasings. Now a page says what is blocked in one
//  line and points at Settings → Rules Status — the single checklist that
//  probes every collection, marks the ones that are live, and carries the
//  deploy command once.
//
//  This module is pure text on purpose (no firebase import), so utility
//  files and the QA test suite can use it too.
// ─────────────────────────────────────────────────────────────────

export const RULES_PAGE = 'Settings → Rules Status';

/** Admin-side banner: name the feature, the page says where to fix it. */
export const rulesNotice = what => `${what} is blocked by the live security rules — check ${RULES_PAGE}.`;

/** Staff-side banner: staff cannot deploy anything, their admin can. */
export const staffRulesNotice = what => `${what} needs newer security rules — ask your admin to open ${RULES_PAGE}.`;

/**
 * The page already loaded another admin-only list fine, so isAdmin() passes
 * on the live rules. A refusal here can only mean the deployed rules have no
 * block for THIS collection yet — say that, or the admin wastes time signing
 * in as somebody else.
 */
export const rulesMissingBlockNotice = what =>
  `${what} is blocked: this admin account reads the other lists fine, so the live rules are just missing this collection's block. Open ${RULES_PAGE} — it lists the missing block and the deploy command.`;

/** Nothing admin-only loads: the signed-in account itself is refused. */
export const rulesNotAdminNotice = what =>
  `${what} is blocked and the other admin lists are refused too — this account is not an admin on the live rules. Sign in as an admin, then open ${RULES_PAGE}.`;

/** True when a firebase error means "the deployed rules refuse this". */
export const isRulesDenied = err =>
  err?.code === 'permission-denied' || /insufficient permissions/i.test(String(err?.message || ''));
