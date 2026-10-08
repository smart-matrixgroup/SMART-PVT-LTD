// Honest per-service QR chain verification.
// Run: node scripts/verify-qr-chain.mjs  (from project root)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'src/config/services.js'), 'utf8').replace(/\r\n/g, '\n');

const objs = src.split(/\n\s*\{\n/).slice(1);
const svcs = objs.map(b => {
  const g = k => { const m = b.match(new RegExp(k + '\\s*:\\s*"([^"]*)"')); return m ? m[1] : null; };
  return { id: g('id'), slug: g('slug'), title: g('title') };
}).filter(s => s.slug && s.title);

// Replicate QRServicePage exactMatch logic
function exactMatch(raw) {
  const s = (raw || '').toLowerCase().trim();
  return svcs.find(x => (x.slug && x.slug.toLowerCase() === s) || (x.id && x.id.toLowerCase() === s))
      || svcs.find(x => x.title && x.title.toLowerCase().includes(s))
      || null;
}

const slugs = svcs.map(s => s.slug);
const ids = svcs.map(s => s.id);
const dupS = [...new Set(slugs.filter((v, i) => slugs.indexOf(v) !== i))];
const dupI = [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))];

let ok = 0;
const fail = [];
for (const s of svcs) {
  const m = exactMatch(s.slug);
  if (m && m.slug === s.slug) ok++;
  else fail.push(`${s.slug} -> ${m ? m.slug : 'NULL'}`);
}

console.log('services parsed:', svcs.length);
console.log('duplicate slugs:', dupS.length ? dupS.join(',') : 'none');
console.log('duplicate ids:', dupI.length ? dupI.join(',') : 'none');
console.log('slug -> exact-match OK:', `${ok}/${svcs.length}`);
if (fail.length) console.log('FAILURES:\n' + fail.join('\n'));
else console.log('CHAIN OK: every slug resolves to its own service (no cross-match).');
