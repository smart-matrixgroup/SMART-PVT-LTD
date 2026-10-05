import React, { useState, useEffect } from 'react';
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  ERPPanel, ERPPanelHeader, ERPBadge, ERPBtn,
  ERPModal, ERPInput, ERPSelect, ERPEmpty,
  ERPAvatar, C
} from '../components/ERPui';
import {
  Plus, Trash2, Send, Eye, CheckCircle2,
  GripVertical, ChevronDown, ChevronUp,
  FileText, Image, Upload, Type, List,
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

const CLIENTS = [
  { id:'C001', name:'John Perera',    company:'Perera Holdings' },
  { id:'C002', name:'Sarah Fernando', company:'Mehala Restaurant' },
  { id:'C003', name:'Kumar Arasan',   company:'KA Retail' },
  { id:'C004', name:'Priya Nair',     company:'PN Accounting' },
  { id:'C005', name:'Dilan Perera',   company:'DP Constructions' },
];

// ── Built-in form templates ───────────────────────────────────────
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

const DEV_SENT_FORMS = [
  { id:'F001', clientId:'C001', clientName:'John Perera',    formType:'Website',      status:'filled',   sentAt:'Oct 1, 2026',  filledAt:'Oct 2, 2026', isCustom:false },
  { id:'F002', clientId:'C002', clientName:'Sarah Fernando', formType:'ERP/POS',       status:'sent',     sentAt:'Oct 3, 2026',  filledAt:null,          isCustom:false },
  { id:'F003', clientId:'C004', clientName:'Priya Nair',     formType:'Bank Statement',status:'reviewed', sentAt:'Sep 25, 2026', filledAt:'Sep 26, 2026',isCustom:false },
];

const DEV_FILLED = {
  F001: { f1:['Home','About','Services','Contact'], f2:'Corporate', f3:'https://notion.so', f4:'Partially ready', f5:['Contact Form','WhatsApp Chat'], f6:'6 weeks', f7:'Match brand colors (navy + gold).' },
  F003: { f1:'HNB', f2:'Current Account', f3:'Jan 2024 – Dec 2024', f4:'Loan Application', f5:'12 months', f6:'[Bank Statement PDF uploaded]', f7:'Excel Report', f8:'Need monthly cash flow breakdown.' },
};

// ── Unique ID helper ──────────────────────────────────────────────
const uid = () => `f${Date.now()}_${Math.random().toString(36).slice(2,6)}`;

export default function ERPRequirements() {
  const { isDevSession } = useAuth();
  const [view,        setView]        = useState('list');   // 'list' | 'builder' | 'templates'
  const [sentForms,   setSentForms]   = useState(DEV_SENT_FORMS);
  const [showFilled,  setShowFilled]  = useState(null);
  const [showSend,    setShowSend]    = useState(null);     // form/template to send
  const [sendClient,  setSendClient]  = useState('');
  const [sending,     setSending]     = useState(false);
  const [sentDone,    setSentDone]    = useState(false);

  // Form builder state
  const [formName,    setFormName]    = useState('');
  const [formFields,  setFormFields]  = useState([
    { id:uid(), type:'text',    label:'',   required:false, placeholder:'', options:[], fileAccept:'any', multiple:false },
  ]);
  const [editingOption, setEditingOption] = useState(null); // { fieldIdx, optionIdx }
  const [savedForms,  setSavedForms]  = useState([]);       // custom saved forms
  const [editForm,    setEditForm]    = useState(null);     // form being edited

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

  // ── Save custom form ─────────────────────────────────────────────
  const handleSaveForm = () => {
    if (!formName.trim() || formFields.some(f=>!f.label.trim())) return;
    const form = {
      id: editForm?.id || `CF${Date.now()}`,
      name: formName.trim(),
      fields: formFields,
      createdAt: new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),
      isCustom: true,
    };
    if (editForm) {
      setSavedForms(p=>p.map(f=>f.id===editForm.id?form:f));
    } else {
      setSavedForms(p=>[...p, form]);
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

  const handleDeleteForm = (formId) => {
    setSavedForms(p=>p.filter(f=>f.id!==formId));
  };

  // ── Send form ────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!sendClient||!showSend) return;
    setSending(true);
    const client  = CLIENTS.find(c=>c.id===sendClient);
    const newForm = {
      id:         `F${Date.now()}`,
      clientId:   sendClient,
      clientName: client?.name||'',
      formType:   showSend.name||showSend.label||showSend,
      status:     'sent',
      sentAt:     new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),
      filledAt:   null,
      isCustom:   !!showSend.isCustom,
    };
    if (isFirebaseConfigured && !isDevSession) {
      try { await addDoc(collection(db,'requirementForms'),{...newForm,createdAt:serverTimestamp()}); } catch(e){console.error(e);}
    }
    setSentForms(p=>[newForm,...p]);
    setSending(false);
    setSentDone(true);
  };

  const handleMarkReviewed = (id) => setSentForms(p=>p.map(f=>f.id===id?{...f,status:'reviewed'}:f));

  // ── Load template into builder ───────────────────────────────────
  const loadTemplate = (key) => {
    const tpl = TEMPLATES[key];
    setFormName(tpl.label);
    setFormFields(tpl.fields.map(f=>({...f})));
    setView('builder');
  };

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>

      {/* Top bar */}
      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
        {/* View tabs */}
        {[
          {id:'list',      label:'Sent Forms'},
          {id:'templates', label:'Templates'},
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
          SENT FORMS LIST
      ══════════════════════════════════════════════════════════ */}
      {view === 'list' && (
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
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
                      <div style={{fontSize:10,color:C.muted}}>{form.fields.length} fields · Created {form.createdAt}</div>
                    </div>
                    <div style={{display:'flex',gap:8}}>
                      <ERPBtn size="sm" variant="primary" onClick={()=>{setShowSend(form);setSendClient('');setSentDone(false);}}>
                        <Send size={11}/> Send
                      </ERPBtn>
                      <ERPBtn size="sm" variant="secondary" onClick={()=>handleEditForm(form)}>Edit</ERPBtn>
                      <ERPBtn size="sm" variant="danger" onClick={()=>handleDeleteForm(form.id)}>
                        <Trash2 size={11}/>
                      </ERPBtn>
                    </div>
                  </div>
                ))}
              </div>
            </ERPPanel>
          )}

          {/* Sent forms */}
          {sentForms.length === 0 ? (
            <ERPEmpty icon="📋" title="No forms sent yet" sub='Click "Templates" to pick a built-in form, or "Form Builder" to create a custom one.' />
          ) : sentForms.map((form,i)=>{
            const isTemplate = !form.isCustom;
            const tpl  = isTemplate ? TEMPLATES[form.formType] : null;
            return (
              <ERPPanel key={form.id}>
                <div style={{padding:'16px 20px',display:'flex',alignItems:'center',gap:14}}>
                  <div style={{
                    width:44,height:44,borderRadius:12,flexShrink:0,
                    background:'rgba(0,102,255,0.1)',border:`1px solid ${C.borderHi}`,
                    display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,
                  }}>{tpl?.icon||'📝'}</div>
                  <div style={{flex:1,minWidth:0}}>
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
                      <span style={{marginLeft:16}}>Sent: {form.sentAt}</span>
                      {form.filledAt&&<span style={{marginLeft:16,color:C.green}}>Filled: {form.filledAt}</span>}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:8,flexShrink:0}}>
                    {(form.status==='filled'||form.status==='reviewed') && (
                      <ERPBtn size="sm" variant="secondary" onClick={()=>setShowFilled(form)}>
                        <Eye size={12}/> View Response
                      </ERPBtn>
                    )}
                    {form.status==='filled' && (
                      <ERPBtn size="sm" variant="success" onClick={()=>handleMarkReviewed(form.id)}>
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
          TEMPLATES
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
              <div style={{display:'flex',gap:8}}>
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
        <div style={{display:'grid',gridTemplateColumns:'1fr 340px',gap:16,alignItems:'start'}}>

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
            <div style={{display:'flex',gap:10}}>
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
          <ERPPanel style={{position:'sticky',top:0}}>
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

      {/* ── SEND FORM MODAL ── */}
      <ERPModal isOpen={!!showSend&&!sentDone} onClose={()=>{setShowSend(null);setSendClient('');}} title="Send Form to Client" width={420}>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div style={{display:'flex',gap:12,padding:'12px 14px',borderRadius:10,background:'rgba(0,102,255,0.08)',border:`1px solid ${C.borderHi}`,alignItems:'center'}}>
            <span style={{fontSize:22}}>{TEMPLATES[showSend?.name||'']?.icon||'📝'}</span>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:C.text}}>{showSend?.name||showSend?.label}</div>
              <div style={{fontSize:11,color:C.muted}}>{showSend?.fields?.length||'?'} questions</div>
            </div>
          </div>
          <ERPSelect label="Send to Client" value={sendClient} onChange={e=>setSendClient(e.target.value)}
            placeholder="Select client..." required
            options={CLIENTS.map(c=>({value:c.id,label:`${c.name} — ${c.company}`}))} />
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
          const tpl    = TEMPLATES[showFilled.formType];
          const filled = DEV_FILLED[showFilled.id] || {};
          if (!tpl) return <div style={{color:C.muted,fontSize:12,padding:8}}>No template found for this form type.</div>;
          return (
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div style={{display:'flex',gap:10,alignItems:'center',padding:'10px 14px',borderRadius:10,background:'rgba(0,102,255,0.08)',border:`1px solid ${C.borderHi}`}}>
                <span style={{fontSize:22}}>{tpl.icon}</span>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:C.text}}>{tpl.label}</div>
                  <div style={{fontSize:11,color:C.muted}}>Filled by {showFilled.clientName} on {showFilled.filledAt}</div>
                </div>
                <ERPBadge status="Completed" label="Filled" />
              </div>
              {tpl.fields.map(field=>{
                const val = filled[field.id];
                if (!val) return null;
                const isFile = field.type==='file';
                return (
                  <div key={field.id} style={{borderBottom:`1px solid ${C.border}20`,paddingBottom:12}}>
                    <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:5}}>{field.label}</div>
                    {isFile ? (
                      <div style={{display:'flex',gap:8,alignItems:'center',padding:'8px 12px',borderRadius:8,background:'rgba(0,102,255,0.06)',border:`1px solid ${C.borderHi}`}}>
                        <Upload size={14} style={{color:C.cyan}}/>
                        <span style={{fontSize:12,color:C.cyan,fontWeight:600}}>{val}</span>
                      </div>
                    ) : Array.isArray(val) ? (
                      <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                        {val.map(v=>(
                          <span key={v} style={{padding:'3px 10px',borderRadius:20,fontSize:11,background:'rgba(0,102,255,0.12)',color:C.cyan,border:`1px solid ${C.borderHi}`,fontWeight:600}}>{v}</span>
                        ))}
                      </div>
                    ) : (
                      <div style={{fontSize:12,color:C.text,fontWeight:600,padding:'8px 12px',borderRadius:8,background:'rgba(10,24,56,0.5)',border:`1px solid ${C.border}20`}}>{val}</div>
                    )}
                  </div>
                );
              })}
              <div style={{display:'flex',gap:10}}>
                {showFilled.status==='filled' && (
                  <ERPBtn variant="success" onClick={()=>{handleMarkReviewed(showFilled.id);setShowFilled(null);}} style={{flex:1,justifyContent:'center'}}>
                    <CheckCircle2 size={13}/> Mark Reviewed
                  </ERPBtn>
                )}
                <ERPBtn variant="primary" style={{flex:1,justifyContent:'center'}} onClick={()=>setShowFilled(null)}>
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
