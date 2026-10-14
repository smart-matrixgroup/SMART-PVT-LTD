// ─────────────────────────────────────────────────────────────────
//  Staff Portal — Work Sheets (admin → staff → back).
//
//  The admin sends a pre-filled "DAILY WORK LOG" sheet for a chosen
//  week/month (see ERP → Staff Updates → “Send to All Staff”). Here the
//  staff member:
//    1. downloads the sheet (regenerated from the request metadata, so it
//       always matches the period the admin picked),
//    2. fills it in Excel,
//    3. uploads it back — it lands in report-sheets/{uid}/{requestId}/…
//       and the request flips to “Returned” for the admin to download.
//
//  Reads only the signed-in member's own requests (staffUid == auth uid).
// ─────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef } from 'react';
import {
  collection, onSnapshot, query, where, doc, updateDoc, serverTimestamp
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getBytes } from 'firebase/storage';
import { db, storage, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { C, ERPPanel, ERPPanelHeader, ERPBtn } from '../../erp/components/ERPui';
import StaffEmpty from '../components/StaffEmpty';
import { downloadWorkLogSheet } from '../workLogTemplate';
import { toMs } from '../staffUtils';
import {
  FileText, Download, Upload, CheckCircle2, AlertCircle, Info,
  Calendar, Clock, Send,
} from 'lucide-react';

const fmtWhen = v => {
  if (!v) return '—';
  const d = typeof v === 'object' && typeof v.toMillis === 'function' ? new Date(v.toMillis()) : new Date(v);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};
const statusColor = s => s === 'Returned' ? C.blue : s === 'Approved' ? C.green : C.amber;

const DEV_REQUESTS = [];

export default function WorkSheets() {
  const { staffProfile, isDevSession } = useAuth();
  const live = isFirebaseConfigured && !isDevSession;
  const uid = staffProfile?.id || '';

  const [requests, setRequests] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [busyId,   setBusyId]   = useState(null);
  const [msg,      setMsg]      = useState(null);   // { kind, text }

  const fileInputs = useRef({});

  useEffect(() => {
    if (!live) { setRequests(DEV_REQUESTS); setLoading(false); return; }
    if (!uid) { setLoading(false); return; }
    const unsub = onSnapshot(
      query(collection(db, 'reportRequests'), where('staffUid', '==', uid)),
      snap => { setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      err => { console.error(err); setMsg({ kind: 'err', text: `Could not load your work sheets — ${err.message}` }); setLoading(false); }
    );
    return unsub;
  }, [live, uid]);

  const sorted = [...requests].sort((a, b) =>
    toMs(b.requestedAt || b.createdAt) - toMs(a.requestedAt || a.createdAt));

  const location = staffProfile?.location
    || (staffProfile?.address ? `SMART ${staffProfile.address}` : 'SMART Trincomalee');

  const downloadSheet = async (req) => {
    setMsg(null);
    try {
      await downloadWorkLogSheet(
        { name: staffProfile?.name || req.staffName || '', position: req.position || staffProfile?.role || '', location: req.location || location },
        { period: req.period || 'week', rangeStart: req.rangeStart }
      );
    } catch (err) {
      console.error(err);
      setMsg({ kind: 'err', text: 'Could not generate the sheet. Please try again.' });
    }
  };

  const onUpload = async (req, e) => {
    const file = e.target.files?.[0];
    if (fileInputs.current[req.id]) fileInputs.current[req.id].value = '';
    if (!file) return;
    setMsg(null);
    if (!live) { setMsg({ kind: 'warn', text: 'Dev session — uploading needs the live Firebase backend.' }); return; }

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      setMsg({ kind: 'err', text: 'Please upload the filled sheet as .xlsx, .xls or .csv.' });
      return;
    }
    setBusyId(req.id);
    try {
      const safe = file.name.replace(/[^\w.\- ]+/g, '_');
      const path = `report-sheets/${uid}/${req.id}/${Date.now()}_${safe}`;
      const snap = await uploadBytes(storageRef(storage, path), file, {
        contentType: file.type || 'application/octet-stream',
      });
      await updateDoc(doc(db, 'reportRequests', req.id), {
        status: 'Returned',
        returnedPath: snap.ref.fullPath,
        returnedName: file.name,
        returnedSize: file.size,
        returnedAt: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      });
      setMsg({ kind: 'ok', text: `${file.name} sent to admin. You can replace it any time before it's approved.` });
    } catch (ex) {
      console.error(ex);
      setMsg({
        kind: 'err',
        text: (ex?.code === 'storage/unauthorized' || ex?.code === 'permission-denied')
          ? 'Upload denied — ask your administrator to publish the latest security rules.'
          : 'Upload failed. Please try again.',
      });
    } finally { setBusyId(null); }
  };

  const downloadMyReturn = async (req) => {
    if (!req.returnedPath) return;
    setBusyId(req.id);
    try {
      const bytes = await getBytes(storageRef(storage, req.returnedPath));
      const url = URL.createObjectURL(new Blob([bytes]));
      const a = document.createElement('a');
      a.href = url; a.download = req.returnedName || 'work-log.xlsx'; a.click();
      URL.revokeObjectURL(url);
    } catch {
      setMsg({ kind: 'err', text: 'Could not download your returned sheet.' });
    } finally { setBusyId(null); }
  };

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: C.muted, fontSize: 13 }}>Loading your work sheets…</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ERPPanel>
        <ERPPanelHeader
          title="My Work Sheets"
          icon={FileText}
          action={<span style={{ fontSize: 11, color: C.muted }}>{sorted.length} request{sorted.length === 1 ? '' : 's'}</span>}
        />

        <div style={{
          display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 14px', borderRadius: 10,
          background: 'rgba(0,217,255,0.07)', border: `1px solid ${C.borderHi}`, color: C.cyan,
          fontSize: 11.5, margin: '0 18px 12px',
        }}>
          <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>Admin sends you a sheet for a chosen week or month. Download it, fill your daily work in Excel, then upload it back — admin will see it right away.</span>
        </div>

        {msg && (
          <div style={{
            display: 'flex', gap: 8, alignItems: 'flex-start', margin: '0 18px 12px', padding: '10px 14px', borderRadius: 10, fontSize: 11.5,
            background: msg.kind === 'err' ? 'rgba(240,90,103,0.1)' : msg.kind === 'warn' ? 'rgba(245,185,66,0.1)' : 'rgba(24,199,122,0.1)',
            border: `1px solid ${msg.kind === 'err' ? 'rgba(240,90,103,0.35)' : msg.kind === 'warn' ? 'rgba(245,185,66,0.35)' : 'rgba(24,199,122,0.35)'}`,
            color: msg.kind === 'err' ? C.red : msg.kind === 'warn' ? C.amber : C.green,
          }}>
            {msg.kind === 'ok' ? <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: 1 }} /> : <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />}
            {msg.text}
          </div>
        )}

        {sorted.length === 0 ? (
          <StaffEmpty
            icon="📄"
            from="#00D9FF" to="#0066FF"
            title="No work sheets requested yet"
            sub="When your admin sends a Weekly/Monthly work-log sheet, it will appear here for you to fill and return."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {sorted.map((req, i) => (
              <div
                key={req.id}
                style={{
                  display: 'flex', flexDirection: 'column', gap: 10,
                  padding: '16px 18px', borderTop: i > 0 ? `1px solid ${C.border}30` : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <Calendar size={15} color={C.blue} />
                  <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>
                    {req.period === 'week' ? 'Weekly' : 'Monthly'} Work Sheet
                  </span>
                  <span style={{ fontSize: 11.5, color: C.subtle }}>
                    {req.rangeLabel || `${req.rangeStart} → ${req.rangeEnd}`}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
                    background: `${statusColor(req.status)}22`, color: statusColor(req.status),
                    border: `1px solid ${statusColor(req.status)}55`,
                  }}>
                    {req.status || 'Requested'}
                  </span>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 10.5, color: C.muted, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={11} /> sent {fmtWhen(req.requestedAt)}
                  </span>
                </div>

                {req.note && (
                  <div style={{ fontSize: 11.5, color: C.amber, padding: '6px 10px', borderRadius: 6, background: 'rgba(245,185,66,0.06)', border: '1px solid rgba(245,185,66,0.18)' }}>
                    <strong>Note from admin:</strong> {req.note}
                  </div>
                )}

                {req.returnedPath && (
                  <div style={{ fontSize: 11, color: C.muted }}>
                    Returned file: <strong style={{ color: C.subtle }}>{req.returnedName}</strong>
                    {req.returnedAt ? ` • ${fmtWhen(req.returnedAt)}` : ''}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <ERPBtn variant="primary" onClick={() => downloadSheet(req)}>
                    <Download size={13} /> Download Sheet
                  </ERPBtn>

                  <input
                    ref={el => { fileInputs.current[req.id] = el; }}
                    type="file"
                    accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                    style={{ display: 'none' }}
                    onChange={e => onUpload(req, e)}
                  />
                  <ERPBtn
                    variant={req.returnedPath ? 'secondary' : 'primary'}
                    disabled={busyId === req.id}
                    onClick={() => fileInputs.current[req.id]?.click()}
                  >
                    {req.returnedPath ? <Upload size={13} /> : <Send size={13} />}
                    {busyId === req.id ? 'Uploading…' : (req.returnedPath ? 'Replace / send again' : 'Upload filled sheet & send')}
                  </ERPBtn>

                  {req.returnedPath && (
                    <button
                      type="button"
                      onClick={() => downloadMyReturn(req)}
                      style={{
                        background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`, borderRadius: 10,
                        color: C.cyan, padding: '9px 14px', fontSize: 12, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700,
                      }}
                    >
                      <Download size={13} /> My copy
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ERPPanel>
    </div>
  );
}
