// ─────────────────────────────────────────────────────────────────
//  Shared "IT TEAM DAILY WORK LOG" sheet builder.
//
//  Builds the exact same real .xlsx workbook (coloured banners, merged
//  title, borders, column widths, STATUS dropdown) that Admin downloads
//  from ERPStaffUpdates — but here so BOTH the admin AND the staff portal
//  can generate the identical pre-filled sheet from a plain
//  { period, rangeStart } description. Nobody needs the raw file to be
//  stored: the sheet is regenerated on demand from the request metadata.
//
//  exceljs is loaded lazily (dynamic import → its own chunk), so it never
//  lands in the main bundle.
// ─────────────────────────────────────────────────────────────────
import { getDayName } from './staffUtils';

const pad2 = n => String(n).padStart(2, '0');
const isoAdd = (dStr, n) => {
  const [y, m, d] = dStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
};
const endOfMonth = dStr => {
  const [y, m] = dStr.split('-').map(Number);
  const dt = new Date(y, m, 0);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
};
const monthLabel = dStr => {
  const [y, m] = dStr.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
};
const fmtShort = dStr => {
  const [y, m, d] = dStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

/** 'yyyy-mm-dd' range end for a period starting at rangeStart. */
export const rangeEndFor = (period, rangeStart) =>
  period === 'week' ? isoAdd(rangeStart, 6) : endOfMonth(rangeStart);

/** Human label, e.g. "13 Oct – 19 Oct, 2026" or "October 2026". */
export const rangeLabelFor = (period, rangeStart) => {
  const end = rangeEndFor(period, rangeStart);
  return period === 'week'
    ? `${fmtShort(rangeStart)} – ${fmtShort(end)}, ${end.slice(0, 4)}`
    : monthLabel(rangeStart);
};

/** Build the workbook AND trigger a browser download. `staff` may be
 *  { name, position, location } (pre-filled) or {} for a blank template. */
export async function downloadWorkLogSheet(staff, { period = 'week', rangeStart }) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SMART ERP';
  const ws = wb.addWorksheet('DAILY WORK LOG', { views: [{ showGridLines: false }] });

  const NAVY = 'FF1F4E79', BLUE = 'FF2E75B6', GREY = 'FFF2F2F2', GREEN = 'FFE2EFDA', LGREY = 'FFD9D9D9';
  const THIN = { style: 'thin', color: { argb: 'FFBFBFBF' } };
  const border = { top: THIN, left: THIN, bottom: THIN, right: THIN };
  const fill = argb => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dateTxt = d => { const [y, m, dd] = d.split('-').map(Number); return `${pad2(dd)}-${MON[m - 1]}-${y}`; };

  const s = staff || {};
  const isPersonal = !!s.name;
  const monthName = monthLabel(rangeStart);
  const rangeLabel = rangeLabelFor(period, rangeStart);

  ws.columns = [{ width: 17 }, { width: 22 }, { width: 18 }, { width: 18 }, { width: 42 }, { width: 14 }];

  const put = (R, C, value, o = {}) => {
    const cell = ws.getCell(R, C);
    if (value !== undefined && value !== null && value !== '') cell.value = value;
    if (o.border !== false) cell.border = border;
    if (o.fill) cell.fill = fill(o.fill);
    cell.font = { name: 'Calibri', size: o.size || 11, bold: !!o.bold, italic: !!o.italic, color: { argb: o.color || 'FF1F1F1F' } };
    cell.alignment = { horizontal: o.align || 'left', vertical: 'middle', wrapText: !!o.wrap };
    return cell;
  };
  const mergePut = (R, c1, c2, value, o = {}) => {
    ws.mergeCells(R, c1, R, c2);
    for (let c = c1; c <= c2; c++) put(R, c, c === c1 ? value : '', o);
    return ws.getCell(R, c1);
  };
  const label = (R, C, text) => put(R, C, text, { fill: GREY, bold: true, size: 10 });
  const boxValue = (R, C, value = '', o = {}) => put(R, C, value, { fill: o.fill || GREEN, ...o });

  let r = 1;
  mergePut(r, 1, 6, 'SMART PVT LTD • IT TEAM DAILY WORK LOG', { fill: NAVY, color: 'FFFFFFFF', bold: true, size: 14, align: 'center' });
  ws.getRow(r).height = 26; r++;
  mergePut(r, 1, 6, 'Staff Profile — enter your details once here, they appear on every day automatically', { italic: true, align: 'center', color: 'FF595959', border: false }); r++;

  label(r, 1, 'NAME :');        boxValue(r, 2, s.name || '');     label(r, 4, 'MONTH :');      boxValue(r, 5, monthName); r++;
  label(r, 1, 'POSITION :');    boxValue(r, 2, s.position || ''); label(r, 4, 'DEPARTMENT :'); boxValue(r, 5, ''); r++;
  label(r, 1, 'JOB LOCATION :');boxValue(r, 2, s.location || ''); label(r, 4, 'TOTAL HOURS :');boxValue(r, 5, ''); r++;
  r++;

  const dayBlock = (dateStr, isFirst) => {
    mergePut(r, 1, 6, `SMART PVT LTD • DAILY WORK REPORT - ${dateTxt(dateStr)} (${getDayName(dateStr).slice(0, 3)})`, { fill: NAVY, color: 'FFFFFFFF', bold: true, size: 12, align: 'center' });
    ws.getRow(r).height = 22; r++;
    label(r, 1, 'NAME :');        boxValue(r, 2, s.name || '');     label(r, 4, 'DATE :'); boxValue(r, 5, dateTxt(dateStr)); r++;
    label(r, 1, 'POSITION :');    boxValue(r, 2, s.position || ''); label(r, 4, 'DAY :');  boxValue(r, 5, getDayName(dateStr)); r++;
    label(r, 1, 'LOCATION :');    boxValue(r, 2, s.location || ''); label(r, 4, 'WORK MODE :');
    const wm = boxValue(r, 5, 'Office'); wm.dataValidation = { type: 'list', allowBlank: true, formulae: ['"Office,On-Site,Remote / WFH,Hybrid"'] }; r++;
    ['ARRIVAL', 'LUNCH START', 'LUNCH END', 'LUNCH DURATION', 'DEPARTURE', 'TOTAL WORK HRS']
      .forEach((h, i) => put(r, i + 1, h, { fill: BLUE, color: 'FFFFFFFF', bold: true, size: 10, align: 'center', wrap: true }));
    r++;
    for (let c = 1; c <= 6; c++) put(r, c, '', { fill: c === 4 ? LGREY : undefined, align: 'center' });
    r++;
    ['NO', 'START', 'END', 'HOURS', 'WORK / DESCRIPTION', 'STATUS']
      .forEach((h, i) => put(r, i + 1, h, { fill: BLUE, color: 'FFFFFFFF', bold: true, size: 10, align: i === 4 ? 'left' : 'center' }));
    r++;
    for (let n = 1; n <= 6; n++) {
      const ex = !isPersonal && isFirst && n === 1;
      put(r, 1, String(n), { align: 'center' });
      put(r, 2, '', { align: 'center' });
      put(r, 3, '', { align: 'center' });
      put(r, 4, '', { align: 'center' });
      put(r, 5, ex ? 'Example task — delete this row' : '', ex ? { color: 'FF808080', italic: true } : {});
      const st = put(r, 6, '', { align: 'center' });
      st.dataValidation = { type: 'list', allowBlank: true, formulae: ['"Completed,In Progress,Pending,On Hold"'] };
      r++;
    }
    label(r, 1, 'REMARKS'); mergePut(r, 2, 6, ''); r++;
    r++;
  };

  const days = [];
  if (period === 'week') {
    for (let i = 0; i < 7; i++) days.push(isoAdd(rangeStart, i));
  } else {
    const last = endOfMonth(rangeStart);
    for (let d = rangeStart; d <= last; d = isoAdd(d, 1)) days.push(d);
  }
  days.forEach((d, i) => dayBlock(d, i === 0));

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const safeName = (s.name || 'Template').replace(/[^a-zA-Z0-9]/g, '_');
  const safeRange = rangeLabel.replace(/[^a-zA-Z0-9]/g, '_');
  a.download = isPersonal
    ? `${safeName}-${safeRange}-WORK-LOG.xlsx`
    : `IT-TEAM-DAILY-WORK-LOG-TEMPLATE-${safeRange}.xlsx`;
  a.click();
  URL.revokeObjectURL(a.href);
}
