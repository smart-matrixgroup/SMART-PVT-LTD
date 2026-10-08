import React, { useState } from 'react';
import { Bell, Search, Menu, X, ChevronRight } from 'lucide-react';

export default function ERPTopbar({ title, subtitle, onToggleSidebar, sidebarCollapsed, notifications = [], onMarkAllRead, actions }) {
  const [showNotifs, setShowNotifs] = useState(false);
  const [search, setSearch] = useState('');
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header style={{
      background: 'rgba(4,13,31,0.7)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid rgba(32,52,93,0.4)',
      padding: '12px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      position: 'sticky',
      top: 0,
      zIndex: 40,
    }}>
      {/* Sidebar toggle */}
      <button onClick={onToggleSidebar}
        style={{ color: '#91A0BC', background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, display: 'flex' }}
        onMouseEnter={e => e.currentTarget.style.background='rgba(32,52,93,0.5)'}
        onMouseLeave={e => e.currentTarget.style.background='none'}>
        {sidebarCollapsed ? <ChevronRight size={18} /> : <Menu size={18} />}
      </button>

      {/* Page title */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: '#91A0BC', marginTop: 1 }}>{subtitle}</div>}
      </div>

      {/* Search */}
      <div style={{ position: 'relative' }}>
        <Search size={13} style={{
          position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
          color: '#91A0BC', pointerEvents: 'none'
        }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search..."
          style={{
            background: 'rgba(10,24,56,0.8)',
            border: '1px solid rgba(32,52,93,0.6)',
            borderRadius: 10, padding: '7px 14px 7px 30px',
            color: '#C4D6ED', fontSize: 12, width: 180, outline: 'none',
          }}
          onFocus={e => e.target.style.borderColor='rgba(0,102,255,0.5)'}
          onBlur={e => e.target.style.borderColor='rgba(32,52,93,0.6)'}
        />
      </div>

      {/* Notifications bell */}
      <div style={{ position: 'relative' }}>
        <button onClick={() => setShowNotifs(!showNotifs)}
          style={{
            background: 'rgba(10,24,56,0.8)', border: '1px solid rgba(32,52,93,0.6)',
            borderRadius: 10, padding: '7px 10px', cursor: 'pointer', display: 'flex',
            color: '#91A0BC', position: 'relative',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(0,102,255,0.4)'; e.currentTarget.style.color='#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(32,52,93,0.6)'; e.currentTarget.style.color='#91A0BC'; }}>
          <Bell size={15} />
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: -4, right: -4,
              width: 16, height: 16, borderRadius: '50%',
              background: 'linear-gradient(135deg, #0066FF, #00D9FF)',
              color: '#fff', fontSize: 9, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid #040D1F'
            }}>{unreadCount}</span>
          )}
        </button>

        {/* Notification dropdown */}
        {showNotifs && (
          <div style={{
            position: 'absolute', right: 0, top: '110%',
            width: 300, maxHeight: 360,
            background: 'rgba(6,17,43,0.98)', backdropFilter: 'blur(20px)',
            border: '1px solid rgba(32,52,93,0.6)', borderRadius: 14,
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            overflow: 'hidden', zIndex: 100,
          }}>
            <div style={{
              padding: '12px 16px', borderBottom: '1px solid rgba(32,52,93,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>Notifications</span>
              {unreadCount > 0 && (
                <span
                  onClick={() => onMarkAllRead && onMarkAllRead()}
                  style={{ fontSize: 10, color: '#00D9FF', cursor: 'pointer', fontWeight: 600 }}>
                  Mark all read
                </span>
              )}
            </div>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {notifications.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#91A0BC', fontSize: 12 }}>
                  No notifications
                </div>
              ) : notifications.map((n, i) => (
                <div key={i} style={{
                  padding: '10px 16px', borderTop: i > 0 ? '1px solid rgba(32,52,93,0.3)' : 'none',
                  background: n.read ? 'transparent' : 'rgba(0,102,255,0.05)',
                  cursor: 'pointer',
                }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(0,102,255,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background=n.read?'transparent':'rgba(0,102,255,0.05)'}
                >
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 14 }}>{n.icon || '🔔'}</span>
                    <div>
                      <div style={{ fontSize: 11, color: '#C4D6ED', lineHeight: 1.4 }}>{n.text}</div>
                      <div style={{ fontSize: 10, color: '#91A0BC', marginTop: 2 }}>{n.time}</div>
                    </div>
                    {!n.read && (
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: '#0066FF', marginLeft: 'auto', marginTop: 4, flexShrink: 0
                      }} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Custom action buttons */}
      {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
    </header>
  );
}
