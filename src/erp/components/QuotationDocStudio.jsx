import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getDoc, doc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { company } from '../../config/company';
import { toInt, formatLKR } from '../money';
import { ERPBtn, ERPInput, ERPTextarea, C } from './ERPui';
import { Download, Printer, Copy, Image as ImageIcon, Plus, Trash2, LayoutTemplate, Sparkles, Save, ExternalLink } from 'lucide-react';
import { TEMPLATE_QUOTATION, renderTemplate } from './quotationTemplateRenderer';

// ────────────────────────────────────────────────────────────────────
// Quotation Image Studio
// Renders the quotation as a real shareable IMAGE (PNG) drawn on a
// canvas — every field is editable first, then Download / Copy (paste
// straight into WhatsApp Web) / Print → Save as PDF.
//
// No new dependencies: HTML5 Canvas 2D + the browser print dialog.
// Page is A4-proportioned at ~150dpi (1240px wide) and grows in height
// if there are many line items, so nothing ever gets cut off.
// ────────────────────────────────────────────────────────────────────

const W = 1240;            // canvas width (px)
const PAD = 72;            // page side padding
const MIN_H = 1754;        // A4 height at this width
const FONT = `Arial, "Helvetica Neue", "Segoe UI", sans-serif`;

const money = (n) => {
  const v = typeof n === 'number' ? n : toInt(n);
  return formatLKR(v);
};

// rounded rectangle path (roundRect is not everywhere yet)
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// word-wrap a string into lines that fit maxWidth
function wrap(ctx, text, maxWidth) {
  const out = [];
  String(text || '').split('\n').forEach(par => {
    const words = par.split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(''); return; }
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

// build the editable document model from a Firestore quotation
export function buildDoc(q, bank) {
  const total  = toInt(q.totalAmount);
  const paid   = toInt(q.paidTotal);
  const adv    = toInt(q.advanceAmount) || Math.round(total * (toInt(q.advancePct) || 0) / 100);
  const subject = q.projectTitle || q.service || '';
  const scopeLines = String(q.scope || '').split('\n').map(s => s.trim()).filter(Boolean);
  const balance = Math.max(0, total - paid);
  return {
    theme: 'light',
    accent: '#0A5BFF',
    accent2: '#00C6E0',
    title: 'QUOTATION',
    refNo: q.quotationNo || '',
    date: q.createdAt ? new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '',
    validUntil: q.validUntil || '',
    status: q.status || 'Draft',
    clientName: q.clientName || '',
    clientCompany: q.clientCompany || '',
    project: q.projectTitle || q.service || '',
    description: q.description || '',
    scope: q.scope || '',
    items: (q.items || []).map(it => ({ label: it.label, amount: toInt(it.amount) })),
    subtotal: total,
    advance: adv,
    paid,
    balance: Math.max(0, total - paid),
    total,
    terms: q.terms || q.paymentTerms || '',
    notes: q.notes || '',
    bank: { ...(bank || {}) },
    footer: `This quotation is issued by ${company.fullName}. Feel free to reply on WhatsApp for any clarification.`,

    // ---- optional project screenshots drawn into the laptop / phone ----
    laptopShot: q.laptopShot || '',
    phoneShot: q.phoneShot || '',

    // ---- template mode (owner's letterhead) ----
    clientLine: [q.clientName, q.clientCompany].filter(Boolean).join('  ·  ') || '',
    subject,
    intro: q.description
      || `We are pleased to provide this quotation for the ${subject || 'project'} with domain registration and hosting on our company server.`,
    service: q.scope || q.description || '',
    features: scopeLines,
    listPrice: total,
    // 0 / blank = no discount → the letterhead prints only the actual cost.
    // A smaller value than the actual cost prints the red strike-through.
    offerPrice: 0,
    domain: [
      'We will purchase and register your preferred domain name (e.g., www.yourname.com) on your behalf.',
      'The website will be hosted on our company server for 1 year.',
      'After 1 year, you need to renew the domain and hosting with us to continue the service.',
      `Renewal will be provided at the same price (${money(total)} per year), which includes domain renewal, server hosting and basic support.`,
    ],
    payRemark: q.quotationNo || '',
    termList: [
      `Advance payment of ${money(adv)} is required to start the work.`,
      `Balance payment of ${money(balance)} is to be paid after completion and final approval.`,
      'Domain and hosting are provided for 1 year. Renewal after 1 year will be at the same price.',
      'Price includes design, development, domain registration, hosting and 1 year basic support.',
      'Any additional custom features will be quoted separately if required.',
      `This quotation is valid until ${q.validUntil || '—'}.`,
    ],
  };
}

export default function QuotationDocStudio({ isOpen, onClose, quotation, waHref, onShotsChange, onSaveImage }) {
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  // On phones the editor stacks above the preview, so start with it closed —
  // the user should see the letterhead image first, then open the editor.
  const [showEditor, setShowEditor] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth > 900;
  });
  // 'template' = the owner's own letterhead (default), 'classic' = the built-in canvas design
  const [mode, setMode] = useState('template');
  const [assetsReady, setAssetsReady] = useState(0);
  const canvasRef = useRef(null);
  const logoRef   = useRef(null);
  const tplRef    = useRef(null);

  // Optional screenshots for the laptop / phone mockups on the letterhead.
  // Stored as small data URLs on the quotation (no Storage round-trip).
  const [shots, setShots] = useState({ laptop:'', phone:'' });
  const shotImgs = useRef({ laptop:null, phone:null });

  useEffect(() => {
    if (!isOpen) return;
    setShots({ laptop: quotation?.laptopShot || '', phone: quotation?.phoneShot || '' });
  }, [isOpen, quotation?.id, quotation?.laptopShot, quotation?.phoneShot]);

  // Decode the data URLs into canvas-ready images (and trigger a repaint).
  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    ['laptop', 'phone'].forEach(k => {
      const src = shots[k];
      if (!src) { shotImgs.current[k] = null; return; }
      const im = new Image();
      im.onload  = () => { if (alive) { shotImgs.current[k] = im; setAssetsReady(n => n + 1); } };
      im.onerror = () => { if (alive) { shotImgs.current[k] = null; setAssetsReady(n => n + 1); } };
      im.src = src;
    });
    return () => { alive = false; };
  }, [isOpen, shots.laptop, shots.phone]);

  const set = useCallback((k, v) => setD(p => ({ ...p, [k]: v })), []);

  // Load bank details (settings/bankDetails) once per open
  useEffect(() => {
    if (!isOpen || !quotation) return;
    let alive = true;
    const seed = buildDoc(quotation, null);
    setD(seed);
    if (!isFirebaseConfigured) return () => { alive = false; };
    getDoc(doc(db, 'settings', 'bankDetails'))
      .then(snap => {
        if (!alive || !snap.exists()) return;
        const b = snap.data();
        if (b.bankName || b.accountNumber) setD(p => ({ ...p, bank: b }));
      })
      .catch(() => { /* bank section is optional — never block the doc */ });
    return () => { alive = false; };
  }, [isOpen, quotation?.id]);

  // Company logo as a canvas-safe image (same-origin → canvas stays exportable)
  useEffect(() => {
    if (!isOpen) return;
    const img = new Image();
    img.onload  = () => { logoRef.current = img; setAssetsReady(n => n + 1); };
    img.onerror = () => { logoRef.current = null; setAssetsReady(n => n + 1); };
    img.src = company.logos?.lightMode || company.logos?.darkMode || '';
    return () => { img.onload = null; img.onerror = null; };
  }, [isOpen]);

  // Owner's quotation letterhead (public/templates/…) — same-origin so the
  // exported canvas stays untainted. Drawn as the page background in
  // template mode.
  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    const img = new Image();
    img.decoding = 'async';
    const done = () => {
      if (!alive) return;
      tplRef.current = img.naturalWidth ? img : null;
      setAssetsReady(n => n + 1);
    };
    img.onload = done;
    img.onerror = done;
    img.src = TEMPLATE_QUOTATION.src;
    if (img.complete && img.naturalWidth) done();
    return () => { alive = false; img.onload = null; img.onerror = null; };
  }, [isOpen]);

  // Brand font for the template (fall back silently until it is ready)
  useEffect(() => {
    if (!isOpen || !document.fonts) return;
    let alive = true;
    document.fonts.ready.then(() => { if (alive) setAssetsReady(n => n + 1); });
    return () => { alive = false; };
  }, [isOpen]);

  // ── The renderer ────────────────────────────────────────────────
  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !d) return;

    const dark = d.theme === 'dark';
    const bg      = dark ? '#061127' : '#FFFFFF';
    const ink     = dark ? '#EAF2FF' : '#0B1F3A';
    const soft    = dark ? '#9FB2CE' : '#4B5563';
    const faint   = dark ? 'rgba(159,178,206,0.55)' : '#6B7280';
    const panelBg = dark ? 'rgba(10,24,56,0.85)' : '#F5F9FF';
    const line    = dark ? 'rgba(32,52,93,0.9)' : '#E3EAF4';

    // ---- pass 1: measure how tall we need (items + wrapped text) ----
    const inner = W - PAD * 2;
    ctx.font = `13px ${FONT}`;
    const descLines  = wrap(ctx, d.description, inner - 28);
    const scopeLines = wrap(ctx, d.scope, inner - 28);
    const termsLines = wrap(ctx, d.terms, inner - 28);
    const noteLines  = wrap(ctx, d.notes, inner - 28);
    ctx.font = `15px ${FONT}`;
    const itemHeights = d.items.map(it => Math.max(46, 24 + wrap(ctx, it.label, inner - 300).length * 21));
    const bank = d.bank || {};
    const bankLines = [
      bank.bankName && `Bank: ${bank.bankName}`,
      bank.accountName && `Account Name: ${bank.accountName}`,
      bank.accountNumber && `Account No: ${bank.accountNumber}`,
      bank.branch && `Branch: ${bank.branch}`,
      bank.swiftCode && `SWIFT: ${bank.swiftCode}`,
      bank.instructions,
    ].filter(Boolean);
    const footLines = wrap(ctx, d.footer, inner - 40);

    const cv = canvasRef.current;

    // Two-pass render: paint once to learn where the content actually ends,
    // then size the page to the content (A4 minimum) and paint for real.
    // Without this, short quotations leave a big empty white strip under the
    // document, which looks broken when sent as an image.
    cv.width = W; cv.height = MIN_H * 3;
    const contentEnd = paint(MIN_H * 3, true);
    // Content-tight page (min 1200px so it still reads like a document) —
    // a fixed A4 height leaves a big empty strip on short quotations.
    const H = Math.max(1200, contentEnd + 190);
    cv.width = W; cv.height = H;
    paint(H, false);

    function paint(H, measureOnly) {

    // ---- background ----
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, d.accent); g.addColorStop(1, d.accent2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 14);
    // soft brand glow top-right
    const rg = ctx.createRadialGradient(W - 180, 120, 10, W - 180, 120, 340);
    rg.addColorStop(0, dark ? 'rgba(0,198,224,0.16)' : 'rgba(10,91,255,0.10)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, 400);

    let y = 66;

    // ---- header: logo + company ----
    const logo = logoRef.current;
    let headX = PAD;
    if (logo) {
      const lh = 62, lw = Math.round(logo.width / logo.height * lh) || 140;
      ctx.drawImage(logo, PAD, y - 6, Math.min(lw, 190), lh);
      headX = PAD + Math.min(lw, 190) + 18;
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = ink; ctx.font = `bold 27px ${FONT}`;
    ctx.fillText(company.fullName || 'SMART Pvt Ltd', headX, y + 18);
    ctx.fillStyle = faint; ctx.font = `12.5px ${FONT}`;
    ctx.fillText(company.positioning || '', headX, y + 40);
    ctx.fillStyle = soft; ctx.font = `12.5px ${FONT}`;
    const addr1 = `${company.contact.address}`;
    const addr2 = `${company.contact.phone}  ·  ${company.contact.email}`;
    ctx.fillText(addr1, headX, y + 60);
    ctx.fillText(addr2, headX, y + 78);

    // ---- title block (right aligned) ----
    ctx.textAlign = 'right';
    ctx.fillStyle = ink; ctx.font = `900 34px ${FONT}`;
    ctx.fillText(String(d.title || 'QUOTATION').toUpperCase(), W - PAD, y + 24);
    ctx.fillStyle = d.accent; ctx.font = `bold 17px ${FONT}`;
    ctx.fillText(d.refNo ? `Ref: ${d.refNo}` : '', W - PAD, y + 52);
    // status pill
    if (d.status) {
      ctx.font = `bold 13px ${FONT}`;
      const pw = ctx.measureText(d.status).width + 26;
      rr(ctx, W - PAD - pw, y + 66, pw, 28, 14);
      ctx.fillStyle = dark ? 'rgba(0,198,224,0.18)' : 'rgba(10,91,255,0.10)';
      ctx.fill(); ctx.strokeStyle = d.accent; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.fillStyle = dark ? '#8FE9F5' : d.accent;
      ctx.fillText(d.status, W - PAD - pw / 2, y + 85);
    }
    ctx.textAlign = 'left';

    y += 116;
    ctx.strokeStyle = line; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
    y += 30;

    // ---- meta boxes: Prepared For | Quotation details ----
    const colW = (inner - 22) / 2;
    const metaRowH = 26;
    const leftLines = [
      d.clientCompany ? d.clientName : d.clientName,
      d.clientCompany,
    ].filter(Boolean);
    const rightLines = [
      ['Date', d.date],
      ['Valid Until', d.validUntil],
      ['Project', d.project],
    ];
    const boxH = 44 + Math.max(leftLines.length * 24, rightLines.length * metaRowH) + 14;

    // left box
    rr(ctx, PAD, y, colW, boxH, 14); ctx.fillStyle = panelBg; ctx.fill();
    ctx.strokeStyle = line; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = faint; ctx.font = `bold 11px ${FONT}`;
    ctx.fillText('PREPARED FOR', PAD + 18, y + 24);
    let ly = y + 50;
    leftLines.forEach((t, i) => {
      ctx.fillStyle = i === 0 ? ink : soft;
      ctx.font = `${i === 0 ? 'bold 19px' : '15px'} ${FONT}`;
      ctx.fillText(t, PAD + 18, ly); ly += 24;
    });

    // right box
    const rx = PAD + colW + 22;
    rr(ctx, rx, y, colW, boxH, 14); ctx.fillStyle = panelBg; ctx.fill();
    ctx.strokeStyle = line; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = faint; ctx.font = `bold 11px ${FONT}`;
    ctx.fillText('QUOTATION DETAILS', rx + 18, y + 24);
    let ry2 = y + 50;
    rightLines.forEach(([k, v]) => {
      ctx.fillStyle = faint; ctx.font = `13px ${FONT}`; ctx.fillText(k, rx + 18, ry2);
      ctx.fillStyle = ink;  ctx.font = `bold 13px ${FONT}`;
      ctx.textAlign = 'right';
      const vw = String(v || '—');
      ctx.fillText(vw.length > 34 ? vw.slice(0, 33) + '…' : vw, rx + colW - 18, ry2);
      ctx.textAlign = 'left';
      ry2 += metaRowH;
    });

    y += boxH + 30;

    // ---- description / scope ----
    const para = (label, lines) => {
      if (!lines.length) return;
      ctx.fillStyle = faint; ctx.font = `bold 11px ${FONT}`;
      ctx.fillText(label.toUpperCase(), PAD, y);
      y += 22;
      ctx.fillStyle = soft; ctx.font = `14px ${FONT}`;
      lines.forEach(t => { ctx.fillText(t, PAD, y); y += 20; });
      y += 12;
    };
    para('Scope of work', scopeLines);
    para('About this quotation', descLines);

    // ---- items table ----
    ctx.fillStyle = ink; ctx.font = `bold 13px ${FONT}`;
    ctx.fillText('LINE ITEMS', PAD, y);
    y += 12;
    rr(ctx, PAD, y + 12, inner, 40, 10);
    ctx.fillStyle = dark ? 'rgba(10,91,255,0.28)' : 'rgba(10,91,255,0.09)'; ctx.fill();
    ctx.fillStyle = ink; ctx.font = `bold 12.5px ${FONT}`;
    ctx.fillText('#', PAD + 18, y + 37);
    ctx.fillText('DESCRIPTION', PAD + 52, y + 37);
    ctx.textAlign = 'right'; ctx.fillText('AMOUNT', PAD + inner - 18, y + 37); ctx.textAlign = 'left';
    y += 52;

    d.items.forEach((it, i) => {
      const rh = itemHeights[i];
      if (i % 2 === 1) { rr(ctx, PAD, y, inner, rh, 6); ctx.fillStyle = dark ? 'rgba(10,24,56,0.5)' : '#FAFCFF'; ctx.fill(); }
      ctx.strokeStyle = line; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PAD, y + rh); ctx.lineTo(PAD + inner, y + rh); ctx.stroke();
      ctx.fillStyle = faint; ctx.font = `13px ${FONT}`;
      ctx.fillText(String(i + 1).padStart(2, '0'), PAD + 18, y + 30);
      ctx.fillStyle = ink; ctx.font = `15px ${FONT}`;
      let ty = y + 30;
      wrap(ctx, it.label, inner - 300).forEach(t => { ctx.fillText(t, PAD + 52, ty); ty += 21; });
      ctx.fillStyle = ink; ctx.font = `bold 15px ${FONT}`;
      ctx.textAlign = 'right'; ctx.fillText(money(it.amount), PAD + inner - 18, y + 30); ctx.textAlign = 'left';
      y += rh;
    });

    y += 26;

    // ---- totals ----
    const totW = 420, totX = W - PAD - totW;
    const rows = [
      ['Subtotal', money(toInt(d.subtotal)), false],
      [`Advance (${d.advance ? Math.round(toInt(d.advance) / (toInt(d.total) || 1) * 100) : 0}%)`, money(toInt(d.advance)), false],
      ['Paid so far', money(toInt(d.paid)), false],
      ['Balance due', money(toInt(d.balance)), false],
    ];
    let ty2 = y;
    rows.forEach(([k, v, strong]) => {
      ctx.fillStyle = faint; ctx.font = `${strong ? 'bold ' : ''}14px ${FONT}`;
      ctx.fillText(k, totX, ty2 + 4);
      ctx.fillStyle = ink; ctx.font = `${strong ? 'bold ' : ''}14px ${FONT}`;
      ctx.textAlign = 'right'; ctx.fillText(v, totX + totW, ty2 + 4); ctx.textAlign = 'left';
      ty2 += 30;
    });
    // grand total highlight
    const gtH = 62;
    rr(ctx, totX - 20, ty2 + 2, totW + 20, gtH, 14);
    const gg = ctx.createLinearGradient(totX - 20, 0, totX + totW, 0);
    gg.addColorStop(0, d.accent); gg.addColorStop(1, d.accent2);
    ctx.fillStyle = gg; ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.font = `bold 15px ${FONT}`;
    ctx.fillText('TOTAL', totX, ty2 + 40);
    ctx.textAlign = 'right'; ctx.font = `900 24px ${FONT}`;
    ctx.fillText(money(toInt(d.total)), totX + totW - 12, ty2 + 42); ctx.textAlign = 'left';

    // left of totals: terms + notes
    let lyy = y + 4;
    const blockPara = (label, lines) => {
      if (!lines.length) return;
      ctx.fillStyle = faint; ctx.font = `bold 11px ${FONT}`;
      ctx.fillText(label.toUpperCase(), PAD, lyy); lyy += 20;
      ctx.fillStyle = soft; ctx.font = `13.5px ${FONT}`;
      lines.forEach(t => { ctx.fillText(t, PAD, lyy); lyy += 20; });
      lyy += 8;
    };
    blockPara('Payment terms', termsLines);
    blockPara('Notes', noteLines);

    y = Math.max(ty2 + gtH + 40, lyy + 20);

    // ---- bank details ----
    if (bankLines.length) {
      const bh = 44 + bankLines.length * 24 + 8;
      rr(ctx, PAD, y, inner, bh, 14);
      ctx.fillStyle = panelBg; ctx.fill();
      ctx.strokeStyle = d.accent; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.fillStyle = d.accent; ctx.font = `bold 11px ${FONT}`;
      ctx.fillText('PAY / BANK DETAILS', PAD + 18, y + 26);
      let by = y + 50;
      bankLines.forEach(t => { ctx.fillStyle = soft; ctx.font = `13.5px ${FONT}`; ctx.fillText(t, PAD + 18, by); by += 24; });
      y += bh + 28;
    }

    // measuring pass stops here — the footer is drawn on the real pass only
    if (measureOnly) return y;

    // ---- footer ----
    ctx.strokeStyle = line; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(PAD, H - 130); ctx.lineTo(W - PAD, H - 130); ctx.stroke();
    ctx.fillStyle = soft; ctx.font = `13px ${FONT}`;
    let fy = H - 100;
    footLines.forEach(t => { ctx.fillText(t, PAD, fy); fy += 22; });
    ctx.fillStyle = faint; ctx.font = `12px ${FONT}`;
    ctx.fillText(`${company.contact.address}  ·  ${company.contact.phoneDisplay || company.contact.phone}`, PAD, fy + 4);
    ctx.textAlign = 'right';
    ctx.fillStyle = d.accent; ctx.font = `bold 12px ${FONT}`;
    ctx.fillText(`${company.fullName} · ${new Date().getFullYear()}`, W - PAD, fy + 4);
    ctx.textAlign = 'left';

    ctx.fillStyle = g; ctx.fillRect(0, H - 8, W, 8);
    return y;
    }
  }, [d]);

  // ── Template renderer (the owner's own letterhead) ──────────────
  const drawTemplate = useCallback(() => {
    if (!canvasRef.current || !d) return;
    renderTemplate(canvasRef.current, tplRef.current, {
      ...d,
      shots: { laptop: shotImgs.current.laptop, phone: shotImgs.current.phone },
    });
  }, [d, assetsReady]);

  useEffect(() => {
    if (mode === 'template') drawTemplate();
    else draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, draw, drawTemplate, assetsReady]);

  // Start on the owner's template every time the studio opens
  useEffect(() => { if (isOpen) setMode('template'); }, [isOpen]);

  // ── Exports ─────────────────────────────────────────────────────
  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(''), 2600); };

  // ── Laptop / phone screenshots ─────────────────────────────────
  const shotField = (k) => (k === 'laptop' ? 'laptopShot' : 'phoneShot');
  const pickShot = (k) => (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\//.test(file.type)) { flash('Choose an image file.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const im = new Image();
      im.onload = () => {
        // Downscale so two screenshots still fit comfortably in one Firestore
        // document (1 MB limit) — the mockup is only ~650 px at export size.
        const maxW = 760;
        const sc = Math.min(1, maxW / im.width);
        const cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(im.width * sc));
        cv.height = Math.max(1, Math.round(im.height * sc));
        const cx = cv.getContext('2d');
        cx.fillStyle = '#FFFFFF'; cx.fillRect(0, 0, cv.width, cv.height);
        cx.drawImage(im, 0, 0, cv.width, cv.height);
        const data = cv.toDataURL('image/jpeg', 0.72);
        setShots(s => ({ ...s, [k]: data }));
        onShotsChange?.({ [shotField(k)]: data });
        flash(`${k === 'laptop' ? 'Laptop' : 'Phone'} screenshot added`);
      };
      im.onerror = () => flash('That image could not be read.');
      im.src = reader.result;
    };
    reader.readAsDataURL(file);
  };
  const clearShot = (k) => {
    setShots(s => ({ ...s, [k]: '' }));
    shotImgs.current[k] = null;
    onShotsChange?.({ [shotField(k)]: '' });
    setAssetsReady(n => n + 1);
  };


  const downloadPNG = () => {
    const cv = canvasRef.current; if (!cv) return;
    setBusy('png');
    cv.toBlob(blob => {
      setBusy('');
      if (!blob) return flash('Could not build the image — try again.');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${(d.refNo || 'quotation').replace(/[^\w-]+/g, '_')}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      flash('Image downloaded — attach it in WhatsApp.');
    }, 'image/png');
  };

  // Save the rendered letterhead onto the quotation itself, so it can be
  // reopened / sent later instead of being only a one-time download.
  const saveToQuotation = async () => {
    const cv = canvasRef.current; if (!cv || !onSaveImage) return;
    setBusy('save');
    try {
      const blob = await new Promise(res => cv.toBlob(res, 'image/jpeg', 0.88));
      if (!blob) throw new Error('Could not build the image — try again.');
      await onSaveImage(blob);
      flash('Saved to quotation — open it anytime from the quotation.');
    } catch (e) {
      flash(e?.message || 'Could not save — try again.');
    } finally { setBusy(''); }
  };

  const copyImage = async () => {
    const cv = canvasRef.current; if (!cv) return;
    setBusy('copy');
    try {
      const blob = await new Promise(res => cv.toBlob(res, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      flash('Copied! Paste (Ctrl+V) in WhatsApp.');
    } catch {
      flash('Copy not supported here — use Download instead.');
    } finally { setBusy(''); }
  };

  const printPDF = () => {
    const cv = canvasRef.current; if (!cv) return;
    const url = cv.toDataURL('image/png');
    const win = window.open('', '_blank', 'width=900,height=1100');
    if (!win) return flash('Pop-up blocked — allow pop-ups to print.');
    win.document.write(`
      <html><head><title>${d.refNo || 'Quotation'}</title>
      <style>@page{size:A4;margin:0}body{margin:0}img{width:100%;display:block}</style>
      </head><body><img src="${url}" onload="setTimeout(()=>{window.focus();window.print();},250)"/></body></html>`);
    win.document.close();
  };

  if (!isOpen || !d) return null;

  const ed = (k) => (e) => set(k, e.target.value);
  const numEd = (k) => (e) => set(k, toInt(e.target.value));
  const listEd = (k) => (e) => set(k, e.target.value.split('\n'));
  const section = (label) => (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4 }}>
      <span style={{ fontSize:10.5, fontWeight:800, letterSpacing:'0.06em', color:C.cyan }}>{label.toUpperCase()}</span>
      <span style={{ flex:1, height:1, background:'rgba(32,52,93,0.6)' }} />
    </div>
  );

  return createPortal(
    <div className="doc-studio-overlay" style={{ position:'fixed', inset:0, zIndex:220, background:'rgba(0,0,0,0.78)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="doc-studio-modal" style={{ width:'100%', maxWidth:1180, height:'92vh', background:'rgba(6,17,43,0.99)', border:'1px solid rgba(32,52,93,0.7)', borderRadius:18, boxShadow:'0 30px 90px rgba(0,0,0,0.7)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {/* header */}
        <div className="doc-studio-head" style={{ padding:'14px 20px', borderBottom:'1px solid rgba(32,52,93,0.6)', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <ImageIcon size={18} style={{ color:C.cyan }} />
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:800, color:'#fff' }}>Quotation Image Studio</div>
            <div className="doc-studio-sub" style={{ fontSize:11, color:C.muted, marginTop:1 }}>
              {mode === 'template' ? 'Your letterhead · edit the fields · send as image / PDF' : 'Classic design · edit → send as image / PDF'}
            </div>
          </div>
          <div style={{ display:'flex', gap:4, padding:3, background:'rgba(4,13,31,0.8)', border:'1px solid rgba(32,52,93,0.7)', borderRadius:10 }}>
            <ERPBtn size="sm" variant={mode === 'template' ? 'primary' : 'ghost'} onClick={() => setMode('template')}>
              <LayoutTemplate size={12} /> My template
            </ERPBtn>
            <ERPBtn size="sm" variant={mode === 'classic' ? 'primary' : 'ghost'} onClick={() => setMode('classic')}>
              <Sparkles size={12} /> Classic
            </ERPBtn>
          </div>
          {msg && <span style={{ fontSize:11.5, fontWeight:700, color:'#18C77A' }}>{msg}</span>}
          <ERPBtn size="sm" variant="ghost" onClick={() => setShowEditor(s => {
            const next = !s;
            if (next && typeof window !== 'undefined' && window.innerWidth <= 900) {
              setTimeout(() => document.querySelector('.doc-studio-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
            }
            return next;
          })}>{showEditor ? 'Hide editor' : 'Show editor'}</ERPBtn>
          <ERPBtn size="sm" variant="ghost" onClick={onClose}>✕ Close</ERPBtn>
        </div>

        <div className="doc-studio-body">
          {/* editor */}
          {showEditor && (
            <div className="doc-studio-editor" style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {mode === 'template' ? (
                <>
                  <div style={{ fontSize:10.5, color:C.muted, lineHeight:1.5, padding:'8px 10px', background:'rgba(0,198,224,0.07)', border:'1px solid rgba(0,198,224,0.22)', borderRadius:8 }}>
                    Unga letterhead image adiye use aagum — keezha irukura values mattum athula overwrite aagum.
                  </div>

                  <div style={{ display:'flex', gap:8 }}>
                    <ERPInput label="Quotation No" value={d.refNo} onChange={ed('refNo')} style={{ flex:1 }} />
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <ERPInput label="Date" value={d.date} onChange={ed('date')} style={{ flex:1 }} />
                    <ERPInput label="Valid until" value={d.validUntil} onChange={ed('validUntil')} style={{ flex:1 }} />
                  </div>
                  <ERPInput label="Client (TO)" value={d.clientLine} onChange={ed('clientLine')} />
                  <ERPInput label="Subject" value={d.subject} onChange={ed('subject')} />
                  <ERPTextarea label="Intro paragraph" value={d.intro} onChange={ed('intro')} rows={3} />
                  <ERPTextarea label="Service details" value={d.service} onChange={ed('service')} rows={4} />

                  {section('Key features')}
                  <ERPTextarea label="One feature per line (tick list)" value={d.features.join('\n')} onChange={listEd('features')} rows={8} />

                  {section('Pricing table')}
                  <div style={{ display:'flex', gap:8 }}>
                    <ERPInput label="Actual cost" type="number" value={d.listPrice} onChange={numEd('listPrice')} style={{ flex:1 }} />
                    <ERPInput label="Discounted price (0 = no discount)" type="number" value={d.offerPrice} onChange={numEd('offerPrice')} style={{ flex:1 }} />
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <ERPInput label="Advance payment" type="number" value={d.advance} onChange={numEd('advance')} style={{ flex:1 }} />
                    <ERPInput label="Balance payment" type="number" value={d.balance} onChange={numEd('balance')} style={{ flex:1 }} />
                  </div>

                  <ERPTextarea label="Domain & hosting notes (one per line)" value={d.domain.join('\n')} onChange={listEd('domain')} rows={4} />

                  {section('Project screenshots')}
                  <div style={{ fontSize:10.5, color:C.muted, lineHeight:1.5 }}>
                    Optional — show the client&apos;s own website / app inside the laptop and phone on the letterhead.
                  </div>
                  {[
                    { k:'laptop', label:'Laptop screen', hint:'Wide screenshot works best' },
                    { k:'phone',  label:'Phone screen',  hint:'Portrait screenshot' },
                  ].map(s => (
                    <div key={s.k} style={{ display:'flex', alignItems:'center', gap:10, padding:8, borderRadius:10,
                      border:'1px dashed rgba(32,52,93,0.8)', background:'rgba(4,13,31,0.45)' }}>
                      <div style={{ width:64, height:48, borderRadius:6, overflow:'hidden', flexShrink:0,
                        background:'rgba(10,24,56,0.9)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {shots[s.k]
                          ? <img src={shots[s.k]} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                          : <ImageIcon size={15} style={{ color:C.muted }} />}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:11.5, fontWeight:700, color:C.text }}>{s.label}</div>
                        <div style={{ fontSize:9.5, color:C.muted }}>{shots[s.k] ? 'Uploaded — shown in the mockup' : s.hint}</div>
                      </div>
                      <label style={{ padding:'6px 10px', borderRadius:8, cursor:'pointer', fontSize:10.5, fontWeight:700,
                        background:'rgba(0,102,255,0.16)', border:'1px solid rgba(0,102,255,0.5)', color:'#8CC2FF', flexShrink:0 }}>
                        {shots[s.k] ? 'Change' : 'Upload'}
                        <input type="file" accept="image/*" onChange={pickShot(s.k)} style={{ display:'none' }} />
                      </label>
                      {shots[s.k] && (
                        <button onClick={() => clearShot(s.k)} title="Remove screenshot"
                          style={{ background:'none', border:'none', color:C.red, cursor:'pointer', display:'flex', flexShrink:0 }}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}


                  {section('Payment details')}
                  <ERPInput label="Account name" value={d.bank?.accountName || ''} onChange={e => set('bank', { ...d.bank, accountName: e.target.value })} />
                  <ERPInput label="Bank" value={d.bank?.bankName || ''} onChange={e => set('bank', { ...d.bank, bankName: e.target.value })} />
                  <div style={{ display:'flex', gap:8 }}>
                    <ERPInput label="Branch" value={d.bank?.branch || ''} onChange={e => set('bank', { ...d.bank, branch: e.target.value })} style={{ flex:1 }} />
                    <ERPInput label="Account No" value={d.bank?.accountNumber || ''} onChange={e => set('bank', { ...d.bank, accountNumber: e.target.value })} style={{ flex:1 }} />
                  </div>
                  <ERPInput label="Payment remark (bank reference)" value={d.payRemark} onChange={ed('payRemark')} />

                  {section('Terms & conditions')}
                  <ERPTextarea label="One term per line" value={d.termList.join('\n')} onChange={listEd('termList')} rows={7} />
                  <div style={{ height:12 }} />
                </>
              ) : (
                <>
              <div style={{ display:'flex', gap:8 }}>
                <ERPInput label="Title" value={d.title} onChange={ed('title')} style={{ flex:1 }} />
                <ERPInput label="Ref No" value={d.refNo} onChange={ed('refNo')} style={{ width:130 }} />
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <ERPInput label="Date" value={d.date} onChange={ed('date')} style={{ flex:1 }} />
                <ERPInput label="Valid Until" value={d.validUntil} onChange={ed('validUntil')} style={{ flex:1 }} />
              </div>
              <ERPInput label="Status stamp" value={d.status} onChange={ed('status')} />
              <div style={{ height:1, background:'rgba(32,52,93,0.6)' }} />
              <ERPInput label="Client name" value={d.clientName} onChange={ed('clientName')} />
              <ERPInput label="Client company" value={d.clientCompany} onChange={ed('clientCompany')} />
              <ERPInput label="Project" value={d.project} onChange={ed('project')} />
              <ERPTextarea label="Scope of work" value={d.scope} onChange={ed('scope')} rows={3} />
              <ERPTextarea label="Description" value={d.description} onChange={ed('description')} rows={3} />
              <div style={{ height:1, background:'rgba(32,52,93,0.6)' }} />

              {/* items */}
              <div style={{ fontSize:11, fontWeight:700, color:C.subtle, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                Line items
                <ERPBtn size="sm" variant="ghost" onClick={() => set('items', [...d.items, { label:'', amount:0 }])}>
                  <Plus size={11} /> Add
                </ERPBtn>
              </div>
              {d.items.map((it, i) => (
                <div key={i} style={{ display:'flex', gap:6, alignItems:'flex-end' }}>
                  <ERPInput label={i === 0 ? 'Description' : undefined} value={it.label}
                    onChange={e => set('items', d.items.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                    style={{ flex:1 }} />
                  <ERPInput label={i === 0 ? 'Amount' : undefined} type="number" value={it.amount}
                    onChange={e => set('items', d.items.map((x, j) => j === i ? { ...x, amount: toInt(e.target.value) } : x))}
                    style={{ width:100 }} />
                  <button title="Remove" onClick={() => set('items', d.items.filter((_, j) => j !== i))}
                    style={{ background:'none', border:'1px solid rgba(32,52,93,0.6)', borderRadius:8, padding:'8px', color:C.red, cursor:'pointer', marginBottom:2 }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <div style={{ height:1, background:'rgba(32,52,93,0.6)' }} />

              <div style={{ display:'flex', gap:8 }}>
                <ERPInput label="Subtotal" type="number" value={d.subtotal} onChange={numEd('subtotal')} style={{ flex:1 }} />
                <ERPInput label="Advance" type="number" value={d.advance} onChange={numEd('advance')} style={{ flex:1 }} />
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <ERPInput label="Paid" type="number" value={d.paid} onChange={numEd('paid')} style={{ flex:1 }} />
                <ERPInput label="Balance" type="number" value={d.balance} onChange={numEd('balance')} style={{ flex:1 }} />
              </div>
              <ERPInput label="Total (big print)" type="number" value={d.total} onChange={numEd('total')} />
              <ERPTextarea label="Payment terms" value={d.terms} onChange={ed('terms')} rows={2} />
              <ERPTextarea label="Notes" value={d.notes} onChange={ed('notes')} rows={2} />
              <ERPTextarea label="Footer message" value={d.footer} onChange={ed('footer')} rows={2} />

              {/* bank */}
              <div style={{ height:1, background:'rgba(32,52,93,0.6)' }} />
              <div style={{ fontSize:11, fontWeight:700, color:C.subtle }}>Bank / payment details</div>
              <ERPInput label="Bank" value={d.bank?.bankName || ''} onChange={e => set('bank', { ...d.bank, bankName: e.target.value })} />
              <ERPInput label="Account name" value={d.bank?.accountName || ''} onChange={e => set('bank', { ...d.bank, accountName: e.target.value })} />
              <ERPInput label="Account number" value={d.bank?.accountNumber || ''} onChange={e => set('bank', { ...d.bank, accountNumber: e.target.value })} />
              <ERPInput label="Branch" value={d.bank?.branch || ''} onChange={e => set('bank', { ...d.bank, branch: e.target.value })} />

              {/* style */}
              <div style={{ height:1, background:'rgba(32,52,93,0.6)' }} />
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <label style={{ fontSize:11, color:C.subtle, fontWeight:600 }}>Theme</label>
                <ERPBtn size="sm" variant={d.theme === 'light' ? 'primary' : 'secondary'} onClick={() => set('theme','light')}>Light</ERPBtn>
                <ERPBtn size="sm" variant={d.theme === 'dark' ? 'primary' : 'secondary'} onClick={() => set('theme','dark')}>Dark</ERPBtn>
                <span style={{ marginLeft:'auto', fontSize:11, color:C.subtle }}>Accent</span>
                <input type="color" value={d.accent} onChange={e => set('accent', e.target.value)}
                  style={{ width:34, height:26, background:'none', border:'1px solid rgba(32,52,93,0.6)', borderRadius:6, cursor:'pointer' }} />
              </div>
              <div style={{ height:12 }} />
                </>
              )}
            </div>
          )}

          {/* preview */}
          <div className="doc-studio-preview" style={{ background:'rgba(4,13,31,0.6)', border:'1px solid rgba(32,52,93,0.6)', borderRadius:14 }}>
            <canvas ref={canvasRef} style={{ borderRadius:8, boxShadow:'0 18px 50px rgba(0,0,0,0.55)', background:'#fff' }} />
          </div>
        </div>

        {/* action bar */}
        <div style={{ padding:'12px 18px', borderTop:'1px solid rgba(32,52,93,0.6)', display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
          {onSaveImage && (
            <ERPBtn variant="primary" onClick={saveToQuotation} disabled={!!busy}>
              <Save size={14} /> {busy === 'save' ? 'Saving…' : 'Save to quotation'}
            </ERPBtn>
          )}
          <ERPBtn variant={onSaveImage ? 'secondary' : 'primary'} onClick={downloadPNG} disabled={!!busy}><Download size={14} /> {busy === 'png' ? 'Building…' : 'Download image'}</ERPBtn>
          <ERPBtn variant="secondary" onClick={copyImage} disabled={!!busy}><Copy size={14} /> Copy image</ERPBtn>
          <ERPBtn variant="secondary" onClick={printPDF}><Printer size={14} /> Print / Save PDF</ERPBtn>
          {quotation?.renderImage?.url && (
            <a href={quotation.renderImage.url} target="_blank" rel="noopener noreferrer"
              style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 12px', borderRadius:9, textDecoration:'none',
                background:'rgba(24,199,122,0.12)', border:'1px solid rgba(24,199,122,0.35)', color:C.green, fontWeight:700, fontSize:12 }}>
              <ExternalLink size={13} /> Open saved image
            </a>
          )}
          {waHref && (
            <a href={waHref} target="_blank" rel="noopener noreferrer"
              style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 14px', borderRadius:9, textDecoration:'none',
                background:'linear-gradient(135deg,#25D366,#128C7E)', color:'#fff', fontWeight:700, fontSize:12 }}>
              Open WhatsApp
            </a>
          )}
          <span style={{ marginLeft:'auto', fontSize:11, color:C.muted }}>
            Tip: Copy image → WhatsApp Web → Ctrl+V → Send
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
