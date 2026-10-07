import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, doc, serverTimestamp
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { getStaffByIds } from '../config/staff';
import SEO from '../components/SEO';
import { company } from '../config/company';
import {
  LayoutDashboard, FolderKanban, FileText, HeadphonesIcon,
  LogOut, MessageSquare, Sparkles, ChevronRight,
  CheckCircle2, Clock, Send, AlertCircle, ClipboardList,
  Receipt, TrendingUp, DollarSign, MessageCircle, Bell,
  Plus, ArrowRight, ChevronDown, ChevronUp, Phone,
  ExternalLink, Zap, Shield, BarChart2,
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
];
const DEV_MSGS = [
  {id:'m1',senderId:'staff-001',senderName:'Ashan',senderRole:'staff',text:'Hi! The homepage design is ready for your review. Please check and give feedback.',sessionId:new Date().toISOString().slice(0,10),timestamp:{toDate:()=>new Date(Date.now()-3600000)}},
  {id:'m2',senderId:'dev-client-001',senderName:'You',senderRole:'client',text:"Looks great! Can we try a blue hero section?",sessionId:new Date().toISOString().slice(0,10),timestamp:{toDate:()=>new Date(Date.now()-1800000)}},
  {id:'m3',senderId:'staff-001',senderName:'Ashan',senderRole:'staff',text:'Sure! Will update and share revised version by EOD.',sessionId:new Date().toISOString().slice(0,10),timestamp:{toDate:()=>new Date(Date.now()-900000)}},
];

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
  {id:'overview',     label:'Home',         icon:LayoutDashboard},
  {id:'projects',     label:'My Projects',  icon:FolderKanban},
  {id:'requirements', label:'New Request',  icon:Plus},
  {id:'quotation',    label:'Quotations',   icon:Receipt},
  {id:'messages',     label:'Messages',     icon:MessageCircle},
  {id:'invoices',     label:'Invoices',     icon:FileText},
  {id:'support',      label:'Support',      icon:HeadphonesIcon},
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
  const [selProject,setSelProject]   = useState(null);
  const [expanded,setExpanded]       = useState(null);
  const [msgText,setMsgText]         = useState('');
  const [msgSending,setMsgSending]   = useState(false);
  const msgEndRef                    = useRef(null);
  const mainRef                      = useRef(null);
  const [showReport,setShowReport]   = useState(false);
  const [reportSid,setReportSid]     = useState(null);
  const [reportProj,setReportProj]   = useState(null);
  const [step,setStep]               = useState(1);
  const [reqForm,setReqForm]         = useState({projectTitle:'',serviceType:'',description:'',timeline:'',budget:'',references:'',extraNotes:''});
  const [reqSubmitting,setReqSubmitting] = useState(false);
  const [reqDone,setReqDone]         = useState(false);
  const [reqError,setReqError]       = useState('');

  const client = clientProfile && {projects:[],invoices:[],tickets:[],...clientProfile};
  const uid    = currentUser?.uid;

  useEffect(()=>{ mainRef.current?.scrollTo({top:0,behavior:'smooth'}); },[tab]);

  useEffect(()=>{
    if(!uid) return;
    if(!isFirebaseConfigured||isDevSession){setProjects(DEV_PROJECTS.filter(()=>uid.startsWith('dev-')));return;}
    const q=query(collection(db,'projects'),where('clientId','==',uid),orderBy('createdAt','desc'));
    return onSnapshot(q,snap=>setProjects(snap.docs.map(d=>({id:d.id,...d.data()}))));
  },[uid,isDevSession]);

  useEffect(()=>{
    if(!selProject){setMessages([]);return;}
    if(!isFirebaseConfigured||isDevSession){setMessages(DEV_MSGS);return;}
    const q=query(collection(db,'messages',selProject.id,'chats'),orderBy('timestamp','asc'));
    return onSnapshot(q,snap=>setMessages(snap.docs.map(d=>({id:d.id,...d.data()}))));
  },[selProject,isDevSession]);

  useEffect(()=>{msgEndRef.current?.scrollIntoView({behavior:'smooth'});},[messages]);

  const handleLogout=async()=>{await logout();navigate('/client-login');};

  if(!client) return(
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#F8FAFF'}}>
      <div style={{width:40,height:40,borderRadius:'50%',border:'3px solid #E0E7FF',borderTopColor:'#4F46E5',animation:'spin 0.8s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const quoteSentCount = projects.filter(p=>p.status==='quotation_sent').length;
  const activeCount    = projects.filter(p=>['In Progress','advance_paid'].includes(p.status)).length;

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
      {/* Brand */}
      <div style={{padding:'22px 20px 16px',borderBottom:'1px solid rgba(255,255,255,0.07)'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
          <div style={{
            width:36,height:36,borderRadius:10,flexShrink:0,overflow:'hidden',
            background:'linear-gradient(135deg,#4F46E5,#7C3AED)',
            display:'flex',alignItems:'center',justifyContent:'center',
            boxShadow:'0 4px 14px rgba(79,70,229,0.5)',
          }}>
            <img src="/logos/SMART_LOGO_ONLY_HEAD_CMP.png" alt="S" style={{width:22,height:22,objectFit:'contain',filter:'brightness(0) invert(1)'}}
              onError={e=>{e.target.style.display='none';e.target.parentNode.style.fontSize=16;e.target.parentNode.style.color='#fff';e.target.parentNode.style.fontWeight=900;e.target.parentNode.textContent='S';}}/>
          </div>
          <div>
            <div style={{color:'#fff',fontSize:13,fontWeight:900,letterSpacing:'0.5px'}}>SMART</div>
            <div style={{fontSize:9,fontWeight:700,letterSpacing:'1.5px',color:'rgba(167,139,250,0.9)',textTransform:'uppercase'}}>Client Portal</div>
          </div>
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
            fontSize:13,fontWeight:900,color:'#fff',
          }}>{client.name?.[0]?.toUpperCase()||'C'}</div>
          <div style={{minWidth:0}}>
            <div style={{fontSize:11,fontWeight:700,color:'#F1F5F9',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{client.name}</div>
            <div style={{fontSize:10,color:'rgba(255,255,255,0.35)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{client.company}</div>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav style={{flex:1,padding:'10px 10px',overflowY:'auto'}}>
        {NAV.map(({id,label,icon:Icon})=>{
          const badge=id==='quotation'?quoteSentCount:id==='projects'?activeCount:0;
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
              <span style={{flex:1,textAlign:'left',fontSize:12,fontWeight:active?700:500,color:active?'#E2E8F0':'rgba(255,255,255,0.45)'}}>
                {label}
              </span>
              {badge>0&&(
                <span style={{
                  minWidth:18,height:18,borderRadius:9,
                  background:'linear-gradient(135deg,#EF4444,#F97316)',
                  color:'#fff',fontSize:10,fontWeight:800,
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
          color:'rgba(248,113,113,0.7)',fontSize:12,fontWeight:600,transition:'all 0.15s',
        }}
          onMouseEnter={e=>{e.currentTarget.style.background='rgba(239,68,68,0.08)';e.currentTarget.style.color='#F87171';}}
          onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='rgba(248,113,113,0.7)';}}>
          <LogOut size={14}/> Sign Out
        </button>
      </div>
    </div>
  );

  // shared card style
  const cardSt={background:'#fff',borderRadius:20,border:'1px solid rgba(0,0,0,0.06)',boxShadow:'0 1px 3px rgba(0,0,0,0.04),0 4px 16px rgba(0,0,0,0.04)',overflow:'hidden',transition:'all 0.2s'};
  const iCls="w-full px-4 py-3 rounded-xl text-sm border border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all";

  // ── OVERVIEW ──────────────────────────────────────────────────
  const OverviewTab=()=>{
    const active=projects.filter(p=>['In Progress','advance_paid'].includes(p.status));
    const completed=projects.filter(p=>p.status==='Completed');
    const quoted=projects.filter(p=>p.status==='quotation_sent');
    const forms=projects.filter(p=>p.status==='requirements_pending');
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
              <div style={{color:'rgba(199,210,254,0.8)',fontSize:11,fontWeight:600,marginBottom:4}}>Welcome back 👋</div>
              <div style={{color:'#fff',fontSize:22,fontWeight:900,lineHeight:1.2}}>{client.name}</div>
              <div style={{color:'rgba(199,210,254,0.7)',fontSize:12,marginTop:3}}>{client.company}</div>
            </div>
            <div style={{textAlign:'right',flexShrink:0}}>
              <div style={{fontSize:9,fontWeight:700,letterSpacing:'1px',color:'rgba(199,210,254,0.6)',textTransform:'uppercase',marginBottom:4}}>Client ID</div>
              <div style={{
                fontSize:11,fontWeight:800,color:'#C7D2FE',
                background:'rgba(255,255,255,0.12)',padding:'4px 10px',borderRadius:8,
                border:'1px solid rgba(255,255,255,0.15)',fontFamily:'monospace',letterSpacing:'0.5px',
              }}>{uid?.slice(0,8).toUpperCase()}</div>
            </div>
          </div>
          {/* Mini stats row */}
          <div style={{display:'flex',gap:24,marginTop:20,paddingTop:16,borderTop:'1px solid rgba(255,255,255,0.1)'}}>
            {[{l:'Active',v:active.length,c:'#A5F3FC'},{l:'Completed',v:completed.length,c:'#BBF7D0'},{l:'Total',v:projects.length,c:'#DDD6FE'}].map(s=>(
              <div key={s.l}>
                <div style={{fontSize:20,fontWeight:900,color:s.c,lineHeight:1}}>{s.v}</div>
                <div style={{fontSize:10,color:'rgba(199,210,254,0.65)',marginTop:2}}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Alert banners */}
        {forms.length>0&&(
          <button onClick={()=>setTab('projects')} style={{
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
              <div style={{fontSize:12,fontWeight:700,color:'#92400E'}}>{forms.length} form waiting to be filled</div>
              <div style={{fontSize:11,color:'#B45309',marginTop:1}}>Fill and submit so we can prepare your quotation →</div>
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
              <div style={{fontSize:12,fontWeight:700,color:'#5B21B6'}}>{quoted.length} quotation waiting for your review</div>
              <div style={{fontSize:11,color:'#6D28D9',marginTop:1}}>Tap to review and accept →</div>
            </div>
            <ChevronRight size={16} style={{color:'#7C3AED',flexShrink:0}}/>
          </button>
        )}

        {/* Active projects */}
        {active.length>0&&(
          <>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{fontSize:14,fontWeight:800,color:'#1E293B'}}>Active Projects</div>
              <button onClick={()=>setTab('projects')} style={{background:'none',border:'none',cursor:'pointer',fontSize:12,fontWeight:600,color:'#4F46E5',display:'flex',alignItems:'center',gap:4}}>
                See all <ChevronRight size={13}/>
              </button>
            </div>
            {active.map(proj=>{
              const staff=getStaffByIds(proj.assignedStaff||[]);
              const done=(proj.milestones||[]).filter(m=>m.done).length;
              const tot=(proj.milestones||[]).length;
              return(
                <div key={proj.id} onClick={()=>setTab('projects')} style={{...cardSt,padding:'18px 20px',cursor:'pointer'}}
                  onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,0.09)';}}
                  onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 1px 3px rgba(0,0,0,0.04),0 4px 16px rgba(0,0,0,0.04)';}}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10,marginBottom:12}}>
                    <div style={{minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:800,color:'#1E293B',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{proj.title}</div>
                      <div style={{fontSize:11,color:'#94A3B8',marginTop:2}}>{proj.serviceType}</div>
                    </div>
                    <Chip status={proj.status}/>
                  </div>
                  <div style={{marginBottom:8}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:5}}>
                      <span style={{color:'#94A3B8'}}>{tot>0?`${done}/${tot} milestones`:'Progress'}</span>
                      <span style={{fontWeight:800,color:'#4F46E5'}}>{proj.completion||0}%</span>
                    </div>
                    <div style={{height:6,borderRadius:4,background:'#EEF2FF',overflow:'hidden'}}>
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
                            border:'2px solid #fff',marginLeft:i>0?-6:0,
                            display:'flex',alignItems:'center',justifyContent:'center',
                            color:'#fff',fontSize:9,fontWeight:900,flexShrink:0,
                          }}>{s.avatar}</div>
                        ))}
                      </div>
                      <span style={{fontSize:11,color:'#94A3B8'}}>{staff.map(s=>s.name.split(' ')[0]).join(' & ')}</span>
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
          background:'linear-gradient(135deg,rgba(238,242,255,0.8),rgba(245,243,255,0.5))',
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
            <div style={{fontSize:13,fontWeight:800,color:'#1E293B'}}>Start a new project</div>
            <div style={{fontSize:11,color:'#94A3B8',marginTop:2}}>Tell us what you need — we'll send a quote</div>
          </div>
          <div style={{
            display:'flex',alignItems:'center',gap:6,padding:'8px 16px',borderRadius:10,
            background:'linear-gradient(135deg,#4F46E5,#7C3AED)',color:'#fff',
            fontSize:12,fontWeight:800,boxShadow:'0 4px 12px rgba(79,70,229,0.35)',flexShrink:0,
          }}><Plus size={14}/> Start</div>
        </button>

        {projects.length===0&&(
          <div style={{textAlign:'center',padding:'40px 0',display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
            <div style={{width:56,height:56,borderRadius:16,background:'linear-gradient(135deg,rgba(79,70,229,0.1),rgba(124,58,237,0.05))',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Sparkles size={24} style={{color:'#6D28D9'}}/>
            </div>
            <div style={{fontSize:14,fontWeight:800,color:'#1E293B'}}>Your portal is ready!</div>
            <div style={{fontSize:12,color:'#94A3B8'}}>Submit a project request to get started.</div>
          </div>
        )}
      </div>
    );
  };

  // ── PROJECTS TAB ──────────────────────────────────────────────
  const ProjectsTab=()=>(
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div style={{fontSize:16,fontWeight:900,color:'#1E293B'}}>My Projects</div>
      {projects.length===0&&(
        <div style={{...cardSt,padding:'48px 24px',textAlign:'center'}}>
          <FolderKanban size={36} style={{color:'#CBD5E1',margin:'0 auto 12px'}}/>
          <div style={{fontSize:13,color:'#94A3B8'}}>No projects yet.</div>
          <button onClick={()=>setTab('requirements')} style={{background:'none',border:'none',cursor:'pointer',fontSize:12,fontWeight:700,color:'#4F46E5',marginTop:8}}>+ Start your first project</button>
        </div>
      )}
      {projects.map(proj=>{
        const isExp=expanded===proj.id;
        const staff=getStaffByIds(proj.assignedStaff||[]);
        const done=(proj.milestones||[]).filter(m=>m.done).length;
        return(
          <div key={proj.id} style={cardSt}>
            <button style={{width:'100%',padding:'16px 20px',textAlign:'left',background:'none',border:'none',cursor:'pointer'}}
              onClick={()=>setExpanded(isExp?null:proj.id)}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10}}>
                <div style={{flex:1,minWidth:0}}>
                  <Chip status={proj.status}/>
                  <div style={{fontSize:14,fontWeight:800,color:'#1E293B',marginTop:6,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{proj.title}</div>
                  <div style={{fontSize:11,color:'#94A3B8',marginTop:2}}>{proj.serviceType}</div>
                </div>
                <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4,flexShrink:0}}>
                  <span style={{fontSize:15,fontWeight:900,color:'#4F46E5'}}>{proj.completion||0}%</span>
                  {isExp?<ChevronUp size={15} style={{color:'#CBD5E1'}}/>:<ChevronDown size={15} style={{color:'#CBD5E1'}}/>}
                </div>
              </div>
              <div style={{marginTop:12,height:5,borderRadius:3,background:'#EEF2FF',overflow:'hidden'}}>
                <div style={{height:'100%',borderRadius:3,width:`${proj.completion||0}%`,background:'linear-gradient(90deg,#4F46E5,#7C3AED)',transition:'width 0.6s',boxShadow:'0 0 8px rgba(79,70,229,0.3)'}}/>
              </div>
            </button>
            {isExp&&(
              <div style={{padding:'0 20px 20px',borderTop:'1px solid #F1F5F9',paddingTop:16,display:'flex',flexDirection:'column',gap:14}}>
                {(proj.milestones||[]).length>0&&(
                  <div>
                    <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.8px',color:'#94A3B8',marginBottom:10}}>
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
                              background:m.done?'linear-gradient(135deg,#10B981,#059669)':isCurrent?'#EEF2FF':'#F8FAFC',
                              border:m.done?'none':isCurrent?'2px solid #4F46E5':'2px solid #E2E8F0',
                              boxShadow:m.done?'0 2px 8px rgba(16,185,129,0.3)':isCurrent?'0 0 0 3px rgba(79,70,229,0.1)':'none',
                            }}>
                              {m.done&&<CheckCircle2 size={12} style={{color:'#fff'}}/>}
                              {!m.done&&isCurrent&&<div style={{width:6,height:6,borderRadius:'50%',background:'#4F46E5'}}/>}
                            </div>
                            <span style={{fontSize:12,fontWeight:m.done?500:600,color:m.done?'#94A3B8':isCurrent?'#4F46E5':'#334155',textDecoration:m.done?'line-through':'none'}}>
                              {m.title}
                            </span>
                            {isCurrent&&<span style={{fontSize:10,fontWeight:700,color:'#4F46E5',background:'rgba(79,70,229,0.08)',padding:'2px 7px',borderRadius:6}}>Active</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {staff.length>0&&(
                  <div>
                    <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.8px',color:'#94A3B8',marginBottom:8}}>Your Team</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                      {staff.map(s=>(
                        <div key={s.id} style={{
                          display:'flex',alignItems:'center',gap:8,padding:'6px 12px 6px 8px',borderRadius:20,
                          background:'#F8FAFF',border:'1px solid #E0E7FF',
                        }}>
                          <div className={s.avatarColor} style={{width:26,height:26,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:10,fontWeight:900,flexShrink:0}}>
                            {s.avatar}
                          </div>
                          <div>
                            <div style={{fontSize:11,fontWeight:700,color:'#334155'}}>{s.name}</div>
                            <div style={{fontSize:10,color:'#94A3B8'}}>{s.role}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <button onClick={()=>{setSelProject(proj);setTab('messages');}} style={{
                  display:'flex',alignItems:'center',justifyContent:'center',gap:6,
                  padding:'10px',borderRadius:12,border:'1px solid #E0E7FF',background:'#F8FAFF',
                  cursor:'pointer',fontSize:12,fontWeight:700,color:'#4F46E5',transition:'all 0.15s',
                }}
                  onMouseEnter={e=>{e.currentTarget.style.background='#EEF2FF';e.currentTarget.style.borderColor='#C7D2FE';}}
                  onMouseLeave={e=>{e.currentTarget.style.background='#F8FAFF';e.currentTarget.style.borderColor='#E0E7FF';}}>
                  <MessageCircle size={14}/> Message project team
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // ── QUOTATIONS ────────────────────────────────────────────────
  const QuotationTab=()=>{
    const q=projects.filter(p=>['quotation_sent','quotation_accepted','advance_paid'].includes(p.status));
    return(
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        <div style={{fontSize:16,fontWeight:900,color:'#1E293B'}}>Quotations</div>
        {q.length===0&&<div style={{...cardSt,padding:'48px 24px',textAlign:'center'}}><Receipt size={36} style={{color:'#CBD5E1',margin:'0 auto 12px'}}/><div style={{fontSize:13,color:'#94A3B8'}}>No quotations yet.</div></div>}
        {q.map(proj=>(
          <div key={proj.id} style={cardSt}>
            <div style={{padding:'16px 20px',borderBottom:'1px solid #F1F5F9',display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10}}>
              <div>
                <div style={{fontSize:14,fontWeight:800,color:'#1E293B'}}>{proj.title}</div>
                <div style={{fontSize:11,color:'#94A3B8',marginTop:2}}>{proj.serviceType}</div>
              </div>
              <Chip status={proj.status}/>
            </div>
            {proj.quotation&&(
              <div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:14}}>
                <div style={{
                  display:'flex',justifyContent:'space-between',alignItems:'center',
                  padding:'14px 18px',borderRadius:16,
                  background:'linear-gradient(135deg,#F8FAFF,#EEF2FF)',border:'1px solid #E0E7FF',
                }}>
                  <div>
                    <div style={{fontSize:11,color:'#94A3B8',marginBottom:2}}>Total Amount</div>
                    <div style={{fontSize:24,fontWeight:900,color:'#1E293B'}}>{proj.quotation.totalAmount}</div>
                  </div>
                  {proj.quotation.advanceAmount&&<div style={{textAlign:'right'}}>
                    <div style={{fontSize:11,color:'#94A3B8',marginBottom:2}}>Advance</div>
                    <div style={{fontSize:15,fontWeight:800,color:'#059669'}}>{proj.quotation.advanceAmount}</div>
                  </div>}
                </div>
                {proj.quotation.breakdown?.length>0&&(
                  <div>
                    <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.8px',color:'#94A3B8',marginBottom:8}}>Breakdown</div>
                    {proj.quotation.breakdown.map((b,i)=>(
                      <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'7px 0',borderBottom:i<proj.quotation.breakdown.length-1?'1px solid #F1F5F9':'none'}}>
                        <span style={{color:'#64748B'}}>{b.label}</span>
                        <span style={{fontWeight:700,color:'#334155'}}>{b.amount}</span>
                      </div>
                    ))}
                  </div>
                )}
                {proj.quotation.notes&&<div style={{fontSize:11,color:'#64748B',background:'#F8FAFC',padding:'10px 14px',borderRadius:12,lineHeight:1.6}}>📋 {proj.quotation.notes}</div>}
                {proj.quotation.validUntil&&<div style={{fontSize:11,color:'#94A3B8',display:'flex',alignItems:'center',gap:4}}><Clock size={11}/> Valid until {proj.quotation.validUntil}</div>}
                {proj.status==='quotation_sent'&&(
                  <button onClick={()=>acceptQuote(proj.id)} style={{
                    width:'100%',padding:'13px',borderRadius:14,border:'none',cursor:'pointer',
                    fontSize:13,fontWeight:800,color:'#fff',
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
                    fontSize:13,fontWeight:800,color:'#fff',
                    background:'linear-gradient(135deg,#4F46E5,#7C3AED)',
                    boxShadow:'0 4px 16px rgba(79,70,229,0.3)',transition:'all 0.2s',
                  }}
                    onMouseEnter={e=>e.currentTarget.style.transform='scale(1.01)'}
                    onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
                    💳 Confirm Advance Payment
                  </button>
                )}
                {proj.status==='advance_paid'&&(
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,padding:'12px',borderRadius:14,background:'rgba(16,185,129,0.08)',border:'1px solid rgba(16,185,129,0.2)',fontSize:13,fontWeight:700,color:'#059669'}}>
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

  // ── MESSAGES ──────────────────────────────────────────────────
  const MessagesTab=()=>{
    const sids=Object.keys(sessionGroups).sort().reverse();
    useEffect(()=>{if(!selProject&&projects.length===1)setSelProject(projects[0]);},[]);
    return(
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        <div style={{fontSize:16,fontWeight:900,color:'#1E293B'}}>Messages</div>
        {projects.length>1&&(
          <div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:4}}>
            {projects.map(p=>(
              <button key={p.id} onClick={()=>setSelProject(p)} style={{
                padding:'8px 14px',borderRadius:20,border:'none',cursor:'pointer',
                fontSize:12,fontWeight:700,whiteSpace:'nowrap',flexShrink:0,transition:'all 0.15s',
                background:selProject?.id===p.id?'linear-gradient(135deg,#4F46E5,#7C3AED)':'#F1F5F9',
                color:selProject?.id===p.id?'#fff':'#64748B',
                boxShadow:selProject?.id===p.id?'0 4px 12px rgba(79,70,229,0.3)':'none',
              }}>{p.title}</button>
            ))}
          </div>
        )}
        {!selProject?(
          <div style={{...cardSt,padding:'48px 24px',textAlign:'center'}}>
            <MessageCircle size={36} style={{color:'#CBD5E1',margin:'0 auto 12px'}}/>
            <div style={{fontSize:13,color:'#94A3B8'}}>Select a project to message your team.</div>
          </div>
        ):(
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {/* Staff */}
            {(()=>{const staff=getStaffByIds(selProject.assignedStaff||[]);if(!staff.length) return null;return(
              <div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:4}}>
                <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.8px',color:'#94A3B8',display:'flex',alignItems:'center',marginRight:4,flexShrink:0}}>Team</div>
                {staff.map(s=>(
                  <div key={s.id} style={{
                    display:'flex',alignItems:'center',gap:6,padding:'6px 12px 6px 8px',
                    borderRadius:20,background:'#fff',border:'1px solid #E2E8F0',flexShrink:0,
                    boxShadow:'0 1px 4px rgba(0,0,0,0.05)',
                  }}>
                    <div className={s.avatarColor} style={{width:22,height:22,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:9,fontWeight:900,flexShrink:0}}>{s.avatar}</div>
                    <div>
                      <div style={{fontSize:11,fontWeight:700,color:'#334155'}}>{s.name}</div>
                      <div style={{fontSize:9,color:'#94A3B8'}}>{s.role}</div>
                    </div>
                    <div style={{width:6,height:6,borderRadius:'50%',background:'#10B981',marginLeft:2}}/>
                  </div>
                ))}
              </div>
            );})()}
            {/* Chat */}
            <div style={{...cardSt,display:'flex',flexDirection:'column',height:480}}>
              <div style={{
                padding:'12px 16px',borderBottom:'1px solid #F1F5F9',
                display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,
                background:'linear-gradient(135deg,#F8FAFF,#F1F5FF)',
              }}>
                <div>
                  <div style={{fontSize:12,fontWeight:800,color:'#1E293B'}}>{selProject.title}</div>
                  <div style={{display:'flex',alignItems:'center',gap:5,marginTop:2}}>
                    <div style={{width:6,height:6,borderRadius:'50%',background:'#10B981',animation:'pulse 2s infinite'}}/>
                    <div style={{fontSize:10,color:'#94A3B8'}}>Team is active · Session resets daily</div>
                  </div>
                </div>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <Chip status={selProject.status}/>
                  {Object.keys(sessionGroups).filter(s=>s<todaySid).length>0&&(
                    <button onClick={()=>{setReportSid(Object.keys(sessionGroups).filter(s=>s<todaySid)[0]);setReportProj(selProject);setShowReport(true);}} style={{
                      display:'flex',alignItems:'center',gap:5,padding:'5px 10px',borderRadius:8,
                      border:'1px solid #E0E7FF',background:'#F8FAFF',cursor:'pointer',
                      fontSize:10,fontWeight:700,color:'#4F46E5',transition:'all 0.15s',
                    }}
                      onMouseEnter={e=>e.currentTarget.style.background='#EEF2FF'}
                      onMouseLeave={e=>e.currentTarget.style.background='#F8FAFF'}>
                      <FileText size={10}/> Reports
                    </button>
                  )}
                </div>
              </div>
              <div style={{flex:1,overflowY:'auto',padding:'16px',display:'flex',flexDirection:'column',gap:16}}>
                {sids.slice().reverse().map(sid=>{
                  const isToday=sid===todaySid;
                  return(
                    <div key={sid}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
                        <div style={{flex:1,height:1,background:'#F1F5F9'}}/>
                        <span style={{fontSize:10,color:'#94A3B8',background:'#F8FAFC',padding:'3px 10px',borderRadius:20,border:'1px solid #E2E8F0',flexShrink:0,fontWeight:500}}>
                          {isToday?'Today':sid}
                        </span>
                        {!isToday&&(
                          <button onClick={()=>{setReportSid(sid);setReportProj(selProject);setShowReport(true);}} style={{
                            fontSize:10,fontWeight:700,color:'#4F46E5',background:'#F0F4FF',
                            border:'1px solid #C7D2FE',borderRadius:8,padding:'2px 8px',cursor:'pointer',flexShrink:0,
                          }}>📋 Report</button>
                        )}
                        <div style={{flex:1,height:1,background:'#F1F5F9'}}/>
                      </div>
                      <div style={{display:'flex',flexDirection:'column',gap:10}}>
                        {sessionGroups[sid].map(msg=>{
                          const isMe=msg.senderId===uid;
                          const time=msg.timestamp?.toDate?.()?.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})||'';
                          const s=!isMe&&(getStaffByIds(selProject.assignedStaff||[]).find(x=>x.id===msg.senderId)||{avatar:msg.senderName?.[0]||'S',avatarColor:'bg-slate-400'});
                          return(
                            <div key={msg.id} style={{display:'flex',justifyContent:isMe?'flex-end':'flex-start',alignItems:'flex-end',gap:8}}>
                              {!isMe&&<div className={s.avatarColor} style={{width:28,height:28,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:11,fontWeight:900,flexShrink:0,marginBottom:2}}>{s.avatar}</div>}
                              <div style={{maxWidth:'72%',display:'flex',flexDirection:'column',gap:3,alignItems:isMe?'flex-end':'flex-start'}}>
                                {!isMe&&<span style={{fontSize:10,fontWeight:600,color:'#94A3B8',paddingLeft:2}}>{msg.senderName}</span>}
                                <div style={{
                                  padding:'10px 14px',borderRadius:isMe?'16px 16px 4px 16px':'16px 16px 16px 4px',
                                  fontSize:13,lineHeight:1.5,
                                  background:isMe?'linear-gradient(135deg,#4F46E5,#6D28D9)':'#F8FAFC',
                                  color:isMe?'#fff':'#334155',
                                  boxShadow:isMe?'0 4px 12px rgba(79,70,229,0.25)':'0 1px 4px rgba(0,0,0,0.06)',
                                  border:isMe?'none':'1px solid #F1F5F9',
                                }}>{msg.text}</div>
                                <span style={{fontSize:10,color:'#CBD5E1',padding:'0 4px'}}>{time}</span>
                              </div>
                              {isMe&&<div style={{width:28,height:28,borderRadius:'50%',background:'linear-gradient(135deg,#4F46E5,#7C3AED)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:11,fontWeight:900,flexShrink:0,marginBottom:2,boxShadow:'0 2px 8px rgba(79,70,229,0.3)'}}>
                                {client.name?.[0]?.toUpperCase()||'C'}
                              </div>}
                            </div>
                          );
                        })}
                      </div>
                      {isToday&&<div style={{textAlign:'center',marginTop:10}}><span style={{fontSize:10,color:'#94A3B8',background:'#F8FAFC',padding:'4px 12px',borderRadius:20,border:'1px solid #F1F5F9'}}>Session ends at midnight · Report auto-generated</span></div>}
                    </div>
                  );
                })}
                {messages.length===0&&<div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:8,padding:'40px 0'}}><MessageCircle size={32} style={{color:'#E2E8F0'}}/><span style={{fontSize:12,color:'#CBD5E1'}}>No messages yet. Say hi! 👋</span></div>}
                <div ref={msgEndRef}/>
              </div>
              <form onSubmit={handleSendMsg} style={{padding:'10px 12px',borderTop:'1px solid #F1F5F9',display:'flex',gap:8,alignItems:'center',background:'#FAFBFF'}}>
                <input type="text" value={msgText} onChange={e=>setMsgText(e.target.value)}
                  placeholder="Type a message... (Enter to send)" autoComplete="off"
                  onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSendMsg(e);}}}
                  style={{flex:1,padding:'10px 16px',borderRadius:20,border:'1px solid #E2E8F0',background:'#fff',fontSize:13,color:'#334155',outline:'none',transition:'all 0.15s'}}
                  onFocus={e=>{e.target.style.borderColor='#818CF8';e.target.style.boxShadow='0 0 0 3px rgba(79,70,229,0.08)';}}
                  onBlur={e=>{e.target.style.borderColor='#E2E8F0';e.target.style.boxShadow='none';}}/>
                <button type="submit" disabled={!msgText.trim()||msgSending} style={{
                  width:40,height:40,borderRadius:'50%',border:'none',cursor:'pointer',
                  background:'linear-gradient(135deg,#4F46E5,#7C3AED)',display:'flex',alignItems:'center',justifyContent:'center',
                  opacity:msgText.trim()&&!msgSending?1:0.4,flexShrink:0,
                  boxShadow:'0 4px 12px rgba(79,70,229,0.35)',transition:'all 0.15s',
                }}
                  onMouseEnter={e=>msgText.trim()&&(e.currentTarget.style.transform='scale(1.08)')}
                  onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
                  <Send size={16} style={{color:'#fff'}}/>
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── INVOICES ──────────────────────────────────────────────────
  const InvoicesTab=()=>(
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div style={{fontSize:16,fontWeight:900,color:'#1E293B'}}>Invoices</div>
      {!client.invoices?.length?<div style={{...cardSt,padding:'48px 24px',textAlign:'center'}}><FileText size={36} style={{color:'#CBD5E1',margin:'0 auto 12px'}}/><div style={{fontSize:13,color:'#94A3B8'}}>No invoices yet.</div></div>
      :<div style={{display:'flex',flexDirection:'column',gap:8}}>{client.invoices.map(inv=>(
        <div key={inv.id} style={{...cardSt,padding:'14px 18px',display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}><span style={{fontSize:10,fontWeight:800,color:'#4F46E5',fontFamily:'monospace'}}>{inv.id}</span><Chip status={inv.status}/></div>
            <div style={{fontSize:13,fontWeight:700,color:'#1E293B'}}>{inv.description}</div>
            <div style={{fontSize:11,color:'#94A3B8',marginTop:2}}>{inv.date}</div>
          </div>
          <div style={{fontSize:16,fontWeight:900,color:'#1E293B',flexShrink:0}}>{inv.amount}</div>
        </div>
      ))}</div>}
      <div style={{textAlign:'center',fontSize:11,color:'#94A3B8'}}>Invoice queries? <a href="mailto:accounts@smartpvtltd.com" style={{color:'#4F46E5',fontWeight:600,textDecoration:'none'}}>accounts@smartpvtltd.com</a></div>
    </div>
  );

  // ── SUPPORT ───────────────────────────────────────────────────
  const SupportTab=()=>(
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div style={{fontSize:16,fontWeight:900,color:'#1E293B'}}>Support</div>
      <div style={cardSt}>
        <div style={{padding:'14px 18px 8px',fontSize:12,fontWeight:700,color:'#64748B'}}>Need help? Contact us directly</div>
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
              <div style={{fontSize:13,fontWeight:700,color:'#065F46'}}>WhatsApp Support</div>
              <div style={{fontSize:11,color:'#6EE7B7',marginTop:1}}>Fastest — typically replies in minutes</div>
            </div>
            <ExternalLink size={14} style={{color:'#10B981',flexShrink:0}}/>
          </a>
          <a href={`tel:${company.contact.phone}`} style={{
            display:'flex',alignItems:'center',gap:12,padding:'13px 14px',borderRadius:14,textDecoration:'none',transition:'all 0.15s',
            background:'#F8FAFF',border:'1px solid #E0E7FF',
          }}
            onMouseEnter={e=>e.currentTarget.style.background='#EEF2FF'}
            onMouseLeave={e=>e.currentTarget.style.background='#F8FAFF'}>
            <div style={{width:38,height:38,borderRadius:12,background:'linear-gradient(135deg,#4F46E5,#7C3AED)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 3px 10px rgba(79,70,229,0.25)',flexShrink:0}}>
              <Phone size={17} style={{color:'#fff'}}/>
            </div>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:'#1E293B'}}>Call Us</div>
              <div style={{fontSize:11,color:'#94A3B8',marginTop:1}}>{company.contact.phoneDisplay}</div>
            </div>
          </a>
        </div>
      </div>
      <div style={{textAlign:'center',fontSize:11,color:'#94A3B8'}}>
        Response: <strong style={{color:'#334155'}}>2–4 hrs</strong> · Hours: <strong style={{color:'#334155'}}>{company.contact.businessHours}</strong>
      </div>
    </div>
  );

  const TABS={overview:<OverviewTab/>,projects:<ProjectsTab/>,quotation:<QuotationTab/>,messages:<MessagesTab/>,invoices:<InvoicesTab/>,support:<SupportTab/>};

  // ── LAYOUT ────────────────────────────────────────────────────
  return(
    <div style={{minHeight:'100vh',display:'flex',background:'#F0F4FA'}}>
      <SEO title="My Dashboard" description="SMART Pvt Ltd client portal." noIndex/>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#E2E8F0;border-radius:4px}
        ::-webkit-scrollbar-thumb:hover{background:#CBD5E1}
      `}</style>

      {/* Sidebar */}
      <aside style={{
        width:224,flexShrink:0,position:'sticky',top:0,height:'100vh',
        background:'linear-gradient(175deg,#1E1B4B 0%,#312E81 45%,#1E1B4B 100%)',
        borderRight:'1px solid rgba(255,255,255,0.05)',
        boxShadow:'4px 0 24px rgba(0,0,0,0.15)',
        display:'none',
      }} className="lg-sidebar">
        <SidebarContent/>
      </aside>
      <style>{`.lg-sidebar{@media(min-width:1024px){display:flex!important;flex-direction:column}}`}</style>
      {/* CSS media hack */}
      <style>{`@media(min-width:1024px){.lg-sidebar{display:flex!important;flex-direction:column}}`}</style>

      {/* Main */}
      <div style={{flex:1,display:'flex',flexDirection:'column',minWidth:0}}>

        {/* Mobile topbar */}
        <div style={{
          display:'flex',alignItems:'center',gap:10,padding:'12px 16px',
          background:'linear-gradient(135deg,#1E1B4B,#312E81)',
          borderBottom:'1px solid rgba(255,255,255,0.07)',
          position:'sticky',top:0,zIndex:30,
        }} className="mobile-topbar">
          <div style={{display:'flex',alignItems:'center',gap:8,marginRight:6}}>
            <div style={{width:28,height:28,borderRadius:8,background:'linear-gradient(135deg,#4F46E5,#7C3AED)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 2px 8px rgba(79,70,229,0.4)'}}>
              <img src="/logos/SMART_LOGO_ONLY_HEAD_CMP.png" alt="S" style={{width:18,height:18,objectFit:'contain',filter:'brightness(0) invert(1)'}} onError={e=>e.target.style.display='none'}/>
            </div>
          </div>
          {NAV.map(({id,label,icon:Icon})=>{
            const badge=id==='quotation'?quoteSentCount:0;
            return(
              <button key={id} onClick={()=>setTab(id)} style={{
                position:'relative',display:'flex',flexDirection:'column',alignItems:'center',gap:2,
                padding:'6px 10px',borderRadius:10,border:'none',cursor:'pointer',
                background:tab===id?'rgba(79,70,229,0.35)':'transparent',
                color:tab===id?'#A78BFA':'rgba(255,255,255,0.4)',
                fontSize:9,fontWeight:700,flexShrink:0,transition:'all 0.15s',
                boxShadow:tab===id?'inset 0 0 0 1px rgba(139,92,246,0.4)':'none',
              }}>
                <Icon size={14}/>
                <span style={{whiteSpace:'nowrap'}}>{label}</span>
                {badge>0&&<span style={{position:'absolute',top:-2,right:-2,width:14,height:14,borderRadius:'50%',background:'#EF4444',color:'#fff',fontSize:8,fontWeight:900,display:'flex',alignItems:'center',justifyContent:'center'}}>{badge}</span>}
              </button>
            );
          })}
          <button onClick={handleLogout} style={{marginLeft:'auto',display:'flex',flexDirection:'column',alignItems:'center',gap:2,padding:'6px 10px',borderRadius:10,border:'none',cursor:'pointer',background:'transparent',color:'rgba(248,113,113,0.7)',fontSize:9,fontWeight:700,flexShrink:0}}>
            <LogOut size={14}/><span>Out</span>
          </button>
        </div>

        {/* Content */}
        <main ref={mainRef} style={{flex:1,overflowY:'auto',padding:'20px 16px',maxWidth:720,width:'100%',margin:'0 auto',boxSizing:'border-box'}}>
          {TABS[tab]}
          {tab==='requirements'&&(
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              {reqDone?(
                <div style={{...cardSt,padding:'48px 24px',textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:14}}>
                  <div style={{width:60,height:60,borderRadius:18,background:'linear-gradient(135deg,rgba(16,185,129,0.12),rgba(5,150,105,0.06))',border:'1px solid rgba(16,185,129,0.2)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <CheckCircle2 size={28} style={{color:'#10B981'}}/>
                  </div>
                  <div style={{fontSize:16,fontWeight:900,color:'#1E293B'}}>Request Submitted!</div>
                  <div style={{fontSize:12,color:'#94A3B8',maxWidth:280}}>Our team will review and send a quotation within 24 hours.</div>
                  <div style={{display:'flex',flexDirection:'column',gap:8,width:'100%',maxWidth:280,marginTop:4}}>
                    <button onClick={()=>{setReqDone(false);setTab('projects');}} style={{padding:'12px',borderRadius:12,border:'none',cursor:'pointer',fontSize:13,fontWeight:800,color:'#fff',background:'linear-gradient(135deg,#4F46E5,#7C3AED)',boxShadow:'0 4px 14px rgba(79,70,229,0.3)'}}>View My Projects</button>
                    <button onClick={()=>setReqDone(false)} style={{padding:'10px',borderRadius:12,border:'none',cursor:'pointer',fontSize:12,fontWeight:600,color:'#94A3B8',background:'transparent'}}>Submit Another</button>
                  </div>
                </div>
              ):(
                <>
                  <div style={{fontSize:16,fontWeight:900,color:'#1E293B'}}>New Project Request</div>
                  <div style={{display:'flex',gap:6}}>
                    {[1,2].map(s=><div key={s} style={{height:5,borderRadius:3,flex:1,background:s<=step?'linear-gradient(90deg,#4F46E5,#7C3AED)':'#E2E8F0',transition:'all 0.3s'}}/>)}
                  </div>
                  <div style={{fontSize:11,color:'#94A3B8'}}>Step {step} of 2</div>
                  {step===1&&(
                    <div style={{...cardSt,padding:'20px'}}>
                      <div style={{display:'flex',flexDirection:'column',gap:14}}>
                        <div>
                          <label style={{display:'block',fontSize:12,fontWeight:700,color:'#374151',marginBottom:6}}>Project Name <span style={{color:'#EF4444'}}>*</span></label>
                          <input type="text" value={reqForm.projectTitle} onChange={e=>setReqForm(p=>({...p,projectTitle:e.target.value}))} placeholder="e.g. Restaurant POS System" autoFocus className={iCls}/>
                        </div>
                        <div>
                          <label style={{display:'block',fontSize:12,fontWeight:700,color:'#374151',marginBottom:6}}>Type of Service <span style={{color:'#EF4444'}}>*</span></label>
                          <select value={reqForm.serviceType} onChange={e=>setReqForm(p=>({...p,serviceType:e.target.value}))} className={iCls} style={{appearance:'none'}}>
                            <option value="">Select a service...</option>
                            {REQ_SERVICES.map(s=><option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{display:'block',fontSize:12,fontWeight:700,color:'#374151',marginBottom:6}}>What do you need? <span style={{color:'#EF4444'}}>*</span></label>
                          <textarea rows={4} value={reqForm.description} onChange={e=>setReqForm(p=>({...p,description:e.target.value}))} placeholder="Describe your business and what you're trying to achieve..." className={iCls} style={{resize:'none'}}/>
                        </div>
                        <button type="button" disabled={!reqForm.projectTitle.trim()||!reqForm.serviceType||!reqForm.description.trim()} onClick={()=>setStep(2)} style={{
                          padding:'13px',borderRadius:12,border:'none',cursor:'pointer',fontSize:13,fontWeight:800,color:'#fff',
                          background:'linear-gradient(135deg,#4F46E5,#7C3AED)',boxShadow:'0 4px 14px rgba(79,70,229,0.3)',
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
                            <label style={{display:'block',fontSize:12,fontWeight:700,color:'#374151',marginBottom:6}}>Timeline</label>
                            <select value={reqForm.timeline} onChange={e=>setReqForm(p=>({...p,timeline:e.target.value}))} className={iCls} style={{appearance:'none'}}>
                              <option value="">Not sure</option>
                              {REQ_TIMELINES.map(t=><option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                          <div>
                            <label style={{display:'block',fontSize:12,fontWeight:700,color:'#374151',marginBottom:6}}>Budget</label>
                            <select value={reqForm.budget} onChange={e=>setReqForm(p=>({...p,budget:e.target.value}))} className={iCls} style={{appearance:'none'}}>
                              <option value="">Not sure</option>
                              {REQ_BUDGETS.map(b=><option key={b} value={b}>{b}</option>)}
                            </select>
                          </div>
                        </div>
                        <div>
                          <label style={{display:'block',fontSize:12,fontWeight:700,color:'#374151',marginBottom:6}}>Reference links <span style={{color:'#9CA3AF',fontWeight:500}}>(optional)</span></label>
                          <input type="text" value={reqForm.references} onChange={e=>setReqForm(p=>({...p,references:e.target.value}))} placeholder="e.g. https://example.com" className={iCls}/>
                        </div>
                        <div>
                          <label style={{display:'block',fontSize:12,fontWeight:700,color:'#374151',marginBottom:6}}>Any other notes <span style={{color:'#9CA3AF',fontWeight:500}}>(optional)</span></label>
                          <textarea rows={2} value={reqForm.extraNotes} onChange={e=>setReqForm(p=>({...p,extraNotes:e.target.value}))} placeholder="Anything else we should know..." className={iCls} style={{resize:'none'}}/>
                        </div>
                        {reqError&&<div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 14px',borderRadius:10,background:'#FEF2F2',border:'1px solid #FECACA',fontSize:12,color:'#DC2626'}}><AlertCircle size={14}/>{reqError}</div>}
                        <div style={{display:'flex',gap:10}}>
                          <button onClick={()=>setStep(1)} style={{flex:1,padding:'12px',borderRadius:12,border:'1px solid #E2E8F0',background:'#F8FAFC',cursor:'pointer',fontSize:13,fontWeight:600,color:'#64748B'}}>← Back</button>
                          <button disabled={reqSubmitting} onClick={submitReq} style={{
                            flex:1,padding:'12px',borderRadius:12,border:'none',cursor:'pointer',fontSize:13,fontWeight:800,color:'#fff',
                            background:'linear-gradient(135deg,#4F46E5,#7C3AED)',boxShadow:'0 4px 14px rgba(79,70,229,0.3)',
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
          <div style={{width:'100%',maxWidth:540,background:'#fff',borderRadius:24,boxShadow:'0 25px 80px rgba(0,0,0,0.2)',overflow:'hidden',maxHeight:'85vh',display:'flex',flexDirection:'column',border:'1px solid rgba(0,0,0,0.06)'}}>
            <div style={{padding:'18px 20px',borderBottom:'1px solid #F1F5F9',display:'flex',justifyContent:'space-between',alignItems:'center',background:'linear-gradient(135deg,#F8FAFF,#F0F4FF)'}}>
              <div>
                <div style={{fontSize:14,fontWeight:800,color:'#1E293B'}}>📋 Session Report — {reportSid}</div>
                <div style={{fontSize:11,color:'#94A3B8',marginTop:2}}>{reportProj.title} · {messages.filter(m=>m.sessionId===reportSid).length} messages</div>
              </div>
              <button onClick={()=>setShowReport(false)} style={{width:28,height:28,borderRadius:8,background:'#F1F5F9',border:'none',cursor:'pointer',fontSize:14,color:'#64748B',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:'16px 20px',display:'flex',flexDirection:'column',gap:12}}>
              {messages.filter(m=>m.sessionId===reportSid).map((msg,i)=>{
                const isMe=msg.senderId===uid;
                const time=msg.timestamp?.toDate?.()?.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})||'';
                return(
                  <div key={i} style={{display:'flex',gap:10,flexDirection:isMe?'row-reverse':'row'}}>
                    <div style={{width:24,height:24,borderRadius:'50%',flexShrink:0,marginTop:2,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:9,fontWeight:900,background:isMe?'linear-gradient(135deg,#4F46E5,#7C3AED)':'#94A3B8'}}>
                      {isMe?client.name?.[0]:msg.senderName?.[0]}
                    </div>
                    <div style={{flex:1,textAlign:isMe?'right':'left'}}>
                      <div style={{display:'flex',gap:6,justifyContent:isMe?'flex-end':'flex-start',marginBottom:3}}>
                        <span style={{fontSize:10,fontWeight:600,color:'#94A3B8'}}>{isMe?'You':msg.senderName}</span>
                        <span style={{fontSize:10,color:'#CBD5E1'}}>{time}</span>
                      </div>
                      <div style={{display:'inline-block',padding:'8px 14px',borderRadius:12,fontSize:12,lineHeight:1.5,background:isMe?'#EEF2FF':'#F8FAFC',color:isMe?'#4338CA':'#334155',border:`1px solid ${isMe?'#C7D2FE':'#F1F5F9'}`}}>
                        {msg.text}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{padding:'14px 20px',borderTop:'1px solid #F1F5F9',display:'flex',gap:10}}>
              <button onClick={()=>navigator.clipboard.writeText(messages.filter(m=>m.sessionId===reportSid).map(m=>`[${m.timestamp?.toDate?.()?.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})||''}] ${m.senderRole==='client'?'You':m.senderName}: ${m.text}`).join('\n'))}
                style={{flex:1,padding:'11px',borderRadius:12,border:'1px solid #E2E8F0',background:'#F8FAFC',cursor:'pointer',fontSize:12,fontWeight:700,color:'#4F46E5',display:'flex',alignItems:'center',justifyContent:'center',gap:6,transition:'all 0.15s'}}
                onMouseEnter={e=>e.currentTarget.style.background='#EEF2FF'}
                onMouseLeave={e=>e.currentTarget.style.background='#F8FAFC'}>
                <FileText size={13}/> Copy
              </button>
              <a href={`https://wa.me/${company.contact.whatsapp.replace(/\D/g,'')}?text=${encodeURIComponent(`📋 Session Report\nProject: ${reportProj.title}\nDate: ${reportSid}\n\n${messages.filter(m=>m.sessionId===reportSid).map(m=>`[${m.timestamp?.toDate?.()?.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})||''}] ${m.senderRole==='client'?'You':m.senderName}: ${m.text}`).join('\n')}`)}`}
                target="_blank" rel="noopener noreferrer"
                style={{flex:1,padding:'11px',borderRadius:12,border:'none',cursor:'pointer',fontSize:12,fontWeight:800,color:'#fff',background:'linear-gradient(135deg,#25D366,#128C7E)',display:'flex',alignItems:'center',justifyContent:'center',gap:6,textDecoration:'none',boxShadow:'0 4px 12px rgba(37,211,102,0.25)',transition:'all 0.15s'}}
                onMouseEnter={e=>e.currentTarget.style.transform='scale(1.01)'}
                onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
                <MessageSquare size={13}/> Send to Admin
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
