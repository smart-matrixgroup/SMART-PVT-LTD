import React, { useState, useEffect } from 'react';
import {
  collection, query, onSnapshot, addDoc, updateDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { ERPPanel, ERPPanelHeader, ERPBadge, ERPBtn, ERPModal, ERPInput, ERPSelect, ERPEmpty, ERPAvatar, C } from '../components/ERPui';
import PrivateFileLink from '../components/PrivateFileLink';
import { Plus, CheckCircle2, FileText, ExternalLink, ReceiptText, XCircle } from 'lucide-react';

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

const money = n => `LKR ${Number(n || 0).toLocaleString()}`;
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

export default function ERPInvoices() {
  const { isDevSession } = useAuth();
  const live = isFirebaseConfigured && !isDevSession;

  const [invoices, setInvoices] = useState(live ? [] : DEV_INVOICES);
  const [clients, setClients] = useState(live ? [] : DEV_CLIENTS);
  const [proofs, setProofs] = useState([]);
  const [filter, setFilter] = useState('All');
  const [showCreate, setShowCreate] = useState(false);
  const [markPaidId, setMarkPaidId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const [form, setForm] = useState({ clientId: '', description: '', milestone: '', amount: '', issuedAt: '' });

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

    return () => { unInv(); unClients(); unProofs(); };
  }, [live]);

  const filtered = filter === 'All' ? invoices : invoices.filter(i => i.status === filter);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + amountOf(i), 0);
  const totalPending = invoices.filter(i => i.status === 'pending').reduce((s, i) => s + amountOf(i), 0);
  const newProofs = proofs.filter(p => p.status !== 'Verified' && p.status !== 'Rejected').length;

  const nextInvoiceNo = () => {
    const year = new Date().getFullYear();
    const nums = invoices
      .map(i => String(i.invoiceNo || '').match(/INV-(\d{4})-(\d+)/))
      .filter(Boolean)
      .filter(m => Number(m[1]) === year)
      .map(m => Number(m[2]));
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return `INV-${year}-${String(next).padStart(3, '0')}`;
  };

  const handleCreate = async () => {
    if (!form.clientId || !form.description.trim() || !form.amount) return;
    const client = clients.find(c => c.id === form.clientId);
    const payload = {
      invoiceNo: nextInvoiceNo(),
      clientId: form.clientId,
      clientName: client?.name || 'Client',
      clientCompany: client?.company || '',
      clientEmail: client?.loginEmail || client?.email || '',
      description: form.description.trim(),
      milestone: form.milestone || '',
      amountValue: Number(form.amount) || 0,
      amount: money(form.amount),
      status: 'pending',
      issuedAt: form.issuedAt || new Date().toISOString().slice(0, 10),
      paidAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (!live) {
      setInvoices(p => [{ id: `dev-${Date.now()}`, ...payload }, ...p]);
      setShowCreate(false);
      setForm({ clientId: '', description: '', milestone: '', amount: '', issuedAt: '' });
      return;
    }
    setBusy(true);
    try {
      await addDoc(collection(db, 'invoices'), payload);
      setNotice({ kind: 'ok', msg: `${payload.invoiceNo} created — visible in the client's portal Invoices tab.` });
      setShowCreate(false);
      setForm({ clientId: '', description: '', milestone: '', amount: '', issuedAt: '' });
    } catch (e) {
      console.error(e);
      setNotice({ kind: 'error', msg: e.message || 'Could not create the invoice.' });
    } finally {
      setBusy(false);
    }
  };

  const handleMarkPaid = async inv => {
    if (!inv) return;
    if (live) {
      setBusy(true);
      try {
        await updateDoc(doc(db, 'invoices', inv.id), {
          status: 'paid',
          paidAt: new Date().toISOString().slice(0, 10),
          updatedAt: serverTimestamp(),
        });
        setNotice({ kind: 'ok', msg: `${inv.invoiceNo || inv.id} marked as paid.` });
      } catch (e) {
        console.error(e);
        setNotice({ kind: 'error', msg: e.message || 'Could not update the invoice.' });
      } finally {
        setBusy(false);
      }
    } else {
      setInvoices(p => p.map(i => i.id === inv.id ? { ...i, status: 'paid', paidAt: new Date().toISOString().slice(0, 10) } : i));
    }
    setMarkPaidId(null);
  };

  const handleProofReview = async (proof, status) => {
    if (!live) {
      setProofs(p => p.map(x => x.id === proof.id ? { ...x, status } : x));
      return;
    }
    setBusy(true);
    try {
      await updateDoc(doc(db, 'paymentProofs', proof.id), {
        status,
        reviewedAt: serverTimestamp(),
      });
      setNotice({ kind: 'ok', msg: `${proof.fileName || 'Receipt'} ${status.toLowerCase()} — the client sees this update instantly.` });
    } catch (e) {
      console.error(e);
      setNotice({ kind: 'error', msg: e.message || 'Could not update the receipt.' });
    } finally {
      setBusy(false);
    }
  };

  const pendingInvoice = invoices.find(i => i.id === markPaidId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'Total Paid', val: money(totalPaid), color: C.green, icon: '✅' },
          { label: 'Total Pending', val: money(totalPending), color: C.amber, icon: '⏳' },
          { label: 'Total Invoices', val: invoices.length, color: C.cyan, icon: '🧾' },
          { label: 'Client Receipts', val: `${proofs.length}${newProofs ? ` · ${newProofs} new` : ''}`, color: C.violet, icon: '📎' },
        ].map(s => (
          <div key={s.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 18px', backdropFilter: 'blur(12px)' }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{s.label}</div>
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
                    </td>
                    <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }}>
                      {inv.status === 'pending' && (
                        <ERPBtn size="sm" variant="success" onClick={() => setMarkPaidId(inv.id)}>
                          <CheckCircle2 size={11} /> Mark Paid
                        </ERPBtn>
                      )}
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
                    <ERPBtn size="sm" variant="success" disabled={busy} onClick={() => handleProofReview(p, 'Verified')}>
                      <CheckCircle2 size={11} /> Accept
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
      <ERPModal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Invoice" width={480}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <ERPSelect label="Client" value={form.clientId} onChange={e => setForm(p => ({ ...p, clientId: e.target.value }))}
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
          <div style={{ display: 'flex', gap: 10 }}>
            <ERPBtn variant="secondary" onClick={() => setShowCreate(false)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</ERPBtn>
            <ERPBtn variant="primary" onClick={handleCreate} disabled={busy || !form.clientId || !form.description.trim() || !form.amount} style={{ flex: 1, justifyContent: 'center' }}>
              <FileText size={13} /> Create Invoice
            </ERPBtn>
          </div>
        </div>
      </ERPModal>

      {/* Confirm mark paid */}
      <ERPModal isOpen={!!markPaidId} onClose={() => setMarkPaidId(null)} title="Confirm Payment" width={380}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', textAlign: 'center' }}>
          <div style={{ fontSize: 36 }}>💰</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Mark {pendingInvoice?.invoiceNo || 'invoice'} as Paid?</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>This will update the invoice status to Paid with today's date.</div>
          </div>
          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
            <ERPBtn variant="secondary" onClick={() => setMarkPaidId(null)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</ERPBtn>
            <ERPBtn variant="success" disabled={busy} onClick={() => handleMarkPaid(pendingInvoice)} style={{ flex: 1, justifyContent: 'center' }}>
              <CheckCircle2 size={13} /> Confirm Paid
            </ERPBtn>
          </div>
        </div>
      </ERPModal>
    </div>
  );
}
