import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { company } from '../../config/company';
import {
  LayoutDashboard, Bell, Users, FolderKanban,
  ClipboardList, Receipt, FileText, UserCheck,
  MessageCircle, BarChart3, Trophy, Settings,
  LogOut, ChevronRight, Briefcase, FileStack, QrCode
} from 'lucide-react';

const NAV = [
  {
    section: 'Main',
    items: [
      { path: '/erp',           label: 'Dashboard',    icon: LayoutDashboard, exact: true },
      { path: '/erp/leads',     label: 'Leads',        icon: Bell,            badge: 'leads'  },
      { path: '/erp/clients',   label: 'Clients',      icon: Users            },
      { path: '/erp/projects',  label: 'Projects',     icon: FolderKanban     },
    ]
  },
  {
    section: 'Work',
    items: [
      { path: '/erp/requirements', label: 'Requirements', icon: ClipboardList },
      { path: '/erp/quotations',   label: 'Quotations',   icon: Receipt       },
      { path: '/erp/templates',    label: 'Templates',    icon: FileStack     },
      { path: '/erp/invoices',     label: 'Invoices',     icon: FileText      },
      { path: '/erp/qr-services',  label: 'QR Services',  icon: QrCode        },
    ]
  },
  {
    section: 'Team',
    items: [
      { path: '/erp/staff',    label: 'Staff',    icon: UserCheck   },
      { path: '/erp/messages', label: 'Messages', icon: MessageCircle, badge: 'messages' },
    ]
  },
  {
    section: 'Reports',
    items: [
      { path: '/erp/analytics',    label: 'Analytics',    icon: BarChart3 },
      { path: '/erp/achievements', label: 'Achievements', icon: Trophy    },
      { path: '/erp/settings',     label: 'Settings',     icon: Settings  },
    ]
  }
];

export default function ERPSidebar({ badges = {}, collapsed, onToggle }) {
  const { logout, currentUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/client-login');
  };

  return (
    <aside className={`erp-sidebar flex flex-col h-full transition-all duration-300 ${collapsed ? 'w-16' : 'w-56'}`}
      style={{
        background: 'rgba(4,13,31,0.95)',
        backdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(32,52,93,0.5)',
        position: 'relative',
        overflow: 'hidden',
      }}>

      {/* Top glow line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(0,217,255,0.6), transparent)'
      }} />

      {/* Logo — SAME brand files as the public website (company.logos).
          Expanded: full dark-mode logo. Collapsed: head-only mark. */}
      <div className={`flex items-center gap-2.5 px-3 py-4 border-b ${collapsed ? 'justify-center px-2' : ''}`}
        style={{ borderColor: 'rgba(32,52,93,0.5)', minHeight: 72 }}>
        <img
          src={collapsed ? company.logos.adminCollapsed : company.logos.admin}
          alt="SMART Pvt Ltd"
          style={{
            height: collapsed ? 36 : 42,
            width: 'auto',
            maxWidth: collapsed ? 40 : 148,
            objectFit: 'contain',
            objectPosition: 'left center',
            display: 'block',
            flexShrink: 0,
          }}
          onError={(e) => {
            if (e.currentTarget.dataset.fb === 'done') {
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.nextElementSibling;
              if (fallback) fallback.style.display = 'flex';
              return;
            }
            e.currentTarget.dataset.fb = 'done';
            e.currentTarget.src = company.logos.adminFallback;
          }}
        />
        <div style={{
          display: 'none', alignItems: 'center', gap: 8,
          minWidth: 0,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9, flexShrink: 0,
            background: 'linear-gradient(135deg, #0066FF, #00D9FF)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 900, fontSize: 14,
          }}>S</div>
          {!collapsed && (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>SMART Pvt Ltd</div>
              <div style={{ fontSize: 9, color: 'rgba(0,217,255,0.85)', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>ERP System</div>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2" style={{ scrollbarWidth: 'none' }}>
        {NAV.map(({ section, items }) => (
          <div key={section} className="mb-2">
            {!collapsed && (
              <div style={{
                fontSize: 9, fontWeight: 700, color: 'rgba(145,160,188,0.45)',
                textTransform: 'uppercase', letterSpacing: '1.2px',
                padding: '6px 8px 3px'
              }}>{section}</div>
            )}
            {items.map(({ path, label, icon: Icon, exact, badge }) => {
              const count = badge ? (badges[badge] || 0) : 0;
              return (
                <NavLink
                  key={path}
                  to={path}
                  end={exact}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: collapsed ? 0 : 10,
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    padding: collapsed ? '10px 0' : '9px 10px',
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 600,
                    color: isActive ? '#fff' : '#91A0BC',
                    textDecoration: 'none',
                    marginBottom: 1,
                    position: 'relative',
                    background: isActive
                      ? 'linear-gradient(135deg, rgba(0,102,255,0.25), rgba(0,217,255,0.08))'
                      : 'transparent',
                    border: isActive ? '1px solid rgba(0,102,255,0.3)' : '1px solid transparent',
                    boxShadow: isActive ? '0 2px 10px rgba(0,102,255,0.15)' : 'none',
                    transition: 'all 0.15s',
                  })}
                  className="erp-nav-item"
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <div style={{
                          position: 'absolute', left: 0, top: '20%', bottom: '20%',
                          width: 3,
                          background: 'linear-gradient(180deg, #0066FF, #00D9FF)',
                          borderRadius: '0 2px 2px 0'
                        }} />
                      )}
                      <Icon size={15} style={{ flexShrink: 0, color: isActive ? '#00D9FF' : '#91A0BC' }} />
                      {!collapsed && <span style={{ flex: 1 }}>{label}</span>}
                      {!collapsed && count > 0 && (
                        <span style={{
                          background: 'linear-gradient(135deg, #0066FF, #00D9FF)',
                          color: '#fff', fontSize: 9, fontWeight: 800,
                          padding: '1px 6px', borderRadius: 20, minWidth: 18, textAlign: 'center'
                        }}>{count}</span>
                      )}
                      {collapsed && count > 0 && (
                        <span style={{
                          position: 'absolute', top: 4, right: 4,
                          width: 8, height: 8, borderRadius: '50%',
                          background: 'linear-gradient(135deg, #0066FF, #00D9FF)',
                        }} />
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Admin badge */}
      <div className={`flex items-center gap-3 px-3 py-3 ${collapsed ? 'justify-center' : ''}`}
        style={{ borderTop: '1px solid rgba(32,52,93,0.5)' }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: 'linear-gradient(135deg, #0066FF, #00D9FF)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 12, color: '#fff',
          boxShadow: '0 3px 10px rgba(0,102,255,0.4)'
        }}>A</div>
        {!collapsed && (
          <>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                SMART Admin
              </div>
              <div style={{ fontSize: 9, color: '#00D9FF', fontWeight: 600 }}>Super Admin</div>
            </div>
            <button onClick={handleLogout} title="Sign out"
              style={{ color: '#F05A67', background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6 }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(240,90,103,0.1)'}
              onMouseLeave={e => e.currentTarget.style.background='none'}>
              <LogOut size={14} />
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
