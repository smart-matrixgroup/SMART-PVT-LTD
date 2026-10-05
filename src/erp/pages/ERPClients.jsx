import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  ERPPanel, ERPPanelHeader, ERPBadge, ERPBtn,
  ERPModal, ERPInput, ERPSelect, ERPEmpty, ERPAvatar,
  ERPProgress, C
} from '../components/ERPui';
import { Search, Plus, Mail, Phone, Calendar, FolderKanban, FileText } from 'lucide-react';

const COLORS = ['#0066FF','#8B5CF6','#18C77A','#F5B942','#F05A67','#00D9FF'];

const DEV_CLIENTS = [
  { id:'C001', name:'John Perera',    company:'Perera Holdings Pvt Ltd', email:'john@pereraholdings.com', phone:'+94 77 123 4567', clientSince:'March 2024',  projects:2, invoices:3, status:'active' },
  { id:'C002', name:'Sarah Fernando', company:'Mehala Restaurant',       email:'sarah@mehala.lk',         phone:'+94 76 987 6543', clientSince:'June 2024',   projects:1, invoices:2, status:'active' },
  { id:'C003', name:'Kumar Arasan',   company:'KA Retail Pvt Ltd',       email:'kumar@karetail.lk',       phone:'+94 75 456 7890', clientSince:'Aug 2024',    projects:1, invoices:1, status:'active' },
  { id:'C004', name:'Priya Nair',     company:'PN Accounting Services',  email:'priya@pnaccounting.lk',   phone:'+94 71 234 5678', clientSince:'Jan 2024',    projects:2, invoices:4, status:'active' },
  { id:'C005', name:'Dilan Perera',   company:'DP Constructions',        email:'dilan@dpcon.lk',          phone:'+94 77 111 2233', clientSince:'Oct 2024',    projects:0, invoices:1, status:'active' },
];

const DEV_PROJECTS = {
  C001: [
    { id:'P001', title:'Corporate Website Redesign', status:'In Progress', completion:65 },
    { id:'P002', title:'SMARTORIX ERP Setup',        status:'Completed',   completion:100 },
  ],
  C002: [
    { id:'P003', title:'Restaurant POS System',      status:'advance_paid', completion:40 },
  ],
  C003: [
    { id:'P004', title:'Mobile App Development',     status:'quotation_sent', completion:0 },
  ],
  C004: [
    { id:'P005', title:'Annual Tax Filing 2024',     status:'Completed', completion:100 },
    { id:'P006', title:'Monthly Bookkeeping',        status:'In Progress', completion:70 },
  ],
};

export default function ERPClients() {
  const { isDevSession } = useAuth();
  const [clients,   setClients]   = useState(DEV_CLIENTS);
  const [search,    setSearch]    = useState('');
  const [selected,  setSelected]  = useState(null);
  const [showAdd,   setShowAdd]   = useState(false);
  const [addForm,   setAddForm]   = useState({ name:'', company:'', email:'', phone:'', clientSince:'' });

  useEffect(() => {
    if (!isFirebaseConfigured || isDevSession) return;
    const q = query(collection(db, 'clients'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => setClients(snap.docs.map(d => ({ id:d.id, ...d.data() }))));
  }, [isDevSession]);

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.company.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  const selectedProjects = selected ? (DEV_PROJECTS[selected.id] || []) : [];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* Top bar */}
      <div style={{ display:'flex', gap:10, alignItems:'center' }}>
        <div style={{ position:'relative', flex:1, maxWidth:320 }}>
          <Search size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:C.muted }} />
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search clients..."
            style={{
              width:'100%', background:'rgba(10,24,56,0.8)', border:`1px solid ${C.border}`,
              borderRadius:10, padding:'8px 14px 8px 30px', color:C.text, fontSize:12,
              outline:'none', boxSizing:'border-box',
            }}
            onFocus={e=>e.target.style.borderColor='rgba(0,102,255,0.5)'}
            onBlur={e=>e.target.style.borderColor=C.border}
          />
        </div>
        <ERPBtn variant="primary" onClick={() => setShowAdd(true)}>
          <Plus size={13} /> Add Client
        </ERPBtn>
        <div style={{ marginLeft:'auto', fontSize:12, color:C.muted }}>
          {filtered.length} client{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Grid */}
      <div style={{ display:'grid', gridTemplateColumns: selected ? '1fr 380px' : 'repeat(auto-fill,minmax(280px,1fr))', gap:14 }}>

        {/* Client cards */}
        {!selected && filtered.map((c, i) => (
          <div key={c.id}
            onClick={() => setSelected(c)}
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius:16, padding:'18px', cursor:'pointer',
              transition:'all 0.2s', backdropFilter:'blur(12px)',
              position:'relative', overflow:'hidden',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = C.borderHi;
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = C.border;
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}>
            {/* Top glow */}
            <div style={{ position:'absolute', top:0, left:0, right:0, height:1, background:`linear-gradient(90deg,transparent,${COLORS[i%COLORS.length]}50,transparent)` }} />

            <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
              <ERPAvatar name={c.name} color={COLORS[i%COLORS.length]} size={40} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:800, color:C.text }}>{c.name}</div>
                <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>{c.company}</div>
              </div>
              <ERPBadge status={c.status || 'active'} />
            </div>

            <div style={{ marginTop:12, display:'flex', flexDirection:'column', gap:5 }}>
              <div style={{ fontSize:11, color:C.muted, display:'flex', gap:6 }}>
                <Mail size={11} style={{ color:C.cyan, flexShrink:0, marginTop:1 }} />{c.email}
              </div>
              <div style={{ fontSize:11, color:C.muted, display:'flex', gap:6 }}>
                <Phone size={11} style={{ color:C.green, flexShrink:0, marginTop:1 }} />{c.phone}
              </div>
            </div>

            <div style={{ marginTop:14, paddingTop:12, borderTop:`1px solid ${C.border}30`, display:'flex', gap:16 }}>
              {[
                { icon:'📁', label:'Projects', val:c.projects||0 },
                { icon:'🧾', label:'Invoices', val:c.invoices||0 },
                { icon:'📅', label:'Since', val:c.clientSince },
              ].map(({ icon, label, val }) => (
                <div key={label} style={{ textAlign:'center' }}>
                  <div style={{ fontSize:13, fontWeight:800, color:C.text }}>{val}</div>
                  <div style={{ fontSize:9, color:C.muted, textTransform:'uppercase', letterSpacing:'0.5px' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* List view when client selected */}
        {selected && (
          <ERPPanel>
            <ERPPanelHeader title="All Clients" icon="👥" />
            {filtered.map((c, i) => (
              <div key={c.id} onClick={() => setSelected(c)}
                style={{
                  display:'flex', alignItems:'center', gap:12, padding:'12px 16px',
                  borderTop: i>0 ? `1px solid ${C.border}25` : 'none',
                  cursor:'pointer', transition:'background 0.1s',
                  background: selected?.id===c.id ? 'rgba(0,102,255,0.07)' : 'transparent',
                  borderLeft: selected?.id===c.id ? '3px solid #0066FF' : '3px solid transparent',
                }}
                onMouseEnter={e=>{ if(selected?.id!==c.id) e.currentTarget.style.background='rgba(0,102,255,0.04)'; }}
                onMouseLeave={e=>{ if(selected?.id!==c.id) e.currentTarget.style.background='transparent'; }}>
                <ERPAvatar name={c.name} color={COLORS[i%COLORS.length]} size={32} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.name}</div>
                  <div style={{ fontSize:10, color:C.muted, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.company}</div>
                </div>
                <ERPBadge status={c.status||'active'} size="sm" />
              </div>
            ))}
          </ERPPanel>
        )}

        {/* Client detail */}
        {selected && (
          <ERPPanel style={{ alignSelf:'flex-start' }}>
            <ERPPanelHeader title="Client Profile" icon="👤"
              action={<span style={{cursor:'pointer'}} onClick={()=>setSelected(null)}>✕</span>} />
            <div style={{ padding:18, display:'flex', flexDirection:'column', gap:16 }}>

              {/* Header */}
              <div style={{ display:'flex', gap:14, alignItems:'center' }}>
                <ERPAvatar name={selected.name} color={C.blue} size={50} />
                <div>
                  <div style={{ fontSize:16, fontWeight:900, color:C.text }}>{selected.name}</div>
                  <div style={{ fontSize:12, color:C.muted }}>{selected.company}</div>
                  <ERPBadge status={selected.status||'active'} />
                </div>
              </div>

              {/* Contact */}
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {[
                  { icon:<Mail size={12}/>,     label:'Email',   val:selected.email,      color:C.cyan  },
                  { icon:<Phone size={12}/>,    label:'Phone',   val:selected.phone,      color:C.green },
                  { icon:<Calendar size={12}/>, label:'Client since', val:selected.clientSince, color:C.muted },
                ].map(({ icon, label, val, color }) => (
                  <div key={label} style={{ display:'flex', gap:10, alignItems:'center' }}>
                    <span style={{ color, flexShrink:0 }}>{icon}</span>
                    <span style={{ fontSize:11, color:C.muted, width:80, flexShrink:0 }}>{label}</span>
                    <span style={{ fontSize:11, color:C.subtle, fontWeight:600 }}>{val}</span>
                  </div>
                ))}
              </div>

              {/* Stats */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                {[
                  { label:'Projects', val:selected.projects||selectedProjects.length, color:'#0066FF' },
                  { label:'Invoices', val:selected.invoices||0, color:'#18C77A' },
                  { label:'Messages', val:'—', color:'#8B5CF6' },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{
                    padding:'10px', borderRadius:10, textAlign:'center',
                    background:'rgba(10,24,56,0.6)', border:`1px solid ${C.border}30`,
                  }}>
                    <div style={{ fontSize:18, fontWeight:900, color }}>{val}</div>
                    <div style={{ fontSize:9, color:C.muted, textTransform:'uppercase', letterSpacing:'0.5px', marginTop:2 }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Projects list */}
              {selectedProjects.length > 0 && (
                <div>
                  <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:8 }}>Projects</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {selectedProjects.map(p => (
                      <div key={p.id} style={{
                        padding:'10px 12px', borderRadius:10,
                        background:'rgba(10,24,56,0.6)', border:`1px solid ${C.border}30`,
                      }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                          <span style={{ fontSize:11, fontWeight:700, color:C.text }}>{p.title}</span>
                          <ERPBadge status={p.status} size="sm" />
                        </div>
                        <ERPProgress value={p.completion} />
                        <div style={{ fontSize:10, color:C.cyan, marginTop:4, textAlign:'right' }}>{p.completion}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick actions */}
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <ERPBtn variant="primary" style={{ justifyContent:'center' }}>
                  <FolderKanban size={13} /> New Project
                </ERPBtn>
                <ERPBtn variant="secondary" style={{ justifyContent:'center' }}>
                  <FileText size={13} /> Create Invoice
                </ERPBtn>
                <a href={`https://wa.me/${(selected.phone||'').replace(/\D/g,'')}?text=${encodeURIComponent(`Hi ${selected.name}, this is SMART Pvt Ltd. How can we help you today?`)}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                    padding:'8px', borderRadius:10, textDecoration:'none',
                    background:'rgba(37,211,102,0.1)', border:'1px solid rgba(37,211,102,0.3)',
                    color:'#25D366', fontSize:12, fontWeight:700,
                  }}>
                  💬 WhatsApp Client
                </a>
              </div>
            </div>
          </ERPPanel>
        )}

        {filtered.length === 0 && !selected && (
          <div style={{ gridColumn:'1/-1' }}>
            <ERPEmpty icon="👥" title="No clients found" sub="Try a different search or add a new client." />
          </div>
        )}
      </div>

      {/* ── Add client modal ── */}
      <ERPModal isOpen={showAdd} onClose={()=>setShowAdd(false)} title="Add New Client" width={460}>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <ERPInput label="Full Name" value={addForm.name} onChange={e=>setAddForm(p=>({...p,name:e.target.value}))} required placeholder="e.g. John Perera" />
          <ERPInput label="Company" value={addForm.company} onChange={e=>setAddForm(p=>({...p,company:e.target.value}))} placeholder="e.g. Perera Holdings Pvt Ltd" />
          <ERPInput label="Email" value={addForm.email} type="email" onChange={e=>setAddForm(p=>({...p,email:e.target.value}))} required placeholder="john@company.com" />
          <ERPInput label="Phone / WhatsApp" value={addForm.phone} type="tel" onChange={e=>setAddForm(p=>({...p,phone:e.target.value}))} placeholder="+94 77 000 0000" />
          <div style={{ display:'flex', gap:10 }}>
            <ERPBtn variant="secondary" onClick={()=>setShowAdd(false)} style={{flex:1,justifyContent:'center'}}>Cancel</ERPBtn>
            <ERPBtn variant="primary" onClick={()=>{
              setClients(p=>[...p,{id:`C${Date.now()}`,status:'active',projects:0,invoices:0,...addForm}]);
              setShowAdd(false);
              setAddForm({name:'',company:'',email:'',phone:'',clientSince:''});
            }} style={{flex:1,justifyContent:'center'}}>
              <Plus size={13}/> Add Client
            </ERPBtn>
          </div>
        </div>
      </ERPModal>
    </div>
  );
}
