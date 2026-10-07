import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, getDocs, serverTimestamp, runTransaction,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { company } from '../../config/company';
import { QUOTATION_TEMPLATE_SEEDS, seedId } from '../data/seedTemplates';
import { toInt, formatLKR, fmtDate, todayISO } from '../money';
import {
  ERPPanel, ERPPanelHeader, ERPBadge, ERPBtn,
  ERPModal, ERPInput, ERPSelect, ERPTextarea,
  ERPEmpty, ERPAvatar, C
} from '../components/ERPui';
import {
  Plus, Send, Trash2, Edit2, CheckCircle2, Eye, Copy, Info,
  Printer, CreditCard, Play, AlertTriangle, Receipt as ReceiptIcon, XCircle,
  MessageSquare
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────
const buid = () => `b${Date.now()}_${Math.random().toString(36).slice(2,5)}`;

const toMs = (t) => {
  if (!t) return 0;
  if (typeof t === 'object') {
    if (t.seconds) return t.seconds * 1000;
    if (typeof t.toDate === 'function') return t.toDate().getTime();
  }
  const p = Date.parse(t);
  return Number.isNaN(p) ? 0 : p;
};
const fmtAny = (t) => {
  const ms = toMs(t);
  return ms ? new Date(ms).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : '—';
};

// Auto-incrementing document numbers via counters/{name} transaction.
// Returns e.g. Q-2026-0001. Falls back to a timestamp number so a save
// is never blocked by a counter failure.
async function nextNumber(counterName, prefix) {
  const year = new Date().getFullYear();
  try {
    const counterRef = doc(db, 'counters', counterName);
    const val = await runTransaction(db, async (tx) => {
      const snap = await tx.get(counterRef);
      const next = (snap.exists() ? toInt(snap.data().value) : 0) + 1;
      tx.set(counterRef, { value: next, updatedAt: serverTimestamp() });
      return next;
    });
    return `${prefix}-${year}-${String(val).padStart(4, '0')}`;
  } catch (e) {
    console.error('counter transaction failed', e);
    return `${prefix}-${Date.now()}`;
  }
}

const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Cheque', 'Card', 'Online'];
const FILTERS = ['All', 'Draft', 'Sent', 'Accepted', 'Advance Paid', 'In Progress', 'Completed'];
// Longer display wording for lifecycle statuses (per spec)
const STATUS_LABEL = { 'In Progress': 'In Progress / Balance Due', 'Completed': 'Fully Paid / Completed' };

const balanceOf = (q) => Math.max(0, toInt(q.totalAmount) - toInt(q.paidTotal));

// Quotation status → linked project status. Keeps the client's project
// (created when the lead was accepted) in step with the quotation pipeline.
const PROJECT_STATUS_FOR = {
  'Sent':         'quotation_sent',
  'Accepted':     'quotation_accepted',
  'Advance Paid': 'advance_paid',
  'In Progress':  'In Progress',
  'Completed':    'Completed',
};

// WhatsApp click-to-chat deep link (no backend API — opens a chat window)
const waLink = (phone, text) =>
  `https://wa.me/${String(phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;

// ── Dev-mode sample data (ONLY when Firebase is not configured / dev session) ──
const DEV_CLIENTS = [
  { id:'C001', name:'John Perera',    company:'Perera Holdings' },
  { id:'C002', name:'Sarah Fernando', company:'Mehala Restaurant' },
  { id:'C003', name:'Kumar Arasan',   company:'KA Retail' },
  { id:'C004', name:'Priya Nair',     company:'PN Accounting' },
  { id:'C005', name:'Dilan Perera',   company:'DP Constructions' },
];
const DEV_QUOTES = [
  {
    id:'QT001', quotationNo:'Q-2026-0001', clientId:'C001', clientName:'John Perera', clientCompany:'Perera Holdings',
    service:'Website Development', projectTitle:'Corporate Website Redesign',
    description:'Complete redesign of the corporate website with modern UI and SEO.',
    scope:'UI/UX design\nDevelopment\nSEO & deployment',
    items:[
      {id:'b1',label:'Design & UI/UX',   amount:25000},
      {id:'b2',label:'Development',      amount:45000},
      {id:'b3',label:'SEO & Deployment', amount:15000},
    ],
    totalAmount:85000, advancePct:35, advanceAmount:30000,
    paidTotal:30000, paymentsCount:1, status:'Advance Paid',
    validUntil:'2026-11-15',
    notes:'Includes 3 months free support after launch.',
    terms:'50% advance, 50% on delivery.',
    paymentTerms:'50% advance, 50% on delivery.',
    createdAt:'Oct 1, 2026',
  },
  {
    id:'QT002', quotationNo:'Q-2026-0002', clientId:'C002', clientName:'Sarah Fernando', clientCompany:'Mehala Restaurant',
    service:'ERP & POS System', projectTitle:'Restaurant POS System',
    description:'POS with table management, inventory and reporting.',
    scope:'POS module\nTable management\nInventory & reports\nTraining',
    items:[
      {id:'b1',label:'POS Module',          amount:50000},
      {id:'b2',label:'Table Management',    amount:30000},
      {id:'b3',label:'Inventory & Reports', amount:25000},
      {id:'b4',label:'Training & Setup',    amount:15000},
    ],
    totalAmount:120000, advancePct:42, advanceAmount:50000,
    paidTotal:0, paymentsCount:0, status:'Sent',
    validUntil:'2026-11-30',
    notes:'Includes 6 months warranty support.',
    terms:'Milestone-based billing.',
    paymentTerms:'Milestone-based billing.',
    createdAt:'Oct 3, 2026',
  },
  {
    id:'QT003', quotationNo:'Q-2026-0003', clientId:'C003', clientName:'Kumar Arasan', clientCompany:'KA Retail',
    service:'Mobile App Development', projectTitle:'Mobile App Development',
    description:'Android & iOS app with testing and deployment.',
    scope:'Architecture & design\nDevelopment\nTesting & deployment',
    items:[
      {id:'b1',label:'Architecture & Design',    amount:40000},
      {id:'b2',label:'Android & iOS Development',amount:90000},
      {id:'b3',label:'Testing & Deployment',     amount:20000},
    ],
    totalAmount:150000, advancePct:33, advanceAmount:50000,
    paidTotal:0, paymentsCount:0, status:'Draft',
    validUntil:'2026-12-15',
    notes:'', terms:'', paymentTerms:'',
    createdAt:'Oct 5, 2026',
  },
];
const DEV_PAYMENTS = [
  { id:'pay1', quotationId:'QT001', quotationNo:'Q-2026-0001',
    clientId:'C001', clientName:'John Perera', clientCompany:'Perera Holdings',
    amount:30000, date:'2026-10-02', method:'Bank Transfer', reference:'FT-88213',
    notes:'Advance payment (35%)', receiptNo:'R-2026-0001', createdAt:'Oct 2, 2026' },
];

const EMPTY_FORM = {
  clientId:'', projectTitle:'', service:'', templateId:'',
  description:'', scope:'',
  items:[{ id:buid(), label:'', amount:'' }],
  customFields:[],
  advancePct:30, validUntil:'', terms:'', paymentTerms:'', notes:'',
};
const EMPTY_PAY = { amount:'', date:'', method:'Bank Transfer', reference:'', notes:'' };

export default function ERPQuotations() {
  const { isDevSession } = useAuth();
  const live = isFirebaseConfigured && !isDevSession;
  const navigate = useNavigate();

  const [quotes,     setQuotes]     = useState([]);
  const [clients,    setClients]    = useState([]);
  const [templates,  setTemplates]  = useState(live ? [] : QUOTATION_TEMPLATE_SEEDS.map(t => ({ id: seedId(t.serviceCode), ...t })));
  const [payments,   setPayments]   = useState([]);
  const [devPayments,setDevPayments]= useState([]);

  const [filter,     setFilter]     = useState('All');
  const [view,       setView]       = useState('list');   // 'list' | 'form'
  const [editId,     setEditId]     = useState(null);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [formError,  setFormError]  = useState('');
  const [selected,   setSelected]   = useState(null);     // quotation id
  const [saving,     setSaving]     = useState(false);
  const [loadError,  setLoadError]  = useState('');
  const [loaded,     setLoaded]     = useState(!live);

  // Payment modal
  const [payOpen,  setPayOpen]  = useState(false);
  const [payForm,  setPayForm]  = useState(EMPTY_PAY);
  const [payError, setPayError] = useState('');
  const [payBusy,  setPayBusy]  = useState(false);

  // Receipt modal
  const [receipt,  setReceipt]  = useState(null);

  // Delete confirmation — {row, blocked}
  const [delConfirm, setDelConfirm] = useState(null);

  // ── Listeners (live mode) ────────────────────────────────────────
  useEffect(() => {
    if (!live) { setLoaded(true); return; }
    const unis = [];
    // NOTE: no orderBy — docs missing createdAt would be dropped; sort client-side
    unis.push(onSnapshot(collection(db, 'quotations'), snap => {
      setQuotes(snap.docs.map(d => ({ id:d.id, ...d.data() }))
        .sort((a,b) => toMs(b.createdAt) - toMs(a.createdAt)));
      setLoaded(true);
    }, e => { console.error(e); setLoadError('Could not load quotations.'); setLoaded(true); }));

    unis.push(onSnapshot(collection(db, 'clients'), snap => {
      setClients(snap.docs.map(d => ({ id:d.id, ...d.data() }))
        .sort((a,b) => (a.name||'').localeCompare(b.name||'')));
    }, e => { console.error(e); setLoadError('Could not load clients.'); }));

    unis.push(onSnapshot(collection(db, 'quotationTemplates'), snap => {
      const rows = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      // Fallback to seeds until the Templates page auto-seeds the collection
      setTemplates(rows.length ? rows : QUOTATION_TEMPLATE_SEEDS.map(t => ({ id: seedId(t.serviceCode), ...t })));
    }, e => { console.error(e); setLoadError('Could not load quotation templates.'); }));

    return () => unis.forEach(u => u());
  }, [live]);

  // ── Payments for the selected quotation ─────────────────────────
  useEffect(() => {
    if (!selected) { setPayments([]); return; }
    if (!live) {
      setPayments(devPayments
        .filter(p => p.quotationId === selected)
        .sort((a,b) => toMs(b.createdAt) - toMs(a.createdAt)));
      return;
    }
    const q = query(collection(db, 'payments'), where('quotationId', '==', selected));
    return onSnapshot(q, snap => {
      setPayments(snap.docs.map(d => ({ id:d.id, ...d.data() }))
        .sort((a,b) => toMs(b.createdAt) - toMs(a.createdAt)));
    }, e => { console.error(e); });
  }, [selected, live, devPayments]);

  // ── Derived ──────────────────────────────────────────────────────
  const filtered = filter === 'All' ? quotes : quotes.filter(q => q.status === filter);
  const counts   = Object.fromEntries(FILTERS.map(f =>
    [f, f === 'All' ? quotes.length : quotes.filter(q => q.status === f).length]));

  const sel        = quotes.find(q => q.id === selected) || null;
  const selBalance = sel ? balanceOf(sel) : 0;
  const selPaid    = sel ? toInt(sel.paidTotal) : 0;
  const selClient  = sel ? clients.find(c => c.id === sel.clientId) : null;
  const receiptClient = receipt ? clients.find(c => c.id === receipt.clientId) : null;

  // WhatsApp message — quotation ready (opens a chat with the client)
  const quotationWhatsApp = () => {
    if (!sel) return '';
    const lines = (sel.items || [])
      .map(it => `• ${it.label} — LKR ${toInt(it.amount).toLocaleString('en-US')}`).join('\n');
    return `Hi ${sel.clientName || 'there'}! 👋

Your quotation ${sel.quotationNo || ''} for "${sel.projectTitle}" is ready:

${lines}

💰 Total: ${formatLKR(sel.totalAmount)}
📌 Advance (${toInt(sel.advancePct)}%): ${formatLKR(sel.advanceAmount)}

🔗 View & accept in your client portal: ${window.location.origin}/client-login

— ${company.fullName} Team`;
  };

  // WhatsApp message — payment receipt sent to the client
  const receiptWhatsApp = () => {
    if (!receipt) return '';
    return `Hi ${receipt.clientName || 'there'}! 👋

We've received your payment — thank you! 🙏

🧾 Receipt: ${receipt.receiptNo}
📄 Quotation: ${receipt.quotationNo || '—'}
💰 Amount: ${formatLKR(receipt.amount)}
💳 Method: ${receipt.method}${receipt.reference ? ` · Ref: ${receipt.reference}` : ''}

🔗 Portal: ${window.location.origin}/client-login

— ${company.fullName} Team`;
  };

  const clientSel  = clients.find(c => c.id === form.clientId);
  const services   = [...new Set(templates.map(t => t.serviceName).filter(Boolean))];
  const tplOptions = templates.filter(t => t.serviceName === form.service);
  const tplSel     = templates.find(t => t.id === form.templateId);

  const total          = form.items.reduce((s,i) => s + toInt(i.amount), 0);
  const advancePreview = Math.round(total * toInt(form.advancePct) / 100);

  // ── Form open / close ────────────────────────────────────────────
  const openCreate = () => {
    setEditId(null); setForm(EMPTY_FORM); setFormError('');
    setView('form'); setSelected(null);
  };

  const openEdit = (q) => {
    setEditId(q.id);
    setForm({
      clientId:    q.clientId || '',
      projectTitle:q.projectTitle || '',
      service:     q.service || '',
      templateId:  q.templateId || '',
      description: q.description || '',
      scope:       q.scope || '',
      items:       (q.items || []).map(b => ({ id:b.id || buid(), label:b.label, amount:String(toInt(b.amount)) })),
      customFields:(q.customFields || []).map(f => ({ id:f.id || buid(), label:f.label || '', value:f.value || '' })),
      advancePct:  toInt(q.advancePct) || 30,
      validUntil:  q.validUntil || '',
      terms:       q.terms || '',
      paymentTerms:q.paymentTerms || '',
      notes:       q.notes || '',
    });
    setFormError('');
    setView('form');
    setSelected(null);
  };

  const closeForm = () => { setView('list'); setEditId(null); setForm(EMPTY_FORM); setFormError(''); };

  // ── Template copy-on-create ──────────────────────────────────────
  const applyTemplate = (tpl) => {
    const items = [{ id:buid(), label:`Professional Fee — ${tpl.serviceName}`,
      amount: toInt(tpl.professionalFee) ? String(toInt(tpl.professionalFee)) : '' }];
    if (toInt(tpl.otherCharges) > 0) {
      items.push({ id:buid(), label:'Other Charges', amount:String(toInt(tpl.otherCharges)) });
    }
    setForm(p => ({
      ...p,
      templateId:   tpl.id,
      description:  tpl.description  || '',
      scope:        tpl.scope        || '',
      terms:        tpl.terms        || '',
      paymentTerms: tpl.paymentTerms || '',
      items,
      // Copy-on-create: snapshot the template's custom fields with fresh ids,
      // so later template edits never change this quotation.
      customFields: (tpl.customFields || []).map(f => ({ id:buid(), label:f.label || '', value:f.value || '' })),
    }));
  };

  const onTemplateChange = (val) => {
    if (!val) {
      setForm(p => ({ ...p, templateId:'', description:'', scope:'', terms:'', paymentTerms:'',
        items:[{ id:buid(), label:'', amount:'' }], customFields:[] }));
      return;
    }
    const tpl = templates.find(t => t.id === val);
    if (tpl) applyTemplate(tpl);
  };

  // ── Line item helpers ────────────────────────────────────────────
  const addItem    = () => setForm(p => ({ ...p, items:[...p.items, { id:buid(), label:'', amount:'' }] }));
  const removeItem = (id) => setForm(p => ({ ...p, items:p.items.filter(i => i.id !== id) }));
  const setItem    = (id, key, val) => setForm(p => ({ ...p, items:p.items.map(i => i.id === id ? { ...i, [key]:val } : i) }));

  // ── Custom field helpers (add / remove / edit extra boxes) ───────
  const addField    = () => setForm(p => ({ ...p, customFields:[...p.customFields, { id:buid(), label:'', value:'' }] }));
  const removeField = (id) => setForm(p => ({ ...p, customFields:p.customFields.filter(f => f.id !== id) }));
  const setField    = (id, key, val) => setForm(p => ({ ...p, customFields:p.customFields.map(f => f.id === id ? { ...f, [key]:val } : f) }));

  // ── Linked project helpers (lead accept → client account → project) ──
  const findLinkedProject = async (clientId, projectTitle) => {
    if (!live || !clientId) return null;
    try {
      const snap = await getDocs(query(collection(db, 'projects'), where('clientId', '==', clientId)));
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const t = String(projectTitle || '').trim().toLowerCase();
      const byTitle = t ? rows.find(p =>
        String(p.title || '').trim().toLowerCase() === t ||
        String(p.serviceType || '').trim().toLowerCase() === t) : null;
      const open = rows.filter(p => ['requirements_pending', 'quotation_sent'].includes(p.status))
        .sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
      return byTitle || open[0] || null;
    } catch (e) { console.error('project lookup failed', e); return null; }
  };

  // Keeps the linked project's status in step with the quotation pipeline.
  // Also backfills projectId on the quotation so the client portal can use it.
  const syncProjectStatus = async (q, newStatus) => {
    const projStatus = PROJECT_STATUS_FOR[newStatus];
    if (!live || !projStatus || !q?.clientId) return;
    try {
      let pid = q.projectId || null;
      if (!pid) {
        const proj = await findLinkedProject(q.clientId, q.projectTitle);
        pid = proj?.id || null;
        if (pid) {
          try { await updateDoc(doc(db, 'quotations', q.id), { projectId: pid }); }
          catch (e) { console.error(e); }
        }
      }
      if (pid) await updateDoc(doc(db, 'projects', pid), { status: projStatus, updatedAt: serverTimestamp() });
    } catch (e) { console.error('project status sync failed', e); }
  };

  // ── Save (create or update) ──────────────────────────────────────
  const handleSave = async (sendNow = false) => {
    if (!form.clientId)           { setFormError('Select a client.'); return; }
    if (!form.projectTitle.trim()) { setFormError('Enter the project / service title.'); return; }
    const items = form.items.filter(i => i.label.trim() && toInt(i.amount) > 0)
      .map(i => ({ id:i.id, label:i.label.trim(), amount:toInt(i.amount) }));
    if (!items.length) { setFormError('Add at least one line item with a description and amount.'); return; }

    const tot    = items.reduce((s,i) => s + i.amount, 0);
    const advPct = toInt(form.advancePct);
    const base = {
      clientId:     form.clientId,
      clientName:   clientSel?.name || '',
      clientCompany:clientSel?.company || '',
      service:      form.service || '',
      templateId:   form.templateId || null,
      templateCode: tplSel?.serviceCode || '',
      projectTitle: form.projectTitle.trim(),
      description:  form.description,
      scope:        form.scope,
      customFields: form.customFields
        .map(f => ({ id:f.id, label:String(f.label || '').trim(), value:String(f.value || '').trim() }))
        .filter(f => f.label),
      items,
      totalAmount:  tot,
      advancePct:   advPct,
      advanceAmount:Math.round(tot * advPct / 100),
      terms:        form.terms,
      paymentTerms: form.paymentTerms,
      notes:        form.notes,
      validUntil:   form.validUntil,
      updatedAt:    serverTimestamp(),
    };

    setSaving(true);
    setFormError('');

    try {
      if (editId) {
        const current = quotes.find(q => q.id === editId);
        const patch = { ...base };
        if (sendNow && current?.status === 'Draft') { patch.status = 'Sent'; patch.sentAt = serverTimestamp(); }
        if (live) {
          await updateDoc(doc(db, 'quotations', editId), patch);
        } else {
          setQuotes(p => p.map(q => q.id === editId ? { ...q, ...patch } : q));
        }
      } else {
        const quotationNo = live ? await nextNumber('quotations', 'Q') : `Q-${Date.now().toString().slice(-6)}`;
        // Link to the client's open pipeline project (created when the lead was accepted)
        const linkedProj = await findLinkedProject(form.clientId, form.projectTitle);
        const docData = { ...base, quotationNo, projectId: linkedProj?.id || null, paidTotal:0, paymentsCount:0,
                          status: sendNow ? 'Sent' : 'Draft',
                          ...(sendNow ? { sentAt: serverTimestamp() } : {}),
                          createdAt: serverTimestamp() };
        if (live) {
          await addDoc(collection(db, 'quotations'), docData);
        } else {
          setQuotes(p => [{ id:`QT${Date.now()}`, ...docData, createdAt: new Date().toISOString() }, ...p]);
        }
      }
      setSaving(false);
      closeForm();
    } catch (e) {
      console.error(e);
      setFormError('Could not save the quotation. Please try again.');
      setSaving(false);
    }
  };

  // ── Lifecycle actions ────────────────────────────────────────────
  const patchQuote = async (qid, patch) => {
    if (live) {
      try { await updateDoc(doc(db, 'quotations', qid), { ...patch, updatedAt: serverTimestamp() }); }
      catch (e) { console.error(e); setLoadError('Could not update the quotation.'); return; }
    } else {
      setQuotes(p => p.map(q => q.id === qid ? { ...q, ...patch } : q));
    }
    // Keep the linked project in step (Sent → quotation_sent, etc.)
    if (patch.status) {
      const q = quotes.find(x => x.id === qid);
      if (q) await syncProjectStatus({ ...q, ...patch }, patch.status);
    }
  };

  const handleSend      = (qid) => patchQuote(qid, { status:'Sent', sentAt: serverTimestamp() });
  const handleAccept    = (qid) => patchQuote(qid, { status:'Accepted', acceptedAt: serverTimestamp() });
  const handleStartWork = (qid) => patchQuote(qid, { status:'In Progress' });

  // ── Duplicate (always creates a new Draft) ───────────────────────
  const handleDuplicate = async (q) => {
    const base = {
      clientId:q.clientId, clientName:q.clientName, clientCompany:q.clientCompany,
      service:q.service || '', templateId:q.templateId || null, templateCode:q.templateCode || '',
      projectTitle:q.projectTitle, description:q.description || '', scope:q.scope || '',
      items:(q.items || []).map(b => ({ id:buid(), label:b.label, amount:toInt(b.amount) })),
      customFields:(q.customFields || []).map(f => ({ id:buid(), label:f.label || '', value:f.value || '' })),
      totalAmount:toInt(q.totalAmount), advancePct:toInt(q.advancePct),
      advanceAmount:toInt(q.advanceAmount),
      terms:q.terms || '', paymentTerms:q.paymentTerms || '', notes:q.notes || '',
      validUntil:q.validUntil || '',
      paidTotal:0, paymentsCount:0, status:'Draft', updatedAt: serverTimestamp(),
    };
    if (live) {
      try {
        const quotationNo = await nextNumber('quotations', 'Q');
        await addDoc(collection(db, 'quotations'), { ...base, quotationNo, createdAt: serverTimestamp() });
      } catch (e) { console.error(e); setLoadError('Could not duplicate the quotation.'); }
    } else {
      const quotationNo = `Q-${Date.now().toString().slice(-6)}`;
      setQuotes(p => [{ id:`QT${Date.now()}`, ...base, quotationNo, createdAt: new Date().toISOString() }, ...p]);
    }
  };

  // ── Delete (blocked when payments/receipts exist) ────────────────
  const askDelete = (q) =>
    setDelConfirm({ row:q, blocked: toInt(q.paidTotal) > 0 || toInt(q.paymentsCount) > 0 });

  const handleDelete = async () => {
    const { row } = delConfirm;
    if (live) {
      try { await deleteDoc(doc(db, 'quotations', row.id)); }
      catch (e) { console.error(e); }
    } else {
      setQuotes(p => p.filter(q => q.id !== row.id));
    }
    setDelConfirm(null);
    if (selected === row.id) setSelected(null);
  };

  // ── Record payment ───────────────────────────────────────────────
  const openPay = (q) => {
    setPayForm({ ...EMPTY_PAY, date: todayISO() });
    setPayError('');
    setSelected(q.id);
    setPayOpen(true);
  };

  const handlePaySave = async () => {
    if (!sel) return;
    const amt = toInt(payForm.amount);
    if (amt <= 0)         { setPayError('Enter a payment amount greater than 0.'); return; }
    if (amt > selBalance) { setPayError(`Payment cannot exceed the balance due (${formatLKR(selBalance)}).`); return; }

    setPayBusy(true);
    setPayError('');

    const receiptNo = live ? await nextNumber('receipts', 'R') : `R-${Date.now().toString().slice(-6)}`;
    const pay = {
      quotationId: sel.id,
      quotationNo: sel.quotationNo || '',
      clientId:    sel.clientId,
      clientName:  sel.clientName || '',
      clientCompany: sel.clientCompany || '',
      amount:      amt,
      date:        payForm.date || todayISO(),
      method:      payForm.method,
      reference:   payForm.reference || '',
      notes:       payForm.notes || '',
      receiptNo,
      createdAt:   serverTimestamp(),
    };

    // Auto status: Accepted → Advance Paid → In Progress → Completed (balance 0)
    const paidTotal = selPaid + amt;
    const nextSt = paidTotal >= toInt(sel.totalAmount) ? 'Completed'
      : (sel.status === 'In Progress' ? 'In Progress' : 'Advance Paid');

    try {
      if (live) {
        const ref = await addDoc(collection(db, 'payments'), pay);
        await updateDoc(doc(db, 'quotations', sel.id), {
          paidTotal,
          paymentsCount: toInt(sel.paymentsCount) + 1,
          status: nextSt,
          updatedAt: serverTimestamp(),
        });
        setReceipt({ ...pay, id: ref.id, createdAt: new Date() });
        // Advance paid / fully paid → move the linked project forward too
        await syncProjectStatus({ ...sel }, nextSt);
      } else {
        const pid = `pay${Date.now()}`;
        setDevPayments(p => [{ ...pay, id:pid, createdAt: new Date().toISOString() }, ...p]);
        setQuotes(p => p.map(q => q.id === sel.id
          ? { ...q, paidTotal, paymentsCount:toInt(sel.paymentsCount)+1, status:nextSt } : q));
        setReceipt({ ...pay, id: pid, createdAt: new Date() });
      }
      setPayOpen(false);
      setPayForm(EMPTY_PAY);
    } catch (e) {
      console.error(e);
      setPayError('Could not record the payment. Please try again.');
    }
    setPayBusy(false);
  };

  // ── Action guards ────────────────────────────────────────────────
  const canEdit = (q) => toInt(q.paidTotal) === 0;                     // locked once money moves
  const canPay  = (q) => balanceOf(q) > 0 && q.status !== 'Draft';

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      <style>{`
        @media (max-width: 1100px) {
          .qt-split  { grid-template-columns: 1fr !important; }
          .qt-sticky { position: static !important; }
        }
        @media print {
          body * { visibility: hidden !important; }
          .receipt-print, .receipt-print * { visibility: visible !important; }
          .receipt-print { position: fixed; left: 0; top: 0; width: 100%; background: #fff; }
        }
      `}</style>

      {loadError && (
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', borderRadius:10,
          background:'rgba(240,90,103,0.1)', border:'1px solid rgba(240,90,103,0.35)', color:C.red, fontSize:12 }}>
          <AlertTriangle size={14}/> {loadError}
        </div>
      )}

      {/* ═══════════════ CREATE / EDIT FORM ═══════════════ */}
      {view === 'form' && (
        <div className="qt-split" style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:16, alignItems:'start' }}>

          {/* Left — form */}
          <div style={{ display:'flex', flexDirection:'column', gap:12, minWidth:0 }}>

            <ERPPanel>
              <div style={{ padding:'14px 18px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:800, color:C.text }}>{editId ? 'Edit Quotation' : 'New Quotation'}</div>
                  <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>
                    Client → Service → Template, then edit and save as draft or send to the client
                  </div>
                </div>
                <ERPBtn variant="ghost" onClick={closeForm}>✕ Cancel</ERPBtn>
              </div>
            </ERPPanel>

            {formError && (
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', borderRadius:10,
                background:'rgba(245,185,66,0.08)', border:'1px solid rgba(245,185,66,0.35)', color:C.amber, fontSize:12 }}>
                <AlertTriangle size={14}/> {formError}
              </div>
            )}

            {/* Step 1 — Client & project */}
            <ERPPanel>
              <ERPPanelHeader title="1 · Client & Project" icon="👤"/>
              <div style={{ padding:'14px 18px', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12 }}>
                <ERPSelect label="Client" value={form.clientId} required placeholder="Select client..."
                  onChange={e => setForm(p => ({ ...p, clientId:e.target.value }))}
                  options={clients.map(c => ({ value:c.id, label:`${c.name}${c.company ? ` — ${c.company}` : ''}` }))}/>
                <ERPInput label="Project / Service Title" value={form.projectTitle} required
                  onChange={e => setForm(p => ({ ...p, projectTitle:e.target.value }))}
                  placeholder="e.g. Corporate Website Redesign"/>
              </div>
            </ERPPanel>

            {/* Step 2 — Service & template */}
            <ERPPanel>
              <ERPPanelHeader title="2 · Service & Template" icon="📄"/>
              <div style={{ padding:'14px 18px', display:'flex', flexDirection:'column', gap:12 }}>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12 }}>
                  <ERPSelect label="Service" value={form.service} placeholder="Select service..."
                    onChange={e => setForm(p => ({ ...p, service:e.target.value, templateId:'',
                      description:'', scope:'', terms:'', paymentTerms:'',
                      items:[{ id:buid(), label:'', amount:'' }], customFields:[] }))}
                    options={services.map(s => ({ value:s, label:s }))}/>
                  <ERPSelect label="Quotation Template" value={form.templateId}
                    placeholder={form.service ? 'Select template...' : 'Select a service first'}
                    onChange={e => onTemplateChange(e.target.value)}
                    options={tplOptions.map(t => ({ value:t.id,
                      label:`${t.serviceName}${t.serviceCode ? ` (${t.serviceCode})` : ''}` }))}/>
                </div>
                <div style={{ fontSize:11, color:C.muted, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                  <Info size={12}/> Template details are <b style={{ color:C.subtle }}>copied</b> into this quotation —
                  later template edits will not change it.
                </div>
              </div>
            </ERPPanel>

            {/* Step 3 — Description & scope + custom fields */}
            <ERPPanel>
              <ERPPanelHeader title="3 · Description & Scope" icon="📝"/>
              <div style={{ padding:'14px 18px', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12 }}>
                <ERPTextarea label="Description" value={form.description} rows={4}
                  onChange={e => setForm(p => ({ ...p, description:e.target.value }))}
                  placeholder="Short summary of the engagement..."/>
                <ERPTextarea label="Scope of Work (one item per line)" value={form.scope} rows={4}
                  onChange={e => setForm(p => ({ ...p, scope:e.target.value }))}
                  placeholder={'UI/UX design\nDevelopment\nDeployment'}/>
              </div>

              {/* Custom fields — add / remove / edit extra boxes */}
              <div style={{ padding:'0 18px 16px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8, flexWrap:'wrap', gap:6 }}>
                  <div style={{ fontSize:11, fontWeight:600, color:C.subtle }}>
                    Custom Fields <span style={{ color:C.muted, fontWeight:400 }}>(add your own boxes, e.g. Warranty · 12 months)</span>
                  </div>
                  <ERPBtn size="sm" variant="secondary" onClick={addField}><Plus size={12}/> Add Field</ERPBtn>
                </div>
                {form.customFields.length === 0 && (
                  <div style={{ fontSize:11, color:C.muted, padding:'8px 10px', borderRadius:8, background:'rgba(10,24,56,0.5)', border:`1px dashed ${C.border}` }}>
                    No custom fields — click “Add Field” to add your own.
                  </div>
                )}
                {form.customFields.map((f, idx) => (
                  <div key={f.id} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 32px', gap:8, marginBottom:8, alignItems:'center' }}>
                    <input value={f.label} onChange={e => setField(f.id, 'label', e.target.value)}
                      placeholder={`Field ${idx+1} name — e.g. Warranty`}
                      style={{ background:'rgba(10,24,56,0.8)', border:`1px solid ${C.border}`, borderRadius:10, padding:'8px 12px',
                        color:C.text, fontSize:12, outline:'none', minWidth:0 }}
                      onFocus={e => e.target.style.borderColor = 'rgba(0,102,255,0.5)'}
                      onBlur={e => e.target.style.borderColor = C.border}/>
                    <input value={f.value} onChange={e => setField(f.id, 'value', e.target.value)}
                      placeholder="Value — e.g. 12 months"
                      style={{ background:'rgba(10,24,56,0.8)', border:`1px solid ${C.border}`, borderRadius:10, padding:'8px 12px',
                        color:C.text, fontSize:12, outline:'none', minWidth:0 }}
                      onFocus={e => e.target.style.borderColor = 'rgba(0,102,255,0.5)'}
                      onBlur={e => e.target.style.borderColor = C.border}/>
                    <button onClick={() => removeField(f.id)} title="Remove field"
                      style={{ background:'none', border:'none', cursor:'pointer', color:C.red, display:'flex', justifyContent:'center' }}>
                      <Trash2 size={14}/>
                    </button>
                  </div>
                ))}
              </div>
            </ERPPanel>

            {/* Step 4 — Line items */}
            <ERPPanel>
              <div style={{ padding:'14px 18px 8px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:C.text }}>4 · Line Items</div>
                  <ERPBtn size="sm" variant="secondary" onClick={addItem}><Plus size={12}/> Add Item</ERPBtn>
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 130px 32px', gap:8, padding:'6px 4px', marginBottom:4 }}>
                  <span style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.6px' }}>Description</span>
                  <span style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.6px' }}>Amount (LKR)</span>
                  <span/>
                </div>

                {form.items.map((item, idx) => (
                  <div key={item.id} style={{ display:'grid', gridTemplateColumns:'1fr 130px 32px', gap:8, marginBottom:8, alignItems:'center' }}>
                    <input value={item.label} onChange={e => setItem(item.id, 'label', e.target.value)}
                      placeholder={`Item ${idx+1} — e.g. UI/UX Design`}
                      style={{ background:'rgba(10,24,56,0.8)', border:`1px solid ${C.border}`, borderRadius:10, padding:'8px 12px',
                        color:C.text, fontSize:12, outline:'none', minWidth:0 }}
                      onFocus={e => e.target.style.borderColor = 'rgba(0,102,255,0.5)'}
                      onBlur={e => e.target.style.borderColor = C.border}/>
                    <input value={item.amount} onChange={e => setItem(item.id, 'amount', e.target.value)}
                      type="number" min="0" placeholder="0"
                      style={{ background:'rgba(10,24,56,0.8)', border:`1px solid ${C.border}`, borderRadius:10, padding:'8px 12px',
                        color:C.text, fontSize:12, outline:'none', textAlign:'right', minWidth:0 }}
                      onFocus={e => e.target.style.borderColor = 'rgba(0,102,255,0.5)'}
                      onBlur={e => e.target.style.borderColor = C.border}/>
                    <button onClick={() => removeItem(item.id)} disabled={form.items.length === 1}
                      style={{ background:'none', border:'none', cursor:form.items.length === 1 ? 'default' : 'pointer',
                        color:form.items.length === 1 ? C.border : C.red, display:'flex', justifyContent:'center' }}>
                      <Trash2 size={14}/>
                    </button>
                  </div>
                ))}

                <div style={{ display:'grid', gridTemplateColumns:'1fr 130px 32px', gap:8, padding:'10px 4px 4px', borderTop:`1px solid ${C.border}` }}>
                  <span style={{ fontSize:12, fontWeight:700, color:C.muted, textAlign:'right', paddingRight:8 }}>Total</span>
                  <span style={{ fontSize:15, fontWeight:900, color:C.text, textAlign:'right', paddingRight:12 }}>
                    LKR {total.toLocaleString('en-US')}
                  </span>
                  <span/>
                </div>
              </div>
            </ERPPanel>

            {/* Step 5 — Payment terms */}
            <ERPPanel>
              <ERPPanelHeader title="5 · Payment Terms" icon="💰"/>
              <div style={{ padding:'14px 18px', display:'flex', flexDirection:'column', gap:14 }}>
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8, flexWrap:'wrap', gap:6 }}>
                    <label style={{ fontSize:11, fontWeight:600, color:C.subtle }}>Advance Payment</label>
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      <input type="number" min={0} max={100} value={form.advancePct}
                        onChange={e => setForm(p => ({ ...p, advancePct:Math.min(100, Math.max(0, Number(e.target.value) || 0)) }))}
                        style={{ width:50, background:'rgba(10,24,56,0.8)', border:`1px solid ${C.border}`, borderRadius:7,
                          padding:'4px 8px', color:C.text, fontSize:12, outline:'none', textAlign:'center' }}/>
                      <span style={{ fontSize:12, color:C.muted }}>%</span>
                      <span style={{ fontSize:13, fontWeight:800, color:C.green }}>= LKR {advancePreview.toLocaleString('en-US')}</span>
                    </div>
                  </div>
                  <input type="range" min={0} max={100} value={form.advancePct}
                    onChange={e => setForm(p => ({ ...p, advancePct:Number(e.target.value) }))}
                    style={{ width:'100%', accentColor:C.blue }}/>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:C.muted, marginTop:2 }}>
                    <span>0%</span><span>50%</span><span>100%</span>
                  </div>
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12 }}>
                  <ERPInput label="Valid Until" value={form.validUntil} type="date"
                    onChange={e => setForm(p => ({ ...p, validUntil:e.target.value }))}/>
                  <ERPInput label="Payment Terms" value={form.paymentTerms}
                    onChange={e => setForm(p => ({ ...p, paymentTerms:e.target.value }))}
                    placeholder="e.g. 30% advance, rest on delivery"/>
                </div>
              </div>
            </ERPPanel>

            {/* Step 6 — T&C and notes */}
            <ERPPanel>
              <ERPPanelHeader title="6 · Terms & Notes" icon="📑"/>
              <div style={{ padding:'14px 18px', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12 }}>
                <ERPTextarea label="Terms & Conditions" value={form.terms} rows={3}
                  onChange={e => setForm(p => ({ ...p, terms:e.target.value }))}
                  placeholder="Standard terms and conditions..."/>
                <ERPTextarea label="Notes" value={form.notes} rows={3}
                  onChange={e => setForm(p => ({ ...p, notes:e.target.value }))}
                  placeholder="e.g. Includes 3 months free support after launch..."/>
              </div>
            </ERPPanel>

            {/* Actions */}
            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              <ERPBtn variant="secondary" onClick={closeForm} style={{ flex:1, minWidth:110, justifyContent:'center' }}>Cancel</ERPBtn>
              <ERPBtn variant="ghost" onClick={() => handleSave(false)} disabled={saving}
                style={{ flex:1, minWidth:110, justifyContent:'center' }}>💾 Save Draft</ERPBtn>
              <ERPBtn variant="primary" onClick={() => handleSave(true)} disabled={saving || total === 0}
                style={{ flex:1, minWidth:110, justifyContent:'center' }}>
                {saving ? 'Saving...' : <><Send size={13}/> Save & Send</>}
              </ERPBtn>
            </div>
          </div>

          {/* Right — live preview */}
          <ERPPanel className="qt-sticky" style={{ position:'sticky', top:0 }}>
            <ERPPanelHeader title="Preview" icon="👁️"/>
            <div style={{ padding:18, display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ fontSize:11, color:C.muted }}>
                {editId ? 'Editing existing quotation' : 'New quotation — number is assigned on save'}
              </div>
              {form.clientId && (
                <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                  <ERPAvatar name={clientSel?.name || '?'} color={C.blue} size={32}/>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {clientSel?.name}
                    </div>
                    <div style={{ fontSize:10, color:C.muted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {clientSel?.company}
                    </div>
                  </div>
                </div>
              )}
              {form.projectTitle && <div style={{ fontSize:11, color:C.cyan, fontWeight:600, wordBreak:'break-word' }}>{form.projectTitle}</div>}
              {form.service && <div style={{ fontSize:10, color:C.muted }}>Service: {form.service}{tplSel?.serviceCode ? ` · ${tplSel.serviceCode}` : ''}</div>}

              {form.customFields.filter(f => f.label.trim()).length > 0 && (
                <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                  {form.customFields.filter(f => f.label.trim()).map(f => (
                    <div key={f.id} style={{ display:'flex', justifyContent:'space-between', gap:8, fontSize:10.5 }}>
                      <span style={{ color:C.muted, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.label}</span>
                      <span style={{ color:C.subtle, fontWeight:600, flexShrink:0, textAlign:'right' }}>{f.value || '—'}</span>
                    </div>
                  ))}
                </div>
              )}

              {form.items.filter(i => i.label.trim() && toInt(i.amount) > 0).map(item => (
                <div key={item.id} style={{ display:'flex', justifyContent:'space-between', gap:8, fontSize:11, padding:'5px 0', borderBottom:'1px solid rgba(32,52,93,0.25)' }}>
                  <span style={{ color:C.muted, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.label}</span>
                  <span style={{ color:C.subtle, fontWeight:600, flexShrink:0 }}>LKR {toInt(item.amount).toLocaleString('en-US')}</span>
                </div>
              ))}

              {total > 0 && (
                <>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderTop:`1px solid ${C.border}` }}>
                    <span style={{ fontSize:13, fontWeight:800, color:C.text }}>Total</span>
                    <span style={{ fontSize:18, fontWeight:900, color:C.text }}>LKR {total.toLocaleString('en-US')}</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 12px', borderRadius:8,
                    background:'rgba(24,199,122,0.08)', border:'1px solid rgba(24,199,122,0.2)' }}>
                    <span style={{ fontSize:11, color:C.muted }}>Advance ({form.advancePct}%)</span>
                    <span style={{ fontSize:13, fontWeight:800, color:C.green }}>LKR {advancePreview.toLocaleString('en-US')}</span>
                  </div>
                </>
              )}

              {form.validUntil && <div style={{ fontSize:10, color:C.muted }}>⏰ Valid until: {fmtDate(form.validUntil)}</div>}
              {form.notes && (
                <div style={{ fontSize:11, color:C.muted, background:'rgba(10,24,56,0.5)', borderRadius:8, padding:'8px 10px', lineHeight:1.5 }}>📋 {form.notes}</div>
              )}
            </div>
          </ERPPanel>
        </div>
      )}

      {/* ═══════════════ LIST VIEW ═══════════════ */}
      {view === 'list' && (
        <>
          {/* Header + filters */}
          <ERPPanel>
            <div style={{ padding:'14px 18px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap' }}>
              <div>
                <div style={{ fontSize:14, fontWeight:800, color:C.text }}>Quotations</div>
                <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>
                  Payments and receipts are tracked inside each quotation
                </div>
              </div>
              <ERPBtn variant="primary" onClick={openCreate}><Plus size={14}/> New Quotation</ERPBtn>
            </div>
            <div style={{ display:'flex', gap:6, padding:'0 18px 14px', flexWrap:'wrap' }}>
              {FILTERS.map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  style={{
                    padding:'5px 12px', borderRadius:20, fontSize:11, fontWeight:700, cursor:'pointer',
                    background: filter === f ? 'linear-gradient(135deg,#0066FF,#1787FF)' : 'rgba(10,24,56,0.8)',
                    color: filter === f ? '#fff' : C.muted,
                    border:`1px solid ${filter === f ? 'transparent' : C.border}`,
                  }}>
                  {f} ({counts[f]})
                </button>
              ))}
            </div>
          </ERPPanel>

          {!loaded ? (
            <div style={{ padding:'60px 0', display:'flex', justifyContent:'center' }}>
              <div style={{ width:32, height:32, borderRadius:'50%', border:`3px solid ${C.border}`, borderTopColor:C.blue,
                animation:'qtspin 0.8s linear infinite' }}/>
              <style>{`@keyframes qtspin{to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : quotes.length === 0 ? (
            <ERPPanel>
              <ERPEmpty icon="🧾" title="No quotations yet"
                sub="Create your first quotation — pick a client, a service and a template, then send it."
                action={<ERPBtn variant="primary" onClick={openCreate}><Plus size={14}/> New Quotation</ERPBtn>}/>
            </ERPPanel>
          ) : (
            <div className="qt-split" style={{ display:'grid', gridTemplateColumns: sel ? 'minmax(0,1fr) 430px' : '1fr', gap:16, alignItems:'start' }}>

              {/* Cards */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(290px,1fr))', gap:12, minWidth:0 }}>
                {filtered.length === 0 && (
                  <ERPPanel style={{ gridColumn:'1 / -1' }}>
                    <ERPEmpty icon="🔍" title={`No ${filter} quotations`} sub="Try a different status filter."/>
                  </ERPPanel>
                )}
                {filtered.map(q => {
                  const bal = balanceOf(q);
                  return (
                    <ERPPanel key={q.id}
                      onClick={() => setSelected(selected === q.id ? null : q.id)}
                      style={{ cursor:'pointer', borderColor: selected === q.id ? C.borderHi : C.border }}>
                      <div style={{ padding:14, display:'flex', flexDirection:'column', gap:10 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                          <span style={{ fontSize:11, fontWeight:800, color:C.cyan }}>{q.quotationNo || q.id}</span>
                          <ERPBadge status={q.status} label={STATUS_LABEL[q.status]}/>
                        </div>
                        <div style={{ display:'flex', gap:10, alignItems:'center', minWidth:0 }}>
                          <ERPAvatar name={q.clientName || '?'} color={C.blue} size={34}/>
                          <div style={{ minWidth:0 }}>
                            <div style={{ fontSize:12, fontWeight:700, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {q.clientName}
                            </div>
                            <div style={{ fontSize:10, color:C.muted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {q.clientCompany}
                            </div>
                          </div>
                        </div>
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontSize:12, fontWeight:600, color:C.subtle, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {q.projectTitle}
                          </div>
                          <div style={{ fontSize:10, color:C.muted }}>
                            {fmtAny(q.createdAt)}{q.validUntil ? ` · valid until ${fmtDate(q.validUntil)}` : ''}
                          </div>
                        </div>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8, flexWrap:'wrap' }}>
                          <span style={{ fontSize:15, fontWeight:900, color:C.text }}>{formatLKR(q.totalAmount)}</span>
                          <span style={{ fontSize:10, fontWeight:600, color: bal === 0 ? C.green : C.amber }}>
                            {bal === 0 ? 'Fully paid' : `Balance ${formatLKR(bal)}`}
                          </span>
                        </div>
                        <div style={{ display:'flex', gap:6, borderTop:`1px solid ${C.border}`, paddingTop:10, flexWrap:'wrap' }}
                          onClick={e => e.stopPropagation()}>
                          <ERPBtn size="sm" variant="secondary" onClick={() => setSelected(q.id)}><Eye size={12}/> View</ERPBtn>
                          {q.status === 'Draft' && <ERPBtn size="sm" variant="primary" onClick={() => handleSend(q.id)}><Send size={12}/> Send</ERPBtn>}
                          {canPay(q) && <ERPBtn size="sm" variant="success" onClick={() => openPay(q)}><CreditCard size={12}/> Payment</ERPBtn>}
                          {canEdit(q) && <ERPBtn size="sm" variant="ghost" onClick={() => openEdit(q)} title="Edit"><Edit2 size={12}/></ERPBtn>}
                          <ERPBtn size="sm" variant="ghost" onClick={() => handleDuplicate(q)} title="Duplicate"><Copy size={12}/></ERPBtn>
                          <ERPBtn size="sm" variant="ghost" onClick={() => askDelete(q)} title="Delete"><Trash2 size={12}/></ERPBtn>
                        </div>
                      </div>
                    </ERPPanel>
                  );
                })}
              </div>

              {/* Detail panel */}
              {sel && (
                <ERPPanel className="qt-sticky" style={{ position:'sticky', top:0 }}>
                  <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:800, color:C.text }}>{sel.quotationNo || sel.id}</div>
                      <div style={{ fontSize:10, color:C.muted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {sel.clientName}{sel.clientCompany ? ` — ${sel.clientCompany}` : ''}
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                      <ERPBadge status={sel.status} label={STATUS_LABEL[sel.status]}/>
                      <button onClick={() => setSelected(null)}
                        style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', padding:2 }}>✕</button>
                    </div>
                  </div>

                  <div style={{ padding:18, display:'flex', flexDirection:'column', gap:14, maxHeight:'70vh', overflowY:'auto' }}>

                    {/* Meta */}
                    <div style={{ fontSize:11, color:C.subtle, lineHeight:1.7 }}>
                      <div><span style={{ color:C.muted }}>Project:</span> {sel.projectTitle}</div>
                      {sel.service && <div><span style={{ color:C.muted }}>Service:</span> {sel.service}{sel.templateCode ? ` (${sel.templateCode})` : ''}</div>}
                      <div><span style={{ color:C.muted }}>Created:</span> {fmtAny(sel.createdAt)}</div>
                      {sel.validUntil && <div><span style={{ color:C.muted }}>Valid until:</span> {fmtDate(sel.validUntil)}</div>}
                    </div>

                    {/* Money boxes */}
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(85px,1fr))', gap:8 }}>
                      {[
                        { label:'Total',                          value:toInt(sel.totalAmount),   color:C.text },
                        { label:`Advance (${toInt(sel.advancePct)}%)`, value:toInt(sel.advanceAmount), color:C.cyan },
                        { label:'Paid',                           value:selPaid,                  color:C.green },
                        { label:'Balance',                        value:selBalance,               color:selBalance === 0 ? C.green : C.amber },
                      ].map(b => (
                        <div key={b.label} style={{ padding:'8px 10px', borderRadius:10, background:'rgba(10,24,56,0.8)', border:`1px solid ${C.border}` }}>
                          <div style={{ fontSize:9, color:C.muted, textTransform:'uppercase', letterSpacing:'0.5px' }}>{b.label}</div>
                          <div style={{ fontSize:12, fontWeight:900, color:b.color, marginTop:2 }}>{b.value.toLocaleString('en-US')}</div>
                        </div>
                      ))}
                    </div>

                    {/* Description & scope */}
                    {sel.description && <div style={{ fontSize:11, color:C.subtle, lineHeight:1.6 }}>{sel.description}</div>}
                    {sel.scope && (
                      <div>
                        <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:4 }}>Scope</div>
                        {String(sel.scope).split('\n').filter(Boolean).map((s, i) => (
                          <div key={i} style={{ fontSize:11, color:C.subtle, display:'flex', gap:6 }}>
                            <span style={{ color:C.cyan }}>•</span> {s}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Custom fields */}
                    {(sel.customFields || []).length > 0 && (
                      <div>
                        <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:4 }}>Custom Fields</div>
                        {sel.customFields.map(f => (
                          <div key={f.id} style={{ display:'flex', justifyContent:'space-between', gap:8, fontSize:11, padding:'3px 0' }}>
                            <span style={{ color:C.muted, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.label}</span>
                            <span style={{ color:C.subtle, fontWeight:600, flexShrink:0, textAlign:'right' }}>{f.value || '—'}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Breakdown */}
                    <div>
                      <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:4 }}>Breakdown</div>
                      {(sel.items || []).map(it => (
                        <div key={it.id} style={{ display:'flex', justifyContent:'space-between', gap:8, fontSize:11, padding:'4px 0' }}>
                          <span style={{ color:C.muted, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{it.label}</span>
                          <span style={{ color:C.subtle, fontWeight:600, flexShrink:0 }}>{formatLKR(it.amount)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Payment history */}
                    <div>
                      <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:4 }}>
                        Payment History ({payments.length})
                      </div>
                      {payments.length === 0 ? (
                        <div style={{ fontSize:11, color:C.muted, padding:'8px 0' }}>No payments recorded yet.</div>
                      ) : payments.map(p => (
                        <div key={p.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8,
                          padding:'7px 10px', borderRadius:9, background:'rgba(10,24,56,0.8)', border:`1px solid ${C.border}`, marginBottom:6 }}>
                          <div style={{ minWidth:0 }}>
                            <div style={{ fontSize:11, fontWeight:700, color:C.text }}>
                              {formatLKR(p.amount)} <span style={{ color:C.muted, fontWeight:600 }}>· {p.method}</span>
                            </div>
                            <div style={{ fontSize:9, color:C.muted }}>
                              {fmtDate(p.date)}{p.receiptNo ? ` · ${p.receiptNo}` : ''}{p.reference ? ` · ${p.reference}` : ''}
                            </div>
                          </div>
                          <ERPBtn size="sm" variant="secondary" onClick={() => setReceipt(p)}>
                            <ReceiptIcon size={11}/> Receipt
                          </ERPBtn>
                        </div>
                      ))}
                    </div>

                    {/* Terms & notes */}
                    {sel.paymentTerms && <div style={{ fontSize:10, color:C.muted }}>💰 {sel.paymentTerms}</div>}
                    {sel.terms &&       <div style={{ fontSize:10, color:C.muted }}>📑 {sel.terms}</div>}
                    {sel.notes &&       <div style={{ fontSize:10, color:C.muted }}>📝 {sel.notes}</div>}

                    {/* Actions */}
                    <div style={{ display:'flex', flexDirection:'column', gap:8, borderTop:`1px solid ${C.border}`, paddingTop:12 }}>
                      {sel.status === 'Advance Paid' && (
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, flexWrap:'wrap',
                          padding:'9px 12px', borderRadius:10, background:'rgba(24,199,122,0.08)', border:'1px solid rgba(24,199,122,0.25)' }}>
                          <span style={{ fontSize:11, color:C.green, fontWeight:600, flex:1, minWidth:140 }}>
                            ✅ Advance recorded — assign staff to start the work.
                          </span>
                          <ERPBtn size="sm" variant="primary" onClick={() => navigate('/erp/staff?tab=work')}>Assign Staff</ERPBtn>
                        </div>
                      )}
                      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                        {sel.status === 'Draft' && (
                          <ERPBtn size="sm" variant="primary" onClick={() => handleSend(sel.id)}><Send size={12}/> Send to Client</ERPBtn>
                        )}
                        {sel.status === 'Sent' && (
                          <ERPBtn size="sm" variant="success" onClick={() => handleAccept(sel.id)}><CheckCircle2 size={12}/> Mark Accepted</ERPBtn>
                        )}
                        {sel.status === 'Advance Paid' && (
                          <ERPBtn size="sm" variant="secondary" onClick={() => handleStartWork(sel.id)}><Play size={12}/> Start Work</ERPBtn>
                        )}
                        {canPay(sel) && (
                          <ERPBtn size="sm" variant="success" onClick={() => openPay(sel)}><CreditCard size={12}/> Record Payment</ERPBtn>
                        )}
                        {selClient?.phone && ['Sent', 'Accepted'].includes(sel.status) && (
                          <a href={waLink(selClient.phone, quotationWhatsApp())} target="_blank" rel="noopener noreferrer"
                            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, textDecoration:'none',
                              padding:'7px 12px', borderRadius:8, background:'linear-gradient(135deg,#25D366,#128C7E)',
                              color:'#fff', fontWeight:700, fontSize:11 }}>
                            <MessageSquare size={12}/> WhatsApp
                          </a>
                        )}
                      </div>
                      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                        {canEdit(sel) && <ERPBtn size="sm" variant="ghost" onClick={() => openEdit(sel)}><Edit2 size={12}/> Edit</ERPBtn>}
                        <ERPBtn size="sm" variant="ghost" onClick={() => handleDuplicate(sel)}><Copy size={12}/> Duplicate</ERPBtn>
                        <ERPBtn size="sm" variant="danger"  onClick={() => askDelete(sel)}><Trash2 size={12}/> Delete</ERPBtn>
                      </div>
                      {toInt(sel.paidTotal) > 0 && (
                        <div style={{ fontSize:10, color:C.amber, display:'flex', alignItems:'center', gap:5 }}>
                          <AlertTriangle size={11}/> Editing is locked because payments have been recorded.
                        </div>
                      )}
                    </div>
                  </div>
                </ERPPanel>
              )}
            </div>
          )}
        </>
      )}

      {/* ═══════════════ PAYMENT MODAL ═══════════════ */}
      <ERPModal isOpen={payOpen} onClose={() => !payBusy && setPayOpen(false)} title={`Record Payment — ${sel?.quotationNo || ''}`} width={480}>
        {sel && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
              {[
                { label:'Total',   value:toInt(sel.totalAmount), color:C.text },
                { label:'Paid',    value:selPaid,                color:C.green },
                { label:'Balance', value:selBalance,             color:selBalance === 0 ? C.green : C.amber },
              ].map(b => (
                <div key={b.label} style={{ padding:'8px 10px', borderRadius:10, background:'rgba(10,24,56,0.8)', border:`1px solid ${C.border}` }}>
                  <div style={{ fontSize:9, color:C.muted, textTransform:'uppercase', letterSpacing:'0.5px' }}>{b.label}</div>
                  <div style={{ fontSize:13, fontWeight:900, color:b.color }}>{b.value.toLocaleString('en-US')}</div>
                </div>
              ))}
            </div>

            {payError && (
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 12px', borderRadius:9,
                background:'rgba(240,90,103,0.1)', border:'1px solid rgba(240,90,103,0.35)', color:C.red, fontSize:11 }}>
                <AlertTriangle size={13}/> {payError}
              </div>
            )}

            <ERPInput label={`Amount (LKR) — balance due ${formatLKR(selBalance)}`} value={payForm.amount} type="number" required
              onChange={e => setPayForm(p => ({ ...p, amount:e.target.value }))} placeholder="0"/>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12 }}>
              <ERPInput label="Payment Date" value={payForm.date} type="date"
                onChange={e => setPayForm(p => ({ ...p, date:e.target.value }))}/>
              <ERPSelect label="Method" value={payForm.method}
                onChange={e => setPayForm(p => ({ ...p, method:e.target.value }))}
                options={PAYMENT_METHODS.map(m => ({ value:m, label:m }))}/>
            </div>
            <ERPInput label="Reference" value={payForm.reference}
              onChange={e => setPayForm(p => ({ ...p, reference:e.target.value }))}
              placeholder="e.g. cheque no / bank slip ref"/>
            <ERPTextarea label="Notes" value={payForm.notes} rows={2}
              onChange={e => setPayForm(p => ({ ...p, notes:e.target.value }))}
              placeholder="Optional note..."/>
            <div style={{ fontSize:10, color:C.muted }}>
              A receipt with a unique number is generated automatically for every payment.
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <ERPBtn variant="secondary" onClick={() => setPayOpen(false)} disabled={payBusy} style={{ flex:1, justifyContent:'center' }}>Cancel</ERPBtn>
              <ERPBtn variant="primary" onClick={handlePaySave} disabled={payBusy} style={{ flex:1, justifyContent:'center' }}>
                {payBusy ? 'Saving...' : 'Save Payment & Receipt'}
              </ERPBtn>
            </div>
          </div>
        )}
      </ERPModal>

      {/* ═══════════════ DELETE CONFIRM ═══════════════ */}
      <ERPModal isOpen={!!delConfirm} onClose={() => setDelConfirm(null)} title="Delete Quotation" width={440}>
        {delConfirm && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {delConfirm.blocked ? (
              <>
                <div style={{ display:'flex', alignItems:'center', gap:8, color:C.amber, fontSize:12, fontWeight:700 }}>
                  <XCircle size={15}/> Cannot delete this quotation
                </div>
                <div style={{ fontSize:12, color:C.muted, lineHeight:1.6 }}>
                  <b style={{ color:C.subtle }}>{delConfirm.row.quotationNo || delConfirm.row.id}</b> has payment receipt(s) recorded
                  ({formatLKR(delConfirm.row.paidTotal)} paid). Quotations with payments cannot be deleted.
                </div>
                <ERPBtn variant="secondary" onClick={() => setDelConfirm(null)} style={{ justifyContent:'center' }}>Understood</ERPBtn>
              </>
            ) : (
              <>
                <div style={{ fontSize:12, color:C.muted, lineHeight:1.6 }}>
                  Delete quotation <b style={{ color:C.text }}>{delConfirm.row.quotationNo || delConfirm.row.id}</b> for{' '}
                  <b style={{ color:C.text }}>{delConfirm.row.clientName}</b>? This cannot be undone.
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <ERPBtn variant="secondary" onClick={() => setDelConfirm(null)} style={{ flex:1, justifyContent:'center' }}>Cancel</ERPBtn>
                  <ERPBtn variant="danger" onClick={handleDelete} style={{ flex:1, justifyContent:'center' }}>
                    <Trash2 size={13}/> Delete
                  </ERPBtn>
                </div>
              </>
            )}
          </div>
        )}
      </ERPModal>

      {/* ═══════════════ RECEIPT MODAL ═══════════════ */}
      <ERPModal isOpen={!!receipt} onClose={() => setReceipt(null)} title={`Receipt ${receipt?.receiptNo || ''}`} width={560}>
        {receipt && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {/* Light document body (this exact block is what prints) */}
            <div className="receipt-print" style={{
              background:'#ffffff', color:'#111827', borderRadius:12, padding:'26px 28px',
              fontFamily:'Georgia, "Times New Roman", serif',
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, flexWrap:'wrap' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <img src={company.logos.lightMode || company.logos.darkMode} alt={company.fullName}
                    style={{ height:44, width:'auto', objectFit:'contain' }}
                    onError={e => { e.currentTarget.style.display = 'none'; }}/>
                  <div>
                    <div style={{ fontSize:15, fontWeight:800, color:'#0b1f3a' }}>{company.fullName}</div>
                    <div style={{ fontSize:9, color:'#4b5563', maxWidth:230, lineHeight:1.5 }}>
                      {company.contact.address}<br/>
                      {company.contact.phone} · {company.contact.email}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:16, fontWeight:900, color:'#0b1f3a', letterSpacing:1 }}>PAYMENT RECEIPT</div>
                  <div style={{ fontSize:11, color:'#374151', marginTop:2 }}>{receipt.receiptNo}</div>
                </div>
              </div>

              <div style={{ height:2, background:'linear-gradient(90deg,#0b1f3a,#0066FF)', margin:'14px 0', borderRadius:2 }}/>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px 18px', fontSize:11 }}>
                <div><span style={{ color:'#6b7280' }}>Received from:</span></div>
                <div style={{ fontWeight:700 }}>
                  {receipt.clientName}{receipt.clientCompany ? `, ${receipt.clientCompany}` : ''}
                </div>
                <div><span style={{ color:'#6b7280' }}>Quotation No:</span></div>
                <div style={{ fontWeight:700 }}>{receipt.quotationNo || '—'}</div>
                <div><span style={{ color:'#6b7280' }}>Payment date:</span></div>
                <div style={{ fontWeight:700 }}>{fmtDate(receipt.date)}</div>
                <div><span style={{ color:'#6b7280' }}>Payment method:</span></div>
                <div style={{ fontWeight:700 }}>{receipt.method}</div>
                {receipt.reference && (
                  <>
                    <div><span style={{ color:'#6b7280' }}>Reference:</span></div>
                    <div style={{ fontWeight:700 }}>{receipt.reference}</div>
                  </>
                )}
                {receipt.notes && (
                  <>
                    <div><span style={{ color:'#6b7280' }}>Notes:</span></div>
                    <div>{receipt.notes}</div>
                  </>
                )}
              </div>

              <div style={{ marginTop:16, padding:'12px 16px', borderRadius:10, background:'#eff6ff', border:'1px solid #bfdbfe',
                display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
                <span style={{ fontSize:11, color:'#374151', fontWeight:700, textTransform:'uppercase', letterSpacing:1 }}>
                  Amount Received
                </span>
                <span style={{ fontSize:20, fontWeight:900, color:'#0b1f3a' }}>{formatLKR(receipt.amount)}</span>
              </div>

              <div style={{ marginTop:16, paddingTop:10, borderTop:'1px solid #e5e7eb', display:'flex', justifyContent:'space-between', fontSize:9, color:'#6b7280', flexWrap:'wrap', gap:6 }}>
                <span>Thank you for your business — {company.fullName}</span>
                <span>Issued {fmtAny(receipt.createdAt)}</span>
              </div>
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <ERPBtn variant="secondary" onClick={() => setReceipt(null)} style={{ flex:1, justifyContent:'center' }}>Close</ERPBtn>
              {receiptClient?.phone && (
                <a href={waLink(receiptClient.phone, receiptWhatsApp())} target="_blank" rel="noopener noreferrer"
                  style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8, textDecoration:'none',
                    padding:'10px', borderRadius:10, background:'linear-gradient(135deg,#25D366,#128C7E)',
                    color:'#fff', fontWeight:700, fontSize:12 }}>
                  <MessageSquare size={13}/> Send via WhatsApp
                </a>
              )}
              <ERPBtn variant="primary" onClick={() => window.print()} style={{ flex:1, justifyContent:'center' }}>
                <Printer size={13}/> Print / Save PDF
              </ERPBtn>
            </div>
            <div style={{ fontSize:10, color:C.muted, textAlign:'center' }}>
              Tip: choose “Save as PDF” as the printer destination to download the receipt.
            </div>
          </div>
        )}
      </ERPModal>
    </div>
  );
}
