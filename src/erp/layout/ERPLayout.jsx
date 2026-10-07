import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import ERPSidebar from './ERPSidebar';
import ERPTopbar from './ERPTopbar';

// Page title map
const PAGE_META = {
  '/erp':              { title: 'Dashboard',        subtitle: 'Overview of your business operations' },
  '/erp/leads':        { title: 'Leads',             subtitle: 'Client requests & quote submissions' },
  '/erp/clients':      { title: 'Clients',           subtitle: 'Manage all client accounts' },
  '/erp/projects':     { title: 'Projects',          subtitle: 'Track all active & completed projects' },
  '/erp/requirements': { title: 'Requirement Forms', subtitle: 'Build & send requirement forms to clients' },
  '/erp/quotations':   { title: 'Quotations',        subtitle: 'Create & manage client quotations' },
  '/erp/invoices':     { title: 'Invoices',          subtitle: 'Billing & payment records' },
  '/erp/staff':        { title: 'Staff',             subtitle: 'Team management & salary tracking' },
  '/erp/messages':     { title: 'Messages',          subtitle: 'All client conversations' },
  '/erp/analytics':    { title: 'Analytics',         subtitle: 'Business performance insights' },
  '/erp/achievements': { title: 'Achievements',      subtitle: 'Milestones & success stories' },
  '/erp/settings':     { title: 'Settings',          subtitle: 'System & account configuration' },
};

// Dev mock notifications
const DEV_NOTIFICATIONS = [
  { icon: '🔔', text: 'New client request from Rahul M. — ERP System', time: '2 min ago', read: false },
  { icon: '✅', text: 'John P. accepted quotation #QT-024', time: '18 min ago', read: false },
  { icon: '💰', text: 'Advance payment confirmed — Sarah F.', time: '1 hr ago', read: true },
  { icon: '📝', text: 'Requirement form filled by Kumar A.', time: '2 hr ago', read: true },
];

export default function ERPLayout() {
  const location = useLocation();
  const { isDevSession } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [leadCount, setLeadCount]   = useState(0);
  const [msgCount,  setMsgCount]    = useState(0);
  const [notifications, setNotifications] = useState(DEV_NOTIFICATIONS);

  const meta = PAGE_META[location.pathname] || { title: 'ERP', subtitle: '' };

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Live lead count from Firestore
  useEffect(() => {
    if (!isFirebaseConfigured || isDevSession) {
      setLeadCount(3); // dev mock
      return;
    }
    const q = query(collection(db, 'leads'), where('status', '==', 'New'));
    return onSnapshot(q, snap => setLeadCount(snap.size));
  }, [isDevSession]);

  const toggleSidebar = () => {
    if (isMobile) setMobileOpen(o => !o);
    else setCollapsed(c => !c);
  };

  const sidebarWidth = isMobile ? 0 : (collapsed ? 64 : 224);

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      background: '#040D1F',
      position: 'relative',
    }}>
      {/* ── Background effects ── */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: `
          radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0,102,255,0.18), transparent),
          radial-gradient(ellipse 50% 40% at 85% 85%, rgba(0,217,255,0.06), transparent),
          linear-gradient(180deg, #040D1F 0%, #060F20 100%)
        `,
      }} />
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: `
          linear-gradient(rgba(32,52,93,0.3) 1px, transparent 1px),
          linear-gradient(90deg, rgba(32,52,93,0.3) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
        maskImage: 'radial-gradient(ellipse 100% 100% at 50% 0%, black 30%, transparent 75%)',
        WebkitMaskImage: 'radial-gradient(ellipse 100% 100% at 50% 0%, black 30%, transparent 75%)',
      }} />
      {/* Glow orbs */}
      <div style={{ position:'fixed', width:500, height:500, borderRadius:'50%', background:'rgba(0,102,255,0.06)', filter:'blur(100px)', top:-150, right:-100, pointerEvents:'none', zIndex:0 }} />
      <div style={{ position:'fixed', width:350, height:350, borderRadius:'50%', background:'rgba(0,217,255,0.04)', filter:'blur(80px)', bottom:50, left:50, pointerEvents:'none', zIndex:0 }} />

      {/* Mobile overlay */}
      {isMobile && mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 40 }}
        />
      )}

      {/* ── Sidebar (desktop rail + mobile drawer) ── */}
      <div style={{
        position: isMobile ? 'fixed' : 'relative',
        zIndex: 50,
        flexShrink: 0,
        height: '100%',
        width: isMobile ? 224 : sidebarWidth,
        transform: isMobile && !mobileOpen ? 'translateX(-105%)' : 'none',
        transition: 'transform 0.25s ease, width 0.3s',
        boxShadow: isMobile && mobileOpen ? '8px 0 32px rgba(0,0,0,0.45)' : 'none',
      }}>
        <ERPSidebar
          collapsed={!isMobile && collapsed}
          onToggle={toggleSidebar}
          badges={{ leads: leadCount, messages: msgCount }}
        />
      </div>

      {/* ── Main area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', zIndex: 10 }}>
        <ERPTopbar
          title={meta.title}
          subtitle={meta.subtitle}
          onToggleSidebar={toggleSidebar}
          sidebarCollapsed={isMobile ? !mobileOpen : collapsed}
          notifications={notifications}
        />

        {/* Page content */}
        <main style={{
          flex: 1,
          overflowY: 'auto',
          padding: 24,
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(32,52,93,0.8) transparent',
        }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
