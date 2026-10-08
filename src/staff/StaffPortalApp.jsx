// ─────────────────────────────────────────────────────────────────
//  Phase 3 B — Staff Portal shell (standalone route /staff-portal,
//  no website chrome). Fixed dark sidebar (drawer under 900px),
//  header with identity + logout, sections routed via the ?page=
//  search param so links survive refresh.
//
//  Every section reads only the signed-in member's data (authUid /
//  staff doc id == Firebase Auth uid). Respects Admin Access Rules
//  configured in ERP → Access Rules (/erp/access-rules).
// ─────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { company } from '../config/company';
import {
  C, ERPPanel, ERPPanelHeader, ERPBtn, ERPEmpty,
} from '../erp/components/ERPui';
import { DEFAULT_ACCESS_RULES } from '../config/accessRules';
import MyDashboard  from './sections/MyDashboard';
import MyWork       from './sections/MyWork';
import DailyUpdate  from './sections/DailyUpdate';
import MyAttendance from './sections/MyAttendance';
import MyProfile, { MyDocuments } from './sections/MyProfile';
import MySalary     from './sections/MySalary';
import StaffMessages from './sections/StaffMessages';
import StaffClientProjects from './sections/StaffClientProjects';
import {
  LayoutDashboard, Briefcase, ClipboardList, Activity, Timer,
  CalendarCheck, User, IdCard, Award, Wallet, Receipt, MessageSquare,
  LogOut, Menu, FolderKanban, Lock, ShieldAlert
} from 'lucide-react';

const MENU = [
  { group: 'Main', items: [
    { id: 'dashboard',    label: 'Dashboard',            icon: LayoutDashboard, ruleKey: null },
  ]},
  { group: 'Work', items: [
    { id: 'work',         label: 'Assigned Work',        icon: Briefcase, ruleKey: 'allowStaffWork' },
    { id: 'daily',        label: 'Daily Work Update',    icon: ClipboardList, ruleKey: 'allowStaffDailyLog' },
    { id: 'progress',     label: 'Work Progress',        icon: Activity, ruleKey: 'allowStaffWork' },
    { id: 'client_projects', label: 'Client Projects',   icon: FolderKanban, ruleKey: 'allowStaffClientProjects' },
  ]},
  { group: 'Time', items: [
    { id: 'checkout',     label: 'Check-in / Check-out', icon: Timer, ruleKey: 'allowStaffAttendance' },
    { id: 'attendance',   label: 'Attendance',           icon: CalendarCheck, ruleKey: 'allowStaffAttendance' },
  ]},
  { group: 'Personal', items: [
    { id: 'profile',      label: 'Profile',              icon: User, ruleKey: null },
    { id: 'kyc',          label: 'KYC Documents',        icon: IdCard, ruleKey: 'allowStaffDocuments' },
    { id: 'certificates', label: 'Certificates',         icon: Award, ruleKey: 'allowStaffDocuments' },
  ]},
  { group: 'Pay', items: [
    { id: 'salary',       label: 'Salary',               icon: Wallet, ruleKey: 'allowStaffSalary' },
    { id: 'payslips',     label: 'Payslips',             icon: Receipt, ruleKey: 'allowStaffSalary' },
  ]},
  { group: 'Other', items: [
    { id: 'messages',     label: 'Messages',             icon: MessageSquare, ruleKey: 'allowStaffMessages' },
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

function RestrictionScreen({ title, onNavigate }) {
  return (
    <div style={{ maxWidth: 480, margin: '50px auto', padding: '0 16px' }}>
      <ERPPanel style={{ padding: '36px 24px', textAlign: 'center' }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16, background: 'rgba(240,90,103,0.12)',
          color: C.red, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
        }}>
          <Lock size={28} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 8 }}>
          {title || 'Section Access Restricted'}
        </div>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, marginBottom: 20 }}>
          This page is currently restricted for your staff account by the Administrator.
          If your duties require access, please contact management.
        </div>
        <ERPBtn variant="secondary" onClick={() => onNavigate('dashboard')} style={{ margin: '0 auto' }}>
          Back to Dashboard
        </ERPBtn>
      </ERPPanel>
    </div>
  );
}

function Section({ page, onNavigate, isAllowed }) {
  if (!isAllowed) {
    return <RestrictionScreen title={TITLES[page]} onNavigate={onNavigate} />;
  }

  switch (page) {
    case 'work':            return <MyWork variant="assigned" />;
    case 'progress':        return <MyWork variant="progress" />;
    case 'daily':           return <DailyUpdate />;
    case 'client_projects': return <StaffClientProjects isRestricted={false} />;
    case 'checkout':        return <MyAttendance variant="checkout" />;
    case 'attendance':      return <MyAttendance variant="attendance" />;
    case 'profile':         return <MyProfile />;
    case 'kyc':             return <MyDocuments category="kyc" icon={IdCard} />;
    case 'certificates':    return <MyDocuments category="certificate" icon={Award} />;
    case 'salary':          return <MySalary variant="salary" />;
    case 'payslips':        return <MySalary variant="payslips" />;
    case 'messages':        return <StaffMessages />;
    default:                return <MyDashboard onNavigate={onNavigate} />;
  }
}

// ═════════════════════════════════════════════════════════════════
export default function StaffPortalApp() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { staffProfile, loading, logout, isFirebaseConfigured, isDevSession } = useAuth();
  const live = isFirebaseConfigured && !isDevSession;
  const [navOpen, setNavOpen] = useState(false);
  const [accessRules, setAccessRules] = useState(DEFAULT_ACCESS_RULES);

  const page = params.get('page') || 'dashboard';
  const setPage = id => {
    setParams(id === 'dashboard' ? {} : { page: id });
    setNavOpen(false);
  };

  // Sync access rules from Firestore or local cache
  useEffect(() => {
    try {
      const cached = localStorage.getItem('smart_access_rules');
      if (cached) setAccessRules(p => ({ ...p, ...JSON.parse(cached) }));
    } catch { /* ignore */ }

    if (!live) return;

    const unsub = onSnapshot(doc(db, 'settings', 'accessRules'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setAccessRules(prev => ({ ...prev, ...data }));
        localStorage.setItem('smart_access_rules', JSON.stringify(data));
      }
    }, () => {});

    return unsub;
  }, [live]);

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

  // Check if current user is allowed on specific item
  const staffId = staffProfile.id || '';
  const memberOverride = accessRules.memberOverrides?.[staffId] || {};

  const isItemAllowed = (item) => {
    if (!item.ruleKey) return true;
    if (memberOverride[item.ruleKey] !== undefined) {
      return Boolean(memberOverride[item.ruleKey]);
    }
    return Boolean(accessRules[item.ruleKey] ?? true);
  };

  const currentItem = MENU.flatMap(g => g.items).find(i => i.id === page);
  const isCurrentPageAllowed = currentItem ? isItemAllowed(currentItem) : true;

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
                const allowed = isItemAllowed(item);

                return (
                  <button
                    key={item.id}
                    onClick={() => setPage(item.id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 12px', marginBottom: 2, borderRadius: 10, border: 'none',
                      cursor: 'pointer', textAlign: 'left',
                      background: active ? 'linear-gradient(135deg,#0066FF,#1787FF)' : 'transparent',
                      color: active ? '#fff' : allowed ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)',
                      fontSize: 12.5, fontWeight: active ? 800 : 600,
                      boxShadow: active ? '0 4px 14px rgba(0,102,255,0.35)' : 'none',
                      transition: 'all 0.15s'
                    }}
                  >
                    <Icon size={15} style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {!allowed && (
                      <Lock size={12} style={{ color: C.red, opacity: 0.8 }} title="Restricted by Admin" />
                    )}
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

          <button
            onClick={handleLogout}
            title="Sign out"
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: '7px 10px', color: 'rgba(255,255,255,0.75)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700,
            }}
          >
            <LogOut size={13} /> Sign out
          </button>
        </header>

        <main style={{ padding: '20px 24px 60px', maxWidth: 1200, margin: '0 auto' }}>
          <Section page={page} onNavigate={setPage} isAllowed={isCurrentPageAllowed} />
        </main>
      </div>

    </div>
  );
}
