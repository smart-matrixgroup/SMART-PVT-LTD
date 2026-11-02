import React, { useState, useEffect } from 'react';
import {
  collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDoc,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { ERPPanel, ERPPanelHeader, ERPBadge, ERPBtn, ERPModal, ERPInput, ERPSelect, ERPTextarea, ERPEmpty, ERPAvatar, C } from '../components/ERPui';
import { syncFinanceIncome } from '../finance/financeSync';
import PrivateFileLink from '../components/PrivateFileLink';
import { Plus, CheckCircle2, FileText, ExternalLink, ReceiptText, XCircle, Printer, Search, Download, Share2, Trash2, AlertTriangle } from 'lucide-react';
import { nextNumber } from '../../staff/staffUtils';
import { toInt, formatLKR, fmtDate, todayISO } from '../money';
import { company } from '../../config/company';

// Only used when the app is running without a live Firebase connection.
const DEV_CLIENTS = [
  { id: 'C001', name: 'John Perera', company: 'Perera Holdings' },
  { id: 'C002', name: 'Sarah Fernando', company: 'Mehala Restaurant' },
  { id: 'C003', name: 'Kumar Arasan', company: 'KA Retail' },
];

const DEV_INVOICES = [
  { id: 'dev1', invoiceNo: 'INV-2026-001', clientName: 'John Perera', description: 'Project Initiation Deposit — Corporate Website', milestone: 'Advance Payment', amountValue: 30000, amount: 'LKR 30,000', status: 'paid', issuedAt: '2026-10-01' },
  { id: 'dev2', invoiceNo: 'INV-2026-002', clientName: 'Sarah Fernando', description: 'POS Development Milestone 1', milestone: 'Development Start', amountValue: 50000, amount: 'LKR 50,000', status: 'pending', issuedAt: '2026-10-03' },
];

const COLORS = ['#0066FF', '#8B5CF6', '#18C77A', '#F5B942', '#F05A67'];
const MILESTONES = ['Advance Payment', 'Discovery & Blueprint', 'Design Complete', 'Development Milestone', 'QA & Testing', 'Final Delivery', 'Monthly Retainer', 'Other'];

const KIND_LABEL = { Advance: 'Advance payment', Part: 'Part payment', Final: 'Final / balance payment', Invoice: 'Invoice payment', Client: 'Client receipt payment' };

const DEV_PAYMENTS = [
  { id: 'devpay1', receiptNo: 'R-2026-0001', clientId: 'C001', clientName: 'John Perera', clientCompany: 'Perera Holdings',
    amount: 30000, date: '2026-10-01', method: 'Bank Transfer', kind: 'Advance', quotationNo: 'Q-2026-014',
    invoiceNo: 'INV-2026-001', recordedBy: 'Admin', source: 'quotation', createdAt: null },
];

// Dev-only quotation so the "balance still to pay" band is visible without
// a live Firebase connection.
const DEV_QUOTES = [
  { id: 'devq1', quotationNo: 'Q-2026-014', clientName: 'John Perera', totalAmount: 120000, paidTotal: 30000 },
];

const money = n => `LKR ${Number(n || 0).toLocaleString()}`;

const EMPTY_FORM = {
  clientId: '', description: '', milestone: '', amount: '', issuedAt: '',
  quotationId: '', paymentDetails: '',
};

// Settings → Bank details as plain "Label: value" lines, so the same text
// can be prefilled (and edited) on each invoice.
const bankTextOf = (b) => {
  if (!b) return '';
  const rows = Array.isArray(b.payRows) && b.payRows.length
    ? b.payRows
    : [
        ['Account Name', b.accountName], ['Bank', b.bankName], ['Branch', b.branch],
        ['Account No', b.accountNumber], ['Account Type', b.accountType], ['SWIFT', b.swiftCode],
      ].filter(([, v]) => String(v || '').trim()).map(([label, value]) => ({ label, value }));
  const lines = rows
    .filter(r => String(r.value || '').trim())
    .map(r => `${r.label}: ${r.value}`);
  if (b.instructions) lines.push(String(b.instructions));
  return lines.join('\n');
};
const amountOf = inv => Number(inv.amountValue ?? (String(inv.amount || '').replace(/[^0-9.]/g, '') || 0));
const isoDate = v => {
  if (!v) return '';
  if (typeof v === 'string') return v.slice(0, 10);
  if (v.toDate) return v.toDate().toISOString().slice(0, 10);
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
};
const prettyDate = v => {
  const iso = isoDate(v);
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

// ── Receipt image (download / share) ──────────────────────────────
// No html2canvas / jsPDF in the project, so the receipt is drawn directly on
// a canvas. Same look as the on-screen white receipt card, at print quality.
const receiptFileName = (r) =>
  `Receipt-${String(r?.receiptNo || r?.invoiceNo || 'payment').replace(/[^\w.-]+/g, '-')}.png`;

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = src;
  });
}

function wrapText(ctx, text, x, y, maxW, lineH, maxLines = 6) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  let line = '';
  let lines = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y);
      y += lineH;
      lines++;
      line = words[i];
      if (lines >= maxLines - 1 && i < words.length - 1) {
        ctx.fillText(`${line}…`, x, y);
        return y + lineH;
      }
    } else {
      line = test;
    }
  }
  if (line) { ctx.fillText(line, x, y); y += lineH; }
  return y;
}

async function drawReceiptCanvas(r) {
  const W = 1240, H = 1754, M = 84;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Thin brand bar across the top
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, '#0b1f3a');
  grad.addColorStop(1, '#0066FF');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, 12);

  const logo = await loadImage(company.logos.lightMode || company.logos.darkMode);
  let textX = M;
  if (logo && logo.width) {
    const lh = 64;
    const lw = Math.min(220, (logo.width / logo.height) * lh);
    ctx.drawImage(logo, M, M, lw, lh);
    textX = M + lw + 18;
  }
  ctx.fillStyle = '#0b1f3a';
  ctx.font = 'bold 26px Georgia, "Times New Roman", serif';
  ctx.fillText(company.fullName, textX, M + 26);
  ctx.fillStyle = '#4b5563';
  ctx.font = '15px Georgia, "Times New Roman", serif';
  wrapText(ctx, company.contact.address, textX, M + 50, W - textX - M - 320, 20, 2);
  ctx.fillText(`${company.contact.phone}  ·  ${company.contact.email}`, textX, M + 92);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#0b1f3a';
  ctx.font = 'bold 30px Georgia, "Times New Roman", serif';
  ctx.fillText('PAYMENT RECEIPT', W - M, M + 28);
  ctx.fillStyle = '#374151';
  ctx.font = '17px Georgia, "Times New Roman", serif';
  ctx.fillText(r.receiptNo || r.invoiceNo || '—', W - M, M + 58);
  ctx.textAlign = 'left';

  // Divider
  const dg = ctx.createLinearGradient(M, 0, W - M, 0);
  dg.addColorStop(0, '#0b1f3a');
  dg.addColorStop(1, '#0066FF');
  ctx.fillStyle = dg;
  ctx.fillRect(M, 214, W - M * 2, 3);

  const rows = [
    ['Received from', `${r.clientName || '—'}${r.clientCompany ? `, ${r.clientCompany}` : ''}`],
    ['Quotation No', r.quotationNo || '—'],
    ['Invoice No', r.invoiceNo || '—'],
    ['Payment date', fmtDate(r.date) || prettyDate(r.date) || '—'],
    ['Payment method', r.method || '—'],
    ['Payment type', KIND_LABEL[r.kind] || r.kind || 'Payment'],
    ['Recorded by', r.recordedBy || '—'],
    ['Reference', r.reference || ''],
    ['Notes', r.notes || ''],
  ].filter(([, v]) => v && v !== '—');

  let y = 272;
  rows.forEach(([label, value]) => {
    ctx.fillStyle = '#6b7280';
    ctx.font = '16px Georgia, "Times New Roman", serif';
    ctx.fillText(label, M, y);
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 17px Georgia, "Times New Roman", serif';
    const nextY = wrapText(ctx, value, M + 230, y, W - M * 2 - 230, 24, 4);
    y = Math.max(y + 38, nextY + 10);
  });

  const rrect = (x, yy, w, h, rad) => {
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, yy, w, h, rad); return; }
    ctx.beginPath();
    ctx.moveTo(x + rad, yy);
    ctx.arcTo(x + w, yy, x + w, yy + h, rad);
    ctx.arcTo(x + w, yy + h, x, yy + h, rad);
    ctx.arcTo(x, yy + h, x, yy, rad);
    ctx.arcTo(x, yy, x + w, yy, rad);
    ctx.closePath();
  };

  const boxY = H - 340, boxH = 112;

  // Blue band — how much the client still has to pay on this quotation.
  if (r.balance != null) {
    const bH = 64, bY = boxY - 88;
    const bg = ctx.createLinearGradient(M, 0, W - M, 0);
    bg.addColorStop(0, '#0b2e6b');
    bg.addColorStop(1, '#0a5bd6');
    ctx.fillStyle = bg;
    rrect(M, bY, W - M * 2, bH, 14);
    ctx.fill();
    ctx.fillStyle = '#cfe3ff';
    ctx.font = 'bold 16px Georgia, "Times New Roman", serif';
    ctx.fillText('BALANCE STILL TO PAY', M + 28, bY + 40);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px Georgia, "Times New Roman", serif';
    ctx.fillText(formatLKR(r.balance), W - M - 28, bY + 42);
    ctx.textAlign = 'left';
  }

  // Amount box (soft blue)
  const ag = ctx.createLinearGradient(M, boxY, W - M, boxY + boxH);
  ag.addColorStop(0, '#eff6ff');
  ag.addColorStop(1, '#dbeafe');
  ctx.fillStyle = ag;
  ctx.strokeStyle = '#93c5fd';
  ctx.lineWidth = 2;
  rrect(M, boxY, W - M * 2, boxH, 16);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#1d4ed8';
  ctx.font = 'bold 16px Georgia, "Times New Roman", serif';
  ctx.fillText('AMOUNT RECEIVED', M + 28, boxY + 68);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#0b2e6b';
  ctx.font = 'bold 40px Georgia, "Times New Roman", serif';
  ctx.fillText(formatLKR(r.amount), W - M - 28, boxY + 74);
  ctx.textAlign = 'left';

  // Footer
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(M, H - 150);
  ctx.lineTo(W - M, H - 150);
  ctx.stroke();
  ctx.fillStyle = '#6b7280';
  ctx.font = '14px Georgia, "Times New Roman", serif';
  ctx.fillText(`Thank you for your business — ${company.fullName}`, M, H - 118);
  ctx.textAlign = 'right';
  ctx.fillText('Saved in Invoice Centre', W - M, H - 118);
  ctx.textAlign = 'left';

  return cv;
}

function canvasToBlob(cv) {
  return new Promise(resolve => cv.toBlob(b => resolve(b), 'image/png'));
}

export default function ERPInvoices() {
  const { isDevSession, currentUser } = useAuth();
  const live = isFirebaseConfigured && !isDevSession;

  const [invoices, setInvoices] = useState(live ? [] : DEV_INVOICES);
  const [clients, setClients] = useState(live ? [] : DEV_CLIENTS);
  const [proofs, setProofs] = useState([]);
  const [payments, setPayments] = useState(live ? [] : DEV_PAYMENTS);
  // Quotations are read only to show "balance still to pay" on a receipt.
  const [quotations, setQuotations] = useState(live ? [] : DEV_QUOTES);
  const [filter, setFilter] = useState('All');
  const [showCreate, setShowCreate] = useState(false);
  const [markPaidId, setMarkPaidId] = useState(null);
  const [delInv, setDelInv] = useState(null);          // invoice being deleted
  const [delWithReceipt, setDelWithReceipt] = useState(false);
  const [delReceipt, setDelReceipt] = useState(null);  // saved receipt being deleted
  const [receipt, setReceipt] = useState(null);       // printable receipt modal
  const [receiptBusy, setReceiptBusy] = useState(''); // 'download' | 'share' while the PNG is drawn
  const [receiptMsg, setReceiptMsg] = useState('');   // inline hint under the actions
  const [receiptQ, setReceiptQ] = useState('');       // search by payer / number
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);
  // Payment details printed on the invoice — prefilled from Settings → Bank
  // details (settings/bankDetails), editable per invoice.
  const [bankDetails, setBankDetails] = useState(null);
  const [showBank, setShowBank] = useState(false);

  useEffect(() => {
    if (!live) return;
    getDoc(doc(db, 'settings', 'bankDetails'))
      .then(snap => setBankDetails(snap.exists() ? snap.data() : null))
      .catch(() => { /* bank details are optional */ });
  }, [live]);

  // Auto-default the invoice's payment details from Settings (still editable).
  useEffect(() => {
    if (!bankDetails) return;
    const text = bankTextOf(bankDetails);
    if (!text) return;
    setForm(p => (p.paymentDetails ? p : { ...p, paymentDetails: text }));
  }, [bankDetails]);

  // Live invoices + clients + client-sent payment receipts
  useEffect(() => {
    if (!live) return;
    const unInv = onSnapshot(collection(db, 'invoices'), snap => {
      setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => console.error('Invoices listener error', err));

    const unClients = onSnapshot(collection(db, 'clients'), snap => {
      setClients(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .filter(c => c.status !== 'deleted')
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      );
    }, err => console.error('Invoice clients listener error', err));

    const unProofs = onSnapshot(collection(db, 'paymentProofs'), snap => {
      setProofs(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)));
    }, err => console.error('Payment receipts listener error', err));

    // Every recorded payment carries its own receiptNo — this is the
    // auto-saved receipt registry shown in the Saved Receipts panel.
    const unPayments = onSnapshot(collection(db, 'payments'), snap => {
      setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => console.error('Saved receipts listener error', err));

    const unQuotes = onSnapshot(collection(db, 'quotations'), snap => {
      setQuotations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => console.error('Quotations listener error', err));

    return () => { unInv(); unClients(); unProofs(); unPayments(); unQuotes(); };
  }, [live]);

  const filtered = filter === 'All' ? invoices : invoices.filter(i => i.status === filter);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + amountOf(i), 0);
  const totalPending = invoices.filter(i => i.status === 'pending').reduce((s, i) => s + amountOf(i), 0);
  const newProofs = proofs.filter(p => p.status !== 'Verified' && p.status !== 'Rejected').length;

  // Advance money received and what is still to collect across all quotations.
  // Detection is deliberately broad: a payment can be tagged "Advance",
  // "Advance payment", or be an invoice marked paid with the Advance Payment
  // milestone (invoice-only receipts) — all of them count.
  const invoiceOfPayment = p =>
    invoices.find(i => (p.invoiceId && i.id === p.invoiceId) || (p.invoiceNo && i.invoiceNo === p.invoiceNo)) || null;
  const isAdvanceRow = p =>
    /advance/i.test(`${p.kind || ''} ${p.paymentKind || ''}`) ||
    /advance/i.test(String(invoiceOfPayment(p)?.milestone || ''));
  const advancePayments = payments.filter(isAdvanceRow);
  const advanceInvoiceOnly = invoices.filter(i =>
    i.status === 'paid' && /advance/i.test(String(i.milestone || '')) &&
    !payments.some(p => p.invoiceId === i.id || (p.invoiceNo && p.invoiceNo === i.invoiceNo)));
  const totalAdvance = advancePayments.reduce((s, p) => s + toInt(p.amount), 0)
    + advanceInvoiceOnly.reduce((s, i) => s + amountOf(i), 0);
  const advanceCount = advancePayments.length + advanceInvoiceOnly.length;
  // Outstanding balance for one client — every quotation they have, summed.
  const balanceForClient = (clientId, clientName) => {
    const qs = quotations.filter(q =>
      (clientId && q.clientId === clientId) || (!clientId && clientName && q.clientName === clientName));
    if (!qs.length) return null;
    return qs.reduce((s, q) => {
      const total = toInt(q.totalAmount);
      if (!total) return s;
      const b = (q.balanceManual && q.balanceOverride != null && q.balanceOverride !== '')
        ? toInt(q.balanceOverride)
        : Math.max(0, total - toInt(q.paidTotal));
      return s + Math.max(0, b);
    }, 0);
  };

  // ── Create-invoice form: quotation → client + totals ─────────────
  const activeQuotes = quotations
    .filter(q => q.status !== 'deleted' && q.status !== 'Rejected')
    .sort((a, b) => String(b.quotationNo || '').localeCompare(String(a.quotationNo || '')));
  const clientOfQuote = q => clients.find(c =>
    (q.clientId && c.id === q.clientId) || (!q.clientId && c.name === q.clientName)) || null;
  const quoteOptions = activeQuotes.map(q => ({
    value: q.id,
    label: `${q.quotationNo || 'Quotation'} — ${q.clientName || 'Client'} · ${money(toInt(q.totalAmount))}`,
  }));
  const selectedQuote = activeQuotes.find(q => q.id === form.quotationId) || null;
  const quoteTotal = selectedQuote ? toInt(selectedQuote.totalAmount) : 0;
  const quotePaid = selectedQuote ? toInt(selectedQuote.paidTotal) : 0;
  const quoteBalance = selectedQuote
    ? ((selectedQuote.balanceManual && selectedQuote.balanceOverride != null && selectedQuote.balanceOverride !== '')
        ? Math.max(0, toInt(selectedQuote.balanceOverride))
        : Math.max(0, quoteTotal - quotePaid))
    : 0;
  const formAmount = toInt(form.amount);
  const quoteAfter = selectedQuote ? Math.max(0, quoteBalance - formAmount) : 0;

  const pickQuote = (quotationId) => {
    const q = activeQuotes.find(x => x.id === quotationId) || null;
    if (!q) {
      setForm(p => ({ ...p, quotationId: '' }));
      return;
    }
    const client = clientOfQuote(q);
    const bal = (q.balanceManual && q.balanceOverride != null && q.balanceOverride !== '')
      ? Math.max(0, toInt(q.balanceOverride))
      : Math.max(0, toInt(q.totalAmount) - toInt(q.paidTotal));
    const advance = q.advanceManual
      ? Math.min(toInt(q.totalAmount), Math.max(0, toInt(q.advanceAmount)))
      : Math.round(toInt(q.totalAmount) * toInt(q.advancePct) / 100);
    const first = toInt(q.paidTotal) === 0;
    const amount = first && advance > 0 ? Math.min(advance, bal) : bal;
    setForm(p => ({
      ...p,
      quotationId: q.id,
      clientId: client?.id || p.clientId,
      description: p.description.trim()
        ? p.description
        : `${first ? 'Advance payment' : 'Payment'} — ${q.title || q.service || q.quotationNo || 'Quotation'}`,
      milestone: p.milestone || (first ? 'Advance Payment' : 'Development Milestone'),
      amount: amount ? String(amount) : p.amount,
    }));
  };

  const bankLines = bankTextOf(bankDetails);

  const quoteBalanceTotal = quotations.reduce((s, q) => {
    const total = toInt(q.totalAmount);
    if (!total) return s;
    const b = (q.balanceManual && q.balanceOverride != null && q.balanceOverride !== '')
      ? toInt(q.balanceOverride)
      : Math.max(0, total - toInt(q.paidTotal));
    return s + Math.max(0, b);
  }, 0);

  // ── Saved receipts — payments first; paid invoices that predate the
  //    receipt registry are still listed so nothing is missing. ──
  const dateOf = r => {
    const v = r.date || r.paidAt || r.createdAt;
    if (!v) return 0;
    if (v.toMillis) return v.toMillis();
    if (v.seconds) return v.seconds * 1000;
    const t = new Date(v).getTime();
    return Number.isNaN(t) ? 0 : t;
  };
  // The quotation a receipt came from (matched by id first, then by number).
  const findQuote = (qid, qno) =>
    quotations.find(q => (qid && q.id === qid) || (qno && q.quotationNo === qno)) || null;

  // How much is still to pay. Prefers the balance stored on the payment
  // itself, then the quotation's live balance (manual override, else total −
  // paid). Returns null when the payment is not tied to a quotation.
  const balanceOf = r => {
    if (!r) return null;
    if (r.balanceAfter != null && r.balanceAfter !== '') return Math.max(0, toInt(r.balanceAfter));
    const q = findQuote(r.quotationId, r.quotationNo);
    if (!q) return null;
    if (q.balanceManual && q.balanceOverride != null && q.balanceOverride !== '') return Math.max(0, toInt(q.balanceOverride));
    const total = toInt(q.totalAmount);
    if (!total) return null;
    return Math.max(0, total - toInt(q.paidTotal));
  };

  const receiptRows = [
    ...payments.map(p => ({
      key: `pay-${p.id}`, id: p.id, clientId: p.clientId || '', receiptNo: p.receiptNo || '', clientName: p.clientName || 'Client',
      clientCompany: p.clientCompany || '', amount: toInt(p.amount), date: p.date || '',
      method: p.method || '—', kind: p.kind || '',
      quotationNo: p.quotationNo || findQuote(p.quotationId)?.quotationNo || '',
      invoiceNo: p.invoiceNo || '', recordedBy: p.recordedBy || '', source: p.source || 'quotation',
      reference: p.reference || '', notes: p.notes || '', createdAt: p.createdAt || null,
      balance: balanceOf(p),
    })),
    ...invoices
      .filter(i => i.status === 'paid' && !payments.some(p => p.invoiceId === i.id || (p.invoiceNo && p.invoiceNo === i.invoiceNo)))
      .map(i => ({
        key: `inv-${i.id}`, id: i.id, clientId: i.clientId || '', receiptNo: i.receiptNo || '', clientName: i.clientName || 'Client',
        clientCompany: i.clientCompany || '', amount: amountOf(i), date: i.paidAt || i.issuedAt || '',
        method: '—', kind: 'Invoice',
        quotationNo: i.quotationNo || findQuote(i.quotationId)?.quotationNo || '',
        invoiceNo: i.invoiceNo || '',
        recordedBy: i.recordedBy || '', source: 'invoice', reference: '', notes: '', createdAt: null,
        invoiceOnly: true, balance: balanceOf(i),
      })),
  ].sort((a, b) => dateOf(b) - dateOf(a));
  const rq = receiptQ.trim().toLowerCase();
  const receiptShown = rq
    ? receiptRows.filter(r => [r.clientName, r.clientCompany, r.receiptNo, r.invoiceNo, r.quotationNo,
        r.method, r.recordedBy, String(r.amount)].join(' ').toLowerCase().includes(rq))
    : receiptRows;

  // ── Receipt download / send ───────────────────────────────────────
  const downloadReceipt = async (r) => {
    if (!r) return;
    setReceiptBusy('download');
    setReceiptMsg('');
    try {
      const cv = await drawReceiptCanvas({
        ...r,
        balance: r.balance ?? balanceOf(r),
        quotationNo: r.quotationNo || findQuote(r.quotationId)?.quotationNo || '',
      });
      const blob = await canvasToBlob(cv);
      if (!blob) throw new Error('Could not render the receipt image.');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = receiptFileName(r);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      setReceiptMsg('Receipt image downloaded — send it on WhatsApp or email.');
    } catch (e) {
      console.error(e);
      setReceiptMsg(e.message || 'Could not create the receipt image. Use Print / Save PDF instead.');
    } finally {
      setReceiptBusy('');
    }
  };

  // Mobile/share-sheet path sends the actual PNG; desktops (and browsers
  // without file sharing) fall back to WhatsApp with the receipt details.
  const shareReceipt = async (r) => {
    if (!r) return;
    setReceiptBusy('share');
    setReceiptMsg('');
    const rBal = r.balance ?? balanceOf(r);
    const text = `Receipt ${r.receiptNo || ''} — ${formatLKR(r.amount)} received from ${r.clientName}${r.clientCompany ? ` (${r.clientCompany})` : ''} on ${fmtDate(r.date) || '—'}.${rBal != null ? ` Balance still to pay: ${formatLKR(rBal)}.` : ''} Thank you — ${company.fullName}.`;
    try {
      const cv = await drawReceiptCanvas({
        ...r, balance: rBal,
        quotationNo: r.quotationNo || findQuote(r.quotationId)?.quotationNo || '',
      });
      const blob = await canvasToBlob(cv);
      const file = blob ? new File([blob], receiptFileName(r), { type: 'image/png' }) : null;
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Receipt ${r.receiptNo || ''}`, text });
        setReceiptMsg('Receipt shared.');
      } else {
        const client = clients.find(c => c.id === r.clientId || (c.name && c.name === r.clientName));
        const phone = String(client?.phone || '').replace(/\D/g, '');
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
        setReceiptMsg(phone
          ? 'WhatsApp opened with the receipt details.'
          : 'WhatsApp opened — pick the client chat and attach the downloaded receipt image.');
      }
    } catch (e) {
      // A cancelled share sheet throws AbortError — that is not an error.
      if (e?.name !== 'AbortError') {
        console.error(e);
        setReceiptMsg('Could not share. Download the image and attach it manually.');
      }
    } finally {
      setReceiptBusy('');
    }
  };

  const nextInvoiceNo = () => {    const year = new Date().getFullYear();
    const nums = invoices
      .map(i => String(i.invoiceNo || '').match(/INV-(\d{4})-(\d+)/))
      .filter(Boolean)
      .filter(m => Number(m[1]) === year)
      .map(m => Number(m[2]));
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return `INV-${year}-${String(next).padStart(3, '0')}`;
  };

  const handleCreate = async () => {
    const client = clients.find(c => c.id === form.clientId) || clientOfQuote(selectedQuote || {});
    if ((!form.clientId && !client) || !form.description.trim() || !form.amount) return;
    const payload = {
      invoiceNo: nextInvoiceNo(),
      clientId: form.clientId || client?.id || '',
      clientName: client?.name || selectedQuote?.clientName || 'Client',
      clientCompany: client?.company || '',
      clientEmail: client?.loginEmail || client?.email || '',
      description: form.description.trim(),
      milestone: form.milestone || '',
      amountValue: Number(form.amount) || 0,
      amount: money(form.amount),
      status: 'pending',
      issuedAt: form.issuedAt || new Date().toISOString().slice(0, 10),
      paidAt: null,
      quotationId: form.quotationId || '',
      quotationNo: selectedQuote?.quotationNo || '',
      paymentDetails: form.paymentDetails || bankLines || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (!live) {
      setInvoices(p => [{ id: `dev-${Date.now()}`, ...payload }, ...p]);
      setShowCreate(false);
      setForm(EMPTY_FORM);
      return;
    }
    setBusy(true);
    try {
      await addDoc(collection(db, 'invoices'), payload);
      setNotice({ kind: 'ok', msg: `${payload.invoiceNo} created — visible in the client's portal Invoices tab.` });
      setShowCreate(false);
      setForm(EMPTY_FORM);
    } catch (e) {
      console.error(e);
      setNotice({ kind: 'error', msg: e.message || 'Could not create the invoice.' });
    } finally {
      setBusy(false);
    }
  };

  // ── Auto receipts ────────────────────────────────────────────────
  //  One payments doc = one saved receipt (unique R-number), always paired
  //  with a PAID invoice in this module so money is never only inside a
  //  quotation. Used by Mark Paid and by verifying a client's payment slip.
  const adminName = currentUser?.displayName || currentUser?.email || 'Admin';

  const createPaidInvoice = async ({
    clientId, clientName, clientCompany, amount, date, description, milestone,
    quotationId, quotationNo, paymentId, receiptNo, kind,
  }) => {
    const invoiceNo = nextInvoiceNo();
    const ref = await addDoc(collection(db, 'invoices'), {
      invoiceNo,
      clientId: clientId || '', clientName: clientName || 'Client', clientCompany: clientCompany || '',
      description: description || 'Payment received',
      milestone: milestone || '',
      amountValue: toInt(amount),
      amount: `LKR ${toInt(amount).toLocaleString('en-US')}`,
      status: 'paid', issuedAt: date, paidAt: date,
      quotationId: quotationId || '', quotationNo: quotationNo || '',
      paymentId: paymentId || '', receiptNo: receiptNo || '', paymentKind: kind || '',
      recordedBy: adminName, source: 'auto-receipt',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    return { id: ref.id, invoiceNo };
  };

  const handleMarkPaid = async inv => {
    if (!inv) return;
    if (live) {
      setBusy(true);
      try {
        const date = todayISO();
        const receiptNo = await nextNumber('receipts', 'R');
        const amt = amountOf(inv);
        // Invoice tied to a quotation → the quotation's paid total and balance
        // move with the money, so the balance never stays stale.
        const q = inv.quotationId ? quotations.find(x => x.id === inv.quotationId) : null;
        const qBalanceBefore = q
          ? ((q.balanceManual && q.balanceOverride != null && q.balanceOverride !== '')
              ? Math.max(0, toInt(q.balanceOverride))
              : Math.max(0, toInt(q.totalAmount) - toInt(q.paidTotal)))
          : null;
        const pay = {
          quotationId: inv.quotationId || '', quotationNo: inv.quotationNo || '',
          clientId: inv.clientId || '', clientName: inv.clientName || 'Client',
          clientCompany: inv.clientCompany || '',
          amount: amt, date, method: 'Invoice payment',
          reference: inv.invoiceNo || '', notes: inv.description || '',
          receiptNo, kind: 'Invoice',
          invoiceId: inv.id, invoiceNo: inv.invoiceNo || '',
          recordedBy: adminName, recordedByEmail: currentUser?.email || '',
          source: 'invoice',
          ...(qBalanceBefore != null ? { balanceBefore: qBalanceBefore, balanceAfter: Math.max(0, qBalanceBefore - amt) } : {}),
          createdAt: serverTimestamp(),
        };
        const payRef = await addDoc(collection(db, 'payments'), pay);
        await syncFinanceIncome({ paymentId: payRef.id, payment: pay, adminName, adminEmail: currentUser?.email || '', live });
        if (q) {
          const patch = { paidTotal: toInt(q.paidTotal) + amt, updatedAt: serverTimestamp() };
          if (q.balanceManual && q.balanceOverride != null && q.balanceOverride !== '') {
            patch.balanceOverride = Math.max(0, toInt(q.balanceOverride) - amt);
          }
          await updateDoc(doc(db, 'quotations', q.id), patch);
        }
        await updateDoc(doc(db, 'invoices', inv.id), {
          status: 'paid',
          paidAt: date,
          receiptNo,
          paymentId: payRef.id,
          recordedBy: adminName,
          updatedAt: serverTimestamp(),
        });
        setReceipt({
          receiptNo, clientName: inv.clientName || 'Client', clientCompany: inv.clientCompany || '',
          amount: amountOf(inv), date, method: 'Invoice payment', kind: 'Invoice',
          quotationNo: inv.quotationNo || '', invoiceNo: inv.invoiceNo || '',
          balance: qBalanceBefore != null ? Math.max(0, qBalanceBefore - amt) : null,
          recordedBy: adminName, createdAt: new Date(),
        });
        setNotice({ kind: 'ok', msg: `${inv.invoiceNo || inv.id} marked paid — receipt ${receiptNo} saved.` });
      } catch (e) {
        console.error(e);
        setNotice({ kind: 'error', msg: e.message || 'Could not update the invoice.' });
      } finally {
        setBusy(false);
      }
    } else {
      const date = todayISO();
      const receiptNo = `R-${Date.now().toString().slice(-6)}`;
      setInvoices(p => p.map(i => i.id === inv.id ? { ...i, status: 'paid', paidAt: date, receiptNo } : i));
      const receiptRow = {
        id: `devpay-${Date.now()}`, receiptNo, clientName: inv.clientName || 'Client',
        clientCompany: inv.clientCompany || '', amount: amountOf(inv), date, method: 'Invoice payment',
        kind: 'Invoice', quotationNo: inv.quotationNo || '', invoiceNo: inv.invoiceNo || '',
        reference: inv.invoiceNo || '', notes: inv.description || '',
        recordedBy: adminName, createdAt: null,
      };
      setPayments(p => [receiptRow, ...p]);
      await syncFinanceIncome({ paymentId: receiptRow.id, payment: receiptRow, adminName, adminEmail: currentUser?.email || '', live });
      setReceipt({ ...receiptRow, createdAt: new Date() });
    }
    setMarkPaidId(null);
  };

  // ── Permanent delete ─────────────────────────────────────────────
  // The invoice doc is always removed. Its receipt (payments doc) is money
  // proof, so it is kept by default — the admin must tick "also delete the
  // receipt" when the invoice was a mistake / test data. Deleting the receipt
  // also rolls the quotation's paid total (and manual balance) back.
  const linkedPaymentsOf = inv =>
    payments.filter(p => (p.invoiceId && p.invoiceId === inv.id) ||
      (p.invoiceNo && p.invoiceNo === inv.invoiceNo));

  const openDeleteInvoice = inv => {
    setDelInv(inv);
    setDelWithReceipt(false);
  };

  const handleDeleteInvoice = async () => {
    const inv = delInv;
    if (!inv) return;
    const linked = linkedPaymentsOf(inv);
    const alsoReceipt = delWithReceipt && linked.length > 0;
    if (!live) {
      setInvoices(p => p.filter(i => i.id !== inv.id));
      if (alsoReceipt) setPayments(p => p.filter(x => !linked.some(l => l.id === x.id)));
      setDelInv(null);
      return;
    }
    setBusy(true);
    try {
      if (alsoReceipt) {
        for (const l of linked) await deleteDoc(doc(db, 'payments', l.id));
        const q = inv.quotationId ? quotations.find(x => x.id === inv.quotationId) : null;
        if (q) {
          const amt = linked.reduce((s, l) => s + toInt(l.amount), 0);
          const patch = { paidTotal: Math.max(0, toInt(q.paidTotal) - amt), updatedAt: serverTimestamp() };
          if (q.balanceManual && q.balanceOverride != null && q.balanceOverride !== '') {
            patch.balanceOverride = toInt(q.balanceOverride) + amt;
          }
          await updateDoc(doc(db, 'quotations', q.id), patch);
        }
      }
      await deleteDoc(doc(db, 'invoices', inv.id));
      setInvoices(p => p.filter(i => i.id !== inv.id));
      if (alsoReceipt) setPayments(p => p.filter(x => !linked.some(l => l.id === x.id)));
      setDelInv(null);
      setNotice({ kind: 'ok', msg: `${inv.invoiceNo || inv.id} deleted${alsoReceipt ? ' with its receipt' : ''}.` });
    } catch (e) {
      console.error(e);
      setNotice({ kind: 'error', msg: e.message || 'Could not delete the invoice.' });
    } finally {
      setBusy(false);
    }
  };

  // ── Delete a saved receipt (payments doc) ───────────────────────
  // Removes the money proof, reopens the invoice it paid (if any) and moves
  // the quotation's paid total / balance back by the same amount.
  const invoicePaidByReceipt = r =>
    invoices.find(i => (i.paymentId && i.paymentId === r.id) ||
      (r.receiptNo && i.receiptNo === r.receiptNo) ||
      (r.invoiceNo && i.invoiceNo === r.invoiceNo)) || null;

  const handleDeleteReceipt = async () => {
    const r = delReceipt;
    if (!r) return;
    const amt = toInt(r.amount);
    const q = findQuote(r.quotationId, r.quotationNo);
    const inv = invoicePaidByReceipt(r);
    if (!live) {
      setPayments(p => p.filter(x => x.id !== r.id));
      if (q) {
        setQuotations(prev => prev.map(x => x.id === q.id ? {
          ...x,
          paidTotal: Math.max(0, toInt(x.paidTotal) - amt),
          ...(x.balanceManual && x.balanceOverride != null && x.balanceOverride !== ''
            ? { balanceOverride: toInt(x.balanceOverride) + amt } : {}),
        } : x));
      }
      if (inv) setInvoices(p => p.map(x => x.id === inv.id ? { ...x, status: 'pending', paidAt: null, receiptNo: '', paymentId: '' } : x));
      setDelReceipt(null);
      return;
    }
    setBusy(true);
    try {
      await deleteDoc(doc(db, 'payments', r.id));
      if (q) {
        const patch = { paidTotal: Math.max(0, toInt(q.paidTotal) - amt), updatedAt: serverTimestamp() };
        if (q.balanceManual && q.balanceOverride != null && q.balanceOverride !== '') {
          patch.balanceOverride = toInt(q.balanceOverride) + amt;
        }
        await updateDoc(doc(db, 'quotations', q.id), patch);
      }
      if (inv) {
        await updateDoc(doc(db, 'invoices', inv.id), {
          status: 'pending', paidAt: null, receiptNo: '', paymentId: '', updatedAt: serverTimestamp(),
        });
      }
      setPayments(p => p.filter(x => x.id !== r.id));
      if (inv) setInvoices(p => p.map(x => x.id === inv.id ? { ...x, status: 'pending', paidAt: null, receiptNo: '', paymentId: '' } : x));
      setDelReceipt(null);
      setNotice({ kind: 'ok', msg: `Receipt ${r.receiptNo || r.id} deleted${inv ? ` — ${inv.invoiceNo} is Pending again` : ''}.` });
    } catch (e) {
      console.error(e);
      setNotice({ kind: 'error', msg: e.message || 'Could not delete the receipt.' });
    } finally {
      setBusy(false);
    }
  };

  const handleProofReview = async (proof, status) => {
    if (!live) {
      setProofs(p => p.map(x => x.id === proof.id ? { ...x, status } : x));
      if (status === 'Verified') {
        const date = todayISO();
        const receiptNo = `R-${Date.now().toString().slice(-6)}`;
        const row = {
          id: `devpay-${Date.now()}`, receiptNo, clientName: proof.clientName || 'Client',
          amount: toInt(proof.amount), date, method: 'Client receipt', kind: 'Advance',
          quotationNo: proof.quotationNo || '', recordedBy: adminName, createdAt: null,
        };
        setPayments(p => [row, ...p]);
        await syncFinanceIncome({ paymentId: row.id, payment: row, adminName, adminEmail: currentUser?.email || '', live });
        setReceipt({ ...row, createdAt: new Date() });
      }
      return;
    }
    setBusy(true);
    try {
      if (status !== 'Verified') {
        await updateDoc(doc(db, 'paymentProofs', proof.id), {
          status,
          reviewedAt: serverTimestamp(),
        });
        setNotice({ kind: 'ok', msg: `${proof.fileName || 'Receipt'} ${status.toLowerCase()} — the client sees this update instantly.` });
        return;
      }

      // Verified → save the receipt automatically: payments doc (R-number)
      // + PAID invoice + quotation balance, all in one action.
      const date = todayISO();
      const amt = toInt(proof.amount);
      let quotation = null;
      if (proof.quotationId) {
        try {
          const snap = await getDoc(doc(db, 'quotations', proof.quotationId));
          if (snap.exists()) quotation = { id: snap.id, ...snap.data() };
        } catch (e) { console.error('quotation read for receipt failed', e); }
      }
      const total = quotation ? toInt(quotation.totalAmount) : 0;
      const paid = quotation ? toInt(quotation.paidTotal) : 0;
      const manual = !!(quotation && quotation.balanceManual && quotation.balanceOverride != null && quotation.balanceOverride !== '');
      const balance = quotation
        ? (manual ? Math.max(0, toInt(quotation.balanceOverride)) : Math.max(0, total - paid))
        : amt;
      const cash = quotation ? (balance > 0 ? Math.min(amt, balance) : amt) : amt;
      const kind = !quotation ? 'Client' : paid <= 0 ? 'Advance' : (paid + cash >= total ? 'Final' : 'Part');
      const nextSt = quotation
        ? (paid + cash >= total || balance - cash <= 0
            ? 'Completed'
            : (quotation.status === 'In Progress' ? 'In Progress' : 'Advance Paid'))
        : '';

      const receiptNo = await nextNumber('receipts', 'R');
      const pay = {
        quotationId: proof.quotationId || '', quotationNo: proof.quotationNo || '',
        clientId: proof.clientId || '', clientName: proof.clientName || 'Client',
        clientCompany: quotation?.clientCompany || '',
        amount: cash, date, method: 'Client receipt', reference: proof.note || '',
        notes: proof.note || '', receiptNo, kind,
        balanceBefore: balance, balanceAfter: Math.max(0, balance - cash),
        recordedBy: `Client receipt — verified by ${adminName}`,
        recordedByEmail: currentUser?.email || '',
        proofId: proof.id, source: 'client-receipt',
        createdAt: serverTimestamp(),
      };
      const payRef = await addDoc(collection(db, 'payments'), pay);

      let invoice = null;
      try {
        invoice = await createPaidInvoice({
          clientId: proof.clientId, clientName: proof.clientName,
          clientCompany: quotation?.clientCompany || '',
          amount: cash, date,
          description: `Client payment received — ${quotation?.projectTitle || proof.quotationNo || 'Quotation'}`,
          milestone: kind === 'Advance' ? 'Advance Payment' : kind === 'Final' ? 'Final Delivery' : 'Development Milestone',
          quotationId: proof.quotationId || '', quotationNo: proof.quotationNo || '',
          paymentId: payRef.id, receiptNo, kind,
        });
        await updateDoc(doc(db, 'payments', payRef.id), {
          invoiceNo: invoice.invoiceNo, invoiceId: invoice.id,
        });
        await syncFinanceIncome({
          paymentId: payRef.id,
          payment: { ...pay, invoiceNo: invoice.invoiceNo, invoiceId: invoice.id },
          adminName,
          adminEmail: currentUser?.email || '',
          live,
        });
      } catch (e) {
        console.error('client receipt → invoice failed', e);
      }

      await updateDoc(doc(db, 'paymentProofs', proof.id), {
        status: 'Verified',
        reviewedAt: serverTimestamp(),
        receiptNo,
        paymentId: payRef.id,
        invoiceNo: invoice?.invoiceNo || '',
        invoiceId: invoice?.id || '',
      });

      if (quotation) {
        const prevLog = Array.isArray(quotation.moneyLog) ? quotation.moneyLog : [];
        const patch = {
          paidTotal: paid + cash,
          paymentsCount: toInt(quotation.paymentsCount) + 1,
          status: nextSt,
          moneyLog: [...prevLog, {
            at: new Date().toISOString(), by: adminName, kind: 'payment',
            text: `${KIND_LABEL[kind] || kind} of ${formatLKR(cash)} verified from the client receipt — ${receiptNo}`
              + (invoice ? ` · invoice ${invoice.invoiceNo}` : '')
              + ` · balance ${formatLKR(balance)} → ${formatLKR(Math.max(0, balance - cash))}`,
          }],
          updatedAt: serverTimestamp(),
        };
        if (manual) patch.balanceOverride = Math.max(0, balance - cash);
        await updateDoc(doc(db, 'quotations', quotation.id), patch);
      }

      setReceipt({ ...pay, id: payRef.id, invoiceNo: invoice?.invoiceNo || '', createdAt: new Date() });
      setNotice({
        kind: 'ok',
        msg: `Client payment verified — receipt ${receiptNo} saved${invoice ? ` · invoice ${invoice.invoiceNo}` : ''}. It is searchable in Saved Receipts.`,
      });
    } catch (e) {
      console.error(e);
      setNotice({ kind: 'error', msg: e.message || 'Could not save the receipt for this payment.' });
    } finally {
      setBusy(false);
    }
  };

  const pendingInvoice = invoices.find(i => i.id === markPaidId);
  // Balance + quotation shown on the open receipt.
  const receiptBalance = receipt ? (receipt.balance ?? balanceOf(receipt)) : null;
  const receiptQuoteNo = receipt ? (receipt.quotationNo || findQuote(receipt.quotationId)?.quotationNo || '') : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .inv-receipt-print, .inv-receipt-print * { visibility: visible !important; }
          .inv-receipt-print { position: fixed; left: 0; top: 0; width: 100%; background: #fff; }
        }
      `}</style>

      {notice && (
        <div style={{
          padding: '10px 14px', borderRadius: 11, fontSize: 12, fontWeight: 600,
          background: notice.kind === 'ok' ? 'rgba(24,199,122,0.12)' : 'rgba(240,90,103,0.12)',
          border: `1px solid ${notice.kind === 'ok' ? 'rgba(24,199,122,0.35)' : 'rgba(240,90,103,0.35)'}`,
          color: notice.kind === 'ok' ? C.green : C.red,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {notice.msg}
          <button onClick={() => setNotice(null)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 14 }}>×</button>
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(155px,1fr))', gap: 12 }}>
        {[
          { label: 'Total Paid', val: money(totalPaid), color: C.green, icon: '✅' },
          { label: 'Total Pending', val: money(totalPending), color: C.amber, icon: '⏳' },
          { label: 'Advance Paid', val: money(totalAdvance), color: C.cyan, icon: '💸',
            sub: advanceCount ? `${advanceCount} advance payment${advanceCount === 1 ? '' : 's'}` : '' },
          { label: 'Balance to Collect', val: money(quoteBalanceTotal), color: C.amber, icon: '🧮',
            sub: quotations.length ? `across ${quotations.length} quotation${quotations.length === 1 ? '' : 's'}` : '' },
          { label: 'Total Invoices', val: invoices.length, color: C.cyan, icon: '🧾' },
          { label: 'Client Receipts', val: `${proofs.length}${newProofs ? ` · ${newProofs} new` : ''}`, color: C.violet, icon: '📎' },
        ].map(s => (
          <div key={s.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 18px', backdropFilter: 'blur(12px)' }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{s.label}</div>
            {s.sub && <div style={{ fontSize: 9.5, color: C.muted, marginTop: 2 }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Filter + Create */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {['All', 'pending', 'paid'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '7px 16px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            background: filter === f ? 'linear-gradient(135deg,#0066FF,#1787FF)' : 'rgba(10,24,56,0.8)',
            color: filter === f ? '#fff' : C.muted, border: filter === f ? 'none' : `1px solid ${C.border}`,
            boxShadow: filter === f ? '0 4px 14px rgba(0,102,255,0.35)' : 'none', transition: 'all 0.15s',
          }}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>
        ))}
        <ERPBtn variant="primary" onClick={() => setShowCreate(true)} style={{ marginLeft: 'auto' }}>
          <Plus size={13} /> Create Invoice
        </ERPBtn>
      </div>

      {/* Invoice table */}
      <ERPPanel>
        <ERPPanelHeader title={`${filter === 'All' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)} Invoices`} icon="🧾" />
        {filtered.length === 0 ? (
          <ERPEmpty icon="🧾" title="No invoices" sub="Create your first invoice above." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Invoice #', 'Client', 'Description', 'Milestone', 'Amount', 'Issued', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: C.muted, textAlign: 'left', background: 'rgba(10,24,56,0.5)', borderBottom: `1px solid ${C.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv, i) => (
                  <tr key={inv.id}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,102,255,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    style={{ transition: 'background 0.1s' }}>
                    <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.cyan, fontFamily: 'monospace' }}>{inv.invoiceNo || inv.id}</span>
                    </td>
                    <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ERPAvatar name={inv.clientName} color={COLORS[i % COLORS.length]} size={24} />
                        <div>
                          <div style={{ fontSize: 12, color: C.subtle, fontWeight: 600 }}>{inv.clientName}</div>
                          {inv.clientCompany && <div style={{ fontSize: 10, color: C.muted }}>{inv.clientCompany}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20`, maxWidth: 200 }}>
                      <span style={{ fontSize: 11, color: C.subtle, overflow: 'hidden', display: 'block', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{inv.description}</span>
                      {inv.quotationNo && (
                        <div style={{ fontSize: 9.5, color: C.muted, marginTop: 2 }}>
                          from {inv.quotationNo}{inv.receiptNo ? ` · ${inv.receiptNo}` : ''}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }}>
                      <span style={{ fontSize: 10, color: C.muted }}>{inv.milestone || '—'}</span>
                    </td>
                    <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{inv.amount || money(amountOf(inv))}</span>
                    </td>
                    <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }}>
                      <span style={{ fontSize: 11, color: C.muted }}>{prettyDate(inv.issuedAt)}</span>
                      {inv.paidAt && <div style={{ fontSize: 10, color: C.green }}>Paid: {prettyDate(inv.paidAt)}</div>}
                    </td>
                    <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }}>
                      <ERPBadge status={inv.status === 'paid' ? 'Paid' : 'Pending'} />
                      {(() => {
                        const bal = balanceForClient(inv.clientId, inv.clientName);
                        if (bal == null) return null;
                        return (
                          <div style={{ fontSize: 9.5, fontWeight: 700, marginTop: 4, whiteSpace: 'nowrap',
                            color: bal > 0 ? C.amber : C.green }}>
                            Balance {money(bal)}
                          </div>
                        );
                      })()}
                    </td>
                    <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {inv.status === 'pending' && (
                          <ERPBtn size="sm" variant="success" onClick={() => setMarkPaidId(inv.id)}>
                            <CheckCircle2 size={11} /> Mark Paid
                          </ERPBtn>
                        )}
                        <ERPBtn size="sm" variant="danger" onClick={() => openDeleteInvoice(inv)} title="Delete invoice permanently">
                          <Trash2 size={11} />
                        </ERPBtn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ERPPanel>

      {/* ── Saved Receipts — auto-created for every payment ── */}
      <ERPPanel>
        <ERPPanelHeader
          title="Saved Receipts"
          icon={<ReceiptText size={15} style={{ color: C.green }} />}
          action={<span style={{ fontSize: 10, color: C.muted }}>{receiptRows.length} receipt{receiptRows.length === 1 ? '' : 's'}</span>}
        />
        <div style={{ padding: '12px 16px 4px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7, flex: '1 1 260px',
            background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`, borderRadius: 9, padding: '8px 11px',
          }}>
            <Search size={13} style={{ color: C.muted, flexShrink: 0 }} />
            <input
              value={receiptQ}
              onChange={e => setReceiptQ(e.target.value)}
              placeholder="Search by client name, receipt no, quotation no or invoice no…"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: C.text, fontSize: 11.5, minWidth: 0 }}
            />
            {receiptQ && (
              <button onClick={() => setReceiptQ('')} style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 13, padding: 0 }}>×</button>
            )}
          </div>
          <span style={{ fontSize: 10, color: C.muted }}>
            Auto-saved from quotation payments, paid invoices and verified client receipts — who paid, when, and for which quotation/invoice.
          </span>
        </div>

        {receiptShown.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12, color: C.muted }}>
            {receiptQ
              ? `No receipt matches “${receiptQ}”.`
              : 'No receipts yet. Record a quotation payment, mark an invoice paid, or verify a client receipt — the receipt is saved here automatically.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Receipt #', 'Paid by', 'Amount', 'Type', 'Date', 'Links', 'Recorded by', ''].map(h => (
                    <th key={h} style={{ padding: '9px 14px', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7, color: C.muted, textAlign: 'left', background: 'rgba(10,24,56,0.5)', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {receiptShown.map(r => (
                  <tr key={r.key}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(24,199,122,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    style={{ transition: 'background 0.1s' }}>
                    <td style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}20`, whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: C.green, fontFamily: 'monospace' }}>
                        {r.receiptNo || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}20` }}>
                      <div style={{ fontSize: 11.5, color: C.subtle, fontWeight: 700 }}>{r.clientName}</div>
                      {r.clientCompany && <div style={{ fontSize: 9.5, color: C.muted }}>{r.clientCompany}</div>}
                    </td>
                    <td style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}20`, whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: C.text }}>{money(r.amount)}</span>
                      {r.balance != null && (
                        <div style={{ fontSize: 9.5, color: C.cyan, marginTop: 2 }}>
                          Balance {money(r.balance)}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}20`, whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 10, color: C.muted }}>{KIND_LABEL[r.kind] || r.kind || '—'}</span>
                    </td>
                    <td style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}20`, whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 10.5, color: C.muted }}>{prettyDate(r.date)}</span>
                    </td>
                    <td style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}20`, whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {r.quotationNo && <span style={{ fontSize: 9.5, color: C.cyan }}>{r.quotationNo}</span>}
                        {r.invoiceNo && <span style={{ fontSize: 9.5, color: C.violet }}>{r.invoiceNo}</span>}
                        {!r.quotationNo && !r.invoiceNo && <span style={{ fontSize: 9.5, color: C.muted }}>—</span>}
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}20` }}>
                      <span style={{ fontSize: 10, color: C.muted }}>{r.recordedBy || '—'}</span>
                    </td>
                    <td style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}20`, whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ERPBtn size="sm" variant="secondary" onClick={() => setReceipt(r)}>
                          <ReceiptText size={11} /> View
                        </ERPBtn>
                        {!r.invoiceOnly && (
                          <ERPBtn size="sm" variant="danger" onClick={() => setDelReceipt(r)} title="Delete this saved receipt permanently">
                            <Trash2 size={11} />
                          </ERPBtn>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ERPPanel>

      {/* Client-sent bank receipts / payment bills — stored in Firestore + Storage */}
      <ERPPanel>
        <ERPPanelHeader
          title="Client Payment Receipts"
          icon={<ReceiptText size={15} style={{ color: C.violet }} />}
          action={newProofs > 0 ? (
            <span style={{
              fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
              background: 'rgba(245,185,66,0.14)', color: C.amber, border: '1px solid rgba(245,185,66,0.35)',
            }}>{newProofs} awaiting review</span>
          ) : null}
        />
        {proofs.length === 0 ? (
          <div style={{ padding: '26px 16px', textAlign: 'center', fontSize: 12, color: C.muted }}>
            No client receipts yet. When a client uploads a bank slip or payment bill from their portal, it is saved here automatically.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {proofs.map(p => {
              const tone = p.status === 'Verified'
                ? { bg: 'rgba(24,199,122,0.10)', border: 'rgba(24,199,122,0.35)', fg: C.green }
                : p.status === 'Rejected'
                ? { bg: 'rgba(240,90,103,0.10)', border: 'rgba(240,90,103,0.35)', fg: C.red }
                : { bg: 'rgba(245,185,66,0.10)', border: 'rgba(245,185,66,0.35)', fg: C.amber };
              return (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                  borderTop: `1px solid ${C.border}20`, flexWrap: 'wrap',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <ReceiptText size={16} style={{ color: C.violet }} />
                  </div>
                  <div style={{ flex: '1 1 220px', minWidth: 180 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.subtle }}>
                      {p.clientName || 'Client'} · {money(p.amount)}
                    </div>
                    <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>
                      {p.quotationNo ? `${p.quotationNo} · ` : ''}{p.fileName || 'receipt'} · {prettyDate(p.createdAt)}
                      {p.receiptNo ? ` · saved as ${p.receiptNo}` : ''}
                    </div>
                    {p.note && <div style={{ fontSize: 10.5, color: C.subtle, marginTop: 3, fontStyle: 'italic' }}>“{p.note}”</div>}
                  </div>
                  <span style={{
                    fontSize: 9.5, fontWeight: 800, padding: '3px 9px', borderRadius: 20,
                    background: tone.bg, color: tone.fg, border: `1px solid ${tone.border}`,
                  }}>{p.status || 'New'}</span>
                  {(p.filePath || p.fileUrl) && (
                    <PrivateFileLink file={{ name: p.fileName, path: p.filePath, url: p.fileUrl }} label="View"
                      style={{
                        padding: '6px 11px', borderRadius: 8, fontSize: 10.5, fontWeight: 700,
                        background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`, color: C.text,
                      }}/>
                  )}
                  {p.status !== 'Verified' && (
                    <ERPBtn size="sm" variant="success" disabled={busy} onClick={() => handleProofReview(p, 'Verified')}
                      title="Verify the payment and save its receipt + paid invoice automatically">
                      <CheckCircle2 size={11} /> Verify & Save Receipt
                    </ERPBtn>
                  )}
                  {p.status !== 'Rejected' && (
                    <ERPBtn size="sm" variant="danger" disabled={busy} onClick={() => handleProofReview(p, 'Rejected')}>
                      <XCircle size={11} /> Reject
                    </ERPBtn>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ERPPanel>

      {/* Create Modal */}
      <ERPModal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Invoice" width={560}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <ERPSelect label="Quotation (optional)" value={form.quotationId}
            onChange={e => pickQuote(e.target.value)}
            placeholder="No quotation — standalone invoice"
            options={quoteOptions} />

          {selectedQuote && (
            <div style={{
              padding: '11px 13px', borderRadius: 10, background: 'rgba(0,102,255,0.08)',
              border: '1px solid rgba(0,102,255,0.3)', display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: C.cyan, fontFamily: 'monospace' }}>
                  {selectedQuote.quotationNo || 'Quotation'}
                </span>
                <span style={{ fontSize: 11, color: C.subtle, fontWeight: 700 }}>
                  {clientOfQuote(selectedQuote)?.name || selectedQuote.clientName || 'Client'}
                </span>
                {clientOfQuote(selectedQuote)?.company && (
                  <span style={{ fontSize: 10, color: C.muted }}>{clientOfQuote(selectedQuote).company}</span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(105px,1fr))', gap: 8 }}>
                {[
                  ['Quotation total', money(quoteTotal), C.text],
                  ['Already paid', money(quotePaid), quotePaid > 0 ? C.green : C.muted],
                  ['This invoice', money(formAmount), C.text],
                  ['Balance after', money(quoteAfter), quoteAfter > 0 ? C.amber : C.green],
                ].map(([label, value, color]) => (
                  <div key={label}>
                    <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <ERPSelect label="Client" value={form.clientId} onChange={e => setForm(p => ({ ...p, clientId: e.target.value, quotationId: '' }))}
            placeholder="Select client..." required
            options={clients.map(c => ({ value: c.id, label: `${c.name}${c.company ? ` — ${c.company}` : ''}` }))} />
          <ERPInput label="Description" value={form.description} required
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="e.g. UI/UX Design Milestone — Corporate Website" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <ERPSelect label="Milestone" value={form.milestone} onChange={e => setForm(p => ({ ...p, milestone: e.target.value }))}
              placeholder="Select milestone..." options={MILESTONES} />
            <ERPInput label="Amount (LKR)" value={form.amount} type="number"
              onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} required placeholder="e.g. 25000" />
          </div>
          <ERPInput label="Issue Date" value={form.issuedAt} type="date"
            onChange={e => setForm(p => ({ ...p, issuedAt: e.target.value }))} />

          {/* Payment details — starts from Settings → Bank details, editable here */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <button type="button" onClick={() => setShowBank(v => !v)}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 11, fontWeight: 700, color: C.cyan }}>
              {showBank ? '− Hide payment details' : '+ Payment details (bank)'}
            </button>
            {bankLines && (
              <button type="button"
                onClick={() => setForm(p => ({ ...p, paymentDetails: bankLines }))}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 10.5, color: C.muted }}>
                Use saved bank details
              </button>
            )}
          </div>
          {(showBank || form.paymentDetails) && (
            <ERPTextarea label="Payment details on this invoice" rows={5}
              value={form.paymentDetails}
              onChange={e => setForm(p => ({ ...p, paymentDetails: e.target.value }))}
              placeholder={'Account Name: SMART Pvt Ltd\nBank: Commercial Bank\nAccount No: 1234567890'} />
          )}
          {!bankLines && !form.paymentDetails && (
            <div style={{ fontSize: 10.5, color: C.amber, lineHeight: 1.5 }}>
              No bank details in Settings yet — add them in Settings → Bank details, or type them above.
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <ERPBtn variant="secondary" onClick={() => setShowCreate(false)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</ERPBtn>
            <ERPBtn variant="primary" onClick={handleCreate}
              disabled={busy || (!form.clientId && !selectedQuote) || !form.description.trim() || !form.amount}
              style={{ flex: 1, justifyContent: 'center' }}>
              <FileText size={13} /> Create Invoice
            </ERPBtn>
          </div>
        </div>
      </ERPModal>

      {/* Delete a saved receipt permanently */}
      <ERPModal isOpen={!!delReceipt} onClose={() => setDelReceipt(null)} title="Delete Receipt" width={460}>
        {delReceipt && (() => {
          const inv = invoicePaidByReceipt(delReceipt);
          const q = findQuote(delReceipt.quotationId, delReceipt.quotationNo);
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
                Delete receipt <b style={{ color: C.text }}>{delReceipt.receiptNo || delReceipt.id}</b> —{' '}
                <b style={{ color: C.text }}>{money(delReceipt.amount)}</b> from{' '}
                <b style={{ color: C.text }}>{delReceipt.clientName}</b>? This cannot be undone.
              </div>
              <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(245,185,66,0.1)',
                border: '1px solid rgba(245,185,66,0.35)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <AlertTriangle size={14} style={{ color: C.amber, flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 11, color: C.amber, lineHeight: 1.55 }}>
                  This is proof of money received. Deleting it removes the receipt
                  {inv ? `, puts ${inv.invoiceNo} back to Pending` : ''}
                  {q ? ` and raises ${q.quotationNo || 'the quotation'} balance by ${money(delReceipt.amount)}` : ''}.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <ERPBtn variant="secondary" onClick={() => setDelReceipt(null)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</ERPBtn>
                <ERPBtn variant="danger" onClick={handleDeleteReceipt} disabled={busy} style={{ flex: 1, justifyContent: 'center' }}>
                  <Trash2 size={13} /> Delete forever
                </ERPBtn>
              </div>
            </div>
          );
        })()}
      </ERPModal>

      {/* Delete invoice permanently */}
      <ERPModal isOpen={!!delInv} onClose={() => setDelInv(null)} title="Delete Invoice" width={460}>
        {delInv && (() => {
          const linked = linkedPaymentsOf(delInv);
          const paid = delInv.status === 'paid' || linked.length > 0;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
                Delete <b style={{ color: C.text }}>{delInv.invoiceNo || delInv.id}</b> for{' '}
                <b style={{ color: C.text }}>{delInv.clientName}</b> ({delInv.amount || money(amountOf(delInv))})?
                This cannot be undone.
              </div>
              {paid && (
                <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(245,185,66,0.1)',
                  border: '1px solid rgba(245,185,66,0.35)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <AlertTriangle size={14} style={{ color: C.amber, flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: 11, color: C.amber, lineHeight: 1.55 }}>
                    {linked.length > 0
                      ? <>This invoice has a saved receipt {linked.map(l => l.receiptNo).filter(Boolean).join(', ')}. The receipt stays in Saved Receipts unless you tick the box below.</>
                      : 'This invoice is marked paid. Its payment record is separate and is kept.'}
                  </div>
                </div>
              )}
              {linked.length > 0 && (
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 11.5, color: C.subtle, cursor: 'pointer', lineHeight: 1.5 }}>
                  <input type="checkbox" checked={delWithReceipt}
                    onChange={e => setDelWithReceipt(e.target.checked)}
                    style={{ marginTop: 2, accentColor: C.red }} />
                  Also delete receipt {linked.map(l => l.receiptNo).filter(Boolean).join(', ')} — the quotation's
                  paid total / balance goes back by {money(linked.reduce((s, l) => s + toInt(l.amount), 0))}.
                  Use only for a mistake or test data.
                </label>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <ERPBtn variant="secondary" onClick={() => setDelInv(null)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</ERPBtn>
                <ERPBtn variant="danger" onClick={handleDeleteInvoice} disabled={busy} style={{ flex: 1, justifyContent: 'center' }}>
                  <Trash2 size={13} /> Delete forever
                </ERPBtn>
              </div>
            </div>
          );
        })()}
      </ERPModal>

      {/* Confirm mark paid */}
      <ERPModal isOpen={!!markPaidId} onClose={() => setMarkPaidId(null)} title="Confirm Payment" width={380}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', textAlign: 'center' }}>
          <div style={{ fontSize: 36 }}>💰</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Mark {pendingInvoice?.invoiceNo || 'invoice'} as Paid?</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>This will mark the invoice Paid and save a numbered receipt automatically in Saved Receipts.</div>
          </div>
          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
            <ERPBtn variant="secondary" onClick={() => setMarkPaidId(null)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</ERPBtn>
            <ERPBtn variant="success" disabled={busy} onClick={() => handleMarkPaid(pendingInvoice)} style={{ flex: 1, justifyContent: 'center' }}>
              <CheckCircle2 size={13} /> Confirm Paid
            </ERPBtn>
          </div>
        </div>
      </ERPModal>

      {/* ── Printable receipt — the saved copy of any payment ── */}
      <ERPModal isOpen={!!receipt} onClose={() => setReceipt(null)} title={`Receipt ${receipt?.receiptNo || ''}`} width={560}>
        {receipt && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="inv-receipt-print" style={{
              background: '#ffffff', color: '#111827', borderRadius: 14, padding: '26px 28px',
              fontFamily: 'Georgia, "Times New Roman", serif',
              border: '1px solid #dbeafe', boxShadow: '0 12px 32px rgba(10,91,214,0.12)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <img src={company.logos.lightMode || company.logos.darkMode} alt={company.fullName}
                    style={{ height: 44, width: 'auto', objectFit: 'contain' }}
                    onError={e => { e.currentTarget.style.display = 'none'; }} />
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#0b1f3a' }}>{company.fullName}</div>
                    <div style={{ fontSize: 9, color: '#4b5563', maxWidth: 230, lineHeight: 1.5 }}>
                      {company.contact.address}<br />
                      {company.contact.phone} · {company.contact.email}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#0b1f3a', letterSpacing: 1 }}>PAYMENT RECEIPT</div>
                  <div style={{ fontSize: 11, color: '#374151', marginTop: 2 }}>{receipt.receiptNo || receipt.invoiceNo || '—'}</div>
                </div>
              </div>

              <div style={{ height: 2, background: 'linear-gradient(90deg,#0b1f3a,#0066FF)', margin: '14px 0', borderRadius: 2 }} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '8px 18px', fontSize: 11 }}>
                <div><span style={{ color: '#6b7280' }}>Received from:</span></div>
                <div style={{ fontWeight: 700 }}>
                  {receipt.clientName}{receipt.clientCompany ? `, ${receipt.clientCompany}` : ''}
                </div>
                <div><span style={{ color: '#6b7280' }}>Quotation No:</span></div>
                <div style={{ fontWeight: 800, color: '#0b5bd6' }}>{receiptQuoteNo || '—'}</div>
                <div><span style={{ color: '#6b7280' }}>Invoice No:</span></div>
                <div style={{ fontWeight: 700 }}>{receipt.invoiceNo || '—'}</div>
                <div><span style={{ color: '#6b7280' }}>Payment date:</span></div>
                <div style={{ fontWeight: 700 }}>{fmtDate(receipt.date) || '—'}</div>
                <div><span style={{ color: '#6b7280' }}>Payment method:</span></div>
                <div style={{ fontWeight: 700 }}>{receipt.method || '—'}</div>
                <div><span style={{ color: '#6b7280' }}>Payment type:</span></div>
                <div style={{ fontWeight: 700 }}>{KIND_LABEL[receipt.kind] || receipt.kind || 'Payment'}</div>
                {receipt.recordedBy && (
                  <>
                    <div><span style={{ color: '#6b7280' }}>Recorded by:</span></div>
                    <div style={{ fontWeight: 700 }}>{receipt.recordedBy}</div>
                  </>
                )}
                {receipt.reference && (
                  <>
                    <div><span style={{ color: '#6b7280' }}>Reference:</span></div>
                    <div style={{ fontWeight: 700 }}>{receipt.reference}</div>
                  </>
                )}
                {receipt.notes && (
                  <>
                    <div><span style={{ color: '#6b7280' }}>Notes:</span></div>
                    <div>{receipt.notes}</div>
                  </>
                )}
              </div>

              <div style={{
                marginTop: 16, padding: '12px 16px', borderRadius: 10,
                background: 'linear-gradient(100deg,#eff6ff,#dbeafe)', border: '1px solid #93c5fd',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
              }}>
                <span style={{ fontSize: 11, color: '#1d4ed8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Amount Received
                </span>
                <span style={{ fontSize: 20, fontWeight: 900, color: '#0b2e6b' }}>{formatLKR(receipt.amount)}</span>
              </div>

              {receiptBalance != null && (
                <div style={{
                  marginTop: 10, padding: '11px 16px', borderRadius: 10,
                  background: 'linear-gradient(100deg,#0b2e6b,#0a5bd6)', color: '#fff',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
                }}>
                  <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1, color: '#cfe3ff', textTransform: 'uppercase' }}>
                    Balance still to pay
                  </span>
                  <span style={{ fontSize: 18, fontWeight: 900 }}>{formatLKR(receiptBalance)}</span>
                </div>
              )}

              <div style={{ marginTop: 16, paddingTop: 10, borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#6b7280', flexWrap: 'wrap', gap: 6 }}>
                <span>Thank you for your business — {company.fullName}</span>
                <span>Saved in Invoice Centre</span>
              </div>
            </div>

            <div style={{
              display: 'flex', gap: 8, flexWrap: 'wrap', padding: 10, borderRadius: 12,
              background: 'linear-gradient(100deg, rgba(0,102,255,0.14), rgba(32,184,232,0.08))',
              border: '1px solid rgba(0,102,255,0.35)',
            }}>
              <ERPBtn variant="secondary" onClick={() => { setReceipt(null); setReceiptMsg(''); }} style={{ flex: '1 1 100px', justifyContent: 'center' }}>Close</ERPBtn>
              <ERPBtn variant="primary" onClick={() => downloadReceipt(receipt)} disabled={receiptBusy === 'download'} style={{ flex: '1 1 140px', justifyContent: 'center' }}>
                <Download size={13} /> {receiptBusy === 'download' ? 'Preparing…' : 'Download PNG'}
              </ERPBtn>
              <ERPBtn variant="secondary" onClick={() => shareReceipt(receipt)} disabled={receiptBusy === 'share'} style={{ flex: '1 1 130px', justifyContent: 'center' }}>
                <Share2 size={13} /> {receiptBusy === 'share' ? 'Opening…' : 'Send to client'}
              </ERPBtn>
              <ERPBtn variant="secondary" onClick={() => window.print()} style={{ flex: '1 1 120px', justifyContent: 'center' }}>
                <Printer size={13} /> Print / PDF
              </ERPBtn>
            </div>
            {receiptMsg && (
              <div style={{ fontSize: 11, color: C.subtle, textAlign: 'center', lineHeight: 1.5 }}>{receiptMsg}</div>
            )}
          </div>
        )}
      </ERPModal>

    </div>
  );
}
