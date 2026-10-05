import React, { useState, useEffect } from 'react';
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, doc, serverTimestamp
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  ERPPanel, ERPPanelHeader, ERPBadge, ERPBtn,
  ERPModal, ERPInput, ERPSelect, ERPEmpty, ERPAvatar, C
} from '../components/ERPui';
import { Plus, Send, Eye, CheckCircle2, ClipboardList } from 'lucide-react';

// ── Form templates per service type ───────────────────────────────
const FORM_TEMPLATES = {
  'Website': {
    label: 'Website Requirement Form',
    icon: '🌐',
    fields: [
      { id:'pages',      label:'Pages needed',            type:'checkbox', options:['Home','About','Services','Contact','Blog','Portfolio','Pricing','FAQ','Gallery'] },
      { id:'style',      label:'Design style preference', type:'select',   options:['Modern & Minimal','Corporate & Professional','Creative & Bold','Classic & Elegant'] },
      { id:'references', label:'Reference websites (URLs)', type:'textarea', placeholder:'e.g. https://apple.com, https://notion.so' },
      { id:'content',    label:'Content ready?',          type:'radio',    options:['Yes, all content ready','Partially ready','Need help with content'] },
      { id:'domain',     label:'Domain name already have?', type:'radio',  options:['Yes, I have a domain','No, need help purchasing','Not sure'] },
      { id:'features',   label:'Special features needed', type:'checkbox', options:['Contact Form','WhatsApp Chat','Google Maps','Blog/CMS','E-Commerce','Booking System','Live Chat','Gallery/Portfolio'] },
      { id:'deadline',   label:'Expected launch deadline', type:'text',    placeholder:'e.g. Within 1 month, December 2026' },
      { id:'notes',      label:'Additional notes',         type:'textarea', placeholder:'Any other requirements...' },
    ]
  },
  'ERP/POS': {
    label: 'ERP & POS Requirement Form',
    icon: '⚙️',
    fields: [
      { id:'biztype',    label:'Business type',           type:'select',  options:['Restaurant / Cafe','Supermarket / Retail','Hotel / Hospitality','Manufacturing','Service-based','Other'] },
      { id:'users',      label:'Number of staff users',   type:'select',  options:['1–5','6–15','16–30','30+'] },
      { id:'modules',    label:'Modules needed',          type:'checkbox', options:['POS Billing','Table Management','Inventory','KOT / Kitchen Display','Staff & Roles','Supplier Orders','Reports & Dashboard','Multi-Branch','WhatsApp Receipts','Barcode Scanner'] },
      { id:'branches',   label:'Number of branches',      type:'select',  options:['1','2–3','4–10','10+'] },
      { id:'existing',   label:'Existing software to migrate from', type:'text', placeholder:'e.g. QuickBooks, Excel, No existing system' },
      { id:'hardware',   label:'Hardware available',      type:'checkbox', options:['POS Terminal','Receipt Printer','Barcode Scanner','Cash Drawer','Kitchen Printer','None — need full setup'] },
      { id:'offline',    label:'Offline mode required?',  type:'radio',   options:['Yes, must work without internet','No, always connected','Not sure'] },
      { id:'deadline',   label:'Go-live target date',     type:'text',    placeholder:'e.g. Within 2 months' },
      { id:'notes',      label:'Additional notes',        type:'textarea', placeholder:'Any other requirements...' },
    ]
  },
  'Mobile App': {
    label: 'Mobile App Requirement Form',
    icon: '📱',
    fields: [
      { id:'platform',   label:'Target platform',         type:'radio',   options:['Android only','iOS only','Both Android & iOS'] },
      { id:'apptype',    label:'App type',                type:'select',  options:['Customer-facing (B2C)','Business tool (B2B)','Internal staff tool','E-Commerce app','Service booking app','Other'] },
      { id:'features',   label:'Key features needed',     type:'checkbox', options:['User Login / Registration','Product Catalog','Shopping Cart','Payments (Card/Online)','Push Notifications','Location / Maps','Chat / Messaging','Barcode Scanner','QR Code','Camera / Photo Upload','Offline Mode','Admin Panel'] },
      { id:'backend',    label:'Backend / API needed?',   type:'radio',   options:['Yes, full backend','Use existing API (have backend)','Not sure'] },
      { id:'design',     label:'Design preference',       type:'select',  options:['Minimalist','Colorful & Bold','Corporate','Match our website'] },
      { id:'references', label:'Reference apps or websites', type:'textarea', placeholder:'App names or URLs you like...' },
      { id:'deadline',   label:'Expected launch date',    type:'text',    placeholder:'e.g. Q1 2027' },
      { id:'notes',      label:'Additional notes',        type:'textarea', placeholder:'Any other requirements...' },
    ]
  },
  'Accounting': {
    label: 'Accounting & Tax Requirement Form',
    icon: '📊',
    fields: [
      { id:'biztype',    label:'Business registration type', type:'select', options:['Private Limited Company','Sole Trader','Partnership','NGO / Non-Profit','Other'] },
      { id:'services',   label:'Services needed',          type:'checkbox', options:['Monthly Bookkeeping','VAT Returns','CIT (Corporate Tax)','APIT / WHT','SSCL Filing','Financial Statements','Payroll Processing','Company Secretarial','Audit Coordination'] },
      { id:'software',   label:'Accounting software currently used', type:'select', options:['Excel / Manual','QuickBooks','Xero','Sage','Wave','Zoho Books','None','Other'] },
      { id:'lastaudit',  label:'Last audit / tax filing date', type:'text', placeholder:'e.g. March 2024 or Never' },
      { id:'employees',  label:'Number of employees',      type:'select',  options:['1–5','6–20','21–50','50+'] },
      { id:'frequency',  label:'Reporting frequency',      type:'radio',   options:['Monthly','Quarterly','Annually','As needed'] },
      { id:'notes',      label:'Additional notes',         type:'textarea', placeholder:'Any specific compliance issues...' },
    ]
  },
  'Bank Statement': {
    label: 'Bank Statement Analysis Form',
    icon: '🏦',
    fields: [
      { id:'bank',       label:'Bank name',               type:'select',  options:['Bank of Ceylon','Commercial Bank','Hatton National Bank','Sampath Bank','Seylan Bank','Nations Trust Bank','DFCC Bank','Pan Asia Bank','Other'] },
      { id:'acctype',    label:'Account type',            type:'radio',   options:['Current Account','Savings Account','Both'] },
      { id:'period',     label:'Analysis period',         type:'text',    placeholder:'e.g. January 2024 – December 2024' },
      { id:'purpose',    label:'Purpose of analysis',     type:'select',  options:['Loan Application','Business Performance Review','Tax Compliance','Investment Decision','Legal Requirement','Other'] },
      { id:'statements', label:'Number of statements',    type:'select',  options:['1–3 months','4–6 months','7–12 months','More than 1 year'] },
      { id:'format',     label:'Preferred output format', type:'radio',   options:['Excel Report','PDF Summary','Both Excel + PDF'] },
      { id:'notes',      label:'Specific analysis needed', type:'textarea', placeholder:'What specific insights do you need?' },
    ]
  },
};

const CLIENTS_LIST = [
  { id:'C001', name:'John Perera',    company:'Perera Holdings' },
  { id:'C002', name:'Sarah Fernando', company:'Mehala Restaurant' },
  { id:'C003', name:'Kumar Arasan',   company:'KA Retail' },
  { id:'C004', name:'Priya Nair',     company:'PN Accounting' },
  { id:'C005', name:'Dilan Perera',   company:'DP Constructions' },
];

const DEV_SENT_FORMS = [
  { id:'F001', clientId:'C001', clientName:'John Perera',    formType:'Website',     status:'filled',   sentAt:'Oct 1, 2026',  filledAt:'Oct 2, 2026' },
  { id:'F002', clientId:'C002', clientName:'Sarah Fernando', formType:'ERP/POS',      status:'sent',     sentAt:'Oct 3, 2026',  filledAt:null },
  { id:'F003', clientId:'C004', clientName:'Priya Nair',     formType:'Accounting',  status:'reviewed', sentAt:'Sep 25, 2026', filledAt:'Sep 26, 2026' },
];

// Simulated filled response
const DEV_FILLED = {
  F001: {
    pages:      ['Home','About','Services','Contact','Blog'],
    style:      'Corporate & Professional',
    references: 'https://notion.so, https://linear.app',
    content:    'Partially ready',
    domain:     'Yes, I have a domain',
    features:   ['Contact Form','WhatsApp Chat','Google Maps'],
    deadline:   'Within 6 weeks',
    notes:      'We need the website to match our brand colors (navy + gold).',
  }
};

const COLORS = ['#0066FF','#8B5CF6','#18C77A','#F5B942'];

export default function ERPRequirements() {
  const { isDevSession } = useAuth();
  const [sentForms,   setSentForms]   = useState(DEV_SENT_FORMS);
  const [showCreate,  setShowCreate]  = useState(false);
  const [showFilled,  setShowFilled]  = useState(null);  // form record
  const [activeTab,   setActiveTab]   = useState('sent'); // 'sent' | 'create'

  // Create form state
  const [selClient,   setSelClient]   = useState('');
  const [selType,     setSelType]     = useState('Website');
  const [sending,     setSending]     = useState(false);
  const [sentDone,    setSentDone]    = useState(false);

  const handleSendForm = async () => {
    if (!selClient || !selType) return;
    setSending(true);
    const client = CLIENTS_LIST.find(c=>c.id===selClient);
    const newForm = {
      id: `F${Date.now()}`,
      clientId: selClient, clientName: client?.name || '',
      formType: selType, status:'sent',
      sentAt: new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),
      filledAt: null,
    };
    if (isFirebaseConfigured && !isDevSession) {
      try {
        await addDoc(collection(db,'requirementForms'), {
          ...newForm, createdAt: serverTimestamp(),
          fields: FORM_TEMPLATES[selType]?.fields || [],
        });
      } catch(e){ console.error(e); }
    }
    setSentForms(p=>[newForm,...p]);
    setSentDone(true);
    setSending(false);
  };

  const handleMarkReviewed = async (formId) => {
    setSentForms(p=>p.map(f=>f.id===formId?{...f,status:'reviewed'}:f));
    if (isFirebaseConfigured && !isDevSession) {
      try { await updateDoc(doc(db,'requirementForms',formId),{status:'reviewed',reviewedAt:serverTimestamp()}); } catch(e){}
    }
  };

  const filledData = showFilled ? (DEV_FILLED[showFilled.id] || {}) : {};
  const template   = showFilled ? FORM_TEMPLATES[showFilled.formType] : null;

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>

      {/* Tab bar */}
      <div style={{display:'flex',gap:8}}>
        {[
          {id:'sent',   label:'Sent Forms',   icon:'📋', count:sentForms.length},
          {id:'create', label:'Send New Form', icon:'✉️',  count:0},
        ].map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{
            padding:'8px 18px', borderRadius:10, fontSize:12, fontWeight:700,
            cursor:'pointer', transition:'all 0.15s', display:'flex', alignItems:'center', gap:6,
            background: activeTab===t.id?'linear-gradient(135deg,#0066FF,#1787FF)':'rgba(10,24,56,0.8)',
            color: activeTab===t.id?'#fff':C.muted,
            border: activeTab===t.id?'none':`1px solid ${C.border}`,
            boxShadow: activeTab===t.id?'0 4px 14px rgba(0,102,255,0.35)':'none',
          }}>
            <span>{t.icon}</span> {t.label}
            {t.count>0 && <span style={{background:'rgba(255,255,255,0.2)',padding:'1px 7px',borderRadius:20,fontSize:10}}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* ── SENT FORMS ── */}
      {activeTab === 'sent' && (
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {sentForms.length===0 ? (
            <ERPEmpty icon="📋" title="No forms sent yet" sub='Click "Send New Form" to send a requirement form to a client.' />
          ) : sentForms.map((form,i)=>{
            const tpl = FORM_TEMPLATES[form.formType];
            return (
              <ERPPanel key={form.id}>
                <div style={{padding:'16px 20px',display:'flex',alignItems:'center',gap:14}}>
                  {/* Type icon */}
                  <div style={{
                    width:44,height:44,borderRadius:12,flexShrink:0,
                    background:'rgba(0,102,255,0.12)',border:`1px solid ${C.borderHi}`,
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:20,
                  }}>{tpl?.icon||'📋'}</div>

                  {/* Info */}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                      <span style={{fontSize:13,fontWeight:800,color:C.text}}>{tpl?.label||form.formType}</span>
                      <ERPBadge
                        status={form.status==='filled'?'quotation_accepted':form.status==='reviewed'?'Completed':form.status==='sent'?'quotation_sent':'New'}
                        label={form.status==='filled'?'Filled':'reviewed'===form.status?'Reviewed':'Sent'}
                      />
                    </div>
                    <div style={{fontSize:11,color:C.muted,marginTop:3}}>
                      Client: <strong style={{color:C.subtle}}>{form.clientName}</strong>
                      <span style={{marginLeft:16}}>Sent: {form.sentAt}</span>
                      {form.filledAt && <span style={{marginLeft:16,color:C.green}}>Filled: {form.filledAt}</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{display:'flex',gap:8,flexShrink:0}}>
                    {(form.status==='filled'||form.status==='reviewed') && (
                      <ERPBtn size="sm" variant="secondary" onClick={()=>setShowFilled(form)}>
                        <Eye size={12}/> View Response
                      </ERPBtn>
                    )}
                    {form.status==='filled' && (
                      <ERPBtn size="sm" variant="success" onClick={()=>handleMarkReviewed(form.id)}>
                        <CheckCircle2 size={12}/> Mark Reviewed
                      </ERPBtn>
                    )}
                    {form.status==='sent' && (
                      <span style={{fontSize:11,color:C.muted,display:'flex',alignItems:'center',gap:4}}>
                        <span style={{width:6,height:6,borderRadius:'50%',background:C.amber,display:'inline-block'}} />
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

      {/* ── SEND NEW FORM ── */}
      {activeTab === 'create' && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>

          {/* Left: Builder */}
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <ERPPanel>
              <ERPPanelHeader title="Send Requirement Form" icon="✉️" />
              <div style={{padding:18,display:'flex',flexDirection:'column',gap:14}}>
                {!sentDone ? (
                  <>
                    <ERPSelect label="Select Client" value={selClient}
                      onChange={e=>setSelClient(e.target.value)}
                      placeholder="Choose client..."
                      options={CLIENTS_LIST.map(c=>({value:c.id,label:`${c.name} — ${c.company}`}))}
                      required />

                    <div>
                      <label style={{display:'block',fontSize:11,fontWeight:600,color:C.subtle,marginBottom:8}}>
                        Form Type <span style={{color:C.red}}>*</span>
                      </label>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                        {Object.entries(FORM_TEMPLATES).map(([key,tpl])=>(
                          <div key={key} onClick={()=>setSelType(key)}
                            style={{
                              padding:'12px',borderRadius:12,cursor:'pointer',
                              transition:'all 0.15s',
                              background:selType===key?'rgba(0,102,255,0.15)':'rgba(10,24,56,0.6)',
                              border:`1px solid ${selType===key?C.borderHi:C.border+'40'}`,
                              display:'flex',alignItems:'center',gap:10,
                            }}>
                            <span style={{fontSize:20}}>{tpl.icon}</span>
                            <div>
                              <div style={{fontSize:11,fontWeight:700,color:selType===key?C.text:C.muted}}>{key}</div>
                              <div style={{fontSize:9,color:C.muted}}>{tpl.fields.length} questions</div>
                            </div>
                            {selType===key && <CheckCircle2 size={14} style={{color:C.blue,marginLeft:'auto'}} />}
                          </div>
                        ))}
                      </div>
                    </div>

                    <ERPBtn variant="primary" disabled={!selClient||sending} onClick={handleSendForm}
                      style={{justifyContent:'center'}}>
                      {sending ? '⏳ Sending...' : <><Send size={13}/> Send Form to Client</>}
                    </ERPBtn>
                  </>
                ) : (
                  <div style={{textAlign:'center',padding:'16px 0',display:'flex',flexDirection:'column',gap:14,alignItems:'center'}}>
                    <div style={{fontSize:36}}>✅</div>
                    <div>
                      <div style={{fontSize:15,fontWeight:800,color:C.text}}>Form Sent!</div>
                      <div style={{fontSize:12,color:C.muted,marginTop:4}}>
                        The client will see the form in their dashboard and fill it.
                      </div>
                    </div>
                    <ERPBtn variant="secondary" onClick={()=>{setSentDone(false);setSelClient('');setSelType('Website');}} style={{justifyContent:'center'}}>
                      Send Another Form
                    </ERPBtn>
                  </div>
                )}
              </div>
            </ERPPanel>
          </div>

          {/* Right: Preview */}
          <ERPPanel>
            <ERPPanelHeader title={`Preview — ${FORM_TEMPLATES[selType]?.label}`} icon={FORM_TEMPLATES[selType]?.icon} />
            <div style={{padding:16,maxHeight:500,overflowY:'auto'}}>
              <div style={{fontSize:11,color:C.muted,marginBottom:14}}>
                This is what the client will see in their dashboard:
              </div>
              {FORM_TEMPLATES[selType]?.fields.map((field,i)=>(
                <div key={field.id} style={{marginBottom:14}}>
                  <div style={{fontSize:12,fontWeight:600,color:C.subtle,marginBottom:6}}>
                    {i+1}. {field.label}
                  </div>
                  {field.type==='text' && (
                    <div style={{padding:'8px 12px',borderRadius:8,background:'rgba(10,24,56,0.6)',border:`1px solid ${C.border}30`,fontSize:11,color:C.muted}}>
                      {field.placeholder||'Text input'}
                    </div>
                  )}
                  {field.type==='textarea' && (
                    <div style={{padding:'8px 12px',borderRadius:8,background:'rgba(10,24,56,0.6)',border:`1px solid ${C.border}30`,fontSize:11,color:C.muted,minHeight:48}}>
                      {field.placeholder||'Paragraph text'}
                    </div>
                  )}
                  {field.type==='select' && (
                    <div style={{padding:'8px 12px',borderRadius:8,background:'rgba(10,24,56,0.6)',border:`1px solid ${C.border}30`,fontSize:11,color:C.muted}}>
                      {field.options[0]} ▾
                    </div>
                  )}
                  {(field.type==='radio'||field.type==='checkbox') && (
                    <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                      {field.options.slice(0,4).map(opt=>(
                        <div key={opt} style={{
                          padding:'5px 10px',borderRadius:8,fontSize:10,
                          background:'rgba(10,24,56,0.6)',border:`1px solid ${C.border}30`,color:C.muted,
                        }}>{field.type==='radio'?'◯':'☐'} {opt}</div>
                      ))}
                      {field.options.length>4 && <div style={{fontSize:10,color:C.muted,display:'flex',alignItems:'center'}}>+{field.options.length-4} more</div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ERPPanel>
        </div>
      )}

      {/* ── VIEW FILLED RESPONSE MODAL ── */}
      <ERPModal isOpen={!!showFilled} onClose={()=>setShowFilled(null)}
        title={`Filled Response — ${showFilled?.clientName}`} width={580}>
        {showFilled && template && (
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <div style={{display:'flex',gap:10,alignItems:'center',padding:'10px 14px',borderRadius:10,background:'rgba(0,102,255,0.08)',border:`1px solid ${C.borderHi}`}}>
              <span style={{fontSize:22}}>{template.icon}</span>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:C.text}}>{template.label}</div>
                <div style={{fontSize:11,color:C.muted}}>Filled by {showFilled.clientName} on {showFilled.filledAt}</div>
              </div>
              <ERPBadge status="Completed" label="Filled" />
            </div>

            {template.fields.map(field=>{
              const val = filledData[field.id];
              if (!val) return null;
              return (
                <div key={field.id} style={{borderBottom:`1px solid ${C.border}25`,paddingBottom:12}}>
                  <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:5}}>{field.label}</div>
                  {Array.isArray(val) ? (
                    <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                      {val.map(v=>(
                        <span key={v} style={{
                          padding:'3px 10px',borderRadius:20,fontSize:11,
                          background:'rgba(0,102,255,0.12)',color:C.cyan,
                          border:`1px solid ${C.borderHi}`,fontWeight:600,
                        }}>{v}</span>
                      ))}
                    </div>
                  ) : (
                    <div style={{
                      fontSize:12,color:C.text,fontWeight:600,
                      padding:'8px 12px',borderRadius:8,
                      background:'rgba(10,24,56,0.6)',border:`1px solid ${C.border}30`,
                    }}>{val}</div>
                  )}
                </div>
              );
            })}

            <div style={{display:'flex',gap:10,paddingTop:4}}>
              {showFilled.status==='filled' && (
                <ERPBtn variant="success" onClick={()=>{handleMarkReviewed(showFilled.id);setShowFilled(null);}} style={{flex:1,justifyContent:'center'}}>
                  <CheckCircle2 size={13}/> Mark as Reviewed
                </ERPBtn>
              )}
              <ERPBtn variant="primary" style={{flex:1,justifyContent:'center'}}
                onClick={()=>setShowFilled(null)}>
                Create Quotation →
              </ERPBtn>
            </div>
          </div>
        )}
      </ERPModal>
    </div>
  );
}
