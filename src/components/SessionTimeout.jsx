import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// ─────────────────────────────────────────────────────────────────
//  Session timeout UI — mounted once at the app root, so the admin ERP,
//  the staff portal, the check-in screen and the client portal all share
//  whatever rule AuthContext enforces.
//
//  AuthContext.SESSION_MAX_MINUTES is currently 0 (auto sign-out switched
//  off on request), so nothing here renders. Set that constant back to a
//  positive number and both pieces come alive again with no other change:
//
//  • Countdown chip appears for the last 5 minutes.
//  • When the clock runs out AuthContext signs the tab out and this shows
//    an explanation; dismissing it reloads the route, whose guard sends
//    the user back to the correct sign-in screen.
// ─────────────────────────────────────────────────────────────────
function mmss(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function SessionTimeout() {
  const { sessionRemainingMs, sessionWarnMs, sessionMaxMinutes, sessionExpiredMsg, dismissSessionExpiry } = useAuth();
  const { pathname } = useLocation();

  const isLoginScreen = /login|checkin/i.test(pathname);
  const showChip = !isLoginScreen && sessionRemainingMs != null && sessionRemainingMs <= sessionWarnMs;

  const closeExpired = () => {
    dismissSessionExpiry();
    // Reload so the route guard drops the signed-out user on its login page.
    setTimeout(() => window.location.reload(), 120);
  };

  return (
    <>
      {showChip && (
        <div style={{
          position: 'fixed', top: 14, right: 14, zIndex: 2147483000,
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 13px', borderRadius: 999,
          background: 'rgba(245,158,11,0.95)', color: '#10203A',
          border: '1px solid rgba(255,255,255,0.35)',
          fontSize: 12, fontWeight: 800, letterSpacing: 0.2,
          boxShadow: '0 10px 30px rgba(0,0,0,0.28)',
        }}>
          <span aria-hidden>⏳</span>
          Session ends in {mmss(sessionRemainingMs)}
          <span style={{ fontWeight: 600, opacity: 0.8 }}>— save your work</span>
        </div>
      )}

      {sessionExpiredMsg && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2147483001,
          background: 'rgba(6,12,26,0.78)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{
            width: '100%', maxWidth: 420, borderRadius: 18, padding: 22,
            background: '#0F1B33', border: '1px solid rgba(255,255,255,0.14)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.45)', color: '#E9F0FF',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 22 }} aria-hidden>🔒</span>
              <div style={{ fontSize: 15, fontWeight: 800 }}>Session ended automatically</div>
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.65, color: '#A9BAD6' }}>
              {sessionExpiredMsg}
              <br /><br />
              Nothing you saved is lost — sign in again to continue where you left off.
            </div>
            <button onClick={closeExpired} type="button" style={{
              marginTop: 18, width: '100%', padding: '11px 14px', borderRadius: 11,
              border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 800,
              background: 'linear-gradient(135deg,#0066FF,#00D9FF)', color: '#04101F',
            }}>
              Sign in again
            </button>
            <div style={{ marginTop: 10, fontSize: 10.5, color: '#6C7FA0' }}>
              Security rule: a portal login never stays open longer than {sessionMaxMinutes} minutes.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
