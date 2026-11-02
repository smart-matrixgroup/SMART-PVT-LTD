// ─────────────────────────────────────────────────────────────────
//  Finance module — Income + Expenses.
//  Income is fed automatically from invoice / quotation payments
//  (advances, parts, finals) and can also be entered manually for
//  investments, trusts, refunds, etc.
//  Expenses are manual office/client spend records with categories.
// ─────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, onSnapshot, addDoc, deleteDoc, doc, setDoc, updateDoc,
  serverTimestamp, arrayUnion, getDoc,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  ERPPanel, ERPPanelHeader, ERPBtn, ERPModal, ERPInput, ERPTextarea,
  ERPSelect, ERPEmpty, C
} from '../components/ERPui';
import {
  Wallet, TrendingUp, DollarSign, Plus, Trash2,
  AlertTriangle, ShoppingBag, RefreshCw,
  BarChart3, PieChart, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { toInt, formatLKR, fmtDate, todayISO } from '../money';
import {
  DEV_FINANCE_INCOME, DEV_FINANCE_EXPENSES, defaultExpenseCategories,
  financeErrorText, expenseTotal, RULES_DEPLOY_CMD
} from '../finance/financeSync';

const INCOME_CATEGORIES = ['Investment', 'Trust', 'Refund', 'Other'];
const SETTINGS_DOC_ID = 'financeSettings';

const monthLabel = (key) => {
  if (!key) return 'All time';
  const d = new Date(`${key}-01T00:00:00`);
  return Number.isNaN(d.getTime()) ? key
    : d.toLocaleString('en', { month: 'long', year: 'numeric' });
};
const monthShort = (key) => {
  const d = new Date(`${key}-01T00:00:00`);
  return Number.isNaN(d.getTime()) ? key : d.toLocaleString('en', { month: 'short' });
};

const CAT_GRADIENTS = [
  'linear-gradient(90deg, #F05A67, #F5B942)',
  'linear-gradient(90deg, #8B5CF6, #00D9FF)',
  'linear-gradient(90deg, #0066FF, #00D9FF)',
  'linear-gradient(90deg, #18C77A, #00D9FF)',
  'linear-gradient(90deg, #F5B942, #F05A67)',
  'linear-gradient(90deg, #00D9FF, #8B5CF6)',
];

// ── Small display pieces (no hover movement anywhere) ──────────────
function FlowChip({ Icon, color, value, label }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '7px 11px', borderRadius: 10,
      background: `${color}12`, border: `1px solid ${color}3a`,
    }}>
      <Icon size={14} style={{ color }} />
      <div style={{ lineHeight: 1.15 }}>
        <div style={{ fontSize: 12.5, fontWeight: 900, color }}>{value}</div>
        <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</div>
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, color, value, label }) {
  return (
    <div style={{
      padding: '9px 11px', borderRadius: 11, background: 'rgba(4,13,31,0.55)',
      border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 9,
    }}>
      <span style={{
        width: 24, height: 24, borderRadius: 8, flexShrink: 0, display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center', background: `${color}18`,
        border: `1px solid ${color}33`, boxShadow: `0 0 12px ${color}22`,
      }}>
        <Icon size={12} style={{ color }} />
      </span>
      <div style={{ lineHeight: 1.2, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: C.text }}>{value}</div>
        <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      </div>
    </div>
  );
}

export default function ERPFinance() {
  const { isDevSession, currentUser } = useAuth();
  const live = isFirebaseConfigured && !isDevSession;

  const adminName = currentUser?.displayName || currentUser?.email || 'Admin';
  const adminEmail = currentUser?.email || '';

  const [tab, setTab] = useState('income');
  const [month, setMonth] = useState(() => todayISO().slice(0, 7));
  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState(defaultExpenseCategories());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [openIncome, setOpenIncome] = useState(false);
  const [incomeForm, setIncomeForm] = useState({
    date: todayISO(), source: '', category: '', amount: '', remark: ''
  });
  const [openExpense, setOpenExpense] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    date: todayISO(), category: '', item: '', quantity: '', unitPrice: '', amount: '', remark: ''
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  // Amber, non-blocking note — the record saved but something secondary did not.
  const [softMsg, setSoftMsg] = useState('');

  const [deleteItem, setDeleteItem] = useState(null);

  // ── Data subscriptions ───────────────────────────────────────────
  useEffect(() => {
    if (!live) {
      setIncomes([...DEV_FINANCE_INCOME]);
      setExpenses([...DEV_FINANCE_EXPENSES]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubs = [
      onSnapshot(
        collection(db, 'financeIncome'),
        snap => { setIncomes(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
        err => { console.error(err); setLoadError(`Income — ${financeErrorText(err)}`); setLoading(false); }
      ),
      onSnapshot(
        collection(db, 'financeExpenses'),
        snap => { setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() }))); },
        err => { console.error(err); setLoadError(`Expenses — ${financeErrorText(err)}`); }
      ),
    ];
    return () => unsubs.forEach(u => u());
  }, [live]);

  // ── Load / seed expense categories ───────────────────────────────
  useEffect(() => {
    if (!live) {
      setCategories(defaultExpenseCategories());
      return;
    }
    let mounted = true;
    getDoc(doc(db, 'settings', SETTINGS_DOC_ID))
      .then(snap => {
        if (!mounted) return;
        if (snap.exists() && Array.isArray(snap.data().expenseCategories)) {
          setCategories(snap.data().expenseCategories);
        } else {
          // Seed the settings doc with defaults so admins can add to it later.
          setDoc(doc(db, 'settings', SETTINGS_DOC_ID), {
            expenseCategories: defaultExpenseCategories(),
            updatedAt: serverTimestamp(),
          }, { merge: true }).catch(() => {});
        }
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [live]);

  // ── Derived values ───────────────────────────────────────────────
  const byMonth = (list) => {
    const rows = month
      ? list.filter(x => (x.date || '').slice(0, 7) === month)
      : [...list];
    return rows.sort((a, b) =>
      String(b.date || '').localeCompare(String(a.date || '')) ||
      toMs(b.createdAt) - toMs(a.createdAt)
    );
  };

  const toMs = (t) => {
    if (!t) return 0;
    if (typeof t === 'object') {
      if (t.seconds) return t.seconds * 1000;
      if (t.toMillis) return t.toMillis();
    }
    return new Date(t).getTime() || 0;
  };

  const filteredIncome = useMemo(() => byMonth(incomes), [incomes, month]);
  const filteredExpenses = useMemo(() => byMonth(expenses), [expenses, month]);

  const totalIncome = filteredIncome.reduce((s, i) => s + toInt(i.amount), 0);
  const autoIncome = filteredIncome.filter(i => i.type === 'auto').reduce((s, i) => s + toInt(i.amount), 0);
  const manualIncome = filteredIncome.filter(i => i.type === 'manual').reduce((s, i) => s + toInt(i.amount), 0);
  const totalExpense = filteredExpenses.reduce((s, e) => s + toInt(e.amount), 0);
  const net = totalIncome - totalExpense;
  const marginPct = totalIncome > 0 ? Math.round((net / totalIncome) * 100) : 0;

  // Last six months, always from the full data set — the chart is the
  // context around whatever month the table is filtered to.
  const monthKeys = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
  }, []);

  const trend = useMemo(() => {
    const rows = monthKeys.map(k => {
      const inc = incomes.filter(x => (x.date || '').slice(0, 7) === k)
        .reduce((s, x) => s + toInt(x.amount), 0);
      const exp = expenses.filter(x => (x.date || '').slice(0, 7) === k)
        .reduce((s, x) => s + toInt(x.amount), 0);
      return { key: k, inc, exp };
    });
    return { rows, max: Math.max(1, ...rows.map(r => Math.max(r.inc, r.exp))) };
  }, [incomes, expenses, monthKeys]);

  const expenseByCategory = useMemo(() => {
    const map = {};
    filteredExpenses.forEach(x => {
      const k = x.category || 'Other';
      map[k] = (map[k] || 0) + toInt(x.amount);
    });
    const list = Object.entries(map).sort((a, b) => b[1] - a[1]);
    return { list, total: list.reduce((s, [, v]) => s + v, 0) };
  }, [filteredExpenses]);

  const netColor = net >= 0 ? C.green : C.red;
  const inPct = totalIncome + totalExpense > 0
    ? Math.round((totalIncome / (totalIncome + totalExpense)) * 100)
    : 50;

  // ── Helpers ──────────────────────────────────────────────────────
  const money = (n) => formatLKR(n);
  const resetIncomeForm = () => setIncomeForm({ date: todayISO(), source: '', category: '', amount: '', remark: '' });
  const resetExpenseForm = () => setExpenseForm({ date: todayISO(), category: '', item: '', quantity: '', unitPrice: '', amount: '', remark: '' });

  const ensureCategory = async (cat) => {
    const trimmed = String(cat || '').trim();
    if (!trimmed || categories.includes(trimmed)) return { ok: true };
    const next = [...categories, trimmed];
    setCategories(next);
    if (live) {
      try {
        await setDoc(doc(db, 'settings', SETTINGS_DOC_ID), {
          expenseCategories: arrayUnion(trimmed),
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } catch (e) {
        console.error('category save failed', e);
        return { ok: false, reason: financeErrorText(e) };
      }
    }
    return { ok: true };
  };

  // ── Add manual income ────────────────────────────────────────────
  const handleAddIncome = async (e) => {
    e.preventDefault();
    setFormError('');
    const amt = toInt(incomeForm.amount);
    if (!incomeForm.source.trim()) return setFormError('Source / client is required.');
    if (amt <= 0) return setFormError('Enter a valid amount greater than 0.');
    if (!incomeForm.date) return setFormError('Date is required.');

    setSaving(true);
    const payload = {
      type: 'manual',
      source: incomeForm.source.trim(),
      category: incomeForm.category.trim() || 'Other',
      status: 'Received',
      amount: amt,
      date: incomeForm.date,
      remark: incomeForm.remark.trim(),
      clientName: incomeForm.source.trim(),
      recordedBy: adminName,
      recordedByEmail: adminEmail,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      if (live) {
        await addDoc(collection(db, 'financeIncome'), payload);
      } else {
        const id = `dev-inc-${Date.now()}`;
        DEV_FINANCE_INCOME.unshift({ id, ...payload, createdAt: new Date(), updatedAt: new Date() });
        setIncomes([...DEV_FINANCE_INCOME]);
      }
      setOpenIncome(false);
      resetIncomeForm();
    } catch (err) {
      console.error(err);
      setFormError(financeErrorText(err));
    } finally {
      setSaving(false);
    }
  };

  // ── Add expense ──────────────────────────────────────────────────
  const expenseAmount = () => expenseTotal({
    quantity: toInt(expenseForm.quantity),
    unitPrice: toInt(expenseForm.unitPrice),
    amount: toInt(expenseForm.amount),
  });

  const handleAddExpense = async (e) => {
    e.preventDefault();
    setFormError('');
    const cat = expenseForm.category.trim();
    const item = expenseForm.item.trim();
    const amt = expenseAmount();
    if (!cat) return setFormError('Category is required.');
    if (!item) return setFormError('Item / description is required.');
    if (amt <= 0) return setFormError('Enter a valid amount (or quantity × unit price).');
    if (!expenseForm.date) return setFormError('Date is required.');

    setSaving(true);
    const payload = {
      category: cat,
      item,
      quantity: toInt(expenseForm.quantity) || null,
      unitPrice: toInt(expenseForm.unitPrice) || null,
      amount: amt,
      date: expenseForm.date,
      remark: expenseForm.remark.trim(),
      recordedBy: adminName,
      recordedByEmail: adminEmail,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      let catRes = { ok: true };
      if (live) {
        await addDoc(collection(db, 'financeExpenses'), payload);
        catRes = await ensureCategory(cat);
      } else {
        const id = `dev-exp-${Date.now()}`;
        DEV_FINANCE_EXPENSES.unshift({ id, ...payload, createdAt: new Date(), updatedAt: new Date() });
        setExpenses([...DEV_FINANCE_EXPENSES]);
        catRes = await ensureCategory(cat);
      }
      setSoftMsg(catRes.ok ? '' : `Expense saved. “${cat}” was not added to the shared category list — ${catRes.reason}`);
      setOpenExpense(false);
      resetExpenseForm();
    } catch (err) {
      console.error(err);
      setFormError(financeErrorText(err));
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────
  const confirmDelete = (id, type) => setDeleteItem({ id, type });
  const handleDelete = async () => {
    if (!deleteItem) return;
    const { id, type } = deleteItem;
    try {
      if (live) {
        await deleteDoc(doc(db, type === 'income' ? 'financeIncome' : 'financeExpenses', id));
      } else {
        if (type === 'income') {
          const idx = DEV_FINANCE_INCOME.findIndex(x => x.id === id);
          if (idx >= 0) DEV_FINANCE_INCOME.splice(idx, 1);
          setIncomes([...DEV_FINANCE_INCOME]);
        } else {
          const idx = DEV_FINANCE_EXPENSES.findIndex(x => x.id === id);
          if (idx >= 0) DEV_FINANCE_EXPENSES.splice(idx, 1);
          setExpenses([...DEV_FINANCE_EXPENSES]);
        }
      }
    } catch (err) {
      console.error(err);
      setFormError(financeErrorText(err));
    } finally {
      setDeleteItem(null);
    }
  };

  // ── Render helpers ───────────────────────────────────────────────
  const TabButton = ({ id, label, icon: Icon, count }) => {
    const on = tab === id;
    const accent = id === 'income' ? C.green : C.red;
    return (
      <button
        onClick={() => setTab(id)}
        style={{
          padding: '7px 14px', borderRadius: 9, fontSize: 11.5, fontWeight: 800, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6, border: '1px solid transparent',
          background: on ? `${accent}1f` : 'transparent',
          color: on ? accent : C.muted,
          boxShadow: on ? `0 0 16px ${accent}30, inset 0 0 0 1px ${accent}55` : 'none',
          transition: 'background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease',
        }}
      >
        <Icon size={13} /> {label}
        <span style={{
          fontSize: 9.5, fontWeight: 800, padding: '1px 6px', borderRadius: 20,
          background: on ? `${accent}26` : 'rgba(145,160,188,0.14)', color: on ? accent : C.muted,
        }}>{count}</span>
      </button>
    );
  };

  // Tabs + period filter + the Add button live in the records panel header,
  // so Income and Expenses read as one module instead of stacked boxes.
  const RecordsHeader = () => (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
      padding: '12px 16px', borderBottom: `1px solid ${C.border}`,
      background: 'linear-gradient(180deg, rgba(14,35,80,0.55), rgba(6,17,43,0.15))',
    }}>
      <div style={{
        display: 'inline-flex', gap: 4, padding: 4, borderRadius: 12,
        background: 'rgba(4,13,31,0.72)', border: `1px solid ${C.border}`,
      }}>
        <TabButton id="income" label="Income" icon={TrendingUp} count={filteredIncome.length} />
        <TabButton id="expenses" label="Expenses" icon={ShoppingBag} count={filteredExpenses.length} />
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 9, flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontSize: 9.5, fontWeight: 800, color: C.subtle, letterSpacing: '0.12em', marginBottom: 4 }}>
            MONTH
          </label>
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            style={{
              background: 'rgba(10,24,56,0.85)', border: `1px solid ${C.border}`, borderRadius: 9,
              padding: '7px 11px', color: C.text, fontSize: 12, fontWeight: 700, outline: 'none',
            }}
          />
        </div>
        {month && (
          <button onClick={() => setMonth('')} style={{
            padding: '8px 12px', borderRadius: 9, fontSize: 11, fontWeight: 800, cursor: 'pointer',
            background: 'rgba(0,217,255,0.08)', color: C.cyan, border: '1px solid rgba(0,217,255,0.3)',
          }}>All time</button>
        )}
        <ERPBtn
          onClick={() => tab === 'income' ? setOpenIncome(true) : setOpenExpense(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 5 }}
        >
          <Plus size={13} /> Add {tab === 'income' ? 'Income' : 'Expense'}
        </ERPBtn>
      </div>
    </div>
  );

  const HighlightMoney = ({ children, color = C.green }) => (
    <span style={{
      fontWeight: 900, color,
      textShadow: `0 0 18px ${color}33`,
      animation: 'moneyPulse 2.2s ease-in-out infinite',
    }}>
      {children}
      <style>{`@keyframes moneyPulse { 0%,100% { text-shadow: 0 0 14px ${color}22; } 50% { text-shadow: 0 0 24px ${color}55; } }`}</style>
    </span>
  );

  const TypeBadge = ({ type }) => {
    const auto = type === 'auto';
    return (
      <span style={{
        fontSize: 9.5, fontWeight: 800, padding: '2px 9px', borderRadius: 20,
        background: auto ? 'rgba(0,217,255,0.10)' : 'rgba(139,92,246,0.12)',
        color: auto ? C.cyan : C.violet,
        border: `1px solid ${auto ? 'rgba(0,217,255,0.35)' : 'rgba(139,92,246,0.35)'}`,
      }}>{auto ? 'Auto' : 'Manual'}</span>
    );
  };

  const StatusBadge = ({ status }) => {
    const cfg =
      status === 'Full Paid' ? { color: C.green, bg: 'rgba(24,199,122,0.12)', border: 'rgba(24,199,122,0.35)' }
      : status === 'Advance Paid' ? { color: C.amber, bg: 'rgba(245,185,66,0.12)', border: 'rgba(245,185,66,0.35)' }
      : status === 'Balance Paid' || status === 'Part' ? { color: C.cyan, bg: 'rgba(0,217,255,0.10)', border: 'rgba(0,217,255,0.35)' }
      : { color: C.violet, bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.35)' };
    return (
      <span style={{
        fontSize: 9.5, fontWeight: 800, padding: '2px 9px', borderRadius: 20,
        background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      }}>{status || 'Received'}</span>
    );
  };

  if (loading) {
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:16, maxWidth:1320, margin:'0 auto' }}>
        <div style={{ padding:60, textAlign:'center', color:C.muted, fontSize:13 }}>Loading finance data…</div>
      </div>
    );
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16, width:'100%', maxWidth:1320, margin:'0 auto' }}>
      {loadError && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 12,
          background: 'rgba(240,90,103,0.1)', border: '1px solid rgba(240,90,103,0.35)', color: C.red, fontSize: 12,
        }}>
          <AlertTriangle size={15} style={{ marginTop: 1, flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <span style={{ fontWeight: 800 }}>{loadError}</span>
            {loadError.includes(RULES_DEPLOY_CMD) && (
              <span style={{
                alignSelf: 'flex-start', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 11, color: C.cyan, background: 'rgba(0,217,255,0.08)',
                border: '1px solid rgba(0,217,255,0.3)', borderRadius: 6, padding: '3px 8px',
              }}>{RULES_DEPLOY_CMD}</span>
            )}
          </div>
        </div>
      )}

      {softMsg && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 11,
          background: 'rgba(245,185,66,0.1)', border: '1px solid rgba(245,185,66,0.35)', color: C.amber, fontSize: 11.5,
        }}>
          <AlertTriangle size={14} style={{ flexShrink: 0 }} /> {softMsg}
          <button onClick={() => setSoftMsg('')} style={{
            marginLeft: 'auto', background: 'transparent', border: 'none', color: C.amber,
            cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 2px',
          }}>×</button>
        </div>
      )}

      <style>{`
        /* Bars are sized directly — no scale/width animation, so a background
           tab or a slow machine can never leave a value invisible. */
        .fin-month .fin-bar { transition: box-shadow .2s ease, filter .2s ease; }
        .fin-month:hover .fin-bar { box-shadow: 0 0 18px rgba(0,217,255,0.35); filter: brightness(1.15); }
        .fin-row  { transition: background .18s ease; }
        .fin-row:hover { background: rgba(0,102,255,0.09) !important; }
      `}</style>

      {/* ── Net position hero ───────────────────────────────────────── */}
      <div style={{
        position: 'relative', overflow: 'hidden', borderRadius: 18,
        border: `1px solid ${C.border}`,
        background: 'linear-gradient(135deg, rgba(0,102,255,0.20) 0%, rgba(139,92,246,0.13) 45%, rgba(6,17,43,0.92) 100%)',
        boxShadow: '0 18px 46px rgba(0,0,0,0.45)',
      }}>
        <div style={{
          position: 'absolute', top: -90, right: -30, width: 250, height: 250, borderRadius: '50%',
          background: `radial-gradient(circle, ${netColor}55, transparent 70%)`, filter: 'blur(26px)', pointerEvents: 'none',
        }} />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: `linear-gradient(90deg, transparent, ${C.cyan}66, transparent)` }} />

        <div style={{
          position: 'relative', padding: '18px 20px', display: 'flex', gap: 22, flexWrap: 'wrap',
          alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ flex: '1 1 260px', minWidth: 250 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 26, height: 26, borderRadius: 8, display: 'inline-flex', alignItems: 'center',
                justifyContent: 'center', background: 'rgba(0,217,255,0.12)', border: '1px solid rgba(0,217,255,0.35)',
              }}>
                <Wallet size={14} style={{ color: C.cyan }} />
              </span>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.cyan }}>
                {monthLabel(month)}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 10 }}>
              <span style={{ fontSize: 30, fontWeight: 900, color: netColor, lineHeight: 1.1, textShadow: `0 0 28px ${netColor}55` }}>
                {money(net)}
              </span>
              <span style={{ fontSize: 11, fontWeight: 800, color: C.muted }}>
                {net >= 0 ? 'Net Profit' : 'Net Loss'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <FlowChip Icon={ArrowUpRight} color={C.green} value={money(totalIncome)} label="Money in" />
              <FlowChip Icon={ArrowDownRight} color={C.red} value={money(totalExpense)} label="Money out" />
              <FlowChip Icon={BarChart3} color={C.cyan} value={`${marginPct}%`} label="Margin" />
            </div>
          </div>

          <div style={{ flex: '1 1 280px', maxWidth: 380, minWidth: 260 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 800,
              textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8,
            }}>
              <span style={{ color: C.green }}>In · {money(totalIncome)}</span>
              <span style={{ color: C.red }}>Out · {money(totalExpense)}</span>
            </div>
            <div style={{
              height: 12, borderRadius: 8, overflow: 'hidden', display: 'flex',
              background: 'rgba(4,13,31,0.7)', border: `1px solid ${C.border}`,
            }}>
              {totalIncome > 0 && (
                <div className="fin-barx" style={{ width: `${Math.max(3, inPct)}%`, background: 'linear-gradient(90deg, #18C77A, #00D9FF)', boxShadow: '0 0 14px rgba(24,199,122,0.4)' }} />
              )}
              {totalExpense > 0 && (
                <div className="fin-barx" style={{ width: `${Math.max(3, 100 - inPct)}%`, background: 'linear-gradient(90deg, #F5B942, #F05A67)', boxShadow: '0 0 14px rgba(240,90,103,0.35)' }} />
              )}
            </div>
            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <MiniStat icon={RefreshCw} color={C.cyan} value={money(autoIncome)} label="Auto income" />
              <MiniStat icon={DollarSign} color={C.violet} value={money(manualIncome)} label="Manual income" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Cash-flow trend + where the money went ──────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
        <ERPPanel>
          <ERPPanelHeader
            title="Cash flow — last 6 months"
            icon={<BarChart3 size={15} style={{ color: C.cyan }} />}
            action={
              <span style={{ display: 'inline-flex', gap: 10, fontSize: 9.5, fontWeight: 800, cursor: 'default' }}>
                <span style={{ color: C.green }}>● In</span>
                <span style={{ color: C.red }}>● Out</span>
              </span>
            }
          />
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, padding: '14px 14px 12px' }}>
            {trend.rows.map(r => {
              const active = month === r.key;
              return (
                <button
                  key={r.key}
                  className="fin-month"
                  onClick={() => setMonth(active ? '' : r.key)}
                  title={`${monthLabel(r.key)} — in ${money(r.inc)} · out ${money(r.exp)}`}
                  style={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
                    cursor: 'pointer', padding: '8px 2px 6px', borderRadius: 11,
                    background: active ? 'rgba(0,102,255,0.12)' : 'transparent',
                    border: `1px solid ${active ? 'rgba(0,102,255,0.45)' : 'transparent'}`,
                    transition: 'background 0.2s ease, border-color 0.2s ease',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 88 }}>
                    <span className="fin-bar" style={{
                      width: 11, borderRadius: '5px 5px 0 0',
                      height: Math.max(r.inc ? 6 : 0, (r.inc / trend.max) * 88),
                      background: 'linear-gradient(180deg, #18C77A, rgba(24,199,122,0.25))',
                      boxShadow: '0 0 14px rgba(24,199,122,0.35)',
                    }} />
                    <span className="fin-bar" style={{
                      width: 11, borderRadius: '5px 5px 0 0',
                      height: Math.max(r.exp ? 6 : 0, (r.exp / trend.max) * 88),
                      background: 'linear-gradient(180deg, #F05A67, rgba(240,90,103,0.25))',
                      boxShadow: '0 0 14px rgba(240,90,103,0.3)',
                    }} />
                  </span>
                  <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', color: active ? C.cyan : C.muted }}>
                    {monthShort(r.key)}
                  </span>
                </button>
              );
            })}
          </div>
        </ERPPanel>

        <ERPPanel>
          <ERPPanelHeader
            title="Expenses by category"
            icon={<PieChart size={15} style={{ color: C.red }} />}
            action={<span style={{ fontSize: 10, color: C.muted }}>{monthLabel(month)}</span>}
          />
          {expenseByCategory.list.length === 0 ? (
            <div style={{ padding: '20px 18px', fontSize: 11.5, color: C.muted }}>
              No expenses in this period.
            </div>
          ) : (
            <div style={{ padding: '4px 0 8px', maxHeight: 190, overflowY: 'auto' }}>
              {expenseByCategory.list.slice(0, 8).map(([cat, val], idx) => (
                <div key={cat} style={{ padding: '8px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 5 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 900, color: C.red, whiteSpace: 'nowrap' }}>{money(val)}</span>
                  </div>
                  <div style={{ height: 7, borderRadius: 5, overflow: 'hidden', background: 'rgba(4,13,31,0.7)' }}>
                    <div className="fin-barx" style={{
                      height: '100%',
                      width: `${Math.max(4, (val / expenseByCategory.list[0][1]) * 100)}%`,
                      background: CAT_GRADIENTS[idx % CAT_GRADIENTS.length],
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </ERPPanel>
      </div>

      {/* ── Records ─────────────────────────────────────────────────── */}
      {tab === 'income' && (
        <ERPPanel>
          <RecordsHeader />
          {filteredIncome.length === 0 ? (
            <ERPEmpty
              icon={TrendingUp}
              title="No income yet"
              sub={month ? `Nothing recorded for ${monthLabel(month)}.` : 'Payment income appears here automatically; Add Income is for investments, trust and refunds.'}
              action={
                <ERPBtn onClick={() => setOpenIncome(true)}><Plus size={13} /> Add Manual Income</ERPBtn>
              }
            />
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', minWidth:780, borderCollapse:'collapse', fontSize:11.5 }}>
                <thead>
                  <tr style={{
                    background: 'linear-gradient(180deg, rgba(0,102,255,0.12), rgba(14,35,80,0.5))',
                    color: C.muted, textTransform: 'uppercase',
                    fontSize: 9.5, fontWeight: 800, letterSpacing: '0.1em',
                  }}>
                    <th style={{ padding:'9px 12px', textAlign:'left' }}>Date</th>
                    <th style={{ padding:'9px 12px', textAlign:'left' }}>Source / Client</th>
                    <th style={{ padding:'9px 12px', textAlign:'left' }}>Category</th>
                    <th style={{ padding:'9px 12px', textAlign:'right' }}>Amount</th>
                    <th style={{ padding:'9px 12px', textAlign:'center' }}>Type</th>
                    <th style={{ padding:'9px 12px', textAlign:'center' }}>Status</th>
                    <th style={{ padding:'9px 12px', textAlign:'left' }}>Remark</th>
                    <th style={{ padding:'9px 12px', textAlign:'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIncome.map((i, idx) => (
                    <tr key={i.id} className="fin-row"
                      style={{ borderTop: `1px solid ${C.border}22`, background: idx % 2 ? 'rgba(14,35,80,0.28)' : 'transparent' }}
                    >
                      <td style={{ padding:'9px 12px', color:C.text, whiteSpace:'nowrap', fontWeight:700 }}>{fmtDate(i.date)}</td>
                      <td style={{ padding:'9px 12px', color:C.text }}>
                        <div style={{ fontWeight:700 }}>{i.source || i.clientName || '—'}</div>
                        {i.clientCompany && <div style={{ fontSize:10, color:C.muted }}>{i.clientCompany}</div>}
                      </td>
                      <td style={{ padding:'9px 12px', color:C.subtle }}>{i.category || '—'}</td>
                      <td style={{ padding:'9px 12px', textAlign:'right' }}>
                        <HighlightMoney>{money(i.amount)}</HighlightMoney>
                      </td>
                      <td style={{ padding:'9px 12px', textAlign:'center' }}><TypeBadge type={i.type} /></td>
                      <td style={{ padding:'9px 12px', textAlign:'center' }}><StatusBadge status={i.status} /></td>
                      <td style={{ padding:'9px 12px', color:C.amber, maxWidth:220, wordBreak:'break-word' }}>{i.remark || '—'}</td>
                      <td style={{ padding:'9px 12px', textAlign:'center' }}>
                        <button onClick={() => confirmDelete(i.id, 'income')} title="Delete income record"
                          style={{ background:'transparent', border:'none', color:C.red, cursor:'pointer', padding:4, borderRadius:6 }}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ERPPanel>
      )}

      {tab === 'expenses' && (
        <ERPPanel>
          <RecordsHeader />
          {filteredExpenses.length === 0 ? (
            <ERPEmpty
              icon={ShoppingBag}
              title="No expenses yet"
              sub={month ? `Nothing recorded for ${monthLabel(month)}.` : 'Office and client spends go here — they move the net profit.'}
              action={
                <ERPBtn onClick={() => setOpenExpense(true)}><Plus size={13} /> Add Expense</ERPBtn>
              }
            />
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', minWidth:780, borderCollapse:'collapse', fontSize:11.5 }}>
                <thead>
                  <tr style={{
                    background: 'linear-gradient(180deg, rgba(240,90,103,0.12), rgba(14,35,80,0.5))',
                    color: C.muted, textTransform: 'uppercase',
                    fontSize: 9.5, fontWeight: 800, letterSpacing: '0.1em',
                  }}>
                    <th style={{ padding:'9px 12px', textAlign:'left' }}>Date</th>
                    <th style={{ padding:'9px 12px', textAlign:'left' }}>Category</th>
                    <th style={{ padding:'9px 12px', textAlign:'left' }}>Item</th>
                    <th style={{ padding:'9px 12px', textAlign:'center' }}>Qty</th>
                    <th style={{ padding:'9px 12px', textAlign:'right' }}>Amount</th>
                    <th style={{ padding:'9px 12px', textAlign:'left' }}>Remark</th>
                    <th style={{ padding:'9px 12px', textAlign:'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((x, idx) => (
                    <tr key={x.id} className="fin-row"
                      style={{ borderTop: `1px solid ${C.border}22`, background: idx % 2 ? 'rgba(14,35,80,0.28)' : 'transparent' }}
                    >
                      <td style={{ padding:'9px 12px', color:C.text, whiteSpace:'nowrap', fontWeight:700 }}>{fmtDate(x.date)}</td>
                      <td style={{ padding:'9px 12px' }}>
                        <span style={{
                          fontSize:10, fontWeight:800, padding:'3px 9px', borderRadius:20,
                          background:'rgba(240,90,103,0.12)', color:C.red, border:'1px solid rgba(240,90,103,0.3)',
                          whiteSpace:'nowrap',
                        }}>{x.category}</span>
                      </td>
                      <td style={{ padding:'9px 12px', color:C.subtle, wordBreak:'break-word' }}>{x.item}</td>
                      <td style={{ padding:'9px 12px', textAlign:'center', color:C.muted }}>{x.quantity || '—'}</td>
                      <td style={{ padding:'9px 12px', textAlign:'right' }}>
                        <HighlightMoney color={C.red}>{money(x.amount)}</HighlightMoney>
                      </td>
                      <td style={{ padding:'9px 12px', color:C.amber, maxWidth:260, wordBreak:'break-word' }}>{x.remark || '—'}</td>
                      <td style={{ padding:'9px 12px', textAlign:'center' }}>
                        <button onClick={() => confirmDelete(x.id, 'expense')} title="Delete expense record"
                          style={{ background:'transparent', border:'none', color:C.red, cursor:'pointer', padding:4, borderRadius:6 }}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ERPPanel>
      )}

      {/* Add Manual Income Modal */}
      {openIncome && (
        <ERPModal isOpen title="Add Manual Income" onClose={() => { setOpenIncome(false); resetIncomeForm(); setFormError(''); }} width={520}>
          <form onSubmit={handleAddIncome} style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {formError && (
              <div style={{ padding:'9px 12px', borderRadius:8, background:'rgba(240,90,103,0.1)', border:'1px solid rgba(240,90,103,0.3)', color:C.red, fontSize:12 }}>
                {formError}
              </div>
            )}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <ERPInput label="Date" type="date" required value={incomeForm.date} onChange={e => setIncomeForm(p => ({...p, date:e.target.value}))} />
              <ERPInput label="Amount (LKR)" type="number" required min={1} value={incomeForm.amount} onChange={e => setIncomeForm(p => ({...p, amount:e.target.value}))} />
            </div>
            <ERPInput label="Source / Client" placeholder="e.g. Trust investment, Refund, Client name" required value={incomeForm.source} onChange={e => setIncomeForm(p => ({...p, source:e.target.value}))} />
            <ERPSelect label="Category" value={incomeForm.category} onChange={e => setIncomeForm(p => ({...p, category:e.target.value}))} options={[{value:'',label:'Select…'}, ...INCOME_CATEGORIES.map(c => ({value:c,label:c}))]} />
            <ERPTextarea label="Remark" placeholder="Purpose / who received it" value={incomeForm.remark} onChange={e => setIncomeForm(p => ({...p, remark:e.target.value}))} />
            <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:4 }}>
              <ERPBtn type="button" variant="secondary" onClick={() => { setOpenIncome(false); resetIncomeForm(); setFormError(''); }}>Cancel</ERPBtn>
              <ERPBtn type="submit" variant="success" disabled={saving}>{saving ? 'Saving…' : 'Save Income'}</ERPBtn>
            </div>
          </form>
        </ERPModal>
      )}

      {/* Add Expense Modal */}
      {openExpense && (
        <ERPModal isOpen title="Add Expense" onClose={() => { setOpenExpense(false); resetExpenseForm(); setFormError(''); }} width={540}>
          <form onSubmit={handleAddExpense} style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {formError && (
              <div style={{ padding:'9px 12px', borderRadius:8, background:'rgba(240,90,103,0.1)', border:'1px solid rgba(240,90,103,0.3)', color:C.red, fontSize:12 }}>
                {formError}
              </div>
            )}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <ERPInput label="Date" type="date" required value={expenseForm.date} onChange={e => setExpenseForm(p => ({...p, date:e.target.value}))} />
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:600, color:C.subtle, marginBottom:6 }}>
                  Category <span style={{ color:C.red }}>*</span>
                </label>
                <input
                  list="expense-cats"
                  value={expenseForm.category}
                  onChange={e => setExpenseForm(p => ({...p, category:e.target.value}))}
                  placeholder="Type or pick a category"
                  required
                  style={{
                    width:'100%', background:'rgba(10,24,56,0.8)', border:`1px solid ${C.border}`,
                    borderRadius:10, padding:'9px 14px', color:C.text, fontSize:12, outline:'none', boxSizing:'border-box'
                  }}
                />
                <datalist id="expense-cats">
                  {categories.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
            </div>
            <ERPInput label="Item / Description" placeholder="e.g. A4 notebooks, WiFi router" required value={expenseForm.item} onChange={e => setExpenseForm(p => ({...p, item:e.target.value}))} />
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
              <ERPInput label="Quantity" type="number" min={0} value={expenseForm.quantity} onChange={e => setExpenseForm(p => ({...p, quantity:e.target.value}))} />
              <ERPInput label="Unit Price (LKR)" type="number" min={0} value={expenseForm.unitPrice} onChange={e => setExpenseForm(p => ({...p, unitPrice:e.target.value}))} />
              <ERPInput label="Amount (LKR)" type="number" min={1} required value={expenseAmount() || expenseForm.amount} onChange={e => setExpenseForm(p => ({...p, amount:e.target.value, quantity:'', unitPrice:''}))} />
            </div>
            {expenseAmount() > 0 && (
              <div style={{ fontSize:11, color:C.cyan, fontWeight:700 }}>
                Total amount to save: <HighlightMoney color={C.red}>{money(expenseAmount())}</HighlightMoney>
              </div>
            )}
            <ERPTextarea label="Remark" placeholder="Who used it / purpose" value={expenseForm.remark} onChange={e => setExpenseForm(p => ({...p, remark:e.target.value}))} />
            <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:4 }}>
              <ERPBtn type="button" variant="secondary" onClick={() => { setOpenExpense(false); resetExpenseForm(); setFormError(''); }}>Cancel</ERPBtn>
              <ERPBtn type="submit" variant="danger" disabled={saving}>{saving ? 'Saving…' : 'Save Expense'}</ERPBtn>
            </div>
          </form>
        </ERPModal>
      )}

      {/* Delete confirm */}
      {deleteItem && (
        <ERPModal isOpen title="Delete finance record?" onClose={() => setDeleteItem(null)} width={420}>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:8, background:'rgba(240,90,103,0.1)', border:'1px solid rgba(240,90,103,0.3)', color:C.red, fontSize:12 }}>
              <AlertTriangle size={16} /> This permanently removes the {deleteItem.type} record.
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
              <ERPBtn variant="secondary" onClick={() => setDeleteItem(null)}>Cancel</ERPBtn>
              <ERPBtn variant="danger" onClick={handleDelete}>Delete</ERPBtn>
            </div>
          </div>
        </ERPModal>
      )}
    </div>
  );
}
