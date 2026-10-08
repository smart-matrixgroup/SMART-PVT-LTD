// ─────────────────────────────────────────────────────────────────
//  Staff Portal — Client Projects Directory.
//  Shown when Admin accepts / allows Staff Client Page Access
//  in ERP → Access Rules (allowStaffClientProjects).
//  If restricted by Admin, displays a locked restriction notice.
// ─────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { ERPPanel, ERPPanelHeader, ERPBadge, ERPEmpty, C } from '../../erp/components/ERPui';
import {
  FolderKanban, Lock, CheckCircle2, Search, Building, User,
  Calendar, Activity, Clock, ShieldAlert, AlertCircle
} from 'lucide-react';

const DEV_CLIENT_PROJECTS = [
  {
    id: 'p1',
    title: 'Corporate Website Redesign',
    clientName: 'Demo Client',
    clientCompany: 'ABC Trading Pvt Ltd',
    serviceType: 'Corporate Business Website',
    status: 'In Progress',
    completion: 65,
    milestones: [
      { title: 'Discovery & Blueprint', done: true },
      { title: 'UI/UX Design', done: true },
      { title: 'Development', done: false },
      { title: 'Deployment', done: false },
    ]
  },
  {
    id: 'p2',
    title: 'POS & Inventory Automation',
    clientName: 'Rahul Mendis',
    clientCompany: 'RMG Trading Pvt Ltd',
    serviceType: 'ERP System',
    status: 'requirements_pending',
    completion: 20,
    milestones: [
      { title: 'Requirements Gathering', done: true },
      { title: 'Database Schema Design', done: false },
    ]
  },
  {
    id: 'p3',
    title: 'Mobile App (iOS & Android)',
    clientName: 'Amali Senerath',
    clientCompany: 'AS Enterprises',
    serviceType: 'Mobile App',
    status: 'In Progress',
    completion: 45,
    milestones: [
      { title: 'Wireframes & Prototype', done: true },
      { title: 'API Integration', done: false },
    ]
  }
];

export default function StaffClientProjects({ isRestricted }) {
  const { isFirebaseConfigured, isDevSession } = useAuth();
  const live = isFirebaseConfigured && !isDevSession;

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  useEffect(() => {
    if (isRestricted) {
      setLoading(false);
      return;
    }

    if (!live) {
      setProjects(DEV_CLIENT_PROJECTS);
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(
      collection(db, 'projects'),
      (snap) => {
        setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.warn('Projects list notice:', err);
        setLoading(false);
      }
    );

    return unsub;
  }, [live, isRestricted]);

  // If Admin has restricted Staff from viewing Client Pages
  if (isRestricted) {
    return (
      <ERPPanel style={{ padding: '40px 24px', textAlign: 'center' }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16, background: 'rgba(240,90,103,0.12)',
          color: C.red, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
        }}>
          <Lock size={28} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 6 }}>
          Client Projects Access Restricted
        </div>
        <div style={{ fontSize: 12, color: C.muted, maxWidth: 460, margin: '0 auto 16px', lineHeight: 1.6 }}>
          Your administrator has currently restricted staff access to the Client Projects directory.
          If your project assignment requires viewing client details, please request access from your admin.
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20,
          background: 'rgba(240,90,103,0.08)', border: '1px solid rgba(240,90,103,0.25)',
          fontSize: 11, color: C.red, fontWeight: 700
        }}>
          <ShieldAlert size={13} /> Managed by Admin Access Rules (/erp/access-rules)
        </div>
      </ERPPanel>
    );
  }

  const filtered = projects
    .filter(p => {
      if (statusFilter !== 'All' && p.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (p.title || '').toLowerCase().includes(q) ||
        (p.clientName || '').toLowerCase().includes(q) ||
        (p.clientCompany || '').toLowerCase().includes(q) ||
        (p.serviceType || '').toLowerCase().includes(q)
      );
    });

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: C.muted, fontSize: 13 }}>Loading client projects…</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Accepted Banner */}
      <div style={{
        padding: '12px 18px', borderRadius: 12, background: 'rgba(24,199,122,0.08)',
        border: '1px solid rgba(24,199,122,0.25)', display: 'flex', alignItems: 'center', gap: 10
      }}>
        <CheckCircle2 size={16} style={{ color: C.green }} />
        <div style={{ fontSize: 11.5, color: C.text }}>
          <strong>Client Page Access Granted:</strong> Admin has accepted client project viewing permissions for your staff role.
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 12, top: 11, color: C.muted }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search projects or clients..."
            style={{
              width: '100%', background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`, borderRadius: 10,
              padding: '9px 12px 9px 34px', color: C.text, fontSize: 12, outline: 'none', boxSizing: 'border-box'
            }}
          />
        </div>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{
            background: 'rgba(10,24,56,0.8)', border: `1px solid ${C.border}`, borderRadius: 10,
            padding: '9px 14px', color: C.text, fontSize: 12, outline: 'none', cursor: 'pointer'
          }}
        >
          <option value="All">All Statuses</option>
          <option value="In Progress">In Progress</option>
          <option value="requirements_pending">Requirements Pending</option>
          <option value="Completed">Completed</option>
        </select>
      </div>

      {/* Projects List Panel */}
      <ERPPanel>
        <ERPPanelHeader
          title="Client Projects Directory"
          icon="📂"
          action={<span style={{ fontSize: 11, color: C.muted }}>{filtered.length} projects</span>}
        />

        {filtered.length === 0 ? (
          <ERPEmpty
            icon="📂"
            title="No client projects found"
            sub={search ? 'No projects match your search.' : 'Projects created for clients appear here.'}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filtered.map((p, idx) => (
              <div
                key={p.id}
                style={{
                  padding: '16px 20px',
                  borderTop: idx > 0 ? `1px solid ${C.border}20` : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: C.text }}>{p.title}</div>
                    <div style={{ fontSize: 11, color: C.muted, display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Building size={11} style={{ color: C.cyan }} /> {p.clientCompany || 'Direct Client'}
                      </span>
                      <span>•</span>
                      <span>{p.serviceType || 'Custom Solution'}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      fontSize: 10.5, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                      background: p.status === 'Completed' ? 'rgba(24,199,122,0.12)' : 'rgba(0,102,255,0.12)',
                      color: p.status === 'Completed' ? C.green : C.cyan,
                      border: `1px solid ${p.status === 'Completed' ? 'rgba(24,199,122,0.3)' : C.borderHi}`
                    }}>
                      {p.status || 'Active'}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: C.cyan }}>
                      {p.completion || 0}%
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${Math.min(100, p.completion || 0)}%`,
                    background: 'linear-gradient(90deg, #0066FF, #00D9FF)', borderRadius: 3
                  }} />
                </div>

                {/* Milestones preview */}
                {p.milestones && p.milestones.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    {p.milestones.map((m, mIdx) => (
                      <span
                        key={mIdx}
                        style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 6,
                          background: m.done ? 'rgba(24,199,122,0.1)' : 'rgba(10,24,56,0.6)',
                          color: m.done ? C.green : C.muted,
                          border: `1px solid ${m.done ? 'rgba(24,199,122,0.3)' : C.border}`
                        }}
                      >
                        {m.done ? '✓ ' : '○ '} {m.title}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ERPPanel>

    </div>
  );
}
