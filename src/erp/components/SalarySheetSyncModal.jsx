// ─────────────────────────────────────────────────────────────────
//  SMART ERP — Salary Sheet Sync & Import Modal
//  Allows importing salary payments from Google Sheets / Excel,
//  or 1-click seeding official historical salaries for the 7 staff.
// ─────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { collection, addDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { ERPModal, ERPBtn, C } from './ERPui';
import { nextNumber, thisMonthKey, monthLabel } from '../../staff/staffUtils';
import { formatLKR, toInt, todayISO } from '../money';
import { OFFICIAL_STAFF_MEMBERS } from '../data/officialAttendance.js';
import { UploadCloud, CheckCircle, AlertTriangle, Sparkles, RefreshCw, Table } from 'lucide-react';

// Recommended standard salary structure for official staff
const OFFICIAL_DEFAULT_SALARIES = {
  'stf-asra': { basic: 70000, allowances: 5000, deductions: 0, net: 75000 },
  'stf-a-sathurshika': { basic: 75000, allowances: 5000, deductions: 0, net: 80000 },
  'stf-lukshika': { basic: 60000, allowances: 5000, deductions: 0, net: 65000 },
  'stf-thishalini': { basic: 55000, allowances: 5000, deductions: 0, net: 60000 },
  'stf-ameen-isath': { basic: 55000, allowances: 5000, deductions: 0, net: 60000 },
  'stf-n-kavitharan': { basic: 50000, allowances: 5000, deductions: 0, net: 55000 },
  'stf-a-pirashalini': { basic: 70000, allowances: 5000, deductions: 0, net: 75000 },
};

export default function SalarySheetSyncModal({ isOpen, onClose, staff = [], live = false, onImported }) {
  const [tab, setTab] = useState('paste'); // 'paste' | 'official'
  const [pastedText, setPastedText] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [selectedOfficialRows, setSelectedOfficialRows] = useState({
    'stf-asra-2026-09': true,
    'stf-asra-2026-10': true,
    'stf-a-sathurshika-2026-09': true,
    'stf-a-sathurshika-2026-10': true,
    'stf-lukshika-2026-10': true,
    'stf-thishalini-2026-10': true,
    'stf-ameen-isath-2026-10': true,
    'stf-n-kavitharan-2026-10': true,
  });
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  if (!isOpen) return null;

  // Build roster list
  const staffList = staff.length > 0 ? staff : OFFICIAL_STAFF_MEMBERS;

  // Find staff match
  const findStaffMatch = (queryStr) => {
    if (!queryStr) return null;
    const q = queryStr.toLowerCase().trim();
    return staffList.find(s =>
      s.name.toLowerCase().trim() === q ||
      (s.staffId && s.staffId.toLowerCase().trim() === q) ||
      (s.email && s.email.toLowerCase().trim() === q) ||
      s.name.toLowerCase().includes(q) ||
      q.includes(s.name.toLowerCase())
    );
  };

  // Normalise month string to YYYY-MM
  const normalizeMonth = (mStr) => {
    if (!mStr) return thisMonthKey();
    const clean = mStr.trim().toLowerCase();
    if (/^\d{4}-\d{2}$/.test(clean)) return clean;
    if (/^\d{2}\/\d{4}$/.test(clean)) {
      const [m, y] = clean.split('/');
      return `${y}-${m.padStart(2, '0')}`;
    }
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    for (let i = 0; i < monthNames.length; i++) {
      if (clean.includes(monthNames[i])) {
        const yearMatch = clean.match(/\d{4}/);
        const y = yearMatch ? yearMatch[0] : '2026';
        return `${y}-${String(i + 1).padStart(2, '0')}`;
      }
    }
    return thisMonthKey();
  };

  // Parse pasted TSV / CSV
  const handleParse = (text) => {
    setPastedText(text);
    if (!text.trim()) {
      setParsedRows([]);
      return;
    }

    const lines = text.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const results = [];

    lines.forEach((line, idx) => {
      // Skip header if it looks like column names
      if (idx === 0 && (line.toLowerCase().includes('staff') || line.toLowerCase().includes('name') || line.toLowerCase().includes('month'))) {
        return;
      }

      // Split by tab or comma
      const parts = line.includes('\t') ? line.split('\t') : line.split(',');
      const rawName = (parts[0] || '').trim();
      const rawMonth = (parts[1] || '').trim();
      const rawAmount = (parts[2] || '').trim();
      const rawDate = (parts[3] || '').trim() || todayISO();
      const rawMethod = (parts[4] || '').trim() || 'Bank Transfer';
      const rawRef = (parts[5] || '').trim();

      const matchedStaff = findStaffMatch(rawName);
      const month = normalizeMonth(rawMonth);
      const amount = toInt(rawAmount.replace(/[^0-9.]/g, '')) || 0;

      results.push({
        id: `p-${idx}`,
        rawName,
        matchedStaff,
        month,
        amount,
        paidOn: rawDate,
        method: rawMethod,
        reference: rawRef,
        isValid: !!matchedStaff && amount > 0,
        error: !matchedStaff ? 'Staff not found in roster' : amount <= 0 ? 'Invalid amount' : null,
      });
    });

    setParsedRows(results);
  };

  // Official rows to offer for seeding
  const officialSeedCandidates = [
    { key: 'stf-asra-2026-09', staffId: 'stf-asra', staffName: 'Asra', month: '2026-09', amount: 75000, paidOn: '2026-09-30', method: 'Bank Transfer', note: 'Joined 28 Sep 2026 (Month 1)' },
    { key: 'stf-asra-2026-10', staffId: 'stf-asra', staffName: 'Asra', month: '2026-10', amount: 75000, paidOn: '2026-10-31', method: 'Bank Transfer', note: 'Full Month (Month 2)' },
    { key: 'stf-a-sathurshika-2026-09', staffId: 'stf-a-sathurshika', staffName: 'A. Sathurshika', month: '2026-09', amount: 80000, paidOn: '2026-09-30', method: 'Bank Transfer', note: 'Joined 28 Sep 2026 (Month 1)' },
    { key: 'stf-a-sathurshika-2026-10', staffId: 'stf-a-sathurshika', staffName: 'A. Sathurshika', month: '2026-10', amount: 80000, paidOn: '2026-10-31', method: 'Bank Transfer', note: 'Full Month (Month 2)' },
    { key: 'stf-lukshika-2026-10', staffId: 'stf-lukshika', staffName: 'Lukshika', month: '2026-10', amount: 65000, paidOn: '2026-10-31', method: 'Bank Transfer', note: 'Joined 01 Oct 2026 (Month 1)' },
    { key: 'stf-thishalini-2026-10', staffId: 'stf-thishalini', staffName: 'Thishalini', month: '2026-10', amount: 60000, paidOn: '2026-10-31', method: 'Bank Transfer', note: 'Joined 12 Oct 2026 (Month 1)' },
    { key: 'stf-ameen-isath-2026-10', staffId: 'stf-ameen-isath', staffName: 'Ameen Isath', month: '2026-10', amount: 60000, paidOn: '2026-10-31', method: 'Bank Transfer', note: 'Joined 26 Oct 2026 (Month 1)' },
    { key: 'stf-n-kavitharan-2026-10', staffId: 'stf-n-kavitharan', staffName: 'N. Kavitharan', month: '2026-10', amount: 55000, paidOn: '2026-10-31', method: 'Bank Transfer', note: 'Joined 26 Oct 2026 (Month 1)' },
  ];

  // Submit Pasted Rows
  const handleImportPasted = async () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) return;
    setBusy(true);
    setStatusMsg('Importing salary records...');

    try {
      const inserted = [];
      for (const row of validRows) {
        const staffDoc = row.matchedStaff;
        const payslipNo = live ? await nextNumber('payslips', 'PS') : `PS-IMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const payload = {
          payslipNo,
          staffId: staffDoc.id,
          staffName: staffDoc.name,
          staffRole: staffDoc.role || staffDoc.position || 'Staff',
          authUid: staffDoc.authUid || staffDoc.id,
          month: row.month,
          basicSalary: toInt(staffDoc.basicSalary) || row.amount,
          allowances: toInt(staffDoc.allowances) || 0,
          deductions: toInt(staffDoc.deductions) || 0,
          net: row.amount,
          paidOn: row.paidOn,
          method: row.method,
          reference: row.reference || 'Imported via Salary Sheet Sync',
          createdAt: serverTimestamp ? serverTimestamp() : new Date(),
        };

        if (live) {
          // Check for duplicate in live Firestore
          const dup = await getDocs(query(
            collection(db, 'salaryPayments'),
            where('staffId', '==', staffDoc.id),
            where('month', '==', row.month)
          ));
          if (dup.empty) {
            await addDoc(collection(db, 'salaryPayments'), payload);
            inserted.push({ id: `live-${Date.now()}`, ...payload });
          }
        } else {
          inserted.push({ id: `dev-${Date.now()}-${Math.random()}`, ...payload });
        }
      }

      setStatusMsg(`Successfully imported ${inserted.length} salary records!`);
      if (onImported) onImported(inserted);
      setTimeout(() => {
        onClose();
        setStatusMsg(null);
      }, 1200);
    } catch (err) {
      console.error(err);
      setStatusMsg(`Import error: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  // Submit Official Seeds
  const handleImportOfficial = async () => {
    const candidates = officialSeedCandidates.filter(c => selectedOfficialRows[c.key]);
    if (candidates.length === 0) return;
    setBusy(true);
    setStatusMsg('Seeding official verified salaries...');

    try {
      const inserted = [];
      for (const cand of candidates) {
        const staffDoc = staffList.find(s => s.id === cand.staffId || s.name.toLowerCase() === cand.staffName.toLowerCase()) || {
          id: cand.staffId,
          name: cand.staffName,
          role: 'Staff'
        };
        const payslipNo = live ? await nextNumber('payslips', 'PS') : `PS-OFFICIAL-${cand.month}-${cand.staffName.replace(/[^a-zA-Z]/g, '')}`;
        const def = OFFICIAL_DEFAULT_SALARIES[cand.staffId] || { basic: cand.amount, allowances: 0, deductions: 0, net: cand.amount };

        const payload = {
          payslipNo,
          staffId: staffDoc.id,
          staffName: staffDoc.name,
          staffRole: staffDoc.role || staffDoc.position || 'Staff',
          authUid: staffDoc.authUid || staffDoc.id,
          month: cand.month,
          basicSalary: def.basic,
          allowances: def.allowances,
          deductions: def.deductions,
          net: cand.amount,
          paidOn: cand.paidOn,
          method: cand.method,
          reference: cand.note,
          createdAt: serverTimestamp ? serverTimestamp() : new Date(),
        };

        if (live) {
          const dup = await getDocs(query(
            collection(db, 'salaryPayments'),
            where('staffId', '==', staffDoc.id),
            where('month', '==', cand.month)
          ));
          if (dup.empty) {
            await addDoc(collection(db, 'salaryPayments'), payload);
            inserted.push({ id: `live-${Date.now()}`, ...payload });
          }
        } else {
          inserted.push({ id: `dev-${cand.key}`, ...payload });
        }
      }

      setStatusMsg(`Successfully seeded ${inserted.length} official salary payments!`);
      if (onImported) onImported(inserted);
      setTimeout(() => {
        onClose();
        setStatusMsg(null);
      }, 1200);
    } catch (err) {
      console.error(err);
      setStatusMsg(`Sync error: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ERPModal isOpen={isOpen} onClose={onClose} title="Salary Sheet Sync & Import" width={750}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: 8, borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
          <button
            onClick={() => setTab('paste')}
            style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: tab === 'paste' ? 'rgba(0,102,255,0.2)' : 'transparent',
              color: tab === 'paste' ? C.cyan : C.muted, border: `1px solid ${tab === 'paste' ? C.borderHi : 'transparent'}`
            }}
          >
            📋 Paste Sheet / Table Data
          </button>
          <button
            onClick={() => setTab('official')}
            style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: tab === 'official' ? 'rgba(139,92,246,0.2)' : 'transparent',
              color: tab === 'official' ? C.violet : C.muted, border: `1px solid ${tab === 'official' ? 'rgba(139,92,246,0.4)' : 'transparent'}`
            }}
          >
            ✨ One-Click Official 7-Staff Payroll
          </button>
        </div>

        {statusMsg && (
          <div style={{
            padding: '10px 14px', borderRadius: 8,
            background: statusMsg.includes('error') ? 'rgba(240,90,103,0.1)' : 'rgba(24,199,122,0.1)',
            border: `1px solid ${statusMsg.includes('error') ? 'rgba(240,90,103,0.3)' : 'rgba(24,199,122,0.3)'}`,
            color: statusMsg.includes('error') ? C.red : C.green, fontSize: 12, fontWeight: 700
          }}>
            {statusMsg}
          </div>
        )}

        {/* Tab 1: Paste Sheet */}
        {tab === 'paste' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.5 }}>
              Copy rows from your Google Sheet or Excel payroll sheet and paste them below. Expected columns:
              <br />
              <code style={{ color: C.cyan, background: 'rgba(0,217,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>
                Staff Name &nbsp;|&nbsp; Month (e.g. 2026-10) &nbsp;|&nbsp; Amount (LKR) &nbsp;|&nbsp; Paid Date &nbsp;|&nbsp; Method &nbsp;|&nbsp; Reference
              </code>
            </div>

            <textarea
              rows={5}
              value={pastedText}
              onChange={e => handleParse(e.target.value)}
              placeholder="Asra	2026-10	75000	2026-10-31	Bank Transfer	TRX-101&#10;Lukshika	2026-10	65000	2026-10-31	Bank Transfer	TRX-102"
              style={{
                width: '100%', background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`,
                borderRadius: 8, padding: '10px', color: C.text, fontSize: 12, fontFamily: 'monospace'
              }}
            />

            {parsedRows.length > 0 && (
              <div style={{ maxHeight: 220, overflowY: 'auto', border: `1px solid ${C.border}`, borderRadius: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                  <thead>
                    <tr style={{ background: 'rgba(14,35,80,0.6)', color: C.muted, textTransform: 'uppercase' }}>
                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>STAFF</th>
                      <th style={{ padding: '6px 8px', textAlign: 'center' }}>MONTH</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>NET AMOUNT</th>
                      <th style={{ padding: '6px 8px', textAlign: 'center' }}>PAID ON</th>
                      <th style={{ padding: '6px 8px', textAlign: 'center' }}>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map(r => (
                      <tr key={r.id} style={{ borderTop: `1px solid ${C.border}20` }}>
                        <td style={{ padding: '6px 8px', color: C.text, fontWeight: 700 }}>
                          {r.matchedStaff ? r.matchedStaff.name : <span style={{ color: C.red }}>{r.rawName}</span>}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', color: C.muted }}>{monthLabel(r.month)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 800, color: C.green }}>{formatLKR(r.amount)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', color: C.muted }}>{r.paidOn}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                          {r.isValid ? (
                            <span style={{ color: C.green, fontSize: 10.5, fontWeight: 800 }}>✓ Ready</span>
                          ) : (
                            <span style={{ color: C.red, fontSize: 10 }}>⚠ {r.error}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
              <ERPBtn variant="secondary" onClick={onClose}>Cancel</ERPBtn>
              <ERPBtn
                variant="primary"
                disabled={busy || parsedRows.filter(r => r.isValid).length === 0}
                onClick={handleImportPasted}
              >
                <UploadCloud size={13} /> Import {parsedRows.filter(r => r.isValid).length} Records
              </ERPBtn>
            </div>
          </div>
        )}

        {/* Tab 2: One-Click Official Seeds */}
        {tab === 'official' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{
              padding: '10px 14px', borderRadius: 8, background: 'rgba(139,92,246,0.1)',
              border: '1px solid rgba(139,92,246,0.3)', color: C.text, fontSize: 11.5, lineHeight: 1.5
            }}>
              <strong style={{ color: C.violet }}>Official Roster Payroll Seeder:</strong> Select verified past monthly salaries for SMART staff. Once seeded, all "Months Worked vs Months Paid" badges and payslips will automatically calculate!
            </div>

            <div style={{ maxHeight: 260, overflowY: 'auto', border: `1px solid ${C.border}`, borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                <thead>
                  <tr style={{ background: 'rgba(14,35,80,0.6)', color: C.muted, textTransform: 'uppercase' }}>
                    <th style={{ padding: '6px 8px', width: 30, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={Object.values(selectedOfficialRows).every(Boolean)}
                        onChange={e => {
                          const v = e.target.checked;
                          const nxt = {};
                          officialSeedCandidates.forEach(c => nxt[c.key] = v);
                          setSelectedOfficialRows(nxt);
                        }}
                      />
                    </th>
                    <th style={{ padding: '6px 8px', textAlign: 'left' }}>STAFF</th>
                    <th style={{ padding: '6px 8px', textAlign: 'center' }}>MONTH</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>SALARY</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left' }}>TIMELINE / NOTE</th>
                  </tr>
                </thead>
                <tbody>
                  {officialSeedCandidates.map(c => (
                    <tr key={c.key} style={{ borderTop: `1px solid ${C.border}20` }}>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={!!selectedOfficialRows[c.key]}
                          onChange={e => setSelectedOfficialRows(p => ({ ...p, [c.key]: e.target.checked }))}
                        />
                      </td>
                      <td style={{ padding: '6px 8px', color: C.text, fontWeight: 700 }}>{c.staffName}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'center', color: C.cyan, fontWeight: 700 }}>{monthLabel(c.month)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 800, color: C.green }}>{formatLKR(c.amount)}</td>
                      <td style={{ padding: '6px 8px', color: C.muted, fontSize: 10.5 }}>{c.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
              <ERPBtn variant="secondary" onClick={onClose}>Cancel</ERPBtn>
              <ERPBtn
                variant="primary"
                disabled={busy || Object.values(selectedOfficialRows).filter(Boolean).length === 0}
                onClick={handleImportOfficial}
                style={{ background: 'linear-gradient(135deg, #8B5CF6, #0066FF)', border: 'none' }}
              >
                <Sparkles size={13} /> Seed {Object.values(selectedOfficialRows).filter(Boolean).length} Salary Records
              </ERPBtn>
            </div>
          </div>
        )}
      </div>
    </ERPModal>
  );
}
