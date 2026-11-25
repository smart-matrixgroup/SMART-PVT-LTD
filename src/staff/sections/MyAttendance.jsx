// ─────────────────────────────────────────────────────────────────
//  Phase 3 E (portal side) — Check-in / Check-out + my Attendance.
//  One record per staff per day (the portal blocks a second check-in
//  both in UI and by re-querying before create). Forgotten check-outs
//  are closed gracefully at 17:30 with an autoClosed flag — past days
//  auto-close on load, today shows a banner after 17:30.
//  Includes Monochrome Selfie Camera Verification and Out-of-Office
//  Movement tracking.
// ─────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, doc, query, where, limit, getDocs, serverTimestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { ERPPanel, ERPPanelHeader, ERPBtn, ERPModal, C } from '../../erp/components/ERPui';
import StaffEmpty from '../components/StaffEmpty';
import SelfieModal from '../components/SelfieModal';
import {
  todayKey, thisMonthKey, fmtTime, fmtHours, minutesBetween,
  attendanceStatus, AUTOCLOSE_TIME,
} from '../staffUtils';
import { saveTablePdf } from '../../erp/utils/reportPdf.js';
import { OFFICIAL_ATTENDANCE_RECORDS } from '../../erp/data/officialAttendance.js';
import {
  Download, LogIn, LogOut, AlertTriangle, Timer, CheckCircle2,
  Camera, Briefcase, User, Navigation, Eye, Check, Clock
} from 'lucide-react';

const DEV_ATT = OFFICIAL_ATTENDANCE_RECORDS;

const autoCloseMsFor = date => new Date(`${date}T${AUTOCLOSE_TIME}:00`).getTime();

export default function MyAttendance({ variant = 'attendance', onNavigate }) {
  const { staffProfile, isFirebaseConfigured, isDevSession } = useAuth();
  const live = isFirebaseConfigured && !isDevSession;
  const uid = staffProfile?.id || '';

  const [records,  setRecords]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState(null);
  const [now,      setNow]      = useState(Date.now());

  // Selfie Modal state
  const [selfieModal, setSelfieModal] = useState({ open: false, type: 'checkin' });
  const [photoPreview, setPhotoPreview] = useState(null); // { url, type, time, kb }

  // Out-of-Office / Movement Tracking state
  const [stepOutModal, setStepOutModal] = useState(false);
  const [stepOutType, setStepOutType] = useState('office'); // 'office' | 'personal'
  const [stepOutReason, setStepOutReason] = useState('');

  useEffect(() => {
    const staffMatches = r => r.authUid === uid || sameStaffName(r.staffName, staffProfile?.name);
    const myOfficial = OFFICIAL_ATTENDANCE_RECORDS.filter(staffMatches);
    if (!live) {
      setRecords(myOfficial.length ? myOfficial : DEV_ATT);
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      query(collection(db, 'attendance'), where('authUid', '==', uid)),
      snap => {
        const liveDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const liveDates = new Set(liveDocs.map(d => d.date));
        const missingHist = myOfficial.filter(r => !liveDates.has(r.date));
        setRecords([...liveDocs, ...missingHist].sort((a, b) => String(b.date).localeCompare(String(a.date))));
        setLoading(false);
      },
      err => { console.error(err); setLoadError(`Attendance — ${err.message}`); setLoading(false); },
    );
    const t = setInterval(() => setNow(Date.now()), 15000); // keep elapsed timer fresh
    return () => { unsub(); clearInterval(t); };
  }, [live, uid, staffProfile?.name]);

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

  // ── check in with selfie ─────────────────────────────────────────
  const handleCheckInWithPhoto = async (photoResult) => {
    setBusy(true); setError(null);
    try {
      const at = photoResult?.timestamp || Date.now();
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
        checkInPhoto: photoResult?.dataUrl || null,
        checkInPhotoKb: photoResult?.sizeKb || null,
        checkInTime: fmtTime(at),
        breaks: [],
        isOutOffice: false,
        autoClosed: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      };
      if (!live) setRecords(p => [{ id: `dev-${Date.now()}`, ...payload, createdAt: Date.now() }, ...p]);
      else await addDoc(collection(db, 'attendance'), payload);
    } catch (e) { console.error(e); setError(e.message || 'Check-in failed.'); }
    finally { setBusy(false); }
  };

  // ── check out with selfie ────────────────────────────────────────
  const handleCheckOutWithPhoto = async (photoResult) => {
    if (!todayRec?.id) return;
    setBusy(true); setError(null);
    try {
      const out = photoResult?.timestamp || Date.now();
      // If staff is currently stepped out, automatically close that movement
      const updatedBreaks = (todayRec.breaks || []).map(b => (!b.inMs ? { ...b, inMs: out, durationMinutes: Math.max(1, Math.round((out - b.outMs) / 60000)) } : b));

      const payload = {
        checkOutMs: out,
        checkOutPhoto: photoResult?.dataUrl || null,
        checkOutPhotoKb: photoResult?.sizeKb || null,
        checkOutTime: fmtTime(out),
        minutes: minutesBetween(todayRec.checkInMs, out),
        status: attendanceStatus(todayRec.checkInMs, out),
        breaks: updatedBreaks,
        isOutOffice: false,
        autoClosed: false, updatedAt: serverTimestamp(),
      };
      if (!live) setRecords(p => p.map(r => r.id === todayRec.id ? { ...r, ...payload } : r));
      else await updateDoc(doc(db, 'attendance', todayRec.id), payload);
    } catch (e) { console.error(e); setError(e.message || 'Check-out failed.'); }
    finally { setBusy(false); }
  };

  // ── Out-of-Office / Movement Tracking ────────────────────────────
  const handleStepOut = async () => {
    if (!todayRec?.id) return;
    setBusy(true); setError(null);
    try {
      const stepOutTime = Date.now();
      const newTrip = {
        id: `brk-${stepOutTime}`,
        type: stepOutType, // 'office' | 'personal'
        reason: stepOutReason.trim() || (stepOutType === 'office' ? 'Official Office Errand' : 'Personal Break'),
        outMs: stepOutTime,
        outTime: fmtTime(stepOutTime),
        inMs: 0,
        inTime: '',
        durationMinutes: 0,
      };
      const updatedBreaks = [...(todayRec.breaks || []), newTrip];
      const payload = {
        breaks: updatedBreaks,
        isOutOffice: true,
        updatedAt: serverTimestamp(),
      };
      if (!live) {
        setRecords(p => p.map(r => r.id === todayRec.id ? { ...r, ...payload } : r));
      } else {
        await updateDoc(doc(db, 'attendance', todayRec.id), payload);
      }
      setStepOutModal(false);
      setStepOutReason('');
    } catch (e) {
      console.error(e);
      setError('Could not mark out of office: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleReturnToOffice = async () => {
    if (!todayRec?.id) return;
    setBusy(true); setError(null);
    try {
      const returnTime = Date.now();
      const updatedBreaks = (todayRec.breaks || []).map(b => {
        if (!b.inMs) {
          const duration = Math.max(1, Math.round((returnTime - b.outMs) / 60000));
          return {
            ...b,
            inMs: returnTime,
            inTime: fmtTime(returnTime),
            durationMinutes: duration,
          };
        }
        return b;
      });
      const payload = {
        breaks: updatedBreaks,
        isOutOffice: false,
        updatedAt: serverTimestamp(),
      };
      if (!live) {
        setRecords(p => p.map(r => r.id === todayRec.id ? { ...r, ...payload } : r));
      } else {
        await updateDoc(doc(db, 'attendance', todayRec.id), payload);
      }
    } catch (e) {
      console.error(e);
      setError('Could not mark return to office: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  // Active out-of-office trip (if any)
  const activeTrip = todayRec?.isOutOffice
    ? (todayRec.breaks?.find(b => !b.inMs) || todayRec.breaks?.[todayRec.breaks.length - 1])
    : null;
  const activeTripMins = activeTrip ? Math.max(0, Math.round((now - activeTrip.outMs) / 60000)) : 0;

  // ── history: month picker + every record ────────────────────────
  const [range, setRange] = useState(() => thisMonthKey());

  const months = useMemo(() => {
    const set = new Set(records.map(r => String(r.date || '').slice(0, 7)).filter(Boolean));
    set.add(thisMonthKey());
    return Array.from(set).sort().reverse();
  }, [records]);

  const viewRecords = records
    .filter(r => range === 'all' || String(r.date || '').startsWith(range))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  // A day still in progress counts up to the live clock, so the table and
  // the total agree with the punch screen instead of showing 0h 00m.
  const minutesOf = r => minutesBetween(r.checkInMs, r.checkOutMs || (r.date === today ? now : null));
  const viewMinutes = viewRecords.reduce((s, r) => s + minutesOf(r), 0);
  // Average over closed days only — a day still in progress would drag it down.
  const closedDays = viewRecords.filter(r => r.checkOutMs).length;
  const closedMinutes = viewRecords
    .filter(r => r.checkOutMs)
    .reduce((s, r) => s + minutesBetween(r.checkInMs, r.checkOutMs), 0);
  const avgMinutes = closedDays ? Math.round(closedMinutes / closedDays) : 0;
  const viewStats = {
    present: viewRecords.filter(r => r.status === 'Present').length,
    late:    viewRecords.filter(r => r.status === 'Late').length,
    half:    viewRecords.filter(r => r.status === 'Half Day').length,
    auto:    viewRecords.filter(r => r.autoClosed).length,
    days:    viewRecords.length,
  };
  const rangeLabel = range === 'all'
    ? 'All records'
    : new Date(`${range}-01T12:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const dayName = date => {
    const d = new Date(`${date}T12:00:00`);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { weekday: 'short' });
  };
  const prettyDay = date => {
    const d = new Date(`${date}T12:00:00`);
    return Number.isNaN(d.getTime()) ? (date || '—') : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // ── PDF of exactly what is on screen ────────────────────────────
  const downloadPdf = () => {
    if (!viewRecords.length) return;
    saveTablePdf({
      title: 'Attendance Statement',
      subtitle: `${staffProfile?.name || 'Staff'}${range === 'all' ? '' : ` — ${rangeLabel}`}`,
      meta: [
        staffProfile?.staffId ? `Staff ID: ${staffProfile.staffId}` : '',
        staffProfile?.role || staffProfile?.position ? `Position: ${staffProfile.role || staffProfile.position}` : '',
        `Generated: ${new Date().toLocaleString('en-GB')}`,
      ].filter(Boolean),
      summary: [
        { label: 'Days recorded', value: String(viewStats.days) },
        { label: 'Present', value: String(viewStats.present) },
        { label: 'Late', value: String(viewStats.late) },
        { label: 'Half day', value: String(viewStats.half) },
        { label: 'Total hours', value: fmtHours(viewMinutes) },
        { label: 'Avg / day', value: closedDays ? fmtHours(avgMinutes) : '—' },
      ],
      columns: [
        { label: 'Date', width: 1.3 },
        { label: 'Day', width: 0.7 },
        { label: 'Check in', width: 1 },
        { label: 'Check out', width: 1.1 },
        { label: 'Hours', width: 0.8, align: 'right' },
        { label: 'Status', width: 1 },
      ],
      rows: viewRecords.map(r => [
        prettyDay(r.date),
        dayName(r.date),
        r.checkInMs ? fmtTime(r.checkInMs) : '—',
        r.checkOutMs ? `${fmtTime(r.checkOutMs)}${r.autoClosed ? ' (auto)' : ''}` : '—',
        fmtHours(minutesOf(r)),
        r.status || attendanceStatus(r.checkInMs, r.checkOutMs) || '—',
      ]),
      statusCol: 5,
      footNote: `${viewStats.auto} day(s) were closed automatically at ${AUTOCLOSE_TIME}. Check-ins are recorded once per day with monochrome selfie verification.`,
      generatedBy: staffProfile?.name || 'staff',
    }, `ATTENDANCE-${String(staffProfile?.name || 'STAFF').toUpperCase().replace(/[^A-Z0-9]+/g, '-')}-${range === 'all' ? 'ALL' : range}.pdf`);
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
  const prettyToday = new Date(`${today}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const liveClock = new Date(now).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  // ── Focused punch screen ────────────────────────────────────────
  // This section exists for one action: check in, then check out. The
  // history lives in Attendance, so this screen stays big and quiet.
  if (variant === 'checkout') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {loadError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10,
            background: 'rgba(240,90,103,0.1)', border: '1px solid rgba(240,90,103,0.35)', color: C.red, fontSize: 12 }}>
            <AlertTriangle size={14} /> {loadError}
          </div>
        )}

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

        <ERPPanel>
          <ERPPanelHeader title="Check-in / Check-out" icon={<Timer size={15} />}
            action={<span style={{ fontSize: 11, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{liveClock}</span>} />
          <div style={{ padding: '20px 20px 26px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>
              {prettyToday}
            </div>

            {/* Main Punch Clock / Status Dial */}
            <div style={{
              width: 176, height: 176, borderRadius: '50%',
              background: todayRec?.checkInMs
                ? (todayRec.checkOutMs ? 'rgba(24,199,122,0.10)' : todayRec.isOutOffice ? 'rgba(245,185,66,0.12)' : 'rgba(0,102,255,0.12)')
                : 'rgba(255,255,255,0.035)',
              border: todayRec?.checkInMs
                ? (todayRec.checkOutMs ? '2px solid rgba(24,199,122,0.55)' : todayRec.isOutOffice ? '2px solid rgba(245,185,66,0.65)' : '2px solid rgba(23,135,255,0.55)')
                : `2px solid ${C.border}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
              boxShadow: todayRec?.isOutOffice ? '0 0 20px rgba(245,185,66,0.2)' : 'none',
              transition: 'all 0.3s ease',
            }}>
              {todayRec?.checkInMs && !todayRec.checkOutMs ? (
                <>
                  {todayRec.isOutOffice ? (
                    <>
                      <Navigation size={26} style={{ color: C.amber, animation: 'bounce 1s infinite' }} />
                      <div style={{ fontSize: 20, fontWeight: 900, color: C.amber, fontVariantNumeric: 'tabular-nums' }}>
                        {fmtHours(activeTripMins)}
                      </div>
                      <div style={{ fontSize: 9.5, color: C.amber, fontWeight: 700 }}>Out of Office</div>
                    </>
                  ) : (
                    <>
                      <Timer size={26} style={{ color: C.blue }} />
                      <div style={{ fontSize: 24, fontWeight: 900, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{fmtHours(elapsedMins)}</div>
                      <div style={{ fontSize: 9.5, color: C.muted }}>working now</div>
                    </>
                  )}
                </>
              ) : todayRec?.checkOutMs ? (
                <>
                  <CheckCircle2 size={26} style={{ color: C.green }} />
                  <div style={{ fontSize: 12, fontWeight: 800, color: C.green }}>Day complete</div>
                  <div style={{ fontSize: 17, fontWeight: 900, color: C.text }}>{fmtHours(todayRec.minutes)}</div>
                </>
              ) : (
                <>
                  <LogIn size={26} style={{ color: C.muted }} />
                  <div style={{ fontSize: 11.5, color: C.muted }}>Not checked in</div>
                </>
              )}
            </div>

            {/* Check-in / Check-out times & photo thumbnails */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', maxWidth: 360 }}>
              <div style={{
                textAlign: 'center', padding: '11px 8px', borderRadius: 12,
                background: 'rgba(255,255,255,0.035)', border: `1px solid ${C.border}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              }}>
                <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8 }}>Check in</div>
                <div style={{ fontSize: 17, fontWeight: 900, color: todayRec?.checkInMs ? C.green : C.muted, fontVariantNumeric: 'tabular-nums' }}>
                  {todayRec?.checkInMs ? fmtTime(todayRec.checkInMs) : '—'}
                </div>
                {todayRec?.checkInPhoto && (
                  <button
                    onClick={() => setPhotoPreview({ url: todayRec.checkInPhoto, type: 'Check-in', time: fmtTime(todayRec.checkInMs), kb: todayRec.checkInPhotoKb })}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(0,102,255,0.15)',
                      border: '1px solid rgba(0,102,255,0.3)', borderRadius: 20, padding: '2px 8px',
                      color: C.blue, fontSize: 9.5, fontWeight: 700, cursor: 'pointer', marginTop: 2,
                    }}
                  >
                    <Camera size={10} /> View B&W ({todayRec.checkInPhotoKb || '—'} KB)
                  </button>
                )}
              </div>

              <div style={{
                textAlign: 'center', padding: '11px 8px', borderRadius: 12,
                background: 'rgba(255,255,255,0.035)', border: `1px solid ${C.border}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              }}>
                <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8 }}>Check out</div>
                <div style={{ fontSize: 17, fontWeight: 900, color: todayRec?.checkOutMs ? C.green : C.muted, fontVariantNumeric: 'tabular-nums' }}>
                  {todayRec?.checkOutMs ? fmtTime(todayRec.checkOutMs) : '—'}
                </div>
                {todayRec?.checkOutPhoto && (
                  <button
                    onClick={() => setPhotoPreview({ url: todayRec.checkOutPhoto, type: 'Check-out', time: fmtTime(todayRec.checkOutMs), kb: todayRec.checkOutPhotoKb })}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(24,199,122,0.15)',
                      border: '1px solid rgba(24,199,122,0.3)', borderRadius: 20, padding: '2px 8px',
                      color: C.green, fontSize: 9.5, fontWeight: 700, cursor: 'pointer', marginTop: 2,
                    }}
                  >
                    <Camera size={10} /> View B&W ({todayRec.checkOutPhotoKb || '—'} KB)
                  </button>
                )}
              </div>
            </div>

            {/* Check-In / Check-Out Buttons with Camera Verification */}
            <div style={{ width: '100%', maxWidth: 360 }}>
              {!todayRec?.checkInMs ? (
                <ERPBtn
                  variant="primary"
                  disabled={busy}
                  onClick={() => setSelfieModal({ open: true, type: 'checkin' })}
                  style={{ width: '100%', justifyContent: 'center', padding: '14px 20px', fontSize: 14 }}
                >
                  <Camera size={17} /> {busy ? 'Checking in…' : 'Take Selfie & Check In'}
                </ERPBtn>
              ) : !todayRec.checkOutMs ? (
                <ERPBtn
                  variant="success"
                  disabled={busy}
                  onClick={() => setSelfieModal({ open: true, type: 'checkout' })}
                  style={{ width: '100%', justifyContent: 'center', padding: '14px 20px', fontSize: 14 }}
                >
                  <Camera size={17} /> {busy ? 'Checking out…' : 'Take Selfie & Check Out'}
                </ERPBtn>
              ) : (
                <div style={{
                  textAlign: 'center', padding: '12px', borderRadius: 12,
                  background: 'rgba(24,199,122,0.10)', border: '1px solid rgba(24,199,122,0.35)',
                  fontSize: 11.5, color: C.green, fontWeight: 700,
                }}>
                  Attendance complete for today · {todayRec.status} · {fmtHours(todayRec.minutes)}
                </div>
              )}
            </div>

            {/* ── Office Movement / Step Out (Out-Office & In-Office) ──── */}
            {todayRec?.checkInMs && !todayRec.checkOutMs && (
              <div style={{
                width: '100%', maxWidth: 360, background: 'rgba(4,13,31,0.6)',
                border: `1px solid ${todayRec.isOutOffice ? C.amber : C.border}`,
                borderRadius: 14, padding: 14, marginTop: 4,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Navigation size={14} style={{ color: todayRec.isOutOffice ? C.amber : C.blue }} />
                    <span style={{ fontSize: 12, fontWeight: 800, color: C.text }}>
                      Office Movement Tracker
                    </span>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                    background: todayRec.isOutOffice ? 'rgba(245,185,66,0.15)' : 'rgba(24,199,122,0.15)',
                    color: todayRec.isOutOffice ? C.amber : C.green,
                    border: `1px solid ${todayRec.isOutOffice ? C.amber : C.green}40`,
                  }}>
                    {todayRec.isOutOffice ? 'Out of Office' : 'At Desk / In Office'}
                  </span>
                </div>

                {todayRec.isOutOffice ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{
                      padding: '10px 12px', borderRadius: 10,
                      background: 'rgba(245,185,66,0.08)', border: '1px solid rgba(245,185,66,0.3)',
                      fontSize: 11.5, color: C.subtle, lineHeight: 1.5,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, color: activeTrip?.type === 'office' ? C.blue : C.amber }}>
                          {activeTrip?.type === 'office' ? '🏢 Official Work' : '👤 Personal Reason'}
                        </span>
                        <span style={{ color: C.muted }}>Since {activeTrip?.outTime || '—'}</span>
                      </div>
                      <div style={{ color: C.text, fontWeight: 600 }}>{activeTrip?.reason}</div>
                      <div style={{ marginTop: 4, fontSize: 10.5, color: C.amber, fontWeight: 700 }}>
                        Away duration: {fmtHours(activeTripMins)}
                      </div>
                    </div>

                    <ERPBtn
                      variant="primary"
                      disabled={busy}
                      onClick={handleReturnToOffice}
                      style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 13 }}
                    >
                      <Check size={15} /> Back to Office (Mark In-Office)
                    </ERPBtn>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>
                      Stepping out for office errands or personal needs? Mark out-office with your reason:
                    </div>
                    <ERPBtn
                      variant="secondary"
                      disabled={busy}
                      onClick={() => setStepOutModal(true)}
                      style={{ width: '100%', justifyContent: 'center', padding: '10px', fontSize: 12 }}
                    >
                      <Navigation size={13} /> Step Out / Mark Out-Office
                    </ERPBtn>
                  </div>
                )}

                {/* Today's movement trip logs */}
                {(todayRec.breaks || []).length > 0 && (
                  <div style={{ marginTop: 12, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>
                      Today's Movements ({(todayRec.breaks || []).length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 140, overflowY: 'auto' }}>
                      {(todayRec.breaks || []).map((b, idx) => (
                        <div key={b.id || idx} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.025)',
                          fontSize: 10.5, border: `1px solid ${C.border}20`,
                        }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{
                                fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 6,
                                background: b.type === 'office' ? 'rgba(0,102,255,0.15)' : 'rgba(245,185,66,0.15)',
                                color: b.type === 'office' ? C.blue : C.amber,
                              }}>
                                {b.type === 'office' ? 'Official' : 'Personal'}
                              </span>
                              <span style={{ color: C.text, fontWeight: 600 }}>{b.reason}</span>
                            </div>
                            <span style={{ color: C.muted, fontSize: 9.5 }}>
                              {b.outTime || fmtTime(b.outMs)} → {b.inTime || (b.inMs ? fmtTime(b.inMs) : 'Active now')}
                            </span>
                          </div>
                          <span style={{ fontWeight: 800, color: b.inMs ? C.subtle : C.amber, fontVariantNumeric: 'tabular-nums' }}>
                            {b.inMs ? `${b.durationMinutes || 0}m` : 'Now'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && <div style={{ fontSize: 11.5, color: C.red, textAlign: 'center' }}>{error}</div>}

            <div style={{ fontSize: 9.5, color: C.muted, textAlign: 'center', lineHeight: 1.6 }}>
              One check-in per day. A missing check-out closes automatically at {AUTOCLOSE_TIME}.
              Monochrome selfie photo and exact upload time are automatically recorded.
            </div>

            <button onClick={() => onNavigate?.('attendance')} style={{
              background: 'none', border: 'none', color: C.blue, fontSize: 11, fontWeight: 700, cursor: 'pointer',
            }}>
              View full attendance history →
            </button>
          </div>
        </ERPPanel>

        {/* Selfie Camera Modal */}
        <SelfieModal
          isOpen={selfieModal.open}
          onClose={() => setSelfieModal({ open: false, type: 'checkin' })}
          onConfirm={selfieModal.type === 'checkin' ? handleCheckInWithPhoto : handleCheckOutWithPhoto}
          actionType={selfieModal.type}
          staffName={staffProfile?.name || ''}
        />

        {/* Step-Out / Out-Office Modal */}
        <ERPModal isOpen={stepOutModal} onClose={() => setStepOutModal(false)} title="Mark Out-Office / Step Out" width={420}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 11.5, color: C.muted }}>
              Specify the reason for leaving the office. Departure time will automatically record as <strong>{fmtTime(now)}</strong>.
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.subtle, marginBottom: 6 }}>
                Reason Category
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setStepOutType('office')}
                  style={{
                    padding: '10px', borderRadius: 10, cursor: 'pointer',
                    background: stepOutType === 'office' ? 'rgba(0,102,255,0.18)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${stepOutType === 'office' ? C.blue : C.border}`,
                    color: stepOutType === 'office' ? C.blue : C.subtle,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, fontWeight: 700,
                  }}
                >
                  <Briefcase size={14} /> Official Work
                </button>
                <button
                  type="button"
                  onClick={() => setStepOutType('personal')}
                  style={{
                    padding: '10px', borderRadius: 10, cursor: 'pointer',
                    background: stepOutType === 'personal' ? 'rgba(245,185,66,0.18)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${stepOutType === 'personal' ? C.amber : C.border}`,
                    color: stepOutType === 'personal' ? C.amber : C.subtle,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, fontWeight: 700,
                  }}
                >
                  <User size={14} /> Personal Reason
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.subtle, marginBottom: 6 }}>
                Purpose / Remarks
              </label>
              <input
                type="text"
                value={stepOutReason}
                onChange={e => setStepOutReason(e.target.value)}
                placeholder={stepOutType === 'office' ? 'e.g. Client meeting at Branch B, bank deposit' : 'e.g. Lunch break, personal doctor visit'}
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10,
                  background: 'rgba(4,13,31,0.8)', border: `1px solid ${C.border}`, color: '#fff', fontSize: 12, outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
              <ERPBtn variant="secondary" onClick={() => setStepOutModal(false)}>Cancel</ERPBtn>
              <ERPBtn variant="primary" disabled={busy} onClick={handleStepOut}>
                <Check size={14} /> Confirm Step Out
              </ERPBtn>
            </div>
          </div>
        </ERPModal>

        {/* Photo Preview Modal */}
        {photoPreview && (
          <ERPModal isOpen={!!photoPreview} onClose={() => setPhotoPreview(null)} title={`${photoPreview.type} Selfie`} width={360}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <img
                src={photoPreview.url}
                alt="Selfie"
                style={{ width: '100%', maxWidth: 280, borderRadius: 14, filter: 'grayscale(100%)', border: `1px solid ${C.border}` }}
              />
              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: C.subtle }}>
                <span>Exact Time: <strong>{photoPreview.time}</strong></span>
                <span>Capacity: <strong>{photoPreview.kb} KB</strong></span>
              </div>
            </div>
          </ERPModal>
        )}
      </div>
    );
  }

  // ── History View (Attendance Tab) ─────────────────────────────────
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

      {/* Today at a glance */}
      <ERPPanel>
        <ERPPanelHeader title={`Today — ${today}`} icon={<Timer size={15} />}
          action={(
            <ERPBtn size="sm" variant={todayRec?.checkOutMs ? 'secondary' : 'primary'} onClick={() => onNavigate?.('checkout')}>
              <Timer size={12} /> {todayRec?.checkOutMs ? 'Punch screen' : 'Go to Check-in'}
            </ERPBtn>
          )} />
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: 1, background: `${C.border}30`,
        }}>
          {[
            ['Status', todayRec?.checkOutMs ? 'Completed' : todayRec?.isOutOffice ? 'Out Office' : todayRec?.checkInMs ? 'Working' : 'Not checked in',
              todayRec?.checkOutMs ? C.green : todayRec?.isOutOffice ? C.amber : todayRec?.checkInMs ? C.blue : C.muted],
            ['Check in', todayRec?.checkInMs ? fmtTime(todayRec.checkInMs) : '—', todayRec?.checkInMs ? C.text : C.muted],
            ['Check out', todayRec?.checkOutMs ? fmtTime(todayRec.checkOutMs) : '—', todayRec?.checkOutMs ? C.text : C.muted],
            ['Hours', todayRec?.checkInMs
              ? fmtHours(minutesBetween(todayRec.checkInMs, todayRec.checkOutMs || now))
              : '0h 00m', C.text],
          ].map(([label, value, color]) => (
            <div key={label} style={{ background: 'rgba(10,24,56,0.45)', padding: '13px 16px' }}>
              <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.7px' }}>{label}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
            </div>
          ))}
        </div>
        {error && <div style={{ padding: '8px 16px', fontSize: 11.5, color: C.red }}>{error}</div>}
      </ERPPanel>

      {/* Full attendance history — month by month + all records */}
      <ERPPanel>
        <ERPPanelHeader title={`My Attendance — ${rangeLabel}`} icon="📅"
          action={viewRecords.length ? (
            <ERPBtn size="sm" variant="secondary" onClick={downloadPdf}>
              <Download size={12} /> PDF
            </ERPBtn>
          ) : null} />

        <div style={{
          display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
          padding: '11px 18px', borderBottom: `1px solid ${C.border}20`,
        }}>
          <select value={range} onChange={e => setRange(e.target.value)}
            style={{
              background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`, borderRadius: 9,
              padding: '7px 10px', color: C.text, fontSize: 11.5, outline: 'none', cursor: 'pointer',
            }}>
            {months.map(m => (
              <option key={m} value={m} style={{ background: '#0A1838' }}>
                {new Date(`${m}-01T12:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
              </option>
            ))}
            <option value="all" style={{ background: '#0A1838' }}>All records</option>
          </select>
          <span style={{ fontSize: 10.5, color: C.muted }}>
            {viewStats.days} day{viewStats.days === 1 ? '' : 's'} · {fmtHours(viewMinutes)} total
          </span>
          {viewStats.auto > 0 && (
            <span style={{ fontSize: 10.5, color: C.amber }}>{viewStats.auto} auto-closed</span>
          )}
        </div>

        {viewRecords.length === 0 ? (
          <StaffEmpty icon="📅" from="#18C77A" to="#00D9FF" title="No attendance in this period"
            sub="Your check-ins will be listed here." />
        ) : (
          <>
            <div style={{ display: 'flex', gap: 18, padding: '12px 18px', borderBottom: `1px solid ${C.border}20`, flexWrap: 'wrap' }}>
              {[
                ['Present', viewStats.present, C.green],
                ['Late', viewStats.late, C.amber],
                ['Half Day', viewStats.half, C.blue],
                ['Days', viewStats.days, C.cyan],
                ['Total hours', fmtHours(viewMinutes), C.violet],
                ['Avg / day', closedDays ? fmtHours(avgMinutes) : '—', C.green],
              ].map(([l, v, col]) => (
                <div key={l} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: col }}>{v}</div>
                  <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 580 }}>
                <thead>
                  <tr>
                    {['Date', 'Day', 'Check In', 'Check Out', 'Hours', 'Status'].map((h, i) => (
                      <th key={h} style={{ padding: '9px 14px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.8px', color: C.muted, textAlign: i === 4 ? 'right' : 'left',
                        background: 'rgba(10,24,56,0.5)', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                    <th style={{ padding: '9px 14px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.8px', color: C.muted, textAlign: 'left',
                      background: 'rgba(10,24,56,0.5)', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>
                      Selfie / Out-Office
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {viewRecords.map(r => (
                    <tr key={r.id}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,102,255,0.04)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '9px 14px', borderTop: `1px solid ${C.border}20`, fontSize: 11.5, color: C.subtle, fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {r.date}{r.date === today ? ' · today' : ''}
                      </td>
                      <td style={{ padding: '9px 14px', borderTop: `1px solid ${C.border}20`, fontSize: 11, color: C.muted }}>
                        {dayName(r.date)}
                      </td>
                      <td style={{ padding: '9px 14px', borderTop: `1px solid ${C.border}20`, fontSize: 11.5, color: C.subtle }}>{fmtTime(r.checkInMs)}</td>
                      <td style={{ padding: '9px 14px', borderTop: `1px solid ${C.border}20`, fontSize: 11.5, color: r.autoClosed ? C.amber : C.subtle }}>
                        {r.checkOutMs ? fmtTime(r.checkOutMs) : '—'}{r.autoClosed ? ' (auto)' : ''}
                      </td>
                      <td style={{ padding: '9px 14px', borderTop: `1px solid ${C.border}20`, fontSize: 11.5, fontWeight: 700, color: C.text, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {fmtHours(minutesOf(r))}
                      </td>
                      <td style={{ padding: '9px 14px', borderTop: `1px solid ${C.border}20` }}>{statusChip(r)}</td>
                      <td style={{ padding: '9px 14px', borderTop: `1px solid ${C.border}20` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {r.checkInPhoto && (
                            <button
                              onClick={() => setPhotoPreview({ url: r.checkInPhoto, type: 'Check-in', time: fmtTime(r.checkInMs), kb: r.checkInPhotoKb })}
                              title={`Check-in Selfie (${r.checkInPhotoKb || '—'} KB)`}
                              style={{
                                background: 'rgba(0,102,255,0.12)', border: '1px solid rgba(0,102,255,0.25)',
                                borderRadius: 14, padding: '2px 7px', color: C.blue, fontSize: 10, cursor: 'pointer',
                                display: 'inline-flex', alignItems: 'center', gap: 3,
                              }}
                            >
                              <Camera size={10} /> IN
                            </button>
                          )}
                          {r.checkOutPhoto && (
                            <button
                              onClick={() => setPhotoPreview({ url: r.checkOutPhoto, type: 'Check-out', time: fmtTime(r.checkOutMs), kb: r.checkOutPhotoKb })}
                              title={`Check-out Selfie (${r.checkOutPhotoKb || '—'} KB)`}
                              style={{
                                background: 'rgba(24,199,122,0.12)', border: '1px solid rgba(24,199,122,0.25)',
                                borderRadius: 14, padding: '2px 7px', color: C.green, fontSize: 10, cursor: 'pointer',
                                display: 'inline-flex', alignItems: 'center', gap: 3,
                              }}
                            >
                              <Camera size={10} /> OUT
                            </button>
                          )}
                          {(r.breaks || []).length > 0 && (
                            <span style={{
                              fontSize: 9.5, padding: '2px 6px', borderRadius: 8,
                              background: 'rgba(245,185,66,0.1)', color: C.amber, border: '1px solid rgba(245,185,66,0.25)',
                            }}>
                              {(r.breaks || []).length} trip(s)
                            </span>
                          )}
                          {!r.checkInPhoto && !r.checkOutPhoto && (!r.breaks || r.breaks.length === 0) && (
                            <span style={{ fontSize: 11, color: C.muted }}>—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </ERPPanel>

      {/* Selfie Preview Modal */}
      {photoPreview && (
        <ERPModal isOpen={!!photoPreview} onClose={() => setPhotoPreview(null)} title={`${photoPreview.type} Selfie`} width={360}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <img
              src={photoPreview.url}
              alt="Selfie"
              style={{ width: '100%', maxWidth: 280, borderRadius: 14, filter: 'grayscale(100%)', border: `1px solid ${C.border}` }}
            />
            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: C.subtle }}>
              <span>Exact Time: <strong>{photoPreview.time}</strong></span>
              <span>Capacity: <strong>{photoPreview.kb} KB</strong></span>
            </div>
          </div>
        </ERPModal>
      )}

      {/* Selfie Camera Modal */}
      <SelfieModal
        isOpen={selfieModal.open}
        onClose={() => setSelfieModal({ open: false, type: 'checkin' })}
        onConfirm={selfieModal.type === 'checkin' ? handleCheckInWithPhoto : handleCheckOutWithPhoto}
        actionType={selfieModal.type}
        staffName={staffProfile?.name || ''}
      />
    </div>
  );
}
