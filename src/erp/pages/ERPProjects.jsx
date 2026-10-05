import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { staffList } from '../../config/staff';
import {
  ERPPanel, ERPPanelHeader, ERPBadge, ERPBtn,
  ERPModal, ERPSelect, ERPEmpty, ERPAvatar,
  ERPProgress, C
} from '../components/ERPui';
import { CheckCircle2, Circle, UserPlus, X, ChevronDown, ChevronUp } from 'lucide-react';

const COLORS = ['#0066FF','#8B5CF6','#18C77A','#F5B942','#F05A67','#00D9FF'];
const STATUS_OPTS = [
  {value:'requirements_pending',label:'Requirements Pending'},
  {value:'quotation_sent',      label:'Quotation Sent'},
  {value:'quotation_accepted',  label:'Quotation Accepted'},
  {value:'advance_paid',        label:'Advance Paid'},
  {value:'In Progress',         label:'In Progress'},
  {value:'Completed',           label:'Completed'},
];

const DEV_PROJECTS = [
  {
    id:'P001', clientId:'C001', clientName:'John Perera', clientCompany:'Perera Holdings',
    title:'Corporate Website Redesign', serviceType:'Corporate Business Website',
    status:'In Progress', completion:65, createdAt:'Oct 1, 2026',
    assignedStaff:['STAFF-001','STAFF-002'],
    milestones:[
      {title:'Discovery & Blueprint',    done:true,  updatedAt:'Sep 5'},
      {title:'UI/UX Design',             done:true,  updatedAt:'Sep 18'},
      {title:'Frontend Development',     done:false, updatedAt:null},
      {title:'Backend & CMS Integration',done:false, updatedAt:null},
      {title:'QA & Testing',             done:false, updatedAt:null},
      {title:'Deployment & Handover',    done:false, updatedAt:null},
    ],
  },
  {
    id:'P002', clientId:'C002', clientName:'Sarah Fernando', clientCompany:'Mehala Restaurant',
    title:'Restaurant POS System', serviceType:'ERP & POS System',
    status:'advance_paid', completion:40, createdAt:'Sep 15, 2026',
    assignedStaff:['STAFF-004'],
    milestones:[
      {title:'Requirements Analysis',    done:true,  updatedAt:'Sep 16'},
      {title:'POS Module Development',   done:true,  updatedAt:'Sep 28'},
      {title:'Table Management Module',  done:false, updatedAt:null},
      {title:'KOT & Kitchen Display',    done:false, updatedAt:null},
      {title:'Staff Training & Go-Live', done:false, updatedAt:null},
    ],
  },
  {
    id:'P003', clientId:'C003', clientName:'Kumar Arasan', clientCompany:'KA Retail',
    title:'Mobile App Development', serviceType:'Mobile App (Android & iOS)',
    status:'quotation_sent', completion:0, createdAt:'Oct 2, 2026',
    assignedStaff:[],
    milestones:[],
  },
  {
    id:'P004', clientId:'C004', clientName:'Priya Nair', clientCompany:'PN Accounting',
    title:'Annual Tax Filing 2024', serviceType:'Accounting & Tax Services',
    status:'Completed', completion:100, createdAt:'Jan 10, 2026',
    assignedStaff:['STAFF-003'],
    milestones:[
      {title:'Document Collection',      done:true, updatedAt:'Jan 12'},
      {title:'Bookkeeping Review',       done:true, updatedAt:'Jan 20'},
      {title:'Tax Return Preparation',   done:true, updatedAt:'Feb 5'},
      {title:'IRD Submission',           done:true, updatedAt:'Feb 8'},
    ],
  },
];

export default function ERPProjects() {
  const { isDevSession } = useAuth();
  const [projects,  setProjects]   = useState(DEV_PROJECTS);
  const [selected,  setSelected]   = useState(null);
  const [filter,    setFilter]     = useState('All');
  const [showAssign, setShowAssign] = useState(false);
  const [saving,    setSaving]     = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured || isDevSession) return;
    const q = query(collection(db,'projects'), orderBy('createdAt','desc'));
    return onSnapshot(q, snap => setProjects(snap.docs.map(d=>({id:d.id,...d.data()}))));
  }, [isDevSession]);

  const filters = ['All','In Progress','advance_paid','quotation_sent','Completed'];
  const filtered = filter==='All' ? projects : projects.filter(p=>p.status===filter);

  const selProj = selected ? projects.find(p=>p.id===selected) : null;

  // Toggle milestone
  const toggleMilestone = async (projId, mIdx) => {
    setSaving(true);
    const proj = projects.find(p=>p.id===projId);
    const miles = proj.milestones.map((m,i) => i===mIdx ? {...m, done:!m.done, updatedAt:new Date().toLocaleDateString()} : m);
    const done  = miles.filter(m=>m.done).length;
    const pct   = miles.length > 0 ? Math.round((done/miles.length)*100) : 0;
    // Update local
    setProjects(prev => prev.map(p => p.id===projId ? {...p, milestones:miles, completion:pct} : p));
    // Firestore
    if (isFirebaseConfigured && !isDevSession) {
      try {
        await updateDoc(doc(db,'projects',projId), { milestones:miles, completion:pct, updatedAt:serverTimestamp() });
      } catch(e){ console.error(e); }
    }
    setSaving(false);
  };

  // Toggle staff
  const toggleStaff = async (projId, staffId) => {
    const proj = projects.find(p=>p.id===projId);
    const current = proj.assignedStaff || [];
    const updated = current.includes(staffId) ? current.filter(id=>id!==staffId) : [...current,staffId];
    setProjects(prev=>prev.map(p=>p.id===projId?{...p,assignedStaff:updated}:p));
    if (isFirebaseConfigured && !isDevSession) {
      try { await updateDoc(doc(db,'projects',projId),{assignedStaff:updated}); } catch(e){ console.error(e); }
    }
  };

  // Update status
  const updateStatus = async (projId, status) => {
    setProjects(prev=>prev.map(p=>p.id===projId?{...p,status}:p));
    if (isFirebaseConfigured && !isDevSession) {
      try { await updateDoc(doc(db,'projects',projId),{status,updatedAt:serverTimestamp()}); } catch(e){ console.error(e); }
    }
  };

  // Update completion manually
  const updateCompletion = async (projId, val) => {
    const pct = Math.max(0, Math.min(100, Number(val)));
    setProjects(prev=>prev.map(p=>p.id===projId?{...p,completion:pct}:p));
    if (isFirebaseConfigured && !isDevSession) {
      try { await updateDoc(doc(db,'projects',projId),{completion:pct,updatedAt:serverTimestamp()}); } catch(e){ console.error(e); }
    }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* Filters */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        {filters.map(f => {
          const lbl = {All:'All','In Progress':'In Progress','advance_paid':'Advance Paid','quotation_sent':'Quote Sent','Completed':'Completed'}[f];
          const cnt = f==='All'?projects.length:projects.filter(p=>p.status===f).length;
          return (
            <button key={f} onClick={()=>setFilter(f)} style={{
              padding:'6px 14px', borderRadius:10, fontSize:11, fontWeight:700,
              cursor:'pointer', transition:'all 0.15s',
              background: filter===f?'linear-gradient(135deg,#0066FF,#1787FF)':'rgba(10,24,56,0.8)',
              color: filter===f?'#fff':C.muted,
              border: filter===f?'none':`1px solid ${C.border}`,
              boxShadow: filter===f?'0 4px 12px rgba(0,102,255,0.3)':'none',
            }}>{lbl} {cnt>0&&<span style={{opacity:0.7,marginLeft:4}}>({cnt})</span>}</button>
          );
        })}
        <div style={{marginLeft:'auto',fontSize:12,color:C.muted,display:'flex',alignItems:'center'}}>{filtered.length} projects</div>
      </div>

      {/* Main grid */}
      <div style={{ display:'grid', gridTemplateColumns: selProj ? '1fr 420px' : 'repeat(auto-fill,minmax(320px,1fr))', gap:16 }}>

        {/* Project cards (when no selection) */}
        {!selProj && filtered.map((proj, i) => {
          const staff = (proj.assignedStaff||[]).map(id=>staffList.find(s=>s.id===id)).filter(Boolean);
          const done  = (proj.milestones||[]).filter(m=>m.done).length;
          return (
            <div key={proj.id}
              onClick={()=>setSelected(proj.id)}
              style={{
                background:C.surface, border:`1px solid ${C.border}`, borderRadius:16,
                padding:18, cursor:'pointer', transition:'all 0.2s', backdropFilter:'blur(12px)',
                position:'relative', overflow:'hidden',
              }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=C.borderHi;e.currentTarget.style.transform='translateY(-3px)';e.currentTarget.style.boxShadow='0 12px 30px rgba(0,0,0,0.3)';}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none';}}>
              <div style={{position:'absolute',top:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${COLORS[i%COLORS.length]}60,transparent)`}} />

              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8,marginBottom:10}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:11,color:C.muted,marginBottom:3}}>{proj.clientName} · {proj.clientCompany}</div>
                  <div style={{fontSize:13,fontWeight:800,color:C.text,lineHeight:1.3}}>{proj.title}</div>
                  <div style={{fontSize:10,color:C.cyan,marginTop:2}}>{proj.serviceType}</div>
                </div>
                <ERPBadge status={proj.status} />
              </div>

              <div style={{marginBottom:10}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:10,marginBottom:4}}>
                  <span style={{color:C.muted}}>{proj.milestones?.length>0?`${done}/${proj.milestones.length} milestones`:'Progress'}</span>
                  <span style={{color:C.cyan,fontWeight:700}}>{proj.completion||0}%</span>
                </div>
                <ERPProgress value={proj.completion||0} />
              </div>

              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div style={{display:'flex',gap:-4}}>
                  {staff.length>0 ? staff.map(s=>(
                    <div key={s.id} title={`${s.name} — ${s.role}`} style={{
                      width:24,height:24,borderRadius:'50%',background:s.avatarColor||'#0066FF',
                      display:'flex',alignItems:'center',justifyContent:'center',
                      fontSize:9,fontWeight:800,color:'#fff',
                      border:'2px solid #040D1F',marginLeft:-6,
                    }}>{s.avatar}</div>
                  )) : <span style={{fontSize:10,color:C.muted}}>No staff assigned</span>}
                </div>
                <span style={{fontSize:10,color:C.muted}}>{proj.createdAt}</span>
              </div>
            </div>
          );
        })}

        {/* Project list when detail open */}
        {selProj && (
          <ERPPanel>
            <ERPPanelHeader title="Projects" icon="📁" />
            {filtered.map((proj,i) => (
              <div key={proj.id} onClick={()=>setSelected(proj.id)}
                style={{
                  display:'flex',alignItems:'center',gap:12,padding:'12px 16px',
                  borderTop:i>0?`1px solid ${C.border}25`:'none',cursor:'pointer',
                  background:selected===proj.id?'rgba(0,102,255,0.07)':'transparent',
                  borderLeft:selected===proj.id?'3px solid #0066FF':'3px solid transparent',
                  transition:'background 0.1s',
                }}
                onMouseEnter={e=>{if(selected!==proj.id)e.currentTarget.style.background='rgba(0,102,255,0.04)';}}
                onMouseLeave={e=>{if(selected!==proj.id)e.currentTarget.style.background='transparent';}}>
                <ERPAvatar name={proj.clientName} color={COLORS[i%COLORS.length]} size={30} />
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{proj.title}</div>
                  <div style={{fontSize:10,color:C.muted}}>{proj.clientName}</div>
                </div>
                <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4}}>
                  <ERPBadge status={proj.status} size="sm" />
                  <span style={{fontSize:10,color:C.cyan}}>{proj.completion||0}%</span>
                </div>
              </div>
            ))}
          </ERPPanel>
        )}

        {/* Project detail */}
        {selProj && (
          <ERPPanel style={{ maxHeight:'calc(100vh - 140px)', overflowY:'auto', alignSelf:'flex-start' }}>
            <ERPPanelHeader title={selProj.title} icon="📁"
              action={<span style={{cursor:'pointer'}} onClick={()=>setSelected(null)}>✕</span>} />
            <div style={{padding:18,display:'flex',flexDirection:'column',gap:18}}>

              {/* Client + service */}
              <div style={{display:'flex',gap:12,alignItems:'center'}}>
                <ERPAvatar name={selProj.clientName} color={C.blue} size={40} />
                <div>
                  <div style={{fontSize:14,fontWeight:800,color:C.text}}>{selProj.clientName}</div>
                  <div style={{fontSize:11,color:C.muted}}>{selProj.clientCompany} · {selProj.serviceType}</div>
                </div>
              </div>

              {/* Status + progress */}
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                <ERPSelect label="Status" value={selProj.status}
                  onChange={e=>updateStatus(selProj.id,e.target.value)}
                  options={STATUS_OPTS} />
                <div>
                  <label style={{display:'block',fontSize:11,fontWeight:600,color:C.subtle,marginBottom:6}}>
                    Completion % {saving && <span style={{color:C.cyan,fontSize:10}}> saving...</span>}
                  </label>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <input type="range" min={0} max={100} value={selProj.completion||0}
                      onChange={e=>updateCompletion(selProj.id,e.target.value)}
                      style={{flex:1,accentColor:C.blue}} />
                    <span style={{fontSize:13,fontWeight:800,color:C.cyan,minWidth:36,textAlign:'right'}}>{selProj.completion||0}%</span>
                  </div>
                  <ERPProgress value={selProj.completion||0} />
                </div>
              </div>

              {/* Milestones */}
              <div>
                <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:10}}>
                  Milestones — {(selProj.milestones||[]).filter(m=>m.done).length}/{(selProj.milestones||[]).length} done
                </div>
                {(selProj.milestones||[]).length === 0 ? (
                  <div style={{fontSize:11,color:C.muted,textAlign:'center',padding:'12px 0'}}>No milestones yet.</div>
                ) : (
                  <div style={{display:'flex',flexDirection:'column',gap:6}}>
                    {selProj.milestones.map((m,i) => (
                      <div key={i}
                        onClick={()=>toggleMilestone(selProj.id,i)}
                        style={{
                          display:'flex',alignItems:'center',gap:10,padding:'10px 12px',
                          borderRadius:10,cursor:'pointer',transition:'background 0.1s',
                          background:m.done?'rgba(24,199,122,0.08)':'rgba(10,24,56,0.6)',
                          border:`1px solid ${m.done?'rgba(24,199,122,0.25)':C.border+'30'}`,
                        }}
                        onMouseEnter={e=>e.currentTarget.style.opacity='0.85'}
                        onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
                        {m.done
                          ? <CheckCircle2 size={16} style={{color:C.green,flexShrink:0}} />
                          : <Circle size={16} style={{color:C.muted,flexShrink:0}} />}
                        <span style={{fontSize:12,flex:1,color:m.done?C.muted:C.text,textDecoration:m.done?'line-through':'none'}}>
                          {m.title}
                        </span>
                        {m.updatedAt && <span style={{fontSize:10,color:C.muted,flexShrink:0}}>{m.updatedAt}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Assigned staff */}
              <div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:'0.8px'}}>
                    Assigned Staff ({(selProj.assignedStaff||[]).length})
                  </div>
                  <ERPBtn size="sm" variant="secondary" onClick={()=>setShowAssign(true)}>
                    <UserPlus size={12} /> Manage
                  </ERPBtn>
                </div>
                {(selProj.assignedStaff||[]).length === 0 ? (
                  <div style={{fontSize:11,color:C.muted,fontStyle:'italic'}}>No staff assigned yet.</div>
                ) : (
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {(selProj.assignedStaff||[]).map(id=>{
                      const s = staffList.find(x=>x.id===id);
                      if(!s) return null;
                      return (
                        <div key={id} style={{
                          display:'flex',alignItems:'center',gap:10,padding:'8px 12px',
                          borderRadius:10,background:'rgba(10,24,56,0.6)',border:`1px solid ${C.border}30`,
                        }}>
                          <div style={{
                            width:32,height:32,borderRadius:9,flexShrink:0,
                            background:`linear-gradient(135deg,${s.avatarColor},${s.avatarColor}99)`,
                            display:'flex',alignItems:'center',justifyContent:'center',
                            color:'#fff',fontWeight:800,fontSize:13,
                          }}>{s.avatar}</div>
                          <div style={{flex:1}}>
                            <div style={{fontSize:12,fontWeight:700,color:C.text}}>{s.name}</div>
                            <div style={{fontSize:10,color:C.muted}}>{s.role}</div>
                          </div>
                          <ERPBadge status={s.status} size="sm" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </ERPPanel>
        )}

        {filtered.length === 0 && !selProj && (
          <div style={{gridColumn:'1/-1'}}>
            <ERPEmpty icon="📁" title="No projects found" sub="Change the filter or create a new project." />
          </div>
        )}
      </div>

      {/* Assign staff modal */}
      <ERPModal isOpen={showAssign && !!selProj} onClose={()=>setShowAssign(false)} title={`Assign Staff — ${selProj?.title}`} width={440}>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <div style={{fontSize:11,color:C.muted,marginBottom:4}}>Click to toggle assignment. ✓ = currently assigned.</div>
          {staffList.map(s => {
            const isAss = (selProj?.assignedStaff||[]).includes(s.id);
            return (
              <div key={s.id} onClick={()=>toggleStaff(selProj.id,s.id)}
                style={{
                  display:'flex',alignItems:'center',gap:12,padding:'12px',
                  borderRadius:12,cursor:'pointer',transition:'all 0.15s',
                  background:isAss?'rgba(0,102,255,0.1)':'rgba(10,24,56,0.6)',
                  border:`1px solid ${isAss?C.borderHi:C.border+'50'}`,
                }}
                onMouseEnter={e=>e.currentTarget.style.opacity='0.85'}
                onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
                <div style={{
                  width:36,height:36,borderRadius:10,flexShrink:0,
                  background:`linear-gradient(135deg,${s.avatarColor},${s.avatarColor}99)`,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  color:'#fff',fontWeight:800,fontSize:14,
                }}>{s.avatar}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.text}}>{s.name}</div>
                  <div style={{fontSize:10,color:C.muted}}>{s.role} · {s.department}</div>
                </div>
                <ERPBadge status={s.status} size="sm" />
                {isAss && <CheckCircle2 size={16} style={{color:C.green,flexShrink:0}} />}
              </div>
            );
          })}
          <ERPBtn variant="primary" onClick={()=>setShowAssign(false)} style={{justifyContent:'center',marginTop:6}}>
            Done
          </ERPBtn>
        </div>
      </ERPModal>
    </div>
  );
}
