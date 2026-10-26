import { toInt, formatLKR } from '../money';

// ────────────────────────────────────────────────────────────────────
// Quotation template renderer
//
// Paints the owner-supplied quotation letterhead (a flat JPEG) and then
// rewrites only the dynamic text areas: meta box, client, subject, intro,
// service paragraph, feature checklist, pricing table, domain notes,
// payment box and terms. No new dependencies — plain Canvas 2D.
//
// All coordinates below are in the template image's own pixel space
// (1024 × 1536), NOT in export pixels. renderTemplate() scales the whole
// context by 2 so the exported PNG stays crisp.
// ────────────────────────────────────────────────────────────────────

export const TEMPLATE_QUOTATION = {
  src: '/templates/quotation-template-1.jpg',
  width: 1024,
  height: 1536,
  scale: 2,
};

const FONT = '"Plus Jakarta Sans", "Inter", Arial, "Helvetica Neue", sans-serif';
const INK = '#1F2C3D';
const SOFT = '#2A3542';

const money = (n) => formatLKR(toInt(n));

// "2026-11-15" / "21 Oct 2026" → "15 November 2026"
function prettyDate(v) {
  if (!v) return '';
  const dt = new Date(v);
  if (Number.isNaN(dt.getTime())) return String(v);
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

function setFont(ctx, size, weight = 500) {
  ctx.font = `${weight} ${size}px ${FONT}`;
}

// Decode the letterhead once per loaded image so erase patches can sample
// the real local background colour (see fillPatch inside renderTemplate).
const sampleMap = new WeakMap();
function readTemplate(img, W, H) {
  const hit = sampleMap.get(img);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const cx = c.getContext('2d');
  cx.drawImage(img, 0, 0, W, H);
  const out = { data: cx.getImageData(0, 0, W, H).data };
  sampleMap.set(img, out);
  return out;
}

// shrink a single line until it fits maxW (never below 72% of the ask)
function fitFont(ctx, text, maxW, size, weight) {
  let fs = size;
  setFont(ctx, fs, weight);
  while (fs > size * 0.72 && ctx.measureText(text).width > maxW) {
    fs -= 0.5;
    setFont(ctx, fs, weight);
  }
  return fs;
}

function wrap(ctx, text, maxWidth) {
  const out = [];
  String(text || '').split('\n').forEach(par => {
    const words = par.split(/\s+/).filter(Boolean);
    if (!words.length) return;
    let line = words[0];
    for (let i = 1; i < words.length; i++) {
      const test = `${line} ${words[i]}`;
      if (ctx.measureText(test).width > maxWidth) { out.push(line); line = words[i]; }
      else line = test;
    }
    out.push(line);
  });
  return out;
}

export function renderTemplate(canvas, img, d, scale) {
  if (!canvas || !d) return;
  const W = TEMPLATE_QUOTATION.width;
  const H = TEMPLATE_QUOTATION.height;
  const S = scale || TEMPLATE_QUOTATION.scale;

  canvas.width = W * S;
  canvas.height = H * S;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(S, 0, 0, S, 0, 0);

  // ---- background: the owner's letterhead ----
  if (img) {
    ctx.drawImage(img, 0, 0, W, H);
  } else {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#64748B';
    setFont(ctx, 18, 600);
    ctx.textAlign = 'center';
    ctx.fillText('Template image could not be loaded', W / 2, H / 2);
    ctx.textAlign = 'left';
  }

  // ---- screenshots inside the laptop / phone mockups ----
  // Optional per-quotation uploads. Each image is cover-cropped into the
  // screen rect measured from the letterhead (design px), so the device
  // bezels and the notch stay untouched. Empty → the sample stays.
  // The laptop rect stops at the phone so the phone bezel is never painted over.
  const shots = d.shots || {};
  const drawShot = (im, x, y, w, h, radius) => {
    if (!im || !im.width || !im.height) return;
    const ir = im.width / im.height;
    const tr = w / h;
    let sw = im.width, sh = im.height, sx = 0, sy = 0;
    if (ir > tr) { sw = im.height * tr; sx = (im.width - sw) / 2; }
    else { sh = im.width / tr; sy = (im.height - sh) / 2; }
    ctx.save();
    ctx.beginPath();
    if (radius && ctx.roundRect) ctx.roundRect(x, y, w, h, radius);
    else ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.drawImage(im, sx, sy, sw, sh, x, y, w, h);
    ctx.restore();
  };
  drawShot(shots.laptop, 551, 496, 333, 272, 3);
  drawShot(shots.phone,  890, 570, 103, 233, 6);

  const erase = (x, y, w, h, bg) => {
    if (!bg) return;
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);
  };

  // Text patches are filled with the letterhead's own local background
  // (sampled from a ring around the patch) instead of a guessed flat colour,
  // so the erased sample text blends into the template's gradients.
  const sampleCache = img ? readTemplate(img, W, H) : null;
  const ringAvg = (x0, y0, x1, y1) => {
    const px = sampleCache.data;
    const rs = [], gs = [], bs = [];
    const add = (x, y) => {
      const i = (y * W + x) * 4;
      const l = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      if (l > 118 && l < 242) { rs.push(px[i]); gs.push(px[i + 1]); bs.push(px[i + 2]); }
    };
    const xa = Math.max(0, x0), xb = Math.min(W - 1, x1), ya = Math.max(0, y0), yb = Math.min(H - 1, y1);
    for (let y = ya; y <= yb; y++) { add(xa, y); add(xb, y); }
    if (!rs.length) return [255, 255, 255];
    const med = a => a.sort((p, q) => p - q)[a.length >> 1];
    return [med(rs), med(gs), med(bs)];
  };
  const css = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
  const fillPatch = (x, y, w, h, fallback) => {
    if (!sampleCache) { erase(x, y, w, h, fallback || '#FFFFFF'); return; }
    const l = ringAvg(x + 4, y + 6, x + 9, y + h - 6);
    const r = ringAvg(x + w - 9, y + 6, x + w - 4, y + h - 6);
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, css(l));
    g.addColorStop(1, css(r));
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  };

  const line = (str, x, base, o = {}) => {
    const s = String(str ?? '');
    if (!s) return;
    const size = o.size || 13;
    const weight = o.weight || 500;
    const maxW = o.maxW || 400;
    fitFont(ctx, s, maxW, size, weight);
    ctx.fillStyle = o.color || INK;
    ctx.textAlign = o.align || 'left';
    ctx.fillText(s, x, base);
    ctx.textAlign = 'left';
  };

  const para = (text, x, base, maxW, o = {}) => {
    const size = o.size || 13;
    setFont(ctx, size, o.weight || 500);
    let lines = wrap(ctx, text, maxW);
    if (o.maxLines && lines.length > o.maxLines) {
      lines = lines.slice(0, o.maxLines);
      const last = lines[lines.length - 1];
      lines[lines.length - 1] = last.length > 18 ? `${last.slice(0, last.length - 2)}…` : last;
    }
    ctx.fillStyle = o.color || SOFT;
    lines.forEach((t, i) => {
      setFont(ctx, size, o.weight || 500);
      ctx.fillText(t, x, base + i * (o.lineHeight || 20));
    });
    return lines.length;
  };

  // ── 0. Letterhead address — redrawn with the company's real address ──
  // Both lines share one font size, shrunk only if a line would overflow.
  {
    const addr1 = '135, 2nd Floor, Inner Harbour Rd, Orrshill,';
    const addr2 = 'Trincomalee 31000, Sri Lanka.';
    fillPatch(636, 13, 380, 47, '#FFFFFF');
    let aSize = 16.5;
    setFont(ctx, aSize, 600);
    while (aSize > 11.5 && Math.max(ctx.measureText(addr1).width, ctx.measureText(addr2).width) > 356) {
      aSize -= 0.25;
      setFont(ctx, aSize, 600);
    }
    ctx.fillStyle = '#1B4F9C';
    ctx.textAlign = 'left';
    ctx.fillText(addr1, 643, 32);
    ctx.fillText(addr2, 643, 54);
  }

  // ── 1. Quotation meta box ──────────────────────────────────────
  fillPatch(806, 252, 184, 72, '#FFFFFF');
  const meta = { size: 15.5, weight: 600, color: '#14315F' };
  line(d.refNo, 814, 270, { ...meta, maxW: 170 });
  line(prettyDate(d.date), 814, 292, { ...meta, maxW: 170 });
  line(prettyDate(d.validUntil), 814, 315, { ...meta, maxW: 170 });

  // ── 2. TO / client ────────────────────────────────────────────
  fillPatch(82, 324, 578, 45, '#FFFFFF');
  line(d.clientLine, 88, 353, { maxW: 600, size: 27, weight: 700, color: '#0A2E63' });

  // ── 3. Subject ────────────────────────────────────────────────
  fillPatch(156, 392, 550, 30, '#FFFFFF');
  line(d.subject, 170, 410, { maxW: 524, size: 19, weight: 700, color: '#0C2C4F' });

  // ── 4. Intro paragraph ────────────────────────────────────────
  fillPatch(24, 421, 680, 46, '#FFFFFF');
  para(d.intro, 33, 434, 628, { size: 14, lineHeight: 22, maxLines: 2, color: '#2A3542' });

  // ── 5. Service details ────────────────────────────────────────
  fillPatch(40, 527, 483, 122, '#E8F7FD');
  para(d.service, 41, 542, 480, { size: 13.2, lineHeight: 19.3, maxLines: 6, color: '#2A3542' });

  // ── 6. Key features checklist ─────────────────────────────────
  // The template's tick icons are erased too, because a quotation may
  // have fewer/more features than the sample — we draw our own ticks.
  fillPatch(40, 688, 483, 238, '#E9F8FC');
  const feats = (d.features || []).filter(Boolean);
  const fSize = feats.length > 9 ? 12.4 : 12.9;
  feats.slice(0, 10).forEach((f, i) => {
    const base = 710 + i * 20.65;
    const cy = base - 4.6;
    ctx.beginPath(); ctx.arc(57.5, cy, 7.4, 0, Math.PI * 2);
    ctx.fillStyle = '#2E7DF0'; ctx.fill();
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(53.6, cy); ctx.lineTo(56.5, cy + 2.8); ctx.lineTo(61.6, cy - 3);
    ctx.stroke();
    line(f, 82, base, { maxW: 432, size: fSize, weight: 500, color: '#26303D' });
  });

  // ── 7. Pricing table ──────────────────────────────────────────
  // Row 1 = website price. A red strike-through + discounted price is
  // shown ONLY when a real discount is entered (offer > 0 and below the
  // actual cost). With no discount, just the actual cost is printed.
  // Row 2 = advance / balance summary.  Total row = quotation total.
  const listPrice = toInt(d.listPrice);
  const offerPrice = toInt(d.offerPrice);
  const hasDiscount = listPrice > 0 && offerPrice > 0 && offerPrice < listPrice;
  const unitPrice = hasDiscount ? offerPrice : (listPrice > 0 ? listPrice : offerPrice);
  fillPatch(851, 864, 140, 40, '#F4FBFE');
  if (hasDiscount) {
    const ls = money(listPrice);
    fitFont(ctx, ls, 140, 11.5, 600);
    ctx.fillStyle = '#7A8794'; ctx.textAlign = 'right';
    ctx.fillText(ls, 986, 879);
    const w = ctx.measureText(ls).width;
    ctx.strokeStyle = '#E0423C'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(986 - w, 875); ctx.lineTo(986, 875); ctx.stroke();
    line(money(offerPrice), 986, 897, { maxW: 146, size: 15.5, weight: 700, color: '#0F4FA8', align: 'right' });
  } else {
    line(money(unitPrice), 986, 892, { maxW: 146, size: 18, weight: 700, color: '#0F4FA8', align: 'right' });
  }

  // No discount → the actual cost is the quotation total. With a discount,
  // the discounted price is the total (the template has no separate total field).
  const total = hasDiscount ? offerPrice : (toInt(d.total) || unitPrice);
  const advPct = total > 0 ? Math.round(toInt(d.advance) / total * 100) : 0;
  fillPatch(546, 906, 305, 46, '#E3F5FF');
  line(`Advance payment (${advPct}%)`, 558, 926, { maxW: 260, size: 13.4, weight: 700, color: '#0F4FA8' });
  if (toInt(d.balance) > 0) {
    line(`Balance ${money(d.balance)}`, 558, 944, { maxW: 260, size: 11.8, weight: 500, color: '#334155' });
  }
  fillPatch(851, 906, 140, 46, '#F8FEFF');
  line(money(d.advance), 986, 935, { maxW: 146, size: 15.5, weight: 700, color: '#1F3FA6', align: 'right' });

  // total band — blue gradient (sampled), white value
  {
    fillPatch(851, 953, 140, 38, '#7FD0FA');
    line(money(total), 986, 978, { maxW: 150, size: 18, weight: 700, color: '#FFFFFF', align: 'right' });
  }

  // ── 8. Domain & hosting notes ─────────────────────────────────
  fillPatch(40, 955, 483, 157, '#F0FAFE');
  const notes = (d.domain || []).filter(Boolean);
  let dy = 972;
  notes.forEach(n => {
    if (dy > 1100) return;
    setFont(ctx, 12.2, 500);
    const lines = wrap(ctx, n, 436);
    ctx.fillStyle = '#2E7DF0';
    ctx.beginPath(); ctx.arc(57.5, dy - 4, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2A3542';
    lines.forEach((t, i) => {
      setFont(ctx, 12.2, 500);
      ctx.fillText(t, 80, dy + i * 18.6);
    });
    dy += lines.length * 18.6 + 4;
  });

  // ── 9. Payment details ────────────────────────────────────────
  const b = d.bank || {};
  // The sample's blue account values sit right at this panel's left edge, so
  // edge sampling picked up their antialiasing. Paint the panel's own plain
  // vertical wash instead (measured top → bottom).
  {
    const g = ctx.createLinearGradient(0, 1030, 0, 1162);
    g.addColorStop(0, '#F0FAFE');
    g.addColorStop(1, '#E3F5FD');
    ctx.fillStyle = g;
    ctx.fillRect(746, 1030, 246, 132);
  }
  const payRow = (val, base) => line(val, 752, base, { maxW: 242, size: 13.2, weight: 600, color: '#1F2C3D' });
  payRow(b.accountName, 1049);
  payRow(b.bankName, 1069);
  payRow(b.branch, 1089);
  payRow(b.accountNumber, 1110);
  payRow(b.accountType, 1130);
  line(d.payRemark, 752, 1151, { maxW: 242, size: 13.2, weight: 700, color: '#1F3C88' });

  // ── 10. Terms & conditions ────────────────────────────────────
  // Plain paper here — a solid near-white fill blends with the template
  // (edge sampling picked up the blue panel border and tinted the block).
  // Starts at 1172: above that sits the "TERMS & CONDITIONS" heading (1151-1164)
  // and to the right, the payment box's last rows — neither must be erased.
  erase(40, 1172, 625, 144, '#FBFDFD');
  // tail of the sample's 3rd term (…30,000).) pokes past the white block
  erase(663, 1204, 35, 27, '#FBFDFD');
  const terms = (d.termList || []).filter(Boolean);
  terms.slice(0, 6).forEach((t, i) => {
    const base = 1198 + i * 20.4;
    line(`${i + 1}.`, 62, base, { maxW: 18, size: 12.4, weight: 600, color: '#334155', align: 'right' });
    line(t, 85, base, { maxW: 585, size: 12.4, weight: 500, color: '#334155' });
  });
}
