// ─────────────────────────────────────────────────────────────────
//  Phase 3 B — Staff Portal shell (standalone route /staff-portal,
//  no website chrome). Fixed dark sidebar (drawer under 900px),
//  header with identity + logout, sections routed via the ?page=
//  search param so links survive refresh.
//
//  Every section reads only the signed-in member's data (authUid /
//  staff doc id == Firebase Auth uid). The security rules are the
//  real enforcement layer — the UI simply never queries beyond it.
// ─────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { company } from '../config/company';
import {
  C, ERPPanel, ERPPanelHeader, ERPBtn, ERPEmpty,
} from '../erp/components/ERPui';
import MyDashboard  from './sections/MyDashboard';
import MyWork       from './sections/MyWork';
import DailyUpdate  from './sections/DailyUpdate';
import MyAttendance from './sections/MyAttendance';
import MyProfile, { MyDocuments } from './sections/MyProfile';
import MySalary     from './sections/MySalary';
import StaffMessages from './sections/StaffMessages';
import {
  LayoutDashboard, Briefcase, ClipboardList, Activity, Timer,
  CalendarCheck, User, IdCard, Award, Wallet, Receipt, MessageSquare,
  LogOut, Menu,
} from 'lucide-react';

const MENU = [
  { group: 'Main', items: [
    { id: 'dashboard',    label: 'Dashboard',            icon: LayoutDashboard },
  ]},
  { group: 'Work', items: [
    { id: 'work',         label: 'Assigned Work',        icon: Briefcase },
    { id: 'daily',        label: 'Daily Work Update',    icon: ClipboardList },
    { id: 'progress',     label: 'Work Progress',        icon: Activity },
  ]},
  { group: 'Time', items: [
    { id: 'checkout',     label: 'Check-in / Check-out', icon: Timer },
    { id: 'attendance',   label: 'Attendance',           icon: CalendarCheck },
  ]},
  { group: 'Personal', items: [
    { id: 'profile',      label: 'Profile',              icon: User },
    { id: 'kyc',          label: 'KYC Documents',        icon: IdCard },
    { id: 'certificates', label: 'Certificates',         icon: Award },
  ]},
  { group: 'Pay', items: [
    { id: 'salary',       label: 'Salary',               icon: Wallet },
    { id: 'payslips',     label: 'Payslips',             icon: Receipt },
  ]},
  { group: 'Other', items: [
    { id: 'messages',     label: 'Messages',             icon: MessageSquare },
  ]},
];

const TITLES = Object.fromEntries(MENU.flatMap(g => g.items.map(i => [i.id, i.label])));

const PORTAL_CSS = `
  .sp-main { margin-left: 230px; min-height: 100vh; }
  .sp-overlay { display: none; }
  .sp-hamburger { display: none; }
  @media (max-width: 900px) {
    .sp-sidebar { transform: translateX(-105%); transition: transform 0.2s ease; }
    .sp-sidebar.sp-open { transform: translateX(0); box-shadow: 0 20px 60px rgba(0,0,0,0.6); }
    .sp-overlay { display: block; position: fixed; inset: 0; background: rgba(2,8,23,0.6); z-index: 30; }
    .sp-main { margin-left: 0; }
    .sp-hamburger { display: inline-flex; }
  }
  @media (max-width: 640px) {
    .sp-usermeta { display: none !important; }
  }
`;

function Section({ page, onNavigate }) {
  switch (page) {
    case 'work':         return <MyWork variant="assigned" />;
    case 'progress':     return <MyWork variant="progress" />;
    case 'daily':        return <DailyUpdate />;
    case 'checkout':     return <MyAttendance variant="checkout" />;
    case 'attendance':   return <MyAttendance variant="attendance" />;
    case 'profile':      return <MyProfile />;
    case 'kyc':          return <MyDocuments category="kyc" icon={IdCard} />;
    case 'certificates': return <MyDocuments category="certificate" icon={Award} />;
    case 'salary':       return <MySalary variant="salary" />;
    case 'payslips':     return <MySalary variant="payslips" />;
    case 'messages':     return <StaffMessages />;
    default:             return <MyDashboard onNavigate={onNavigate} />;
  }
}

// ═════════════════════════════════════════════════════════════════
export default function StaffPortalApp() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { staffProfile, loading, logout } = useAuth();
  const [navOpen, setNavOpen] = useState(false);

  const page = params.get('page') || 'dashboard';
  const setPage = id => {
    setParams(id === 'dashboard' ? {} : { page: id });
    setNavOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/staff-login');
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#040D1F', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          border: '3px solid rgba(0,102,255,0.2)', borderTopColor: '#0066FF',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  // Signed in but no staff/{uid} profile — deactivated or not provisioned.
  if (!staffProfile) {
    return (
      <div style={{
        minHeight: '100vh', background: '#040D1F', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 20,
      }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <ERPPanel>
            <ERPPanelHeader title="Staff profile not found" icon={User} />
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 14, lineHeight: 1.6 }}>
              Your account is signed in, but no staff profile is linked to it — it may have
              been deactivated. Please contact your administrator.
            </div>
            <ERPBtn variant="secondary" onClick={handleLogout}>
              <LogOut size={13} /> Sign out
            </ERPBtn>
          </ERPPanel>
        </div>
      </div>
    );
  }

  const initials = (staffProfile.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div style={{ minHeight: '100vh', background: '#040D1F' }}>
      <style>{PORTAL_CSS}</style>

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside
        className={`sp-sidebar ${navOpen ? 'sp-open' : ''}`}
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, width: 230, zIndex: 40,
          background: '#071230', borderRight: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', flexDirection: 'column', overflowY: 'auto',
        }}
      >
        <div style={{
          height: 62, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10,
          padding: '0 16px', borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <img
            src={company.logos.darkMode || company.logos.lightMode}
            alt="SMART"
            style={{ height: 30, objectFit: 'contain' }}
            onError={e => { e.currentTarget.style.display = 'none'; }}
          />
          <div style={{ fontSize: 12.5, fontWeight: 900, color: '#fff', letterSpacing: 0.3 }}>
            Staff Portal
          </div>
        </div>

        <nav style={{ flex: 1, padding: '12px 10px 20px' }}>
          {MENU.map(group => (
            <div key={group.group} style={{ marginBottom: 14 }}>
              <div style={{
                fontSize: 9.5, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.32)', padding: '0 10px 6px',
              }}>
                {group.group}
              </div>
              {group.items.map(item => {
                const active = page === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setPage(item.id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 12px', marginBottom: 2, borderRadius: 10, border: 'none',
                      cursor: 'pointer', textAlign: 'left',
                      background: active ? 'linear-gradient(135deg,#0066FF,#1787FF)' : 'transparent',
                      color: active ? '#fff' : 'rgba(255,255,255,0.6)',
                      fontSize: 12.5, fontWeight: active ? 800 : 600,
                      boxShadow: active ? '0 4px 14px rgba(0,102,255,0.35)' : 'none',
                    }}
                  >
                    <Icon size={15} style={{ flexShrink: 0 }} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      {navOpen && <div className="sp-overlay" onClick={() => setNavOpen(false)} />}

      {/* ── Main column ─────────────────────────────────────────── */}
      <div className="sp-main">
        <header style={{
          height: 62, position: 'sticky', top: 0, zIndex: 20,
          display: 'flex', alignItems: 'center', gap: 12, padding: '0 18px',
          background: 'rgba(7,18,48,0.85)', backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <button
            className="sp-hamburger"
            onClick={() => setNavOpen(true)}
            title="Open menu"
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: 6 }}
          >
            <Menu size={20} />
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 14, fontWeight: 800, color: '#fff',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {TITLES[page] || 'Dashboard'}
            </div>
          </div>

          <div className="sp-usermeta" style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{staffProfile.name}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
              {staffProfile.role || staffProfile.staffId || 'Staff'}
            </div>
          </div>

          <div style={{
            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg,#0066FF,#00D9FF)', color: '#fff',
            fontSize: 12.5, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {initials}
          </div>

          <button
            onClick={handleLogout}
            title="Sign out"
            style={{
              background: 'rgba(240,90,103,0.12)', border: '1px solid rgba(240,90,103,0.35)',
              color: '#F05A67', borderRadius: 10, padding: '7px 9px', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center',
            }}
          >
            <LogOut size={15} />
          </button>
        </header>

        <main style={{ padding: 20 }}>
          <div style={{ maxWidth: 1080, margin: '0 auto' }}>
            <Section page={page} onNavigate={setPage} />
          </div>
        </main>
      </div>
    </div>
  );
}
