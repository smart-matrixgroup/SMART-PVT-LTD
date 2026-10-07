// ─────────────────────────────────────────────────────────────────
//  Phase 3 E (portal side) — Check-in / Check-out + my Attendance.
//  One record per staff per day (the portal blocks a second check-in
//  both in UI and by re-querying before create). Forgotten check-outs
//  are closed gracefully at 17:30 with an autoClosed flag — past days
//  auto-close on load, today shows a banner after 17:30.
// ─────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, doc, query, where, limit, getDocs, serverTimestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { ERPPanel, ERPPanelHeader, ERPBtn, ERPEmpty, C } from '../../erp/components/ERPui';
import {
  todayKey, thisMonthKey, fmtTime, fmtHours, minutesBetween,
  attendanceStatus, AUTOCLOSE_TIME,
} from '../staffUtils';
import { LogIn, LogOut, AlertTriangle, Timer, CheckCircle2 } from 'lucide-react';

const DEV_ATT = [
  { id: 'at1', date: todayKey(), checkInMs: new Date().setHours(8, 32, 0, 0), checkOutMs: 0, minutes: 0, status: 'Present', autoClosed: false },
  { id: 'at2', date: '2026-10-05', checkInMs: new Date('2026-10-05T08:29:00').getTime(), checkOutMs: new Date('2026-10-05T17:31:00').getTime(), minutes: 542, status: 'Present', autoClosed: false },
  { id: 'at3', date: '2026-10-04', checkInMs: new Date('2026-10-04T09:22:00').getTime(), checkOutMs: new Date('2026-10-04T13:05:00').getTime(), minutes: 223, status: 'Half Day', autoClosed: false },
];

const autoCloseMsFor = date => new Date(`${date}T${AUTOCLOSE_TIME}:00`).getTime();

export default function MyAttendance({ variant = 'attendance' }) {
  const { staffProfile, isFirebaseConfigured, isDevSession } = useAuth();
  const live = isFirebaseConfigured && !isDevSession;
  const uid = staffProfile?.id || '';

  const [records,  setRecords]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState(null);
  const [now,      setNow]      = useState(Date.now());

  useEffect(() => {
    if (!live) { setRecords(DEV_ATT); setLoading(false); return; }
    const unsub = onSnapshot(
      query(collection(db, 'attendance'), where('authUid', '==', uid)),
      snap => { setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      err => { console.error(err); setLoadError(`Attendance — ${err.message}`); setLoading(false); },
    );
    const t = setInterval(() => setNow(Date.now()), 30000); // keep elapsed timer fresh
    return () => { unsub(); clearInterval(t); };
  }, [live, uid]);

  const today = todayKey();
  const todayRec = records.find(r => r.date === today) || null;

  // ── forgotten check-out handling ────────────────────────────────
  // Past days still open → auto-close at 17:30 silently (once).
  // Today still open after 17:30 → show a banner with a one-click close.
  const forgottenPast = records.filter(r => r.date < today && r.checkInMs && !r.checkOutMs);
  const forgottenToday = todayRec && todayRec.checkInMs && !todayRec.checkOutMs && now >= autoCloseMsFor(today);

  useEffect(() => {
    if (!live || forgottenPast.length === 0 || busy) return;
    (async () => {
      for (const r of forgottenPast) {
        try {
          const out = autoCloseMsFor(r.date);
          await updateDoc(doc(db, 'attendance', r.id), {
            checkOutMs: out,
            minutes: minutesBetween(r.checkInMs, out),
            status: attendanceStatus(r.checkInMs, out),
            autoClosed: true, updatedAt: serverTimestamp(),
          });
        } catch (e) { console.error('auto-close failed', e); }
      }
    })();
  }, [live, forgottenPast.map(r => r.id).join(','), busy]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeTodayAuto = async () => {
    setBusy(true); setError(null);
    try {
      const out = Math.min(now, autoCloseMsFor(today));
      if (!live) setRecords(p => p.map(r => r.id === todayRec.id
        ? { ...r, checkOutMs: out, minutes: minutesBetween(todayRec.checkInMs, out), status: attendanceStatus(todayRec.checkInMs, out), autoClosed: true } : r));
      else await updateDoc(doc(db, 'attendance', todayRec.id), {
        checkOutMs: out,
        minutes: minutesBetween(todayRec.checkInMs, out),
        status: attendanceStatus(todayRec.checkInMs, out),
        autoClosed: true, updatedAt: serverTimestamp(),
      });
    } catch (e) { console.error(e); setError(e.message || 'Could not close the day.'); }
    finally { setBusy(false); }
  };

  // ── check in / out ──────────────────────────────────────────────
  const handleCheckIn = async () => {
    setBusy(true); setError(null);
    try {
      const at = Date.now();
      // Double-check-in guard: re-query today's record before creating —
      // protects against a stale snapshot showing "not checked in".
      if (live) {
        const dup = await getDocs(query(
          collection(db, 'attendance'),
          where('authUid', '==', uid), where('date', '==', today), limit(1),
        ));
        if (!dup.empty && dup.docs[0].data().checkInMs) {
          setError('You are already checked in today.');
          return;
        }
      }
      const payload = {
        staffId: uid, staffName: staffProfile?.name || '—', authUid: uid,
        date: today, checkInMs: at, checkOutMs: 0,
        minutes: 0, status: attendanceStatus(at, 0) || 'Present',
        autoClosed: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      };
      if (!live) setRecords(p => [{ id: `dev-${Date.now()}`, ...payload, createdAt: Date.now() }, ...p]);
      else await addDoc(collection(db, 'attendance'), payload);
    } catch (e) { console.error(e); setError(e.message || 'Check-in failed.'); }
    finally { setBusy(false); }
  };

  const handleCheckOut = async () => {
    setBusy(true); setError(null);
    try {
      const out = Date.now();
      const payload = {
        checkOutMs: out,
        minutes: minutesBetween(todayRec.checkInMs, out),
        status: attendanceStatus(todayRec.checkInMs, out),
        autoClosed: false, updatedAt: serverTimestamp(),
      };
      if (!live) setRecords(p => p.map(r => r.id === todayRec.id ? { ...r, ...payload } : r));
      else await updateDoc(doc(db, 'attendance', todayRec.id), payload);
    } catch (e) { console.error(e); setError(e.message || 'Check-out failed.'); }
    finally { setBusy(false); }
  };

  // ── history (this month) ────────────────────────────────────────
  const monthF = thisMonthKey();
  const monthRecords = records
    .filter(r => (r.date || '').startsWith(monthF))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const monthMinutes = monthRecords.reduce((s, r) => s + minutesBetween(r.checkInMs, r.checkOutMs), 0);
  const monthStats = {
    present: monthRecords.filter(r => r.status === 'Present').length,
    late:    monthRecords.filter(r => r.status === 'Late').length,
    half:    monthRecords.filter(r => r.status === 'Half Day').length,
  };

  const statusChip = r => {
    const label = r.status || attendanceStatus(r.checkInMs, r.checkOutMs) || '—';
    const color = label === 'Present' ? C.green : label === 'Late' ? C.amber : label === 'Half Day' ? C.blue : C.muted;
    return (
      <span style={{ fontSize: 10, fontWeight: 700, color, padding: '3px 10px', borderRadius: 20,
        background: `${color}18`, border: `1px solid ${color}40` }}>{label}</span>
    );
  };

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: C.muted, fontSize: 13 }}>Loading attendance…</div>;

  const elapsedMins = todayRec?.checkInMs && !todayRec.checkOutMs ? minutesBetween(todayRec.checkInMs, now) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {loadError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10,
          background: 'rgba(240,90,103,0.1)', border: '1px solid rgba(240,90,103,0.35)', color: C.red, fontSize: 12 }}>
          <AlertTriangle size={14} /> {loadError}
        </div>
      )}

      {/* Forgotten check-out banners */}
      {forgottenToday && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '12px 16px', borderRadius: 12,
          background: 'rgba(245,185,66,0.09)', border: '1px solid rgba(245,185,66,0.35)', color: C.amber, fontSize: 12 }}>
          <AlertTriangle size={15} />
          <span style={{ flex: 1, minWidth: 200 }}>
            It's past {AUTOCLOSE_TIME} and you haven't checked out today. Close the day now?
          </span>
          <ERPBtn size="sm" variant="secondary" disabled={busy} onClick={closeTodayAuto}>
            <CheckCircle2 size={12} /> Close at {AUTOCLOSE_TIME}
          </ERPBtn>
        </div>
      )}

      {/* Check in / out widget */}
      <ERPPanel>
        <ERPPanelHeader title={variant === 'checkout' ? 'Check-in / Check-out' : `Today — ${today}`} icon="🕒" />
        <div style={{ padding: 22, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Check In</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: todayRec?.checkInMs ? C.green : C.muted }}>
              {todayRec?.checkInMs ? fmtTime(todayRec.checkInMs) : '—'}
            </div>
          </div>

          <div style={{
            width: 130, height: 130, borderRadius: '50%', flexShrink: 0,
            background: todayRec?.checkInMs
              ? (todayRec.checkOutMs ? 'rgba(24,199,122,0.12)' : 'rgba(0,102,255,0.12)')
              : 'rgba(255,255,255,0.04)',
            border: todayRec?.checkInMs
              ? (todayRec.checkOutMs ? '2px solid rgba(24,199,122,0.5)' : '2px solid rgba(0,102,255,0.5)')
              : `2px solid ${C.border}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
          }}>
            {todayRec?.checkInMs && !todayRec.checkOutMs ? (
              <>
                <Timer size={22} style={{ color: C.blue }} />
                <div style={{ fontSize: 16, fontWeight: 900, color: C.text }}>{fmtHours(elapsedMins)}</div>
                <div style={{ fontSize: 9, color: C.muted }}>elapsed</div>
              </>
            ) : todayRec?.checkOutMs ? (
              <>
                <CheckCircle2 size={22} style={{ color: C.green }} />
                <div style={{ fontSize: 10, color: C.green, fontWeight: 700 }}>Day complete</div>
                <div style={{ fontSize: 9, color: C.muted }}>{fmtHours(todayRec.minutes)}</div>
              </>
            ) : (
              <>
                <LogIn size={22} style={{ color: C.muted }} />
                <div style={{ fontSize: 10, color: C.muted }}>Not checked in</div>
              </>
            )}
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Check Out</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: todayRec?.checkOutMs ? C.green : C.muted }}>
              {todayRec?.checkOutMs ? fmtTime(todayRec.checkOutMs) : '—'}
            </div>
            {todayRec?.autoClosed && <div style={{ fontSize: 9, color: C.amber }}>auto-closed</div>}
          </div>

          <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
            {!todayRec?.checkInMs ? (
              <ERPBtn variant="primary" disabled={busy} onClick={handleCheckIn}
                style={{ minWidth: 180, justifyContent: 'center', padding: '12px 20px' }}>
                <LogIn size={15} /> Check In
              </ERPBtn>
            ) : !todayRec.checkOutMs ? (
              <ERPBtn variant="success" disabled={busy} onClick={handleCheckOut} style={{ minWidth: 180, justifyContent: 'center', padding: '12px 20px' }}>
                <LogOut size={15} /> Check Out
              </ERPBtn>
            ) : (
              <div style={{ fontSize: 11.5, color: C.muted }}>
                Done for today — status: <strong style={{ color: C.subtle }}>{todayRec.status}</strong> · {fmtHours(todayRec.minutes)}
              </div>
            )}
          </div>
          {error && <div style={{ width: '100%', textAlign: 'center', fontSize: 11.5, color: C.red }}>{error}</div>}
          <div style={{ width: '100%', textAlign: 'center', fontSize: 10, color: C.muted }}>
            One check-in per day · forgot to check out? The day closes automatically at {AUTOCLOSE_TIME}.
          </div>
        </div>
      </ERPPanel>

      {/* This month */}
      <ERPPanel>
        <ERPPanelHeader title={`My Attendance — ${monthF}`} icon="📅"
          action={<span style={{ fontSize: 10, color: C.muted }}>Total {fmtHours(monthMinutes)}</span>} />
        {monthRecords.length === 0 ? (
          <ERPEmpty icon="📅" title="No attendance this month yet"
            sub="Your check-ins will be listed here." />
        ) : (
          <>
            <div style={{ display: 'flex', gap: 16, padding: '12px 18px', borderBottom: `1px solid ${C.border}20`, flexWrap: 'wrap' }}>
              {[
                ['Present', monthStats.present, C.green],
                ['Late', monthStats.late, C.amber],
                ['Half Day', monthStats.half, C.blue],
                ['Days Recorded', monthRecords.length, C.cyan],
              ].map(([l, v, col]) => (
                <div key={l} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: col }}>{v}</div>
                  <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Date', 'Check In', 'Check Out', 'Hours', 'Status'].map(h => (
                      <th key={h} style={{ padding: '9px 14px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.8px', color: C.muted, textAlign: 'left', background: 'rgba(10,24,56,0.5)',
                        borderBottom: `1px solid ${C.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthRecords.map(r => (
                    <tr key={r.id}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,102,255,0.04)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '9px 14px', borderTop: `1px solid ${C.border}20`, fontSize: 11.5, color: C.subtle, fontWeight: 600 }}>
                        {r.date}{r.date === today ? ' · today' : ''}
                      </td>
                      <td style={{ padding: '9px 14px', borderTop: `1px solid ${C.border}20`, fontSize: 11.5, color: C.subtle }}>{fmtTime(r.checkInMs)}</td>
                      <td style={{ padding: '9px 14px', borderTop: `1px solid ${C.border}20`, fontSize: 11.5, color: r.autoClosed ? C.amber : C.subtle }}>
                        {r.checkOutMs ? fmtTime(r.checkOutMs) : '—'}{r.autoClosed ? ' (auto)' : ''}
                      </td>
                      <td style={{ padding: '9px 14px', borderTop: `1px solid ${C.border}20`, fontSize: 11.5, fontWeight: 700, color: C.text }}>
                        {fmtHours(minutesBetween(r.checkInMs, r.checkOutMs))}
                      </td>
                      <td style={{ padding: '9px 14px', borderTop: `1px solid ${C.border}20` }}>{statusChip(r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </ERPPanel>
    </div>
  );
}
