import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, onSnapshot,
  doc, updateDoc, addDoc, setDoc, deleteDoc, serverTimestamp
} from 'firebase/firestore';
import { createStaffAuthAccount, db, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  ERPPanel, ERPPanelHeader, ERPBadge, ERPBtn,
  ERPModal, ERPInput, ERPEmpty, ERPAvatar, C
} from '../components/ERPui';
import { formatWhen, toMillis } from '../formatWhen';
import { CheckCircle2, XCircle, Trash2, MessageSquare, RefreshCw, Search, ChevronLeft, ChevronRight } from 'lucide-react';

// ── Dev mock leads ────────────────────────────────────────────────
const DEV_LEADS = [
  { leadId:'L001', name:'Rahul Mendis',   company:'RMG Trading Pvt Ltd',    email:'rahul@rmgtrading.lk',  whatsapp:'+94771234567', service:'ERP System',  description:'We run a restaurant chain with 3 branches. Need POS + inventory + staff management.',  type:'client_request', status:'New',      createdAt:'2 min ago',  budget:'LKR 100K–250K' },
  { leadId:'L002', name:'Thilak Rajah',   company:'TR Holdings',            email:'thilak@trholdings.lk', whatsapp:'+94769876543', service:'Website',     description:'Need a corporate website with 10 pages, dark/light theme, contact form and SEO.',    type:'quote_modal',    status:'New',      createdAt:'18 min ago', budget:'LKR 50K–100K' },
  { leadId:'L003', name:'Amali Senerath', company:'AS Enterprises',         email:'amali@ase.lk',         whatsapp:'+94754561234', service:'Mobile App',  description:'Need an Android + iOS app for our retail store — barcode scan + loyalty points.',   type:'client_request', status:'New',      createdAt:'1 hr ago',   budget:'LKR 100K–250K' },
  { leadId:'L004', name:'Dilan Perera',   company:'DP Constructions',       email:'dilan@dpcon.lk',       whatsapp:'+94771112233', service:'Accounting',  description:'Need monthly bookkeeping + tax filing (VAT + CIT) for our construction company.',   type:'quote_modal',    status:'Accepted', createdAt:'2 days ago', budget:'Monthly retainer' },
  { leadId:'L005', name:'Nimali Silva',   company:'Individual / Freelancer', email:'nimali@gmail.com',    whatsapp:'+94778889900', service:'Portfolio Website', description:'I am a graphic designer. Need a portfolio site with project gallery and WhatsApp CTA.', type:'client_request', status:'Rejected', createdAt:'3 days ago', budget:'LKR 15K–25K' },
];

const COLORS = ['#0066FF','#F5B942','#8B5CF6','#18C77A','#F05A67','#00D9FF'];
const PAGE_SIZE = 8;

// Website forms write a human-readable `source` field ("Quote Request",
// "Contact Form", "Get Started", "Newsletter"). Older leads only carry the
// legacy `type` field — fall back to a type-derived label so nothing is blank.
function sourceLabel(lead) {
  if (lead.source) return lead.source;
  if (lead.type === 'client_request') return 'Get Started';
  if (lead.type === 'quote_modal') return 'Quote Modal';
  return 'Website';
}

export default function ERPLeads() {
  const { isDevSession } = useAuth();
  const live = isFirebaseConfigured && !isDevSession;
  const [leads,     setLeads]     = useState([]);
  const [filter,    setFilter]    = useState('All');
  const [search,    setSearch]    = useState('');
  const [page,      setPage]      = useState(1);
  const [refreshTick, setRefreshTick] = useState(0);
  const [selected,  setSelected]  = useState(null);
  const [showAccept, setShowAccept] = useState(false);
  const [showReject, setShowReject] = useState(false);

  // Accept form state
  const [accForm, setAccForm] = useState({ email:'', password:'', name:'', company:'' });
  const [accLoading, setAccLoading] = useState(false);
  const [accDone,    setAccDone]    = useState(false);
  const [accError,   setAccError]   = useState('');

  // Reject reason
  const [rejectReason, setRejectReason] = useState('');

  // Listener failure — must be visible, not just a console line
  const [loadError, setLoadError] = useState('');

  // Load from Firestore. Do NOT orderBy createdAt in the query:
  // docs missing that field are dropped, and rendering a Timestamp object
  // as a React child crashes the page (data appears, then the tree unmounts).
  useEffect(() => {
    if (!isFirebaseConfigured || isDevSession) return;
    const unsub = onSnapshot(
      collection(db, 'leads'),
      (snap) => {
        const rows = snap.docs.map(d => ({ leadId: d.id, ...d.data() }));
        rows.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setLeads(rows);
        setLoadError('');
      },
      (err) => {
        console.error('Leads listener error', err);
        setLoadError(
          err.code === 'permission-denied'
            ? "Permission denied — deploy the updated Firestore rules and make sure you're signed in as an admin."
            : (err.message || "Couldn't load leads. Click Refresh to retry.")
        );
      }
    );
    return unsub;
  }, [isDevSession, refreshTick]);

  // Pre-fill accept form when lead selected (stable one-time password)
  useEffect(() => {
    if (selected) {
      setAccForm({
        email:    selected.email    || '',
        password: 'Smart@1234',
        name:     selected.name     || '',
        company:  selected.company  || '',
      });
      setAccDone(false);
      setAccError('');
    }
  }, [selected]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter(l => {
      if (filter !== 'All' && l.status !== filter) return false;
      if (!q) return true;
      return [l.name, l.company, l.email, l.service, l.description, l.message, l.whatsapp]
        .some(v => String(v || '').toLowerCase().includes(q));
    });
  }, [leads, filter, search]);

  useEffect(() => { setPage(1); }, [filter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const counts = { All: leads.length, New: leads.filter(l=>l.status==='New').length, Accepted: leads.filter(l=>l.status==='Accepted').length, Rejected: leads.filter(l=>l.status==='Rejected').length };

  // ── Accept handler ─────────────────────────────────────────────
  // Full pipeline start: Auth user + clients/{uid} doc (id MUST equal the
  // Auth uid — AuthContext resolves the client role by doc existence) +
  // a first project so the client sees their request right after login.
  // The Auth account is created on a secondary Firebase app instance so
  // the admin's own session is never replaced.
  const handleAccept = async () => {
    if (!accForm.email || !accForm.password || !accForm.name) {
      setAccError('Name, email and password are required.'); return;
    }
    setAccLoading(true); setAccError('');
    try {
      let uid = `dev-${Date.now()}`;
      let projectId = `dev-p-${Date.now()}`;

      if (isFirebaseConfigured && !isDevSession) {
        // Create the Firebase Auth user WITHOUT touching the admin session
        uid = await createStaffAuthAccount(accForm.email, accForm.password);

        // Client doc: id = uid (role resolution in AuthContext depends on it)
        await setDoc(doc(db, 'clients', uid), {
          uid, name: accForm.name, company: accForm.company,
          email: accForm.email, phone: selected.whatsapp || '',
          clientSince: new Date().toLocaleDateString('en-US', { month:'long', year:'numeric' }),
          projects:[], invoices:[], tickets:[],
          createdAt: serverTimestamp(),
          sourceLeadId: selected.leadId,
        });

        // First project — created from the lead request so the client's
        // dashboard shows their work immediately after login.
        const projRef = await addDoc(collection(db, 'projects'), {
          clientId:      uid,
          clientName:    accForm.name,
          clientCompany: accForm.company || '',
          title:         selected.service || 'New Project',
          serviceType:   selected.service || '',
          description:   selected.description || selected.message || '',
          budget:        selected.budget || '',
          status:        'requirements_pending',
          completion:    0,
          milestones:    [],
          assignedStaff: [],
          quotation:     null,
          sourceLeadId:  selected.leadId,
          createdAt:     serverTimestamp(),
          updatedAt:     serverTimestamp(),
        });
        projectId = projRef.id;

        // Update lead status + link the created account & project
        await updateDoc(doc(db, 'leads', selected.leadId), {
          status: 'Accepted', convertedClientId: uid, convertedProjectId: projectId,
          acceptedAt: serverTimestamp(),
        });
      }

      // Update local state
      setLeads(prev => prev.map(l => l.leadId === selected.leadId
        ? { ...l, status: 'Accepted', convertedProjectId: projectId } : l));
      setAccDone(true);
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use' || String(err.message).includes('email-already-in-use')) {
        setAccError(`The email "${accForm.email}" is already registered in Firebase with another password. Please use a different email or delete/reset it in Firebase.`);
      } else {
        setAccError(err.message || 'Failed to create client. Try again.');
      }
    } finally {
      setAccLoading(false);
    }
  };

  // ── Reject handler ─────────────────────────────────────────────
  const handleReject = async () => {
    if (!isDevSession && isFirebaseConfigured) {
      try {
        await updateDoc(doc(db, 'leads', selected.leadId), {
          status: 'Rejected', rejectedReason: rejectReason, rejectedAt: serverTimestamp(),
        });
      } catch (err) { console.error(err); }
    }
    setLeads(prev => prev.map(l => l.leadId === selected.leadId ? { ...l, status: 'Rejected' } : l));
    setShowReject(false);
    setRejectReason('');
    setSelected(null);
  };

  // ── Delete lead handler ──────────────────────────────────────────
  const handleDeleteLead = async (leadId, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Delete this lead permanently from the database?')) return;
    try {
      if (isFirebaseConfigured && !isDevSession) {
        await deleteDoc(doc(db, 'leads', leadId));
      }
      setLeads(prev => prev.filter(l => l.leadId !== leadId));
      if (selected?.leadId === leadId) setSelected(null);
    } catch (err) {
      console.error(err);
      if (err.code === 'permission-denied') {
        alert("Permission denied by Firebase. Please publish the updated firestore.rules in your Firebase Console or delete the lead directly from the Firebase Console Data tab.");
      } else {
        alert('Could not delete lead: ' + (err.message || err));
      }
    }
  };

  const handleClearAllLeads = async () => {
    if (leads.length === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete all ${leads.length} leads from Firebase?`)) return;
    try {
      if (isFirebaseConfigured && !isDevSession) {
        await Promise.all(leads.map(l => deleteDoc(doc(db, 'leads', l.leadId))));
      }
      setLeads([]);
      setSelected(null);
    } catch (err) {
      console.error(err);
      if (err.code === 'permission-denied') {
        alert("Permission denied by Firebase. To delete from the UI, make sure you have published firestore.rules in Firebase Console. You can also delete them in 1 click under Firebase Console > Firestore Database > Data > leads.");
      } else {
        alert('Could not clear leads: ' + (err.message || err));
      }
    }
  };

  // Build WhatsApp credential message
  const buildWhatsApp = () => {
    const svc = selected?.service || 'your project';
    const text = `Hi ${accForm.name}! 👋

Your SMART Pvt Ltd Client Portal is ready!

🔗 Login: ${window.location.origin}/client-login
📧 Email: ${accForm.email}
🔑 Password: ${accForm.password}

Your request — ${svc} — has been added as a project in your dashboard. You can track its progress, view quotations & requirements, and message us from the portal.

— SMART Pvt Ltd Team`;
    return `https://wa.me/${(selected?.whatsapp||'').replace(/\D/g,'')}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* ── Filter tabs ── */}
      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
        {['All','New','Accepted','Rejected'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{
              padding:'7px 16px', borderRadius:10, fontSize:12, fontWeight:700,
              cursor:'pointer', transition:'all 0.15s',
              background: filter===f ? 'linear-gradient(135deg,#0066FF,#1787FF)' : 'rgba(10,24,56,0.8)',
              color: filter===f ? '#fff' : C.muted,
              boxShadow: filter===f ? '0 4px 14px rgba(0,102,255,0.35)' : 'none',
              border: filter===f ? 'none' : `1px solid ${C.border}`,
            }}>
            {f} {counts[f] > 0 && <span style={{
              marginLeft:6, background: filter===f?'rgba(255,255,255,0.2)':'rgba(0,102,255,0.15)',
              padding:'1px 6px', borderRadius:20, fontSize:10,
            }}>{counts[f]}</span>}
          </button>
        ))}
        <div style={{ position:'relative', marginLeft:'auto' }}>
          <Search size={12} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:C.muted }} />
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search leads..."
            style={{
              width:200, background:'rgba(10,24,56,0.8)', border:`1px solid ${C.border}`,
              borderRadius:10, padding:'7px 12px 7px 28px', color:C.text, fontSize:12, outline:'none',
            }} />
        </div>
        <button onClick={() => setRefreshTick(t => t + 1)} style={{
          display:'flex', alignItems:'center', gap:6,
          padding:'7px 14px', borderRadius:10, fontSize:11, fontWeight:600,
          background:'rgba(10,24,56,0.8)', border:`1px solid ${C.border}`,
          color:C.muted, cursor:'pointer',
        }}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* ── Load error banner ── */}
      {loadError && (
        <div style={{
          display:'flex', alignItems:'center', gap:10,
          padding:'10px 14px', borderRadius:10,
          background:'rgba(240,90,103,0.1)', border:'1px solid rgba(240,90,103,0.35)',
          fontSize:11, color:C.red, lineHeight:1.5,
        }}>
          <XCircle size={14} style={{ flexShrink:0 }} />
          <span>{loadError}</span>
        </div>
      )}

      {/* ── Main grid ── */}
      <div style={{ display:'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap:16 }}>

        {/* Lead list */}
        <ERPPanel>
          <ERPPanelHeader
            title={`${filter} Leads`}
            icon="🔔"
            action={
              leads.length > 0 ? (
                <ERPBtn size="sm" variant="danger" onClick={handleClearAllLeads}>
                  <Trash2 size={12} /> Clear All ({leads.length})
                </ERPBtn>
              ) : null
            }
          />
          {filtered.length === 0 ? (
            <ERPEmpty icon="🎉" title="No leads here" sub="All clear!" />
          ) : (
            <div>
              {pageRows.map((lead, i) => {
                const isSelected = selected?.leadId === lead.leadId;
                const color = COLORS[i % COLORS.length];
                const blurb = lead.description || lead.message || '';
                return (
                  <div key={lead.leadId}
                    onClick={() => setSelected(isSelected ? null : lead)}
                    style={{
                      display:'flex', alignItems:'flex-start', gap:12, padding:'14px 18px',
                      borderTop: i>0 ? `1px solid ${C.border}25` : 'none',
                      cursor:'pointer', transition:'background 0.15s',
                      background: isSelected ? 'rgba(0,102,255,0.07)' : 'transparent',
                      borderLeft: isSelected ? '3px solid #0066FF' : '3px solid transparent',
                    }}
                    onMouseEnter={e => { if(!isSelected) e.currentTarget.style.background='rgba(0,102,255,0.04)'; }}
                    onMouseLeave={e => { if(!isSelected) e.currentTarget.style.background='transparent'; }}>

                    <ERPAvatar name={lead.name} color={color} size={38} />

                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                        <span style={{ fontSize:13, fontWeight:700, color:C.text }}>{lead.name}</span>
                        <ERPBadge status={lead.status} />
                        <span style={{
                          fontSize:10, padding:'2px 8px', borderRadius:20,
                          background:'rgba(0,217,255,0.08)', color:C.cyan,
                          border:'1px solid rgba(0,217,255,0.2)',
                        }}>📌 {sourceLabel(lead)}</span>
                      </div>
                      <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>
                        {lead.company} · {lead.email}
                      </div>
                      <div style={{ fontSize:11, color:C.subtle, marginTop:4, display:'flex', gap:16 }}>
                        <span>🎯 {lead.service}</span>
                        {lead.budget && <span>💰 {lead.budget}</span>}
                        <span style={{ color:C.muted }}>🕐 {formatWhen(lead.createdAt)}</span>
                      </div>
                      <div style={{
                        marginTop:6, fontSize:11, color:C.muted, lineHeight:1.5,
                        overflow:'hidden', display:'-webkit-box',
                        WebkitLineClamp:2, WebkitBoxOrient:'vertical',
                      }}>{blurb}</div>
                    </div>

                    {/* Quick actions */}
                    <div style={{ display:'flex', gap:6, flexShrink:0, alignItems:'center' }}
                      onClick={e => e.stopPropagation()}>
                      {lead.status === 'New' && (
                        <>
                          <ERPBtn size="sm" variant="success" onClick={() => { setSelected(lead); setShowAccept(true); }}>
                            <CheckCircle2 size={12} /> Accept
                          </ERPBtn>
                          <ERPBtn size="sm" variant="danger" onClick={() => { setSelected(lead); setShowReject(true); }}>
                            <XCircle size={12} /> Reject
                          </ERPBtn>
                        </>
                      )}
                      <ERPBtn size="sm" variant="ghost" title="Delete lead" onClick={(e) => handleDeleteLead(lead.leadId, e)} style={{ color: C.red, padding:'6px 8px' }}>
                        <Trash2 size={13} />
                      </ERPBtn>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {filtered.length > PAGE_SIZE && (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, padding:'12px 16px', borderTop:`1px solid ${C.border}40` }}>
              <ERPBtn size="sm" variant="secondary" disabled={safePage<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>
                <ChevronLeft size={13}/> Prev
              </ERPBtn>
              <span style={{ fontSize:11, color:C.muted }}>Page {safePage} of {totalPages}</span>
              <ERPBtn size="sm" variant="secondary" disabled={safePage>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>
                Next <ChevronRight size={13}/>
              </ERPBtn>
            </div>
          )}
        </ERPPanel>

        {/* Detail panel */}
        {selected && (
          <ERPPanel style={{ position:'sticky', top:0, alignSelf:'flex-start' }}>
            <ERPPanelHeader title="Lead Detail" icon="📋" action={<span style={{cursor:'pointer'}} onClick={()=>setSelected(null)}>✕</span>} />
            <div style={{ padding:16, display:'flex', flexDirection:'column', gap:14 }}>

              {/* Client info */}
              <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                <ERPAvatar name={selected.name} color={C.blue} size={44} />
                <div>
                  <div style={{ fontSize:15, fontWeight:800, color:C.text }}>{selected.name}</div>
                  <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{selected.company}</div>
                  <ERPBadge status={selected.status} />
                </div>
              </div>

              {/* Info rows */}
              {[
                { label:'Email',    val:selected.email },
                { label:'WhatsApp', val:selected.whatsapp },
                { label:'Service',  val:selected.service },
                { label:'Budget',   val:selected.budget },
                { label:'Source',   val:sourceLabel(selected) },
                { label:'Received', val:formatWhen(selected.createdAt) },
              ].filter(r=>r.val).map(({ label, val }) => (
                <div key={label} style={{ display:'flex', gap:8 }}>
                  <span style={{ fontSize:11, color:C.muted, width:70, flexShrink:0 }}>{label}</span>
                  <span style={{ fontSize:11, color:C.subtle, fontWeight:600 }}>{val}</span>
                </div>
              ))}

              {/* Description */}
              <div>
                <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>Description</div>
                <div style={{
                  fontSize:11, color:C.subtle, lineHeight:1.6,
                  background:'rgba(10,24,56,0.6)', border:`1px solid ${C.border}`,
                  borderRadius:10, padding:'10px 12px',
                }}>{selected.description || selected.message || '—'}</div>
              </div>

              {/* Actions */}
              {selected.status === 'New' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8, paddingTop:4 }}>
                  <ERPBtn variant="success" onClick={() => setShowAccept(true)} style={{ width:'100%', justifyContent:'center' }}>
                    <CheckCircle2 size={14} /> Accept & Create Client Account
                  </ERPBtn>
                  <ERPBtn variant="danger" onClick={() => setShowReject(true)} style={{ width:'100%', justifyContent:'center' }}>
                    <XCircle size={14} /> Reject Request
                  </ERPBtn>
                </div>
              )}
              {selected.status === 'Accepted' && (
                <div style={{
                  padding:'10px 12px', borderRadius:10,
                  background:'rgba(24,199,122,0.1)', border:'1px solid rgba(24,199,122,0.3)',
                  fontSize:11, color:C.green, display:'flex', gap:6, alignItems:'center',
                }}>
                  <CheckCircle2 size={14} /> Client account + project created. Credentials sent via WhatsApp.
                </div>
              )}

              <div style={{ paddingTop:8, borderTop:`1px solid ${C.border}40` }}>
                <ERPBtn variant="danger" onClick={(e) => handleDeleteLead(selected.leadId, e)} style={{ width:'100%', justifyContent:'center' }}>
                  <Trash2 size={13} /> Delete Lead Permanently
                </ERPBtn>
              </div>
            </div>
          </ERPPanel>
        )}
      </div>

      {/* ── ACCEPT MODAL ── */}
      <ERPModal isOpen={showAccept} onClose={() => { setShowAccept(false); setAccDone(false); }} title="Accept Lead & Create Client Account" width={500}>
        {!accDone ? (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{
              padding:'10px 14px', borderRadius:10,
              background:'rgba(0,102,255,0.08)', border:`1px solid ${C.borderHi}`,
              fontSize:11, color:C.subtle, lineHeight:1.5,
            }}>
              This will create a <strong style={{color:C.text}}>Firebase Auth user</strong>, a <strong style={{color:C.text}}>client record</strong> and a <strong style={{color:C.text}}>project</strong> from this request (status: Requirements Pending). The credentials below will be sent to the client via WhatsApp.
            </div>

            <ERPInput label="Client Name" value={accForm.name}
              onChange={e=>setAccForm(p=>({...p,name:e.target.value}))} required />
            <ERPInput label="Company" value={accForm.company}
              onChange={e=>setAccForm(p=>({...p,company:e.target.value}))} />
            <ERPInput label="Login Email" value={accForm.email} type="email"
              onChange={e=>setAccForm(p=>({...p,email:e.target.value}))} required />

            {/* One-time client password */}
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:C.subtle, marginBottom:6 }}>
                Client Login Password <span style={{color:C.red}}>*</span>
              </label>
              <div style={{ display:'flex', gap:8 }}>
                <input value={accForm.password}
                  onChange={e=>setAccForm(p=>({...p,password:e.target.value}))}
                  placeholder="Enter one-time password (min 6 characters)"
                  style={{
                    flex:1, background:'rgba(10,24,56,0.8)', border:`1px solid ${C.border}`,
                    borderRadius:10, padding:'9px 14px', color:C.text, fontSize:12, outline:'none',
                  }} />
                <button onClick={() => { navigator.clipboard.writeText(accForm.password); }}
                  title="Copy password"
                  type="button"
                  style={{
                    padding:'9px 14px', borderRadius:10, background:'rgba(32,52,93,0.5)',
                    border:`1px solid ${C.border}`, color:C.text, cursor:'pointer', fontSize:12,
                    display:'flex', alignItems:'center', gap:4
                  }}>📋 Copy</button>
              </div>
              <div style={{ fontSize:10, color:C.muted, marginTop:4 }}>
                This is a one-time created password for this client. They will use this password to sign into the Client Portal.
              </div>
            </div>

            {accError && (
              <div style={{ padding:'10px 12px', borderRadius:10, background:'rgba(240,90,103,0.1)', border:'1px solid rgba(240,90,103,0.3)', fontSize:11, color:C.red }}>
                {accError}
              </div>
            )}

            <div style={{ display:'flex', gap:10, paddingTop:4 }}>
              <ERPBtn variant="secondary" onClick={()=>setShowAccept(false)} style={{flex:1,justifyContent:'center'}}>
                Cancel
              </ERPBtn>
              <ERPBtn variant="success" onClick={handleAccept} disabled={accLoading} style={{flex:1,justifyContent:'center'}}>
                {accLoading ? '⏳ Creating...' : '✅ Create Account'}
              </ERPBtn>
            </div>
          </div>
        ) : (
          <div style={{ textAlign:'center', padding:'16px 0', display:'flex', flexDirection:'column', gap:16, alignItems:'center' }}>
            <div style={{ fontSize:40 }}>🎉</div>
            <div>
              <div style={{ fontSize:16, fontWeight:800, color:C.text }}>Client Account Created!</div>
              <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>
                A project was also created from this request — the client will see it after logging in. Now send the credentials via WhatsApp.
              </div>
            </div>
            {/* Credentials summary */}
            <div style={{
              width:'100%', background:'rgba(10,24,56,0.8)', border:`1px solid ${C.border}`,
              borderRadius:12, padding:'12px 16px', textAlign:'left',
            }}>
              {[['Name',accForm.name],['Email',accForm.email],['Password',accForm.password]].map(([k,v])=>(
                <div key={k} style={{ display:'flex', gap:8, marginBottom:6 }}>
                  <span style={{ fontSize:11, color:C.muted, width:70 }}>{k}</span>
                  <span style={{ fontSize:11, color:C.text, fontWeight:700 }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:10, width:'100%' }}>
              <a href={buildWhatsApp()} target="_blank" rel="noopener noreferrer"
                style={{
                  flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  padding:'11px', borderRadius:10, textDecoration:'none',
                  background:'linear-gradient(135deg,#25D366,#128C7E)', color:'#fff',
                  fontWeight:700, fontSize:12,
                }}>
                <MessageSquare size={14} /> Send via WhatsApp
              </a>
              <ERPBtn variant="secondary" onClick={()=>{setShowAccept(false);setAccDone(false);}} style={{flex:1,justifyContent:'center'}}>
                Done
              </ERPBtn>
            </div>
          </div>
        )}
      </ERPModal>

      {/* ── REJECT MODAL ── */}
      <ERPModal isOpen={showReject} onClose={()=>setShowReject(false)} title="Reject Lead" width={400}>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ fontSize:12, color:C.muted }}>
            Rejecting request from <strong style={{color:C.text}}>{selected?.name}</strong>. This cannot be undone.
          </div>
          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:600, color:C.subtle, marginBottom:6 }}>
              Reason (optional)
            </label>
            <textarea value={rejectReason} onChange={e=>setRejectReason(e.target.value)}
              rows={3} placeholder="e.g. Budget mismatch, out of scope..."
              style={{
                width:'100%', background:'rgba(10,24,56,0.8)', border:`1px solid ${C.border}`,
                borderRadius:10, padding:'9px 14px', color:C.text, fontSize:12,
                outline:'none', resize:'none', fontFamily:'inherit', boxSizing:'border-box',
              }} />
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <ERPBtn variant="secondary" onClick={()=>setShowReject(false)} style={{flex:1,justifyContent:'center'}}>Cancel</ERPBtn>
            <ERPBtn variant="danger" onClick={handleReject} style={{flex:1,justifyContent:'center'}}>
              <XCircle size={13} /> Confirm Reject
            </ERPBtn>
          </div>
        </div>
      </ERPModal>
    </div>
  );
}
