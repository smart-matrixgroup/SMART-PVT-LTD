import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { toMillis, formatWhen } from '../formatWhen';
import {
  ERPStatCard, ERPPanel, ERPPanelHeader, ERPBadge,
  ERPBtn, ERPProgress, ERPAvatar, C
} from '../components/ERPui';

// ── DEV mock data (dev sessions only — live mode uses Firestore) ──
const DEV_STATS = { clients:12, projects:8, revenue:'LKR 4.85M', leads:3 };
const DEV_PROJECTS = [
  { id:'p1', title:'Corporate Website Redesign', clientName:'John Perera',   status:'In Progress',  completion:65 },
  { id:'p2', title:'Restaurant POS System',      clientName:'Sarah Fernando', status:'advance_paid', completion:40 },
  { id:'p3', title:'Mobile App Development',     clientName:'Kumar Arasan',   status:'quotation_sent', completion:0 },
  { id:'p4', title:'ERP Implementation',         clientName:'Priya Nair',     status:'Completed',   completion:100 },
];
const DEV_LEADS = [
  { id:'l1', name:'Rahul Mendis',   company:'RMG Trading',    service:'ERP System',  type:'client_request', status:'New', createdAt:'2 min ago' },
  { id:'l2', name:'Thilak Rajah',   company:'TR Holdings',    service:'Website',     type:'quote_modal',    status:'New', createdAt:'18 min ago' },
  { id:'l3', name:'Amali Senerath', company:'AS Enterprises', service:'Mobile App',  type:'client_request', status:'New', createdAt:'1 hr ago' },
];
const DEV_STAFF = [
  { id:'s1', name:'Ashan Perera',     role:'Full Stack Developer', status:'active' },
  { id:'s2', name:'Nimali Silva',     role:'UI/UX Designer',       status:'busy' },
  { id:'s3', name:'Ruwan Jayasuriya', role:'Accountant',           status:'on-leave' },
];
const DEV_ASSIGNMENTS = [
  { id:'wa1', projectId:'p1', title:'Home page build', staffId:'s1', staffName:'Ashan Perera', status:'In Progress', progress:60 },
  { id:'wa2', projectId:'p2', title:'Order screen UI', staffId:'s2', staffName:'Nimali Silva', status:'Assigned', progress:0 },
];
const DEV_ACTIVITY = [
  { icon:'🔔', text:'New client request from Rahul M. — ERP System',  time:'2 min ago',  color:'#18C77A' },
  { icon:'✅', text:'John P. accepted quotation #QT-024',             time:'18 min ago', color:'#0066FF' },
  { icon:'💰', text:'Advance payment confirmed — Sarah Fernando',     time:'1 hr ago',   color:'#F5B942' },
  { icon:'📁', text:'Project created — Mobile App Development',       time:'2 hr ago',   color:'#00D9FF' },
];

const COLORS = ['#0066FF','#8B5CF6','#18C77A','#F5B942','#F05A67','#00D9FF'];
const EMPTY_STATS = { clients:0, projects:0, revenue:'LKR 0', leads:0 };

// Compact revenue display for the stat card: LKR 4.85M / LKR 850K
const fmtCompactLKR = v => {
  v = Number(v) || 0;
  if (v >= 1e6) return `LKR ${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `LKR ${(v / 1e3).toFixed(0)}K`;
  return `LKR ${v}`;
};
const initialsOf = name => (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
const chipColor  = name => COLORS[(name || '').length % COLORS.length];

// Derive the Live Activity feed from real leads + projects snapshots.
const buildActivity = (leadsList, projectsList) => {
  const items = [];
  leadsList.slice(0, 5).forEach(l => items.push({
    icon:'🔔', color:'#F5B942', time:formatWhen(l.createdAt),
    text:`New lead from ${l.name || '—'}${l.service ? ` — ${l.service}` : ''}`,
  }));
  projectsList.slice(0, 6).forEach(p => {
    if (p.status === 'Completed') items.push({
      icon:'🎉', color:'#18C77A', time:formatWhen(p.updatedAt || p.createdAt),
      text:`Project completed — ${p.title}`,
    });
    else items.push({
      icon:'📁', color:'#0066FF', time:formatWhen(p.createdAt),
      text:`Project — ${p.title}${p.clientName ? ` (${p.clientName})` : ''}`,
    });
  });
  return items.sort((a, b) => toMillis(b.time) - toMillis(a.time)).slice(0, 8);
};

export default function ERPDashboard() {
  const navigate = useNavigate();
  const { isDevSession } = useAuth();
  const live = isFirebaseConfigured && !isDevSession;
  const [stats,       setStats]       = useState(EMPTY_STATS);
  const [projects,    setProjects]    = useState([]);
  const [leads,       setLeads]       = useState([]);
  const [staff,       setStaff]       = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [activity,    setActivity]    = useState([]);
  const [loadError,   setLoadError]   = useState('');

  // Load live data from Firestore (admin-only reads; rules enforce this)
  useEffect(() => {
    if (!live) return;
    const unsubs = [];
    const onError = err => {
      console.error('Dashboard listener error', err);
      setLoadError(
        err.code === 'permission-denied'
          ? "Permission denied — deploy the updated Firestore rules and make sure you're signed in as an admin."
          : (err.message || "Couldn't load dashboard data. Refresh the page to retry.")
      );
    };
    const map = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));

    unsubs.push(onSnapshot(collection(db,'clients'), s => {
      setStats(p => ({ ...p, clients: s.size }));
      setLoadError('');
    }, onError));
    unsubs.push(onSnapshot(collection(db,'projects'), s => {
      const list = map(s).filter(p => p.status !== 'deleted');
      setProjects(list);
      setStats(p => ({ ...p, projects: list.filter(x => x.status !== 'Completed' && x.status !== 'archived').length }));
    }, onError));
    unsubs.push(onSnapshot(collection(db,'leads'), s => {
      const list = map(s).sort((a,b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      setLeads(list);
      setStats(p => ({ ...p, leads: list.filter(l => l.status === 'New').length }));
    }, onError));
    unsubs.push(onSnapshot(collection(db,'quotations'), s => {
      const total = map(s).reduce((sum,q) =>
        sum + (q.payments || []).reduce((s2,pay) => s2 + (Number(pay.amount) || 0), 0), 0);
      setStats(p => ({ ...p, revenue: fmtCompactLKR(total) }));
    }, onError));
    unsubs.push(onSnapshot(collection(db,'staff'), s => {
      setStaff(map(s).filter(x => !x.deleted));
    }, onError));
    unsubs.push(onSnapshot(collection(db,'workAssignments'), s => {
      setAssignments(map(s));
    }, onError));

    return () => unsubs.forEach(u => u());
  }, [live]);

  // Live Activity is derived from the leads + projects snapshots
  useEffect(() => {
    if (live) setActivity(buildActivity(leads, projects));
  }, [live, leads, projects]);

  const today = new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const hour  = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const activeProjects = projects
    .filter(p => p.status !== 'Completed' && p.status !== 'archived')
    .sort((a,b) => toMillis(b.createdAt) - toMillis(a.createdAt))
    .slice(0, 5);
  const newLeads = leads.filter(l => l.status === 'New' || !l.status).slice(0, 5);
  const visibleStaff = staff.slice(0, 5);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* ── Welcome banner ── */}
      <div style={{
        background:'linear-gradient(135deg, rgba(0,102,255,0.2) 0%, rgba(0,217,255,0.08) 100%)',
        border:'1px solid rgba(0,102,255,0.3)',
        borderRadius:16, padding:'18px 22px',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        flexWrap:'wrap', gap:12,
        position:'relative', overflow:'hidden',
      }}>
        <div style={{
          position:'absolute', right:-30, top:-30,
          width:180, height:180, borderRadius:'50%',
          background:'rgba(0,102,255,0.08)', filter:'blur(40px)',
        }} />
        <div style={{ position:'relative' }}>
          <div style={{ fontSize:13, color:C.muted, marginBottom:3 }}>{greet} 👋  ·  {today}</div>
          <div style={{ fontSize:22, fontWeight:900, color:C.text }}>SMART ERP Dashboard</div>
          <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>
            <span style={{ color:C.green, fontWeight:700 }}>{stats.leads} new leads</span> waiting for review
          </div>
        </div>
        <div style={{ display:'flex', gap:10, position:'relative', flexWrap:'wrap' }}>
          <ERPBtn onClick={() => navigate('/erp/leads')} variant="primary">
            🔔 View Leads ({stats.leads})
          </ERPBtn>
          <ERPBtn onClick={() => navigate('/erp/clients')} variant="secondary">
            + New Client
          </ERPBtn>
        </div>
      </div>

      {/* Load error banner */}
      {loadError && (
        <div style={{
          display:'flex', alignItems:'center', gap:10,
          padding:'10px 14px', borderRadius:10,
          background:'rgba(240,90,103,0.1)', border:'1px solid rgba(240,90,103,0.35)',
          fontSize:11, color:C.red, lineHeight:1.5,
        }}>
          ⚠️ {loadError}
        </div>
      )}

      {/* ── Stat cards ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:14 }}>
        <ERPStatCard
          icon="👥" value={stats.clients}
          label="Active Clients"
          color="#0066FF" onClick={() => navigate('/erp/clients')}
        />
        <ERPStatCard
          icon="📁" value={stats.projects}
          label="Active Projects"
          color="#00D9FF" onClick={() => navigate('/erp/projects')}
        />
        <ERPStatCard
          icon="💰" value={stats.revenue}
          label="Total Revenue (payments received)"
          color="#18C77A"
        />
        <ERPStatCard
          icon="🔔" value={stats.leads}
          label="Pending Leads"
          color="#F5B942" onClick={() => navigate('/erp/leads')}
        />
      </div>

      {/* ── Main content grid ── */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16 }}>

        {/* Active projects */}
        <ERPPanel>
          <ERPPanelHeader title="Active Projects" icon="📁" action={<span onClick={()=>navigate('/erp/projects')} style={{cursor:'pointer'}}>View all →</span>} />
          {activeProjects.length === 0 ? (
            <div style={{ padding:'28px', textAlign:'center', color:C.muted, fontSize:12 }}>
              No active projects yet.
            </div>
          ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  {['Client','Project','Progress','Status','Team'].map(h => (
                    <th key={h} style={{
                      padding:'10px 16px', fontSize:10, fontWeight:700,
                      textTransform:'uppercase', letterSpacing:'0.8px',
                      color:C.muted, textAlign:'left',
                      background:'rgba(10,24,56,0.5)',
                      borderBottom:`1px solid ${C.border}`,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeProjects.map((proj, i) => {
                  const projAs = assignments.filter(a => a.projectId === proj.id);
                  return (
                    <tr key={proj.id}
                      onClick={() => navigate(`/erp/projects`)}
                      style={{ cursor:'pointer', transition:'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background='rgba(0,102,255,0.05)'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <td style={{ padding:'11px 16px', fontSize:12, color:C.subtle, borderTop:`1px solid ${C.border}25` }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <ERPAvatar name={proj.clientName} color="#0066FF" size={26} />
                          {proj.clientName?.split(' ')[0]} {proj.clientName?.split(' ')[1]?.[0]}.
                        </div>
                      </td>
                      <td style={{ padding:'11px 16px', fontSize:12, color:C.subtle, borderTop:`1px solid ${C.border}25`, maxWidth:160 }}>
                        <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{proj.title}</div>
                      </td>
                      <td style={{ padding:'11px 16px', borderTop:`1px solid ${C.border}25`, minWidth:110 }}>
                        <div style={{ fontSize:10, color:C.cyan, marginBottom:4 }}>{proj.completion||0}%</div>
                        <ERPProgress value={proj.completion||0} />
                      </td>
                      <td style={{ padding:'11px 16px', borderTop:`1px solid ${C.border}25` }}>
                        <ERPBadge status={proj.status} />
                      </td>
                      <td style={{ padding:'11px 16px', borderTop:`1px solid ${C.border}25` }}>
                        {projAs.length > 0 ? (
                          <div style={{ display:'flex' }}>
                            {projAs.slice(0,3).map(a => (
                              <div key={a.id} title={`${a.staffName} — ${a.title}`} style={{
                                width:22, height:22, borderRadius:'50%',
                                background:chipColor(a.staffName),
                                display:'flex', alignItems:'center', justifyContent:'center',
                                fontSize:8.5, fontWeight:800, color:'#fff',
                                border:'2px solid #040D1F', marginLeft: -4,
                              }}>{initialsOf(a.staffName)}</div>
                            ))}
                            {projAs.length > 3 && (
                              <span style={{ fontSize:10, color:C.muted, marginLeft:5, alignSelf:'center' }}>+{projAs.length-3}</span>
                            )}
                          </div>
                        ) : <span style={{ fontSize:11, color:C.muted }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
        </ERPPanel>

        {/* Live activity */}
        <ERPPanel>
          <ERPPanelHeader title="Recent Activity" icon="⚡" />
          {activity.length === 0 ? (
            <div style={{ padding:'28px', textAlign:'center', color:C.muted, fontSize:12 }}>
              Nothing yet — activity appears as leads and projects come in.
            </div>
          ) : (
          <div style={{ maxHeight:340, overflowY:'auto' }}>
            {activity.map((a, i) => (
              <div key={i} style={{
                padding:'10px 16px', display:'flex', gap:10, alignItems:'flex-start',
                borderTop: i > 0 ? `1px solid ${C.border}30` : 'none',
              }}>
                <div style={{
                  width:8, height:8, borderRadius:'50%',
                  background:a.color, marginTop:4, flexShrink:0,
                  boxShadow:`0 0 6px ${a.color}80`,
                }} />
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:11, color:C.subtle, lineHeight:1.4 }}>{a.icon} {a.text}</div>
                  <div style={{ fontSize:9, color:C.muted, marginTop:2 }}>{a.time}</div>
                </div>
              </div>
            ))}
          </div>
          )}
        </ERPPanel>
      </div>

      {/* ── Bottom row ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

        {/* Pending leads */}
        <ERPPanel>
          <ERPPanelHeader title="Pending Leads" icon="🔔" action={<span onClick={()=>navigate('/erp/leads')} style={{cursor:'pointer'}}>View all →</span>} />
          {newLeads.length === 0 ? (
            <div style={{ padding:'24px', textAlign:'center', color:C.muted, fontSize:12 }}>
              No pending leads 🎉
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  {['Name','Service','Source',''].map(h => (
                    <th key={h} style={{ padding:'9px 14px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.8px', color:C.muted, textAlign:'left', background:'rgba(10,24,56,0.5)', borderBottom:`1px solid ${C.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {newLeads.map((lead, i) => (
                  <tr key={lead.id}
                    onMouseEnter={e=>e.currentTarget.style.background='rgba(0,102,255,0.05)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                    style={{ cursor:'pointer' }}
                    onClick={()=>navigate('/erp/leads')}>
                    <td style={{ padding:'10px 14px', borderTop:`1px solid ${C.border}25` }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <ERPAvatar name={lead.name} color={['#0066FF','#F5B942','#8B5CF6'][i%3]} size={24} />
                        <div>
                          <div style={{ fontSize:11, fontWeight:700, color:C.text }}>{lead.name}</div>
                          <div style={{ fontSize:10, color:C.muted }}>{lead.company}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding:'10px 14px', fontSize:11, color:C.subtle, borderTop:`1px solid ${C.border}25` }}>{lead.service}</td>
                    <td style={{ padding:'10px 14px', borderTop:`1px solid ${C.border}25` }}>
                      <ERPBadge status={lead.type==='client_request'?'New':'quotation_sent'} label={lead.type==='client_request'?'Get Started':'Quote'} />
                    </td>
                    <td style={{ padding:'10px 14px', borderTop:`1px solid ${C.border}25` }}>
                      <ERPBtn size="sm" variant="success" onClick={e=>{e.stopPropagation();navigate('/erp/leads');}}>
                        Review
                      </ERPBtn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ERPPanel>

        {/* Staff overview (real staff documents + open assignment counts) */}
        <ERPPanel>
          <ERPPanelHeader title="Staff Overview" icon="👥" action={<span onClick={()=>navigate('/erp/staff')} style={{cursor:'pointer'}}>Manage →</span>} />
          <div style={{ padding:'8px 0' }}>
            {visibleStaff.length === 0 ? (
              <div style={{ padding:'24px', textAlign:'center', color:C.muted, fontSize:12 }}>
                No staff yet — add your team in Staff Management.
              </div>
            ) : visibleStaff.map((s, i) => {
              const open = assignments.filter(a => a.staffId === s.id && a.status !== 'Completed').length;
              return (
                <div key={s.id} style={{
                  display:'flex', alignItems:'center', gap:12, padding:'10px 16px',
                  borderTop: i > 0 ? `1px solid ${C.border}25` : 'none',
                  cursor:'pointer', transition:'background 0.1s',
                }}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(0,102,255,0.04)'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                  onClick={()=>navigate('/erp/staff')}>
                  <div style={{
                    width:34, height:34, borderRadius:10,
                    background:`linear-gradient(135deg, ${chipColor(s.name)}, ${chipColor(s.name)}99)`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    color:'#fff', fontWeight:800, fontSize:13, flexShrink:0,
                    boxShadow:`0 3px 8px ${chipColor(s.name)}40`,
                  }}>{initialsOf(s.name)}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:C.text }}>{s.name}</div>
                    <div style={{ fontSize:10, color:C.muted }}>{s.role || s.department || '—'}</div>
                  </div>
                  <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
                    <ERPBadge status={s.status} size="sm" />
                    <span style={{ fontSize:10, color:C.muted }}>{open} open</span>
                  </div>
                </div>
              );
            })}
          </div>
        </ERPPanel>

      </div>
    </div>
  );
}
