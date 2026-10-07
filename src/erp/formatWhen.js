/** Safe display of Firestore Timestamp | Date | string — never pass raw objects into JSX. */
export function formatWhen(val) {
  if (val == null || val === '') return '';
  if (typeof val === 'string' || typeof val === 'number') return String(val);
  try {
    if (typeof val.toDate === 'function') return val.toDate().toLocaleString();
    if (typeof val.seconds === 'number') return new Date(val.seconds * 1000).toLocaleString();
    if (val instanceof Date) return val.toLocaleString();
  } catch { /* ignore */ }
  return '';
}

export function toMillis(val) {
  if (val == null || val === '') return 0;
  if (typeof val === 'number') return val;
  try {
    if (typeof val.toMillis === 'function') return val.toMillis();
    if (typeof val.toDate === 'function') return val.toDate().getTime();
    if (typeof val.seconds === 'number') return val.seconds * 1000;
    if (val instanceof Date) return val.getTime();
    const parsed = Date.parse(val);
    return Number.isNaN(parsed) ? 0 : parsed;
  } catch {
    return 0;
  }
}
