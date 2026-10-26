// ─────────────────────────────────────────────────────────────────
//  Office Attendance QR page (/staff-checkin).
//  Staff scan the QR kept at the office entrance, sign in with their
//  staff email + password, and ONLY check in / check out — nothing
//  else is shown. Records go to the same `attendance` collection the
//  Staff Portal and ERP Attendance report read.
// ─────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  collection, onSnapshot, addDoc, updateDoc, doc, query, where, limit,
  getDocs, serverTimestamp,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { company } from '../config/company';
import {
  todayKey, fmtTime, fmtHours, minutesBetween, attendanceStatus, AUTOCLOSE_TIME,
} from '../staff/staffUtils';
import {
  Mail, Lock, Eye, EyeOff, LogIn, LogOut, CheckCircle2, Timer,
  ShieldCheck, AlertCircle, ArrowRight, CalendarCheck,
} from 'lucide-react';

const C = {
  bg: '#040D1F',
  card: 'rgba(10,24,56,0.82)',
  border: 'rgba(255,255,255,0.10)',
  text: '#F1F5F9',
  subtle: '#CBD5E1',
  muted: '#7C93B8',
  blue: '#1787FF',
  green: '#18C77A',
  amber: '#F5B942',
  red: '#F05A67',
};

const PAGE_CSS = `
  * { -webkit-tap-highlight-color: transparent; }
  .ci-input {
    width: 100%; box-sizing: border-box; padding: 12px 14px 12px 40px; border-radius: 12px;
    background: rgba(4,13,31,0.72); border: 1px solid rgba(0,102,255,0.28); color: #fff;
    font-size: 14px; outline: none;
  }
  .ci-input:focus { border-color: rgba(0,180,255,0.7); box-shadow: 0 0 0 3px rgba(0,102,255,0.14); }
  .ci-btn { transition: transform 0.12s ease, box-shadow 0.12s ease, opacity 0.12s ease; }
  .ci-btn:active:not(:disabled) { transform: scale(0.97); }
  .ci-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  @keyframes ci-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(23,135,255,0.30); } 50% { box-shadow: 0 0 0 14px rgba(23,135,255,0); } }
  .ci-pulse { animation: ci-pulse 2.2s ease-out infinite; }
  @media (max-width: 420px) {
    .ci-outer { padding: 14px !important; }
    .ci-card { padding: 24px 18px !important; border-radius: 20px !important; }
  }
`;

export default function StaffCheckInPage() {
  const navigate = useNavigate();
  const {
    currentUser, role, staffProfile, loading, login, logout,
    isFirebaseConfigured: fbConfigured, isDevSession,
  } = useAuth();
  const live = fbConfigured && !isDevSession;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [authError, setAuthError] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  const [records, setRecords] = useState([]);
  const [loadingAtt, setLoadingAtt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [now, setNow] = useState(Date.now());

  const uid = staffProfile?.id || '';
  const today = todayKey();

  // Live clock (elapsed timer + header)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Own attendance records only (rules allow authUid == uid)
  useEffect(() => {
    if (role !== 'staff' || !uid || !live) { setRecords([]); return; }
    setLoadingAtt(true);
    const un = onSnapshot(
      query(collection(db, 'attendance'), where('authUid', '==', uid)),
      snap => {
        setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoadingAtt(false);
      },
      err => {
        console.error('Check-in attendance listener error', err);
        setError(`Could not load attendance — ${err.message}`);
        setLoadingAtt(false);
      },
    );
    return un;
  }, [role, uid, live]);

  const todayRec = records.find(r => r.date === today) || null;

  const handleLogin = async e => {
    e.preventDefault();
    setAuthError('');
    setSigningIn(true);
    try {
      const result = await login(email.trim(), password);
      if (result.role !== 'staff') {
        await logout();
        setAuthError('This QR is for staff accounts only. Please sign in with your staff email.');
        return;
      }
      setPassword('');
    } catch (err) {
      setAuthError(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setSigningIn(false);
    }
  };

  const handleCheckIn = async () => {
    setBusy(true); setError(''); setOkMsg('');
    try {
      const at = Date.now();
      if (live) {
        const dup = await getDocs(query(
          collection(db, 'attendance'),
          where('authUid', '==', uid), where('date', '==', today), limit(1),
        ));
        if (!dup.empty && dup.docs[0].data().checkInMs) {
          setError('You are already checked in today.');
          return;
        }
        await addDoc(collection(db, 'attendance'), {
          staffId: uid, staffName: staffProfile?.name || '—', authUid: uid,
          date: today, checkInMs: at, checkOutMs: 0,
          minutes: 0, status: attendanceStatus(at, 0) || 'Present',
          autoClosed: false, source: 'office-qr',
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        });
      } else {
        setRecords(p => [{
          id: `dev-${Date.now()}`, staffId: uid, staffName: staffProfile?.name || '—',
          authUid: uid, date: today, checkInMs: at, checkOutMs: 0, minutes: 0,
          status: 'Present', autoClosed: false,
        }, ...p]);
      }
      setOkMsg(`Checked in at ${fmtTime(at)}. Have a great day!`);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Check-in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleCheckOut = async () => {
    if (!todayRec?.id) return;
    setBusy(true); setError(''); setOkMsg('');
    try {
      const out = Date.now();
      const payload = {
        checkOutMs: out,
        minutes: minutesBetween(todayRec.checkInMs, out),
        status: attendanceStatus(todayRec.checkInMs, out),
        autoClosed: false,
        updatedAt: serverTimestamp(),
      };
      if (live) await updateDoc(doc(db, 'attendance', todayRec.id), payload);
      else setRecords(p => p.map(r => r.id === todayRec.id ? { ...r, ...payload } : r));
      setOkMsg(`Checked out at ${fmtTime(out)} — ${fmtHours(payload.minutes)} recorded.`);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Check-out failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    setOkMsg(''); setError('');
    await logout();
  };

  const wrap = children => (
    <div className="ci-outer" style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(1000px 520px at 75% -10%, rgba(0,102,255,0.20), transparent), #040D1F',
      padding: 20,
    }}>
      <style>{PAGE_CSS}</style>
      <div style={{ width: '100%', maxWidth: 430 }}>{children}</div>
      <div style={{
        position: 'fixed', bottom: 14, left: 0, right: 0, textAlign: 'center',
        fontSize: 10, color: 'rgba(255,255,255,0.28)', pointerEvents: 'none',
      }}>
        {company.fullName} · Office Attendance
      </div>
    </div>
  );

  if (loading) {
    return wrap(
      <div style={{ textAlign: 'center', color: C.muted, fontSize: 12 }}>
        <div style={{
          width: 34, height: 34, margin: '0 auto 12px', borderRadius: '50%',
          border: '3px solid rgba(0,102,255,0.2)', borderTopColor: '#0066FF',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        Checking your session…
      </div>
    );
  }

  // ── Signed in with a non-staff account ──────────────────────────
  if (currentUser && role && role !== 'staff') {
    return wrap(
      <div className="ci-card" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 24, padding: '32px 26px', textAlign: 'center', backdropFilter: 'blur(16px)' }}>
        <div style={{ width: 54, height: 54, borderRadius: 16, margin: '0 auto 14px', background: 'rgba(240,90,103,0.14)', color: C.red, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ShieldCheck size={26} />
        </div>
        <div style={{ fontSize: 17, fontWeight: 900, color: C.text }}>Staff QR only</div>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, marginTop: 8 }}>
          You are signed in with a {role} account. Scan again with a staff email, or open your own portal.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 18 }}>
          <button onClick={handleSignOut} className="ci-btn" style={{
            padding: '11px', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg,#0066FF,#1787FF)', color: '#fff', fontSize: 13, fontWeight: 800,
          }}>Sign out & use a staff account</button>
          <Link to={role === 'admin' ? '/erp' : '/client-dashboard'} style={{
            padding: '10px', borderRadius: 12, textDecoration: 'none', textAlign: 'center',
            background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`, color: C.subtle, fontSize: 12, fontWeight: 700,
          }}>Open my portal</Link>
        </div>
      </div>
    );
  }

  // ── Signed-in staff but profile missing ─────────────────────────
  if (currentUser && role === 'staff' && !staffProfile) {
    return wrap(
      <div className="ci-card" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 24, padding: '32px 26px', textAlign: 'center' }}>
        <div style={{ fontSize: 17, fontWeight: 900, color: C.text }}>Staff profile not found</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 8, lineHeight: 1.6 }}>
          Your login works, but no staff profile is linked to it. Please contact your administrator.
        </div>
        <button onClick={handleSignOut} className="ci-btn" style={{
          marginTop: 18, padding: '11px 18px', borderRadius: 12, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg,#0066FF,#1787FF)', color: '#fff', fontSize: 13, fontWeight: 800,
        }}>Sign out</button>
      </div>
    );
  }

  // ── Not signed in → staff login only ────────────────────────────
  if (!currentUser || role !== 'staff') {
    return wrap(
      <div className="ci-card" style={{
        background: C.card, backdropFilter: 'blur(16px)', border: '1px solid rgba(0,102,255,0.26)',
        borderRadius: 24, padding: '30px 26px', boxShadow: '0 26px 70px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <img src={company.logos.darkMode || company.logos.lightMode} alt="SMART"
            style={{ height: 38, objectFit: 'contain' }}
            onError={e => { e.currentTarget.style.display = 'none'; }} />
        </div>

        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div className="ci-pulse" style={{
            width: 56, height: 56, borderRadius: 17, margin: '0 auto 12px',
            background: 'linear-gradient(135deg,#0066FF,#00D9FF)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 10px 28px rgba(0,102,255,0.42)',
          }}>
            <CalendarCheck size={28} color="#fff" />
          </div>
          <div style={{ fontSize: 19, fontWeight: 900, color: '#fff', letterSpacing: 0.2 }}>Office Attendance</div>
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.48)', marginTop: 5, lineHeight: 1.5 }}>
            Sign in with your staff email and only check in / out.
          </div>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div style={{ position: 'relative' }}>
            <Mail size={15} style={{ position: 'absolute', left: 13, top: 14, color: 'rgba(255,255,255,0.35)' }} />
            <input className="ci-input" type="email" required autoComplete="username"
              value={email} onChange={e => setEmail(e.target.value)}
              placeholder="your.name@smartpvtltd.com" />
          </div>

          <div style={{ position: 'relative' }}>
            <Lock size={15} style={{ position: 'absolute', left: 13, top: 14, color: 'rgba(255,255,255,0.35)' }} />
            <input className="ci-input" type={showPass ? 'text' : 'password'} required autoComplete="current-password"
              value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Password" style={{ paddingRight: 42 }} />
            <button type="button" onClick={() => setShowPass(p => !p)} style={{
              position: 'absolute', right: 10, top: 11, background: 'none', border: 'none',
              cursor: 'pointer', color: 'rgba(255,255,255,0.42)', padding: 4,
            }}>
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {authError && (
            <div style={{
              display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10,
              background: 'rgba(240,90,103,0.12)', border: '1px solid rgba(240,90,103,0.35)',
              color: C.red, fontSize: 11.5, lineHeight: 1.45,
            }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {authError}
            </div>
          )}

          <button type="submit" disabled={signingIn} className="ci-btn" style={{
            width: '100%', padding: '13px', borderRadius: 12, border: 'none',
            cursor: signingIn ? 'wait' : 'pointer',
            background: 'linear-gradient(135deg,#0066FF,#1787FF)', color: '#fff',
            fontSize: 13.5, fontWeight: 800, display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 8, boxShadow: '0 10px 24px rgba(0,102,255,0.38)',
          }}>
            {signingIn ? 'Signing in…' : <>Sign in to check in <ArrowRight size={15} /></>}
          </button>
        </form>

        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 10.5, color: 'rgba(255,255,255,0.32)', lineHeight: 1.6 }}>
          Forgot your password? Ask your administrator to send a reset email.
        </div>
      </div>
    );
  }

  // ── Staff signed in → check-in / check-out only ─────────────────
  const elapsedMins = todayRec?.checkInMs && !todayRec.checkOutMs ? minutesBetween(todayRec.checkInMs, now) : 0;
  const doneToday = Boolean(todayRec?.checkOutMs);
  const statusLabel = doneToday ? 'Day complete' : todayRec?.checkInMs ? 'Checked in' : 'Not checked in';
  const statusColor = doneToday ? C.green : todayRec?.checkInMs ? C.blue : C.muted;

  return wrap(
    <div className="ci-card" style={{
      background: C.card, backdropFilter: 'blur(16px)', border: '1px solid rgba(0,102,255,0.24)',
      borderRadius: 24, padding: '26px 24px', boxShadow: '0 26px 70px rgba(0,0,0,0.5)',
    }}>
      {/* identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 13, flexShrink: 0,
          background: 'linear-gradient(135deg,#0066FF,#8B5CF6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 16, fontWeight: 900,
        }}>
          {(staffProfile?.name || 'S').charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {staffProfile?.name || 'Staff'}
          </div>
          <div style={{ fontSize: 10.5, color: C.muted }}>
            {staffProfile?.role || staffProfile?.staffId || 'Staff'} · Office attendance
          </div>
        </div>
        <button onClick={handleSignOut} title="Sign out" style={{
          background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`,
          borderRadius: 9, padding: '7px 9px', color: C.subtle, cursor: 'pointer',
        }}>
          <LogOut size={14} />
        </button>
      </div>

      {/* date + live clock */}
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>
          {new Date(now).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
        <div style={{ fontSize: 30, fontWeight: 900, color: C.text, fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>
          {new Date(now).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {/* status ring */}
      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        <div style={{
          width: 158, height: 158, borderRadius: '50%', margin: '0 auto',
          background: doneToday ? 'rgba(24,199,122,0.10)' : todayRec?.checkInMs ? 'rgba(0,102,255,0.12)' : 'rgba(255,255,255,0.04)',
          border: `2px solid ${doneToday ? 'rgba(24,199,122,0.5)' : todayRec?.checkInMs ? 'rgba(23,135,255,0.5)' : 'rgba(255,255,255,0.12)'}`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
        }}>
          {doneToday ? (
            <>
              <CheckCircle2 size={30} style={{ color: C.green }} />
              <div style={{ fontSize: 12, fontWeight: 800, color: C.green }}>{statusLabel}</div>
              <div style={{ fontSize: 15, fontWeight: 900, color: C.text }}>{fmtHours(todayRec.minutes)}</div>
            </>
          ) : todayRec?.checkInMs ? (
            <>
              <Timer size={28} style={{ color: C.blue }} />
              <div style={{ fontSize: 21, fontWeight: 900, color: C.text, fontVariantNumeric: 'tabular-nums' }}>
                {fmtHours(elapsedMins)}
              </div>
              <div style={{ fontSize: 9.5, color: C.muted }}>working now</div>
            </>
          ) : (
            <>
              <LogIn size={28} style={{ color: C.muted }} />
              <div style={{ fontSize: 11, color: C.muted }}>{statusLabel}</div>
            </>
          )}
        </div>
        <div style={{ fontSize: 10, color: statusColor, fontWeight: 700, marginTop: 8 }}>{statusLabel}</div>
      </div>

      {/* in/out times */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16,
      }}>
        {[
          ['Check in', todayRec?.checkInMs ? fmtTime(todayRec.checkInMs) : '—', todayRec?.checkInMs ? C.green : C.muted],
          ['Check out', todayRec?.checkOutMs ? fmtTime(todayRec.checkOutMs) : '—', todayRec?.checkOutMs ? C.green : C.muted],
        ].map(([label, val, tone]) => (
          <div key={label} style={{
            textAlign: 'center', padding: '11px 8px', borderRadius: 12,
            background: 'rgba(255,255,255,0.035)', border: `1px solid ${C.border}`,
          }}>
            <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: tone, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{val}</div>
          </div>
        ))}
      </div>

      {/* action */}
      {!todayRec?.checkInMs ? (
        <button onClick={handleCheckIn} disabled={busy || loadingAtt} className="ci-btn" style={{
          width: '100%', padding: '15px', borderRadius: 14, border: 'none',
          cursor: busy ? 'wait' : 'pointer', background: 'linear-gradient(135deg,#0066FF,#1787FF)',
          color: '#fff', fontSize: 14.5, fontWeight: 900, display: 'flex',
          alignItems: 'center', justifyContent: 'center', gap: 9,
          boxShadow: '0 12px 28px rgba(0,102,255,0.4)',
        }}>
          <LogIn size={18} /> {busy ? 'Checking in…' : 'Check In'}
        </button>
      ) : !todayRec.checkOutMs ? (
        <button onClick={handleCheckOut} disabled={busy || loadingAtt} className="ci-btn" style={{
          width: '100%', padding: '15px', borderRadius: 14, border: 'none',
          cursor: busy ? 'wait' : 'pointer', background: 'linear-gradient(135deg,#18C77A,#0E9E63)',
          color: '#fff', fontSize: 14.5, fontWeight: 900, display: 'flex',
          alignItems: 'center', justifyContent: 'center', gap: 9,
          boxShadow: '0 12px 28px rgba(24,199,122,0.35)',
        }}>
          <LogOut size={18} /> {busy ? 'Checking out…' : 'Check Out'}
        </button>
      ) : (
        <div style={{
          textAlign: 'center', padding: '13px', borderRadius: 14,
          background: 'rgba(24,199,122,0.10)', border: '1px solid rgba(24,199,122,0.35)',
          fontSize: 12, color: C.green, fontWeight: 700,
        }}>
          ✓ Attendance complete for today
        </div>
      )}

      {okMsg && (
        <div style={{ marginTop: 10, textAlign: 'center', fontSize: 11.5, color: C.green, lineHeight: 1.5 }}>{okMsg}</div>
      )}
      {error && (
        <div style={{ marginTop: 10, textAlign: 'center', fontSize: 11.5, color: C.red, lineHeight: 1.5 }}>{error}</div>
      )}

      <div style={{ marginTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12, textAlign: 'center' }}>
        <div style={{ fontSize: 9.5, color: C.muted, lineHeight: 1.6 }}>
          One check-in per day. Forgot to check out? The day closes automatically at {AUTOCLOSE_TIME}.
        </div>
        <button onClick={() => navigate('/staff-portal')} style={{
          marginTop: 8, background: 'none', border: 'none', color: C.blue,
          fontSize: 11, fontWeight: 700, cursor: 'pointer',
        }}>
          Open full staff portal →
        </button>
      </div>
    </div>
  );
}
