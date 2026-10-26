// ─────────────────────────────────────────────────────────────────
//  Phase 3 E — Attendance (admin side).
//  Portal staff check in/out themselves; admins here can filter by
//  date/staff, fix times manually, and download Daily / Monthly /
//  Staff-wise reports as CSV or printable PDF.
// ─────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { ERPPanel, ERPPanelHeader, ERPBadge, ERPBtn, ERPModal, ERPInput, ERPSelect, ERPEmpty, ERPAvatar, C } from '../components/ERPui';
import {
  attendanceStatus, minutesBetween, fmtTime, fmtHours, downloadCsv,
  todayKey, thisMonthKey, monthLabel,
} from '../../staff/staffUtils';
import { company } from '../../config/company';
import {
  getStaffCheckInPublicUrl, generateStaffCheckInQRCodeDataUrl, downloadStaffCheckInQRPng,
} from '../../utils/qrUtils';
import { Pencil, AlertTriangle, Download, Printer, QrCode, ExternalLink, Copy } from 'lucide-react';

const AVATAR_COLORS = ['#0066FF', '#8B5CF6', '#18C77A', '#F5B942', '#F05A67', '#00D9FF'];

const DEV_ATT = [
  { id: 'at1', staffId: 'dev-staff-001', staffName: 'Ashan Perera', date: todayKey(), checkInMs: new Date().setHours(8, 32, 0, 0), checkOutMs: new Date().setHours(17, 5, 0, 0), minutes: 513, status: 'Present' },
  { id: 'at2', staffId: 'dev-staff-002', staffName: 'Nimali Silva', date: todayKey(), checkInMs: new Date().setHours(9, 24, 0, 0), checkOutMs: new Date().setHours(13, 0, 0, 0), minutes: 216, status: 'Half Day' },
];

const REPORT_HEADERS = ['Date', 'Staff', 'Check In', 'Check Out', 'Hours', 'Status'];
const reportRows = records => records.map(r => [
  r.date,
  r.staffName,
  r.checkInMs ? fmtTime(r.checkInMs) : '—',
  r.checkOutMs ? fmtTime(r.checkOutMs) : '—',
  fmtHours(minutesBetween(r.checkInMs, r.checkOutMs)),
  r.status || attendanceStatus(r.checkInMs, r.checkOutMs) || '—',
]);

export default function ERPStaffAttendance() {
  const { isFirebaseConfigured, isDevSession } = useAuth();
  const live = isFirebaseConfigured && !isDevSession;

  const [records,  setRecords]  = useState([]);
  const [staff,    setStaff]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [dateF,    setDateF]    = useState(todayKey());
  const [staffF,   setStaffF]   = useState('All');
  const [monthF,   setMonthF]   = useState(thisMonthKey());
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ date: '', in: '', out: '' });
  const [preview,  setPreview]  = useState(null); // {title, rows}
  const [busy,     setBusy]     = useState(false);

  // Office attendance QR — staff scan this at the office entrance.
  const [checkInQr, setCheckInQr] = useState(null);
  const checkInUrl = getStaffCheckInPublicUrl();

  useEffect(() => {
    let mounted = true;
    generateStaffCheckInQRCodeDataUrl({ width: 640 }).then(dataUrl => {
      if (mounted && dataUrl) setCheckInQr(dataUrl);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!live) {
      setRecords(DEV_ATT);
      setStaff([{ id: 'dev-staff-001', name: 'Ashan Perera' }, { id: 'dev-staff-002', name: 'Nimali Silva' }]);
      setLoading(false);
      return;
    }
    const unsubs = [
      onSnapshot(collection(db, 'attendance'),
        snap => { setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
        err => { console.error(err); setLoadError(`Attendance — ${err.message}`); setLoading(false); }),
      onSnapshot(collection(db, 'staff'),
        snap => setStaff(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.deleted)),
        err => console.error(err)),
    ];
    return () => unsubs.forEach(u => u());
  }, [live]);

  const filtered = records
    .filter(r => r.date === dateF)
    .filter(r => (staffF === 'All' ? true : r.staffId === staffF))
    .sort((a, b) => String(a.staffName || '').localeCompare(String(b.staffName || '')));

  // month-scoped records for the monthly / staff-wise reports
  const monthRecords = records
    .filter(r => (r.date || '').startsWith(monthF))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.staffName || '').localeCompare(String(b.staffName || '')));

  const runReport = kind => {
    const base = kind.replace('-pdf', ''); // CSV & PDF of a period share one preview
    let title = '', rows = [];
    if (base === 'daily') {
      title = `Daily Attendance — ${dateF}`;
      rows = reportRows(filtered);
    } else if (base === 'monthly') {
      title = `Monthly Attendance — ${monthLabel(monthF)}`;
      rows = reportRows(monthRecords);
    } else {
      const name = staffF === 'All' ? 'All Staff' : staff.find(s => s.id === staffF)?.name || staffF;
      title = `Staff-wise Attendance — ${name} — ${monthLabel(monthF)}`;
      rows = reportRows(monthRecords.filter(r => (staffF === 'All' ? true : r.staffId === staffF)));
    }
    setPreview({ title, rows });
  };

  const downloadPreview = () => {
    const stamp = preview.title.replace(/[^\w]+/g, '_');
    downloadCsv(`${stamp}.csv`, REPORT_HEADERS, preview.rows);
  };

  const openEdit = r => {
    setEditTarget(r);
    const t = ms => {
      if (!ms) return '';
      const x = new Date(ms);
      return `${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`;
    };
    setEditForm({ date: r.date, in: t(r.checkInMs), out: t(r.checkOutMs) });
  };

  const handleEditSave = async () => {
    setBusy(true);
    try {
      const toMsOfDay = (date, time) => (date && time ? new Date(`${date}T${time}:00`).getTime() : 0);
      const checkInMs = toMsOfDay(editForm.date, editForm.in);
      const checkOutMs = toMsOfDay(editForm.date, editForm.out);
      const payload = {
        date: editForm.date, checkInMs, checkOutMs,
        minutes: minutesBetween(checkInMs, checkOutMs),
        status: checkInMs ? (attendanceStatus(checkInMs, checkOutMs) || 'Present') : 'Absent',
        autoClosed: false, updatedAt: serverTimestamp(),
      };
      if (!live) setRecords(p => p.map(r => (r.id === editTarget.id ? { ...r, ...payload } : r)));
      else await updateDoc(doc(db, 'attendance', editTarget.id), payload);
      setEditTarget(null);
    } catch (e) { console.error(e); }
    finally { setBusy(false); }
  };

  const handlePrintCheckInQR = () => {
    if (!checkInQr) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>SMART Pvt Ltd — Office Attendance QR</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; text-align: center; margin: 0; padding: 40px; color: #040D1F; }
            .card { border: 2px solid #0066FF; border-radius: 22px; padding: 32px 30px; max-width: 420px; margin: 0 auto; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            .logo { height: 44px; margin-bottom: 8px; }
            .company { font-size: 16px; font-weight: 900; }
            .title { font-size: 21px; font-weight: 800; color: #0066FF; margin: 10px 0 4px; }
            .sub { font-size: 12px; color: #475569; margin-bottom: 14px; line-height: 1.5; }
            .qr-img { width: 265px; height: 265px; margin: 0 auto; display: block; border-radius: 12px; }
            .steps { font-size: 12px; font-weight: 700; margin-top: 14px; color: #040D1F; }
            .steps span { color: #0066FF; }
            .url { font-size: 10.5px; font-family: monospace; color: #64748B; margin-top: 12px; word-break: break-all; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="card">
            <img src="/logos/SMART_LOGO_LM.png" class="logo" alt="SMART Pvt Ltd" onerror="this.style.display='none'" />
            <div class="company">${company.fullName}</div>
            <div class="title">Office Attendance</div>
            <div class="sub">Scan with your phone, sign in with your staff email, and check in / check out.</div>
            <img src="${checkInQr}" class="qr-img" alt="Attendance QR" />
            <div class="steps">1. Scan &nbsp;•&nbsp; 2. Sign in &nbsp;•&nbsp; 3. Check In / Out</div>
            <div class="url">${checkInUrl}</div>
          </div>
          <script>window.onload = function() { window.print(); };</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: C.muted, fontSize: 13 }}>Loading attendance…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {loadError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10,
          background: 'rgba(240,90,103,0.1)', border: '1px solid rgba(240,90,103,0.35)', color: C.red, fontSize: 12 }}>
          <AlertTriangle size={14} /> {loadError}
        </div>
      )}

      {/* Office attendance QR — print / put up at the office entrance */}
      <ERPPanel>
        <ERPPanelHeader title="Office Attendance QR" icon={<QrCode size={15} style={{ color: C.cyan }} />}
          action={<span style={{
            fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
            background: 'rgba(0,217,255,0.12)', color: C.cyan, border: '1px solid rgba(0,217,255,0.3)',
          }}>Check-in only</span>} />
        <div style={{ padding: '18px 20px', display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ background: '#FFFFFF', padding: 12, borderRadius: 14, boxShadow: '0 8px 26px rgba(0,102,255,0.22)', flexShrink: 0 }}>
            {checkInQr ? (
              <img src={checkInQr} alt="Office attendance QR" style={{ width: 132, height: 132, display: 'block', borderRadius: 6 }} />
            ) : (
              <div style={{ width: 132, height: 132, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', fontSize: 10 }}>
                Generating…
              </div>
            )}
          </div>

          <div style={{ flex: '1 1 260px', minWidth: 220 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>Staff scan → sign in → check in / out</div>
            <div style={{ fontSize: 11.5, color: C.subtle, lineHeight: 1.65, marginTop: 4 }}>
              Print this QR and keep it at the office entrance. Staff scan it with their phone, sign in with
              their staff email and password, and only the check-in / check-out screen appears — no other portal pages.
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, padding: '7px 10px',
              borderRadius: 8, background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`,
            }}>
              <span style={{ fontSize: 10.5, fontFamily: 'monospace', color: C.subtle, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {checkInUrl}
              </span>
              <button onClick={() => navigator.clipboard?.writeText(checkInUrl)} title="Copy link"
                style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', display: 'flex', padding: 0 }}>
                <Copy size={12} />
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <ERPBtn size="sm" variant="primary" disabled={!checkInQr} onClick={() => downloadStaffCheckInQRPng(checkInQr)}>
                <Download size={12} /> Download PNG
              </ERPBtn>
              <ERPBtn size="sm" variant="secondary" disabled={!checkInQr} onClick={handlePrintCheckInQR}>
                <Printer size={12} /> Print
              </ERPBtn>
              <a href={checkInUrl} target="_blank" rel="noopener noreferrer" style={{
                padding: '6px 11px', borderRadius: 8, fontSize: 10.5, fontWeight: 700, textDecoration: 'none',
                background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`, color: C.muted,
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <ExternalLink size={11} /> Open page
              </a>
            </div>
          </div>
        </div>
      </ERPPanel>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ width: 170 }}>
          <ERPInput label="Date" value={dateF} type="date" onChange={e => setDateF(e.target.value)} />
        </div>
        <div style={{ width: 190 }}>
          <ERPSelect label="Staff" value={staffF} onChange={e => setStaffF(e.target.value)}
            options={[{ value: 'All', label: 'All staff' }, ...staff.map(s => ({ value: s.id, label: s.name }))]} />
        </div>
      </div>

      {/* Day records */}
      <ERPPanel>
        <ERPPanelHeader title={`Attendance — ${dateF}`} icon="🕒"
          action={<span style={{ fontSize: 10, color: C.muted }}>{filtered.length} record{filtered.length === 1 ? '' : 's'}</span>} />
        {filtered.length === 0 ? (
          <ERPEmpty icon="🕒" title="No records for this day"
            sub="Staff check in/out from their portal appears here automatically." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Staff', 'Check In', 'Check Out', 'Hours', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.8px', color: C.muted, textAlign: 'left', background: 'rgba(10,24,56,0.5)',
                      borderBottom: `1px solid ${C.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,102,255,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ERPAvatar name={r.staffName} color={AVATAR_COLORS[(r.staffName || '?').length % AVATAR_COLORS.length]} size={24} />
                        <span style={{ fontSize: 12, color: C.subtle, fontWeight: 600 }}>{r.staffName}</span>
                      </div>
                    </td>
                    <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }}>
                      <span style={{ fontSize: 12, color: C.subtle }}>{fmtTime(r.checkInMs)}</span>
                    </td>
                    <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }}>
                      <span style={{ fontSize: 12, color: r.autoClosed ? C.amber : C.subtle }}>
                        {fmtTime(r.checkOutMs)}{r.autoClosed ? ' (auto)' : ''}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>
                        {fmtHours(minutesBetween(r.checkInMs, r.checkOutMs))}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }}>
                      <ERPBadge status={r.status === 'Present' ? 'Paid' : r.status === 'Late' ? 'Pending' : 'Rejected'}
                        label={r.status || '—'} />
                    </td>
                    <td style={{ padding: '11px 14px', borderTop: `1px solid ${C.border}20` }}>
                      <ERPBtn size="sm" variant="secondary" onClick={() => openEdit(r)}><Pencil size={12} /></ERPBtn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ERPPanel>

      {/* Reports */}
      <ERPPanel>
        <ERPPanelHeader title="Reports" icon="📊" />
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ width: 190 }}>
            <ERPInput label="Report Month" value={monthF} type="month" onChange={e => setMonthF(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <ERPBtn variant="secondary" onClick={() => runReport('daily')}><Download size={12} /> Daily CSV</ERPBtn>
            <ERPBtn variant="secondary" onClick={() => runReport('daily-pdf')}><Printer size={12} /> Daily PDF</ERPBtn>
            <ERPBtn variant="secondary" onClick={() => runReport('monthly')}><Download size={12} /> Monthly CSV</ERPBtn>
            <ERPBtn variant="secondary" onClick={() => runReport('monthly-pdf')}><Printer size={12} /> Monthly PDF</ERPBtn>
            <ERPBtn variant="secondary" onClick={() => runReport('staffwise')}><Download size={12} /> Staff-wise CSV</ERPBtn>
            <ERPBtn variant="secondary" onClick={() => runReport('staffwise-pdf')}><Printer size={12} /> Staff-wise PDF</ERPBtn>
          </div>
          <div style={{ fontSize: 10, color: C.muted }}>
            CSV/PDF buttons for the same period share one preview — download CSV from the preview too. Daily uses the
            date filter above; Monthly / Staff-wise use the report month{staffF !== 'All' ? ' and selected staff' : ''}.
          </div>
        </div>
      </ERPPanel>

      {/* Edit modal */}
      <ERPModal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title="Fix Attendance" width={420}>
        {editTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            <div style={{ fontSize: 12, color: C.muted }}>
              {editTarget.staffName} — manual correction (hours and status are recalculated automatically).
            </div>
            <ERPInput label="Date" value={editForm.date} type="date"
              onChange={e => setEditForm(p => ({ ...p, date: e.target.value }))} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <ERPInput label="Check In" value={editForm.in} type="time"
                onChange={e => setEditForm(p => ({ ...p, in: e.target.value }))} />
              <ERPInput label="Check Out" value={editForm.out} type="time"
                onChange={e => setEditForm(p => ({ ...p, out: e.target.value }))} />
            </div>
            <div style={{ fontSize: 11, color: C.cyan }}>
              Hours: {fmtHours(minutesBetween(
                editForm.date && editForm.in ? new Date(`${editForm.date}T${editForm.in}:00`).getTime() : 0,
                editForm.date && editForm.out ? new Date(`${editForm.date}T${editForm.out}:00`).getTime() : 0))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <ERPBtn variant="secondary" onClick={() => setEditTarget(null)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</ERPBtn>
              <ERPBtn variant="primary" disabled={busy || !editForm.in} onClick={handleEditSave} style={{ flex: 1, justifyContent: 'center' }}>Save</ERPBtn>
            </div>
          </div>
        )}
      </ERPModal>

      {/* Report preview (white printable doc) */}
      <ERPModal isOpen={!!preview} onClose={() => setPreview(null)} title="Report Preview" width={760}>
        {preview && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="report-print" style={{ background: '#fff', color: '#16233D', borderRadius: 10, padding: '26px 30px', fontFamily: 'Arial, sans-serif' }}>
              <style>{`
                @media print {
                  body * { visibility: hidden !important; }
                  .report-print, .report-print * { visibility: visible !important; }
                  .report-print { position: fixed; left: 0; top: 0; width: 100%; background: #fff; }
                }
              `}</style>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '3px solid #0066FF', paddingBottom: 12, marginBottom: 14 }}>
                <img src={company.logos.lightMode} alt="" style={{ height: 44, objectFit: 'contain' }}
                  onError={e => { e.currentTarget.style.display = 'none'; }} />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#0B1F44' }}>{company.fullName}</div>
                  <div style={{ fontSize: 12, color: '#5A6B8C' }}>{preview.title}</div>
                  <div style={{ fontSize: 10, color: '#5A6B8C' }}>{company.contact.address} · {company.contact.phone}</div>
                </div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr>
                    {REPORT_HEADERS.map(h => (
                      <th key={h} style={{ textAlign: 'left', background: '#0B1F44', color: '#fff', padding: '7px 10px', fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.length === 0 ? (
                    <tr><td colSpan={REPORT_HEADERS.length} style={{ border: '1px solid #D7DFEE', padding: '12px 10px', textAlign: 'center', color: '#5A6B8C' }}>
                      No records for this period.
                    </td></tr>
                  ) : preview.rows.map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j} style={{ border: '1px solid #D7DFEE', padding: '7px 10px' }}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 20, fontSize: 10, color: '#5A6B8C' }}>
                Generated by SMART ERP — {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <ERPBtn variant="secondary" onClick={downloadPreview} style={{ flex: 1, justifyContent: 'center' }}>
                <Download size={13} /> Download CSV
              </ERPBtn>
              <ERPBtn variant="primary" onClick={() => window.print()} style={{ flex: 1, justifyContent: 'center' }}>
                <Printer size={13} /> Print / Save PDF
              </ERPBtn>
            </div>
          </div>
        )}
      </ERPModal>
    </div>
  );
}
