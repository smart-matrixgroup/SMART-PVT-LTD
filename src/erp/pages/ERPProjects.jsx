import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection, onSnapshot, doc, updateDoc, deleteDoc, getDocs, addDoc,
  query, where, serverTimestamp
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  ERPPanel, ERPPanelHeader, ERPBadge, ERPBtn,
  ERPModal, ERPSelect, ERPInput, ERPEmpty, ERPAvatar,
  ERPProgress, C
} from '../components/ERPui';
import { rulesNotice } from '../rulesNotice';
import { formatWhen } from '../formatWhen';
import { nextNumber } from '../../staff/staffUtils';
import { useStaffDirectory } from '../useStaffDirectory';
import StaffAssignPicker, { StaffAssignChips } from '../components/StaffAssignPicker';
import { CheckCircle2, Circle, ExternalLink, Pencil, Trash2, Plus } from 'lucide-react';

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

// Phase 3 C — the old dev fixtures (DEV_ASSIGNMENTS) were deleted: invented
// staff names on fake projects only looked like real work assignments.

export default function ERPProjects() {
  const { isDevSession } = useAuth();
  const live = isFirebaseConfigured && !isDevSession;
  const navigate = useNavigate();
  const [projects,  setProjects]   = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selected,  setSelected]   = useState(null);
  const [filter,    setFilter]     = useState('All');
  const [saving,    setSaving]     = useState(false);
  const [showEdit,  setShowEdit]   = useState(false);
  const [editForm,  setEditForm]   = useState({ title:'', serviceType:'', clientName:'', clientCompany:'', status:'In Progress', completion:0, assignedStaff:[] });
  const [delTarget, setDelTarget]  = useState(null);
  const [delError,  setDelError]   = useState('');
  const [delBusy,   setDelBusy]    = useState(false);
  const [saveError, setSaveError]  = useState('');
  const [loadError, setLoadError]  = useState('');
  // New project (was missing entirely — projects could only be created from
  // the Clients page, so an empty Projects page had no way forward).
  const [clients,   setClients]    = useState([]);
  const [showNew,   setShowNew]    = useState(false);
  const [newForm,   setNewForm]    = useState({ title:'', serviceType:'', status:'requirements_pending', clientId:'', clientName:'', clientCompany:'', assignedStaff:[] });
  const [newError,  setNewError]   = useState('');
  const [notice,    setNotice]     = useState(null);

  // ERP → Staff directory, so a project can say who works on it.
  const { staff } = useStaffDirectory();

  useEffect(() => {
    if (!live) return;
    return onSnapshot(collection(db, 'clients'), snap => {
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(c => c.status !== 'deleted' && c.status !== 'archived')
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))));
    }, err => console.error('Clients listener error', err));
  }, [live]);

  useEffect(() => {
    if (!live) return;
    return onSnapshot(collection(db,'projects'), snap => {
      setProjects(snap.docs.map(d=>({id:d.id,...d.data()})).filter(p => p.status !== 'deleted'));
      setLoadError('');
    }, err => {
      console.error('Projects listener error', err);
      setLoadError(
        err.code === 'permission-denied'
          ? rulesNotice('Projects')
          : (err.message || "Couldn't load projects. Refresh the page to retry.")
      );
    });
  }, [live]);

  // Phase 3 C — real work assignments (Staff → Work) shown on project
  // cards/detail. Staff names travel with the assignment document.
  useEffect(() => {
    if (!live) return;
    return onSnapshot(collection(db, 'workAssignments'), snap => {
      setAssignments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => console.error('Work assignments listener error', err));
  }, [live]);

  // Every project gets a code (PR-2026-0001). Projects created before codes
  // existed get one once, the first time this page sees them.
  const codedRef = useRef(false);
  useEffect(() => {
    if (!live || codedRef.current) return;
    const missing = projects.filter(p => !p.projectCode && p.status !== 'deleted' && p.status !== 'archived');
    if (!missing.length) return;
    codedRef.current = true;
    (async () => {
      for (const p of missing) {
        try {
          const projectCode = await nextNumber('projects', 'PR');
          await updateDoc(doc(db, 'projects', p.id), { projectCode });
          setProjects(prev => prev.map(x => x.id === p.id ? { ...x, projectCode } : x));
        } catch (e) {
          console.error('project code backfill failed', e);
        }
      }
    })();
  }, [live, projects]);

  // Initials + colour for compact staff chips.
  const initialsOf = name => (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const chipColor  = name => COLORS[(name || '').length % COLORS.length];

  // Project team = the staff picked on the project form (assignedStaff ids,
  // with assignedStaffNames kept beside them so old/offline rows still show
  // a real name instead of an id).
  const teamOf = proj => (Array.isArray(proj?.assignedStaff) ? proj.assignedStaff : [])
    .map((id, i) => ({
      id,
      name: staff.find(s => s.id === id)?.name
         || (Array.isArray(proj?.assignedStaffNames) ? proj.assignedStaffNames[i] : '')
         || id,
    }))
    .filter(Boolean);

  // What actually gets written on the project doc for a team selection.
  const teamFields = ids => {
    const list = Array.isArray(ids) ? ids : [];
    return {
      assignedStaff: list,
      assignedStaffNames: list.map(id => staff.find(s => s.id === id)?.name || id),
    };
  };

  const FILTER_LABEL = {
    All:'All',
    requirements_pending:'Requirements',
    'In Progress':'In Progress',
    advance_paid:'Advance Paid',
    quotation_sent:'Quote Sent',
    Completed:'Completed',
    archived:'Archived',
  };
  const filters = Object.keys(FILTER_LABEL);
  const filtered = filter==='All' ? projects : projects.filter(p=>p.status===filter);

  const selProj = selected ? projects.find(p=>p.id===selected) : null;
  const projAs  = selProj ? assignments.filter(a=>a.projectId===selProj.id) : [];

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
    if (live) {
      try { await updateDoc(doc(db,'projects',projId),{completion:pct,updatedAt:serverTimestamp()}); } catch(e){ console.error(e); }
    }
  };

  const openEdit = (proj, e) => {
    if (e) e.stopPropagation();
    setSelected(proj.id);
    setEditForm({
      title: proj.title || '',
      serviceType: proj.serviceType || '',
      clientName: proj.clientName || '',
      clientCompany: proj.clientCompany || '',
      status: proj.status || 'In Progress',
      completion: proj.completion || 0,
      assignedStaff: Array.isArray(proj.assignedStaff) ? proj.assignedStaff : [],
    });
    setSaveError('');
    setShowEdit(true);
  };

  const saveEdit = async () => {
    if (!selected) return;
    if (!editForm.title.trim()) {
      setSaveError('Project title is required.');
      return;
    }
    setSaveError('');
    setSaving(true);
    const patch = {
      title: editForm.title.trim(),
      serviceType: editForm.serviceType.trim(),
      clientName: editForm.clientName.trim(),
      clientCompany: editForm.clientCompany.trim(),
      status: editForm.status,
      completion: Math.max(0, Math.min(100, Number(editForm.completion)||0)),
      ...teamFields(editForm.assignedStaff),
    };
    setProjects(prev => prev.map(p => p.id === selected ? { ...p, ...patch } : p));
    if (live) {
      try {
        await updateDoc(doc(db,'projects',selected), { ...patch, updatedAt: serverTimestamp() });
        setShowEdit(false);
      } catch(e){
        console.error(e);
        setSaveError(e.message || "Couldn't save the project. Please try again.");
      }
    } else {
      setShowEdit(false);
    }
    setSaving(false);
  };

  const requestDelete = (proj, e) => {
    if (e) e.stopPropagation();
    setDelError('');
    setDelTarget(proj);
  };

  const confirmDelete = async () => {
    if (!delTarget) return;
    setDelBusy(true);
    setDelError('');
    try {
      // Only money blocks a permanent delete: payments & receipts live inside
      // quotations, so a linked quotation must survive. Staff task assignments
      // belong to this project and go with it.
      let quotes = 0;
      let linkedAssignments = [];
      if (live) {
        const [byId, byTitle, byAssignments] = await Promise.all([
          getDocs(query(collection(db,'quotations'), where('projectId','==', delTarget.id))),
          getDocs(query(collection(db,'quotations'), where('projectTitle','==', delTarget.title))),
          getDocs(query(collection(db,'workAssignments'), where('projectId','==', delTarget.id))),
        ]);
        quotes = byId.size + byTitle.size;
        linkedAssignments = byAssignments.docs;
      }
      if (quotes > 0) {
        setDelError(`Cannot permanently delete: ${quotes} linked quotation(s) exist. Archive the project instead — the quotation and its money history stay intact.`);
        setDelBusy(false);
        return;
      }
      if (linkedAssignments.length > 0) {
        await Promise.all(linkedAssignments.map(d => deleteDoc(d.ref)));
        setAssignments(prev => prev.filter(a => a.projectId !== delTarget.id));
      }
      setProjects(prev => prev.filter(p => p.id !== delTarget.id));
      if (selected === delTarget.id) setSelected(null);
      if (live) await deleteDoc(doc(db,'projects', delTarget.id));
      setNotice({ kind:'ok', msg:`"${delTarget.title}" permanently deleted${linkedAssignments.length ? ` along with ${linkedAssignments.length} staff task(s)` : ''}.` });
      setDelTarget(null);
    } catch (err) {
      console.error(err);
      setDelError(err.message || 'Delete failed.');
    } finally {
      setDelBusy(false);
    }
  };

  const archiveProject = async () => {
    if (!delTarget) return;
    setDelBusy(true);
    try {
      setProjects(prev => prev.map(p => p.id === delTarget.id ? { ...p, status: 'archived' } : p));
      if (live) await updateDoc(doc(db,'projects', delTarget.id), { status: 'archived', archivedAt: serverTimestamp() });
      setNotice({ kind:'ok', msg:`"${delTarget.title}" archived — it stays visible under the Archived filter.` });
      setDelTarget(null);
      setDelError('');
    } catch (err) {
      setDelError(err.message || 'Archive failed.');
    } finally {
      setDelBusy(false);
    }
  };

  // Create a project straight from this page, optionally for an existing client.
  const createProject = async () => {
    if (!newForm.title.trim()) { setNewError('Project title is required.'); return; }
    setNewError('');
    setSaving(true);
    const projectCode = live
      ? await nextNumber('projects', 'PR')
      : `PR-${new Date().getFullYear()}-${String(projects.length + 1).padStart(4, '0')}`;
    const payload = {
      projectCode,
      title: newForm.title.trim(),
      serviceType: newForm.serviceType.trim(),
      clientId: newForm.clientId || '',
      clientName: newForm.clientName.trim(),
      clientCompany: newForm.clientCompany.trim(),
      status: newForm.status,
      completion: 0,
      milestones: [],
      ...teamFields(newForm.assignedStaff),
      createdAt: serverTimestamp(),
    };
    try {
      if (live) {
        const ref = await addDoc(collection(db,'projects'), payload);
        setProjects(p => [{ ...payload, id: ref.id }, ...p]);
      } else {
        setProjects(p => [{ ...payload, id:`P${Date.now()}`, createdAt: new Date().toISOString() }, ...p]);
      }
      setNotice({ kind:'ok', msg:`Project "${payload.title}" created.` });
      setShowNew(false);
      setFilter('All');
    } catch (err) {
      console.error(err);
      setNewError(err.message || 'Could not create the project.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {notice && (
        <div style={{
          padding:'10px 14px', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'space-between',
          background: notice.kind==='ok' ? 'rgba(24,199,122,0.12)' : 'rgba(240,90,103,0.12)',
          border: `1px solid ${notice.kind==='ok' ? 'rgba(24,199,122,0.35)' : 'rgba(240,90,103,0.35)'}`,
          color: notice.kind==='ok' ? C.green : C.red, fontSize:12, fontWeight:600,
        }}>
          <span>{notice.msg}</span>
          <button onClick={()=>setNotice(null)} style={{ background:'none', border:'none', color:'inherit', cursor:'pointer', fontSize:14 }}>✕</button>
        </div>
      )}

      {/* Filters */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
        {filters.map(f => {
          const lbl = FILTER_LABEL[f];
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
        <div style={{marginLeft:'auto',fontSize:12,color:C.muted,display:'flex',alignItems:'center',gap:10}}>
          {filtered.length} projects
          <ERPBtn variant="primary" onClick={()=>{ setNewForm({ title:'', serviceType:'', status:'requirements_pending', clientId:'', clientName:'', clientCompany:'', assignedStaff:[] }); setNewError(''); setShowNew(true); }}>
            <Plus size={13}/> New Project
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

      {/* Main grid */}
      <div style={{ display:'grid', gridTemplateColumns: selProj ? '1fr 420px' : 'repeat(auto-fill,minmax(320px,1fr))', gap:16 }}>

        {/* Project cards (when no selection) */}
        {!selProj && filtered.map((proj, i) => {
          const projAs = assignments.filter(a=>a.projectId===proj.id);
          const team   = teamOf(proj);
          const faces  = team.length ? team.map(t=>t.name) : projAs.map(a=>a.staffName);
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
                  {proj.projectCode && (
                    <div style={{fontSize:9.5,fontWeight:800,color:C.cyan,fontFamily:'monospace',
                      letterSpacing:0.5,marginBottom:4}}>{proj.projectCode}</div>
                  )}
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
                <div style={{display:'flex'}}>
                  {faces.length>0 ? faces.slice(0,4).map((nm,k)=>(
                    <div key={`${nm}-${k}`} title={nm} style={{
                      width:24,height:24,borderRadius:'50%',background:chipColor(nm),
                      display:'flex',alignItems:'center',justifyContent:'center',
                      fontSize:8.5,fontWeight:800,color:'#fff',
                      border:'2px solid #040D1F',marginLeft:-6,
                    }}>{initialsOf(nm)}</div>
                  )) : <span style={{fontSize:10,color:C.muted}}>No staff assigned</span>}
                  {faces.length>4 && <span style={{fontSize:10,color:C.muted,marginLeft:6,alignSelf:'center'}}>+{faces.length-4}</span>}
                </div>
                <span style={{fontSize:10,color:C.muted}}>{formatWhen(proj.createdAt)}</span>
              </div>
              <div style={{display:'flex',gap:8,marginTop:12}} onClick={e=>e.stopPropagation()}>
                <ERPBtn size="sm" variant="secondary" onClick={(e)=>openEdit(proj,e)}><Pencil size={12}/> Edit</ERPBtn>
                <ERPBtn size="sm" variant="danger" onClick={(e)=>requestDelete(proj,e)}><Trash2 size={12}/> Delete</ERPBtn>
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
                  <div style={{fontSize:10,color:C.muted}}>
                    {proj.projectCode ? <span style={{color:C.cyan,fontFamily:'monospace'}}>{proj.projectCode}</span> : null}
                    {proj.projectCode ? ' · ' : ''}{proj.clientName}
                  </div>
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
                  {selProj.projectCode && (
                    <div style={{fontSize:10,color:C.cyan,fontFamily:'monospace',marginTop:3}}>{selProj.projectCode}</div>
                  )}
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

              <div style={{display:'flex',gap:8}}>
                <ERPBtn size="sm" variant="secondary" onClick={()=>openEdit(selProj)} style={{flex:1,justifyContent:'center'}}>
                  <Pencil size={12}/> Edit / Update
                </ERPBtn>
                <ERPBtn size="sm" variant="danger" onClick={()=>requestDelete(selProj)} style={{flex:1,justifyContent:'center'}}>
                  <Trash2 size={12}/> Delete
                </ERPBtn>
              </div>

              {/* Client requirements — everything they submitted on the form */}
              {selProj.requirements && Object.keys(selProj.requirements).length > 0 && (
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:10}}>
                    Client requirements
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:7,padding:'10px 12px',borderRadius:10,
                    background:'rgba(10,24,56,0.6)',border:`1px solid ${C.border}30`,
                    maxHeight:230,overflowY:'auto'}}>
                    {Object.entries(selProj.requirements)
                      .filter(([, v]) => v && String(v).trim())
                      .map(([label, v]) => (
                        <div key={label} style={{display:'flex',gap:10,fontSize:11,lineHeight:1.5}}>
                          <span style={{width:110,flexShrink:0,color:C.muted}}>{label}</span>
                          <span style={{flex:1,color:C.subtle,fontWeight:600,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>{v}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

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

              {/* Project team — picked right here on the project (Edit /
                  Update → Assigned Staff). Tasks below still come from
                  Staff → Work. */}
              <div>
                <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:10}}>
                  Project Team ({teamOf(selProj).length})
                </div>
                {teamOf(selProj).length === 0 ? (
                  <div style={{fontSize:11,color:C.muted}}>No staff assigned</div>
                ) : (
                  <StaffAssignChips
                    ids={selProj.assignedStaff}
                    names={selProj.assignedStaffNames}
                    staff={staff} />
                )}
              </div>

              {/* Work assignments (real data from Staff → Work, Phase 3) */}
              <div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:'0.8px'}}>
                    Work Assignments ({projAs.length})
                  </div>
                  <ERPBtn size="sm" variant="secondary" onClick={()=>navigate('/erp/staff?tab=work')}>
                    <ExternalLink size={12} /> Manage
                  </ERPBtn>
                </div>
                {projAs.length === 0 ? (
                  <div style={{fontSize:11,color:C.muted,fontStyle:'italic'}}>
                    No work assigned yet — assign staff from Staff → Work.
                  </div>
                ) : (
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {projAs.map(a=>(
                      <div key={a.id} style={{
                        padding:'9px 12px',
                        borderRadius:10,background:'rgba(10,24,56,0.6)',border:`1px solid ${C.border}30`,
                      }}>
                        <div style={{display:'flex',alignItems:'center',gap:10}}>
                          <div style={{
                            width:28,height:28,borderRadius:8,flexShrink:0,
                            background:chipColor(a.staffName),
                            display:'flex',alignItems:'center',justifyContent:'center',
                            color:'#fff',fontWeight:800,fontSize:10,
                          }}>{initialsOf(a.staffName)}</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:12,fontWeight:700,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{a.title}</div>
                            <div style={{fontSize:10,color:C.muted}}>{a.staffName}{a.deadline ? ` · due ${a.deadline}` : ''}</div>
                          </div>
                          <ERPBadge status={a.status} size="sm" />
                          <span style={{fontSize:10,fontWeight:800,color:C.cyan,minWidth:32,textAlign:'right'}}>{a.progress||0}%</span>
                        </div>
                        <div style={{marginTop:7}}><ERPProgress value={a.progress||0} /></div>
                      </div>
                    ))}
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

      {/* Edit / update project modal */}
      <ERPModal isOpen={showEdit} onClose={()=>setShowEdit(false)} title="Edit Project" width={460}>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <ERPInput label="Project Title" value={editForm.title} required
            onChange={e=>setEditForm(p=>({...p,title:e.target.value}))}
            placeholder="e.g. Corporate Website Redesign" />
          <ERPInput label="Service Type" value={editForm.serviceType}
            onChange={e=>setEditForm(p=>({...p,serviceType:e.target.value}))}
            placeholder="e.g. ERP & POS System" />
          <ERPInput label="Client Name" value={editForm.clientName}
            onChange={e=>setEditForm(p=>({...p,clientName:e.target.value}))} />
          <ERPInput label="Client Company" value={editForm.clientCompany}
            onChange={e=>setEditForm(p=>({...p,clientCompany:e.target.value}))} />
          <StaffAssignPicker
            staff={staff}
            value={editForm.assignedStaff}
            onChange={ids=>setEditForm(p=>({ ...p, assignedStaff: ids }))} />
          <ERPSelect label="Status" value={editForm.status}
            onChange={e=>setEditForm(p=>({...p,status:e.target.value}))}
            options={STATUS_OPTS} />
          <div>
            <label style={{display:'block',fontSize:11,fontWeight:600,color:C.subtle,marginBottom:6}}>
              Completion %
            </label>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <input type="range" min={0} max={100} value={Number(editForm.completion)||0}
                onChange={e=>setEditForm(p=>({...p,completion:Number(e.target.value)}))}
                style={{flex:1,accentColor:C.blue}} />
              <span style={{fontSize:13,fontWeight:800,color:C.cyan,minWidth:36,textAlign:'right'}}>
                {Number(editForm.completion)||0}%
              </span>
            </div>
          </div>
          {saveError && (
            <div style={{ padding:'10px 12px', borderRadius:10, background:'rgba(245,185,66,0.1)', border:'1px solid rgba(245,185,66,0.35)', fontSize:11, color:C.amber, lineHeight:1.5 }}>
              {saveError}
            </div>
          )}
          <div style={{display:'flex',gap:10}}>
            <ERPBtn variant="secondary" onClick={()=>setShowEdit(false)} style={{flex:1,justifyContent:'center'}}>Cancel</ERPBtn>
            <ERPBtn variant="primary" onClick={saveEdit} disabled={saving} style={{flex:1,justifyContent:'center'}}>
              {saving ? 'Saving...' : 'Save Changes'}
            </ERPBtn>
          </div>
        </div>
      </ERPModal>

      {/* Delete confirmation — without this modal the Delete button did
          nothing at all (it only set delTarget). */}
      <ERPModal isOpen={!!delTarget} onClose={()=>{setDelTarget(null);setDelError('');}} title="Delete Project?" width={460}>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div style={{fontSize:12,color:C.muted,lineHeight:1.6}}>
            Permanently delete <strong style={{color:C.text}}>{delTarget?.title}</strong>?
            If this project has quotations or staff task assignments, deletion is blocked —
            archive it instead and it stays under the Archived filter.
          </div>
          {delError && (
            <div style={{ padding:'10px 12px', borderRadius:10, background:'rgba(245,185,66,0.1)', border:'1px solid rgba(245,185,66,0.35)', fontSize:11, color:C.amber, lineHeight:1.5 }}>
              {delError}
            </div>
          )}
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            <ERPBtn variant="secondary" onClick={()=>{setDelTarget(null);setDelError('');}} style={{flex:1,justifyContent:'center'}}>Cancel</ERPBtn>
            {delError ? (
              <ERPBtn variant="secondary" onClick={archiveProject} disabled={delBusy} style={{flex:1,justifyContent:'center'}}>
                {delBusy ? 'Saving...' : 'Archive instead'}
              </ERPBtn>
            ) : (
              <ERPBtn variant="danger" onClick={confirmDelete} disabled={delBusy} style={{flex:1,justifyContent:'center'}}>
                {delBusy ? 'Checking...' : 'Confirm Delete'}
              </ERPBtn>
            )}
          </div>
          {!delError && (
            <button onClick={archiveProject} disabled={delBusy}
              style={{ background:'none', border:'none', color:C.muted, fontSize:11, cursor:'pointer', textDecoration:'underline' }}>
              or just archive it
            </button>
          )}
        </div>
      </ERPModal>

      {/* New project */}
      <ERPModal isOpen={showNew} onClose={()=>setShowNew(false)} title="New Project" width={460}>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <ERPInput label="Project title" value={newForm.title} required
            onChange={e=>setNewForm(p=>({...p,title:e.target.value}))}
            placeholder="e.g. Portfolio Website" />
          <ERPInput label="Service type" value={newForm.serviceType}
            onChange={e=>setNewForm(p=>({...p,serviceType:e.target.value}))}
            placeholder="e.g. Portfolio" />
          {clients.length > 0 && (
            <ERPSelect label="Client" value={newForm.clientId}
              onChange={e=>{
                const c = clients.find(x => x.id === e.target.value);
                setNewForm(p => ({ ...p, clientId: e.target.value, clientName: c?.name || '', clientCompany: c?.company || '' }));
              }}
              options={[{ value:'', label:'— No client / type manually —' }, ...clients.map(c => ({ value:c.id, label:`${c.name}${c.company ? ` — ${c.company}` : ''}` }))]} />
          )}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <ERPInput label="Client name" value={newForm.clientName}
              onChange={e=>setNewForm(p=>({...p,clientName:e.target.value}))} placeholder="e.g. Nimal Perera" />
            <ERPInput label="Client company" value={newForm.clientCompany}
              onChange={e=>setNewForm(p=>({...p,clientCompany:e.target.value}))} placeholder="e.g. Love Cake House" />
          </div>
          <StaffAssignPicker
            staff={staff}
            value={newForm.assignedStaff}
            onChange={ids=>setNewForm(p=>({ ...p, assignedStaff: ids }))} />
          <ERPSelect label="Status" value={newForm.status}
            onChange={e=>setNewForm(p=>({...p,status:e.target.value}))}
            options={STATUS_OPTS} />
          {newError && (
            <div style={{ padding:'10px 12px', borderRadius:10, background:'rgba(245,185,66,0.1)', border:'1px solid rgba(245,185,66,0.35)', fontSize:11, color:C.amber, lineHeight:1.5 }}>
              {newError}
            </div>
          )}
          <div style={{display:'flex',gap:10}}>
            <ERPBtn variant="secondary" onClick={()=>setShowNew(false)} style={{flex:1,justifyContent:'center'}}>Cancel</ERPBtn>
            <ERPBtn variant="primary" onClick={createProject} disabled={saving} style={{flex:1,justifyContent:'center'}}>
              <Plus size={12}/> {saving ? 'Creating...' : 'Create Project'}
            </ERPBtn>
          </div>
        </div>
      </ERPModal>

    </div>
  );
}
