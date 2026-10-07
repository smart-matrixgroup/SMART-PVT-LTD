import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  ERPPanel, ERPPanelHeader, ERPBadge, ERPBtn,
  ERPModal, ERPInput, ERPSelect, ERPEmpty,
  ERPAvatar, C
} from '../components/ERPui';
import { REQUIREMENT_TEMPLATE_SEEDS, seedId } from '../data/seedTemplates';
import {
  Plus, Trash2, Send, Eye, CheckCircle2,
  ChevronDown, ChevronUp,
  Upload, Type, List,
  ToggleLeft, AlignLeft, Hash
} from 'lucide-react';

// ── Field type config ─────────────────────────────────────────────
const FIELD_TYPES = [
  { value: 'text',      label: 'Short Text',      icon: <Type size={13}/>,      desc: 'Single line text input' },
  { value: 'textarea',  label: 'Long Text',        icon: <AlignLeft size={13}/>, desc: 'Multi-line paragraph' },
  { value: 'number',    label: 'Number',           icon: <Hash size={13}/>,      desc: 'Numeric input' },
  { value: 'select',    label: 'Dropdown',         icon: <ChevronDown size={13}/>,desc: 'Select one option' },
  { value: 'radio',     label: 'Single Choice',    icon: <ToggleLeft size={13}/>,desc: 'Radio buttons' },
  { value: 'checkbox',  label: 'Multiple Choice',  icon: <List size={13}/>,      desc: 'Checkboxes' },
  { value: 'file',      label: 'File Upload',      icon: <Upload size={13}/>,    desc: 'PDF, Word, Image, Excel' },
];

const FILE_ACCEPTS = {
  'any':   'Any file type',
  'pdf':   'PDF only',
  'image': 'Images (JPG, PNG, etc.)',
  'doc':   'Word documents',
  'excel': 'Excel spreadsheets',
  'pdf_image': 'PDF or Images',
  'all_docs': 'PDF, Word, Excel',
};

// ── Timestamp helpers (client-side sort, no orderBy in listeners) ─
const toMs = (t) => {
  if (!t) return 0;
  if (typeof t === 'number') return t;
  if (typeof t === 'string') { const n = Date.parse(t); return Number.isNaN(n) ? 0 : n; }
  if (typeof t === 'object') {
    if (typeof t.toDate === 'function') return t.toDate().getTime();
    if (typeof t.seconds === 'number') return t.seconds * 1000;
  }
  return 0;
};
const fmtMs = (ms) => ms
  ? new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  : '';

// ── Dev-mode data (only when Firebase is off / dev session) ───────
const DEV_CLIENTS = [
  { id:'C001', name:'John Perera',    company:'Perera Holdings' },
  { id:'C002', name:'Sarah Fernando', company:'Mehala Restaurant' },
  { id:'C003', name:'Kumar Arasan',   company:'KA Retail' },
  { id:'C004', name:'Priya Nair',     company:'PN Accounting' },
  { id:'C005', name:'Dilan Perera',   company:'DP Constructions' },
];

// ── Built-in form templates (question-forms, separate from the
//    per-service document checklist templates in ERPTemplates) ─────
const TEMPLATES = {
  'Website': {
    label: 'Website Requirements',
    icon: '🌐',
    fields: [
      { id:'f1', type:'checkbox', label:'Pages needed', required:true,  options:['Home','About','Services','Contact','Blog','Portfolio','Pricing','FAQ'] },
      { id:'f2', type:'select',   label:'Design style', required:true,  options:['Modern & Minimal','Corporate','Creative','Classic'] },
      { id:'f3', type:'textarea', label:'Reference websites (URLs)', required:false, placeholder:'https://example.com' },
      { id:'f4', type:'radio',    label:'Content ready?', required:true, options:['Yes, fully ready','Partially ready','Need help'] },
      { id:'f5', type:'checkbox', label:'Special features', required:false, options:['Contact Form','WhatsApp Chat','Google Maps','Blog','E-Commerce','Booking','Gallery'] },
      { id:'f6', type:'text',     label:'Expected deadline', required:false, placeholder:'e.g. Within 1 month' },
      { id:'f7', type:'textarea', label:'Additional notes', required:false, placeholder:'Any other requirements...' },
    ]
  },
  'ERP/POS': {
    label: 'ERP & POS Requirements',
    icon: '⚙️',
    fields: [
      { id:'f1', type:'select',   label:'Business type', required:true, options:['Restaurant','Supermarket','Hotel','Manufacturing','Service','Other'] },
      { id:'f2', type:'select',   label:'Number of staff users', required:true, options:['1–5','6–15','16–30','30+'] },
      { id:'f3', type:'checkbox', label:'Modules needed', required:true, options:['POS Billing','Table Management','Inventory','KOT Display','Staff Roles','Supplier Orders','Reports','Multi-Branch'] },
      { id:'f4', type:'radio',    label:'Offline mode required?', required:true, options:['Yes','No','Not sure'] },
      { id:'f5', type:'text',     label:'Existing software', required:false, placeholder:'e.g. QuickBooks, Excel, None' },
      { id:'f6', type:'textarea', label:'Additional notes', required:false, placeholder:'Special requirements...' },
    ]
  },
  'Mobile App': {
    label: 'Mobile App Requirements',
    icon: '📱',
    fields: [
      { id:'f1', type:'radio',    label:'Target platform', required:true, options:['Android only','iOS only','Both'] },
      { id:'f2', type:'select',   label:'App type', required:true, options:['Customer app (B2C)','Business tool (B2B)','Internal staff tool','E-Commerce','Booking','Other'] },
      { id:'f3', type:'checkbox', label:'Key features', required:true, options:['Login/Registration','Product Catalog','Cart & Checkout','Payments','Push Notifications','Maps','Chat','Barcode','Camera/Upload','Offline Mode'] },
      { id:'f4', type:'radio',    label:'Backend needed?', required:true, options:['Yes — full backend','Use existing API','Not sure'] },
      { id:'f5', type:'textarea', label:'Reference apps', required:false, placeholder:'App names or URLs you like...' },
    ]
  },
  'Accounting': {
    label: 'Accounting & Tax Requirements',
    icon: '📊',
    fields: [
      { id:'f1', type:'select',   label:'Business registration', required:true, options:['Private Limited','Sole Trader','Partnership','NGO','Other'] },
      { id:'f2', type:'checkbox', label:'Services needed', required:true, options:['Monthly Bookkeeping','VAT Returns','CIT Tax','APIT/WHT','SSCL Filing','Financial Statements','Payroll','Company Secretarial'] },
      { id:'f3', type:'select',   label:'Current software', required:false, options:['Excel/Manual','QuickBooks','Xero','Sage','Wave','None','Other'] },
      { id:'f4', type:'radio',    label:'Reporting frequency', required:true, options:['Monthly','Quarterly','Annually','As needed'] },
      { id:'f5', type:'textarea', label:'Additional notes', required:false, placeholder:'Specific compliance issues...' },
    ]
  },
  'Bank Statement': {
    label: 'Bank Statement Analysis',
    icon: '🏦',
    fields: [
      { id:'f1', type:'select',   label:'Bank name', required:true, options:['Bank of Ceylon','Commercial Bank','HNB','Sampath Bank','Seylan Bank','NTB','DFCC','Other'] },
      { id:'f2', type:'radio',    label:'Account type', required:true, options:['Current Account','Savings Account','Both'] },
      { id:'f3', type:'text',     label:'Analysis period', required:true, placeholder:'e.g. Jan 2024 – Dec 2024' },
      { id:'f4', type:'select',   label:'Purpose', required:true, options:['Loan Application','Business Review','Tax Compliance','Investment','Legal','Other'] },
      { id:'f5', type:'radio',    label:'Number of months', required:true, options:['1–3 months','4–6 months','7–12 months','More than 1 year'] },
      { id:'f6', type:'file',     label:'Upload Bank Statements', required:true, fileAccept:'pdf_image', multiple:true, placeholder:'Upload PDF or scanned images of your bank statements' },
      { id:'f7', type:'radio',    label:'Preferred output format', required:true, options:['Excel Report','PDF Summary','Both'] },
      { id:'f8', type:'textarea', label:'Specific analysis needed', required:false, placeholder:'What insights do you need?' },
    ]
  },
};
const findFormTpl = (name) => TEMPLATES[name] || Object.values(TEMPLATES).find(t => t.label === name);

const DEV_SENT_FORMS = [
  { id:'F001', clientId:'C001', clientName:'John Perera',    formType:'Website',      status:'filled',   sentAt:'Oct 1, 2026',  filledAt:'Oct 2, 2026', isCustom:false },
  { id:'F002', clientId:'C002', clientName:'Sarah Fernando', formType:'ERP/POS',       status:'sent',     sentAt:'Oct 3, 2026',  filledAt:null,          isCustom:false },
  { id:'F003', clientId:'C004', clientName:'Priya Nair',     formType:'Bank Statement',status:'reviewed', sentAt:'Sep 25, 2026', filledAt:'Sep 26, 2026',isCustom:false },
];

const DEV_CUSTOM_FORMS = [
  { id:'CF1', kind:'custom', name:'Interior Design Brief', createdAt:'Sep 28, 2026', isCustom:true, fields:[
    { id:'cf1', type:'text',   label:'Property type', required:true, placeholder:'e.g. Apartment / House', options:[] },
    { id:'cf2', type:'radio',  label:'Preferred style', required:true, options:['Modern','Minimal','Traditional'] },
  ]},
];

const DEV_FILLED = {
  F001: { f1:['Home','About','Services','Contact'], f2:'Corporate', f3:'https://notion.so', f4:'Partially ready', f5:['Contact Form','WhatsApp Chat'], f6:'6 weeks', f7:'Match brand colors (navy + gold).' },
  F003: { f1:'HNB', f2:'Current Account', f3:'Jan 2024 – Dec 2024', f4:'Loan Application', f5:'12 months', f6:'[Bank Statement PDF uploaded]', f7:'Excel Report', f8:'Need monthly cash flow breakdown.' },
};

const DEV_REQS = [
  { id:'RQ1', clientId:'C001', clientName:'John Perera', clientCompany:'Perera Holdings',
    serviceName:'Website Development', status:'Collecting',
    receivedCount:2, totalCount:4,
    checklist:[
      { id:'c1', label:'Client & company details (name, address, contacts)', received:true },
      { id:'c2', label:'Logo file (vector/AI or high-res PNG preferred)',     received:true },
      { id:'c3', label:'Website content — text for each page',                received:false },
      { id:'c4', label:'Images / photos / brand media',                       received:false },
    ],
    createdAt:'Oct 5, 2026' },
];

// Seed fallback for the requirement-template picker (live mode uses the
// 'requirementTemplates' collection once it has docs).
const SEED_REQ_TPLS = REQUIREMENT_TEMPLATE_SEEDS.map(s => ({ id: seedId(s.serviceCode), ...s }));

// ── Small shared UI bits ──────────────────────────────────────────
const Spinner = () => (
  <div style={{display:'flex',justifyContent:'center',padding:'36px 0'}}>
    <div style={{width:26,height:26,borderRadius:'50%',border:`3px solid ${C.border}`,borderTopColor:C.blue,animation:'reqspin 0.8s linear infinite'}}/>
    <style>{`@keyframes reqspin{to{transform:rotate(360deg)}}`}</style>
  </div>
);
const ErrorBanner = ({ msg }) => (
  <div style={{padding:'10px 14px',borderRadius:10,background:'rgba(240,90,103,0.1)',border:'1px solid rgba(240,90,103,0.45)',color:C.red,fontSize:12,fontWeight:600}}>
    ⚠ {msg}
  </div>
);

// ── Unique ID helper ──────────────────────────────────────────────
const uid = () => `f${Date.now()}_${Math.random().toString(36).slice(2,6)}`;

export default function ERPRequirements() {
  const { isDevSession } = useAuth();
  const live = isFirebaseConfigured && !isDevSession;
  const navigate = useNavigate();

  const [view,        setView]        = useState('reqs');   // 'reqs' | 'list' | 'builder' | 'templates'

  // Data (live → hydrated from Firestore; dev → fixtures below)
  const [clients,     setClients]     = useState(live ? [] : DEV_CLIENTS);
  const [sentForms,   setSentForms]   = useState(live ? [] : DEV_SENT_FORMS);
  const [savedForms,  setSavedForms]  = useState(live ? [] : DEV_CUSTOM_FORMS);
  const [reqs,        setReqs]        = useState(live ? [] : DEV_REQS);
  const [reqTpls,     setReqTpls]     = useState(SEED_REQ_TPLS);

  const [formsLoaded, setFormsLoaded] = useState(!live);
  const [reqsLoaded,  setReqsLoaded]  = useState(!live);
  const [formsError,  setFormsError]  = useState(null);
  const [reqsError,   setReqsError]   = useState(null);

  // Requirement checklist state
  const [showNewReq,  setShowNewReq]  = useState(false);
  const [reqClientId, setReqClientId] = useState('');
  const [reqTplId,    setReqTplId]    = useState('');
  const [creatingReq, setCreatingReq] = useState(false);
  const [delReq,      setDelReq]      = useState(null);

  // Sent / custom forms state
  const [showFilled,  setShowFilled]  = useState(null);
  const [showSend,    setShowSend]    = useState(null);     // form/template to send
  const [sendClient,  setSendClient]  = useState('');
  const [sending,     setSending]     = useState(false);
  const [sentDone,    setSentDone]    = useState(false);
  const [delForm,     setDelForm]     = useState(null);     // custom form pending delete

  // Form builder state
  const [formName,    setFormName]    = useState('');
  const [formFields,  setFormFields]  = useState([
    { id:uid(), type:'text',    label:'',   required:false, placeholder:'', options:[], fileAccept:'any', multiple:false },
  ]);
  const [editForm,    setEditForm]    = useState(null);     // custom form being edited

  // ── Firestore listeners (live only) ──────────────────────────────
  useEffect(() => {
    if (!live) return;
    const unsubs = [];

    // Requirement forms — one collection, split by kind ('sent' | 'custom').
    unsubs.push(onSnapshot(collection(db, 'requirementForms'), snap => {
      const rows = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      setSentForms(rows.filter(r => r.kind !== 'custom').sort((a,b) => toMs(b.createdAt) - toMs(a.createdAt)));
      setSavedForms(rows.filter(r => r.kind === 'custom'));
      setFormsLoaded(true); setFormsError(null);
    }, e => { setFormsError(e.message || 'Failed to load forms'); setFormsLoaded(true); }));

    // Client requirements (checklists copied from templates)
    unsubs.push(onSnapshot(collection(db, 'requirements'), snap => {
      const rows = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      setReqs(rows.sort((a,b) => toMs(b.createdAt) - toMs(a.createdAt)));
      setReqsLoaded(true); setReqsError(null);
    }, e => { setReqsError(e.message || 'Failed to load requirements'); setReqsLoaded(true); }));

    // Clients (replaces the old hardcoded list)
    unsubs.push(onSnapshot(collection(db, 'clients'), snap => {
      setClients(snap.docs.map(d => ({ id:d.id, ...d.data() }))
        .sort((a,b) => String(a.name||'').localeCompare(String(b.name||''))));
    }, () => {}));

    // Requirement templates — fall back to seeds until docs exist
    unsubs.push(onSnapshot(collection(db, 'requirementTemplates'), snap => {
      const rows = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      if (rows.length) setReqTpls(rows);
    }, () => {}));

    return () => unsubs.forEach(u => u());
  }, [live]);

  // ── Requirement checklist handlers ───────────────────────────────
  const openNewReq = () => { setReqClientId(''); setReqTplId(''); setShowNewReq(true); };

  const handleCreateReq = async () => {
    const client = clients.find(c => c.id === reqClientId);
    const tpl    = reqTpls.find(t => t.id === reqTplId);
    if (!client || !tpl) return;
    setCreatingReq(true);
    // COPY the template checklist into this record — later template edits
    // never change records already created.
    const checklist = (tpl.checklist || [])
      .map(it => (typeof it === 'string' ? it : (it.label ?? String(it))))
      .filter(Boolean)
      .map(label => ({ id: uid(), label, received: false }));
    const base = {
      clientId:      client.id,
      clientName:    client.name || '',
      clientCompany: client.company || '',
      serviceName:   tpl.serviceName || tpl.name || 'Service',
      templateId:    tpl.id,
      checklist,
      receivedCount: 0,
      totalCount:    checklist.length,
      status:        'Collecting',
    };
    if (live) {
      try { await addDoc(collection(db, 'requirements'), { ...base, createdAt: serverTimestamp() }); }
      catch (e) { setReqsError(e.message || 'Failed to create requirement'); }
    } else {
      setReqs(p => [{ id:`RQ${Date.now()}`, ...base, createdAt:new Date().toISOString() }, ...p]);
    }
    setCreatingReq(false);
    setShowNewReq(false);
    setView('reqs');
  };

  const handleToggleItem = async (req, idx) => {
    const checklist = (req.checklist || []).map((it, i) => i === idx ? { ...it, received: !it.received } : it);
    const receivedCount = checklist.filter(i => i.received).length;
    const patch = {
      checklist,
      receivedCount,
      totalCount:   checklist.length,
      status:       checklist.length > 0 && receivedCount >= checklist.length ? 'Complete' : 'Collecting',
    };
    setReqs(p => p.map(r => r.id === req.id ? { ...r, ...patch } : r));
    if (live) {
      try { await updateDoc(doc(db, 'requirements', req.id), patch); }
      catch (e) { setReqsError(e.message || 'Failed to update checklist'); }
    }
  };

  const handleDeleteReq = async (req) => {
    if (live) {
      try { await deleteDoc(doc(db, 'requirements', req.id)); }
      catch (e) { setReqsError(e.message || 'Failed to delete requirement'); }
    } else {
      setReqs(p => p.filter(r => r.id !== req.id));
    }
    setDelReq(null);
  };

  // ── Field helpers ────────────────────────────────────────────────
  const addField = () => setFormFields(p => [...p, { id:uid(), type:'text', label:'', required:false, placeholder:'', options:[], fileAccept:'any', multiple:false }]);

  const removeField = (idx) => setFormFields(p => p.filter((_,i)=>i!==idx));

  const updateField = (idx, key, val) => setFormFields(p => p.map((f,i)=>i===idx?{...f,[key]:val}:f));

  const moveField = (idx, dir) => {
    const arr = [...formFields];
    const to  = idx + dir;
    if (to < 0 || to >= arr.length) return;
    [arr[idx], arr[to]] = [arr[to], arr[idx]];
    setFormFields(arr);
  };

  const addOption = (fieldIdx) => {
    updateField(fieldIdx, 'options', [...(formFields[fieldIdx].options||[]), '']);
  };

  const updateOption = (fieldIdx, optIdx, val) => {
    const opts = [...(formFields[fieldIdx].options||[])];
    opts[optIdx] = val;
    updateField(fieldIdx, 'options', opts);
  };

  const removeOption = (fieldIdx, optIdx) => {
    const opts = (formFields[fieldIdx].options||[]).filter((_,i)=>i!==optIdx);
    updateField(fieldIdx, 'options', opts);
  };

  // ── Save custom form (persisted to 'requirementForms' kind:'custom') ──
  const handleSaveForm = async () => {
    if (!formName.trim() || formFields.some(f=>!f.label.trim())) return;
    const base = {
      kind:      'custom',
      name:      formName.trim(),
      fields:    formFields,
      createdAt: new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),
      isCustom:  true,
    };
    if (editForm) {
      if (live) {
        try { await updateDoc(doc(db,'requirementForms',editForm.id), base); }
        catch (e) { setFormsError(e.message || 'Failed to update form'); }
      } else {
        setSavedForms(p => p.map(f => f.id === editForm.id ? { ...f, ...base, id:f.id } : f));
      }
    } else {
      if (live) {
        try { await addDoc(collection(db,'requirementForms'), base); }
        catch (e) { setFormsError(e.message || 'Failed to save form'); }
      } else {
        setSavedForms(p => [...p, { ...base, id:`CF${Date.now()}` }]);
      }
    }
    setView('list');
    setFormName('');
    setFormFields([{ id:uid(), type:'text', label:'', required:false, placeholder:'', options:[], fileAccept:'any', multiple:false }]);
    setEditForm(null);
  };

  const handleEditForm = (form) => {
    setEditForm(form);
    setFormName(form.name);
    setFormFields(form.fields);
    setView('builder');
  };

  const handleDeleteForm = async (form) => {
    if (live) {
      try { await deleteDoc(doc(db,'requirementForms',form.id)); }
      catch (e) { setFormsError(e.message || 'Failed to delete form'); }
    } else {
      setSavedForms(p => p.filter(f => f.id !== form.id));
    }
    setDelForm(null);
  };

  // ── Send form to client ──────────────────────────────────────────
  // Fields are EMBEDDED into the sent doc: built-in templates live only in
  // this file, and the client portal must be able to render + submit the
  // form without ever reading the 'requirementTemplates' collection.
  const handleSend = async () => {
    if (!sendClient || !showSend) return;
    setSending(true);
    const client = clients.find(c => c.id === sendClient);
    const formTypeLabel = showSend.name || showSend.label || String(showSend);
    const fields = showSend.fields || findFormTpl(formTypeLabel)?.fields || [];
    const base = {
      kind:          'sent',
      clientId:      sendClient,
      clientName:    client?.name || '',
      clientCompany: client?.company || '',
      formType:      formTypeLabel,
      fields,                             // snapshot — copied like checklist templates
      status:        'sent',
      sentAt:        new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),
      filledAt:      null,
      isCustom:      !!showSend.isCustom,
    };
    if (live) {
      try { await addDoc(collection(db,'requirementForms'), { ...base, createdAt: serverTimestamp() }); }
      catch (e) { setFormsError(e.message || 'Failed to send form'); }
    } else {
      setSentForms(p => [{ id:`F${Date.now()}`, ...base }, ...p]);
    }
    setSending(false);
    setSentDone(true);
  };

  const handleMarkReviewed = async (form) => {
    setSentForms(p => p.map(f => f.id === form.id ? { ...f, status:'reviewed' } : f));
    if (live) {
      try { await updateDoc(doc(db,'requirementForms',form.id), { status:'reviewed', reviewedAt: serverTimestamp() }); }
      catch (e) { setFormsError(e.message || 'Failed to update form'); }
    }
  };

  // ── Load form template into builder ──────────────────────────────
  const loadTemplate = (key) => {
    const tpl = TEMPLATES[key];
    setFormName(tpl.label);
    setFormFields(tpl.fields.map(f=>({...f})));
    setView('builder');
  };

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>

      <style>{`@media (max-width:1100px){.req-split{grid-template-columns:1fr !important}.req-sticky{position:static !important}}`}</style>

      {/* Top bar */}
      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
        {/* View tabs */}
        {[
          {id:'reqs',      label:'Client Requirements'},
          {id:'list',      label:'Sent Forms'},
          {id:'templates', label:'Form Templates'},
          {id:'builder',   label:'Form Builder'},
        ].map(t=>(
          <button key={t.id} onClick={()=>setView(t.id)} style={{
            padding:'7px 16px',borderRadius:10,fontSize:12,fontWeight:700,cursor:'pointer',
            background:view===t.id?'linear-gradient(135deg,#0066FF,#1787FF)':'rgba(10,24,56,0.8)',
            color:view===t.id?'#fff':C.muted,
            border:view===t.id?'none':`1px solid ${C.border}`,
            boxShadow:view===t.id?'0 4px 14px rgba(0,102,255,0.35)':'none',
            transition:'all 0.15s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════
          CLIENT REQUIREMENTS (checklists copied from templates)
      ══════════════════════════════════════════════════════════ */}
      {view === 'reqs' && (
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <ERPPanel>
            <div style={{padding:'16px 20px',display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
              <div>
                <div style={{fontSize:14,fontWeight:800,color:C.text}}>Client Requirements</div>
                <div style={{fontSize:11,color:C.muted,marginTop:2}}>
                  Document checklists copied from each service's template — track every item as received or pending.
                </div>
              </div>
              <ERPBtn variant="primary" onClick={openNewReq}>
                <Plus size={13}/> New Requirement
              </ERPBtn>
            </div>
          </ERPPanel>

          {reqsError && <ErrorBanner msg={reqsError} />}

          {!reqsLoaded ? (
            <ERPPanel><Spinner/></ERPPanel>
          ) : reqs.length === 0 ? (
            <ERPPanel><ERPEmpty icon="📋" title="No client requirements yet" sub='Click "New Requirement" to copy a service checklist for a client.'/></ERPPanel>
          ) : reqs.map(req => {
            const checklist = req.checklist || [];
            const received  = req.receivedCount ?? checklist.filter(i=>i.received).length;
            const total     = req.totalCount || checklist.length;
            const pct       = total > 0 ? Math.round(received/total*100) : 0;
            const done      = total > 0 && received >= total;
            return (
              <ERPPanel key={req.id}>
                <div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:12}}>
                  {/* Header row */}
                  <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                    <ERPAvatar name={req.clientName||'?'} color={C.blue} size={38}/>
                    <div style={{flex:1,minWidth:180}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                        <span style={{fontSize:13,fontWeight:800,color:C.text}}>{req.clientName}</span>
                        <span style={{fontSize:11,color:C.muted}}>{req.clientCompany}</span>
                        <ERPBadge status={done?'Completed':'In Progress'} label={done?'Complete':'Collecting'}/>
                      </div>
                      <div style={{fontSize:11,color:C.muted,marginTop:3}}>
                        📄 {req.serviceName}
                        <span style={{marginLeft:12}}>Created {fmtMs(toMs(req.createdAt)) || '—'}</span>
                      </div>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <span style={{fontSize:12,fontWeight:800,color:done?C.green:C.amber}}>
                        {received}/{total} received
                      </span>
                      <ERPBtn size="sm" variant="danger" onClick={()=>setDelReq(req)} title="Delete requirement">
                        <Trash2 size={12}/>
                      </ERPBtn>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{height:6,borderRadius:6,background:'rgba(10,24,56,0.6)',overflow:'hidden'}}>
                    <div style={{
                      height:'100%',width:`${pct}%`,borderRadius:6,transition:'width 0.25s',
                      background:done?'linear-gradient(90deg,#18C77A,#2EE6A0)':'linear-gradient(90deg,#0066FF,#1787FF)',
                    }}/>
                  </div>

                  {/* Checklist items — tap to toggle received/pending */}
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:8}}>
                    {checklist.map((item,i)=>(
                      <button key={item.id||i} onClick={()=>handleToggleItem(req,i)}
                        title={item.received?'Mark as pending':'Mark as received'}
                        style={{
                          display:'flex',alignItems:'center',gap:9,padding:'9px 12px',borderRadius:10,
                          textAlign:'left',cursor:'pointer',transition:'all 0.15s',
                          background:item.received?'rgba(24,199,122,0.08)':'rgba(10,24,56,0.5)',
                          border:`1px solid ${item.received?'rgba(24,199,122,0.35)':`${C.border}30`}`,
                        }}>
                        {item.received ? (
                          <CheckCircle2 size={15} style={{color:C.green,flexShrink:0}}/>
                        ) : (
                          <span style={{width:15,height:15,borderRadius:'50%',border:`2px solid ${C.muted}`,flexShrink:0}}/>
                        )}
                        <span style={{
                          fontSize:12,fontWeight:item.received?700:500,
                          color:item.received?C.green:C.subtle,
                          textDecoration:item.received?'line-through':'none',
                        }}>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </ERPPanel>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          SENT FORMS LIST
      ══════════════════════════════════════════════════════════ */}
      {view === 'list' && (
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {formsError && <ErrorBanner msg={formsError} />}

          {/* Custom saved forms */}
          {savedForms.length > 0 && (
            <ERPPanel>
              <ERPPanelHeader title="My Custom Forms" icon="📝" />
              <div style={{padding:'8px 0'}}>
                {savedForms.map((form,i)=>(
                  <div key={form.id} style={{
                    display:'flex',alignItems:'center',gap:12,padding:'12px 18px',
                    borderTop:i>0?`1px solid ${C.border}25`:'none',
                  }}>
                    <div style={{width:36,height:36,borderRadius:10,background:'rgba(0,102,255,0.12)',border:`1px solid ${C.borderHi}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>📝</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:700,color:C.text}}>{form.name}</div>
                      <div style={{fontSize:10,color:C.muted}}>{(form.fields||[]).length} fields · Created {form.createdAt || fmtMs(toMs(form.createdAt))}</div>
                    </div>
                    <div style={{display:'flex',gap:8}}>
                      <ERPBtn size="sm" variant="primary" onClick={()=>{setShowSend(form);setSendClient('');setSentDone(false);}}>
                        <Send size={11}/> Send
                      </ERPBtn>
                      <ERPBtn size="sm" variant="secondary" onClick={()=>handleEditForm(form)}>Edit</ERPBtn>
                      <ERPBtn size="sm" variant="danger" onClick={()=>setDelForm(form)}>
                        <Trash2 size={11}/>
                      </ERPBtn>
                    </div>
                  </div>
                ))}
              </div>
            </ERPPanel>
          )}

          {/* Sent forms */}
          {!formsLoaded ? (
            <ERPPanel><Spinner/></ERPPanel>
          ) : sentForms.length === 0 ? (
            <ERPEmpty icon="📋" title="No forms sent yet" sub='Click "Form Templates" to pick a built-in form, or "Form Builder" to create a custom one.' />
          ) : sentForms.map(form=>{
            const isTemplate = !form.isCustom;
            const tpl  = isTemplate ? findFormTpl(form.formType) : null;
            return (
              <ERPPanel key={form.id}>
                <div style={{padding:'16px 20px',display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
                  <div style={{
                    width:44,height:44,borderRadius:12,flexShrink:0,
                    background:'rgba(0,102,255,0.1)',border:`1px solid ${C.borderHi}`,
                    display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,
                  }}>{tpl?.icon||'📝'}</div>
                  <div style={{flex:1,minWidth:200}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                      <span style={{fontSize:13,fontWeight:800,color:C.text}}>{tpl?.label||form.formType}</span>
                      <ERPBadge
                        status={form.status==='filled'?'quotation_accepted':form.status==='reviewed'?'Completed':'quotation_sent'}
                        label={form.status==='filled'?'Filled':form.status==='reviewed'?'Reviewed':'Sent'}
                      />
                      {form.isCustom && <span style={{fontSize:10,background:'rgba(139,92,246,0.12)',color:'#8B5CF6',border:'1px solid rgba(139,92,246,0.3)',padding:'1px 8px',borderRadius:20,fontWeight:700}}>Custom</span>}
                    </div>
                    <div style={{fontSize:11,color:C.muted,marginTop:3}}>
                      Client: <strong style={{color:C.subtle}}>{form.clientName}</strong>
                      <span style={{marginLeft:16}}>Sent: {form.sentAt || fmtMs(toMs(form.createdAt))}</span>
                      {form.filledAt&&<span style={{marginLeft:16,color:C.green}}>Filled: {form.filledAt}</span>}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:8,flexShrink:0,flexWrap:'wrap'}}>
                    {(form.status==='filled'||form.status==='reviewed') && (
                      <ERPBtn size="sm" variant="secondary" onClick={()=>setShowFilled(form)}>
                        <Eye size={12}/> View Response
                      </ERPBtn>
                    )}
                    {form.status==='filled' && (
                      <ERPBtn size="sm" variant="success" onClick={()=>handleMarkReviewed(form)}>
                        <CheckCircle2 size={12}/> Reviewed
                      </ERPBtn>
                    )}
                    {form.status==='sent' && (
                      <span style={{fontSize:11,color:C.amber,display:'flex',alignItems:'center',gap:4}}>
                        <span style={{width:6,height:6,borderRadius:'50%',background:C.amber,display:'inline-block'}}/>
                        Awaiting client
                      </span>
                    )}
                  </div>
                </div>
              </ERPPanel>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          FORM TEMPLATES (question-form templates)
      ══════════════════════════════════════════════════════════ */}
      {view === 'templates' && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:14}}>
          {Object.entries(TEMPLATES).map(([key,tpl])=>(
            <div key={key} style={{
              background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,
              padding:20,backdropFilter:'blur(12px)',position:'relative',overflow:'hidden',
              transition:'all 0.2s',cursor:'pointer',
            }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=C.borderHi;e.currentTarget.style.transform='translateY(-3px)';}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.transform='translateY(0)';}}>
              <div style={{position:'absolute',top:0,left:0,right:0,height:1,background:'linear-gradient(90deg,transparent,rgba(0,102,255,0.4),transparent)'}}/>
              <div style={{fontSize:28,marginBottom:10}}>{tpl.icon}</div>
              <div style={{fontSize:14,fontWeight:800,color:C.text,marginBottom:4}}>{tpl.label}</div>
              <div style={{fontSize:11,color:C.muted,marginBottom:14}}>{tpl.fields.length} questions · Includes {tpl.fields.filter(f=>f.type==='file').length > 0 ? 'file upload' : 'text & choice fields'}</div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                <ERPBtn size="sm" variant="primary" onClick={()=>{setShowSend({...tpl,name:tpl.label});setSendClient('');setSentDone(false);}}>
                  <Send size={11}/> Send to Client
                </ERPBtn>
                <ERPBtn size="sm" variant="secondary" onClick={()=>loadTemplate(key)}>
                  Customize
                </ERPBtn>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          FORM BUILDER
      ══════════════════════════════════════════════════════════ */}
      {view === 'builder' && (
        <div className="req-split" style={{display:'grid',gridTemplateColumns:'1fr 340px',gap:16,alignItems:'start'}}>

          {/* Builder canvas */}
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {/* Form name */}
            <ERPPanel>
              <div style={{padding:'14px 18px'}}>
                <ERPInput
                  label="Form Name"
                  value={formName}
                  onChange={e=>setFormName(e.target.value)}
                  placeholder="e.g. Website Requirement Form"
                  required
                />
              </div>
            </ERPPanel>

            {/* Fields */}
            {formFields.map((field, idx)=>(
              <ERPPanel key={field.id}>
                <div style={{padding:'14px 18px',display:'flex',flexDirection:'column',gap:12}}>
                  {/* Field header */}
                  <div style={{display:'flex',gap:8,alignItems:'flex-start'}}>
                    {/* Move up/down */}
                    <div style={{display:'flex',flexDirection:'column',gap:2,paddingTop:2}}>
                      <button onClick={()=>moveField(idx,-1)} disabled={idx===0}
                        style={{background:'none',border:'none',cursor:idx===0?'default':'pointer',color:idx===0?C.border:C.muted,padding:'2px 4px'}}>
                        <ChevronUp size={12}/>
                      </button>
                      <button onClick={()=>moveField(idx,1)} disabled={idx===formFields.length-1}
                        style={{background:'none',border:'none',cursor:idx===formFields.length-1?'default':'pointer',color:idx===formFields.length-1?C.border:C.muted,padding:'2px 4px'}}>
                        <ChevronDown size={12}/>
                      </button>
                    </div>

                    <div style={{flex:1,display:'flex',flexDirection:'column',gap:10}}>
                      {/* Row 1: Type + Label */}
                      <div style={{display:'grid',gridTemplateColumns:'180px 1fr',gap:10}}>
                        {/* Field type selector */}
                        <div>
                          <label style={{display:'block',fontSize:10,fontWeight:600,color:C.muted,marginBottom:5,textTransform:'uppercase',letterSpacing:'0.6px'}}>Field Type</label>
                          <select value={field.type} onChange={e=>updateField(idx,'type',e.target.value)}
                            style={{width:'100%',background:'rgba(10,24,56,0.8)',border:`1px solid ${C.border}`,borderRadius:9,padding:'8px 10px',color:C.text,fontSize:12,outline:'none',appearance:'none',cursor:'pointer'}}>
                            {FIELD_TYPES.map(ft=>(
                              <option key={ft.value} value={ft.value} style={{background:'#0A1838'}}>{ft.label}</option>
                            ))}
                          </select>
                        </div>
                        {/* Label */}
                        <ERPInput
                          label="Question / Label"
                          value={field.label}
                          onChange={e=>updateField(idx,'label',e.target.value)}
                          placeholder="e.g. What pages do you need?"
                          required
                        />
                      </div>

                      {/* Row 2: Placeholder + Required */}
                      {(field.type==='text'||field.type==='textarea'||field.type==='number') && (
                        <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:10,alignItems:'flex-end'}}>
                          <ERPInput
                            label="Placeholder text"
                            value={field.placeholder||''}
                            onChange={e=>updateField(idx,'placeholder',e.target.value)}
                            placeholder="e.g. Enter your answer here..."
                          />
                          <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',paddingBottom:2,whiteSpace:'nowrap'}}>
                            <input type="checkbox" checked={field.required} onChange={e=>updateField(idx,'required',e.target.checked)}
                              style={{accentColor:C.blue,width:14,height:14}}/>
                            <span style={{fontSize:11,color:C.muted,fontWeight:600}}>Required</span>
                          </label>
                        </div>
                      )}

                      {/* File upload config */}
                      {field.type === 'file' && (
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:10,alignItems:'flex-end'}}>
                          <div>
                            <label style={{display:'block',fontSize:10,fontWeight:600,color:C.muted,marginBottom:5,textTransform:'uppercase',letterSpacing:'0.6px'}}>Accepted files</label>
                            <select value={field.fileAccept||'any'} onChange={e=>updateField(idx,'fileAccept',e.target.value)}
                              style={{width:'100%',background:'rgba(10,24,56,0.8)',border:`1px solid ${C.border}`,borderRadius:9,padding:'8px 10px',color:C.text,fontSize:12,outline:'none',appearance:'none'}}>
                              {Object.entries(FILE_ACCEPTS).map(([k,v])=>(
                                <option key={k} value={k} style={{background:'#0A1838'}}>{v}</option>
                              ))}
                            </select>
                          </div>
                          <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',paddingBottom:2}}>
                            <input type="checkbox" checked={!!field.multiple} onChange={e=>updateField(idx,'multiple',e.target.checked)}
                              style={{accentColor:C.blue,width:14,height:14}}/>
                            <span style={{fontSize:11,color:C.muted,fontWeight:600}}>Multiple files</span>
                          </label>
                          <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',paddingBottom:2}}>
                            <input type="checkbox" checked={field.required} onChange={e=>updateField(idx,'required',e.target.checked)}
                              style={{accentColor:C.blue,width:14,height:14}}/>
                            <span style={{fontSize:11,color:C.muted,fontWeight:600}}>Required</span>
                          </label>
                        </div>
                      )}

                      {/* Help text for file field */}
                      {field.type === 'file' && (
                        <ERPInput
                          label="Help text (shown to client)"
                          value={field.placeholder||''}
                          onChange={e=>updateField(idx,'placeholder',e.target.value)}
                          placeholder="e.g. Upload your bank statements in PDF or image format"
                        />
                      )}

                      {/* Options (for select/radio/checkbox) */}
                      {(field.type==='select'||field.type==='radio'||field.type==='checkbox') && (
                        <div>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                            <label style={{fontSize:10,fontWeight:600,color:C.muted,textTransform:'uppercase',letterSpacing:'0.6px'}}>Options</label>
                            <div style={{display:'flex',gap:8}}>
                              <label style={{display:'flex',alignItems:'center',gap:4,cursor:'pointer'}}>
                                <input type="checkbox" checked={field.required} onChange={e=>updateField(idx,'required',e.target.checked)}
                                  style={{accentColor:C.blue,width:12,height:12}}/>
                                <span style={{fontSize:10,color:C.muted,fontWeight:600}}>Required</span>
                              </label>
                              <button onClick={()=>addOption(idx)} style={{background:'none',border:'none',cursor:'pointer',color:C.cyan,fontSize:11,fontWeight:700,display:'flex',alignItems:'center',gap:3}}>
                                <Plus size={11}/> Add option
                              </button>
                            </div>
                          </div>
                          <div style={{display:'flex',flexDirection:'column',gap:5}}>
                            {(field.options||[]).map((opt,oi)=>(
                              <div key={oi} style={{display:'flex',gap:6,alignItems:'center'}}>
                                <input value={opt} onChange={e=>updateOption(idx,oi,e.target.value)}
                                  placeholder={`Option ${oi+1}`}
                                  style={{flex:1,background:'rgba(10,24,56,0.6)',border:`1px solid ${C.border}30`,borderRadius:8,padding:'6px 10px',color:C.text,fontSize:12,outline:'none'}}
                                  onFocus={e=>e.target.style.borderColor='rgba(0,102,255,0.4)'}
                                  onBlur={e=>e.target.style.borderColor=`${C.border}30`}/>
                                <button onClick={()=>removeOption(idx,oi)}
                                  style={{background:'none',border:'none',cursor:'pointer',color:C.red,padding:'4px'}}>
                                  <Trash2 size={12}/>
                                </button>
                              </div>
                            ))}
                            {(field.options||[]).length === 0 && (
                              <div style={{fontSize:11,color:C.muted,fontStyle:'italic',padding:'4px 0'}}>No options yet — click "Add option" above</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Remove field */}
                    <button onClick={()=>removeField(idx)} disabled={formFields.length===1}
                      style={{background:'none',border:'none',cursor:formFields.length===1?'default':'pointer',color:formFields.length===1?C.border:C.red,padding:'4px',marginTop:18}}>
                      <Trash2 size={15}/>
                    </button>
                  </div>
                </div>
              </ERPPanel>
            ))}

            {/* Add field + Save */}
            <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
              <ERPBtn variant="secondary" onClick={addField} style={{flex:1,justifyContent:'center'}}>
                <Plus size={13}/> Add Field
              </ERPBtn>
              <ERPBtn variant="primary" onClick={handleSaveForm}
                disabled={!formName.trim()||formFields.some(f=>!f.label.trim())}
                style={{flex:1,justifyContent:'center'}}>
                {editForm ? '💾 Update Form' : '💾 Save Form'}
              </ERPBtn>
            </div>
          </div>

          {/* Preview panel */}
          <ERPPanel className="req-sticky" style={{position:'sticky',top:0}}>
            <ERPPanelHeader title="Preview" icon="👁️" />
            <div style={{padding:16,maxHeight:600,overflowY:'auto'}}>
              <div style={{fontSize:11,color:C.muted,marginBottom:12}}>Client will see this form:</div>
              <div style={{fontSize:14,fontWeight:800,color:C.text,marginBottom:14}}>{formName||'Untitled Form'}</div>
              {formFields.map((field,i)=>(
                <div key={field.id} style={{marginBottom:14}}>
                  <div style={{fontSize:11,fontWeight:600,color:C.subtle,marginBottom:5}}>
                    {i+1}. {field.label||'Untitled field'}
                    {field.required&&<span style={{color:C.red,marginLeft:3}}>*</span>}
                  </div>
                  {(field.type==='text'||field.type==='number') && (
                    <div style={{padding:'7px 12px',borderRadius:8,background:'rgba(10,24,56,0.5)',border:`1px solid ${C.border}25`,fontSize:11,color:C.muted}}>{field.placeholder||'Text input'}</div>
                  )}
                  {field.type==='textarea' && (
                    <div style={{padding:'7px 12px',borderRadius:8,background:'rgba(10,24,56,0.5)',border:`1px solid ${C.border}25`,fontSize:11,color:C.muted,minHeight:36}}>{field.placeholder||'Long text'}</div>
                  )}
                  {field.type==='select' && (
                    <div style={{padding:'7px 12px',borderRadius:8,background:'rgba(10,24,56,0.5)',border:`1px solid ${C.border}25`,fontSize:11,color:C.muted}}>{(field.options||[])[0]||'Select option'} ▾</div>
                  )}
                  {(field.type==='radio'||field.type==='checkbox') && (
                    <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                      {(field.options||[]).slice(0,3).map((o,oi)=>(
                        <div key={oi} style={{padding:'3px 9px',borderRadius:7,background:'rgba(10,24,56,0.5)',border:`1px solid ${C.border}25`,fontSize:10,color:C.muted}}>
                          {field.type==='radio'?'◯':'☐'} {o||`Option ${oi+1}`}
                        </div>
                      ))}
                      {(field.options||[]).length>3&&<div style={{fontSize:10,color:C.muted,display:'flex',alignItems:'center'}}>+{field.options.length-3}</div>}
                      {(field.options||[]).length===0&&<div style={{fontSize:10,color:C.muted,fontStyle:'italic'}}>No options added</div>}
                    </div>
                  )}
                  {field.type==='file' && (
                    <div style={{padding:'10px 12px',borderRadius:8,background:'rgba(0,102,255,0.06)',border:`1px dashed ${C.borderHi}`,fontSize:11,color:C.cyan,display:'flex',gap:8,alignItems:'center'}}>
                      <Upload size={13}/>
                      <div>
                        <div style={{fontWeight:600}}>{FILE_ACCEPTS[field.fileAccept||'any']}</div>
                        {field.placeholder&&<div style={{fontSize:10,color:C.muted,marginTop:2}}>{field.placeholder}</div>}
                        {field.multiple&&<div style={{fontSize:10,color:C.cyan,marginTop:1}}>Multiple files allowed</div>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ERPPanel>
        </div>
      )}

      {/* ── NEW CLIENT REQUIREMENT MODAL ── */}
      <ERPModal isOpen={showNewReq} onClose={()=>setShowNewReq(false)} title="New Client Requirement" width={460}>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <ERPSelect label="Client" value={reqClientId} onChange={e=>setReqClientId(e.target.value)}
            placeholder="Select client..." required
            options={clients.map(c=>({value:c.id,label:`${c.name}${c.company?` — ${c.company}`:''}`}))} />
          <ERPSelect label="Service / Requirement Template" value={reqTplId} onChange={e=>setReqTplId(e.target.value)}
            placeholder="Select service template..." required
            options={reqTpls.map(t=>({value:t.id,label:t.serviceName||t.name||t.id}))} />
          {reqTpls.find(t=>t.id===reqTplId) && (() => {
            const tpl = reqTpls.find(t=>t.id===reqTplId);
            const items = (tpl.checklist||[]).map(c => typeof c==='string' ? c : (c.label??'')).filter(Boolean);
            return (
              <div style={{padding:'10px 14px',borderRadius:10,background:'rgba(10,24,56,0.6)',border:`1px solid ${C.border}40`}}>
                <div style={{fontSize:11,fontWeight:700,color:C.subtle,marginBottom:6}}>📋 Document checklist ({items.length} items)</div>
                {items.slice(0,4).map((c,i)=>(
                  <div key={i} style={{fontSize:11,color:C.muted,padding:'2px 0'}}>• {c}</div>
                ))}
                {items.length>4 && <div style={{fontSize:10,color:C.muted,fontStyle:'italic',marginTop:3}}>+ {items.length-4} more…</div>}
              </div>
            );
          })()}
          <div style={{fontSize:11,color:C.cyan,background:'rgba(0,102,255,0.06)',border:`1px solid ${C.borderHi}`,borderRadius:10,padding:'9px 12px'}}>
            ℹ️ The checklist is <strong>copied</strong> into this requirement — later edits to the template will not change this record.
          </div>
          <div style={{display:'flex',gap:10}}>
            <ERPBtn variant="secondary" onClick={()=>setShowNewReq(false)} style={{flex:1,justifyContent:'center'}}>Cancel</ERPBtn>
            <ERPBtn variant="primary" disabled={!reqClientId||!reqTplId||creatingReq} onClick={handleCreateReq} style={{flex:1,justifyContent:'center'}}>
              {creatingReq?'Creating…':'Create Requirement'}
            </ERPBtn>
          </div>
        </div>
      </ERPModal>

      {/* ── DELETE CONFIRMATION — requirement ── */}
      <ERPModal isOpen={!!delReq} onClose={()=>setDelReq(null)} title="Delete Requirement?" width={400}>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div style={{fontSize:12,color:C.subtle,lineHeight:1.6}}>
            Delete the <strong style={{color:C.text}}>{delReq?.serviceName}</strong> requirement checklist for{' '}
            <strong style={{color:C.text}}>{delReq?.clientName}</strong>?
            {delReq?.receivedCount>0 && (
              <span style={{display:'block',marginTop:8,color:C.amber}}>
                {delReq.receivedCount} item(s) are already marked received. This cannot be undone.
              </span>
            )}
          </div>
          <div style={{display:'flex',gap:10}}>
            <ERPBtn variant="secondary" onClick={()=>setDelReq(null)} style={{flex:1,justifyContent:'center'}}>Cancel</ERPBtn>
            <ERPBtn variant="danger" onClick={()=>handleDeleteReq(delReq)} style={{flex:1,justifyContent:'center'}}>Delete</ERPBtn>
          </div>
        </div>
      </ERPModal>

      {/* ── DELETE CONFIRMATION — custom form ── */}
      <ERPModal isOpen={!!delForm} onClose={()=>setDelForm(null)} title="Delete Custom Form?" width={400}>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div style={{fontSize:12,color:C.subtle,lineHeight:1.6}}>
            Delete the custom form <strong style={{color:C.text}}>{delForm?.name}</strong>? This cannot be undone.
          </div>
          <div style={{display:'flex',gap:10}}>
            <ERPBtn variant="secondary" onClick={()=>setDelForm(null)} style={{flex:1,justifyContent:'center'}}>Cancel</ERPBtn>
            <ERPBtn variant="danger" onClick={()=>handleDeleteForm(delForm)} style={{flex:1,justifyContent:'center'}}>Delete</ERPBtn>
          </div>
        </div>
      </ERPModal>

      {/* ── SEND FORM MODAL ── */}
      <ERPModal isOpen={!!showSend&&!sentDone} onClose={()=>{setShowSend(null);setSendClient('');}} title="Send Form to Client" width={420}>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div style={{display:'flex',gap:12,padding:'12px 14px',borderRadius:10,background:'rgba(0,102,255,0.08)',border:`1px solid ${C.borderHi}`,alignItems:'center'}}>
            <span style={{fontSize:22}}>{showSend?.icon||findFormTpl(showSend?.name||'')?.icon||'📝'}</span>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:C.text}}>{showSend?.name||showSend?.label}</div>
              <div style={{fontSize:11,color:C.muted}}>{showSend?.fields?.length||'?'} questions</div>
            </div>
          </div>
          <ERPSelect label="Send to Client" value={sendClient} onChange={e=>setSendClient(e.target.value)}
            placeholder="Select client..." required
            options={clients.map(c=>({value:c.id,label:`${c.name}${c.company?` — ${c.company}`:''}`}))} />
          <div style={{display:'flex',gap:10}}>
            <ERPBtn variant="secondary" onClick={()=>setShowSend(null)} style={{flex:1,justifyContent:'center'}}>Cancel</ERPBtn>
            <ERPBtn variant="primary" disabled={!sendClient||sending} onClick={handleSend} style={{flex:1,justifyContent:'center'}}>
              {sending?'Sending...': <><Send size={13}/> Send Form</>}
            </ERPBtn>
          </div>
        </div>
      </ERPModal>

      {/* Sent success */}
      <ERPModal isOpen={sentDone} onClose={()=>{setShowSend(null);setSentDone(false);setSendClient('');}} title="" width={380}>
        <div style={{textAlign:'center',padding:'16px 0',display:'flex',flexDirection:'column',gap:14,alignItems:'center'}}>
          <div style={{fontSize:40}}>✅</div>
          <div>
            <div style={{fontSize:16,fontWeight:800,color:C.text}}>Form Sent!</div>
            <div style={{fontSize:12,color:C.muted,marginTop:4}}>Client will see the form in their dashboard.</div>
          </div>
          <ERPBtn variant="primary" onClick={()=>{setShowSend(null);setSentDone(false);setSendClient('');setView('list');}} style={{justifyContent:'center'}}>
            Done → View Sent Forms
          </ERPBtn>
        </div>
      </ERPModal>

      {/* ── VIEW FILLED RESPONSE MODAL ── */}
      <ERPModal isOpen={!!showFilled} onClose={()=>setShowFilled(null)} title={`Response — ${showFilled?.clientName}`} width={540}>
        {showFilled && (()=>{
          // Prefer the field snapshot embedded at send time; fall back to the
          // built-in template lookup for older docs sent before embedding.
          const fields = (showFilled.fields && showFilled.fields.length)
            ? showFilled.fields
            : (findFormTpl(showFilled.formType)?.fields || []);
          const filled = showFilled.answers || DEV_FILLED[showFilled.id] || {};
          if (!fields.length) return <div style={{color:C.muted,fontSize:12,padding:8}}>No field definitions stored for this form.</div>;
          // File answers may be {name,url}, an array of them, or a plain
          // string (legacy/dev). Normalise to a displayable list.
          const fileList = (v) => {
            const arr = Array.isArray(v) ? v : [v];
            return arr.filter(Boolean).map(f =>
              typeof f === 'string' ? { name:f, url:null } : { name:f?.name||'File', url:f?.url||null });
          };
          return (
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div style={{display:'flex',gap:10,alignItems:'center',padding:'10px 14px',borderRadius:10,background:'rgba(0,102,255,0.08)',border:`1px solid ${C.borderHi}`}}>
                <span style={{fontSize:22}}>{findFormTpl(showFilled.formType)?.icon || '📝'}</span>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:C.text}}>{showFilled.formType}</div>
                  <div style={{fontSize:11,color:C.muted}}>Filled by {showFilled.clientName} on {showFilled.filledAt}</div>
                </div>
                <ERPBadge status="Completed" label="Filled" />
              </div>
              {fields.map(field=>{
                const val = filled[field.id];
                if (!val || (Array.isArray(val) && val.length===0)) return null;
                const isFile = field.type==='file';
                return (
                  <div key={field.id} style={{borderBottom:`1px solid ${C.border}20`,paddingBottom:12}}>
                    <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:5}}>{field.label}</div>
                    {isFile ? (
                      <div style={{display:'flex',flexDirection:'column',gap:6}}>
                        {fileList(val).map((f,i)=>(
                          <div key={i} style={{display:'flex',gap:8,alignItems:'center',padding:'8px 12px',borderRadius:8,background:'rgba(0,102,255,0.06)',border:`1px solid ${C.borderHi}`}}>
                            <Upload size={14} style={{color:C.cyan,flexShrink:0}}/>
                            {f.url ? (
                              <a href={f.url} target="_blank" rel="noopener noreferrer"
                                style={{fontSize:12,color:C.cyan,fontWeight:600,textDecoration:'underline'}}>
                                {f.name}
                              </a>
                            ) : (
                              <span style={{fontSize:12,color:C.cyan,fontWeight:600}}>{f.name}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : Array.isArray(val) ? (
                      <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                        {val.map(v=>(
                          <span key={String(v)} style={{padding:'3px 10px',borderRadius:20,fontSize:11,background:'rgba(0,102,255,0.12)',color:C.cyan,border:`1px solid ${C.borderHi}`,fontWeight:600}}>{String(v)}</span>
                        ))}
                      </div>
                    ) : (
                      <div style={{fontSize:12,color:C.text,fontWeight:600,padding:'8px 12px',borderRadius:8,background:'rgba(10,24,56,0.5)',border:`1px solid ${C.border}20`}}>{String(val)}</div>
                    )}
                  </div>
                );
              })}
              <div style={{display:'flex',gap:10}}>
                {showFilled.status==='filled' && (
                  <ERPBtn variant="success" onClick={()=>{handleMarkReviewed(showFilled);setShowFilled(null);}} style={{flex:1,justifyContent:'center'}}>
                    <CheckCircle2 size={13}/> Mark Reviewed
                  </ERPBtn>
                )}
                <ERPBtn variant="primary" style={{flex:1,justifyContent:'center'}} onClick={()=>navigate('/erp/quotations')}>
                  Create Quotation →
                </ERPBtn>
              </div>
            </div>
          );
        })()}
      </ERPModal>
    </div>
  );
}
