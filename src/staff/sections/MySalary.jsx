// ─────────────────────────────────────────────────────────────────
//  Phase 3 F — Staff portal: Salary + Payslips (staff side).
//  variant="salary"   → salary structure (from the staff profile)
//                       + a simple payment history.
//  variant="payslips" → full payslip list with the printable
//                       PayslipDoc (SMART letterhead) preview.
//  Every query is scoped where('authUid','==',uid) — the security
//  rules make cross-staff reads impossible even if IDs are tampered.
// ─────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  C, ERPPanel, ERPPanelHeader, ERPBtn, ERPModal, ERPEmpty,
} from '../../erp/components/ERPui';
import PayslipDoc from '../PayslipDoc';
import { computeNet, monthLabel } from '../staffUtils';
import { formatLKR, fmtDate } from '../../erp/money';
import {
  Wallet, ArrowUpCircle, ArrowDownCircle, Receipt, Eye,
  Printer, Info, AlertCircle,
} from 'lucide-react';

// Dev-mode fixtures (never written to the DB).
const DEV_PAYMENTS = [
  { id: 'dp1', payslipNo: 'PS-DEV-0001', month: '2026-08', basicSalary: 120000, allowances: 10000, deductions: 8000, net: 122000, paidOn: '2026-08-28', method: 'Bank Transfer', reference: 'TRX-88231' },
  { id: 'dp2', payslipNo: 'PS-DEV-0002', month: '2026-09', basicSalary: 120000, allowances: 10000, deductions: 8000, net: 122000, paidOn: '2026-09-28', method: 'Bank Transfer', reference: 'TRX-90112' },
];

// ═════════════════════════════════════════════════════════════════
export default function MySalary({ variant = 'salary' }) {
  const { staffProfile, isDevSession } = useAuth();
  const live = isFirebaseConfigured && !isDevSession;
  const uid = staffProfile?.id;

  const [payments, setPayments] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState('');
  const [preview, setPreview]   = useState(null);

  useEffect(() => {
    if (!live || !uid) {
      setPayments(DEV_PAYMENTS);
      setLoading(false);
      return;
    }
    const un = onSnapshot(
      query(collection(db, 'salaryPayments'), where('authUid', '==', uid)),
      s => {
        setPayments(
          s.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => String(b.month || '').localeCompare(String(a.month || '')))
        );
        setLoading(false);
      },
      () => { setErr('Could not load your salary data. Please try again later.'); setLoading(false); },
    );
    return () => un();
  }, [live, uid]);

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: C.muted, fontSize: 13 }}>Loading salary…</div>;
  }

  const basic      = staffProfile?.basicSalary || 0;
  const allowances = staffProfile?.allowances || 0;
  const deductions = staffProfile?.deductions || 0;
  const net        = computeNet(basic, allowances, deductions);

  const isSalaryView   = variant === 'salary';
  const interactive    = variant === 'payslips';

  const StructureRow = ({ icon: Icon, label, value, color }) => (
    <div style={{
      display: 'flex', gap: 10, alignItems: 'center',
      padding: '12px 14px', borderRadius: 12, background: C.bg, border: `1px solid ${C.border}`,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 9, flexShrink: 0,
        background: `${color}1F`, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={15} color={color} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.text, marginTop: 1 }}>{formatLKR(value)}</div>
      </div>
    </div>
  );

  const PaymentsTable = () => (
    payments.length === 0 ? (
      <ERPEmpty
        icon={Receipt}
        title="No payslips yet"
        sub="Payslips appear here after your administrator records a monthly salary payment."
      />
    ) : (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
          <thead>
            <tr>
              {['Payslip', 'Month', 'Paid On', 'Net Pay', 'Method', ...(interactive ? [''] : [])].map((h, i) => (
                <th key={i} style={{
                  textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5,
                  color: C.muted, padding: '8px 10px', borderBottom: `1px solid ${C.border}`, fontWeight: 800,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payments.map(p => (
              <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: '10px', fontSize: 12, fontWeight: 700, color: C.text, whiteSpace: 'nowrap' }}>
                  {p.payslipNo || '—'}
                </td>
                <td style={{ padding: '10px', fontSize: 12, color: C.text, whiteSpace: 'nowrap' }}>{monthLabel(p.month)}</td>
                <td style={{ padding: '10px', fontSize: 12, color: C.text, whiteSpace: 'nowrap' }}>{fmtDate(p.paidOn)}</td>
                <td style={{ padding: '10px', fontSize: 12.5, fontWeight: 800, color: C.green, whiteSpace: 'nowrap' }}>
                  {formatLKR(p.net)}
                </td>
                <td style={{ padding: '10px', fontSize: 12, color: C.muted, whiteSpace: 'nowrap' }}>{p.method || '—'}</td>
                {interactive && (
                  <td style={{ padding: '10px', textAlign: 'right' }}>
                    <ERPBtn variant="ghost" onClick={() => setPreview(p)}>
                      <Eye size={13} /> View
                    </ERPBtn>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {!live && (
        <div style={{
          display: 'flex', gap: 8, alignItems: 'center', padding: '9px 12px', borderRadius: 10,
          background: 'rgba(245,185,66,0.1)', border: '1px solid rgba(245,185,66,0.35)',
          color: C.amber, fontSize: 11.5,
        }}>
          <Info size={14} style={{ flexShrink: 0 }} /> Dev session — showing sample data. Live payslips come from the admin's salary records.
        </div>
      )}

      {err && (
        <div style={{
          display: 'flex', gap: 8, alignItems: 'flex-start', padding: '9px 12px', borderRadius: 10,
          background: 'rgba(240,90,103,0.1)', border: '1px solid rgba(240,90,103,0.35)',
          color: C.red, fontSize: 11.5,
        }}>
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {err}
        </div>
      )}

      {/* Salary structure — the Salary menu item */}
      {isSalaryView && (
        <ERPPanel>
          <ERPPanelHeader title="My salary structure" icon={Wallet} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            <StructureRow icon={ArrowUpCircle}   label="Basic Salary" value={basic}      color="#4D94FF" />
            <StructureRow icon={ArrowUpCircle}   label="Allowances"   value={allowances}  color="#2FD98F" />
            <StructureRow icon={ArrowDownCircle} label="Deductions"   value={deductions}  color="#F05A67" />
          </div>
          <div style={{
            marginTop: 12, padding: '14px 16px', borderRadius: 12,
            background: 'rgba(24,199,122,0.1)', border: '1px solid rgba(24,199,122,0.35)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: C.green, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Monthly Net Pay
            </span>
            <span style={{ fontSize: 17, fontWeight: 900, color: C.green }}>{formatLKR(net)}</span>
          </div>
        </ERPPanel>
      )}

      {/* Payment history / payslip list */}
      <ERPPanel>
        <ERPPanelHeader
          title={interactive ? 'My payslips' : 'Payment history'}
          icon={Receipt}
          action={interactive && payments.length > 0 ? (
            <span style={{ fontSize: 11, color: C.muted }}>{payments.length} payslip{payments.length === 1 ? '' : 's'}</span>
          ) : null}
        />
        <PaymentsTable />
      </ERPPanel>

      {/* Printable payslip (SMART letterhead) */}
      <ERPModal
        isOpen={!!preview}
        onClose={() => setPreview(null)}
        title={preview?.payslipNo ? `Payslip ${preview.payslipNo}` : 'Payslip'}
        width={760}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          <ERPBtn variant="primary" onClick={() => window.print()}>
            <Printer size={13} /> Print / Save PDF
          </ERPBtn>
        </div>
        {preview && <PayslipDoc payment={preview} />}
      </ERPModal>
    </div>
  );
}
