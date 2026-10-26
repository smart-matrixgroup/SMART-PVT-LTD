import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import ERPSidebar from './ERPSidebar';
import ERPTopbar from './ERPTopbar';
import { accentForPath } from '../config/moduleAccents';

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
  { icon: '🔔', text: 'New client request from Rahul M. — ERP System', time: '2 min ago', read: false, link: '/erp/leads' },
  { icon: '✅', text: 'John P. accepted quotation #QT-024', time: '18 min ago', read: false, link: '/erp/quotations' },
  { icon: '💰', text: 'Advance payment confirmed — Sarah F.', time: '1 hr ago', read: true, link: '/erp/invoices' },
  { icon: '📝', text: 'Requirement form filled by Kumar A.', time: '2 hr ago', read: true, link: '/erp/requirements' },
];

// "2 min ago" style stamp for live lead notifications
const relTime = (ts) => {
  if (!ts?.toDate) return 'just now';
  const mins = Math.floor((Date.now() - ts.toDate().getTime()) / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} d ago`;
};

export default function ERPLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isDevSession } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [leadCount, setLeadCount]   = useState(0);
  const [msgCount,  setMsgCount]    = useState(0);
  const [notifications, setNotifications] = useState(DEV_NOTIFICATIONS);
  // Live website/QR request notifications (bell dropdown)
  const [liveNotifs, setLiveNotifs] = useState([]);
  const [readIds,    setReadIds]    = useState([]);
  const seededNotifs = useRef(false);
  const contentRef   = useRef(null);
  const tiltRef      = useRef(null);

  const meta = PAGE_META[location.pathname] || { title: 'ERP', subtitle: '' };
  const currentAccent = accentForPath(location.pathname);

  // Mouse-reactive 3D tilt of the page content (no glow — real motion feel).
  useEffect(() => {
    const el = tiltRef.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const onMove = (e) => {
      const rect = el.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width  - 0.5; // -0.5..0.5
      const ny = (e.clientY - rect.top)  / rect.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transform = `perspective(1400px) rotateX(${(-ny * 1.6).toFixed(2)}deg) rotateY(${(nx * 1.6).toFixed(2)}deg)`;
      });
    };
    const onLeave = () => { el.style.transform = 'perspective(1400px) rotateX(0deg) rotateY(0deg)'; };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [location.pathname]);

  // Button ripple across every admin page (delegated from the content area).
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const onDown = (e) => {
      const btn = e.target.closest('button, .erp-btn, .erp-hover');
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const ink = document.createElement('span');
      ink.className = 'sp-ripple-ink';
      ink.style.width = ink.style.height = `${size}px`;
      ink.style.left = `${e.clientX - rect.left - size / 2}px`;
      ink.style.top  = `${e.clientY - rect.top  - size / 2}px`;
      if (!/sp-ripple/.test(btn.className)) btn.classList.add('sp-ripple');
      btn.appendChild(ink);
      setTimeout(() => ink.remove(), 600);
    };
    el.addEventListener('pointerdown', onDown);
    return () => el.removeEventListener('pointerdown', onDown);
  }, [location.pathname]);

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

  // Live unread message count from Firestore conversations
  useEffect(() => {
    if (!isFirebaseConfigured || isDevSession) {
      setMsgCount(2); // dev mock: 2 unread conversations
      return;
    }
    const q = query(collection(db, 'conversations'));
    return onSnapshot(q, (snap) => {
      let count = 0;
      snap.docs.forEach(d => {
        const data = d.data();
        if ((data.unreadForAdmin || 0) > 0) count++;
      });
      setMsgCount(count);
    }, () => setMsgCount(0));
  }, [isDevSession]);

  // ── Live admin notifications ─────────────────────────────────────
  // Every website request form submission (including QR-scan requests)
  // lands in `leads`. Mirror the newest ones into the topbar bell so the
  // admin is pinged the moment a customer submits. Leads that already
  // existed when the admin opened ERP start as read — only NEW arrivals
  // show the unread dot.
  useEffect(() => {
    if (!isFirebaseConfigured || isDevSession) return;
    const q = query(collection(db, 'leads'), orderBy('createdAt', 'desc'), limit(8));
    return onSnapshot(q, snap => {
      const items = snap.docs.map(d => {
        const L = d.data();
        const viaQR = String(L.page || '').includes('/services/qr/');
        return {
          id:   d.id,
          icon: viaQR ? '📱' : '🌐',
          text: `New request: ${L.name || 'Guest'} — ${L.service || 'Service'}${L.company ? ` (${L.company})` : ''} · ${L.phone || L.email || ''}${viaQR ? ' · via QR scan' : ''}`,
          time: relTime(L.createdAt),
          link: '/erp/leads',
        };
      });
      setLiveNotifs(items);
      if (!seededNotifs.current) {
        seededNotifs.current = true;
        setReadIds(items.map(i => i.id));
      }
    });
  }, [isDevSession]);

  const useLiveNotifs = isFirebaseConfigured && !isDevSession;
  const bellNotifications = useLiveNotifs
    ? liveNotifs.map(n => ({ ...n, read: readIds.includes(n.id) }))
    : DEV_NOTIFICATIONS;
  const markAllNotifsRead = () => setReadIds(liveNotifs.map(n => n.id));

  // Bell click → mark that one read + jump to the page it points to
  const openNotif = (n) => {
    if (n?.id) setReadIds(prev => (prev.includes(n.id) ? prev : [...prev, n.id]));
    if (n?.link) navigate(n.link);
  };

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
          accent={currentAccent}
          onToggleSidebar={toggleSidebar}
          sidebarCollapsed={isMobile ? !mobileOpen : collapsed}
          notifications={bellNotifications}
          onMarkAllRead={markAllNotifsRead}
          onNotifClick={openNotif}
        />

        {/* Page content */}
        <main ref={contentRef} style={{
          flex: 1,
          overflowY: 'auto',
          padding: 24,
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(32,52,93,0.8) transparent',
        }}>
          <div key={location.pathname} className="sp-rise">
            <div
              ref={tiltRef}
              style={{
                transform: 'perspective(1400px)',
                transition: 'transform 0.18s ease-out',
                willChange: 'transform',
              }}
            >
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
