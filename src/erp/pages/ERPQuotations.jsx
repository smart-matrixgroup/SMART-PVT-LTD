import React, { useState, useEffect } from 'react';
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, doc, serverTimestamp
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  ERPPanel, ERPPanelHeader, ERPBadge, ERPBtn,
  ERPModal, ERPInput, ERPSelect, ERPEmpty, ERPAvatar,
  ERPTextarea, C
} from '../components/ERPui';
import { Plus, Send, Trash2, CheckCircle2 } from 'lucide-react';

const CLIENTS = [
  { id:'C001', name:'John Perera',    company:'Perera Holdings' },
  { id:'C002', name:'Sarah Fernando', company:'Mehala Restaurant' },
  { id:'C003', name:'Kumar Arasan',   company:'KA Retail' },
  { id:'C004', name:'Priya Nair',     company:'PN Accounting' },
  { id:'C005', name:'Dilan Perera',   company:'DP Constructions' },
];

const PROJECTS = {
  C001: [{id:'P001',title:'Corporate Website Redesign'},{id:'P002',title:'SMARTORIX ERP Setup'}],
  C002: [{id:'P003',title:'Restaurant POS System'}],
  C003: [{id:'P004',title:'Mobile App Development'}],
  C004: [{id:'P005',title:'Annual Tax Filing 2024'},{id:'P006',title:'Monthly Bookkeeping'}],
  C005: [],
};

const DEV_QUOTES = [
  {
    id:'QT001', clientId:'C001', clientName:'John Perera', projectTitle:'Corporate Website Redesign',
    totalAmount:'LKR 85,000', advanceAmount:'LKR 30,000', validUntil:'Nov 15, 2026',
    status:'accepted', createdAt:'Oct 1, 2026',
    breakdown:[
      {label:'Design & UI/UX',   amount:25000},
      {label:'Development',      amount:45000},
      {label:'SEO & Deployment', amount:15000},
    ],
    notes:'Includes 3 months free support after launch.',
  },
  {
    id:'QT002', clientId:'C002', clientName:'Sarah Fernando', projectTitle:'Restaurant POS System',
    totalAmount:'LKR 120,000', advanceAmount:'LKR 50,000', validUntil:'Nov 30, 2026',
    status:'sent', createdAt:'Oct 3, 2026',
    breakdown:[
      {label:'POS Module',          amount:50000},
      {label:'Table Management',    amount:30000},
      {label:'Inventory & Reports', amount:25000},
      {label:'Training & Setup',    amount:15000},
    ],
    notes:'Includes 6 months warranty support.',
  },
  {
    id:'QT003', clientId:'C003', clientName:'Kumar Arasan', projectTitle:'Mobile App Development',
    totalAmount:'LKR 150,000', advanceAmount:'LKR 50,000', validUntil:'Dec 15, 2026',
    status:'draft', createdAt:'Oct 5, 2026',
    breakdown:[
      {label:'Architecture & Design',    amount:40000},
      {label:'Android & iOS Development',amount:90000},
      {label:'Testing & Deployment',     amount:20000},
    ],
    notes:'',
  },
];

const COLORS = ['#0066FF','#8B5CF6','#18C77A','#F5B942'];

export default function ERPQuotations() {
  const { isDevSession } = useAuth();
  const [quotes,     setQuotes]     = useState(DEV_QUOTES);
  const [filter,     setFilter]     = useState('All');
  const [showCreate, setShowCreate] = useState(false);
  const [selected,   setSelected]   = useState(null);
  const [sending,    setSending]    = useState(false);

  // Create form
  const [form, setForm] = useState({
    clientId:'', projectTitle:'', notes:'', validUntil:'', advancePct:30,
    items:[{ label:'', amount:'' }],
  });

  useEffect(() => {
    if (!isFirebaseConfigured || isDevSession) return;
    const q = query(collection(db,'quotations'), orderBy('createdAt','desc'));
    return onSnapshot(q, snap => setQuotes(snap.docs.map(d=>({id:d.id,...d.data()}))));
  }, [isDevSession]);

  const filtered = filter==='All' ? quotes : quotes.filter(q=>q.status===filter);
  const counts = {All:quotes.length, draft:quotes.filter(q=>q.status==='draft').length, sent:quotes.filter(q=>q.status==='sent').length, accepted:quotes.filter(q=>q.status==='accepted').length};

  const total    = form.items.reduce((s,i)=>s+Number(i.amount||0),0);
  const advance  = Math.round(total * form.advancePct / 100);
  const client   = CLIENTS.find(c=>c.id===form.clientId);
  const projects = form.clientId ? (PROJECTS[form.clientId]||[]) : [];

  const addItem    = () => setForm(p=>({...p,items:[...p.items,{label:'',amount:''}]}));
  const removeItem = (i) => setForm(p=>({...p,items:p.items.filter((_,idx)=>idx!==i)}));
  const setItem    = (i,field,val) => setForm(p=>({...p,items:p.items.map((it,idx)=>idx===i?{...it,[field]:val}:it)}));

  const handleSaveDraft = () => {
    if (!form.clientId || !form.projectTitle) return;
    const q = {
      id:`QT${Date.now()}`, clientId:form.clientId, clientName:client?.name||'',
      projectTitle:form.projectTitle, notes:form.notes, validUntil:form.validUntil,
      totalAmount:`LKR ${total.toLocaleString()}`, advanceAmount:`LKR ${advance.toLocaleString()}`,
      status:'draft', createdAt:new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),
      breakdown:form.items.filter(i=>i.label&&i.amount).map(i=>({label:i.label,amount:Number(i.amount)})),
    };
    setQuotes(p=>[q,...p]);
    setShowCreate(false);
    resetForm();
  };

  const handleSend = async (quoteId) => {
    setSending(true);
    setQuotes(p=>p.map(q=>q.id===quoteId?{...q,status:'sent'}:q));
    if (isFirebaseConfigured && !isDevSession) {
      try { await updateDoc(doc(db,'quotations',quoteId),{status:'sent',sentAt:serverTimestamp()}); } catch(e){}
    }
    setSending(false);
  };

  const resetForm = () => setForm({clientId:'',projectTitle:'',notes:'',validUntil:'',advancePct:30,items:[{label:'',amount:''}]});

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>

      {/* Top bar */}
      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
        {['All','draft','sent','accepted'].map(f=>{
          const lbl = {All:'All',draft:'Draft',sent:'Sent',accepted:'Accepted'}[f];
          return (
            <button key={f} onClick={()=>setFilter(f)} style={{
              padding:'7px 16px',borderRadius:10,fontSize:12,fontWeight:700,cursor:'pointer',
              background:filter===f?'linear-gradient(135deg,#0066FF,#1787FF)':'rgba(10,24,56,0.8)',
              color:filter===f?'#fff':C.muted,border:filter===f?'none':`1px solid ${C.border}`,
              boxShadow:filter===f?'0 4px 14px rgba(0,102,255,0.35)':'none',transition:'all 0.15s',
            }}>{lbl} {counts[f]>0&&<span style={{opacity:0.7,marginLeft:4}}>({counts[f]})</span>}</button>
          );
        })}
        <ERPBtn variant="primary" onClick={()=>setShowCreate(true)} style={{marginLeft:'auto'}}>
          <Plus size={13}/> Create Quotation
        </ERPBtn>
      </div>

      {/* Quote cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))',gap:14}}>
        {filtered.length===0 ? (
          <div style={{gridColumn:'1/-1'}}>
            <ERPEmpty icon="💰" title="No quotations" sub="Create a new quotation for a client." />
          </div>
        ) : filtered.map((q,i)=>(
          <div key={q.id}
            style={{
              background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,
              padding:18,backdropFilter:'blur(12px)',position:'relative',overflow:'hidden',
              transition:'all 0.2s',cursor:'pointer',
            }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=C.borderHi;e.currentTarget.style.transform='translateY(-3px)';e.currentTarget.style.boxShadow='0 12px 30px rgba(0,0,0,0.3)';}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none';}}
            onClick={()=>setSelected(selected?.id===q.id?null:q)}>
            <div style={{position:'absolute',top:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${COLORS[i%COLORS.length]}60,transparent)`}} />

            {/* Header */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <ERPAvatar name={q.clientName} color={COLORS[i%COLORS.length]} size={28}/>
                  <span style={{fontSize:13,fontWeight:800,color:C.text}}>{q.clientName}</span>
                </div>
                <div style={{fontSize:11,color:C.muted,marginTop:3,paddingLeft:36}}>{q.projectTitle}</div>
              </div>
              <ERPBadge status={q.status==='accepted'?'Completed':q.status==='sent'?'quotation_sent':'draft'} label={q.status.charAt(0).toUpperCase()+q.status.slice(1)} />
            </div>

            {/* Amount */}
            <div style={{display:'flex',justifyContent:'space-between',padding:'12px 14px',borderRadius:10,background:'rgba(10,24,56,0.6)',border:`1px solid ${C.border}30`,marginBottom:12}}>
              <div>
                <div style={{fontSize:10,color:C.muted}}>Total</div>
                <div style={{fontSize:20,fontWeight:900,color:C.text}}>{q.totalAmount}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:10,color:C.muted}}>Advance</div>
                <div style={{fontSize:14,fontWeight:700,color:C.green}}>{q.advanceAmount}</div>
              </div>
            </div>

            {/* Breakdown preview */}
            <div style={{marginBottom:12}}>
              {q.breakdown.slice(0,2).map((b,j)=>(
                <div key={j} style={{display:'flex',justifyContent:'space-between',fontSize:11,color:C.muted,padding:'3px 0',borderBottom:`1px solid ${C.border}15`}}>
                  <span>{b.label}</span>
                  <span style={{color:C.subtle}}>LKR {Number(b.amount).toLocaleString()}</span>
                </div>
              ))}
              {q.breakdown.length>2 && <div style={{fontSize:10,color:C.muted,marginTop:3}}>+{q.breakdown.length-2} more items</div>}
            </div>

            {/* Footer */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingTop:8,borderTop:`1px solid ${C.border}25`}}>
              <span style={{fontSize:10,color:C.muted}}>#{q.id} · {q.createdAt}</span>
              <div style={{display:'flex',gap:6}} onClick={e=>e.stopPropagation()}>
                {q.status==='draft' && (
                  <ERPBtn size="sm" variant="primary" onClick={()=>handleSend(q.id)} disabled={sending}>
                    <Send size={11}/> Send to Client
                  </ERPBtn>
                )}
                {q.status==='sent' && (
                  <span style={{fontSize:10,color:C.amber,display:'flex',alignItems:'center',gap:4}}>
                    <span style={{width:6,height:6,borderRadius:'50%',background:C.amber,display:'inline-block'}}/>
                    Awaiting acceptance
                  </span>
                )}
                {q.status==='accepted' && (
                  <span style={{fontSize:10,color:C.green,display:'flex',alignItems:'center',gap:4}}>
                    <CheckCircle2 size={12}/> Accepted by client
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── CREATE QUOTATION MODAL ── */}
      <ERPModal isOpen={showCreate} onClose={()=>{setShowCreate(false);resetForm();}} title="Create New Quotation" width={600}>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>

          {/* Client + Project */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <ERPSelect label="Client" value={form.clientId}
              onChange={e=>setForm(p=>({...p,clientId:e.target.value,projectTitle:''}))}
              placeholder="Select client..." required
              options={CLIENTS.map(c=>({value:c.id,label:c.name}))} />
            <div>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:C.subtle,marginBottom:6}}>Project / Service <span style={{color:C.red}}>*</span></label>
              {projects.length>0 ? (
                <ERPSelect value={form.projectTitle} onChange={e=>setForm(p=>({...p,projectTitle:e.target.value}))}
                  placeholder="Select project..." options={projects.map(p=>({value:p.title,label:p.title}))} />
              ) : (
                <ERPInput value={form.projectTitle} onChange={e=>setForm(p=>({...p,projectTitle:e.target.value}))}
                  placeholder="e.g. Website Development" />
              )}
            </div>
          </div>

          {/* Line items */}
          <div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
              <label style={{fontSize:11,fontWeight:600,color:C.subtle}}>Line Items</label>
              <ERPBtn size="sm" variant="ghost" onClick={addItem}><Plus size={12}/> Add Item</ERPBtn>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {form.items.map((item,i)=>(
                <div key={i} style={{display:'flex',gap:8,alignItems:'center'}}>
                  <input value={item.label} onChange={e=>setItem(i,'label',e.target.value)}
                    placeholder="Description (e.g. UI/UX Design)"
                    style={{flex:2,background:'rgba(10,24,56,0.8)',border:`1px solid ${C.border}`,borderRadius:10,padding:'8px 12px',color:C.text,fontSize:12,outline:'none'}}
                    onFocus={e=>e.target.style.borderColor='rgba(0,102,255,0.5)'}
                    onBlur={e=>e.target.style.borderColor=C.border} />
                  <input value={item.amount} onChange={e=>setItem(i,'amount',e.target.value)}
                    placeholder="Amount (LKR)" type="number"
                    style={{flex:1,background:'rgba(10,24,56,0.8)',border:`1px solid ${C.border}`,borderRadius:10,padding:'8px 12px',color:C.text,fontSize:12,outline:'none'}}
                    onFocus={e=>e.target.style.borderColor='rgba(0,102,255,0.5)'}
                    onBlur={e=>e.target.style.borderColor=C.border} />
                  {form.items.length>1 && (
                    <button onClick={()=>removeItem(i)} style={{background:'none',border:'none',color:C.red,cursor:'pointer',padding:4}}>
                      <Trash2 size={14}/>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Total + advance */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div style={{padding:'12px 16px',borderRadius:12,background:'rgba(0,102,255,0.08)',border:`1px solid ${C.borderHi}`,textAlign:'center'}}>
              <div style={{fontSize:11,color:C.muted}}>Total Amount</div>
              <div style={{fontSize:22,fontWeight:900,color:C.text}}>LKR {total.toLocaleString()}</div>
            </div>
            <div>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:C.subtle,marginBottom:6}}>
                Advance % — {form.advancePct}% = LKR {advance.toLocaleString()}
              </label>
              <input type="range" min={0} max={100} value={form.advancePct}
                onChange={e=>setForm(p=>({...p,advancePct:Number(e.target.value)}))}
                style={{width:'100%',accentColor:C.blue}} />
            </div>
          </div>

          {/* Valid until + notes */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <ERPInput label="Valid Until" value={form.validUntil} type="date"
              onChange={e=>setForm(p=>({...p,validUntil:e.target.value}))} />
            <ERPTextarea label="Notes (optional)" value={form.notes} rows={2}
              onChange={e=>setForm(p=>({...p,notes:e.target.value}))}
              placeholder="e.g. Includes 3 months free support..." />
          </div>

          {/* Actions */}
          <div style={{display:'flex',gap:10}}>
            <ERPBtn variant="secondary" onClick={()=>{setShowCreate(false);resetForm();}} style={{flex:1,justifyContent:'center'}}>Cancel</ERPBtn>
            <ERPBtn variant="ghost" onClick={handleSaveDraft} style={{flex:1,justifyContent:'center'}}>Save as Draft</ERPBtn>
            <ERPBtn variant="primary" disabled={!form.clientId||!form.projectTitle||total===0}
              onClick={()=>{handleSaveDraft(); setTimeout(()=>{
                const newest = quotes[0];
                if(newest) handleSend(newest.id);
              },100);}}
              style={{flex:1,justifyContent:'center'}}>
              <Send size={13}/> Create & Send
            </ERPBtn>
          </div>
        </div>
      </ERPModal>
    </div>
  );
}
