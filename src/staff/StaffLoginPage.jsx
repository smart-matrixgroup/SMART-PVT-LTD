// ─────────────────────────────────────────────────────────────────
//  Phase 3 B — Staff Portal login (standalone page, no website
//  chrome). Same useAuth().login() as the client/admin login — the
//  role is resolved from Firestore (staff/{uid}) and the router
//  sends staff here to /staff-portal.
// ─────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { company } from '../config/company';
import { ShieldCheck, Lock, Mail, ArrowRight, Eye, EyeOff, AlertCircle, LogIn } from 'lucide-react';

export default function StaffLoginPage() {
  const navigate = useNavigate();
  const { login, isFirebaseConfigured } = useAuth();

  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [showPass,  setShowPass]  = useState(false);
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(email.trim(), password);
      if (result.role !== 'staff') {
        // Right credentials, wrong portal — send them where they belong.
        navigate(result.role === 'admin' ? '/erp' : '/client-dashboard');
        return;
      }
      navigate('/staff-portal');
    } catch (err) {
      setError(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(1200px 600px at 70% -10%, rgba(0,102,255,0.16), transparent), #040D1F',
      padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 400, background: 'rgba(10,24,56,0.75)', backdropFilter: 'blur(14px)',
        border: '1px solid rgba(0,102,255,0.25)', borderRadius: 22, padding: '34px 30px',
        boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', marginBottom: 22 }}>
          <img src={company.logos.darkMode || company.logos.lightMode} alt="SMART"
            style={{ height: 40, objectFit: 'contain' }}
            onError={e => { e.currentTarget.style.display = 'none'; }} />
        </div>

        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 15, margin: '0 auto 12px',
            background: 'linear-gradient(135deg,#0066FF,#00D9FF)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(0,102,255,0.4)',
          }}>
            <ShieldCheck size={26} color="#fff" />
          </div>
          <div style={{ fontSize: 19, fontWeight: 900, color: '#fff' }}>Staff Portal</div>
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
            Sign in with the account created by your administrator.
          </div>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.65)', marginBottom: 6 }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={15} style={{ position: 'absolute', left: 13, top: 12, color: 'rgba(255,255,255,0.35)' }} />
              <input type="email" required autoComplete="username" value={email}
                onChange={e => setEmail(e.target.value)} placeholder="you@smartpvtltd.com"
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '11px 14px 11px 38px', borderRadius: 12,
                  background: 'rgba(4,13,31,0.7)', border: '1px solid rgba(0,102,255,0.25)', color: '#fff',
                  fontSize: 13, outline: 'none',
                }} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.65)', marginBottom: 6 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={15} style={{ position: 'absolute', left: 13, top: 12, color: 'rgba(255,255,255,0.35)' }} />
              <input type={showPass ? 'text' : 'password'} required autoComplete="current-password"
                value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '11px 40px 11px 38px', borderRadius: 12,
                  background: 'rgba(4,13,31,0.7)', border: '1px solid rgba(0,102,255,0.25)', color: '#fff',
                  fontSize: 13, outline: 'none',
                }} />
              <button type="button" onClick={() => setShowPass(p => !p)}
                style={{ position: 'absolute', right: 12, top: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}>
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10,
              background: 'rgba(240,90,103,0.12)', border: '1px solid rgba(240,90,103,0.35)',
              color: '#F05A67', fontSize: 11.5,
            }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '12px', borderRadius: 12, border: 'none', cursor: loading ? 'wait' : 'pointer',
            background: 'linear-gradient(135deg,#0066FF,#1787FF)', color: '#fff', fontSize: 13, fontWeight: 800,
            boxShadow: '0 8px 22px rgba(0,102,255,0.4)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 8, opacity: loading ? 0.7 : 1,
          }}>
            {loading ? 'Signing in…' : <>Sign In <ArrowRight size={14} /></>}
          </button>
        </form>

        {/* Dev hint (only when Firebase env is not configured) */}
        {!isFirebaseConfigured && (
          <div style={{
            marginTop: 16, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center',
            fontSize: 10.5, color: 'rgba(255,255,255,0.4)',
          }}>
            <LogIn size={11} /> Dev mode: staff@smart.com / staff123
          </div>
        )}

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', fontSize: 10.5, color: 'rgba(255,255,255,0.35)' }}>
          Forgot your password? Your administrator can send a reset email from Staff Management.
        </div>
      </div>
    </div>
  );
}
