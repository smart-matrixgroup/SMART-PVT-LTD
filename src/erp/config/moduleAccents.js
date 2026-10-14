// Single unified accent theme for the ERP (admin) shell.
// User wanted ONE colour across all modules (no per-module colour
// difference) — but made more vibrant and alive. Kept as a map +
// helper so the layout/sidebar/topbar wiring stays the same.

// Vivid blue → cyan → soft violet = "colourful" but one consistent theme.
export const DEFAULT_ACCENT = { from: '#0A84FF', to: '#00D9FF' };

// Empty map on purpose: every path falls back to DEFAULT_ACCENT,
// so all modules share the same colour as requested.
export const MODULE_ACCENTS = {};

// accent for the current path (always the unified DEFAULT_ACCENT)
export function accentForPath() {
  return DEFAULT_ACCENT;
}
