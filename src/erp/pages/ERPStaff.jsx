import React, { useState } from 'react';
import { staffList } from '../../config/staff';
import { ERPPanel, ERPPanelHeader, ERPBadge, ERPBtn, ERPModal, ERPInput, ERPSelect, ERPEmpty, ERPAvatar, ERPProgress, C } from '../components/ERPui';
import { Plus, CheckCircle2, Mail, Phone, Calendar, Briefcase, DollarSign, TrendingUp } from 'lucide-react';

// Salary data (in real app → Firestore staff/{id}/salaryHistory)
const SALARY_DATA = {
  'STAFF-001': { monthly:85000, history:[{month:'Oct 2026',paid:true,paidAt:'Oct 1'},{month:'Sep 2026',paid:true,paidAt:'Sep 1'},{month:'Aug 2026',paid:true,paidAt:'Aug 1'}] },
  'STAFF-002': { monthly:60000, history:[{month:'Oct 2026',paid:false,paidAt:null},{month:'Sep 2026',paid:true,paidAt:'Sep 1'},{month:'Aug 2026',paid:true,paidAt:'Aug 1'}] },
  'STAFF-003': { monthly:55000, history:[{month:'Oct 2026',paid:false,paidAt:null},{month:'Sep 2026',paid:true,paidAt:'Sep 1'},{month:'Aug 2026',paid:false,paidAt:null}] },
  'STAFF-004': { monthly:70000, history:[{month:'Oct 2026',paid:true,paidAt:'Oct 2'},{month:'Sep 2026',paid:true,paidAt:'Sep 2'},{month:'Aug 2026',paid:true,paidAt:'Aug 2'}] },
  'STAFF-005': { monthly:75000, history:[{month:'Oct 2026',paid:false,paidAt:null},{month:'Sep 2026',paid:true,paidAt:'Sep 1'},{month:'Aug 2026',paid:true,paidAt:'Aug 1'}] },
};

const PROJ_WORK = {
  'STAFF-001': [{title:'Corporate Website Redesign',status:'In Progress',role:'Lead Developer',pct:65},{title:'ERP Implementation',status:'Completed',role:'Backend Dev',pct:100}],
  'STAFF-002': [{title:'Corporate Website Redesign',status:'In Progress',role:'UI Designer',pct:65},{title:'Restaurant POS',status:'advance_paid',role:'UI Designer',pct:40}],
  'STAFF-003': [{title:'Annual Tax Filing 2024',status:'Completed',role:'Tax Consultant',pct:100},{title:'Monthly Bookkeeping',status:'In Progress',role:'Accountant',pct:70}],
  'STAFF-004': [{title:'Restaurant POS System',status:'advance_paid',role:'Mobile Dev',pct:40}],
  'STAFF-005': [{title:'Corporate Website Redesign',status:'In Progress',role:'Project Manager',pct:65},{title:'Mobile App Development',status:'quotation_sent',role:'Project Manager',pct:0}],
};

const MONTHS = ['Oct 2026','Nov 2026','Dec 2026'];

export default function ERPStaff() {
  const [selected,   setSelected]   = useState(null);
  const [salaries,   setSalaries]   = useState(SALARY_DATA);
  const [showAdd,    setShowAdd]     = useState(false);
  const [salaryView, setSalaryView]  = useState('overview'); // 'overview' | 'history'
  const [addForm,    setAddForm]     = useState({name:'',role:'',department:'',email:'',phone:'',monthly:''});

  const selStaff   = selected ? staffList.find(s=>s.id===selected) : null;
  const selSalary  = selected ? salaries[selected] : null;
  const selWork    = selected ? (PROJ_WORK[selected]||[]) : [];
  const pending    = Object.entries(salaries).filter(([id,s])=>s.history[0]&&!s.history[0].paid);
  const totalPending = pending.reduce((sum,[id,s])=>sum+s.monthly,0);

  const handleMarkPaid = (staffId, monthIdx=0) => {
    setSalaries(prev=>({
      ...prev,
      [staffId]: {
        ...prev[staffId],
        history: prev[staffId].history.map((h,i)=>i===monthIdx?{...h,paid:true,paidAt:'Today'}:h),
      }
    }));
  };

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>

      {/* Salary summary bar */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
        {[
          {label:'Total Staff',    val:staffList.length,  color:C.cyan,  icon:'👥'},
          {label:'Active',         val:staffList.filter(s=>s.status==='active').length, color:C.green, icon:'✅'},
          {label:'Salary Pending', val:pending.length,    color:C.amber, icon:'⏳'},
          {label:'Pending Amount', val:`LKR ${totalPending.toLocaleString()}`, color:C.red, icon:'💰'},
        ].map(s=>(
          <div key={s.label} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:'14px 16px',backdropFilter:'blur(12px)',position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',top:-10,right:-10,fontSize:36,opacity:0.06}}>{s.icon}</div>
            <div style={{fontSize:20,marginBottom:4}}>{s.icon}</div>
            <div style={{fontSize:18,fontWeight:900,color:s.color}}>{s.val}</div>
            <div style={{fontSize:11,color:C.muted,marginTop:2}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div style={{display:'grid',gridTemplateColumns:selStaff?'1fr 400px':'repeat(auto-fill,minmax(280px,1fr))',gap:14}}>

        {/* Staff cards */}
        {!selStaff && staffList.map((s,i)=>{
          const sal = salaries[s.id];
          const isPending = sal?.history[0] && !sal.history[0].paid;
          const work = PROJ_WORK[s.id]||[];
          const active = work.filter(w=>w.status!=='Completed').length;
          return (
            <div key={s.id} onClick={()=>setSelected(s.id)}
              style={{
                background:C.surface,border:`1px solid ${isPending?'rgba(245,185,66,0.3)':C.border}`,
                borderRadius:16,padding:18,cursor:'pointer',transition:'all 0.2s',backdropFilter:'blur(12px)',
                position:'relative',overflow:'hidden',
              }}
              onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-3px)';e.currentTarget.style.boxShadow='0 12px 30px rgba(0,0,0,0.3)';e.currentTarget.style.borderColor=C.borderHi;}}
              onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none';e.currentTarget.style.borderColor=isPending?'rgba(245,185,66,0.3)':C.border;}}>
              <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${s.avatarColor||C.blue}80,transparent)`}} />
              {isPending && <div style={{position:'absolute',top:12,right:12,width:8,height:8,borderRadius:'50%',background:C.amber,boxShadow:`0 0 8px ${C.amber}`}} />}

              <div style={{display:'flex',gap:12,alignItems:'flex-start',marginBottom:12}}>
                <div style={{
                  width:46,height:46,borderRadius:13,flexShrink:0,
                  background:`linear-gradient(135deg,${s.avatarColor||C.blue},${s.avatarColor||C.blue}99)`,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  color:'#fff',fontWeight:900,fontSize:18,
                  boxShadow:`0 4px 14px ${s.avatarColor||C.blue}50`,
                }}>{s.avatar}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:800,color:C.text}}>{s.name}</div>
                  <div style={{fontSize:11,color:C.muted}}>{s.role}</div>
                  <ERPBadge status={s.status} size="sm" />
                </div>
              </div>

              <div style={{display:'flex',flexDirection:'column',gap:4,marginBottom:12}}>
                <div style={{fontSize:11,color:C.muted,display:'flex',gap:6}}><Mail size={11} style={{color:C.cyan,marginTop:1}}/>{s.email}</div>
                <div style={{fontSize:11,color:C.muted,display:'flex',gap:6}}><Briefcase size={11} style={{color:C.violet,marginTop:1}}/>{s.department}</div>
              </div>

              {/* Salary status */}
              <div style={{padding:'10px 12px',borderRadius:10,background:isPending?'rgba(245,185,66,0.08)':'rgba(24,199,122,0.08)',border:`1px solid ${isPending?'rgba(245,185,66,0.2)':'rgba(24,199,122,0.2)'}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontSize:10,color:C.muted}}>Monthly Salary</div>
                  <div style={{fontSize:15,fontWeight:900,color:C.text}}>LKR {sal?.monthly.toLocaleString()}</div>
                </div>
                <ERPBadge status={isPending?'Pending':'Paid'} />
              </div>

              {/* Active projects */}
              <div style={{marginTop:10,paddingTop:8,borderTop:`1px solid ${C.border}20`,display:'flex',gap:16}}>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:16,fontWeight:900,color:C.cyan}}>{work.length}</div>
                  <div style={{fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:'0.5px'}}>Total</div>
                </div>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:16,fontWeight:900,color:C.blue}}>{active}</div>
                  <div style={{fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:'0.5px'}}>Active</div>
                </div>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:16,fontWeight:900,color:C.green}}>{work.filter(w=>w.status==='Completed').length}</div>
                  <div style={{fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:'0.5px'}}>Done</div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Staff list when detail open */}
        {selStaff && (
          <ERPPanel>
            <ERPPanelHeader title="Staff Members" icon="👥" />
            {staffList.map((s,i)=>{
              const sal = salaries[s.id];
              const isPending = sal?.history[0]&&!sal.history[0].paid;
              return (
                <div key={s.id} onClick={()=>setSelected(s.id)}
                  style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderTop:i>0?`1px solid ${C.border}25`:'none',cursor:'pointer',background:selected===s.id?'rgba(0,102,255,0.07)':'transparent',borderLeft:selected===s.id?'3px solid #0066FF':'3px solid transparent',transition:'background 0.1s'}}
                  onMouseEnter={e=>{if(selected!==s.id)e.currentTarget.style.background='rgba(0,102,255,0.04)';}}
                  onMouseLeave={e=>{if(selected!==s.id)e.currentTarget.style.background='transparent';}}>
                  <div style={{width:32,height:32,borderRadius:9,flexShrink:0,background:`linear-gradient(135deg,${s.avatarColor},${s.avatarColor}99)`,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:13}}>{s.avatar}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:700,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.name}</div>
                    <div style={{fontSize:10,color:C.muted}}>{s.role}</div>
                  </div>
                  {isPending&&<div style={{width:7,height:7,borderRadius:'50%',background:C.amber,flexShrink:0}}/>}
                </div>
              );
            })}
          </ERPPanel>
        )}

        {/* Staff detail */}
        {selStaff && selSalary && (
          <div style={{display:'flex',flexDirection:'column',gap:12,alignSelf:'flex-start'}}>

            {/* Profile card */}
            <ERPPanel>
              <ERPPanelHeader title="Staff Profile" icon="👤" action={<span style={{cursor:'pointer'}} onClick={()=>setSelected(null)}>✕</span>} />
              <div style={{padding:18,display:'flex',flexDirection:'column',gap:14}}>
                <div style={{display:'flex',gap:14,alignItems:'center'}}>
                  <div style={{width:52,height:52,borderRadius:14,background:`linear-gradient(135deg,${selStaff.avatarColor},${selStaff.avatarColor}99)`,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:900,fontSize:22,boxShadow:`0 6px 16px ${selStaff.avatarColor}50`,flexShrink:0}}>{selStaff.avatar}</div>
                  <div>
                    <div style={{fontSize:16,fontWeight:900,color:C.text}}>{selStaff.name}</div>
                    <div style={{fontSize:12,color:C.muted}}>{selStaff.role} · {selStaff.department}</div>
                    <div style={{display:'flex',gap:6,marginTop:4,flexWrap:'wrap'}}>
                      <ERPBadge status={selStaff.status} />
                    </div>
                  </div>
                </div>

                {[{icon:<Mail size={12}/>,c:C.cyan,l:'Email',v:selStaff.email},{icon:<Phone size={12}/>,c:C.green,l:'Phone',v:selStaff.phone},{icon:<Calendar size={12}/>,c:C.muted,l:'Joined',v:selStaff.joinedDate}].map(({icon,c,l,v})=>(
                  <div key={l} style={{display:'flex',gap:10,alignItems:'center'}}>
                    <span style={{color:c,flexShrink:0}}>{icon}</span>
                    <span style={{fontSize:11,color:C.muted,width:50,flexShrink:0}}>{l}</span>
                    <span style={{fontSize:11,color:C.subtle,fontWeight:600}}>{v}</span>
                  </div>
                ))}

                <div>
                  <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:6}}>Skills</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                    {selStaff.skills.map(sk=>(
                      <span key={sk} style={{fontSize:10,padding:'3px 10px',borderRadius:20,background:'rgba(0,102,255,0.1)',color:C.cyan,border:`1px solid ${C.borderHi}`,fontWeight:600}}>{sk}</span>
                    ))}
                  </div>
                </div>
              </div>
            </ERPPanel>

            {/* Salary card */}
            <ERPPanel>
              <ERPPanelHeader title="Salary & Payments" icon="💰" />
              <div style={{padding:18,display:'flex',flexDirection:'column',gap:14}}>
                {/* Current month */}
                <div style={{padding:'14px',borderRadius:12,background:'rgba(0,102,255,0.08)',border:`1px solid ${C.borderHi}`}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div>
                      <div style={{fontSize:10,color:C.muted}}>Monthly Salary</div>
                      <div style={{fontSize:22,fontWeight:900,color:C.text}}>LKR {selSalary.monthly.toLocaleString()}</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:10,color:C.muted,marginBottom:4}}>Oct 2026</div>
                      <ERPBadge status={selSalary.history[0]?.paid?'Paid':'Pending'} />
                    </div>
                  </div>
                  {!selSalary.history[0]?.paid && (
                    <ERPBtn variant="success" onClick={()=>handleMarkPaid(selStaff.id)} style={{width:'100%',justifyContent:'center',marginTop:10}}>
                      <CheckCircle2 size={13}/> Mark October Salary Paid
                    </ERPBtn>
                  )}
                </div>

                {/* History */}
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:8}}>Payment History</div>
                  {selSalary.history.map((h,i)=>(
                    <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:i<selSalary.history.length-1?`1px solid ${C.border}25`:'none'}}>
                      <span style={{fontSize:12,color:C.subtle,fontWeight:600}}>{h.month}</span>
                      <div style={{display:'flex',gap:10,alignItems:'center'}}>
                        <span style={{fontSize:12,fontWeight:700,color:C.text}}>LKR {selSalary.monthly.toLocaleString()}</span>
                        <ERPBadge status={h.paid?'Paid':'Pending'} size="sm" />
                        {h.paidAt&&<span style={{fontSize:10,color:C.muted}}>on {h.paidAt}</span>}
                        {!h.paid&&<ERPBtn size="sm" variant="success" onClick={()=>handleMarkPaid(selStaff.id,i)}><CheckCircle2 size={10}/></ERPBtn>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </ERPPanel>

            {/* Work summary */}
            <ERPPanel>
              <ERPPanelHeader title="Work Summary" icon="📁" />
              <div style={{padding:18,display:'flex',flexDirection:'column',gap:10}}>
                {selWork.length===0 ? (
                  <div style={{fontSize:11,color:C.muted,textAlign:'center',padding:'8px 0'}}>No projects assigned.</div>
                ) : selWork.map((w,i)=>(
                  <div key={i} style={{padding:'10px 12px',borderRadius:10,background:'rgba(10,24,56,0.6)',border:`1px solid ${C.border}30`}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                      <div>
                        <div style={{fontSize:12,fontWeight:700,color:C.text}}>{w.title}</div>
                        <div style={{fontSize:10,color:C.cyan}}>Role: {w.role}</div>
                      </div>
                      <ERPBadge status={w.status} size="sm" />
                    </div>
                    <ERPProgress value={w.pct} />
                    <div style={{fontSize:10,color:C.cyan,marginTop:4,textAlign:'right'}}>{w.pct}% complete</div>
                  </div>
                ))}
              </div>
            </ERPPanel>
          </div>
        )}
      </div>

      {/* Add staff modal */}
      <ERPModal isOpen={showAdd} onClose={()=>setShowAdd(false)} title="Add Staff Member" width={460}>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <ERPInput label="Full Name" value={addForm.name} required onChange={e=>setAddForm(p=>({...p,name:e.target.value}))} placeholder="e.g. Kasun Perera" />
            <ERPInput label="Role / Job Title" value={addForm.role} onChange={e=>setAddForm(p=>({...p,role:e.target.value}))} placeholder="e.g. Full Stack Developer" />
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <ERPSelect label="Department" value={addForm.department} onChange={e=>setAddForm(p=>({...p,department:e.target.value}))}
              placeholder="Select..." options={['Engineering','Design','Finance','Operations','Management']} />
            <ERPInput label="Monthly Salary (LKR)" value={addForm.monthly} type="number" onChange={e=>setAddForm(p=>({...p,monthly:e.target.value}))} placeholder="e.g. 65000" />
          </div>
          <ERPInput label="Email" value={addForm.email} type="email" onChange={e=>setAddForm(p=>({...p,email:e.target.value}))} placeholder="staff@smartpvtltd.com" />
          <ERPInput label="Phone" value={addForm.phone} onChange={e=>setAddForm(p=>({...p,phone:e.target.value}))} placeholder="+94 77 000 0000" />
          <div style={{display:'flex',gap:10}}>
            <ERPBtn variant="secondary" onClick={()=>setShowAdd(false)} style={{flex:1,justifyContent:'center'}}>Cancel</ERPBtn>
            <ERPBtn variant="primary" style={{flex:1,justifyContent:'center'}} onClick={()=>setShowAdd(false)}>
              <Plus size={13}/> Add Staff
            </ERPBtn>
          </div>
        </div>
      </ERPModal>

      {/* FAB add button */}
      <div style={{position:'fixed',bottom:30,right:30,zIndex:50}}>
        <button onClick={()=>setShowAdd(true)} style={{
          width:52,height:52,borderRadius:'50%',background:'linear-gradient(135deg,#0066FF,#00D9FF)',
          border:'none',cursor:'pointer',color:'#fff',fontSize:22,fontWeight:700,
          boxShadow:'0 6px 20px rgba(0,102,255,0.5)',transition:'all 0.2s',display:'flex',alignItems:'center',justifyContent:'center',
        }}
          onMouseEnter={e=>{e.currentTarget.style.transform='scale(1.1)';e.currentTarget.style.boxShadow='0 8px 25px rgba(0,102,255,0.7)';}}
          onMouseLeave={e=>{e.currentTarget.style.transform='scale(1)';e.currentTarget.style.boxShadow='0 6px 20px rgba(0,102,255,0.5)';}}>
          +
        </button>
      </div>
    </div>
  );
}
