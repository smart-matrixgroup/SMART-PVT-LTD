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
// The pricing card's own column header already reads "Amount (LKR)", so the
// cells print plain grouped numbers ("45,000") exactly like the artwork.
const num = (n) => toInt(n).toLocaleString('en-US');

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

  // ── Erasing the sample text ─────────────────────────────────────
  // The letterhead's cards are pale cyan panels that shade in BOTH axes —
  // light at the top of a panel, noticeably deeper at the bottom (measured:
  // #f5fbfe at y 528 → #e2f6f7 at y 648 inside SERVICE DETAILS). The old
  // patch filled a left→right gradient only, so every erased block came out
  // ~15 levels too light along its bottom edge and showed up as a ghost
  // "reflection" rectangle on the client's quote.
  //
  // Each patch now reads the artwork's own colours from the eight strips
  // that hug its edges and bilinearly interpolates them across the block,
  // so the fill meets the panel with no seam on any side.
  const sampleCache = img ? readTemplate(img, W, H) : null;
  const patchBuf = document.createElement('canvas');

  // Median colour of a rectangle of the template. Two passes: the median
  // luminance anchors the local background, then pixels further than 45
  // from it are dropped — that is what keeps leftover sample-text ink and
  // thin printed borders from dragging the patch colour dark.
  const stripColor = (x0, y0, x1, y1) => {
    const p = sampleCache.data;
    const xa = Math.max(0, Math.round(x0)), xb = Math.min(W - 1, Math.round(x1));
    const ya = Math.max(0, Math.round(y0)), yb = Math.min(H - 1, Math.round(y1));
    if (xb < xa || yb < ya) return null;
    const lums = [], cols = [];
    for (let y = ya; y <= yb; y++) {
      for (let x = xa; x <= xb; x++) {
        const i = (y * W + x) * 4;
        lums.push(0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]);
        cols.push([p[i], p[i + 1], p[i + 2]]);
      }
    }
    const sorted = lums.slice().sort((a, b) => a - b);
    const mid = sorted[sorted.length >> 1];
    const keep = cols.filter((c, i) => Math.abs(lums[i] - mid) <= 45);
    const src = keep.length > 8 ? keep : cols;
    const med = k => { const a = src.map(c => c[k]).sort((x, y) => x - y); return a[a.length >> 1]; };
    return [med(0), med(1), med(2)];
  };

  const lumOf = c => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  // A corner is the mean of the two strips that meet there. When one of them
  // clearly sits on printed artwork rather than the panel (the letterhead's
  // top border, the signature stroke beside the terms block), the ring's own
  // consensus colour is used instead and the odd sample is dropped.
  const pair = (a, b, back) => {
    if (a && b) return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    return a || b || back;
  };

  const fillPatch = (x, y, w, h, fallback, opts = {}) => {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    if (!sampleCache) { erase(x, y, w, h, fallback || '#FFFFFF'); return; }
    const G = 3;   // gap kept clear of the patch edge
    const T = 6;   // sample strip thickness
    let c00, c10, c01, c11;

    if (opts.lrOnly) {
      // Bands that only shade sideways (the blue total row): read the two
      // flanks over the full height and keep the fill flat top→bottom.
      // `inside` samples the patch's own edges — needed when the strip just
      // outside would land on the artwork that frames the band.
      const a = opts.inside ? [x, x + T - 1, x + w - T, x + w - 1] : null;
      const l = stripColor(a ? a[0] : x - G - T, y, a ? a[1] : x - G - 1, y + h - 1);
      const r = stripColor(a ? a[2] : x + w + G, y, a ? a[3] : x + w + G + T - 1, y + h - 1);
      if (!l && !r) { erase(x, y, w, h, fallback); return; }
      c00 = c01 = l || r; c10 = c11 = r || l;
    } else {
      const hy = y + (h >> 1);
      const hx = x + (w >> 1);
      const ring = {
        lT: stripColor(x - G - T, y, x - G - 1, hy - 1),
        lB: stripColor(x - G - T, hy, x - G - 1, y + h - 1),
        rT: stripColor(x + w + G, y, x + w + G + T - 1, hy - 1),
        rB: stripColor(x + w + G, hy, x + w + G + T - 1, y + h - 1),
        tL: stripColor(x, y - G - T, hx - 1, y - G - 1),
        tR: stripColor(hx, y - G - T, x + w - 1, y - G - 1),
        bL: stripColor(x, y + h + G, hx - 1, y + h + G + T - 1),
        bR: stripColor(hx, y + h + G, x + w - 1, y + h + G + T - 1),
      };
      const live = Object.values(ring).filter(Boolean);
      if (!live.length) { erase(x, y, w, h, fallback || '#FFFFFF'); return; }
      const lums = live.map(lumOf).sort((a, b) => a - b);
      const cons = lums[lums.length >> 1];
      const keep = {};
      Object.keys(ring).forEach(k => { keep[k] = ring[k] && Math.abs(lumOf(ring[k]) - cons) <= 26 ? ring[k] : null; });
      const kept = Object.values(keep).filter(Boolean);
      const back = kept.reduce((a, c) => mix(a, c, 1 / kept.length), [0, 0, 0]);
      c00 = pair(keep.lT, keep.tL, back); c10 = pair(keep.rT, keep.tR, back);
      c01 = pair(keep.lB, keep.bL, back); c11 = pair(keep.rB, keep.bR, back);
    }

    patchBuf.width = w; patchBuf.height = h;
    const pctx = patchBuf.getContext('2d');
    const buf = pctx.createImageData(w, h);
    const o = buf.data;
    for (let py = 0; py < h; py++) {
      const t = h > 1 ? py / (h - 1) : 0;
      const left = mix(c00, c01, t);
      const right = mix(c10, c11, t);
      for (let px2 = 0; px2 < w; px2++) {
        const c = mix(left, right, w > 1 ? px2 / (w - 1) : 0);
        const i = (py * w + px2) * 4;
        o[i] = c[0]; o[i + 1] = c[1]; o[i + 2] = c[2]; o[i + 3] = 255;
      }
    }
    pctx.putImageData(buf, 0, 0);
    ctx.drawImage(patchBuf, x, y, w, h);
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

  // Shrink a line until it fits maxW. If even the smallest allowed size
  // overflows, the tail is cut and marked with an ellipsis — painting text over
  // the next column is worse than a shortened line.
  const fitInto = (text, maxW, size, weight) => {
    let t = String(text ?? '');
    let s = size;
    setFont(ctx, s, weight);
    while (s > 8 && ctx.measureText(t).width > maxW) { s -= 0.4; setFont(ctx, s, weight); }
    if (ctx.measureText(t).width > maxW) {
      let cut = t;
      while (cut.length > 3 && ctx.measureText(`${cut}…`).width > maxW) cut = cut.slice(0, -1);
      t = `${cut.replace(/[\s.,;:–-]+$/, '')}…`;
    }
    return t;
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
  // Left column card geometry (measured off the artwork): the three cards
  // sit at x 33→527 with blue title bars at 486-522, 654-688 and 916-954,
  // so each body patch stops a few px clear of its own bar.
  fillPatch(40, 527, 483, 118, '#E8F7FD');
  para(d.service, 41, 542, 480, { size: 13.2, lineHeight: 19.3, maxLines: 6, color: '#2A3542' });

  // ── 6. Key features checklist ─────────────────────────────────
  // The template's tick icons are erased too, because a quotation may
  // have fewer/more features than the sample — we draw our own ticks.
  // Body runs 692 → 903 (the DOMAIN bar starts at 916).
  fillPatch(40, 692, 483, 211, '#E9F8FC');
  const feats = (d.features || []).filter(Boolean);
  const fSize = feats.length > 9 ? 12.4 : 12.9;
  feats.slice(0, 10).forEach((f, i) => {
    const base = 711 + i * 20.2;
    const cy = base - 4.6;
    ctx.beginPath(); ctx.arc(57.5, cy, 7.4, 0, Math.PI * 2);
    ctx.fillStyle = '#2E7DF0'; ctx.fill();
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(53.6, cy); ctx.lineTo(56.5, cy + 2.8); ctx.lineTo(61.6, cy - 3);
    ctx.stroke();
    line(f, 82, base, { maxW: 432, size: fSize, weight: 500, color: '#26303D' });
  });

  // ── 7. Pricing table — rows the admin adds, removes and retitles ──
  // Every client prices differently (a digital-marketing package is not a
  // website renewal), so the card is no longer hard-wired to the letterhead's
  // two sample rows. Geometry measured off the artwork:
  //   • description column  x 546→848, amount column x 856→990
  //     (the printed divider between them at ~853 is left standing — the two
  //      patches simply stop either side of it),
  //   • row area              y 857→949  (the sample's two rows, extended to
  //     the last pixel above the blue band so no strip of the old row tint is
  //     left between the erased block and the band),
  //   • blue total band       y 946→985, its label re-drawn from d.totalLabel.
  // Rows are weighted (a note line costs less than a full item) and shrink to
  // fit, so 1 row looks like the artwork and up to ~4 still stay readable.
  //
  // Row shape: { text, amount, was, kind }
  //   kind 'item' → numbered blue line, 'note' → smaller plain line.
  //   'was' > amount prints the grey strike-through over the real price.
  const PRICE_TOP = 857, PRICE_BOT = 949;
  const PRICE_H = PRICE_BOT - PRICE_TOP;
  const DESC_X = 558, DESC_MAXW = 286, AMT_X = 980, AMT_MAXW = 126;

  const legacyRows = () => {
    const listPrice = toInt(d.listPrice);
    const offerPrice = toInt(d.offerPrice);
    const hasDiscount = listPrice > 0 && offerPrice > 0 && offerPrice < listPrice;
    const unitPrice = hasDiscount ? offerPrice : (listPrice > 0 ? listPrice : offerPrice);
    const adv = toInt(d.advance);
    const bal = toInt(d.balance) > 0 ? toInt(d.balance) : Math.max(0, unitPrice - adv);
    const out = [{ text: String(d.priceLabel || d.subject || '').trim(), amount: unitPrice, was: hasDiscount ? listPrice : 0, kind: 'item' }];
    if (adv > 0) out.push({ text: `Advance payment${bal > 0 ? ` — balance ${money(bal)} after completion` : ''}`, amount: adv, kind: 'item' });
    return out;
  };

  const priceRows = (Array.isArray(d.priceRows) && d.priceRows.length ? d.priceRows : legacyRows())
    .map(r => ({ text: String(r?.text ?? '').trim(), amount: toInt(r?.amount), was: toInt(r?.was), kind: r?.kind === 'note' ? 'note' : 'item' }))
    .filter(r => r.text || r.amount > 0);

  fillPatch(546, PRICE_TOP, 302, PRICE_H, '#F4FBFE');
  fillPatch(856, PRICE_TOP, 134, PRICE_H, '#F4FBFE');

  {
    const weight = r => (r.kind === 'note' ? 0.6 : 1);
    const sumW = priceRows.reduce((s, r) => s + weight(r), 0) || 1;
    const unit = Math.min(44, PRICE_H / sumW);
    const blockH = unit * sumW;
    let ry = PRICE_TOP + (PRICE_H - blockH) / 2;
    let itemNo = 0;

    priceRows.forEach((r, idx) => {
      const rh = unit * weight(r);
      const cy = ry + rh / 2;
      const note = r.kind === 'note';
      const fSize = note
        ? Math.max(9, Math.min(11.4, rh * 0.5))
        : (rh >= 40 ? 13.4 : rh >= 32 ? 12.4 : rh >= 26 ? 11.6 : rh >= 22 ? 10.9 : 10.2);
      const lh = fSize * 1.42;
      const maxLines = !note && rh >= 40 ? 2 : 1;

      let tx = DESC_X;
      let maxW = DESC_MAXW;
      if (!note) {
        itemNo += 1;
        const showBadge = rh >= 21;
        if (showBadge) {
          ctx.beginPath(); ctx.arc(566, cy, 7.6, 0, Math.PI * 2);
          ctx.fillStyle = '#2E7DF0'; ctx.fill();
          ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center';
          setFont(ctx, 9.6, 700);
          ctx.fillText(String(itemNo), 566, cy + 3.4);
          ctx.textAlign = 'left';
          tx = 580; maxW = DESC_MAXW - 22;
        }
      }

      setFont(ctx, fSize, note ? 500 : 700);
      let lines = wrap(ctx, r.text, maxW);
      // A row that is too short to wrap: keep the WHOLE line and shrink it
      // instead of silently dropping the tail ("… balance 22,500 after
      // completion" must not print as "… after").
      if (lines.length > maxLines) lines = maxLines === 1 ? [r.text] : lines.slice(0, maxLines);
      let textTop = cy - (lines.length * lh) / 2 + fSize * 0.78;
      ctx.fillStyle = note ? '#334155' : '#0A2E63';
      lines.forEach((t) => {
        const drawn = fitInto(t, maxW, fSize, note ? 500 : 700);
        ctx.fillText(drawn, tx, textTop);
        textTop += lh;
      });

      // amount column
      if (r.amount > 0 || r.was > 0) {
        const struck = r.was > 0 && r.amount > 0 && r.was > r.amount;
        if (struck) {
          ctx.fillStyle = '#7A8794'; ctx.textAlign = 'right';
          setFont(ctx, Math.max(9, fSize * 0.82), 600);
          const ls = num(r.was);
          ctx.fillText(ls, AMT_X, cy - 1);
          const w = ctx.measureText(ls).width;
          const sy = cy - 1 - fSize * 0.32;
          ctx.strokeStyle = '#E0423C'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(AMT_X - w, sy); ctx.lineTo(AMT_X, sy); ctx.stroke();
          ctx.textAlign = 'left';
          line(num(r.amount), AMT_X, cy + fSize * 0.95, { maxW: AMT_MAXW, size: fSize * 1.12, weight: 700, color: '#0C369A', align: 'right' });
        } else {
          line(num(r.amount), AMT_X, cy + fSize * 0.36, { maxW: AMT_MAXW, size: fSize * 1.18, weight: 700, color: '#0C369A', align: 'right' });
        }
      }

      // faint rule between rows, in both columns (the artwork has one too)
      if (idx < priceRows.length - 1) {
        ctx.strokeStyle = 'rgba(11,60,140,0.13)'; ctx.lineWidth = 1;
        const gy = Math.round(ry + rh) + 0.5;
        ctx.beginPath(); ctx.moveTo(548, gy); ctx.lineTo(846, gy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(858, gy); ctx.lineTo(988, gy); ctx.stroke();
      }
      ry += rh;
    });
  }

  // Total band: label + value are both editable ("Total First Month Fee" …).
  // The band is a blue→cyan horizontal gradient, so each patch is sampled from
  // inside the band and kept flat top→bottom.
  {
    const total = toInt(d.totalAmount) || toInt(d.total) || priceRows.reduce((s, r) => s + (r.kind === 'note' ? 0 : r.amount), 0);
    fillPatch(546, 952, 300, 30, '#4FB4FB', { lrOnly: true, inside: true });
    fillPatch(856, 951, 128, 30, '#4FB4FB', { lrOnly: true, inside: true });
    line(String(d.totalLabel || 'Total Quotation Amount').trim(), 558, 972,
      { maxW: 278, size: 14.5, weight: 700, color: '#FFFFFF' });
    line(num(total), 980, 976, { maxW: 132, size: 18, weight: 700, color: '#FFFFFF', align: 'right' });
  }

  // No discount → the actual cost is the quotation total. With a discount,
  // the discounted price is the total (the template has no separate total field).

  // ── 8. Domain & hosting notes ─────────────────────────────────
  // Card body 958 → 1118 (its blue title bar ends at 954).
  fillPatch(40, 958, 483, 160, '#F0FAFE');
  const notes = (d.domain || []).filter(Boolean);
  let dy = 974;
  notes.forEach(n => {
    if (dy > 1108) return;
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

  // ── 9. Payment / detail rows — every label is editable ──────────
  // The card is x 538→994, y 992→1168 with its blue title bar at 995-1028 and
  // the printed rows at 1036-1160 (label column starts x 564, the colons sit at
  // x 726, values at x 750). The letterhead ships with six fixed labels, but
  // the artwork also promised an "Account Type" the form never had — so the
  // whole body is redrawn from d.payRows: the admin renames, removes and adds
  // "Title : value" lines freely (Warranty, Delivery time, Payment remark …).
  const PAY_TOP = 1036, PAY_BOT = 1160, PAY_H = PAY_BOT - PAY_TOP;
  const b = d.bank || {};
  const legacyPayRows = () => ([
    ['Account Name',   b.accountName],
    ['Bank',           b.bankName],
    ['Branch',         b.branch],
    ['Account No',     b.accountNumber],
    ['Account Type',   b.accountType],
    ['Payment Remark', d.payRemark],
  ]).filter(([, v]) => String(v || '').trim()).map(([label, value]) => ({ label, value }));

  const payRows = (Array.isArray(d.payRows) && d.payRows.length ? d.payRows : legacyPayRows())
    .map(r => ({ label: String(r?.label ?? '').trim(), value: String(r?.value ?? '').trim() }))
    .filter(r => r.label || r.value);

  fillPatch(546, PAY_TOP, 438, PAY_H, '#EDF8FD');
  {
    const pitch = Math.min(20.6, PAY_H / Math.max(1, payRows.length));
    const blockH = pitch * payRows.length;
    let py = PAY_TOP + (PAY_H - blockH) / 2 + pitch / 2;
    const fSize = pitch >= 19 ? 13.2 : pitch >= 16 ? 11.8 : 10.6;
    payRows.forEach((r) => {
      // label — dark navy bold, right up to the printed colon column
      setFont(ctx, fSize, 700);
      let ls = fSize;
      while (ls > 8 && ctx.measureText(r.label).width > 150) { ls -= 0.4; setFont(ctx, ls, 700); }
      ctx.fillStyle = '#0A2158';
      ctx.fillText(r.label, 564, py + ls * 0.36);
      ctx.fillText(':', 726, py + ls * 0.36);
      line(r.value, 750, py + fSize * 0.36, { maxW: 232, size: fSize, weight: 700, color: '#0C369A' });
      py += pitch;
    });
  }

  // ── 10. Terms & conditions ────────────────────────────────────
  // Plain paper here. Starts at 1176: above that sits the "TERMS &
  // CONDITIONS" heading bar (1150-1172) and to the right, the signature and
  // company stamp — neither may be erased, which is why the block stops at
  // x 665 and only the sample's term tail continues to 696.
  fillPatch(40, 1176, 625, 138, '#FBFDFD');
  fillPatch(663, 1204, 33, 27, '#FBFDFD');
  const terms = (d.termList || []).filter(Boolean);
  terms.slice(0, 6).forEach((t, i) => {
    const base = 1198 + i * 20.4;
    line(`${i + 1}.`, 62, base, { maxW: 18, size: 12.4, weight: 600, color: '#334155', align: 'right' });
    line(t, 85, base, { maxW: 585, size: 12.4, weight: 500, color: '#334155' });
  });
}
