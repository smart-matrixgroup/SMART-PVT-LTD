import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { ERPPanel, ERPPanelHeader, ERPBadge, ERPBtn, ERPModal, ERPInput, ERPSelect, ERPEmpty, ERPAvatar, C } from '../components/ERPui';
import { Plus, CheckCircle2, Send, FileText } from 'lucide-react';

const CLIENTS = [
  {id:'C001',name:'John Perera',   company:'Perera Holdings'},
  {id:'C002',name:'Sarah Fernando',company:'Mehala Restaurant'},
  {id:'C003',name:'Kumar Arasan',  company:'KA Retail'},
  {id:'C004',name:'Priya Nair',    company:'PN Accounting'},
  {id:'C005',name:'Dilan Perera',  company:'DP Constructions'},
];

const DEV_INVOICES = [
  {id:'INV-2026-001',clientId:'C001',clientName:'John Perera',  description:'Project Initiation Deposit — Corporate Website',milestone:'Advance Payment',   amount:'LKR 30,000', status:'paid',    issuedAt:'Oct 1, 2026', paidAt:'Oct 2, 2026'},
  {id:'INV-2026-002',clientId:'C002',clientName:'Sarah Fernando',description:'POS Development Milestone 1',                   milestone:'Development Start', amount:'LKR 50,000', status:'pending', issuedAt:'Oct 3, 2026', paidAt:null},
  {id:'INV-2026-003',clientId:'C001',clientName:'John Perera',  description:'UI/UX Design Milestone — Corporate Website',    milestone:'Design Complete',   amount:'LKR 25,000', status:'paid',    issuedAt:'Sep 20, 2026',paidAt:'Sep 21, 2026'},
  {id:'INV-2026-004',clientId:'C003',clientName:'Kumar Arasan', description:'Mobile App Architecture & Design Deposit',      milestone:'Advance Payment',   amount:'LKR 50,000', status:'pending', issuedAt:'Oct 5, 2026', paidAt:null},
  {id:'INV-2026-005',clientId:'C004',clientName:'Priya Nair',   description:'Annual Tax Filing — IRD Submission Complete',   milestone:'Completed',         amount:'LKR 35,000', status:'paid',    issuedAt:'Sep 15, 2026',paidAt:'Sep 16, 2026'},
];

const COLORS = ['#0066FF','#8B5CF6','#18C77A','#F5B942','#F05A67'];
const MILESTONES = ['Advance Payment','Discovery & Blueprint','Design Complete','Development Milestone','QA & Testing','Final Delivery','Monthly Retainer','Other'];

export default function ERPInvoices() {
  const { isDevSession } = useAuth();
  const [invoices,   setInvoices]   = useState(DEV_INVOICES);
  const [filter,     setFilter]     = useState('All');
  const [showCreate, setShowCreate] = useState(false);
  const [markPaidId, setMarkPaidId] = useState(null);

  const [form, setForm] = useState({clientId:'',description:'',milestone:'',amount:'',issuedAt:''});

  useEffect(()=>{
    if (!isFirebaseConfigured||isDevSession) return;
    const q = query(collection(db,'invoices'),orderBy('createdAt','desc'));
    return onSnapshot(q,snap=>setInvoices(snap.docs.map(d=>({id:d.id,...d.data()}))));
  },[isDevSession]);

  const filtered = filter==='All'?invoices:invoices.filter(i=>i.status===filter);
  const totalPaid    = invoices.filter(i=>i.status==='paid').reduce((s,i)=>s+Number(i.amount?.replace(/[^0-9]/g,'')||0),0);
  const totalPending = invoices.filter(i=>i.status==='pending').reduce((s,i)=>s+Number(i.amount?.replace(/[^0-9]/g,'')||0),0);

  const handleCreate = async () => {
    if (!form.clientId||!form.description||!form.amount) return;
    const client = CLIENTS.find(c=>c.id===form.clientId);
    const newInv = {
      id:`INV-2026-${String(invoices.length+1).padStart(3,'0')}`,
      clientId:form.clientId, clientName:client?.name||'',
      description:form.description, milestone:form.milestone,
      amount:`LKR ${Number(form.amount).toLocaleString()}`,
      status:'pending',
      issuedAt:form.issuedAt||new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),
      paidAt:null,
    };
    if (isFirebaseConfigured&&!isDevSession) {
      try { await addDoc(collection(db,'invoices'),{...newInv,createdAt:serverTimestamp()}); } catch(e){}
    }
    setInvoices(p=>[newInv,...p]);
    setShowCreate(false);
    setForm({clientId:'',description:'',milestone:'',amount:'',issuedAt:''});
  };

  const handleMarkPaid = async (invId) => {
    const today = new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
    setInvoices(p=>p.map(i=>i.id===invId?{...i,status:'paid',paidAt:today}:i));
    if (isFirebaseConfigured&&!isDevSession) {
      try { await updateDoc(doc(db,'invoices',invId),{status:'paid',paidAt:serverTimestamp()}); } catch(e){}
    }
    setMarkPaidId(null);
  };

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>

      {/* Summary cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
        {[
          {label:'Total Paid',     val:`LKR ${totalPaid.toLocaleString()}`,    color:C.green,  icon:'✅'},
          {label:'Total Pending',  val:`LKR ${totalPending.toLocaleString()}`, color:C.amber,  icon:'⏳'},
          {label:'Total Invoices', val:invoices.length,                        color:C.cyan,   icon:'🧾'},
        ].map(s=>(
          <div key={s.label} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:'14px 18px',backdropFilter:'blur(12px)'}}>
            <div style={{fontSize:20,marginBottom:6}}>{s.icon}</div>
            <div style={{fontSize:18,fontWeight:900,color:s.color}}>{s.val}</div>
            <div style={{fontSize:11,color:C.muted,marginTop:2}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter + Create */}
      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
        {['All','pending','paid'].map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{
            padding:'7px 16px',borderRadius:10,fontSize:12,fontWeight:700,cursor:'pointer',
            background:filter===f?'linear-gradient(135deg,#0066FF,#1787FF)':'rgba(10,24,56,0.8)',
            color:filter===f?'#fff':C.muted,border:filter===f?'none':`1px solid ${C.border}`,
            boxShadow:filter===f?'0 4px 14px rgba(0,102,255,0.35)':'none',transition:'all 0.15s',
          }}>{f.charAt(0).toUpperCase()+f.slice(1)}</button>
        ))}
        <ERPBtn variant="primary" onClick={()=>setShowCreate(true)} style={{marginLeft:'auto'}}>
          <Plus size={13}/> Create Invoice
        </ERPBtn>
      </div>

      {/* Invoice table */}
      <ERPPanel>
        <ERPPanelHeader title={`${filter==='All'?'All':filter.charAt(0).toUpperCase()+filter.slice(1)} Invoices`} icon="🧾" />
        {filtered.length===0 ? (
          <ERPEmpty icon="🧾" title="No invoices" sub="Create your first invoice above." />
        ) : (
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr>
                  {['Invoice #','Client','Description','Milestone','Amount','Issued','Status',''].map(h=>(
                    <th key={h} style={{padding:'10px 14px',fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.8px',color:C.muted,textAlign:'left',background:'rgba(10,24,56,0.5)',borderBottom:`1px solid ${C.border}`}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv,i)=>(
                  <tr key={inv.id}
                    onMouseEnter={e=>e.currentTarget.style.background='rgba(0,102,255,0.04)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                    style={{transition:'background 0.1s'}}>
                    <td style={{padding:'11px 14px',borderTop:`1px solid ${C.border}20`}}>
                      <span style={{fontSize:11,fontWeight:700,color:C.cyan,fontFamily:'monospace'}}>{inv.id}</span>
                    </td>
                    <td style={{padding:'11px 14px',borderTop:`1px solid ${C.border}20`}}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <ERPAvatar name={inv.clientName} color={COLORS[i%COLORS.length]} size={24}/>
                        <span style={{fontSize:12,color:C.subtle,fontWeight:600}}>{inv.clientName}</span>
                      </div>
                    </td>
                    <td style={{padding:'11px 14px',borderTop:`1px solid ${C.border}20`,maxWidth:200}}>
                      <span style={{fontSize:11,color:C.subtle,overflow:'hidden',display:'block',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>{inv.description}</span>
                    </td>
                    <td style={{padding:'11px 14px',borderTop:`1px solid ${C.border}20`}}>
                      <span style={{fontSize:10,color:C.muted}}>{inv.milestone||'—'}</span>
                    </td>
                    <td style={{padding:'11px 14px',borderTop:`1px solid ${C.border}20`}}>
                      <span style={{fontSize:13,fontWeight:800,color:C.text}}>{inv.amount}</span>
                    </td>
                    <td style={{padding:'11px 14px',borderTop:`1px solid ${C.border}20`}}>
                      <span style={{fontSize:11,color:C.muted}}>{inv.issuedAt}</span>
                      {inv.paidAt&&<div style={{fontSize:10,color:C.green}}>Paid: {inv.paidAt}</div>}
                    </td>
                    <td style={{padding:'11px 14px',borderTop:`1px solid ${C.border}20`}}>
                      <ERPBadge status={inv.status==='paid'?'Paid':'Pending'} />
                    </td>
                    <td style={{padding:'11px 14px',borderTop:`1px solid ${C.border}20`}}>
                      {inv.status==='pending' && (
                        <ERPBtn size="sm" variant="success" onClick={()=>setMarkPaidId(inv.id)}>
                          <CheckCircle2 size={11}/> Mark Paid
                        </ERPBtn>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ERPPanel>

      {/* Create Modal */}
      <ERPModal isOpen={showCreate} onClose={()=>setShowCreate(false)} title="Create Invoice" width={480}>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <ERPSelect label="Client" value={form.clientId} onChange={e=>setForm(p=>({...p,clientId:e.target.value}))}
            placeholder="Select client..." required options={CLIENTS.map(c=>({value:c.id,label:`${c.name} — ${c.company}`}))} />
          <ERPInput label="Description" value={form.description} required
            onChange={e=>setForm(p=>({...p,description:e.target.value}))}
            placeholder="e.g. UI/UX Design Milestone — Corporate Website" />
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <ERPSelect label="Milestone" value={form.milestone} onChange={e=>setForm(p=>({...p,milestone:e.target.value}))}
              placeholder="Select milestone..." options={MILESTONES} />
            <ERPInput label="Amount (LKR)" value={form.amount} type="number"
              onChange={e=>setForm(p=>({...p,amount:e.target.value}))} required placeholder="e.g. 25000" />
          </div>
          <ERPInput label="Issue Date" value={form.issuedAt} type="date"
            onChange={e=>setForm(p=>({...p,issuedAt:e.target.value}))} />
          <div style={{display:'flex',gap:10}}>
            <ERPBtn variant="secondary" onClick={()=>setShowCreate(false)} style={{flex:1,justifyContent:'center'}}>Cancel</ERPBtn>
            <ERPBtn variant="primary" onClick={handleCreate} disabled={!form.clientId||!form.description||!form.amount} style={{flex:1,justifyContent:'center'}}>
              <FileText size={13}/> Create Invoice
            </ERPBtn>
          </div>
        </div>
      </ERPModal>

      {/* Confirm mark paid */}
      <ERPModal isOpen={!!markPaidId} onClose={()=>setMarkPaidId(null)} title="Confirm Payment" width={380}>
        <div style={{display:'flex',flexDirection:'column',gap:14,alignItems:'center',textAlign:'center'}}>
          <div style={{fontSize:36}}>💰</div>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:C.text}}>Mark as Paid?</div>
            <div style={{fontSize:12,color:C.muted,marginTop:4}}>This will update the invoice status to Paid with today's date.</div>
          </div>
          <div style={{display:'flex',gap:10,width:'100%'}}>
            <ERPBtn variant="secondary" onClick={()=>setMarkPaidId(null)} style={{flex:1,justifyContent:'center'}}>Cancel</ERPBtn>
            <ERPBtn variant="success" onClick={()=>handleMarkPaid(markPaidId)} style={{flex:1,justifyContent:'center'}}>
              <CheckCircle2 size={13}/> Confirm Paid
            </ERPBtn>
          </div>
        </div>
      </ERPModal>
    </div>
  );
}
