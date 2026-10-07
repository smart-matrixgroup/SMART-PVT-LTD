import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, doc, serverTimestamp
} from 'firebase/firestore';
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, isFirebaseConfigured } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { getStaffByIds } from '../config/staff';
import SEO from '../components/SEO';
import { company } from '../config/company';
import { toMillis } from '../erp/formatWhen';
import { toInt, formatLKR } from '../erp/money';
import { getConversationId, sendChatMessage, markConversationAsRead } from '../erp/messagingUtils';
import {
  LayoutDashboard, FolderKanban, FileText, HeadphonesIcon,
  LogOut, MessageSquare, Sparkles, ChevronRight,
  CheckCircle2, Clock, Send, AlertCircle, ClipboardList,
  Receipt, TrendingUp, DollarSign, MessageCircle, Bell,
  Plus, ArrowRight, ChevronDown, ChevronUp, Phone,
  ExternalLink, Zap, Shield, BarChart2, Activity,
  CreditCard, Printer, Download, Award, Search, Check
} from 'lucide-react';

// ─── DEV MOCK ────────────────────────────────────────────────────
const DEV_PROJECTS = [
  {
    id:'dp1', clientId:'dev-client-001',
    title:'Corporate Website Redesign', serviceType:'Corporate Business Website',
    status:'In Progress', completion:65, createdAt:null,
    milestones:[
      {title:'Discovery & Blueprint',done:true},{title:'UI/UX Design',done:true},
      {title:'Development',done:false},{title:'QA & Testing',done:false},{title:'Deployment',done:false},
    ],
    quotation:{totalAmount:'LKR 85,000',advanceAmount:'LKR 30,000',
      breakdown:[{label:'Design & UI/UX',amount:'LKR 25,000'},{label:'Development',amount:'LKR 45,000'},{label:'SEO & Deployment',amount:'LKR 15,000'}],
      validUntil:'Nov 15, 2026',notes:'Includes 3 months free support.'},
    assignedStaff:['STAFF-001','STAFF-002'],
  },
  {
    id:'dp2', clientId:'dev-client-001',
    title:'Mobile App Development', serviceType:'Mobile App (Android & iOS)',
    status:'quotation_sent', completion:0, createdAt:null, milestones:[],
    quotation:{totalAmount:'LKR 150,000',advanceAmount:'LKR 50,000',
      breakdown:[{label:'Architecture',amount:'LKR 40,000'},{label:'Development',amount:'LKR 90,000'},{label:'Testing',amount:'LKR 20,000'}],
      validUntil:'Nov 30, 2026',notes:'React Native cross-platform.'},
    assignedStaff:[],
  },
  {
    id:'dp3', clientId:'dev-client-001',
    title:'Accounting & Tax Automation', serviceType:'Accounting & Tax Services',
    status:'Completed', completion:100, createdAt:null,
    milestones:[
      {title:'Requirements Gathering',done:true},{title:'Ledger Configuration',done:true},
      {title:'Integration & Migration',done:true},{title:'Staff Training & Final Delivery',done:true},
    ],
    quotation:{totalAmount:'LKR 95,000',advanceAmount:'LKR 40,000',
      breakdown:[{label:'System Setup',amount:'LKR 45,000'},{label:'Data Migration',amount:'LKR 50,000'}],
      validUntil:'Oct 01, 2026',notes:'Complete setup with SLA.'},
    assignedStaff:['STAFF-001'],
  },
];
const DEV_PAYMENTS = [
  {
    id:'pay-dev-1',
    receiptNo:'R-2026-0001',
    quotationNo:'Q-2026-0001',
    projectTitle:'Corporate Website Redesign',
    clientId:'dev-client-001',
    clientName:'Demo Client',
    amount:30000,
    date:'2026-10-02',
    method:'Bank Transfer',
    reference:'FT-88213',
    notes:'Advance payment (35%)',
    createdAt:null,
  },
  {
    id:'pay-dev-2',
    receiptNo:'R-2026-0002',
    quotationNo:'Q-2026-0001',
    projectTitle:'Corporate Website Redesign',
    clientId:'dev-client-001',
    clientName:'Demo Client',
    amount:25000,
    date:'2026-10-20',
    method:'Online Transfer',
    reference:'TXN-99412',
    notes:'Milestone 1 — UI/UX Signoff',
    createdAt:null,
  },
];
const DEV_MSGS = [
  {id:'m1',senderId:'staff-001',senderName:'Ashan',senderRole:'staff',text:'Hi! The homepage design is ready for your review. Please check and give feedback.',sessionId:new Date().toISOString().slice(0,10),timestamp:{toDate:()=>new Date(Date.now()-3600000)}},
  {id:'m2',senderId:'dev-client-001',senderName:'You',senderRole:'client',text:"Looks great! Can we try a blue hero section?",sessionId:new Date().toISOString().slice(0,10),timestamp:{toDate:()=>new Date(Date.now()-1800000)}},
  {id:'m3',senderId:'staff-001',senderName:'Ashan',senderRole:'staff',text:'Sure! Will update and share revised version by EOD.',sessionId:new Date().toISOString().slice(0,10),timestamp:{toDate:()=>new Date(Date.now()-900000)}},
];
const DEV_FORMS = [
  {
    id:'dev-form-001', clientId:'dev-client-001', clientName:'Dev Client', clientCompany:'Demo Co',
    formType:'Website Requirements Checklist', kind:'sent', status:'filled',
    sentAt:new Date(Date.now()-86400000*2).toISOString().slice(0,10),
    filledAt:new Date(Date.now()-86400000).toISOString().slice(0,10),
    isCustom:false,
    fields:[
      {id:'f1',label:'Pages needed',type:'checkbox',options:['Home','About','Services','Contact','Blog'],required:true},
      {id:'f2',label:'Website type',type:'radio',options:['Corporate','E-commerce','Portfolio','Other'],required:true},
      {id:'f3',label:'Content ready?',type:'select',options:['Yes, fully ready','Partially ready','No, need help'],required:true},
      {id:'f4',label:'Tell us about your business',type:'textarea',required:false},
    ],
    answers:{f1:['Home','About','Services'],f2:'Corporate',f3:'Partially ready',f4:'We are a B2B logistics company serving the Colombo area.'},
  },
  {
    id:'dev-form-002', clientId:'dev-client-001', clientName:'Dev Client', clientCompany:'Demo Co',
    formType:'ERP / POS Requirements', kind:'sent', status:'sent',
    sentAt:new Date().toISOString().slice(0,10),
    isCustom:false,
    fields:[
      {id:'f1',label:'Number of branches / outlets',type:'number',required:true},
      {id:'f2',label:'Current system',type:'select',options:['Manual / Excel','Existing software','None'],required:true},
      {id:'f3',label:'Modules needed',type:'checkbox',options:['Inventory','Billing','HR & Payroll','Reports','Customer management'],required:true},
      {id:'f4',label:'Upload your current stock / price list',type:'file',fileAccept:'excel',required:false},
    ],
    answers:{},
  },
];
const CLIENT_FILE_ACCEPTS = {
  any:      '*/*',
  pdf:      '.pdf,application/pdf',
  image:    'image/*',
  doc:      '.doc,.docx,.pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  excel:    '.xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv',
  pdf_image:'.pdf,image/*',
  all_docs: '.pdf,.doc,.docx,.xls,.xlsx,.csv,image/*',
};

// ─── STATUS ──────────────────────────────────────────────────────
const STATUS_MAP = {
  requirements_pending: {label:'Under Review',  dot:'#F59E0B', bg:'rgba(245,158,11,0.1)',  border:'rgba(245,158,11,0.3)',  text:'#92400E'},
  quotation_sent:       {label:'Quote Ready',    dot:'#8B5CF6', bg:'rgba(139,92,246,0.1)',  border:'rgba(139,92,246,0.3)',  text:'#5B21B6'},
  quotation_accepted:   {label:'Accepted',       dot:'#3B82F6', bg:'rgba(59,130,246,0.1)',  border:'rgba(59,130,246,0.3)',  text:'#1D4ED8'},
  advance_paid:         {label:'Starting Soon',  dot:'#10B981', bg:'rgba(16,185,129,0.1)',  border:'rgba(16,185,129,0.3)',  text:'#065F46'},
  'In Progress':        {label:'In Progress',    dot:'#3B82F6', bg:'rgba(59,130,246,0.1)',  border:'rgba(59,130,246,0.3)',  text:'#1D4ED8'},
  Completed:            {label:'Completed',      dot:'#10B981', bg:'rgba(16,185,129,0.1)',  border:'rgba(16,185,129,0.3)',  text:'#065F46'},
  Paid:                 {label:'Paid',           dot:'#10B981', bg:'rgba(16,185,129,0.1)',  border:'rgba(16,185,129,0.3)',  text:'#065F46'},
  Pending:              {label:'Pending',        dot:'#F59E0B', bg:'rgba(245,158,11,0.1)',  border:'rgba(245,158,11,0.3)',  text:'#92400E'},
  Sent:                 {label:'Sent',           dot:'#8B5CF6', bg:'rgba(139,92,246,0.1)',  border:'rgba(139,92,246,0.3)',  text:'#5B21B6'},
  Accepted:             {label:'Accepted',       dot:'#3B82F6', bg:'rgba(59,130,246,0.1)',  border:'rgba(59,130,246,0.3)',  text:'#1D4ED8'},
  'Advance Paid':       {label:'Advance Paid',   dot:'#10B981', bg:'rgba(16,185,129,0.1)',  border:'rgba(16,185,129,0.3)',  text:'#065F46'},
  Draft:                {label:'Draft',          dot:'#94A3B8', bg:'rgba(148,163,184,0.1)', border:'rgba(148,163,184,0.3)', text:'#475569'},
};
const Chip = ({status, sm=true}) => {
  const c = STATUS_MAP[status] || {label:status, dot:'#94A3B8', bg:'rgba(148,163,184,0.1)', border:'rgba(148,163,184,0.3)', text:'#475569'};
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5,
      padding: sm ? '3px 10px' : '4px 12px',
      borderRadius:20, border:`1px solid ${c.border}`,
      background:c.bg, color:c.text,
      fontSize: sm ? 10 : 11, fontWeight:700, whiteSpace:'nowrap',
    }}>
      <span style={{width:6,height:6,borderRadius:'50%',background:c.dot,boxShadow:`0 0 6px ${c.dot}`,flexShrink:0}}/>
      {c.label}
    </span>
  );
};

// ─── NAV ─────────────────────────────────────────────────────────
const NAV = [
  {id:'overview',     label:'Dashboard',          icon:LayoutDashboard},
  {id:'projects',     label:'Projects',           icon:FolderKanban},
  {id:'progress',     label:'Project Progress',   icon:Activity},
  {id:'quotation',    label:'Quotations',         icon:Receipt},
  {id:'payments',     label:'Payments & Balance', icon:CreditCard},
  {id:'receipts',     label:'Receipts',           icon:FileText},
  {id:'completion',   label:'Project Completion', icon:Award},
  {id:'messages',     label:'Messages',           icon:MessageSquare},
  {id:'forms',        label:'My Forms',           icon:ClipboardList},
  {id:'requirements', label:'New Request',        icon:Plus},
  {id:'support',      label:'Support',            icon:HeadphonesIcon},
];

const REQ_SERVICES = ['ERP & POS System','Custom Software Development','Portfolio Website','Corporate Business Website','Mobile App (Android & iOS)','Business Process Automation','AI-Powered Solutions','Accounting & Tax Services','Audit & Assurance','Other'];
const REQ_TIMELINES = ['Less than 1 month','1–2 months','2–3 months','3–6 months','6+ months','Flexible'];
const REQ_BUDGETS   = ['Below LKR 25,000','LKR 25,000–50,000','LKR 50,000–100,000','LKR 100,000–250,000','LKR 250,000+','Let\'s discuss'];

// ─── MAIN ─────────────────────────────────────────────────────────
export default function ClientDashboardPage() {
  const navigate  = useNavigate();
  const {clientProfile,logout,currentUser,isDevSession} = useAuth();
  const [tab,setTab]                 = useState('overview');
  const [projects,setProjects]       = useState([]);
  const [messages,setMessages]       = useState([]);
  const [payments,setPayments]       = useState([]);
  const [receiptModal,setReceiptModal] = useState(null);
  const [projectFilter,setProjectFilter] = useState('all');
  const [selProject,setSelProject]   = useState(null);
  const [expanded,setExpanded]       = useState(null);
  const [msgText,setMsgText]         = useState('');
  const [msgSending,setMsgSending]   = useState(false);
  const msgEndRef                    = useRef(null);
  const msgInputRef                  = useRef(null);
  const mainRef                      = useRef(null);

  // Phase 4 1-on-1 Admin Messaging
  const [chatMessages,setChatMessages] = useState([]);
  const [chatInput,setChatInput]       = useState('');
  const [chatSending,setChatSending]   = useState(false);
  const [unreadMsgCount,setUnreadMsgCount] = useState(0);
  const chatEndRef                     = useRef(null);

  const [showReport,setShowReport]   = useState(false);
  const [reportSid,setReportSid]     = useState(null);
  const [reportProj,setReportProj]   = useState(null);
  const [step,setStep]               = useState(1);
  const [reqForm,setReqForm]         = useState({projectTitle:'',serviceType:'',description:'',timeline:'',budget:'',references:'',extraNotes:''});
  const [reqSubmitting,setReqSubmitting] = useState(false);
  const [reqDone,setReqDone]         = useState(false);
  const [reqError,setReqError]       = useState('');
  const [forms,setForms]             = useState([]);
  const [quotes,setQuotes]           = useState([]);
  const [activeForm,setActiveForm]   = useState(null);
  const [formAnswers,setFormAnswers] = useState({});
  const [formSubmitting,setFormSubmitting] = useState(false);
  const [formError,setFormError]     = useState('');

  const client = clientProfile && {projects:[],invoices:[],tickets:[],...clientProfile};
  const uid    = currentUser?.uid;
  const convId = uid ? getConversationId('client', uid) : null;

  useEffect(()=>{ mainRef.current?.scrollTo({top:0,behavior:'smooth'}); },[tab]);

  useEffect(()=>{
    if(!uid) return;
    if(!isFirebaseConfigured||isDevSession){setProjects([]);return;}
    const q=query(collection(db,'projects'),where('clientId','==',uid),orderBy('createdAt','desc'));
    return onSnapshot(q,snap=>setProjects(snap.docs.map(d=>({id:d.id,...d.data()}))));
  },[uid,isDevSession]);

  useEffect(()=>{
    if(!uid) return;
    if(!isFirebaseConfigured||isDevSession){setPayments([]);return;}
    const q=query(collection(db,'payments'),where('clientId','==',uid));
    return onSnapshot(q,snap=>{
      setPayments(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>toMillis(b.createdAt)-toMillis(a.createdAt)));
    },err=>console.error('Client payments listener error',err));
  },[uid,isDevSession]);

  useEffect(()=>{
    if(!uid||!convId) return;
    if(!isFirebaseConfigured||isDevSession){setChatMessages([]);return;}
    const qMsg=query(collection(db,'conversations',convId,'messages'),orderBy('createdAt','asc'));
    const unMsg=onSnapshot(qMsg,snap=>{
      setChatMessages(snap.docs.map(d=>({id:d.id,...d.data()})));
    },err=>console.error('Client chat listener error',err));
    const unConv=onSnapshot(doc(db,'conversations',convId),snap=>{
      if(snap.exists()) setUnreadMsgCount(snap.data().unreadForParticipant||0);
    },err=>console.error('Client conv listener error',err));
    return ()=>{ unMsg(); unConv(); };
  },[uid,convId,isDevSession]);

  useEffect(()=>{
    if(tab==='messages'&&convId){
      markConversationAsRead(convId,'client',isFirebaseConfigured&&!isDevSession);
    }
  },[tab,convId,isDevSession]);

  useEffect(()=>{ chatEndRef.current?.scrollIntoView({behavior:'smooth'}); },[chatMessages]);

  useEffect(()=>{
    if(!selProject){setMessages([]);return;}
    if(!isFirebaseConfigured||isDevSession){setMessages([]);return;}
    const q=query(collection(db,'messages',selProject.id,'chats'),orderBy('timestamp','asc'));
    return onSnapshot(q,snap=>setMessages(snap.docs.map(d=>({id:d.id,...d.data()}))));
  },[selProject,isDevSession]);

  useEffect(()=>{
    if(!uid) return;
    if(!isFirebaseConfigured||isDevSession){setForms([]);setQuotes([]);return;}
    const un1=onSnapshot(query(collection(db,'requirementForms'),where('clientId','==',uid)),snap=>{
      setForms(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>toMillis(b.createdAt)-toMillis(a.createdAt)));
    });
    const un2=onSnapshot(query(collection(db,'quotations'),where('clientId','==',uid)),snap=>{
      setQuotes(snap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.status!=='Draft').sort((a,b)=>toMillis(b.createdAt)-toMillis(a.createdAt)));
    });
    return ()=>{un1&&un1();un2&&un2();};
  },[uid,isDevSession]);

  useEffect(()=>{msgEndRef.current?.scrollIntoView({behavior:'smooth'});},[messages]);

  const handleLogout=async()=>{await logout();navigate('/client-login');};

  if(!client) return(
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0F172A'}}>
      <div style={{width:40,height:40,borderRadius:'50%',border:'3px solid rgba(255,255,255,0.15)',borderTopColor:'#818CF8',animation:'spin 0.8s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const quoteSentCount = quotes.filter(q=>q.status==='Sent').length || projects.filter(p=>p.status==='quotation_sent').length;
  const activeCount    = projects.filter(p=>['In Progress','advance_paid'].includes(p.status)).length;
  const completedCount = projects.filter(p=>p.status==='Completed').length;
  const formsPending   = forms.filter(f=>f.status==='sent').length;

  const totalQuoted = useMemo(() => {
    return quotes.reduce((acc, q) => acc + (toInt(q.totalAmount) || 0), 0);
  }, [quotes]);

  const totalPaid = useMemo(() => {
    return payments.reduce((acc, p) => acc + (toInt(p.amount) || 0), 0);
  }, [payments]);

  const balanceDue = Math.max(0, totalQuoted - totalPaid);

  const handleSendPhase4Chat = async (e) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || chatSending) return;
    setChatSending(true);
    const text = chatInput.trim();
    setChatInput('');
    try {
      const res = await sendChatMessage({
        conversationId: convId,
        type: 'client',
        participantUid: uid,
        participantName: client?.name || 'Client',
        participantRole: 'client',
        participantEmail: client?.email || currentUser?.email || '',
        senderId: uid,
        senderRole: 'client',
        senderName: client?.name || 'Client',
        receiverId: 'admin',
        receiverRole: 'admin',
        receiverName: 'SMART Administration',
        text,
        isLive: isFirebaseConfigured && !isDevSession,
      });
      if (!isFirebaseConfigured || isDevSession) {
        setChatMessages(p => [...p, res]);
      }
    } catch (err) {
      console.error('Failed to send message', err);
    } finally {
      setChatSending(false);
    }
  };

  const sessionGroups = useMemo(()=>{
    const g={};messages.forEach(m=>{const s=m.sessionId||'x';if(!g[s])g[s]=[];g[s].push(m);});return g;
  },[messages]);
  const todaySid = new Date().toISOString().slice(0,10);

  const handleSendMsg=async(e)=>{
    e.preventDefault();if(!msgText.trim()||!selProject) return;
    setMsgSending(true);
    const sid=new Date().toISOString().slice(0,10);
    const m={id:`m${Date.now()}`,senderId:uid,senderName:client.name,senderRole:'client',text:msgText.trim(),sessionId:sid,timestamp:{toDate:()=>new Date()}};
    if(!isFirebaseConfigured||isDevSession){setMessages(p=>[...p,m]);}
    else{try{await addDoc(collection(db,'messages',selProject.id,'chats'),{senderId:uid,senderName:client.name,senderRole:'client',text:msgText.trim(),timestamp:serverTimestamp(),sessionId:sid});}catch(e){console.error(e);}}
    setMsgText('');setMsgSending(false);
  };
  const acceptQuote=async(id)=>{
    if(!isFirebaseConfigured||isDevSession){setProjects(p=>p.map(x=>x.id===id?{...x,status:'quotation_accepted'}:x));return;}
    try{await updateDoc(doc(db,'projects',id),{status:'quotation_accepted',updatedAt:serverTimestamp()});}catch(e){console.error(e);}
  };
  const advancePaid=async(id)=>{
    if(!isFirebaseConfigured||isDevSession){setProjects(p=>p.map(x=>x.id===id?{...x,status:'advance_paid'}:x));return;}
    try{await updateDoc(doc(db,'projects',id),{status:'advance_paid',updatedAt:serverTimestamp(),'payment.advancePaidByClient':true});}catch(e){console.error(e);}
  };
  const handleAcceptLiveQuote=async(q)=>{
    if(!isFirebaseConfigured||isDevSession){
      setQuotes(p=>p.map(x=>x.id===q.id?{...x,status:'Accepted'}:x));
      if(q.projectId) acceptQuote(q.projectId);
      return;
    }
    try{
      await updateDoc(doc(db,'quotations',q.id),{status:'Accepted',acceptedAt:serverTimestamp(),updatedAt:serverTimestamp()});
      if(q.projectId){await updateDoc(doc(db,'projects',q.projectId),{status:'quotation_accepted',updatedAt:serverTimestamp()});}
    }catch(e){console.error(e);}
  };
  // NOTE: called as renderFormField(fld) — NOT used as a JSX element — to avoid remount focus loss
  const renderFormField=(fld)=>{
    const val=formAnswers[fld.id];
    const setVal=v=>setFormAnswers(a=>({...a,[fld.id]:v}));
    const baseLabel=(
      <div style={{display:'block',fontSize:13,fontWeight:700,color:'#CBD5E1',marginBottom:6}}>
        {fld.label} {fld.required&&<span style={{color:'#EF4444'}}>*</span>}
      </div>
    );
    if(fld.type==='textarea') return(
      <div key={fld.id}>{baseLabel}
        <textarea rows={4} value={val||''} onChange={e=>setVal(e.target.value)} className={iCls} style={{resize:'none'}}/>
      </div>
    );
    if(fld.type==='number') return(
      <div key={fld.id}>{baseLabel}
        <input type="number" value={val??''} onChange={e=>setVal(e.target.value)} className={iCls}/>
      </div>
    );
    if(fld.type==='select') return(
      <div key={fld.id}>{baseLabel}
        <select value={val||''} onChange={e=>setVal(e.target.value)} className={iCls} style={{appearance:'none',backgroundImage:selChevron,backgroundRepeat:'no-repeat',backgroundPosition:'right 14px center',paddingRight:40}}>
          <option value="">Select...</option>
          {(fld.options||[]).map(o=><option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
    if(fld.type==='radio') return(
      <div key={fld.id}>{baseLabel}
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          {(fld.options||[]).map(o=>{
            const on=val===o;
            return(
              <label key={o} style={{
                display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderRadius:12,cursor:'pointer',
                background:on?'rgba(79,70,229,0.18)':'rgba(255,255,255,0.05)',border:`1px solid ${on?'rgba(129,140,248,0.5)':'rgba(255,255,255,0.12)'}`,
                transition:'all 0.15s',fontSize:13,fontWeight:on?700:500,color:on?'#4F46E5':'#334155',
              }}>
                <input type="radio" name={fld.id} checked={on} onChange={()=>setVal(o)} style={{accentColor:'#4F46E5'}}/>
                {o}
              </label>
            );
          })}
        </div>
      </div>
    );
    if(fld.type==='checkbox'){const arr=Array.isArray(val)?val:[];return(
      <div key={fld.id}>{baseLabel}
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          {(fld.options||[]).map(o=>{
            const on=arr.includes(o);
            return(
              <label key={o} style={{
                display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderRadius:12,cursor:'pointer',
                background:on?'rgba(79,70,229,0.18)':'rgba(255,255,255,0.05)',border:`1px solid ${on?'rgba(129,140,248,0.5)':'rgba(255,255,255,0.12)'}`,
                transition:'all 0.15s',fontSize:13,fontWeight:on?700:500,color:on?'#4F46E5':'#334155',
              }}>
                <input type="checkbox" checked={on} onChange={()=>setVal(on?arr.filter(x=>x!==o):[...arr,o])} style={{accentColor:'#4F46E5'}}/>
                {o}
              </label>
            );
          })}
        </div>
      </div>
    );}
    if(fld.type==='file'){const files=Array.isArray(val)?val:[];return(
      <div key={fld.id}>{baseLabel}
        <label style={{
          display:'flex',alignItems:'center',justifyContent:'center',gap:8,padding:'14px',
          borderRadius:12,border:'1.5px dashed rgba(129,140,248,0.4)',background:'rgba(99,102,241,0.08)',
          cursor:'pointer',fontSize:13,fontWeight:700,color:'#A5B4FC',transition:'all 0.15s',
        }}>
          <ClipboardList size={14}/> {files.length?`${files.length} file(s) selected`:'Choose file(s)'}
          <input type="file" accept={CLIENT_FILE_ACCEPTS[fld.fileAccept]||'*/*'} multiple style={{display:'none'}}
            onChange={e=>setVal(Array.from(e.target.files||[]))}/>
        </label>
        {files.length>0&&(
          <div style={{marginTop:6,display:'flex',flexDirection:'column',gap:4}}>
            {files.map((f,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,padding:'6px 10px',borderRadius:8,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.12)'}}>
                <span style={{fontSize:12,color:'#CBD5E1',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>📎 {f.name}</span>
                <button type="button" onClick={()=>setVal(files.filter((_,j)=>j!==i))} style={{background:'none',border:'none',cursor:'pointer',color:'#EF4444',fontSize:13,fontWeight:800,flexShrink:0}}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    );}
    return(
      <div key={fld.id}>{baseLabel}
        <input type="text" value={val||''} onChange={e=>setVal(e.target.value)} className={iCls}/>
      </div>
    );
  };
  const handleFormSubmit=async()=>{
    if(!activeForm) return;
    setFormError('');
    for(const fld of activeForm.fields||[]){
      if(!fld.required) continue;
      const v=formAnswers[fld.id];
      if(fld.type==='checkbox'||fld.type==='file'){if(!Array.isArray(v)||v.length===0){setFormError(`"${fld.label}" is required.`);return;}}
      else if(v==null||String(v).trim()===''){setFormError(`"${fld.label}" is required.`);return;}
    }
    setFormSubmitting(true);
    try{
      const cleaned={};
      for(const [k,v] of Object.entries(formAnswers)){
        if(Array.isArray(v)&&v.length&&v[0] instanceof File){
          if(!isFirebaseConfigured||isDevSession){cleaned[k]=v.map(f=>({name:f.name,url:'#dev-upload'}));}
          else{
            const storage=getStorage();
            const urls=[];
            for(const f of v){
              const r=sRef(storage,`requirement-files/${uid}/${activeForm.id}/${Date.now()}_${f.name}`);
              await uploadBytes(r,f);
              urls.push(await getDownloadURL(r));
            }
            cleaned[k]=urls.map((url,i)=>({name:v[i].name,url}));
          }
        }else cleaned[k]=v;
      }
      if(!isFirebaseConfigured||isDevSession){
        setForms(p=>p.map(f=>f.id===activeForm.id?{...f,answers:cleaned,status:'filled',filledAt:new Date().toISOString()}:f));
      }else{
        await updateDoc(doc(db,'requirementForms',activeForm.id),{answers:cleaned,status:'filled',filledAt:serverTimestamp()});
      }
      setActiveForm(null);setFormAnswers({});setFormError('');
    }catch(e){console.error(e);setFormError('Submission failed. Please try again.');}
    setFormSubmitting(false);
  };
  const submitReq=async(e)=>{
    if(e?.preventDefault) e.preventDefault();setReqError('');
    if(!reqForm.projectTitle.trim()||!reqForm.serviceType||!reqForm.description.trim()){setReqError('Please fill in all required fields.');return;}
    setReqSubmitting(true);
    const payload={clientId:uid,clientName:client.name,clientCompany:client.company||'',status:'requirements_pending',title:reqForm.projectTitle.trim(),serviceType:reqForm.serviceType,description:reqForm.description.trim(),timeline:reqForm.timeline,budget:reqForm.budget,references:reqForm.references.trim(),extraNotes:reqForm.extraNotes.trim(),quotation:null,milestones:[],completion:0,assignedStaff:[]};
    try{
      if(!isFirebaseConfigured||isDevSession){setProjects(prev=>[{id:`dp${Date.now()}`,...payload,createdAt:null},...prev]);}
      else{await addDoc(collection(db,'projects'),{...payload,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});}
      setReqDone(true);setStep(1);setReqForm({projectTitle:'',serviceType:'',description:'',timeline:'',budget:'',references:'',extraNotes:''});
    }catch(err){console.error(err);setReqError('Submission failed. Please try again.');}
    finally{setReqSubmitting(false);}
  };

  // ── SIDEBAR ────────────────────────────────────────────────────
  const SidebarContent=()=>(
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      {/* Brand — full dark-mode logo with tagline */}
      <div style={{padding:'22px 20px 16px',borderBottom:'1px solid rgba(255,255,255,0.07)'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
          <img src="/logos/SMART_LOGO_DM_WTHOT_BG_1.png" alt="SMART Pvt Ltd"
            style={{height:44,width:'auto',maxWidth:168,objectFit:'contain',objectPosition:'left center',display:'block',flexShrink:0,filter:'drop-shadow(0 3px 8px rgba(79,70,229,0.35))'}}
            onError={e=>{e.target.style.display='none';e.target.parentNode.innerHTML='<div style="display:flex;align-items:center;gap:10px"><div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#4F46E5,#7C3AED);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:16;">S</div><div><div style="color:#fff;font-size:14px;font-weight:900;letter-spacing:0.5px;">SMART</div><div style="font-size:10px;font-weight:700;letter-spacing:1.5px;color:rgba(167,139,250,0.9);text-transform:uppercase;">Client Portal</div></div></div>';}}/>
        </div>
        {/* Client chip */}
        <div style={{
          display:'flex',alignItems:'center',gap:10,
          background:'rgba(255,255,255,0.05)',borderRadius:12,padding:'8px 10px',
          border:'1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{
            width:30,height:30,borderRadius:9,flexShrink:0,
            background:'linear-gradient(135deg,#4F46E5,#7C3AED)',
            display:'flex',alignItems:'center',justifyContent:'center',
            fontSize:14,fontWeight:900,color:'#fff',
          }}>{client.name?.[0]?.toUpperCase()||'C'}</div>
          <div style={{minWidth:0}}>
            <div style={{fontSize:12,fontWeight:700,color:'#F1F5F9',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{client.name}</div>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.35)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{client.company}</div>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav style={{flex:1,padding:'10px 10px',overflowY:'auto'}}>
        {NAV.map(({id,label,icon:Icon})=>{
          const badge=id==='quotation'?quoteSentCount:id==='projects'?activeCount:id==='forms'?formsPending:id==='messages'?unreadMsgCount:0;
          const active=tab===id;
          return(
            <button key={id} onClick={()=>setTab(id)} style={{
              width:'100%',display:'flex',alignItems:'center',gap:10,
              padding:'10px 12px',borderRadius:12,marginBottom:2,border:'none',cursor:'pointer',
              background: active ? 'linear-gradient(135deg,rgba(79,70,229,0.4),rgba(124,58,237,0.2))' : 'transparent',
              boxShadow: active ? 'inset 0 0 0 1px rgba(139,92,246,0.3)' : 'none',
              transition:'all 0.15s',
            }}
              onMouseEnter={e=>{ if(!active) e.currentTarget.style.background='rgba(255,255,255,0.05)'; }}
              onMouseLeave={e=>{ if(!active) e.currentTarget.style.background='transparent'; }}>
              {active && <div style={{position:'absolute',left:0,width:3,height:20,borderRadius:'0 3px 3px 0',background:'linear-gradient(180deg,#818CF8,#A78BFA)'}}/>}
              <Icon size={15} style={{color:active?'#A78BFA':'rgba(255,255,255,0.35)',flexShrink:0}}/>
              <span style={{flex:1,textAlign:'left',fontSize:13,fontWeight:active?700:500,color:active?'#E2E8F0':'rgba(255,255,255,0.45)'}}>
                {label}
              </span>
              {badge>0&&(
                <span style={{
                  minWidth:18,height:18,borderRadius:9,
                  background:'linear-gradient(135deg,#EF4444,#F97316)',
                  color:'#fff',fontSize:11,fontWeight:800,
                  display:'flex',alignItems:'center',justifyContent:'center',padding:'0 5px',
                  boxShadow:'0 2px 8px rgba(239,68,68,0.4)',
                }}>{badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div style={{padding:'10px',borderTop:'1px solid rgba(255,255,255,0.06)'}}>
        <button onClick={handleLogout} style={{
          width:'100%',display:'flex',alignItems:'center',gap:10,
          padding:'10px 12px',borderRadius:12,border:'none',cursor:'pointer',background:'transparent',
          color:'rgba(248,113,113,0.7)',fontSize:13,fontWeight:600,transition:'all 0.15s',
        }}
          onMouseEnter={e=>{e.currentTarget.style.background='rgba(239,68,68,0.08)';e.currentTarget.style.color='#F87171';}}
          onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='rgba(248,113,113,0.7)';}}>
          <LogOut size={14}/> Sign Out
        </button>
      </div>
    </div>
  );

  // shared card style — dark slate card with 3D depth (layered shadow + top light edge)
  const cardSt={
    background:'linear-gradient(180deg,#243349 0%,#1E293B 100%)',
    borderRadius:20,
    border:'1px solid rgba(255,255,255,0.09)',
    boxShadow:'0 1px 2px rgba(0,0,0,0.45),0 12px 32px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.08)',
    overflow:'hidden',
    transition:'all 0.2s',
  };
  const iCls="w-full px-4 py-3 rounded-xl text-[15px] border bg-[#141C2E] border-[rgba(255,255,255,0.12)] text-[#F1F5F9] placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all";
  const selChevron="url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

  // ── OVERVIEW ──────────────────────────────────────────────────
  const OverviewTab=()=>{
    const active=projects.filter(p=>['In Progress','advance_paid'].includes(p.status));
    const completed=projects.filter(p=>p.status==='Completed');
    const quoted=projects.filter(p=>p.status==='quotation_sent');
    const reqPending=projects.filter(p=>p.status==='requirements_pending');
    return(
      <div style={{display:'flex',flexDirection:'column',gap:16}}>

        {/* Welcome card */}
        <div style={{
          borderRadius:24,padding:'22px 24px',position:'relative',overflow:'hidden',
          background:'linear-gradient(135deg,#4F46E5 0%,#6D28D9 40%,#7C3AED 100%)',
          boxShadow:'0 8px 32px rgba(79,70,229,0.35)',
        }}>
          <div style={{position:'absolute',top:-30,right:-20,width:160,height:160,borderRadius:'50%',background:'rgba(255,255,255,0.06)'}}/>
          <div style={{position:'absolute',bottom:-40,right:40,width:100,height:100,borderRadius:'50%',background:'rgba(255,255,255,0.04)'}}/>
          <div style={{position:'absolute',top:0,left:0,right:0,height:1,background:'rgba(255,255,255,0.15)'}}/>
          <div style={{position:'relative',display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12}}>
            <div>
              <div style={{color:'rgba(199,210,254,0.8)',fontSize:12,fontWeight:600,marginBottom:4}}>Welcome back 👋</div>
              <div style={{color:'#fff',fontSize:26,fontWeight:900,lineHeight:1.2}}>{client.name}</div>
              <div style={{color:'rgba(199,210,254,0.7)',fontSize:13,marginTop:3}}>{client.company}</div>
            </div>
            <div style={{textAlign:'right',flexShrink:0}}>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:'1px',color:'rgba(199,210,254,0.6)',textTransform:'uppercase',marginBottom:4}}>Client ID</div>
              <div style={{
                fontSize:12,fontWeight:800,color:'#C7D2FE',
                background:'rgba(255,255,255,0.12)',padding:'4px 10px',borderRadius:8,
                border:'1px solid rgba(255,255,255,0.15)',fontFamily:'monospace',letterSpacing:'0.5px',
              }}>{uid?.slice(0,8).toUpperCase()}</div>
            </div>
          </div>
          {/* Mini stats row */}
          <div style={{display:'flex',gap:24,marginTop:20,paddingTop:16,borderTop:'1px solid rgba(255,255,255,0.1)'}}>
            {[{l:'Active',v:active.length,c:'#A5F3FC'},{l:'Completed',v:completed.length,c:'#BBF7D0'},{l:'Total',v:projects.length,c:'#DDD6FE'}].map(s=>(
              <div key={s.l}>
                <div style={{fontSize:22,fontWeight:900,color:s.c,lineHeight:1}}>{s.v}</div>
                <div style={{fontSize:11,color:'rgba(199,210,254,0.65)',marginTop:2}}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 6-Card Summary Grid (Projects, Quotations, Total Quoted, Paid, Balance Due, Messages) */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))',gap:12}}>
          {/* Projects */}
          <button onClick={()=>setTab('projects')} style={{...cardSt,padding:'16px',textAlign:'left',cursor:'pointer'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <span style={{fontSize:12,fontWeight:600,color:'#94A3B8'}}>Projects</span>
              <FolderKanban size={16} style={{color:'#818CF8'}}/>
            </div>
            <div style={{fontSize:22,fontWeight:900,color:'#F1F5F9'}}>{projects.length}</div>
            <div style={{fontSize:11,color:'#818CF8',marginTop:4,fontWeight:600}}>{activeCount} active · {completedCount} completed</div>
          </button>

          {/* Quotations */}
          <button onClick={()=>setTab('quotation')} style={{...cardSt,padding:'16px',textAlign:'left',cursor:'pointer'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <span style={{fontSize:12,fontWeight:600,color:'#94A3B8'}}>Quotations</span>
              <Receipt size={16} style={{color:'#A78BFA'}}/>
            </div>
            <div style={{fontSize:22,fontWeight:900,color:'#F1F5F9'}}>{quotes.length || projects.filter(p=>p.quotation).length}</div>
            <div style={{fontSize:11,color:quoteSentCount>0?'#F59E0B':'#94A3B8',marginTop:4,fontWeight:600}}>
              {quoteSentCount>0 ? `${quoteSentCount} pending review` : 'All reviewed'}
            </div>
          </button>

          {/* Total Quoted */}
          <button onClick={()=>setTab('payments')} style={{...cardSt,padding:'16px',textAlign:'left',cursor:'pointer'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <span style={{fontSize:12,fontWeight:600,color:'#94A3B8'}}>Total Quoted</span>
              <TrendingUp size={16} style={{color:'#60A5FA'}}/>
            </div>
            <div style={{fontSize:18,fontWeight:900,color:'#F1F5F9',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
              {formatLKR(totalQuoted)}
            </div>
            <div style={{fontSize:11,color:'#94A3B8',marginTop:4}}>Approved scope</div>
          </button>

          {/* Total Paid */}
          <button onClick={()=>setTab('payments')} style={{...cardSt,padding:'16px',textAlign:'left',cursor:'pointer'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <span style={{fontSize:12,fontWeight:600,color:'#94A3B8'}}>Total Paid</span>
              <DollarSign size={16} style={{color:'#34D399'}}/>
            </div>
            <div style={{fontSize:18,fontWeight:900,color:'#34D399',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
              {formatLKR(totalPaid)}
            </div>
            <div style={{fontSize:11,color:'#10B981',marginTop:4,fontWeight:600}}>
              {payments.length} receipt{payments.length!==1?'s':''}
            </div>
          </button>

          {/* Balance Due */}
          <button onClick={()=>setTab('payments')} style={{...cardSt,padding:'16px',textAlign:'left',cursor:'pointer'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <span style={{fontSize:12,fontWeight:600,color:'#94A3B8'}}>Balance Due</span>
              <CreditCard size={16} style={{color:balanceDue>0?'#F87171':'#34D399'}}/>
            </div>
            <div style={{fontSize:18,fontWeight:900,color:balanceDue>0?'#F87171':'#34D399',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
              {formatLKR(balanceDue)}
            </div>
            <div style={{fontSize:11,color:balanceDue>0?'#FCA5A5':'#34D399',marginTop:4,fontWeight:600}}>
              {balanceDue>0?'Payment pending':'Settled in full'}
            </div>
          </button>

          {/* Messages */}
          <button onClick={()=>setTab('messages')} style={{...cardSt,padding:'16px',textAlign:'left',cursor:'pointer'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <span style={{fontSize:12,fontWeight:600,color:'#94A3B8'}}>Messages</span>
              <MessageSquare size={16} style={{color:'#C084FC'}}/>
            </div>
            <div style={{fontSize:22,fontWeight:900,color:'#F1F5F9'}}>{unreadMsgCount}</div>
            <div style={{fontSize:11,color:unreadMsgCount>0?'#EF4444':'#94A3B8',marginTop:4,fontWeight:600}}>
              {unreadMsgCount>0?`${unreadMsgCount} unread message${unreadMsgCount>1?'s':''}`:'Direct Admin line'}
            </div>
          </button>
        </div>

        {/* Alert banners */}
        {formsPending>0&&(
          <button onClick={()=>setTab('forms')} style={{
            width:'100%',display:'flex',alignItems:'center',gap:12,padding:'13px 16px',borderRadius:16,
            border:'1px solid rgba(245,158,11,0.25)',background:'linear-gradient(135deg,rgba(254,243,199,0.8),rgba(255,251,235,0.6))',
            cursor:'pointer',textAlign:'left',transition:'all 0.2s',
          }}
            onMouseEnter={e=>e.currentTarget.style.transform='scale(1.01)'}
            onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
            <div style={{width:36,height:36,borderRadius:10,background:'rgba(245,158,11,0.15)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <ClipboardList size={16} style={{color:'#D97706'}}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700,color:'#92400E'}}>{formsPending} form{formsPending>1?'s':''} waiting to be filled</div>
              <div style={{fontSize:12,color:'#B45309',marginTop:1}}>Open My Forms and submit so we can prepare your quotation →</div>
            </div>
            <ChevronRight size={16} style={{color:'#D97706',flexShrink:0}}/>
          </button>
        )}
        {reqPending.length>0&&(
          <button onClick={()=>setTab('projects')} style={{
            width:'100%',display:'flex',alignItems:'center',gap:12,padding:'13px 16px',borderRadius:16,
            border:'1px solid rgba(245,158,11,0.25)',background:'linear-gradient(135deg,rgba(254,243,199,0.8),rgba(255,251,235,0.6))',
            cursor:'pointer',textAlign:'left',transition:'all 0.2s',
          }}
            onMouseEnter={e=>e.currentTarget.style.transform='scale(1.01)'}
            onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
            <div style={{width:36,height:36,borderRadius:10,background:'rgba(245,158,11,0.15)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <Clock size={16} style={{color:'#D97706'}}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700,color:'#92400E'}}>{reqPending.length} request{reqPending.length>1?'s':''} under review</div>
              <div style={{fontSize:12,color:'#B45309',marginTop:1}}>We're reviewing your request — quotation coming soon →</div>
            </div>
            <ChevronRight size={16} style={{color:'#D97706',flexShrink:0}}/>
          </button>
        )}
        {quoted.length>0&&(
          <button onClick={()=>setTab('quotation')} style={{
            width:'100%',display:'flex',alignItems:'center',gap:12,padding:'13px 16px',borderRadius:16,
            border:'1px solid rgba(139,92,246,0.25)',background:'linear-gradient(135deg,rgba(237,233,254,0.8),rgba(245,243,255,0.6))',
            cursor:'pointer',textAlign:'left',transition:'all 0.2s',
          }}
            onMouseEnter={e=>e.currentTarget.style.transform='scale(1.01)'}
            onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
            <div style={{width:36,height:36,borderRadius:10,background:'rgba(139,92,246,0.15)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <Bell size={16} style={{color:'#7C3AED'}}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700,color:'#5B21B6'}}>{quoted.length} quotation waiting for your review</div>
              <div style={{fontSize:12,color:'#6D28D9',marginTop:1}}>Tap to review and accept →</div>
            </div>
            <ChevronRight size={16} style={{color:'#7C3AED',flexShrink:0}}/>
          </button>
        )}

        {/* Active projects */}
        {active.length>0&&(
          <>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{fontSize:15,fontWeight:800,color:'#F1F5F9'}}>Active Projects</div>
              <button onClick={()=>setTab('projects')} style={{background:'none',border:'none',cursor:'pointer',fontSize:13,fontWeight:600,color:'#818CF8',display:'flex',alignItems:'center',gap:4}}>
                See all <ChevronRight size={13}/>
              </button>
            </div>
            {active.map(proj=>{
              const staff=getStaffByIds(proj.assignedStaff||[]);
              const done=(proj.milestones||[]).filter(m=>m.done).length;
              const tot=(proj.milestones||[]).length;
              return(
                <div key={proj.id} onClick={()=>setTab('projects')} style={{...cardSt,padding:'18px 20px',cursor:'pointer'}}
                  onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 2px 4px rgba(0,0,0,0.5),0 18px 40px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,255,255,0.1)';}}
                  onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 1px 2px rgba(0,0,0,0.45),0 12px 32px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.08)';}}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10,marginBottom:12}}>
                    <div style={{minWidth:0}}>
                      <div style={{fontSize:15,fontWeight:800,color:'#F1F5F9',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{proj.title}</div>
                      <div style={{fontSize:12,color:'#94A3B8',marginTop:2}}>{proj.serviceType}</div>
                    </div>
                    <Chip status={proj.status}/>
                  </div>
                  <div style={{marginBottom:8}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:5}}>
                      <span style={{color:'#94A3B8'}}>{tot>0?`${done}/${tot} milestones`:'Progress'}</span>
                      <span style={{fontWeight:800,color:'#A5B4FC'}}>{proj.completion||0}%</span>
                    </div>
                    <div style={{height:6,borderRadius:4,background:'rgba(255,255,255,0.08)',overflow:'hidden'}}>
                      <div style={{
                        height:'100%',borderRadius:4,transition:'width 0.6s ease',
                        width:`${proj.completion||0}%`,
                        background:'linear-gradient(90deg,#4F46E5,#7C3AED,#A78BFA)',
                        boxShadow:'0 0 10px rgba(79,70,229,0.4)',
                      }}/>
                    </div>
                  </div>
                  {staff.length>0&&(
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{display:'flex'}}>
                        {staff.map((s,i)=>(
                          <div key={s.id} title={s.name} style={{
                            width:24,height:24,borderRadius:'50%',
                            background:`linear-gradient(135deg,${['#4F46E5','#7C3AED','#EC4899','#F59E0B'][i%4]},${['#7C3AED','#A78BFA','#F9A8D4','#FCD34D'][i%4]})`,
                            border:'2px solid #1E293B',marginLeft:i>0?-6:0,
                            display:'flex',alignItems:'center',justifyContent:'center',
                            color:'#fff',fontSize:10,fontWeight:900,flexShrink:0,
                          }}>{s.avatar}</div>
                        ))}
                      </div>
                      <span style={{fontSize:12,color:'#94A3B8'}}>{staff.map(s=>s.name.split(' ')[0]).join(' & ')}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* New project CTA */}
        <button onClick={()=>setTab('requirements')} style={{
          width:'100%',display:'flex',alignItems:'center',gap:14,padding:'16px 18px',borderRadius:20,
          border:'1.5px dashed rgba(79,70,229,0.25)',
          background:'linear-gradient(135deg,rgba(99,102,241,0.16),rgba(124,58,237,0.09))',
          cursor:'pointer',textAlign:'left',transition:'all 0.2s',
        }}
          onMouseEnter={e=>{e.currentTarget.style.transform='scale(1.01)';e.currentTarget.style.borderColor='rgba(79,70,229,0.5)';}}
          onMouseLeave={e=>{e.currentTarget.style.transform='scale(1)';e.currentTarget.style.borderColor='rgba(79,70,229,0.25)';}}>
          <div style={{
            width:42,height:42,borderRadius:13,flexShrink:0,
            background:'linear-gradient(135deg,#4F46E5,#7C3AED)',
            display:'flex',alignItems:'center',justifyContent:'center',
            boxShadow:'0 4px 14px rgba(79,70,229,0.35)',
          }}><Zap size={20} style={{color:'#fff'}}/></div>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:800,color:'#F1F5F9'}}>Start a new project</div>
            <div style={{fontSize:12,color:'#94A3B8',marginTop:2}}>Tell us what you need — we'll send a quote</div>
          </div>
          <div style={{
            display:'flex',alignItems:'center',gap:6,padding:'8px 16px',borderRadius:10,
            background:'linear-gradient(135deg,#4F46E5,#7C3AED)',color:'#fff',
            fontSize:13,fontWeight:800,boxShadow:'0 4px 12px rgba(79,70,229,0.35)',flexShrink:0,
          }}><Plus size={14}/> Start</div>
        </button>

        {projects.length===0&&(
          <div style={{textAlign:'center',padding:'40px 0',display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
            <div style={{width:56,height:56,borderRadius:16,background:'linear-gradient(135deg,rgba(79,70,229,0.1),rgba(124,58,237,0.05))',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Sparkles size={24} style={{color:'#6D28D9'}}/>
            </div>
            <div style={{fontSize:15,fontWeight:800,color:'#F1F5F9'}}>Your portal is ready!</div>
            <div style={{fontSize:13,color:'#94A3B8'}}>Submit a project request to get started.</div>
          </div>
        )}
      </div>
    );
  };

  // ── PROJECTS TAB ──────────────────────────────────────────────
  const ProjectsTab=()=>{
    const filteredProjects = projects.filter(p => {
      if (projectFilter === 'active') return ['In Progress', 'advance_paid', 'quotation_accepted', 'requirements_pending'].includes(p.status);
      if (projectFilter === 'completed') return p.status === 'Completed';
      return true;
    });

    return (
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
          <div>
            <div style={{fontSize:17,fontWeight:900,color:'#F1F5F9'}}>My Projects</div>
            <div style={{fontSize:12,color:'#94A3B8',marginTop:2}}>All active and completed engagements with SMART Pvt Ltd</div>
          </div>
          {/* Status filter pills */}
          <div style={{display:'flex',gap:6,background:'rgba(255,255,255,0.04)',padding:3,borderRadius:12,border:'1px solid rgba(255,255,255,0.08)'}}>
            {[
              {id:'all', label:'All', count:projects.length},
              {id:'active', label:'Active', count:activeCount},
              {id:'completed', label:'Completed', count:completedCount},
            ].map(f=>(
              <button key={f.id} onClick={()=>setProjectFilter(f.id)} style={{
                padding:'5px 12px',borderRadius:9,border:'none',cursor:'pointer',fontSize:12,fontWeight:700,
                background:projectFilter===f.id?'linear-gradient(135deg,#4F46E5,#7C3AED)':'transparent',
                color:projectFilter===f.id?'#fff':'#94A3B8',transition:'all 0.15s',
              }}>
                {f.label} ({f.count})
              </button>
            ))}
          </div>
        </div>

        {filteredProjects.length===0&&(
          <div style={{...cardSt,padding:'48px 24px',textAlign:'center'}}>
            <FolderKanban size={36} style={{color:'#CBD5E1',margin:'0 auto 12px'}}/>
            <div style={{fontSize:14,color:'#94A3B8'}}>
              {projectFilter==='completed'?'No completed projects yet.':projectFilter==='active'?'No active projects currently.':'No projects yet.'}
            </div>
            {projectFilter==='all'&&(
              <button onClick={()=>setTab('requirements')} style={{background:'none',border:'none',cursor:'pointer',fontSize:13,fontWeight:700,color:'#A5B4FC',marginTop:8}}>+ Start your first project</button>
            )}
          </div>
        )}

        {filteredProjects.map(proj=>{
          const isExp=expanded===proj.id;
          const staff=getStaffByIds(proj.assignedStaff||[]);
          const done=(proj.milestones||[]).filter(m=>m.done).length;
          const isCompleted=proj.status==='Completed';

          return(
            <div key={proj.id} style={{
              ...cardSt,
              borderColor: isCompleted ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.09)',
              background: isCompleted ? 'linear-gradient(180deg,#1c332e 0%,#182a26 100%)' : cardSt.background
            }}>
              <button style={{width:'100%',padding:'16px 20px',textAlign:'left',background:'none',border:'none',cursor:'pointer'}}
                onClick={()=>setExpanded(isExp?null:proj.id)}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                      <Chip status={proj.status}/>
                      {isCompleted&&(
                        <span style={{
                          display:'inline-flex',alignItems:'center',gap:4,
                          padding:'3px 9px',borderRadius:6,
                          background:'rgba(16,185,129,0.2)',border:'1px solid rgba(16,185,129,0.4)',
                          color:'#34D399',fontSize:11,fontWeight:800,letterSpacing:'0.3px',textTransform:'uppercase'
                        }}>
                          <CheckCircle2 size={12}/> Completed & Delivered
                        </span>
                      )}
                    </div>
                    <div style={{fontSize:16,fontWeight:800,color:'#F1F5F9',marginTop:6,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{proj.title}</div>
                    <div style={{fontSize:12,color:'#94A3B8',marginTop:2}}>{proj.serviceType}</div>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4,flexShrink:0}}>
                    <span style={{fontSize:17,fontWeight:900,color:isCompleted?'#34D399':'#A5B4FC'}}>{proj.completion||0}%</span>
                    {isExp?<ChevronUp size={15} style={{color:'#CBD5E1'}}/>:<ChevronDown size={15} style={{color:'#CBD5E1'}}/>}
                  </div>
                </div>
                <div style={{marginTop:12,height:6,borderRadius:3,background:'rgba(255,255,255,0.08)',overflow:'hidden'}}>
                  <div style={{
                    height:'100%',borderRadius:3,width:`${proj.completion||0}%`,
                    background:isCompleted?'linear-gradient(90deg,#10B981,#059669,#34D399)':'linear-gradient(90deg,#4F46E5,#7C3AED)',
                    transition:'width 0.6s',boxShadow:isCompleted?'0 0 10px rgba(16,185,129,0.4)':'0 0 8px rgba(79,70,229,0.3)'
                  }}/>
                </div>
              </button>

              {isExp&&(
                <div style={{padding:'0 20px 20px',borderTop:'1px solid rgba(255,255,255,0.08)',paddingTop:16,display:'flex',flexDirection:'column',gap:14}}>
                  {isCompleted&&(
                    <div style={{
                      padding:'14px 16px',borderRadius:14,background:'rgba(16,185,129,0.12)',border:'1px solid rgba(16,185,129,0.3)',
                      display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'
                    }}>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <div style={{width:34,height:34,borderRadius:10,background:'rgba(16,185,129,0.25)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                          <Award size={18} style={{color:'#10B981'}}/>
                        </div>
                        <div>
                          <div style={{fontSize:13,fontWeight:800,color:'#34D399'}}>Project Successfully Completed</div>
                          <div style={{fontSize:11,color:'#A7F3D0',marginTop:1}}>All deliverables, assets, and source milestones finalized.</div>
                        </div>
                      </div>
                      <button onClick={()=>setTab('completion')} style={{
                        padding:'6px 14px',borderRadius:8,border:'none',background:'linear-gradient(135deg,#10B981,#059669)',
                        color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer'
                      }}>
                        View Sign-off & Warranty →
                      </button>
                    </div>
                  )}

                  {(proj.milestones||[]).length>0&&(
                    <div>
                      <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.8px',color:'#94A3B8',marginBottom:10}}>
                        Milestones — {done}/{proj.milestones.length} done
                      </div>
                      <div style={{display:'flex',flexDirection:'column',gap:8}}>
                        {proj.milestones.map((m,i)=>{
                          const isCurrent=i===proj.milestones.findIndex(x=>!x.done);
                          return(
                            <div key={i} style={{display:'flex',alignItems:'center',gap:10}}>
                              <div style={{
                                width:20,height:20,borderRadius:'50%',flexShrink:0,
                                display:'flex',alignItems:'center',justifyContent:'center',
                                background:m.done?'linear-gradient(135deg,#10B981,#059669)':isCurrent?'rgba(99,102,241,0.25)':'rgba(255,255,255,0.05)',
                                border:m.done?'none':isCurrent?'2px solid #818CF8':'2px solid rgba(255,255,255,0.2)',
                                boxShadow:m.done?'0 2px 8px rgba(16,185,129,0.3)':isCurrent?'0 0 0 3px rgba(79,70,229,0.1)':'none',
                              }}>
                                {m.done&&<CheckCircle2 size={12} style={{color:'#fff'}}/>}
                                {!m.done&&isCurrent&&<div style={{width:6,height:6,borderRadius:'50%',background:'#4F46E5'}}/>}
                              </div>
                              <span style={{fontSize:13,fontWeight:m.done?500:600,color:m.done?'#94A3B8':isCurrent?'#818CF8':'#CBD5E1',textDecoration:m.done?'line-through':'none'}}>
                                {m.title}
                              </span>
                              {m.done&&<span style={{fontSize:11,fontWeight:700,color:'#10B981',background:'rgba(16,185,129,0.1)',padding:'2px 7px',borderRadius:6}}>Done</span>}
                              {!m.done&&isCurrent&&<span style={{fontSize:11,fontWeight:700,color:'#A5B4FC',background:'rgba(99,102,241,0.16)',padding:'2px 7px',borderRadius:6}}>Active</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {staff.length>0&&(
                    <div>
                      <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.8px',color:'#94A3B8',marginBottom:8}}>Assigned Team</div>
                      <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                        {staff.map(s=>(
                          <div key={s.id} style={{
                            display:'flex',alignItems:'center',gap:8,padding:'6px 12px 6px 8px',borderRadius:20,
                            background:'rgba(99,102,241,0.1)',border:'1px solid rgba(99,102,241,0.28)',
                          }}>
                            <div className={s.avatarColor} style={{width:26,height:26,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:11,fontWeight:900,flexShrink:0}}>
                              {s.avatar}
                            </div>
                            <div>
                              <div style={{fontSize:12,fontWeight:700,color:'#CBD5E1'}}>{s.name}</div>
                              <div style={{fontSize:11,color:'#94A3B8'}}>{s.role}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                    <button onClick={()=>setTab('progress')} style={{
                      flex:1,minWidth:160,display:'flex',alignItems:'center',justifyContent:'center',gap:6,
                      padding:'10px',borderRadius:12,border:'1px solid rgba(99,102,241,0.28)',background:'rgba(99,102,241,0.1)',
                      cursor:'pointer',fontSize:13,fontWeight:700,color:'#A5B4FC'
                    }}>
                      <Activity size={14}/> View Full Progress
                    </button>
                    <button onClick={()=>setTab('messages')} style={{
                      flex:1,minWidth:160,display:'flex',alignItems:'center',justifyContent:'center',gap:6,
                      padding:'10px',borderRadius:12,border:'none',background:'linear-gradient(135deg,#4F46E5,#7C3AED)',
                      cursor:'pointer',fontSize:13,fontWeight:700,color:'#fff'
                    }}>
                      <MessageSquare size={14}/> Message Admin
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ── PROJECT PROGRESS TAB ──────────────────────────────────────
  const ProgressTab = () => {
    const activeProjs = projects.filter(p => p.status !== 'Completed');
    return (
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontSize:17,fontWeight:900,color:'#F1F5F9'}}>Project Progress & Milestones</div>
            <div style={{fontSize:12,color:'#94A3B8',marginTop:2}}>Live tracking of development, design, and delivery phases</div>
          </div>
        </div>
        {activeProjs.length === 0 ? (
          <div style={{...cardSt,padding:'48px 24px',textAlign:'center'}}>
            <Activity size={36} style={{color:'#CBD5E1',margin:'0 auto 12px'}}/>
            <div style={{fontSize:15,fontWeight:800,color:'#F1F5F9'}}>No active projects currently in progress</div>
            <div style={{fontSize:13,color:'#94A3B8',marginTop:4}}>
              {completedCount > 0 ? 'All your projects are completed! Check the Project Completion tab.' : 'Submit a project request to begin.'}
            </div>
          </div>
        ) : (
          activeProjs.map(proj => {
            const done = (proj.milestones || []).filter(m => m.done).length;
            const tot = (proj.milestones || []).length;
            const staff = getStaffByIds(proj.assignedStaff || []);
            return (
              <div key={proj.id} style={{...cardSt,padding:'20px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,marginBottom:16}}>
                  <div>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                      <Chip status={proj.status}/>
                      <span style={{fontSize:12,color:'#94A3B8'}}>{proj.serviceType}</span>
                    </div>
                    <div style={{fontSize:17,fontWeight:900,color:'#F1F5F9'}}>{proj.title}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:24,fontWeight:900,color:'#818CF8'}}>{proj.completion || 0}%</div>
                    <div style={{fontSize:11,color:'#94A3B8'}}>{tot > 0 ? `${done} of ${tot} milestones` : 'Overall completion'}</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{height:8,borderRadius:4,background:'rgba(255,255,255,0.08)',overflow:'hidden',marginBottom:20}}>
                  <div style={{height:'100%',borderRadius:4,width:`${proj.completion||0}%`,background:'linear-gradient(90deg,#4F46E5,#7C3AED,#38BDF8)',boxShadow:'0 0 12px rgba(79,70,229,0.4)',transition:'width 0.6s'}}/>
                </div>

                {/* Milestones timeline */}
                {(proj.milestones || []).length > 0 ? (
                  <div style={{marginBottom:18}}>
                    <div style={{fontSize:12,fontWeight:700,color:'#94A3B8',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:12}}>Milestone Timeline</div>
                    <div style={{display:'flex',flexDirection:'column',gap:10}}>
                      {proj.milestones.map((m, i) => {
                        const isCurrent = i === proj.milestones.findIndex(x => !x.done);
                        return (
                          <div key={i} style={{
                            display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:12,
                            background: m.done ? 'rgba(16,185,129,0.06)' : isCurrent ? 'rgba(79,70,229,0.12)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${m.done ? 'rgba(16,185,129,0.2)' : isCurrent ? 'rgba(129,140,248,0.4)' : 'rgba(255,255,255,0.06)'}`,
                          }}>
                            <div style={{
                              width:24,height:24,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',
                              background: m.done ? 'linear-gradient(135deg,#10B981,#059669)' : isCurrent ? '#4F46E5' : 'rgba(255,255,255,0.08)',
                              color:'#fff',fontSize:11,fontWeight:800,flexShrink:0
                            }}>
                              {m.done ? <Check size={14}/> : i + 1}
                            </div>
                            <div style={{flex:1}}>
                              <div style={{fontSize:13,fontWeight:m.done||isCurrent?700:500,color:m.done?'#94A3B8':isCurrent?'#F1F5F9':'#64748B',textDecoration:m.done?'line-through':'none'}}>
                                {m.title}
                              </div>
                            </div>
                            {m.done ? (
                              <span style={{fontSize:11,fontWeight:700,color:'#10B981',background:'rgba(16,185,129,0.1)',padding:'3px 8px',borderRadius:6}}>Completed</span>
                            ) : isCurrent ? (
                              <span style={{fontSize:11,fontWeight:700,color:'#818CF8',background:'rgba(79,70,229,0.2)',padding:'3px 8px',borderRadius:6,display:'flex',alignItems:'center',gap:4}}>
                                <span style={{width:6,height:6,borderRadius:'50%',background:'#818CF8',animation:'pulse 1.5s infinite'}}/> In Progress
                              </span>
                            ) : (
                              <span style={{fontSize:11,color:'#64748B'}}>Upcoming</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div style={{padding:'12px 14px',borderRadius:12,background:'rgba(255,255,255,0.03)',color:'#94A3B8',fontSize:13,marginBottom:16}}>
                    Milestones are being scheduled by the project management team.
                  </div>
                )}

                {/* Team and Actions */}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingTop:14,borderTop:'1px solid rgba(255,255,255,0.07)',flexWrap:'wrap',gap:10}}>
                  {staff.length > 0 ? (
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <span style={{fontSize:12,color:'#94A3B8'}}>Assigned Team:</span>
                      <div style={{display:'flex',gap:6}}>
                        {staff.map(s => (
                          <div key={s.id} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 10px',borderRadius:16,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)'}}>
                            <div className={s.avatarColor} style={{width:20,height:20,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:10,fontWeight:800}}>{s.avatar}</div>
                            <span style={{fontSize:12,color:'#E2E8F0',fontWeight:600}}>{s.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : <div/>}
                  <button onClick={()=>setTab('messages')} style={{
                    padding:'8px 14px',borderRadius:10,border:'1px solid rgba(129,140,248,0.3)',background:'rgba(79,70,229,0.15)',
                    color:'#A5B4FC',fontSize:12,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:6
                  }}>
                    <MessageSquare size={13}/> Message Admin about this project
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  };

  // ── QUOTATIONS ────────────────────────────────────────────────
  const QuotationTab=()=>{
    // Live ERP quotations (status !== Draft); legacy fallback from embedded project.quotation
    const projQuoted=quotes.length===0?projects.filter(p=>['quotation_sent','quotation_accepted','advance_paid'].includes(p.status)&&p.quotation):[];
    return(
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        <div style={{fontSize:17,fontWeight:900,color:'#F1F5F9'}}>Quotations</div>
        {quotes.length===0&&projQuoted.length===0&&<div style={{...cardSt,padding:'48px 24px',textAlign:'center'}}><Receipt size={36} style={{color:'#CBD5E1',margin:'0 auto 12px'}}/><div style={{fontSize:14,color:'#94A3B8'}}>No quotations yet.</div></div>}

        {/* Live ERP quotations */}
        {quotes.map(q=>(
          <div key={q.id} style={cardSt}>
            <div style={{padding:'16px 20px',borderBottom:'1px solid rgba(255,255,255,0.08)',display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10}}>
              <div>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                  <span style={{fontSize:11,fontWeight:800,color:'#A5B4FC',fontFamily:'monospace'}}>{q.quotationNo}</span>
                  <Chip status={q.status}/>
                </div>
                <div style={{fontSize:15,fontWeight:800,color:'#F1F5F9'}}>{q.projectTitle||q.service||'Quotation'}</div>
                <div style={{fontSize:12,color:'#94A3B8',marginTop:2}}>{q.service}</div>
              </div>
            </div>
            <div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:14}}>
              <div style={{
                display:'flex',justifyContent:'space-between',alignItems:'center',
                padding:'14px 18px',borderRadius:16,
                background:'linear-gradient(135deg,rgba(99,102,241,0.14),rgba(124,58,237,0.08))',border:'1px solid rgba(99,102,241,0.25)',
              }}>
                <div>
                  <div style={{fontSize:12,color:'#94A3B8',marginBottom:2}}>Total Amount</div>
                  <div style={{fontSize:26,fontWeight:900,color:'#F1F5F9'}}>{formatLKR(toInt(q.totalAmount))}</div>
                </div>
                {toInt(q.advanceAmount)>0&&<div style={{textAlign:'right'}}>
                  <div style={{fontSize:12,color:'#94A3B8',marginBottom:2}}>Advance</div>
                  <div style={{fontSize:16,fontWeight:800,color:'#059669'}}>{formatLKR(toInt(q.advanceAmount))}</div>
                </div>}
              </div>
              {(q.items||[]).length>0&&(
                <div>
                  <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.8px',color:'#94A3B8',marginBottom:8}}>Breakdown</div>
                  {q.items.map((b,i)=>(
                    <div key={b.id||i} style={{display:'flex',justifyContent:'space-between',fontSize:13,padding:'7px 0',borderBottom:i<q.items.length-1?'1px solid #F1F5F9':'none'}}>
                      <span style={{color:'#94A3B8'}}>{b.label}</span>
                      <span style={{fontWeight:700,color:'#CBD5E1'}}>{formatLKR(toInt(b.amount))}</span>
                    </div>
                  ))}
                </div>
              )}
              {q.paymentTerms&&<div style={{fontSize:12,color:'#94A3B8',background:'rgba(255,255,255,0.05)',padding:'10px 14px',borderRadius:12,lineHeight:1.6}}>📋 {q.paymentTerms}</div>}
              {q.notes&&<div style={{fontSize:12,color:'#94A3B8',background:'rgba(255,255,255,0.05)',padding:'10px 14px',borderRadius:12,lineHeight:1.6}}>📋 {q.notes}</div>}
              {q.validUntil&&<div style={{fontSize:12,color:'#94A3B8',display:'flex',alignItems:'center',gap:4}}><Clock size={11}/> Valid until {q.validUntil}</div>}
              {q.status==='Sent'&&(
                <button onClick={()=>handleAcceptLiveQuote(q)} style={{
                  width:'100%',padding:'13px',borderRadius:14,border:'none',cursor:'pointer',
                  fontSize:14,fontWeight:800,color:'#fff',
                  background:'linear-gradient(135deg,#10B981,#059669)',
                  boxShadow:'0 4px 16px rgba(16,185,129,0.3)',transition:'all 0.2s',
                }}
                  onMouseEnter={e=>e.currentTarget.style.transform='scale(1.01)'}
                  onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
                  ✅ Accept Quotation
                </button>
              )}
              {q.status==='Accepted'&&(
                q.projectId?(
                  <button onClick={()=>advancePaid(q.projectId)} style={{
                    width:'100%',padding:'13px',borderRadius:14,border:'none',cursor:'pointer',
                    fontSize:14,fontWeight:800,color:'#fff',
                    background:'linear-gradient(135deg,#4F46E5,#7C3AED)',
                    boxShadow:'0 4px 16px rgba(79,70,229,0.3)',transition:'all 0.2s',
                  }}
                    onMouseEnter={e=>e.currentTarget.style.transform='scale(1.01)'}
                    onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
                    💳 Confirm Advance Payment
                  </button>
                ):(
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,padding:'12px',borderRadius:14,background:'rgba(59,130,246,0.08)',border:'1px solid rgba(59,130,246,0.2)',fontSize:14,fontWeight:700,color:'#1D4ED8'}}>
                    <CheckCircle2 size={16}/> Quotation Accepted — admin will confirm your advance payment
                  </div>
                )
              )}
              {['Advance Paid','In Progress'].includes(q.status)&&(
                <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,padding:'12px',borderRadius:14,background:'rgba(16,185,129,0.08)',border:'1px solid rgba(16,185,129,0.2)',fontSize:14,fontWeight:700,color:'#059669'}}>
                  <CheckCircle2 size={16}/> Advance Paid — Work Starting Soon!
                </div>
              )}
              {q.status==='Completed'&&(
                <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,padding:'12px',borderRadius:14,background:'rgba(16,185,129,0.08)',border:'1px solid rgba(16,185,129,0.2)',fontSize:14,fontWeight:700,color:'#059669'}}>
                  <CheckCircle2 size={16}/> Completed — Thank you for your business!
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Legacy fallback — projects with embedded quotation */}
        {projQuoted.map(proj=>(
          <div key={proj.id} style={cardSt}>
            <div style={{padding:'16px 20px',borderBottom:'1px solid rgba(255,255,255,0.08)',display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10}}>
              <div>
                <div style={{fontSize:15,fontWeight:800,color:'#F1F5F9'}}>{proj.title}</div>
                <div style={{fontSize:12,color:'#94A3B8',marginTop:2}}>{proj.serviceType}</div>
              </div>
              <Chip status={proj.status}/>
            </div>
            {proj.quotation&&(
              <div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:14}}>
                <div style={{
                  display:'flex',justifyContent:'space-between',alignItems:'center',
                  padding:'14px 18px',borderRadius:16,
                  background:'linear-gradient(135deg,rgba(99,102,241,0.14),rgba(124,58,237,0.08))',border:'1px solid rgba(99,102,241,0.25)',
                }}>
                  <div>
                    <div style={{fontSize:12,color:'#94A3B8',marginBottom:2}}>Total Amount</div>
                    <div style={{fontSize:26,fontWeight:900,color:'#F1F5F9'}}>{proj.quotation.totalAmount}</div>
                  </div>
                  {proj.quotation.advanceAmount&&<div style={{textAlign:'right'}}>
                    <div style={{fontSize:12,color:'#94A3B8',marginBottom:2}}>Advance</div>
                    <div style={{fontSize:16,fontWeight:800,color:'#059669'}}>{proj.quotation.advanceAmount}</div>
                  </div>}
                </div>
                {proj.quotation.breakdown?.length>0&&(
                  <div>
                    <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.8px',color:'#94A3B8',marginBottom:8}}>Breakdown</div>
                    {proj.quotation.breakdown.map((b,i)=>(
                      <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:13,padding:'7px 0',borderBottom:i<proj.quotation.breakdown.length-1?'1px solid #F1F5F9':'none'}}>
                        <span style={{color:'#94A3B8'}}>{b.label}</span>
                        <span style={{fontWeight:700,color:'#CBD5E1'}}>{b.amount}</span>
                      </div>
                    ))}
                  </div>
                )}
                {proj.quotation.notes&&<div style={{fontSize:12,color:'#94A3B8',background:'rgba(255,255,255,0.05)',padding:'10px 14px',borderRadius:12,lineHeight:1.6}}>📋 {proj.quotation.notes}</div>}
                {proj.quotation.validUntil&&<div style={{fontSize:12,color:'#94A3B8',display:'flex',alignItems:'center',gap:4}}><Clock size={11}/> Valid until {proj.quotation.validUntil}</div>}
                {proj.status==='quotation_sent'&&(
                  <button onClick={()=>acceptQuote(proj.id)} style={{
                    width:'100%',padding:'13px',borderRadius:14,border:'none',cursor:'pointer',
                    fontSize:14,fontWeight:800,color:'#fff',
                    background:'linear-gradient(135deg,#10B981,#059669)',
                    boxShadow:'0 4px 16px rgba(16,185,129,0.3)',transition:'all 0.2s',
                  }}
                    onMouseEnter={e=>e.currentTarget.style.transform='scale(1.01)'}
                    onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
                    ✅ Accept Quotation
                  </button>
                )}
                {proj.status==='quotation_accepted'&&(
                  <button onClick={()=>advancePaid(proj.id)} style={{
                    width:'100%',padding:'13px',borderRadius:14,border:'none',cursor:'pointer',
                    fontSize:14,fontWeight:800,color:'#fff',
                    background:'linear-gradient(135deg,#4F46E5,#7C3AED)',
                    boxShadow:'0 4px 16px rgba(79,70,229,0.3)',transition:'all 0.2s',
                  }}
                    onMouseEnter={e=>e.currentTarget.style.transform='scale(1.01)'}
                    onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
                    💳 Confirm Advance Payment
                  </button>
                )}
                {proj.status==='advance_paid'&&(
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,padding:'12px',borderRadius:14,background:'rgba(16,185,129,0.08)',border:'1px solid rgba(16,185,129,0.2)',fontSize:14,fontWeight:700,color:'#059669'}}>
                    <CheckCircle2 size={16}/> Advance Paid — Work Starting Soon!
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // ── PAYMENTS & BALANCE TAB ────────────────────────────────────
  const PaymentsTab = () => (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <div>
        <div style={{fontSize:17,fontWeight:900,color:'#F1F5F9'}}>Payments & Balance</div>
        <div style={{fontSize:12,color:'#94A3B8',marginTop:2}}>Overview of project billing, advance receipts, and settlement balance</div>
      </div>

      {/* 3 Financial Metric Cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))',gap:12}}>
        <div style={{...cardSt,padding:'18px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
            <span style={{fontSize:12,fontWeight:600,color:'#94A3B8'}}>Total Quoted Amount</span>
            <Receipt size={16} style={{color:'#818CF8'}}/>
          </div>
          <div style={{fontSize:22,fontWeight:900,color:'#F1F5F9'}}>{formatLKR(totalQuoted)}</div>
          <div style={{fontSize:11,color:'#94A3B8',marginTop:4}}>Approved scope for all projects</div>
        </div>

        <div style={{...cardSt,padding:'18px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
            <span style={{fontSize:12,fontWeight:600,color:'#94A3B8'}}>Total Paid / Advance</span>
            <CheckCircle2 size={16} style={{color:'#10B981'}}/>
          </div>
          <div style={{fontSize:22,fontWeight:900,color:'#34D399'}}>{formatLKR(totalPaid)}</div>
          <div style={{fontSize:11,color:'#10B981',marginTop:4,fontWeight:600}}>{payments.length} verified payment{payments.length!==1?'s':''}</div>
        </div>

        <div style={{...cardSt,padding:'18px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
            <span style={{fontSize:12,fontWeight:600,color:'#94A3B8'}}>Outstanding Balance</span>
            <CreditCard size={16} style={{color:balanceDue>0?'#F87171':'#34D399'}}/>
          </div>
          <div style={{fontSize:22,fontWeight:900,color:balanceDue>0?'#F87171':'#34D399'}}>{formatLKR(balanceDue)}</div>
          <div style={{fontSize:11,color:balanceDue>0?'#FCA5A5':'#34D399',marginTop:4,fontWeight:600}}>
            {balanceDue>0?'Payable upon next milestone':'Fully settled'}
          </div>
        </div>
      </div>

      {/* Payment History Table */}
      <div style={cardSt}>
        <div style={{padding:'16px 20px',borderBottom:'1px solid rgba(255,255,255,0.08)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontSize:15,fontWeight:800,color:'#F1F5F9'}}>Payment History</div>
            <div style={{fontSize:12,color:'#94A3B8',marginTop:2}}>All recorded payments with verifiable receipts</div>
          </div>
          {payments.length>0&&(
            <button onClick={()=>setTab('receipts')} style={{fontSize:12,fontWeight:700,color:'#818CF8',background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>
              Download receipts <ChevronRight size={13}/>
            </button>
          )}
        </div>

        {payments.length === 0 ? (
          <div style={{padding:'40px 20px',textAlign:'center'}}>
            <CreditCard size={36} style={{color:'#CBD5E1',margin:'0 auto 12px'}}/>
            <div style={{fontSize:14,color:'#94A3B8'}}>No payments recorded yet.</div>
            <div style={{fontSize:12,color:'#64748B',marginTop:4}}>Once payment is received and verified by finance, receipts will appear here.</div>
          </div>
        ) : (
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,textAlign:'left'}}>
              <thead>
                <tr style={{borderBottom:'1px solid rgba(255,255,255,0.06)',background:'rgba(255,255,255,0.02)'}}>
                  <th style={{padding:'12px 18px',color:'#94A3B8',fontWeight:700,fontSize:11,textTransform:'uppercase'}}>Receipt #</th>
                  <th style={{padding:'12px 18px',color:'#94A3B8',fontWeight:700,fontSize:11,textTransform:'uppercase'}}>Date</th>
                  <th style={{padding:'12px 18px',color:'#94A3B8',fontWeight:700,fontSize:11,textTransform:'uppercase'}}>Method & Ref</th>
                  <th style={{padding:'12px 18px',color:'#94A3B8',fontWeight:700,fontSize:11,textTransform:'uppercase',textAlign:'right'}}>Amount</th>
                  <th style={{padding:'12px 18px',color:'#94A3B8',fontWeight:700,fontSize:11,textTransform:'uppercase',textAlign:'center'}}>Status</th>
                  <th style={{padding:'12px 18px',color:'#94A3B8',fontWeight:700,fontSize:11,textTransform:'uppercase',textAlign:'right'}}>Action</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id} style={{borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                    <td style={{padding:'14px 18px',fontWeight:700,color:'#A5B4FC',fontFamily:'monospace'}}>
                      {p.receiptNo || 'RCT-000'}
                    </td>
                    <td style={{padding:'14px 18px',color:'#CBD5E1'}}>{p.date || '—'}</td>
                    <td style={{padding:'14px 18px',color:'#CBD5E1'}}>
                      <div style={{fontWeight:600}}>{p.method || 'Transfer'}</div>
                      {p.reference && <div style={{fontSize:11,color:'#94A3B8',fontFamily:'monospace'}}>Ref: {p.reference}</div>}
                    </td>
                    <td style={{padding:'14px 18px',fontWeight:900,color:'#34D399',textAlign:'right'}}>
                      {formatLKR(toInt(p.amount))}
                    </td>
                    <td style={{padding:'14px 18px',textAlign:'center'}}>
                      <span style={{fontSize:11,fontWeight:800,color:'#10B981',background:'rgba(16,185,129,0.12)',border:'1px solid rgba(16,185,129,0.25)',padding:'3px 8px',borderRadius:6}}>
                        Paid
                      </span>
                    </td>
                    <td style={{padding:'14px 18px',textAlign:'right'}}>
                      <button onClick={()=>setReceiptModal(p)} style={{
                        padding:'6px 12px',borderRadius:8,border:'1px solid rgba(129,140,248,0.3)',background:'rgba(79,70,229,0.15)',
                        color:'#A5B4FC',fontSize:12,fontWeight:700,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:4
                      }}>
                        <FileText size={12}/> View Receipt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  // ── RECEIPTS TAB ──────────────────────────────────────────────
  const ReceiptsTab = () => (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <div>
        <div style={{fontSize:17,fontWeight:900,color:'#F1F5F9'}}>Official Payment Receipts</div>
        <div style={{fontSize:12,color:'#94A3B8',marginTop:2}}>View and download official PDF receipts for your accounting and tax records</div>
      </div>

      {payments.length === 0 ? (
        <div style={{...cardSt,padding:'48px 24px',textAlign:'center'}}>
          <FileText size={36} style={{color:'#CBD5E1',margin:'0 auto 12px'}}/>
          <div style={{fontSize:15,fontWeight:800,color:'#F1F5F9'}}>No receipts available</div>
          <div style={{fontSize:13,color:'#94A3B8',marginTop:4}}>Receipts are generated immediately whenever a payment is confirmed.</div>
        </div>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))',gap:14}}>
          {payments.map(p => (
            <div key={p.id} style={{...cardSt,padding:'20px',display:'flex',flexDirection:'column',justifyContent:'space-between',gap:14}}>
              <div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                  <div style={{fontSize:12,fontWeight:800,color:'#A5B4FC',fontFamily:'monospace',background:'rgba(79,70,229,0.15)',padding:'3px 8px',borderRadius:6,border:'1px solid rgba(129,140,248,0.3)'}}>
                    {p.receiptNo || 'RCT-000'}
                  </div>
                  <span style={{fontSize:11,fontWeight:700,color:'#10B981',background:'rgba(16,185,129,0.12)',border:'1px solid rgba(16,185,129,0.25)',padding:'3px 8px',borderRadius:6}}>
                    Official Verified
                  </span>
                </div>
                <div style={{fontSize:15,fontWeight:800,color:'#F1F5F9'}}>{p.projectTitle || 'Project Payment'}</div>
                <div style={{fontSize:12,color:'#94A3B8',marginTop:4}}>Date: {p.date || '—'} · {p.method || 'Payment'}</div>
                {p.notes && <div style={{fontSize:12,color:'#CBD5E1',marginTop:6,background:'rgba(255,255,255,0.03)',padding:'6px 10px',borderRadius:8}}>📝 {p.notes}</div>}
              </div>

              <div style={{paddingTop:12,borderTop:'1px solid rgba(255,255,255,0.06)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontSize:11,color:'#94A3B8'}}>Amount Paid</div>
                  <div style={{fontSize:18,fontWeight:900,color:'#34D399'}}>{formatLKR(toInt(p.amount))}</div>
                </div>
                <button onClick={()=>setReceiptModal(p)} style={{
                  padding:'8px 14px',borderRadius:10,border:'none',background:'linear-gradient(135deg,#4F46E5,#7C3AED)',
                  color:'#fff',fontSize:12,fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',gap:6,
                  boxShadow:'0 4px 12px rgba(79,70,229,0.35)'
                }}>
                  <Download size={13}/> View & PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── PROJECT COMPLETION TAB ────────────────────────────────────
  const CompletionTab = () => {
    const completedProjs = projects.filter(p => p.status === 'Completed');
    return (
      <div style={{display:'flex',flexDirection:'column',gap:16}}>
        <div>
          <div style={{fontSize:17,fontWeight:900,color:'#F1F5F9'}}>Project Completion & Delivery</div>
          <div style={{fontSize:12,color:'#94A3B8',marginTop:2}}>Delivered solutions, warranty coverage, and completion sign-offs</div>
        </div>

        {completedProjs.length === 0 ? (
          <div style={{...cardSt,padding:'48px 24px',textAlign:'center'}}>
            <Award size={36} style={{color:'#CBD5E1',margin:'0 auto 12px'}}/>
            <div style={{fontSize:15,fontWeight:800,color:'#F1F5F9'}}>No completed projects yet</div>
            <div style={{fontSize:13,color:'#94A3B8',marginTop:4}}>
              When a project reaches 100% completion and final sign-off, its completion certificate and warranty details will appear here.
            </div>
          </div>
        ) : (
          completedProjs.map(proj => (
            <div key={proj.id} style={{...cardSt,padding:'24px',display:'flex',flexDirection:'column',gap:16,borderColor:'rgba(16,185,129,0.3)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,flexWrap:'wrap'}}>
                <div>
                  <div style={{display:'inline-flex',alignItems:'center',gap:6,padding:'4px 10px',borderRadius:8,background:'rgba(16,185,129,0.15)',border:'1px solid rgba(16,185,129,0.3)',color:'#34D399',fontSize:12,fontWeight:800,marginBottom:8}}>
                    <CheckCircle2 size={14}/> Successfully Delivered & Live
                  </div>
                  <div style={{fontSize:20,fontWeight:900,color:'#F1F5F9'}}>{proj.title}</div>
                  <div style={{fontSize:13,color:'#94A3B8',marginTop:2}}>{proj.serviceType}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:22,fontWeight:900,color:'#10B981'}}>100%</div>
                  <div style={{fontSize:11,color:'#94A3B8'}}>All Milestones Completed</div>
                </div>
              </div>

              {/* Warranty & SLA details */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))',gap:12,background:'rgba(255,255,255,0.03)',padding:'16px',borderRadius:16,border:'1px solid rgba(255,255,255,0.06)'}}>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:'#94A3B8',textTransform:'uppercase'}}>Warranty Period</div>
                  <div style={{fontSize:14,fontWeight:800,color:'#F1F5F9',marginTop:3}}>90 Days Complimentary Support</div>
                  <div style={{fontSize:11,color:'#10B981',marginTop:2}}>Bug fixes & maintenance included</div>
                </div>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:'#94A3B8',textTransform:'uppercase'}}>Handover Status</div>
                  <div style={{fontSize:14,fontWeight:800,color:'#F1F5F9',marginTop:3}}>Credentials & Source Live</div>
                  <div style={{fontSize:11,color:'#94A3B8',marginTop:2}}>Documentation transferred</div>
                </div>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:'#94A3B8',textTransform:'uppercase'}}>Ongoing Maintenance</div>
                  <div style={{fontSize:14,fontWeight:800,color:'#A5B4FC',marginTop:3}}>Optional SLA Plan</div>
                  <div style={{fontSize:11,color:'#94A3B8',marginTop:2}}>Monthly support available</div>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{display:'flex',justifyContent:'flex-end',gap:10,paddingTop:8}}>
                <button onClick={()=>setTab('requirements')} style={{
                  padding:'10px 18px',borderRadius:12,border:'none',background:'linear-gradient(135deg,#4F46E5,#7C3AED)',
                  color:'#fff',fontSize:13,fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',gap:6
                }}>
                  <Plus size={14}/> Request Phase 2 / New Scope
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    );
  };

  // ── MESSAGES TAB (Phase 4 Real Admin 1-on-1 Chat) ─────────────
  const MessagesTab = () => {
    return (
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontSize:17,fontWeight:900,color:'#F1F5F9'}}>Messages</div>
            <div style={{fontSize:12,color:'#94A3B8',marginTop:2}}>Direct 1-on-1 communication channel with SMART Administration</div>
          </div>
        </div>

        <div style={{...cardSt,display:'flex',flexDirection:'column',height:520}}>
          {/* Chat Header */}
          <div style={{
            padding:'14px 18px',borderBottom:'1px solid rgba(255,255,255,0.08)',
            display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,
            background:'linear-gradient(135deg,rgba(79,70,229,0.15),rgba(124,58,237,0.08))'
          }}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{
                width:36,height:36,borderRadius:10,background:'linear-gradient(135deg,#4F46E5,#7C3AED)',
                display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:14,fontWeight:900
              }}>
                S
              </div>
              <div>
                <div style={{fontSize:14,fontWeight:800,color:'#F1F5F9'}}>SMART Administration</div>
                <div style={{display:'flex',alignItems:'center',gap:5,marginTop:2}}>
                  <span style={{width:6,height:6,borderRadius:'50%',background:'#10B981',animation:'pulse 2s infinite'}}/>
                  <span style={{fontSize:11,color:'#94A3B8'}}>Direct Administrative Support · Mon–Sat 9AM–6PM</span>
                </div>
              </div>
            </div>
            <div style={{
              fontSize:11,fontWeight:700,color:'#A5B4FC',background:'rgba(79,70,229,0.15)',
              border:'1px solid rgba(129,140,248,0.25)',padding:'4px 10px',borderRadius:20
            }}>
              Direct Admin Line
            </div>
          </div>

          {/* Message stream */}
          <div style={{flex:1,overflowY:'auto',padding:'16px',display:'flex',flexDirection:'column',gap:12}}>
            {chatMessages.length === 0 ? (
              <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8,padding:'40px 0'}}>
                <MessageSquare size={36} style={{color:'#CBD5E1'}}/>
                <span style={{fontSize:14,fontWeight:700,color:'#F1F5F9'}}>Start a conversation with Admin</span>
                <span style={{fontSize:12,color:'#94A3B8',maxWidth:320,textAlign:'center'}}>
                  Ask any questions about your quotations, project progress, payments, or invoices. Our team replies promptly.
                </span>
              </div>
            ) : (
              chatMessages.map((msg, idx) => {
                const isMe = msg.senderId === uid || msg.senderRole === 'client';
                const time = msg.createdAt ? new Date(toMillis(msg.createdAt)).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : 'Just now';
                return (
                  <div key={msg.id || idx} style={{
                    display:'flex',justifyContent:isMe?'flex-end':'flex-start',alignItems:'flex-end',gap:8
                  }}>
                    {!isMe && (
                      <div style={{
                        width:30,height:30,borderRadius:9,background:'linear-gradient(135deg,#3B82F6,#1D4ED8)',
                        display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:12,fontWeight:900,flexShrink:0,marginBottom:2
                      }}>
                        A
                      </div>
                    )}
                    <div style={{maxWidth:'75%',display:'flex',flexDirection:'column',gap:3,alignItems:isMe?'flex-end':'flex-start'}}>
                      <div style={{fontSize:11,fontWeight:600,color:'#94A3B8',paddingLeft:isMe?0:2,paddingRight:isMe?2:0}}>
                        {isMe ? 'You' : (msg.senderName || 'SMART Administration')}
                      </div>
                      <div style={{
                        padding:'10px 14px',borderRadius:isMe?'16px 16px 4px 16px':'16px 16px 16px 4px',
                        fontSize:14,lineHeight:1.5,
                        background:isMe?'linear-gradient(135deg,#4F46E5,#6D28D9)':'#243349',
                        color:'#fff',
                        boxShadow:isMe?'0 4px 14px rgba(79,70,229,0.3)':'0 1px 4px rgba(0,0,0,0.3)',
                        border:isMe?'none':'1px solid rgba(255,255,255,0.08)',
                        wordBreak:'break-word'
                      }}>
                        {msg.text}
                      </div>
                      <span style={{fontSize:10,color:'#64748B',padding:'0 4px'}}>{time}</span>
                    </div>
                    {isMe && (
                      <div style={{
                        width:30,height:30,borderRadius:9,background:'linear-gradient(135deg,#4F46E5,#7C3AED)',
                        display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:12,fontWeight:900,flexShrink:0,marginBottom:2
                      }}>
                        {client?.name?.[0]?.toUpperCase() || 'C'}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={chatEndRef}/>
          </div>

          {/* Input form */}
          <form onSubmit={handleSendPhase4Chat} style={{
            padding:'12px 14px',borderTop:'1px solid rgba(255,255,255,0.08)',display:'flex',gap:10,alignItems:'center',background:'#141C2E'
          }}>
            <input
              type="text"
              value={chatInput}
              onChange={e=>setChatInput(e.target.value)}
              placeholder="Type your message to SMART Administration... (Press Enter to send)"
              autoComplete="off"
              onKeyDown={e=>{
                if(e.key==='Enter'&&!e.shiftKey){
                  e.preventDefault();
                  handleSendPhase4Chat(e);
                }
              }}
              style={{
                flex:1,padding:'11px 18px',borderRadius:20,border:'1px solid rgba(255,255,255,0.12)',background:'#1E293B',
                fontSize:14,color:'#F1F5F9',outline:'none',transition:'all 0.15s'
              }}
              onFocus={e=>{e.target.style.borderColor='#818CF8';e.target.style.boxShadow='0 0 0 3px rgba(79,70,229,0.15)';}}
              onBlur={e=>{e.target.style.borderColor='rgba(255,255,255,0.12)';e.target.style.boxShadow='none';}}
            />
            <button
              type="submit"
              disabled={!chatInput.trim()||chatSending}
              style={{
                width:42,height:42,borderRadius:'50%',border:'none',cursor:'pointer',
                background:'linear-gradient(135deg,#4F46E5,#7C3AED)',display:'flex',alignItems:'center',justifyContent:'center',
                opacity:chatInput.trim()&&!chatSending?1:0.4,flexShrink:0,
                boxShadow:'0 4px 14px rgba(79,70,229,0.4)',transition:'all 0.15s'
              }}
            >
              <Send size={16} style={{color:'#fff'}}/>
            </button>
          </form>
        </div>
      </div>
    );
  };

  // ── INVOICES ──────────────────────────────────────────────────
  const InvoicesTab=()=>(
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div style={{fontSize:17,fontWeight:900,color:'#F1F5F9'}}>Invoices</div>
      {!client.invoices?.length?<div style={{...cardSt,padding:'48px 24px',textAlign:'center'}}><FileText size={36} style={{color:'#CBD5E1',margin:'0 auto 12px'}}/><div style={{fontSize:14,color:'#94A3B8'}}>No invoices yet.</div></div>
      :<div style={{display:'flex',flexDirection:'column',gap:8}}>{client.invoices.map(inv=>(
        <div key={inv.id} style={{...cardSt,padding:'14px 18px',display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}><span style={{fontSize:11,fontWeight:800,color:'#A5B4FC',fontFamily:'monospace'}}>{inv.id}</span><Chip status={inv.status}/></div>
            <div style={{fontSize:14,fontWeight:700,color:'#F1F5F9'}}>{inv.description}</div>
            <div style={{fontSize:12,color:'#94A3B8',marginTop:2}}>{inv.date}</div>
          </div>
          <div style={{fontSize:17,fontWeight:900,color:'#F1F5F9',flexShrink:0}}>{inv.amount}</div>
        </div>
      ))}</div>}
      <div style={{textAlign:'center',fontSize:12,color:'#94A3B8'}}>Invoice queries? <a href="mailto:accounts@smartpvtltd.com" style={{color:'#A5B4FC',fontWeight:600,textDecoration:'none'}}>accounts@smartpvtltd.com</a></div>
    </div>
  );

  // ── SUPPORT ───────────────────────────────────────────────────
  const SupportTab=()=>(
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div style={{fontSize:17,fontWeight:900,color:'#F1F5F9'}}>Support</div>
      <div style={cardSt}>
        <div style={{padding:'14px 18px 8px',fontSize:13,fontWeight:700,color:'#94A3B8'}}>Need help? Contact us directly</div>
        <div style={{padding:'4px 12px 14px',display:'flex',flexDirection:'column',gap:8}}>
          <a href={`https://wa.me/${company.contact.whatsapp.replace(/\D/g,'')}?text=${encodeURIComponent('Hi SMART Support, I need help.')}`}
            target="_blank" rel="noopener noreferrer" style={{
              display:'flex',alignItems:'center',gap:12,padding:'13px 14px',borderRadius:14,textDecoration:'none',transition:'all 0.15s',
              background:'linear-gradient(135deg,rgba(37,211,102,0.06),rgba(18,140,126,0.03))',border:'1px solid rgba(37,211,102,0.2)',
            }}
            onMouseEnter={e=>e.currentTarget.style.transform='scale(1.01)'}
            onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
            <div style={{width:38,height:38,borderRadius:12,background:'linear-gradient(135deg,#25D366,#128C7E)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 3px 10px rgba(37,211,102,0.3)',flexShrink:0}}>
              <MessageSquare size={17} style={{color:'#fff'}}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:700,color:'#065F46'}}>WhatsApp Support</div>
              <div style={{fontSize:12,color:'#6EE7B7',marginTop:1}}>Fastest — typically replies in minutes</div>
            </div>
            <ExternalLink size={14} style={{color:'#10B981',flexShrink:0}}/>
          </a>
          <a href={`tel:${company.contact.phone}`} style={{
            display:'flex',alignItems:'center',gap:12,padding:'13px 14px',borderRadius:14,textDecoration:'none',transition:'all 0.15s',
            background:'rgba(99,102,241,0.1)',border:'1px solid rgba(99,102,241,0.28)',
          }}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(99,102,241,0.22)'}
            onMouseLeave={e=>e.currentTarget.style.background='rgba(99,102,241,0.12)'}>
            <div style={{width:38,height:38,borderRadius:12,background:'linear-gradient(135deg,#4F46E5,#7C3AED)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 3px 10px rgba(79,70,229,0.25)',flexShrink:0}}>
              <Phone size={17} style={{color:'#fff'}}/>
            </div>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:'#F1F5F9'}}>Call Us</div>
              <div style={{fontSize:12,color:'#94A3B8',marginTop:1}}>{company.contact.phoneDisplay}</div>
            </div>
          </a>
        </div>
      </div>
      <div style={{textAlign:'center',fontSize:12,color:'#94A3B8'}}>
        Response: <strong style={{color:'#CBD5E1'}}>2–4 hrs</strong> · Hours: <strong style={{color:'#CBD5E1'}}>{company.contact.businessHours}</strong>
      </div>
    </div>
  );

  const TABS={
    overview:   <OverviewTab/>,
    projects:   <ProjectsTab/>,
    progress:   <ProgressTab/>,
    quotation:  <QuotationTab/>,
    payments:   <PaymentsTab/>,
    receipts:   <ReceiptsTab/>,
    completion: <CompletionTab/>,
    messages:   <MessagesTab/>,
    invoices:   <InvoicesTab/>,
    support:    <SupportTab/>,
  };

  // Page meta for topbar
  const PAGE_META = {
    overview:     {title:'Dashboard',          sub:'Welcome to your client portal'},
    projects:     {title:'My Projects',        sub:'Track your active & completed projects'},
    progress:     {title:'Project Progress',   sub:'Live timeline, phase milestones & status'},
    quotation:    {title:'Quotations',         sub:'Review and accept your quotations'},
    payments:     {title:'Payments & Balance', sub:'Financial summary & full transaction history'},
    receipts:     {title:'Official Receipts',  sub:'Verified e-receipts available for PDF download'},
    completion:   {title:'Project Completion', sub:'Delivered projects, warranty terms & handover'},
    messages:     {title:'Messages',           sub:'Direct 1-on-1 line with SMART Administration'},
    forms:        {title:'My Forms',           sub:'Requirement forms sent by our team — fill & submit'},
    requirements: {title:'New Request',        sub:'Submit a new project requirement'},
    invoices:     {title:'Invoices',           sub:'View your billing and payments'},
    support:      {title:'Support',            sub:'Get help from our team'},
  };
  const currentPage = PAGE_META[tab] || PAGE_META.overview;

  // ── LAYOUT ────────────────────────────────────────────────────
  return(
    <div style={{minHeight:'100vh',display:'flex',background:'#0F172A'}}>
      <SEO title="My Dashboard" description="SMART Pvt Ltd client portal." noIndex/>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse2{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(0.95)}}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(99,102,241,0.3);border-radius:4px}
        ::-webkit-scrollbar-thumb:hover{background:rgba(99,102,241,0.5)}
        @media(min-width:1024px){.lg-sidebar{display:flex!important;flex-direction:column}}
        /* Press feedback — touch + mouse: every button visibly responds */
        button{transition:transform .12s ease,box-shadow .15s ease,background .15s ease,border-color .15s ease,opacity .15s ease,filter .15s ease}
        button:active:not(:disabled){transform:scale(.95);filter:brightness(1.2)}
        button:focus-visible{outline:2px solid rgba(129,140,248,0.7);outline-offset:2px}
        /* Hover brightening — pointer devices only (no sticky hover on touch) */
        @media(hover:hover){button:hover:not(:disabled){filter:brightness(1.15)}}
        button:not(:disabled){cursor:pointer}
        /* Cards — subtle 3D hover lift */
        [class*="card"]{will-change:transform}
        @media print {
          body * { visibility: hidden !important; }
          #printable-receipt, #printable-receipt * { visibility: visible !important; }
          #printable-receipt {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 36px !important;
            margin: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      {/* ── Sidebar (desktop) ── */}
      <aside style={{
        width:220,flexShrink:0,position:'sticky',top:0,height:'100vh',
        background:'linear-gradient(175deg,#0D0A2E 0%,#1A1050 50%,#0D0A2E 100%)',
        borderRight:'1px solid rgba(255,255,255,0.05)',
        boxShadow:'4px 0 32px rgba(0,0,0,0.4)',
        display:'none',
      }} className="lg-sidebar">
        <SidebarContent/>
      </aside>

      {/* ── Main column ── */}
      <div style={{flex:1,display:'flex',flexDirection:'column',minWidth:0}}>

        {/* ── TOPBAR ── */}
        <header style={{
          position:'sticky',top:0,zIndex:40,
          background:'rgba(15,23,42,0.92)',
          backdropFilter:'blur(20px)',
          WebkitBackdropFilter:'blur(20px)',
          borderBottom:'1px solid rgba(255,255,255,0.08)',
          boxShadow:'0 4px 20px rgba(0,0,0,0.35),inset 0 -1px 0 rgba(255,255,255,0.04)',
          padding:'0 24px',
          height:60,
          display:'flex',
          alignItems:'center',
          gap:16,
        }}>
          {/* Logo — mobile only (sidebar owns the brand on desktop) */}
          <div className="tb-brand" style={{display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
            <img
              src="/logos/SMART_LOGO_DM_WTHOT_BG_1.png"
              alt="SMART Pvt Ltd"
              style={{height:34,width:'auto',maxWidth:150,objectFit:'contain',objectPosition:'left center',display:'block',flexShrink:0,filter:'drop-shadow(0 2px 6px rgba(79,70,229,0.35))'}}
              onError={e=>{e.target.style.display='none';e.target.parentNode.innerHTML='<div style=&quot;width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#4F46E5,#7C3AED);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;&quot;>S</div>';}}
            />
            {/* Brand text — hidden on mobile */}
            <div style={{display:'flex',flexDirection:'column'}} className="brand-text">
              <span style={{fontSize:14,fontWeight:900,color:'#fff',letterSpacing:'0.3px',lineHeight:1}}>SMART</span>
              <span style={{fontSize:10,fontWeight:700,color:'rgba(167,139,250,0.8)',letterSpacing:'1.2px',textTransform:'uppercase',lineHeight:1.4}}>Client Portal</span>
            </div>
          </div>

          {/* Divider — hidden with the topbar brand on desktop */}
          <div className="tb-brand" style={{width:1,height:28,background:'rgba(255,255,255,0.08)',flexShrink:0}}/>

          {/* Page title — reflects current tab */}
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:16,fontWeight:800,color:'#F1F5F9',letterSpacing:'-0.2px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
              {currentPage.title}
            </div>
            <div style={{fontSize:12,color:'rgba(148,163,184,0.7)',marginTop:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
              {currentPage.sub}
            </div>
          </div>

          {/* Right actions */}
          <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
            {/* Notification bell */}
            {quoteSentCount>0&&(
              <button onClick={()=>setTab('quotation')} style={{
                position:'relative',width:36,height:36,borderRadius:10,
                background:'rgba(79,70,229,0.15)',border:'1px solid rgba(79,70,229,0.3)',
                display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',
                transition:'all 0.15s',
              }}
                onMouseEnter={e=>{e.currentTarget.style.background='rgba(79,70,229,0.25)';}}
                onMouseLeave={e=>{e.currentTarget.style.background='rgba(79,70,229,0.15)';}}>
                <Bell size={15} style={{color:'#A78BFA'}}/>
                <span style={{
                  position:'absolute',top:-4,right:-4,
                  width:16,height:16,borderRadius:'50%',
                  background:'linear-gradient(135deg,#EF4444,#F97316)',
                  color:'#fff',fontSize:10,fontWeight:900,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  border:'2px solid #0F172A',
                }}>{quoteSentCount}</span>
              </button>
            )}
            {/* Client avatar */}
            <div style={{
              width:34,height:34,borderRadius:10,
              background:'linear-gradient(135deg,#4F46E5,#7C3AED)',
              display:'flex',alignItems:'center',justifyContent:'center',
              color:'#fff',fontSize:14,fontWeight:900,flexShrink:0,
              boxShadow:'0 4px 12px rgba(79,70,229,0.35),inset 0 1px 0 rgba(255,255,255,0.2)',
              cursor:'default',
            }} title={client.name}>
              {client.name?.[0]?.toUpperCase()||'C'}
            </div>
          </div>
        </header>

        {/* ── Mobile nav tabs ── */}
        <div style={{
          display:'flex',alignItems:'center',gap:4,padding:'8px 12px',overflowX:'auto',
          background:'rgba(15,23,42,0.95)',
          borderBottom:'1px solid rgba(255,255,255,0.05)',
        }} className="mobile-tabs">
          {NAV.map(({id,label,icon:Icon})=>{
            const badge=id==='quotation'?quoteSentCount:id==='forms'?formsPending:id==='messages'?unreadMsgCount:0;
            const active=tab===id;
            return(
              <button key={id} onClick={()=>setTab(id)} style={{
                position:'relative',display:'flex',flexDirection:'column',alignItems:'center',gap:2,
                padding:'6px 9px',borderRadius:10,border:'none',cursor:'pointer',flexShrink:0,
                background:active?'rgba(79,70,229,0.3)':'transparent',
                color:active?'#A78BFA':'rgba(255,255,255,0.35)',
                fontSize:10,fontWeight:700,transition:'all 0.15s',
                boxShadow:active?'inset 0 0 0 1px rgba(139,92,246,0.4)':'none',
              }}>
                <Icon size={13}/>
                <span style={{whiteSpace:'nowrap'}}>{label}</span>
                {badge>0&&<span style={{position:'absolute',top:-2,right:-2,width:13,height:13,borderRadius:'50%',background:'#EF4444',color:'#fff',fontSize:9,fontWeight:900,display:'flex',alignItems:'center',justifyContent:'center',border:'1.5px solid #0F172A'}}>{badge}</span>}
              </button>
            );
          })}
          <button onClick={handleLogout} style={{marginLeft:'auto',display:'flex',flexDirection:'column',alignItems:'center',gap:2,padding:'6px 9px',borderRadius:10,border:'none',cursor:'pointer',background:'transparent',color:'rgba(248,113,113,0.6)',fontSize:10,fontWeight:700,flexShrink:0}}>
            <LogOut size={13}/><span>Out</span>
          </button>
        </div>
        <style>{`@media(min-width:1024px){.mobile-tabs{display:none!important}.tb-brand{display:none!important}}.brand-text{display:none}`}</style>

        {/* ── Page content ── */}
        <main ref={mainRef} style={{
          flex:1,overflowY:'auto',
          padding:'28px 28px 40px',
          maxWidth:1100,width:'100%',
          margin:'0 auto',
          boxSizing:'border-box',
        }}>
          {TABS[tab]}
          {tab==='forms'&&(
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div style={{fontSize:17,fontWeight:900,color:'#F1F5F9'}}>My Forms</div>
              {activeForm?(
                <div style={{...cardSt,padding:'20px',display:'flex',flexDirection:'column',gap:14}}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10}}>
                    <div>
                      <div style={{fontSize:15,fontWeight:800,color:'#F1F5F9'}}>{activeForm.formType||'Requirement Form'}</div>
                      <div style={{fontSize:12,color:'#94A3B8',marginTop:2}}>Sent {activeForm.sentAt||'—'} · {activeForm.isCustom?'Custom form':'Standard checklist'}</div>
                    </div>
                    <Chip status={activeForm.status}/>
                  </div>
                  {(activeForm.fields||[]).map(fld=>renderFormField(fld))}
                  {formError&&<div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 14px',borderRadius:10,background:'#FEF2F2',border:'1px solid #FECACA',fontSize:13,color:'#DC2626'}}><AlertCircle size={14}/>{formError}</div>}
                  <div style={{display:'flex',gap:10}}>
                    <button onClick={()=>{setActiveForm(null);setFormAnswers({});setFormError('');}} style={{flex:1,padding:'12px',borderRadius:12,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.05)',cursor:'pointer',fontSize:14,fontWeight:600,color:'#94A3B8'}}>← Back</button>
                    <button disabled={formSubmitting} onClick={handleFormSubmit} style={{
                      flex:1,padding:'12px',borderRadius:12,border:'none',cursor:'pointer',fontSize:14,fontWeight:800,color:'#fff',
                      background:'linear-gradient(135deg,#4F46E5,#7C3AED)',boxShadow:'0 6px 18px rgba(79,70,229,0.45),inset 0 1px 0 rgba(255,255,255,0.25)',
                      opacity:formSubmitting?0.7:1,display:'flex',alignItems:'center',justifyContent:'center',gap:6,
                    }}>
                      {formSubmitting?<><div style={{width:14,height:14,border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/>Submitting...</>:<><Send size={14}/>Submit Form</>}
                    </button>
                  </div>
                </div>
              ):(
                <>
                  {forms.length===0&&<div style={{...cardSt,padding:'48px 24px',textAlign:'center'}}><ClipboardList size={36} style={{color:'#CBD5E1',margin:'0 auto 12px'}}/><div style={{fontSize:14,color:'#94A3B8'}}>No forms sent yet.</div></div>}
                  {forms.map(f=>(
                    <div key={f.id} style={{...cardSt,padding:'16px 20px',display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>
                      <div style={{minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}><Chip status={f.status}/></div>
                        <div style={{fontSize:14,fontWeight:800,color:'#F1F5F9',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{f.formType||'Requirement Form'}</div>
                        <div style={{fontSize:12,color:'#94A3B8',marginTop:2}}>Sent {f.sentAt||'—'}{f.filledAt?` · Filled ${f.filledAt}`:''}</div>
                      </div>
                      {f.status==='sent'?(
                        <button onClick={()=>{setActiveForm(f);setFormAnswers(f.answers||{});setFormError('');}} style={{
                          padding:'10px 18px',borderRadius:12,border:'none',cursor:'pointer',flexShrink:0,
                          fontSize:13,fontWeight:800,color:'#fff',
                          background:'linear-gradient(135deg,#4F46E5,#7C3AED)',
                          boxShadow:'0 6px 18px rgba(79,70,229,0.45),inset 0 1px 0 rgba(255,255,255,0.25)',transition:'all 0.15s',
                        }}
                          onMouseEnter={e=>e.currentTarget.style.transform='scale(1.03)'}
                          onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
                          Fill Form
                        </button>
                      ):(
                        <button onClick={()=>{setActiveForm(f);setFormAnswers(f.answers||{});setFormError('');}} style={{
                          padding:'10px 18px',borderRadius:12,cursor:'pointer',flexShrink:0,
                          fontSize:13,fontWeight:700,color:'#A5B4FC',
                          background:'rgba(99,102,241,0.1)',border:'1px solid rgba(99,102,241,0.28)',transition:'all 0.15s',
                        }}
                          onMouseEnter={e=>e.currentTarget.style.background='rgba(99,102,241,0.22)'}
                          onMouseLeave={e=>e.currentTarget.style.background='rgba(99,102,241,0.12)'}>
                          View
                        </button>
                      )}
                    </div>
                  ))}
                  <div style={{textAlign:'center',fontSize:12,color:'#94A3B8'}}>Submitted forms go straight to our team — we'll send your quotation next.</div>
                </>
              )}
            </div>
          )}
          {tab==='requirements'&&(
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              {reqDone?(
                <div style={{...cardSt,padding:'48px 24px',textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:14}}>
                  <div style={{width:60,height:60,borderRadius:18,background:'linear-gradient(135deg,rgba(16,185,129,0.12),rgba(5,150,105,0.06))',border:'1px solid rgba(16,185,129,0.2)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <CheckCircle2 size={28} style={{color:'#10B981'}}/>
                  </div>
                  <div style={{fontSize:17,fontWeight:900,color:'#F1F5F9'}}>Request Submitted!</div>
                  <div style={{fontSize:13,color:'#94A3B8',maxWidth:280}}>Our team will review and send a quotation within 24 hours.</div>
                  <div style={{display:'flex',flexDirection:'column',gap:8,width:'100%',maxWidth:280,marginTop:4}}>
                    <button onClick={()=>{setReqDone(false);setTab('projects');}} style={{padding:'12px',borderRadius:12,border:'none',cursor:'pointer',fontSize:14,fontWeight:800,color:'#fff',background:'linear-gradient(135deg,#4F46E5,#7C3AED)',boxShadow:'0 6px 18px rgba(79,70,229,0.45),inset 0 1px 0 rgba(255,255,255,0.25)'}}>View My Projects</button>
                    <button onClick={()=>setReqDone(false)} style={{padding:'10px',borderRadius:12,border:'none',cursor:'pointer',fontSize:13,fontWeight:600,color:'#94A3B8',background:'transparent'}}>Submit Another</button>
                  </div>
                </div>
              ):(
                <>
                  <div style={{fontSize:17,fontWeight:900,color:'#F1F5F9'}}>New Project Request</div>
                  <div style={{display:'flex',gap:6}}>
                    {[1,2].map(s=><div key={s} style={{height:5,borderRadius:3,flex:1,background:s<=step?'linear-gradient(90deg,#4F46E5,#7C3AED)':'rgba(255,255,255,0.12)',transition:'all 0.3s'}}/>)}
                  </div>
                  <div style={{fontSize:12,color:'#94A3B8'}}>Step {step} of 2</div>
                  {step===1&&(
                    <div style={{...cardSt,padding:'20px'}}>
                      <div style={{display:'flex',flexDirection:'column',gap:14}}>
                        <div>
                          <label style={{display:'block',fontSize:13,fontWeight:700,color:'#CBD5E1',marginBottom:6}}>Project Name <span style={{color:'#EF4444'}}>*</span></label>
                          <input type="text" value={reqForm.projectTitle} onChange={e=>setReqForm(p=>({...p,projectTitle:e.target.value}))} placeholder="e.g. Restaurant POS System" autoFocus className={iCls}/>
                        </div>
                        <div>
                          <label style={{display:'block',fontSize:13,fontWeight:700,color:'#CBD5E1',marginBottom:6}}>Type of Service <span style={{color:'#EF4444'}}>*</span></label>
                          <select value={reqForm.serviceType} onChange={e=>setReqForm(p=>({...p,serviceType:e.target.value}))} className={iCls} style={{appearance:'none',backgroundImage:selChevron,backgroundRepeat:'no-repeat',backgroundPosition:'right 14px center',paddingRight:40}}>
                            <option value="">Select a service...</option>
                            {REQ_SERVICES.map(s=><option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{display:'block',fontSize:13,fontWeight:700,color:'#CBD5E1',marginBottom:6}}>What do you need? <span style={{color:'#EF4444'}}>*</span></label>
                          <textarea rows={4} value={reqForm.description} onChange={e=>setReqForm(p=>({...p,description:e.target.value}))} placeholder="Describe your business and what you're trying to achieve..." className={iCls} style={{resize:'none'}}/>
                        </div>
                        <button type="button" disabled={!reqForm.projectTitle.trim()||!reqForm.serviceType||!reqForm.description.trim()} onClick={()=>setStep(2)} style={{
                          padding:'13px',borderRadius:12,border:'none',cursor:'pointer',fontSize:14,fontWeight:800,color:'#fff',
                          background:'linear-gradient(135deg,#4F46E5,#7C3AED)',boxShadow:'0 6px 18px rgba(79,70,229,0.45),inset 0 1px 0 rgba(255,255,255,0.25)',
                          opacity:reqForm.projectTitle.trim()&&reqForm.serviceType&&reqForm.description.trim()?1:0.4,transition:'all 0.2s',
                          display:'flex',alignItems:'center',justifyContent:'center',gap:8,
                        }}>Continue <ArrowRight size={16}/></button>
                      </div>
                    </div>
                  )}
                  {step===2&&(
                    <div style={{...cardSt,padding:'20px'}}>
                      <div style={{display:'flex',flexDirection:'column',gap:14}}>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                          <div>
                            <label style={{display:'block',fontSize:13,fontWeight:700,color:'#CBD5E1',marginBottom:6}}>Timeline</label>
                            <select value={reqForm.timeline} onChange={e=>setReqForm(p=>({...p,timeline:e.target.value}))} className={iCls} style={{appearance:'none',backgroundImage:selChevron,backgroundRepeat:'no-repeat',backgroundPosition:'right 14px center',paddingRight:40}}>
                              <option value="">Not sure</option>
                              {REQ_TIMELINES.map(t=><option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                          <div>
                            <label style={{display:'block',fontSize:13,fontWeight:700,color:'#CBD5E1',marginBottom:6}}>Budget</label>
                            <select value={reqForm.budget} onChange={e=>setReqForm(p=>({...p,budget:e.target.value}))} className={iCls} style={{appearance:'none',backgroundImage:selChevron,backgroundRepeat:'no-repeat',backgroundPosition:'right 14px center',paddingRight:40}}>
                              <option value="">Not sure</option>
                              {REQ_BUDGETS.map(b=><option key={b} value={b}>{b}</option>)}
                            </select>
                          </div>
                        </div>
                        <div>
                          <label style={{display:'block',fontSize:13,fontWeight:700,color:'#CBD5E1',marginBottom:6}}>Reference links <span style={{color:'#94A3B8',fontWeight:500}}>(optional)</span></label>
                          <input type="text" value={reqForm.references} onChange={e=>setReqForm(p=>({...p,references:e.target.value}))} placeholder="e.g. https://example.com" className={iCls}/>
                        </div>
                        <div>
                          <label style={{display:'block',fontSize:13,fontWeight:700,color:'#CBD5E1',marginBottom:6}}>Any other notes <span style={{color:'#94A3B8',fontWeight:500}}>(optional)</span></label>
                          <textarea rows={2} value={reqForm.extraNotes} onChange={e=>setReqForm(p=>({...p,extraNotes:e.target.value}))} placeholder="Anything else we should know..." className={iCls} style={{resize:'none'}}/>
                        </div>
                        {reqError&&<div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 14px',borderRadius:10,background:'#FEF2F2',border:'1px solid #FECACA',fontSize:13,color:'#DC2626'}}><AlertCircle size={14}/>{reqError}</div>}
                        <div style={{display:'flex',gap:10}}>
                          <button onClick={()=>setStep(1)} style={{flex:1,padding:'12px',borderRadius:12,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.05)',cursor:'pointer',fontSize:14,fontWeight:600,color:'#94A3B8'}}>← Back</button>
                          <button disabled={reqSubmitting} onClick={submitReq} style={{
                            flex:1,padding:'12px',borderRadius:12,border:'none',cursor:'pointer',fontSize:14,fontWeight:800,color:'#fff',
                            background:'linear-gradient(135deg,#4F46E5,#7C3AED)',boxShadow:'0 6px 18px rgba(79,70,229,0.45),inset 0 1px 0 rgba(255,255,255,0.25)',
                            opacity:reqSubmitting?0.7:1,display:'flex',alignItems:'center',justifyContent:'center',gap:6,
                          }}>
                            {reqSubmitting?<><div style={{width:14,height:14,border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/>Sending...</>:<><Send size={14}/>Send Request</>}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Session Report Modal */}
      {showReport&&reportSid&&reportProj&&(
        <div style={{position:'fixed',inset:0,zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',padding:16,background:'rgba(15,23,42,0.6)',backdropFilter:'blur(8px)'}}>
          <div style={{width:'100%',maxWidth:540,background:'#1E293B',borderRadius:24,boxShadow:'0 25px 80px rgba(0,0,0,0.5)',overflow:'hidden',maxHeight:'85vh',display:'flex',flexDirection:'column',border:'1px solid rgba(255,255,255,0.1)'}}>
            <div style={{padding:'18px 20px',borderBottom:'1px solid rgba(255,255,255,0.08)',display:'flex',justifyContent:'space-between',alignItems:'center',background:'linear-gradient(135deg,rgba(99,102,241,0.16),rgba(124,58,237,0.09))'}}>
              <div>
                <div style={{fontSize:15,fontWeight:800,color:'#F1F5F9'}}>📋 Session Report — {reportSid}</div>
                <div style={{fontSize:12,color:'#94A3B8',marginTop:2}}>{reportProj.title} · {messages.filter(m=>m.sessionId===reportSid).length} messages</div>
              </div>
              <button onClick={()=>setShowReport(false)} style={{width:28,height:28,borderRadius:8,background:'rgba(255,255,255,0.07)',border:'none',cursor:'pointer',fontSize:15,color:'#94A3B8',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:'16px 20px',display:'flex',flexDirection:'column',gap:12}}>
              {messages.filter(m=>m.sessionId===reportSid).map((msg,i)=>{
                const isMe=msg.senderId===uid;
                const time=msg.timestamp?.toDate?.()?.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})||'';
                return(
                  <div key={i} style={{display:'flex',gap:10,flexDirection:isMe?'row-reverse':'row'}}>
                    <div style={{width:24,height:24,borderRadius:'50%',flexShrink:0,marginTop:2,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:10,fontWeight:900,background:isMe?'linear-gradient(135deg,#4F46E5,#7C3AED)':'#94A3B8'}}>
                      {isMe?client.name?.[0]:msg.senderName?.[0]}
                    </div>
                    <div style={{flex:1,textAlign:isMe?'right':'left'}}>
                      <div style={{display:'flex',gap:6,justifyContent:isMe?'flex-end':'flex-start',marginBottom:3}}>
                        <span style={{fontSize:11,fontWeight:600,color:'#94A3B8'}}>{isMe?'You':msg.senderName}</span>
                        <span style={{fontSize:11,color:'#CBD5E1'}}>{time}</span>
                      </div>
                      <div style={{display:'inline-block',padding:'8px 14px',borderRadius:12,fontSize:13,lineHeight:1.5,background:isMe?'rgba(99,102,241,0.22)':'rgba(255,255,255,0.06)',color:isMe?'#C7D2FE':'#CBD5E1',border:`1px solid ${isMe?'rgba(99,102,241,0.35)':'rgba(255,255,255,0.08)'}`}}>
                        {msg.text}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{padding:'14px 20px',borderTop:'1px solid rgba(255,255,255,0.08)',display:'flex',gap:10}}>
              <button onClick={()=>navigator.clipboard.writeText(messages.filter(m=>m.sessionId===reportSid).map(m=>`[${m.timestamp?.toDate?.()?.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})||''}] ${m.senderRole==='client'?'You':m.senderName}: ${m.text}`).join('\n'))}
                style={{flex:1,padding:'11px',borderRadius:12,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.05)',cursor:'pointer',fontSize:13,fontWeight:700,color:'#A5B4FC',display:'flex',alignItems:'center',justifyContent:'center',gap:6,transition:'all 0.15s'}}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(99,102,241,0.22)'}
                onMouseLeave={e=>e.currentTarget.style.background='#F8FAFC'}>
                <FileText size={13}/> Copy
              </button>
              <a href={`https://wa.me/${company.contact.whatsapp.replace(/\D/g,'')}?text=${encodeURIComponent(`📋 Session Report\nProject: ${reportProj.title}\nDate: ${reportSid}\n\n${messages.filter(m=>m.sessionId===reportSid).map(m=>`[${m.timestamp?.toDate?.()?.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})||''}] ${m.senderRole==='client'?'You':m.senderName}: ${m.text}`).join('\n')}`)}`}
                target="_blank" rel="noopener noreferrer"
                style={{flex:1,padding:'11px',borderRadius:12,border:'none',cursor:'pointer',fontSize:13,fontWeight:800,color:'#fff',background:'linear-gradient(135deg,#25D366,#128C7E)',display:'flex',alignItems:'center',justifyContent:'center',gap:6,textDecoration:'none',boxShadow:'0 4px 12px rgba(37,211,102,0.25)',transition:'all 0.15s'}}
                onMouseEnter={e=>e.currentTarget.style.transform='scale(1.01)'}
                onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
                <MessageSquare size={13}/> Send to Admin
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Official Printable Receipt Modal */}
      {receiptModal && (
        <div style={{
          position:'fixed',inset:0,zIndex:60,display:'flex',alignItems:'center',justifyContent:'center',
          padding:16,background:'rgba(15,23,42,0.8)',backdropFilter:'blur(10px)'
        }}>
          <div style={{
            width:'100%',maxWidth:640,background:'#1E293B',borderRadius:24,border:'1px solid rgba(255,255,255,0.12)',
            boxShadow:'0 25px 80px rgba(0,0,0,0.6)',overflow:'hidden',display:'flex',flexDirection:'column'
          }}>
            {/* Printable Receipt Body */}
            <div id="printable-receipt" style={{padding:'36px',background:'#FFFFFF',color:'#0F172A',fontFamily:'system-ui, -apple-system, sans-serif'}}>
              {/* Header */}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',borderBottom:'2px solid #E2E8F0',paddingBottom:20,marginBottom:20}}>
                <div>
                  <div style={{fontSize:24,fontWeight:900,color:'#1E293B',letterSpacing:'-0.5px'}}>SMART (PVT) LTD</div>
                  <div style={{fontSize:12,color:'#64748B',marginTop:3}}>Registration: PV 00234891 · Official ERP Invoice & Receipt</div>
                  <div style={{fontSize:11,color:'#64748B'}}>{company.contact?.address || 'Colombo, Sri Lanka'}</div>
                  <div style={{fontSize:11,color:'#64748B'}}>{company.contact?.email || 'accounts@smartpvtltd.com'} · {company.website || 'https://smartpvtltd.com'}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:16,fontWeight:900,color:'#4F46E5',letterSpacing:'0.5px'}}>PAYMENT RECEIPT</div>
                  <div style={{fontSize:14,fontWeight:800,color:'#0F172A',marginTop:4,fontFamily:'monospace'}}>{receiptModal.receiptNo || 'RCT-000'}</div>
                  <div style={{fontSize:12,color:'#64748B',marginTop:2}}>Date: {receiptModal.date || new Date().toISOString().slice(0,10)}</div>
                </div>
              </div>

              {/* Bill To & Status */}
              <div style={{display:'flex',justifyContent:'space-between',background:'#F8FAFC',padding:'14px 18px',borderRadius:12,marginBottom:20}}>
                <div>
                  <div style={{fontSize:10,fontWeight:800,color:'#64748B',textTransform:'uppercase',letterSpacing:'0.8px'}}>Received From</div>
                  <div style={{fontSize:15,fontWeight:800,color:'#0F172A',marginTop:2}}>{receiptModal.clientName || client?.name || 'Client'}</div>
                  {client?.company && <div style={{fontSize:12,color:'#475569'}}>{client.company}</div>}
                  <div style={{fontSize:11,color:'#64748B'}}>{client?.email || ''}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:10,fontWeight:800,color:'#64748B',textTransform:'uppercase',letterSpacing:'0.8px'}}>Payment Status</div>
                  <div style={{fontSize:12,fontWeight:800,color:'#059669',marginTop:4,display:'inline-block',background:'#DCFCE7',padding:'3px 10px',borderRadius:6}}>
                    VERIFIED & RECEIVED
                  </div>
                  {receiptModal.quotationNo && <div style={{fontSize:11,color:'#64748B',marginTop:4}}>Quote: {receiptModal.quotationNo}</div>}
                </div>
              </div>

              {/* Items Table */}
              <table style={{width:'100%',borderCollapse:'collapse',marginBottom:20,fontSize:13}}>
                <thead>
                  <tr style={{borderBottom:'1.5px solid #CBD5E1',textAlign:'left'}}>
                    <th style={{padding:'10px 0',color:'#475569',fontWeight:700,fontSize:11,textTransform:'uppercase'}}>Description / Service</th>
                    <th style={{padding:'10px 0',color:'#475569',fontWeight:700,fontSize:11,textTransform:'uppercase'}}>Payment Method</th>
                    <th style={{padding:'10px 0',color:'#475569',fontWeight:700,fontSize:11,textTransform:'uppercase'}}>Reference #</th>
                    <th style={{padding:'10px 0',color:'#475569',fontWeight:700,fontSize:11,textTransform:'uppercase',textAlign:'right'}}>Amount (LKR)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{borderBottom:'1px solid #E2E8F0'}}>
                    <td style={{padding:'14px 0',fontWeight:600,color:'#1E293B'}}>
                      {receiptModal.projectTitle || receiptModal.notes || 'Service Payment'}
                    </td>
                    <td style={{padding:'14px 0',color:'#475569'}}>{receiptModal.method || 'Online'}</td>
                    <td style={{padding:'14px 0',color:'#475569',fontFamily:'monospace'}}>{receiptModal.reference || '—'}</td>
                    <td style={{padding:'14px 0',fontWeight:800,color:'#0F172A',textAlign:'right'}}>
                      {formatLKR(toInt(receiptModal.amount))}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Total Box */}
              <div style={{display:'flex',justifyContent:'flex-end',marginBottom:24}}>
                <div style={{width:'50%',background:'#EEF2FF',padding:'14px 18px',borderRadius:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:13,fontWeight:700,color:'#4338CA'}}>Total Received</span>
                  <span style={{fontSize:20,fontWeight:900,color:'#312E81'}}>{formatLKR(toInt(receiptModal.amount))}</span>
                </div>
              </div>

              {/* Footer Note */}
              <div style={{borderTop:'1px dashed #CBD5E1',paddingTop:14,display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:11,color:'#64748B'}}>
                <div>This is an official computer-generated receipt issued by SMART Pvt Ltd ERP.</div>
                <div>Authorized Electronic Record</div>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{padding:'16px 24px',background:'#182238',borderTop:'1px solid rgba(255,255,255,0.08)',display:'flex',justifyContent:'flex-end',gap:12}}>
              <button onClick={()=>setReceiptModal(null)} style={{
                padding:'10px 18px',borderRadius:12,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.05)',
                color:'#94A3B8',fontWeight:700,fontSize:13,cursor:'pointer'
              }}>
                Close
              </button>
              <button onClick={()=>window.print()} style={{
                padding:'10px 20px',borderRadius:12,border:'none',background:'linear-gradient(135deg,#4F46E5,#7C3AED)',
                color:'#fff',fontWeight:800,fontSize:13,cursor:'pointer',display:'flex',alignItems:'center',gap:8,
                boxShadow:'0 4px 14px rgba(79,70,229,0.35)'
              }}>
                <Printer size={15}/> Print / Save PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
