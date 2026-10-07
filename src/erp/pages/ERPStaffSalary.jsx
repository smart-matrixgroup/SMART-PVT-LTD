// ─────────────────────────────────────────────────────────────────
//  Phase 3 F — Salary & Payslips (admin side).
//  Record the monthly salary payment per staff member (month, amount,
//  date, method, reference) and issue a SMART-letterhead payslip.
//  Staff see ONLY their own payslips in the portal — enforced by
//  Firestore rules, not just the UI.
// ─────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, query, where, limit, getDocs } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { ERPPanel, ERPPanelHeader, ERPBadge, ERPBtn, ERPModal, ERPInput, ERPSelect, ERPEmpty, ERPAvatar, C } from '../components/ERPui';
import { nextNumber, thisMonthKey, monthLabel, computeNet } from '../../staff/staffUtils';
import PayslipDoc from '../../staff/PayslipDoc';
import { toInt, formatLKR, fmtDate, todayISO } from '../money';
import { Plus, FileText, Trash2, AlertTriangle } from 'lucide-react';

const AVATAR_COLORS = ['#0066FF', '#8B5CF6', '#18C77A', '#F5B942', '#F05A67', '#00D9FF'];
const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Cheque', 'Card', 'Online'];

const DEV_STAFF = [
  { id: 'dev-staff-001', staffId: 'STF-2026-0001', name: 'Ashan Perera', role: 'Full Stack Developer', basicSalary: 120000, allowances: 10000, deductions: 8000 },
  { id: 'dev-staff-002', staffId: 'STF-2026-0002', name: 'Nimali Silva', role: 'UI/UX Designer', basicSalary: 95000, allowances: 5000, deductions: 5000 },
];
const DEV_PAYMENTS = [
  { id: 'sp1', payslipNo: 'PS-2026-0001', staffId: 'dev-staff-001', staffName: 'Ashan Perera', staffRole: 'Full Stack Developer',
    month: thisMonthKey(), basicSalary: 120000, allowances: 10000, deductions: 8000, net: 122000,
    paidOn: todayISO(), method: 'Bank Transfer', reference: 'FT-88213', authUid: 'dev-staff-001' },
];

const EMPTY_FORM = { staffId: '', month: '', amount: '', paidOn: '', method: 'Bank Transfer', reference: '' };

export default function ERPStaffSalary() {
  const { isFirebaseConfigured, isDevSession } = useAuth();
  const live = isFirebaseConfigured && !isDevSession;

  const [payments, setPayments] = useState([]);
  const [staff,    setStaff]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [monthF,   setMonthF]   = useState(thisMonthKey());
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [slipTarget, setSlipTarget] = useState(null);
  const [delTarget,  setDelTarget]  = useState(null);
  const [busy,       setBusy]       = useState(false);

  useEffect(() => {
    if (!live) { setPayments(DEV_PAYMENTS); setStaff(DEV_STAFF); setLoading(false); return; }
    const unsubs = [
      onSnapshot(collection(db, 'salaryPayments'),
        snap => { setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
        err => { console.error(err); setLoadError(`Salary payments — ${err.message}`); setLoading(false); }),
      onSnapshot(collection(db, 'staff'),
        snap => setStaff(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.deleted)),
        err => console.error(err)),
    ];
    return () => unsubs.forEach(u => u());
  }, [live]);

  const monthPayments = payments
    .filter(p => !monthF || p.month === monthF)
    .sort((a, b) => String(a.staffName || '').localeCompare(String(b.staffName || '')));

  const paidThisMonth = monthPayments.reduce((s, p) => s + toInt(p.net), 0);
  const staffNet = s => computeNet(s.basicSalary, s.allowances, s.deductions);
  const unpaidThisMonth = staff.filter(s => !monthPayments.some(p => p.staffId === s.id));

  const openCreate = () => {
    setForm({ staffId: '', month: monthF, amount: '', paidOn: todayISO(), method: 'Bank Transfer', reference: '' });
    setFormError(null); setShowForm(true);
  };

  const pickStaff = id => {
    const s = staff.find(x => x.id === id);
    setForm(p => ({ ...p, staffId: id, amount: s ? String(staffNet(s)) : p.amount }));
  };

  const handleSave = async () => {
    const member = staff.find(s => s.id === form.staffId);
    if (!member || !form.month || !form.amount) return;
    setBusy(true); setFormError(null);
    try {
      // one payment per staff per month
      if (live) {
        const dup = await getDocs(query(collection(db, 'salaryPayments'),
          where('staffId', '==', member.id), where('month', '==', form.month), limit(1)));
        if (!dup.empty) { setFormError(`${member.name} already has a payslip for ${monthLabel(form.month)}.`); return; }
      }
      const payslipNo = live ? await nextNumber('payslips', 'PS') : `PS-DEV-${Date.now()}`;
      const payload = {
        payslipNo,
        staffId: member.id, staffName: member.name, staffRole: member.role || '',
        authUid: member.authUid || member.id,
        month: form.month,
        basicSalary: toInt(member.basicSalary), allowances: toInt(member.allowances), deductions: toInt(member.deductions),
        net: toInt(form.amount),
        paidOn: form.paidOn, method: form.method, reference: form.reference.trim(),
        createdAt: serverTimestamp(),
      };
      if (!live) setPayments(p => [{ id: `dev-${Date.now()}`, ...payload }, ...p]);
      else await addDoc(collection(db, 'salaryPayments'), payload);
      setShowForm(false);
    } catch (e) { console.error(e); setFormError(e.message || 'Save failed.'); }
    finally { setBusy(false); }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      if (!live) setPayments(p => p.filter(x => x.id !== delTarget.id));
      else await deleteDoc(doc(db, 'salaryPayments', delTarget.id));
      setDelTarget(null);
    } catch (e) { console.error(e); }
    finally { setBusy(false); }
  };

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: C.muted, fontSize: 13 }}>Loading salary data…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {loadError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10,
          background: 'rgba(240,90,103,0.1)', border: '1px solid rgba(240,90,103,0.35)', color: C.red, fontSize: 12 }}>
          <AlertTriangle size={14} /> {loadError}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12 }}>
        {[
          { label: `Paid — ${monthLabel(monthF)}`, val: formatLKR(paidThisMonth), color: C.green, icon: '💰' },
          { label: 'Payslips This Month', val: monthPayments.length, color: C.cyan, icon: '🧾' },
          { label: 'Awaiting Payment', val: unpaidThisMonth.length, color: C.amber, icon: '⏳' },
        ].map(s => (
          <div key={s.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 18px' }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 11, color: C.muted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Month filter + create */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ width: 190 }}>
          <ERPInput label="Month" value={monthF} type="month" onChange={e => setMonthF(e.target.value)} />
        </div>
        <ERPBtn variant="primary" onClick={openCreate} style={{ marginLeft: 'auto' }}>
          <Plus size={13} /> Record Salary Payment
        </ERPBtn>
      </div>

      {/* Payments table */}
      <ERPPanel>
        <ERPPanelHeader title={`Payslips — ${monthLabel(monthF)}`} icon="💰" />
        {monthPayments.length === 0 ? (
          <ERPEmpty icon="💰" title="No payments recorded for this month"
            sub="Record a monthly salary payment to generate a numbered payslip staff can download."
            action={<ERPBtn variant="primary" onClick={openCreate}><Plus size={12} /> Record Payment</ERPBtn>} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Payslip #', 'Staff', 'Month', 'Net Paid', 'Paid On', 'Method', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.8px', color: C.muted, textAlign: 'left', background: 'rgba(10,24,56,0.5)',
                      borderBottom: `1px solid ${C.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthPayments.map((p, i) => (
                  <tr key={p.id}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,102,255,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.cyan, fontFamily: 'monospace' }}>{p.payslipNo}</span>
                    </td>
                    <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ERPAvatar name={p.staffName} color={AVATAR_COLORS[i % AVATAR_COLORS.length]} size={24} />
                        <div>
                          <div style={{ fontSize: 12, color: C.subtle, fontWeight: 600 }}>{p.staffName}</div>
                          <div style={{ fontSize: 10, color: C.muted }}>{p.staffRole}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }}>
                      <span style={{ fontSize: 11, color: C.muted }}>{monthLabel(p.month)}</span>
                    </td>
                    <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: C.green }}>{formatLKR(p.net)}</span>
                    </td>
                    <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }}>
                      <span style={{ fontSize: 11, color: C.muted }}>{fmtDate(p.paidOn)}</span>
                    </td>
                    <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }}>
                      <span style={{ fontSize: 11, color: C.subtle }}>{p.method}{p.reference ? ` · ${p.reference}` : ''}</span>
                    </td>
                    <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <ERPBtn size="sm" variant="primary" onClick={() => setSlipTarget(p)}><FileText size={12} /> Payslip</ERPBtn>
                        <ERPBtn size="sm" variant="danger" onClick={() => setDelTarget(p)}><Trash2 size={12} /></ERPBtn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ERPPanel>

      {/* Record payment modal */}
      <ERPModal isOpen={showForm} onClose={() => setShowForm(false)} title="Record Salary Payment" width={500}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          <ERPSelect label="Staff" value={form.staffId} required
            onChange={e => pickStaff(e.target.value)}
            placeholder="Select staff..."
            options={staff.map(s => ({ value: s.id, label: `${s.name} — net ${formatLKR(staffNet(s))}` }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <ERPInput label="Salary Month" value={form.month} type="month" required
              onChange={e => setForm(p => ({ ...p, month: e.target.value }))} />
            <ERPInput label="Amount (LKR)" value={form.amount} type="number" required
              onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <ERPInput label="Payment Date" value={form.paidOn} type="date"
              onChange={e => setForm(p => ({ ...p, paidOn: e.target.value }))} />
            <ERPSelect label="Method" value={form.method}
              onChange={e => setForm(p => ({ ...p, method: e.target.value }))} options={PAYMENT_METHODS} />
          </div>
          <ERPInput label="Reference (cheque no / bank ref)" value={form.reference}
            onChange={e => setForm(p => ({ ...p, reference: e.target.value }))} placeholder="optional" />
          {formError && (
            <div style={{ fontSize: 11, color: C.red, padding: '8px 12px', borderRadius: 8, background: 'rgba(240,90,103,0.1)', border: '1px solid rgba(240,90,103,0.3)' }}>
              {formError}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <ERPBtn variant="secondary" onClick={() => setShowForm(false)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</ERPBtn>
            <ERPBtn variant="primary" disabled={busy || !form.staffId || !form.month || !form.amount}
              onClick={handleSave} style={{ flex: 1, justifyContent: 'center' }}>
              <FileText size={13} /> Save + Generate Payslip
            </ERPBtn>
          </div>
        </div>
      </ERPModal>

      {/* Payslip preview */}
      <ERPModal isOpen={!!slipTarget} onClose={() => setSlipTarget(null)} title="Payslip" width={720}>
        {slipTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <PayslipDoc payment={slipTarget} />
            <ERPBtn variant="primary" onClick={() => window.print()} style={{ justifyContent: 'center' }}>
              <FileText size={13} /> Print / Save PDF
            </ERPBtn>
          </div>
        )}
      </ERPModal>

      {/* Delete confirm */}
      <ERPModal isOpen={!!delTarget} onClose={() => setDelTarget(null)} title="Delete Payslip" width={400}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', textAlign: 'center' }}>
          <div style={{ fontSize: 34 }}>🗑️</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
              Delete {delTarget?.payslipNo}?
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
              {delTarget?.staffName} · {monthLabel(delTarget?.month)} · {formatLKR(delTarget?.net)}. The staff member will no longer see this payslip.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
            <ERPBtn variant="secondary" onClick={() => setDelTarget(null)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</ERPBtn>
            <ERPBtn variant="danger" disabled={busy} onClick={handleDelete} style={{ flex: 1, justifyContent: 'center' }}>Delete</ERPBtn>
          </div>
        </div>
      </ERPModal>
    </div>
  );
}
