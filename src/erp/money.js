// ─────────────────────────────────────────────────────────────────
//  Integer LKR money helpers.
//  All amounts in the ERP are whole rupees (integers) — never floats —
//  so totals, advances, balances and receipts always reconcile exactly.
// ─────────────────────────────────────────────────────────────────

/** Parse any user input / Firestore value into a whole-rupee integer. */
export function toInt(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : 0;
  if (typeof v !== 'string') return 0;
  const n = parseInt(v.replace(/[^0-9-]/g, ''), 10);
  return Number.isNaN(n) ? 0 : n;
}

/** 85000 → "LKR 85,000" */
export function formatLKR(v) {
  return `LKR ${toInt(v).toLocaleString('en-US')}`;
}

/** 'yyyy-mm-dd' → 'Oct 6, 2026' (returns '' for falsy input, never crashes) */
export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? String(iso)
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Today as 'yyyy-mm-dd' for date inputs. */
export const todayISO = () => new Date().toISOString().slice(0, 10);
