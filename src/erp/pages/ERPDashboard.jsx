import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { staffList } from '../../config/staff';
import {
  ERPStatCard, ERPPanel, ERPPanelHeader, ERPBadge,
  ERPBtn, ERPProgress, ERPAvatar, C
} from '../components/ERPui';

// ── DEV mock data ──────────────────────────────────────────────────
const DEV_STATS = { clients:12, projects:8, revenue:'LKR 4.85M', leads:3 };
const DEV_PROJECTS = [
  { id:'p1', title:'Corporate Website Redesign', clientName:'John Perera',   status:'In Progress',  completion:65, assignedStaff:['STAFF-001','STAFF-002'] },
  { id:'p2', title:'Restaurant POS System',      clientName:'Sarah Fernando', status:'advance_paid', completion:40, assignedStaff:['STAFF-004'] },
  { id:'p3', title:'Mobile App Development',     clientName:'Kumar Arasan',   status:'quotation_sent', completion:0, assignedStaff:[] },
  { id:'p4', title:'ERP Implementation',         clientName:'Priya Nair',     status:'Completed',   completion:100, assignedStaff:['STAFF-001','STAFF-003'] },
];
const DEV_LEADS = [
  { leadId:'L001', name:'Rahul Mendis',  company:'RMG Trading',   service:'ERP System',  type:'client_request', createdAt:'2 min ago' },
  { leadId:'L002', name:'Thilak Rajah',  company:'TR Holdings',   service:'Website',     type:'quote_modal',    createdAt:'18 min ago'},
  { leadId:'L003', name:'Amali Senerath',company:'AS Enterprises', service:'Mobile App',  type:'client_request', createdAt:'1 hr ago'  },
];
const DEV_ACTIVITY = [
  { icon:'🔔', text:'New client request from Rahul M. — ERP System',       time:'2 min ago',  color:'#18C77A' },
  { icon:'✅', text:'John P. accepted quotation #QT-024',                   time:'18 min ago', color:'#0066FF' },
  { icon:'💰', text:'Advance payment confirmed — Sarah Fernando',           time:'1 hr ago',   color:'#F5B942' },
  { icon:'📝', text:'Requirement form filled by Kumar A. — Mobile App',     time:'2 hr ago',   color:'#00D9FF' },
  { icon:'💬', text:'New message from Priya N. in ERP project',             time:'3 hr ago',   color:'#8B5CF6' },
  { icon:'🎉', text:'ERP Implementation completed — Priya Nair',           time:'Yesterday',  color:'#18C77A' },
  { icon:'👷', text:'Ashan Perera assigned to Mobile App project',          time:'Yesterday',  color:'#00D9FF' },
];

export default function ERPDashboard() {
  const navigate = useNavigate();
  const { isDevSession } = useAuth();
  const [stats,    setStats]    = useState(DEV_STATS);
  const [projects, setProjects] = useState(DEV_PROJECTS);
  const [leads,    setLeads]    = useState(DEV_LEADS);
  const [activity, setActivity] = useState(DEV_ACTIVITY);

  // Load live data from Firestore
  useEffect(() => {
    if (!isFirebaseConfigured || isDevSession) return;
    // leads count
    const qLeads = query(collection(db,'leads'), where('status','==','New'));
    const u1 = onSnapshot(qLeads, s => setStats(p => ({ ...p, leads: s.size })));
    // projects
    const qProj = query(collection(db,'projects'), orderBy('createdAt','desc'), limit(5));
    const u2 = onSnapshot(qProj, s => setProjects(s.docs.map(d=>({id:d.id,...d.data()}))));
    // recent leads
    const qRecent = query(collection(db,'leads'), orderBy('createdAt','desc'), limit(5));
    const u3 = onSnapshot(qRecent, s => setLeads(s.docs.map(d=>({leadId:d.id,...d.data()}))));
    return () => { u1(); u2(); u3(); };
  }, [isDevSession]);

  const today = new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const hour  = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* ── Welcome banner ── */}
      <div style={{
        background:'linear-gradient(135deg, rgba(0,102,255,0.2) 0%, rgba(0,217,255,0.08) 100%)',
        border:'1px solid rgba(0,102,255,0.3)',
        borderRadius:16, padding:'18px 22px',
        display:'flex', alignItems:'center', justifyContent:'space-between',
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
        <div style={{ display:'flex', gap:10, position:'relative' }}>
          <ERPBtn onClick={() => navigate('/erp/leads')} variant="primary">
            🔔 View Leads ({stats.leads})
          </ERPBtn>
          <ERPBtn onClick={() => navigate('/erp/clients')} variant="secondary">
            + New Client
          </ERPBtn>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
        <ERPStatCard
          icon="👥" value={stats.clients}
          label="Active Clients" change="+3 this month" changeUp
          color="#0066FF" onClick={() => navigate('/erp/clients')}
        />
        <ERPStatCard
          icon="📁" value={stats.projects}
          label="Active Projects" change="+2 this week" changeUp
          color="#00D9FF" onClick={() => navigate('/erp/projects')}
        />
        <ERPStatCard
          icon="💰" value={stats.revenue}
          label="Total Revenue" change="+12% vs last month" changeUp
          color="#18C77A"
        />
        <ERPStatCard
          icon="🔔" value={stats.leads}
          label="Pending Leads" change="2 new today" changeUp={false}
          color="#F5B942" onClick={() => navigate('/erp/leads')}
        />
      </div>

      {/* ── Main content grid ── */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16 }}>

        {/* Active projects */}
        <ERPPanel>
          <ERPPanelHeader title="Active Projects" icon="📁" action={<span onClick={()=>navigate('/erp/projects')} style={{cursor:'pointer'}}>View all →</span>} />
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
                {projects.map((proj, i) => {
                  const staff = (proj.assignedStaff||[]).map(id => staffList.find(s=>s.id===id)).filter(Boolean);
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
                        {staff.length > 0 ? (
                          <div style={{ display:'flex', gap:-4 }}>
                            {staff.slice(0,3).map(s => (
                              <div key={s.id} title={s.name} style={{
                                width:22, height:22, borderRadius:'50%',
                                background:s.avatarColor||'#0066FF',
                                display:'flex', alignItems:'center', justifyContent:'center',
                                fontSize:9, fontWeight:800, color:'#fff',
                                border:'2px solid #040D1F', marginLeft: -4,
                              }}>{s.avatar}</div>
                            ))}
                          </div>
                        ) : <span style={{ fontSize:11, color:C.muted }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ERPPanel>

        {/* Live activity */}
        <ERPPanel>
          <ERPPanelHeader title="Live Activity" icon="⚡" action="Clear" />
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
                <div>
                  <div style={{ fontSize:11, color:C.subtle, lineHeight:1.4 }}>{a.text}</div>
                  <div style={{ fontSize:9, color:C.muted, marginTop:2 }}>{a.time}</div>
                </div>
              </div>
            ))}
          </div>
        </ERPPanel>
      </div>

      {/* ── Bottom row ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

        {/* Pending leads */}
        <ERPPanel>
          <ERPPanelHeader title="Pending Leads" icon="🔔" action={<span onClick={()=>navigate('/erp/leads')} style={{cursor:'pointer'}}>View all →</span>} />
          {leads.filter(l => l.status==='New' || !l.status).length === 0 ? (
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
                {leads.filter(l=>l.status==='New'||!l.status).map((lead, i) => (
                  <tr key={lead.leadId}
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

        {/* Staff overview */}
        <ERPPanel>
          <ERPPanelHeader title="Staff Overview" icon="👥" action={<span onClick={()=>navigate('/erp/staff')} style={{cursor:'pointer'}}>Manage →</span>} />
          <div style={{ padding:'8px 0' }}>
            {staffList.slice(0,5).map((s, i) => {
              const assigned = DEV_PROJECTS.filter(p => (p.assignedStaff||[]).includes(s.id)).length;
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
                    background:`linear-gradient(135deg, ${s.avatarColor||'#0066FF'}, ${s.avatarColor||'#0066FF'}99)`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    color:'#fff', fontWeight:800, fontSize:13, flexShrink:0,
                    boxShadow:`0 3px 8px ${s.avatarColor||'#0066FF'}40`,
                  }}>{s.avatar}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:C.text }}>{s.name}</div>
                    <div style={{ fontSize:10, color:C.muted }}>{s.role}</div>
                  </div>
                  <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
                    <ERPBadge status={s.status} size="sm" />
                    <span style={{ fontSize:10, color:C.muted }}>{assigned} proj</span>
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
