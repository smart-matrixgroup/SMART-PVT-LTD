import React, { useState, useEffect } from 'react';
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  ERPPanel, ERPPanelHeader, ERPBadge, ERPBtn,
  ERPModal, ERPInput, ERPSelect, ERPTextarea,
  ERPEmpty, ERPAvatar, C
} from '../components/ERPui';
import { Plus, Send, Trash2, Edit2, CheckCircle2, Eye, Copy } from 'lucide-react';

const CLIENTS = [
  { id:'C001', name:'John Perera',    company:'Perera Holdings' },
  { id:'C002', name:'Sarah Fernando', company:'Mehala Restaurant' },
  { id:'C003', name:'Kumar Arasan',   company:'KA Retail' },
  { id:'C004', name:'Priya Nair',     company:'PN Accounting' },
  { id:'C005', name:'Dilan Perera',   company:'DP Constructions' },
];
const PROJECTS_MAP = {
  C001:[{id:'P001',title:'Corporate Website Redesign'},{id:'P002',title:'SMARTORIX ERP Setup'}],
  C002:[{id:'P003',title:'Restaurant POS System'}],
  C003:[{id:'P004',title:'Mobile App Development'}],
  C004:[{id:'P005',title:'Annual Tax Filing 2024'},{id:'P006',title:'Monthly Bookkeeping'}],
  C005:[],
};

const DEV_QUOTES = [
  {
    id:'QT001',clientId:'C001',clientName:'John Perera',clientCompany:'Perera Holdings',
    projectTitle:'Corporate Website Redesign',
    totalAmount:85000,advanceAmount:30000,advancePct:35,
    validUntil:'2026-11-15',status:'accepted',createdAt:'Oct 1, 2026',
    breakdown:[
      {id:'b1',label:'Design & UI/UX',   amount:25000},
      {id:'b2',label:'Development',      amount:45000},
      {id:'b3',label:'SEO & Deployment', amount:15000},
    ],
    notes:'Includes 3 months free support after launch.',
    terms:'50% advance, 50% on delivery.',
  },
  {
    id:'QT002',clientId:'C002',clientName:'Sarah Fernando',clientCompany:'Mehala Restaurant',
    projectTitle:'Restaurant POS System',
    totalAmount:120000,advanceAmount:50000,advancePct:42,
    validUntil:'2026-11-30',status:'sent',createdAt:'Oct 3, 2026',
    breakdown:[
      {id:'b1',label:'POS Module',          amount:50000},
      {id:'b2',label:'Table Management',    amount:30000},
      {id:'b3',label:'Inventory & Reports', amount:25000},
      {id:'b4',label:'Training & Setup',    amount:15000},
    ],
    notes:'Includes 6 months warranty support.',
    terms:'Milestone-based billing.',
  },
  {
    id:'QT003',clientId:'C003',clientName:'Kumar Arasan',clientCompany:'KA Retail',
    projectTitle:'Mobile App Development',
    totalAmount:150000,advanceAmount:50000,advancePct:33,
    validUntil:'2026-12-15',status:'draft',createdAt:'Oct 5, 2026',
    breakdown:[
      {id:'b1',label:'Architecture & Design',    amount:40000},
      {id:'b2',label:'Android & iOS Development',amount:90000},
      {id:'b3',label:'Testing & Deployment',     amount:20000},
    ],
    notes:'',
    terms:'',
  },
];

const COLORS = ['#0066FF','#8B5CF6','#18C77A','#F5B942','#F05A67'];
const buid = () => `b${Date.now()}_${Math.random().toString(36).slice(2,5)}`;

const EMPTY_FORM = {
  clientId:'', projectTitle:'', notes:'', terms:'',
  validUntil:'', advancePct:30,
  items:[{ id:buid(), label:'', amount:'' }],
};

export default function ERPQuotations() {
  const { isDevSession } = useAuth();
  const [quotes,     setQuotes]     = useState(DEV_QUOTES);
  const [filter,     setFilter]     = useState('All');
  const [view,       setView]       = useState('list');   // 'list' | 'form'
  const [editId,     setEditId]     = useState(null);     // quote being edited
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [selected,   setSelected]   = useState(null);     // detail view
  const [saving,     setSaving]     = useState(false);
  const [delConfirm, setDelConfirm] = useState(null);

  useEffect(()=>{
    if (!isFirebaseConfigured||isDevSession) return;
    const q = query(collection(db,'quotations'),orderBy('createdAt','desc'));
    return onSnapshot(q,snap=>setQuotes(snap.docs.map(d=>({id:d.id,...d.data()}))));
  },[isDevSession]);

  const filtered = filter==='All'?quotes:quotes.filter(q=>q.status===filter);
  const counts   = {All:quotes.length,draft:quotes.filter(q=>q.status==='draft').length,sent:quotes.filter(q=>q.status==='sent').length,accepted:quotes.filter(q=>q.status==='accepted').length};

  const total   = form.items.reduce((s,i)=>s+Number(i.amount||0),0);
  const advance = Math.round(total*form.advancePct/100);
  const client  = CLIENTS.find(c=>c.id===form.clientId);
  const projects= form.clientId?(PROJECTS_MAP[form.clientId]||[]):[];

  // ── Open create/edit form ────────────────────────────────────────
  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setView('form');
    setSelected(null);
  };

  const openEdit = (q) => {
    setEditId(q.id);
    setForm({
      clientId:    q.clientId,
      projectTitle:q.projectTitle,
      notes:       q.notes||'',
      terms:       q.terms||'',
      validUntil:  q.validUntil||'',
      advancePct:  q.advancePct||30,
      items:       q.breakdown.map(b=>({id:b.id||buid(),label:b.label,amount:String(b.amount)})),
    });
    setView('form');
    setSelected(null);
  };

  // ── Line item helpers ─────────────────────────────────────────────
  const addItem    = () => setForm(p=>({...p,items:[...p.items,{id:buid(),label:'',amount:''}]}));
  const removeItem = (id) => setForm(p=>({...p,items:p.items.filter(i=>i.id!==id)}));
  const setItem    = (id,key,val) => setForm(p=>({...p,items:p.items.map(i=>i.id===id?{...i,[key]:val}:i)}));

  // ── Save (create or update) ──────────────────────────────────────
  const handleSave = async (sendNow=false) => {
    if (!form.clientId||!form.projectTitle||form.items.every(i=>!i.label||!i.amount)) return;
    setSaving(true);
    const payload = {
      clientId:     form.clientId,
      clientName:   client?.name||'',
      clientCompany:client?.company||'',
      projectTitle: form.projectTitle,
      totalAmount:  total,
      advanceAmount:advance,
      advancePct:   form.advancePct,
      validUntil:   form.validUntil,
      notes:        form.notes,
      terms:        form.terms,
      status:       sendNow?'sent':'draft',
      breakdown:    form.items.filter(i=>i.label&&i.amount).map(i=>({id:i.id,label:i.label,amount:Number(i.amount)})),
      createdAt:    new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),
    };

    if (editId) {
      // Update existing
      setQuotes(p=>p.map(q=>q.id===editId?{...q,...payload}:q));
      if (isFirebaseConfigured&&!isDevSession) {
        try { await updateDoc(doc(db,'quotations',editId),{...payload,updatedAt:serverTimestamp()}); } catch(e){}
      }
    } else {
      // Create new
      const newQ = { id:`QT${Date.now()}`, ...payload };
      setQuotes(p=>[newQ,...p]);
      if (isFirebaseConfigured&&!isDevSession) {
        try { await addDoc(collection(db,'quotations'),{...payload,createdAt:serverTimestamp()}); } catch(e){}
      }
    }
    setSaving(false);
    setView('list');
    setEditId(null);
    setForm(EMPTY_FORM);
  };

  // ── Send ─────────────────────────────────────────────────────────
  const handleSend = async (quoteId) => {
    setQuotes(p=>p.map(q=>q.id===quoteId?{...q,status:'sent'}:q));
    if (isFirebaseConfigured&&!isDevSession) {
      try { await updateDoc(doc(db,'quotations',quoteId),{status:'sent',sentAt:serverTimestamp()}); } catch(e){}
    }
  };

  // ── Delete ───────────────────────────────────────────────────────
  const handleDelete = async (quoteId) => {
    setQuotes(p=>p.filter(q=>q.id!==quoteId));
    if (isFirebaseConfigured&&!isDevSession) {
      try { await deleteDoc(doc(db,'quotations',quoteId)); } catch(e){}
    }
    setDelConfirm(null);
    if (selected?.id===quoteId) setSelected(null);
  };

  // ── Duplicate ────────────────────────────────────────────────────
  const handleDuplicate = (q) => {
    const dup = { ...q, id:`QT${Date.now()}`, status:'draft', createdAt:'Today' };
    setQuotes(p=>[dup,...p]);
  };

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>

      {/* ── CREATE / EDIT FORM ── */}
      {view === 'form' && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:16,alignItems:'start'}}>

          {/* Left — form */}
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {/* Header */}
            <ERPPanel>
              <div style={{padding:'14px 18px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontSize:14,fontWeight:800,color:C.text}}>{editId?'Edit Quotation':'New Quotation'}</div>
                  <div style={{fontSize:11,color:C.muted,marginTop:1}}>Fill in the details and save as draft or send directly to client</div>
                </div>
                <ERPBtn variant="ghost" onClick={()=>{setView('list');setEditId(null);setForm(EMPTY_FORM);}}>✕ Cancel</ERPBtn>
              </div>
            </ERPPanel>

            {/* Client + Project */}
            <ERPPanel>
              <ERPPanelHeader title="Client & Project" icon="👤"/>
              <div style={{padding:'14px 18px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <ERPSelect label="Client" value={form.clientId}
                  onChange={e=>setForm(p=>({...p,clientId:e.target.value,projectTitle:''}))}
                  placeholder="Select client..." required
                  options={CLIENTS.map(c=>({value:c.id,label:`${c.name} — ${c.company}`}))} />
                <div>
                  <label style={{display:'block',fontSize:11,fontWeight:600,color:C.subtle,marginBottom:6}}>Project / Service <span style={{color:C.red}}>*</span></label>
                  {projects.length>0 ? (
                    <select value={form.projectTitle} onChange={e=>setForm(p=>({...p,projectTitle:e.target.value}))}
                      style={{width:'100%',background:'rgba(10,24,56,0.8)',border:`1px solid ${C.border}`,borderRadius:10,padding:'9px 14px',color:form.projectTitle?C.text:C.muted,fontSize:12,outline:'none',appearance:'none',cursor:'pointer'}}
                      onFocus={e=>e.target.style.borderColor='rgba(0,102,255,0.5)'}
                      onBlur={e=>e.target.style.borderColor=C.border}>
                      <option value="" style={{background:'#0A1838'}}>Select or type project...</option>
                      {projects.map(p=><option key={p.id} value={p.title} style={{background:'#0A1838'}}>{p.title}</option>)}
                    </select>
                  ) : (
                    <ERPInput value={form.projectTitle} onChange={e=>setForm(p=>({...p,projectTitle:e.target.value}))} placeholder="e.g. Website Development" />
                  )}
                </div>
              </div>
            </ERPPanel>

            {/* Line items */}
            <ERPPanel>
              <div style={{padding:'14px 18px 8px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                  <div style={{fontSize:13,fontWeight:700,color:C.text}}>Line Items</div>
                  <ERPBtn size="sm" variant="secondary" onClick={addItem}><Plus size={12}/> Add Item</ERPBtn>
                </div>

                {/* Table header */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 130px 32px',gap:8,padding:'6px 4px',marginBottom:4}}>
                  <span style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:'0.6px'}}>Description</span>
                  <span style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:'0.6px'}}>Amount (LKR)</span>
                  <span/>
                </div>

                {form.items.map((item,idx)=>(
                  <div key={item.id} style={{display:'grid',gridTemplateColumns:'1fr 130px 32px',gap:8,marginBottom:8,alignItems:'center'}}>
                    <input value={item.label} onChange={e=>setItem(item.id,'label',e.target.value)}
                      placeholder={`Item ${idx+1} — e.g. UI/UX Design`}
                      style={{background:'rgba(10,24,56,0.8)',border:`1px solid ${C.border}`,borderRadius:10,padding:'8px 12px',color:C.text,fontSize:12,outline:'none'}}
                      onFocus={e=>e.target.style.borderColor='rgba(0,102,255,0.5)'}
                      onBlur={e=>e.target.style.borderColor=C.border}/>
                    <input value={item.amount} onChange={e=>setItem(item.id,'amount',e.target.value)}
                      type="number" placeholder="0"
                      style={{background:'rgba(10,24,56,0.8)',border:`1px solid ${C.border}`,borderRadius:10,padding:'8px 12px',color:C.text,fontSize:12,outline:'none',textAlign:'right'}}
                      onFocus={e=>e.target.style.borderColor='rgba(0,102,255,0.5)'}
                      onBlur={e=>e.target.style.borderColor=C.border}/>
                    <button onClick={()=>removeItem(item.id)} disabled={form.items.length===1}
                      style={{background:'none',border:'none',cursor:form.items.length===1?'default':'pointer',color:form.items.length===1?C.border:C.red,display:'flex',justifyContent:'center'}}>
                      <Trash2 size={14}/>
                    </button>
                  </div>
                ))}

                {/* Total row */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 130px 32px',gap:8,padding:'10px 4px 4px',borderTop:`1px solid ${C.border}`}}>
                  <span style={{fontSize:12,fontWeight:700,color:C.muted,textAlign:'right',paddingRight:8}}>Total</span>
                  <span style={{fontSize:15,fontWeight:900,color:C.text,textAlign:'right',paddingRight:12}}>
                    LKR {total.toLocaleString()}
                  </span>
                  <span/>
                </div>
              </div>
            </ERPPanel>

            {/* Advance + validity */}
            <ERPPanel>
              <ERPPanelHeader title="Payment Terms" icon="💰"/>
              <div style={{padding:'14px 18px',display:'flex',flexDirection:'column',gap:14}}>
                {/* Advance slider */}
                <div>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                    <label style={{fontSize:11,fontWeight:600,color:C.subtle}}>Advance Payment</label>
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>
                      <input type="number" min={0} max={100} value={form.advancePct}
                        onChange={e=>setForm(p=>({...p,advancePct:Math.min(100,Math.max(0,Number(e.target.value)))}))}
                        style={{width:50,background:'rgba(10,24,56,0.8)',border:`1px solid ${C.border}`,borderRadius:7,padding:'4px 8px',color:C.text,fontSize:12,outline:'none',textAlign:'center'}}/>
                      <span style={{fontSize:12,color:C.muted}}>%</span>
                      <span style={{fontSize:13,fontWeight:800,color:C.green}}>= LKR {advance.toLocaleString()}</span>
                    </div>
                  </div>
                  <input type="range" min={0} max={100} value={form.advancePct}
                    onChange={e=>setForm(p=>({...p,advancePct:Number(e.target.value)}))}
                    style={{width:'100%',accentColor:C.blue}}/>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:C.muted,marginTop:2}}>
                    <span>0%</span><span>50%</span><span>100%</span>
                  </div>
                </div>

                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  <ERPInput label="Valid Until" value={form.validUntil} type="date"
                    onChange={e=>setForm(p=>({...p,validUntil:e.target.value}))} />
                  <ERPInput label="Payment Terms" value={form.terms}
                    onChange={e=>setForm(p=>({...p,terms:e.target.value}))}
                    placeholder="e.g. 30% advance, rest on delivery" />
                </div>
              </div>
            </ERPPanel>

            {/* Notes */}
            <ERPPanel>
              <ERPPanelHeader title="Notes" icon="📝"/>
              <div style={{padding:'14px 18px'}}>
                <ERPTextarea value={form.notes} rows={3}
                  onChange={e=>setForm(p=>({...p,notes:e.target.value}))}
                  placeholder="e.g. Includes 3 months free support after launch..." />
              </div>
            </ERPPanel>

            {/* Action buttons */}
            <div style={{display:'flex',gap:10}}>
              <ERPBtn variant="secondary" onClick={()=>{setView('list');setEditId(null);setForm(EMPTY_FORM);}} style={{flex:1,justifyContent:'center'}}>Cancel</ERPBtn>
              <ERPBtn variant="ghost" onClick={()=>handleSave(false)} disabled={saving||!form.clientId||!form.projectTitle} style={{flex:1,justifyContent:'center'}}>
                💾 Save Draft
              </ERPBtn>
              <ERPBtn variant="primary" onClick={()=>handleSave(true)} disabled={saving||!form.clientId||!form.projectTitle||total===0} style={{flex:1,justifyContent:'center'}}>
                {saving?'Saving...':<><Send size={13}/> Save & Send</>}
              </ERPBtn>
            </div>
          </div>

          {/* Right — live preview */}
          <ERPPanel style={{position:'sticky',top:0}}>
            <ERPPanelHeader title="Preview" icon="👁️"/>
            <div style={{padding:18,display:'flex',flexDirection:'column',gap:12}}>
              {form.clientId&&(
                <div style={{display:'flex',gap:10,alignItems:'center'}}>
                  <ERPAvatar name={client?.name||'?'} color={C.blue} size={32}/>
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:C.text}}>{client?.name}</div>
                    <div style={{fontSize:10,color:C.muted}}>{client?.company}</div>
                  </div>
                </div>
              )}
              {form.projectTitle&&<div style={{fontSize:11,color:C.cyan,fontWeight:600}}>{form.projectTitle}</div>}

              {/* Breakdown preview */}
              {form.items.filter(i=>i.label&&i.amount).map((item,i)=>(
                <div key={item.id} style={{display:'flex',justifyContent:'space-between',fontSize:11,padding:'5px 0',borderBottom:`1px solid ${C.border}15`}}>
                  <span style={{color:C.muted}}>{item.label}</span>
                  <span style={{color:C.subtle,fontWeight:600}}>LKR {Number(item.amount||0).toLocaleString()}</span>
                </div>
              ))}

              {total>0&&(
                <>
                  <div style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderTop:`1px solid ${C.border}`}}>
                    <span style={{fontSize:13,fontWeight:800,color:C.text}}>Total</span>
                    <span style={{fontSize:18,fontWeight:900,color:C.text}}>LKR {total.toLocaleString()}</span>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',padding:'8px 12px',borderRadius:8,background:'rgba(24,199,122,0.08)',border:'1px solid rgba(24,199,122,0.2)'}}>
                    <span style={{fontSize:11,color:C.muted}}>Advance ({form.advancePct}%)</span>
                    <span style={{fontSize:13,fontWeight:800,color:C.green}}>LKR {advance.toLocaleString()}</span>
                  </div>
                </>
              )}

              {form.validUntil&&(
                <div style={{fontSize:10,color:C.muted}}>⏰ Valid until: {new Date(form.validUntil).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>
              )}
              {form.notes&&(
                <div style={{fontSize:11,color:C.muted,background:'rgba(10,24,56,0.5)',borderRadius:8,padding:'8px 10px',lineHeight:1.5}}>📋 {form.notes}</div>
              )}
            </div>
          </ERPPanel>
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {view === 'list' && (
        <>
          {/* Filter + Create */}
          <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
            {['All','draft','sent','accepted'].map(f=>(
              <button key={f} onClick={()=>setFilter(f)} style={{
                padding:'7px 16px',borderRadius:10,fontSize:12,fontWeight:700,cursor:'pointer',transition:'all 0.15s',
                background:filter===f?'linear-gradient(135deg,#0066FF,#1787FF)':'rgba(10,24,56,0.8)',
                color:filter===f?'#fff':C.muted,border:filter===f?'none':`1px solid ${C.border}`,
                boxShadow:filter===f?'0 4px 14px rgba(0,102,255,0.35)':'none',
              }}>{f.charAt(0).toUpperCase()+f.slice(1)} {counts[f]>0&&<span style={{opacity:0.7,marginLeft:4}}>({counts[f]})</span>}</button>
            ))}
            <ERPBtn variant="primary" onClick={openCreate} style={{marginLeft:'auto'}}>
              <Plus size={13}/> New Quotation
            </ERPBtn>
          </div>

          {/* Cards */}
          {filtered.length===0 ? (
            <ERPEmpty icon="💰" title="No quotations" sub="Create your first quotation above." />
          ) : (
            <div style={{display:'grid',gridTemplateColumns:selected?'1fr 380px':'repeat(auto-fill,minmax(320px,1fr))',gap:14}}>

              {/* Card list */}
              {filtered.map((q,i)=>(
                <div key={q.id}
                  onClick={()=>setSelected(selected?.id===q.id?null:q)}
                  style={{
                    background:C.surface,border:`1px solid ${selected?.id===q.id?C.borderHi:C.border}`,borderRadius:16,
                    padding:18,cursor:'pointer',transition:'all 0.2s',backdropFilter:'blur(12px)',
                    position:'relative',overflow:'hidden',
                  }}
                  onMouseEnter={e=>{if(selected?.id!==q.id){e.currentTarget.style.borderColor=C.borderHi;e.currentTarget.style.transform='translateY(-2px)';}}}
                  onMouseLeave={e=>{if(selected?.id!==q.id){e.currentTarget.style.borderColor=C.border;e.currentTarget.style.transform='translateY(0)';}}}
                >
                  <div style={{position:'absolute',top:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${COLORS[i%COLORS.length]}60,transparent)`}}/>

                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                    <div style={{display:'flex',gap:8,alignItems:'center',flex:1,minWidth:0}}>
                      <ERPAvatar name={q.clientName} color={COLORS[i%COLORS.length]} size={28}/>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:800,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{q.clientName}</div>
                        <div style={{fontSize:10,color:C.muted,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{q.projectTitle}</div>
                      </div>
                    </div>
                    <ERPBadge status={q.status==='accepted'?'Completed':q.status==='sent'?'quotation_sent':'draft'} label={q.status.charAt(0).toUpperCase()+q.status.slice(1)} />
                  </div>

                  <div style={{display:'flex',justifyContent:'space-between',padding:'10px 12px',borderRadius:10,background:'rgba(10,24,56,0.5)',border:`1px solid ${C.border}25`,marginBottom:10}}>
                    <div>
                      <div style={{fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:'0.5px'}}>Total</div>
                      <div style={{fontSize:18,fontWeight:900,color:C.text}}>LKR {q.totalAmount.toLocaleString()}</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:'0.5px'}}>Advance</div>
                      <div style={{fontSize:13,fontWeight:700,color:C.green}}>LKR {q.advanceAmount.toLocaleString()}</div>
                    </div>
                  </div>

                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{fontSize:10,color:C.muted}}>#{q.id} · {q.createdAt}</span>
                    <div style={{display:'flex',gap:6}} onClick={e=>e.stopPropagation()}>
                      <button onClick={()=>openEdit(q)} title="Edit" style={{background:'none',border:'none',cursor:'pointer',color:C.muted,padding:4}} onMouseEnter={e=>e.currentTarget.style.color=C.cyan} onMouseLeave={e=>e.currentTarget.style.color=C.muted}>
                        <Edit2 size={13}/>
                      </button>
                      <button onClick={()=>handleDuplicate(q)} title="Duplicate" style={{background:'none',border:'none',cursor:'pointer',color:C.muted,padding:4}} onMouseEnter={e=>e.currentTarget.style.color=C.blue} onMouseLeave={e=>e.currentTarget.style.color=C.muted}>
                        <Copy size={13}/>
                      </button>
                      <button onClick={()=>setDelConfirm(q.id)} title="Delete" style={{background:'none',border:'none',cursor:'pointer',color:C.muted,padding:4}} onMouseEnter={e=>e.currentTarget.style.color=C.red} onMouseLeave={e=>e.currentTarget.style.color=C.muted}>
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Detail panel */}
              {selected && (
                <ERPPanel style={{alignSelf:'flex-start',position:'sticky',top:0}}>
                  <ERPPanelHeader title="Quotation Detail" icon="💰"
                    action={<span style={{cursor:'pointer'}} onClick={()=>setSelected(null)}>✕</span>}/>
                  <div style={{padding:18,display:'flex',flexDirection:'column',gap:14}}>

                    {/* Client */}
                    <div style={{display:'flex',gap:12,alignItems:'center'}}>
                      <ERPAvatar name={selected.clientName} color={C.blue} size={40}/>
                      <div>
                        <div style={{fontSize:14,fontWeight:800,color:C.text}}>{selected.clientName}</div>
                        <div style={{fontSize:11,color:C.muted}}>{selected.clientCompany}</div>
                        <div style={{fontSize:11,color:C.cyan}}>{selected.projectTitle}</div>
                      </div>
                    </div>

                    <ERPBadge status={selected.status==='accepted'?'Completed':selected.status==='sent'?'quotation_sent':'draft'} label={selected.status.charAt(0).toUpperCase()+selected.status.slice(1)} size="md"/>

                    {/* Amount box */}
                    <div style={{padding:'14px',borderRadius:12,background:'rgba(0,102,255,0.08)',border:`1px solid ${C.borderHi}`}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                        <span style={{fontSize:11,color:C.muted}}>Total Amount</span>
                        <span style={{fontSize:22,fontWeight:900,color:C.text}}>LKR {selected.totalAmount.toLocaleString()}</span>
                      </div>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{fontSize:11,color:C.muted}}>Advance ({selected.advancePct}%)</span>
                        <span style={{fontSize:14,fontWeight:800,color:C.green}}>LKR {selected.advanceAmount.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Breakdown */}
                    <div>
                      <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:8}}>Breakdown</div>
                      {selected.breakdown.map((b,i)=>(
                        <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'6px 0',borderBottom:`1px solid ${C.border}15`}}>
                          <span style={{color:C.muted}}>{b.label}</span>
                          <span style={{fontWeight:600,color:C.text}}>LKR {Number(b.amount).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>

                    {selected.validUntil&&<div style={{fontSize:11,color:C.muted}}>⏰ Valid: {new Date(selected.validUntil).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</div>}
                    {selected.terms&&<div style={{fontSize:11,color:C.muted,background:'rgba(10,24,56,0.5)',padding:'8px 10px',borderRadius:8}}>📋 {selected.terms}</div>}
                    {selected.notes&&<div style={{fontSize:11,color:C.muted,background:'rgba(10,24,56,0.5)',padding:'8px 10px',borderRadius:8}}>📝 {selected.notes}</div>}

                    {/* Actions */}
                    <div style={{display:'flex',flexDirection:'column',gap:8,paddingTop:4}}>
                      <ERPBtn variant="secondary" onClick={()=>openEdit(selected)} style={{justifyContent:'center'}}>
                        <Edit2 size={13}/> Edit Quotation
                      </ERPBtn>
                      {selected.status==='draft'&&(
                        <ERPBtn variant="primary" onClick={()=>handleSend(selected.id)} style={{justifyContent:'center'}}>
                          <Send size={13}/> Send to Client
                        </ERPBtn>
                      )}
                      {selected.status==='sent'&&(
                        <div style={{fontSize:11,color:C.amber,textAlign:'center',padding:'6px',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                          <span style={{width:6,height:6,borderRadius:'50%',background:C.amber,display:'inline-block'}}/>
                          Awaiting client acceptance
                        </div>
                      )}
                      {selected.status==='accepted'&&(
                        <div style={{fontSize:11,color:C.green,textAlign:'center',padding:'6px',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                          <CheckCircle2 size={13}/> Accepted by client
                        </div>
                      )}
                      <ERPBtn variant="danger" onClick={()=>setDelConfirm(selected.id)} style={{justifyContent:'center'}}>
                        <Trash2 size={13}/> Delete
                      </ERPBtn>
                    </div>
                  </div>
                </ERPPanel>
              )}
            </div>
          )}
        </>
      )}

      {/* Delete confirm modal */}
      <ERPModal isOpen={!!delConfirm} onClose={()=>setDelConfirm(null)} title="Delete Quotation?" width={360}>
        <div style={{display:'flex',flexDirection:'column',gap:14,alignItems:'center',textAlign:'center'}}>
          <div style={{fontSize:36}}>🗑️</div>
          <div style={{fontSize:12,color:C.muted}}>This will permanently delete the quotation. This cannot be undone.</div>
          <div style={{display:'flex',gap:10,width:'100%'}}>
            <ERPBtn variant="secondary" onClick={()=>setDelConfirm(null)} style={{flex:1,justifyContent:'center'}}>Cancel</ERPBtn>
            <ERPBtn variant="danger" onClick={()=>handleDelete(delConfirm)} style={{flex:1,justifyContent:'center'}}>
              <Trash2 size={13}/> Delete
            </ERPBtn>
          </div>
        </div>
      </ERPModal>
    </div>
  );
}
