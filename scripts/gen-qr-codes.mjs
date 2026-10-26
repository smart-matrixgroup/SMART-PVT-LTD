// One-off generator: 14 service QR PNGs + printable A4 sheet + links list.
// Run: node scripts/gen-qr-codes.mjs   (from project root)
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Normalize CRLF -> LF so block splitting works regardless of line endings.
const src = fs.readFileSync(path.join(root, 'src/config/services.js'), 'utf8').replace(/\r\n/g, '\n');

// Parse the static services array (id/slug/title/category per object).
// Split on any top-level object opening brace at line start (2-space indent).
const objs = src.split(/\n\s*\{\n/).slice(1);
const services = objs.map(b => {
  const g = (k) => { const m = b.match(new RegExp(k + '\\s*:\\s*"([^"]*)"')); return m ? m[1] : null; };
  return { slug: g('slug'), title: g('title'), category: g('category') };
}).filter(s => s.slug && s.title);
console.log(`Parsed ${services.length} services`);

// Live hosting origin (custom domain is not registered yet).
const base = process.env.QR_BASE_URL || 'https://smart-erp-2a2d3.web.app';
const outDir = path.join(root, 'qr-codes');
fs.mkdirSync(outDir, { recursive: true });

// Master services QR — one code for the full catalogue.
const servicesUrl = `${base}/services`;
const masterFile = path.join(outDir, 'SMART-QR-all-services.png');
await QRCode.toFile(masterFile, servicesUrl, {
  width: 900, margin: 2, errorCorrectionLevel: 'H',
  color: { dark: '#040D1F', light: '#FFFFFF' },
});
const masterB64 = fs.readFileSync(masterFile).toString('base64');
console.log('OK', path.relative(root, masterFile), '->', servicesUrl);

const rows = [];
for (const s of services) {
  const url = `${base}/services/qr/${encodeURIComponent(s.slug)}`;
  const file = path.join(outDir, `SMART-QR-${s.slug}.png`);
  await QRCode.toFile(file, url, {
    width: 600, margin: 2, errorCorrectionLevel: 'H',
    color: { dark: '#040D1F', light: '#FFFFFF' },
  });
  rows.push({ ...s, url, b64: fs.readFileSync(file).toString('base64') });
  console.log('OK', path.relative(root, file), '->', url);
}

const masterCard = `
    <div class="card master">
      <img src="data:image/png;base64,${masterB64}" alt="All Services"/>
      <div class="t">All Services (Master)</div>
      <div class="c">Full catalogue</div>
      <div class="u">${servicesUrl}</div>
    </div>`;

const cards = masterCard + rows.map(r => `
    <div class="card">
      <img src="data:image/png;base64,${r.b64}" alt="${r.title}"/>
      <div class="t">${r.title}</div>
      <div class="c">${r.category || ''}</div>
      <div class="u">${r.url}</div>
    </div>`).join('');

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>SMART Pvt Ltd — Service QR Codes</title>
<style>
  @page{size:A4;margin:10mm}
  body{font-family:"Segoe UI",Arial,sans-serif;margin:0;padding:10mm;background:#fff}
  h1{font-size:18px;margin:0 0 2px;text-align:center}
  .sub{font-size:11px;color:#555;text-align:center;margin-bottom:14px}
  .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8mm}
  .card{border:1.5px solid #222;border-radius:10px;padding:5mm;text-align:center;page-break-inside:avoid}
  .card img{width:45mm;height:45mm;display:block;margin:0 auto 3mm}
  .t{font-size:13px;font-weight:800}
  .c{font-size:10px;color:#0066FF;font-weight:700;margin-top:1px}
  .u{font-size:8px;color:#777;margin-top:3px;word-break:break-all}
</style></head><body>
<h1>SMART Pvt Ltd — Official Service QR Codes</h1>
<div class="sub">Scan to open the service page &amp; request form · ${base.replace(/^https?:\/\//, '')}</div>
<div class="grid">${cards}</div>
</body></html>`;

fs.writeFileSync(path.join(outDir, 'PRINT-SHEET-all-14.html'), html);
fs.writeFileSync(path.join(outDir, 'links.txt'),
  [`All Services  ->  ${servicesUrl}`, ...rows.map(r => `${r.title}  ->  ${r.url}`)].join('\n'));
console.log(`DONE: ${rows.length + 1} QR PNGs (incl. master services) + PRINT-SHEET-all-14.html + links.txt in qr-codes/`);
