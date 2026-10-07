// ─────────────────────────────────────────────────────────────────
//  PayslipDoc — SMART letterhead payslip shared by the admin Salary
//  page and the staff portal. Rendered inside a modal; "Print" uses
//  the same visibility-isolation print trick as payment receipts in
//  ERPQuotations, so "Save as PDF" from the browser dialog works too.
// ─────────────────────────────────────────────────────────────────
import React from 'react';
import { company } from '../config/company';
import { formatLKR } from '../erp/money';
import { monthLabel } from './staffUtils';

export default function PayslipDoc({ payment }) {
  const p = payment || {};
  const gross = (Number(p.basicSalary) || 0) + (Number(p.allowances) || 0);

  return (
    <div className="payslip-print" style={{
      background: '#fff', color: '#16233D', borderRadius: 10,
      padding: '30px 34px', fontFamily: 'Arial, Helvetica, sans-serif',
    }}>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .payslip-print, .payslip-print * { visibility: visible !important; }
          .payslip-print { position: fixed; left: 0; top: 0; width: 100%; background: #fff; }
        }
      `}</style>

      {/* Letterhead */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, borderBottom: '3px solid #0066FF', paddingBottom: 14 }}>
        <img src={company.logos.lightMode} alt="SMART" style={{ height: 52, objectFit: 'contain' }}
          onError={e => { e.currentTarget.style.display = 'none'; }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#0B1F44' }}>{company.fullName}</div>
          <div style={{ fontSize: 11, color: '#5A6B8C' }}>{company.positioning}</div>
          <div style={{ fontSize: 10, color: '#5A6B8C', marginTop: 2 }}>{company.contact.address}</div>
          <div style={{ fontSize: 10, color: '#5A6B8C' }}>{company.contact.phone} · {company.contact.email}</div>
        </div>
      </div>

      <div style={{ textAlign: 'center', margin: '18px 0 6px' }}>
        <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: 3, color: '#0B1F44' }}>PAYSLIP</div>
        <div style={{ fontSize: 12, color: '#5A6B8C' }}>{monthLabel(p.month)}{p.payslipNo ? `  ·  ${p.payslipNo}` : ''}</div>
      </div>

      {/* Employee block */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px', margin: '14px 0 18px' }}>
        {[
          ['Employee', p.staffName || '—'],
          ['Staff ID', p.staffId || '—'],
          ['Designation', p.staffRole || '—'],
          ['Payment Date', p.paidOn || '—'],
        ].map(([l, v]) => (
          <div key={l} style={{ display: 'flex', gap: 6, fontSize: 12 }}>
            <span style={{ color: '#5A6B8C', minWidth: 100 }}>{l}</span>
            <span style={{ fontWeight: 700 }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Earnings & deductions */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            {['Earnings', 'Amount', 'Deductions', 'Amount'].map(h => (
              <th key={h} style={{ textAlign: 'left', background: '#0B1F44', color: '#fff', padding: '8px 12px', fontWeight: 700 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ border: '1px solid #D7DFEE', padding: '8px 12px' }}>Basic Salary</td>
            <td style={{ border: '1px solid #D7DFEE', padding: '8px 12px' }}>{formatLKR(p.basicSalary)}</td>
            <td style={{ border: '1px solid #D7DFEE', padding: '8px 12px' }}>Total Deductions</td>
            <td style={{ border: '1px solid #D7DFEE', padding: '8px 12px' }}>{formatLKR(p.deductions)}</td>
          </tr>
          <tr>
            <td style={{ border: '1px solid #D7DFEE', padding: '8px 12px' }}>Allowances</td>
            <td style={{ border: '1px solid #D7DFEE', padding: '8px 12px' }}>{formatLKR(p.allowances)}</td>
            <td style={{ border: '1px solid #D7DFEE' }} />
            <td style={{ border: '1px solid #D7DFEE' }} />
          </tr>
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
        <div style={{ minWidth: 280, fontSize: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
            <span style={{ color: '#5A6B8C' }}>Gross Salary</span>
            <span style={{ fontWeight: 700 }}>{formatLKR(gross)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
            <span style={{ color: '#5A6B8C' }}>Total Deductions</span>
            <span style={{ fontWeight: 700 }}>- {formatLKR(p.deductions)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', marginTop: 6, background: '#E8F1FF', borderRadius: 6, fontSize: 14 }}>
            <span style={{ fontWeight: 900, color: '#0B1F44' }}>NET PAY</span>
            <span style={{ fontWeight: 900, color: '#0B1F44' }}>{formatLKR(p.net)}</span>
          </div>
        </div>
      </div>

      {/* Payment meta */}
      <div style={{ marginTop: 16, fontSize: 11, color: '#5A6B8C' }}>
        Paid via <strong style={{ color: '#16233D' }}>{p.method || '—'}</strong>
        {p.reference ? <> · Ref: <strong style={{ color: '#16233D' }}>{p.reference}</strong></> : null}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 42, fontSize: 11, color: '#5A6B8C' }}>
        <span>Generated by SMART ERP — {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        <span style={{ borderTop: '1px solid #16233D', paddingTop: 4, paddingLeft: 40 }}>Authorised Signatory</span>
      </div>
    </div>
  );
}
