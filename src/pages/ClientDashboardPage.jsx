import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { getStaffByIds } from '../config/staff';
import SEO from '../components/SEO';
import { company } from '../config/company';
import {
  LayoutDashboard, FolderKanban, FileText, HeadphonesIcon,
  LogOut, MessageSquare, Sparkles, User, Shield, ChevronRight,
  CheckCircle2, Clock, Send, AlertCircle, ClipboardList, Receipt,
  TrendingUp, Info, DollarSign, MessageCircle, Bell, Plus,
  ArrowRight, ChevronDown, ChevronUp, Phone, ExternalLink, Zap,
} from 'lucide-react';

// ─── DEV MOCK ──────────────────────────────────────────────────────
const DEV_PROJECTS = [
  {
    id:'dev-proj-001', clientId:'dev-client-001',
    title:'Corporate Website Redesign', serviceType:'Corporate Business Website',
    status:'In Progress', completion:65, createdAt:null,
    milestones:[
      {title:'Discovery & Blueprint',done:true},{title:'UI/UX Design',done:true},
      {title:'Development',done:false},{title:'QA & Testing',done:false},{title:'Deployment',done:false},
    ],
    quotation:{totalAmount:'LKR 85,000',advanceAmount:'LKR 30,000',breakdown:[{label:'Design & UI/UX',amount:'LKR 25,000'},{label:'Development',amount:'LKR 45,000'},{label:'SEO & Deployment',amount:'LKR 15,000'}],validUntil:'Nov 15, 2026',notes:'Includes 3 months free support.'},
    assignedStaff:['STAFF-001','STAFF-002'],
  },
  {
    id:'dev-proj-002', clientId:'dev-client-001',
    title:'Mobile App Development', serviceType:'Mobile App (Android & iOS)',
    status:'quotation_sent', completion:0, createdAt:null, milestones:[],
    quotation:{totalAmount:'LKR 150,000',advanceAmount:'LKR 50,000',breakdown:[{label:'Architecture & Design',amount:'LKR 40,000'},{label:'Android & iOS Dev',amount:'LKR 90,000'},{label:'Testing & Deployment',amount:'LKR 20,000'}],validUntil:'Nov 30, 2026',notes:'Cross-platform using React Native.'},
    assignedStaff:[],
  },
];
const DEV_MESSAGES = [
  {id:'m1',senderId:'staff-001',senderName:'Ashan',senderRole:'staff',text:'Hi! The homepage design is ready for your review.',sessionId:new Date().toISOString().slice(0,10),timestamp:{toDate:()=>new Date(Date.now()-3600000)}},
  {id:'m2',senderId:'dev-client-001',senderName:'You',senderRole:'client',text:'Looks great! Can we change the hero color to blue?',sessionId:new Date().toISOString().slice(0,10),timestamp:{toDate:()=>new Date(Date.now()-1800000)}},
  {id:'m3',senderId:'staff-001',senderName:'Ashan',senderRole:'staff',text:'Sure! Will update and send revised version by EOD.',sessionId:new Date().toISOString().slice(0,10),timestamp:{toDate:()=>new Date(Date.now()-900000)}},
];

// ─── STATUS CONFIG ─────────────────────────────────────────────────
const STATUS = {
  requirements_pending:{label:'Under Review',   cls:'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40'},
  quotation_sent:      {label:'Quote Ready',     cls:'bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-500/20 dark:text-violet-300 dark:border-violet-500/40'},
  quotation_accepted:  {label:'Quote Accepted',  cls:'bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-500/40'},
  advance_paid:        {label:'Starting Soon',   cls:'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40'},
  'In Progress':       {label:'In Progress',     cls:'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/40'},
  Completed:           {label:'Completed',       cls:'bg-green-100 text-green-700 border-green-300 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/40'},
  Paid:                {label:'Paid',            cls:'bg-green-100 text-green-700 border-green-300 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/40'},
  Pending:             {label:'Pending',         cls:'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40'},
};
const Chip = ({status,size='sm'}) => {
  const cfg = STATUS[status]||{label:status,cls:'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-500/20 dark:text-slate-300 dark:border-slate-500/40'};
  return <span className={`font-bold rounded-full border ${size==='sm'?'text-[10px] px-2.5 py-0.5':'text-xs px-3 py-1'} ${cfg.cls}`}>{cfg.label}</span>;
};

// ─── NAV ───────────────────────────────────────────────────────────
const NAV = [
  {id:'overview',     label:'Home',        icon:LayoutDashboard},
  {id:'projects',     label:'My Projects', icon:FolderKanban},
  {id:'requirements', label:'New Request', icon:Plus},
  {id:'quotation',    label:'Quotations',  icon:Receipt},
  {id:'messages',     label:'Messages',    icon:MessageCircle},
  {id:'invoices',     label:'Invoices',    icon:FileText},
  {id:'support',      label:'Support',     icon:HeadphonesIcon},
];

// ─── MAIN ──────────────────────────────────────────────────────────
export default function ClientDashboardPage() {
  const navigate = useNavigate();
  const {clientProfile,logout,currentUser,isDevSession} = useAuth();
  const [tab,setTab]             = useState('overview');
  const [projects,setProjects]   = useState([]);
  const [messages,setMessages]   = useState([]);
  const [selProject,setSelProject] = useState(null);
  const [expandedProj,setExpandedProj] = useState(null);
  const [msgText,setMsgText]     = useState('');
  const [msgSending,setMsgSending] = useState(false);
  const msgEndRef                = useRef(null);
  const mainRef                  = useRef(null);
  // Report modal state
  const [showReport,setShowReport]       = useState(false);
  const [reportSession,setReportSession] = useState(null);
  const [reportProject,setReportProject] = useState(null);
  // Req form
  const [step,setStep]                   = useState(1);
  const [reqForm,setReqForm]             = useState({projectTitle:'',serviceType:'',description:'',timeline:'',budget:'',references:'',extraNotes:''});
  const [reqSubmitting,setReqSubmitting] = useState(false);
  const [reqDone,setReqDone]             = useState(false);
  const [reqError,setReqError]           = useState('');

  const client = clientProfile && {projects:[],invoices:[],tickets:[],...clientProfile};
  const uid    = currentUser?.uid;

  // Scroll top on tab change
  useEffect(()=>{ mainRef.current?.scrollTo({top:0,behavior:'smooth'}); },[tab]);

  // Load projects
  useEffect(()=>{
    if(!uid) return;
    if(!isFirebaseConfigured||isDevSession){setProjects(DEV_PROJECTS.filter(()=>uid.startsWith('dev-')));return;}
    const q=query(collection(db,'projects'),where('clientId','==',uid),orderBy('createdAt','desc'));
    return onSnapshot(q,snap=>setProjects(snap.docs.map(d=>({id:d.id,...d.data()}))));
  },[uid,isDevSession]);

  // Load messages
  useEffect(()=>{
    if(!selProject){setMessages([]);return;}
    if(!isFirebaseConfigured||isDevSession){setMessages(DEV_MESSAGES);return;}
    const q=query(collection(db,'messages',selProject.id,'chats'),orderBy('timestamp','asc'));
    return onSnapshot(q,snap=>setMessages(snap.docs.map(d=>({id:d.id,...d.data()}))));
  },[selProject,isDevSession]);

  useEffect(()=>{msgEndRef.current?.scrollIntoView({behavior:'smooth'});},[messages]);

  const handleLogout=async()=>{await logout();navigate('/client-login');};
  if(!client) return(
    <div className="min-h-screen flex items-center justify-center" style={{background:'linear-gradient(135deg,#0A0F2C 0%,#0D1B4B 100%)'}}>
      <div className="w-10 h-10 rounded-full border-3 border-blue-500/30 border-t-blue-500 animate-spin"/>
    </div>
  );

  const quoteSentCount = projects.filter(p=>p.status==='quotation_sent').length;
  const activeCount    = projects.filter(p=>['In Progress','advance_paid'].includes(p.status)).length;

  const handleSendMsg=async(e)=>{
    e.preventDefault();
    if(!msgText.trim()||!selProject) return;
    setMsgSending(true);
    const sid=new Date().toISOString().slice(0,10);
    const m={id:`m${Date.now()}`,senderId:uid,senderName:client.name,senderRole:'client',text:msgText.trim(),sessionId:sid,timestamp:{toDate:()=>new Date()}};
    if(!isFirebaseConfigured||isDevSession){setMessages(p=>[...p,m]);}
    else{try{await addDoc(collection(db,'messages',selProject.id,'chats'),{senderId:uid,senderName:client.name,senderRole:'client',text:msgText.trim(),timestamp:serverTimestamp(),sessionId:sid});}catch(e){console.error(e);}}
    setMsgText('');setMsgSending(false);
  };
  const handleAcceptQuote=async(id)=>{
    if(!isFirebaseConfigured||isDevSession){setProjects(p=>p.map(x=>x.id===id?{...x,status:'quotation_accepted'}:x));return;}
    try{await updateDoc(doc(db,'projects',id),{status:'quotation_accepted',updatedAt:serverTimestamp()});}catch(e){console.error(e);}
  };
  const handleAdvancePaid=async(id)=>{
    if(!isFirebaseConfigured||isDevSession){setProjects(p=>p.map(x=>x.id===id?{...x,status:'advance_paid'}:x));return;}
    try{await updateDoc(doc(db,'projects',id),{status:'advance_paid',updatedAt:serverTimestamp(),'payment.advancePaidByClient':true});}catch(e){console.error(e);}
  };
  const handleReqSubmit=async(e)=>{
    if(e?.preventDefault) e.preventDefault();
    setReqError('');
    if(!reqForm.projectTitle.trim()||!reqForm.serviceType||!reqForm.description.trim()){setReqError('Please fill in all required fields.');return;}
    setReqSubmitting(true);
    const payload={clientId:uid,clientName:client.name,clientCompany:client.company||'',status:'requirements_pending',title:reqForm.projectTitle.trim(),serviceType:reqForm.serviceType,description:reqForm.description.trim(),timeline:reqForm.timeline,budget:reqForm.budget,references:reqForm.references.trim(),extraNotes:reqForm.extraNotes.trim(),quotation:null,milestones:[],completion:0,assignedStaff:[]};
    try{
      if(!isFirebaseConfigured||isDevSession){setProjects(prev=>[{id:`dev-proj-${Date.now()}`,...payload,createdAt:null},...prev]);}
      else{await addDoc(collection(db,'projects'),{...payload,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});}
      setReqDone(true);setStep(1);setReqForm({projectTitle:'',serviceType:'',description:'',timeline:'',budget:'',references:'',extraNotes:''});
    }catch(err){console.error(err);setReqError('Submission failed. Please try again.');}
    finally{setReqSubmitting(false);}
  };

  // Session report helpers
  const sessionGroups=useMemo(()=>{
    const g={};
    messages.forEach(m=>{const s=m.sessionId||'unknown';if(!g[s])g[s]=[];g[s].push(m);});
    return g;
  },[messages]);
  const todaySession=new Date().toISOString().slice(0,10);

  // ── SIDEBAR ────────────────────────────────────────────────
  const Sidebar=()=>(
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
            style={{background:'linear-gradient(135deg,#0052CC,#0066FF)',boxShadow:'0 4px 12px rgba(0,102,255,0.4)'}}>
            <img src="/logos/SMART_LOGO_ONLY_HEAD_CMP.png" alt="SMART" className="w-6 h-6 object-contain"
              style={{filter:'brightness(0) invert(1)'}}
              onError={e=>{e.target.style.display='none';}}/>
          </div>
          <div>
            <div className="text-xs font-black text-white tracking-wider">SMART</div>
            <div className="text-[9px] font-bold tracking-widest" style={{color:'rgba(0,217,255,0.9)'}}>CLIENT PORTAL</div>
          </div>
        </div>
        {/* Client info */}
        <div className="mt-3 px-2 py-2 rounded-xl" style={{background:'rgba(255,255,255,0.06)'}}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-sm shrink-0"
              style={{background:'linear-gradient(135deg,#0066FF,#00D9FF)'}}>
              {client.name?.[0]?.toUpperCase()||'C'}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">{client.name}</div>
              <div className="text-[10px] truncate" style={{color:'rgba(255,255,255,0.5)'}}>{client.company}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({id,label,icon:Icon})=>{
          const badge=id==='quotation'?quoteSentCount:id==='projects'?activeCount:0;
          const isActive=tab===id;
          return(
            <button key={id} onClick={()=>setTab(id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all relative group"
              style={{
                background:isActive?'linear-gradient(135deg,rgba(0,102,255,0.35),rgba(0,217,255,0.1))':'transparent',
                color:isActive?'#fff':'rgba(255,255,255,0.55)',
                border:isActive?'1px solid rgba(0,102,255,0.4)':'1px solid transparent',
                boxShadow:isActive?'0 2px 12px rgba(0,102,255,0.25)':'none',
              }}>
              {isActive&&<div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full" style={{background:'linear-gradient(180deg,#0066FF,#00D9FF)'}}/>}
              <Icon size={14} style={{color:isActive?'#00D9FF':'rgba(255,255,255,0.4)',flexShrink:0}}/>
              <span className="flex-1 text-left">{label}</span>
              {badge>0&&(
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full text-white"
                  style={{background:'linear-gradient(135deg,#FF4757,#FF6B81)',minWidth:18,textAlign:'center'}}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="px-2 py-3 border-t border-white/10">
        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all"
          style={{color:'rgba(255,100,100,0.85)'}}
          onMouseEnter={e=>e.currentTarget.style.background='rgba(255,80,80,0.1)'}
          onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
          <LogOut size={14}/> Sign Out
        </button>
      </div>
    </div>
  );

  // ── OVERVIEW ───────────────────────────────────────────────
  const OverviewTab=()=>{
    const active   =projects.filter(p=>['In Progress','advance_paid'].includes(p.status));
    const completed=projects.filter(p=>p.status==='Completed');
    const quoted   =projects.filter(p=>p.status==='quotation_sent');
    const forms    =projects.filter(p=>p.status==='requirements_pending');
    return(
      <div className="space-y-5">
        {/* Welcome banner */}
        <div className="relative rounded-2xl overflow-hidden p-5"
          style={{background:'linear-gradient(135deg,#0052CC 0%,#0066FF 50%,#0A84FF 100%)'}}>
          <div className="absolute inset-0 opacity-20" style={{backgroundImage:'radial-gradient(circle at 80% 20%,#00D9FF 0%,transparent 50%)'}}/>
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10" style={{background:'#fff',transform:'translate(30%,-30%)'}}/>
          <div className="relative flex items-center justify-between gap-4">
            <div>
              <div className="text-blue-200 text-xs font-semibold mb-1">Welcome back 👋</div>
              <h2 className="text-xl font-black text-white">{client.name}</h2>
              <p className="text-blue-200 text-xs mt-0.5">{client.company}</p>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[10px] text-blue-200 font-semibold uppercase tracking-wider">Client ID</div>
              <div className="text-xs font-black text-white mt-0.5 bg-white/15 px-2.5 py-1 rounded-lg">
                {uid?.slice(0,8).toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        {/* Alert banners */}
        {forms.length>0&&(
          <button onClick={()=>setTab('projects')}
            className="w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-all hover:scale-[1.01]"
            style={{background:'linear-gradient(135deg,rgba(245,158,11,0.12),rgba(251,191,36,0.06))',border:'1px solid rgba(245,158,11,0.35)'}}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{background:'rgba(245,158,11,0.2)'}}>
              <ClipboardList size={16} className="text-amber-400"/>
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-amber-400">{forms.length} form waiting to be filled</p>
              <p className="text-[11px] text-amber-400/60 mt-0.5">Fill and submit so we can prepare your quotation →</p>
            </div>
            <ChevronRight size={16} className="text-amber-400/50"/>
          </button>
        )}
        {quoted.length>0&&(
          <button onClick={()=>setTab('quotation')}
            className="w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-all hover:scale-[1.01]"
            style={{background:'linear-gradient(135deg,rgba(139,92,246,0.12),rgba(167,139,250,0.06))',border:'1px solid rgba(139,92,246,0.35)'}}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{background:'rgba(139,92,246,0.2)'}}>
              <Bell size={16} className="text-violet-400"/>
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-violet-400">{quoted.length} quotation waiting for your review</p>
              <p className="text-[11px] text-violet-400/60 mt-0.5">Tap to review and accept →</p>
            </div>
            <ChevronRight size={16} className="text-violet-400/50"/>
          </button>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-3">
          {[
            {label:'Active',val:active.length,     icon:TrendingUp,  grad:'from-blue-500 to-cyan-400',   shadow:'rgba(59,130,246,0.3)'},
            {label:'Completed',val:completed.length,icon:CheckCircle2,grad:'from-emerald-500 to-green-400',shadow:'rgba(16,185,129,0.3)'},
            {label:'Total',val:projects.length,    icon:FolderKanban,grad:'from-purple-500 to-violet-400',shadow:'rgba(139,92,246,0.3)'},
          ].map(({label,val,icon:Icon,grad,shadow})=>(
            <div key={label} className="rounded-2xl p-4 text-center relative overflow-hidden transition-all hover:scale-[1.03]"
              style={{background:'white',border:'1px solid rgba(0,0,0,0.07)',boxShadow:'0 2px 12px rgba(0,0,0,0.06)'}}>
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center mx-auto mb-2.5`}
                style={{boxShadow:`0 4px 12px ${shadow}`}}>
                <Icon size={16} className="text-white"/>
              </div>
              <div className="text-2xl font-black text-gray-900">{val}</div>
              <div className="text-[11px] text-gray-500 font-medium mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Active projects */}
        {active.length>0&&(
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-gray-900 dark:text-white">Active Projects</h3>
              <button onClick={()=>setTab('projects')} className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:gap-1.5 transition-all">
                See all <ChevronRight size={12}/>
              </button>
            </div>
            {active.map(proj=>{
              const staff=getStaffByIds(proj.assignedStaff||[]);
              const done=(proj.milestones||[]).filter(m=>m.done).length;
              const total=(proj.milestones||[]).length;
              return(
                <div key={proj.id} onClick={()=>setTab('projects')}
                  className="rounded-2xl p-4 space-y-3 cursor-pointer transition-all hover:scale-[1.01]"
                  style={{background:'white',border:'1px solid rgba(0,0,0,0.07)',boxShadow:'0 2px 12px rgba(0,0,0,0.06)'}}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-gray-900 dark:text-white truncate">{proj.title}</p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{proj.serviceType}</p>
                    </div>
                    <Chip status={proj.status}/>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gray-500">{total>0?`${done}/${total} milestones`:'Progress'}</span>
                      <span className="font-black text-blue-600">{proj.completion||0}%</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full overflow-hidden" style={{background:'rgba(0,102,255,0.08)'}}>
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{width:`${proj.completion||0}%`,background:'linear-gradient(90deg,#0066FF,#00D9FF)',boxShadow:'0 0 8px rgba(0,102,255,0.4)'}}/>
                    </div>
                  </div>
                  {staff.length>0&&(
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-1.5">
                        {staff.map(s=>(
                          <div key={s.id} title={s.name}
                            className={`w-6 h-6 rounded-full ${s.avatarColor} border-2 border-white flex items-center justify-center text-white text-[9px] font-black`}>
                            {s.avatar}
                          </div>
                        ))}
                      </div>
                      <span className="text-[11px] text-gray-500">{staff.map(s=>s.name.split(' ')[0]).join(' & ')}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* New project CTA */}
        <button onClick={()=>setTab('requirements')}
          className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all hover:scale-[1.01]"
          style={{background:'linear-gradient(135deg,rgba(0,102,255,0.06),rgba(0,217,255,0.03))',border:'1px dashed rgba(0,102,255,0.25)'}}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{background:'linear-gradient(135deg,#0066FF,#00D9FF)',boxShadow:'0 4px 14px rgba(0,102,255,0.35)'}}>
            <Zap size={18} className="text-white"/>
          </div>
          <div className="flex-1">
            <p className="text-sm font-black text-gray-900 dark:text-white">Start a new project</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Tell us what you need — we'll send a quote</p>
          </div>
          <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black text-white"
            style={{background:'linear-gradient(135deg,#0066FF,#0A84FF)',boxShadow:'0 4px 12px rgba(0,102,255,0.3)'}}>
            <Plus size={13}/> Start
          </div>
        </button>

        {projects.length===0&&(
          <div className="text-center py-10 space-y-3">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
              style={{background:'linear-gradient(135deg,rgba(0,102,255,0.1),rgba(0,217,255,0.05))'}}>
              <Sparkles size={24} className="text-blue-500"/>
            </div>
            <p className="text-sm font-black text-gray-900 dark:text-white">Your portal is ready!</p>
            <p className="text-xs text-gray-500">Submit a project request to get started.</p>
          </div>
        )}
      </div>
    );
  };

  // ── MY PROJECTS ────────────────────────────────────────────
  const ProjectsTab=()=>(
    <div className="space-y-4">
      <h2 className="text-base font-black text-gray-900 dark:text-white">My Projects</h2>
      {projects.length===0&&(
        <div className="text-center py-12">
          <FolderKanban size={40} className="text-gray-300 dark:text-gray-600 mx-auto mb-3"/>
          <p className="text-sm text-gray-500">No projects yet.</p>
          <button onClick={()=>setTab('requirements')} className="mt-3 text-xs font-bold text-blue-600 hover:underline">+ Start your first project</button>
        </div>
      )}
      {projects.map(proj=>{
        const isExp=expandedProj===proj.id;
        const staff=getStaffByIds(proj.assignedStaff||[]);
        const done=(proj.milestones||[]).filter(m=>m.done).length;
        return(
          <div key={proj.id} className="rounded-2xl overflow-hidden transition-all hover:shadow-md"
            style={{background:'white',border:'1px solid rgba(0,0,0,0.07)',boxShadow:'0 2px 8px rgba(0,0,0,0.05)'}}>
            <button className="w-full p-4 text-left" onClick={()=>setExpandedProj(isExp?null:proj.id)}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <Chip status={proj.status}/>
                  <p className="text-sm font-black text-gray-900 dark:text-white mt-1.5 truncate">{proj.title}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{proj.serviceType}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-sm font-black text-blue-600">{proj.completion||0}%</span>
                  {isExp?<ChevronUp size={15} className="text-gray-400"/>:<ChevronDown size={15} className="text-gray-400"/>}
                </div>
              </div>
              <div className="mt-3 w-full h-2 rounded-full overflow-hidden" style={{background:'rgba(0,102,255,0.08)'}}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{width:`${proj.completion||0}%`,background:'linear-gradient(90deg,#0066FF,#00D9FF)',boxShadow:'0 0 6px rgba(0,102,255,0.4)'}}/>
              </div>
            </button>
            {isExp&&(
              <div className="px-4 pb-4 space-y-4 border-t border-gray-100">
                <div className="pt-3"/>
                {(proj.milestones||[]).length>0&&(
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Milestones — {done}/{proj.milestones.length}</p>
                    {proj.milestones.map((m,i)=>(
                      <div key={i} className="flex items-center gap-2.5">
                        {m.done
                          ?<CheckCircle2 size={16} className="text-emerald-500 shrink-0"/>
                          :<div className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0"/>}
                        <span className={`text-xs ${m.done?'line-through text-gray-400':'text-gray-800 dark:text-white font-medium'}`}>{m.title}</span>
                      </div>
                    ))}
                  </div>
                )}
                {staff.length>0&&(
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Your Team</p>
                    <div className="flex flex-wrap gap-2">
                      {staff.map(s=>(
                        <div key={s.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-100"
                          style={{background:'linear-gradient(135deg,rgba(0,102,255,0.05),rgba(0,217,255,0.02))'}}>
                          <div className={`w-7 h-7 rounded-xl ${s.avatarColor} flex items-center justify-center text-white font-black text-xs`}>{s.avatar}</div>
                          <div>
                            <p className="text-xs font-bold text-gray-900 dark:text-white">{s.name}</p>
                            <p className="text-[10px] text-gray-500">{s.role}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Progress steps */}
                {['advance_paid','In Progress'].includes(proj.status)&&(proj.milestones||[]).length>0&&(
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Work Progress</p>
                    <div className="relative pl-6">
                      <div className="absolute left-2.5 top-2 bottom-2 w-px bg-gray-200"/>
                      {proj.milestones.map((m,i)=>{
                        const isCurrent=i===proj.milestones.findIndex(x=>!x.done);
                        return(
                          <div key={i} className="flex items-start gap-3 mb-3 relative">
                            <div className={`absolute -left-4 w-5 h-5 rounded-full border-2 flex items-center justify-center z-10 ${m.done?'bg-emerald-500 border-emerald-500':isCurrent?'bg-white border-blue-500 animate-pulse':'bg-white border-gray-300'}`}>
                              {m.done&&<CheckCircle2 size={12} className="text-white"/>}
                              {!m.done&&isCurrent&&<div className="w-2 h-2 rounded-full bg-blue-500"/>}
                            </div>
                            <div className="pt-0.5">
                              <p className={`text-xs font-semibold ${m.done?'text-gray-400 line-through':isCurrent?'text-blue-600 dark:text-blue-400':'text-gray-800 dark:text-white'}`}>{m.title}</p>
                              {isCurrent&&<span className="text-[10px] text-blue-500 font-bold">← In progress</span>}
                              {m.done&&<span className="text-[10px] text-emerald-500 font-bold">✓ Done</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {proj.status==='advance_paid'&&staff.length>0&&(
                  <div className="flex items-start gap-3 p-3 rounded-xl"
                    style={{background:'rgba(16,185,129,0.08)',border:'1px solid rgba(16,185,129,0.2)'}}>
                    <CheckCircle2 size={15} className="text-emerald-500 shrink-0 mt-0.5"/>
                    <div>
                      <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Team Allocated!</p>
                      <p className="text-[11px] text-emerald-600/70 mt-0.5">{staff.map(s=>s.name.split(' ')[0]).join(' & ')} will begin shortly.</p>
                    </div>
                  </div>
                )}
                <button onClick={()=>{setSelProject(proj);setTab('messages');}}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-bold text-blue-600 border border-blue-100 hover:bg-blue-50 transition-all">
                  <MessageCircle size={13}/> Message project team
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // ── QUOTATIONS ─────────────────────────────────────────────
  const QuotationTab=()=>{
    const quoted=projects.filter(p=>['quotation_sent','quotation_accepted','advance_paid'].includes(p.status));
    return(
      <div className="space-y-4">
        <h2 className="text-base font-black text-gray-900 dark:text-white">Quotations</h2>
        {quoted.length===0&&(
          <div className="text-center py-12">
            <Receipt size={40} className="text-gray-300 dark:text-gray-600 mx-auto mb-3"/>
            <p className="text-sm text-gray-500">No quotations yet.</p>
          </div>
        )}
        {quoted.map(proj=>(
          <div key={proj.id} className="rounded-2xl overflow-hidden"
            style={{background:'white',border:'1px solid rgba(0,0,0,0.07)',boxShadow:'0 2px 8px rgba(0,0,0,0.05)'}}>
            <div className="p-4 border-b border-gray-100 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black text-gray-900 dark:text-white">{proj.title}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{proj.serviceType}</p>
              </div>
              <Chip status={proj.status}/>
            </div>
            {proj.quotation&&(
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl"
                  style={{background:'linear-gradient(135deg,rgba(0,102,255,0.06),rgba(0,217,255,0.03))'}}>
                  <div>
                    <p className="text-[11px] text-gray-500">Total Amount</p>
                    <p className="text-2xl font-black text-gray-900 dark:text-white mt-0.5">{proj.quotation.totalAmount}</p>
                  </div>
                  {proj.quotation.advanceAmount&&(
                    <div className="text-right">
                      <p className="text-[11px] text-gray-500">Advance</p>
                      <p className="text-sm font-black text-emerald-600">{proj.quotation.advanceAmount}</p>
                    </div>
                  )}
                </div>
                {proj.quotation.breakdown?.length>0&&(
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Breakdown</p>
                    {proj.quotation.breakdown.map((b,i)=>(
                      <div key={i} className="flex justify-between text-xs py-1.5 border-b border-gray-100 last:border-0">
                        <span className="text-gray-600">{b.label}</span>
                        <span className="font-bold text-gray-900 dark:text-white">{b.amount}</span>
                      </div>
                    ))}
                  </div>
                )}
                {proj.quotation.notes&&<p className="text-[11px] text-gray-500 bg-gray-50 p-3 rounded-xl leading-relaxed">📋 {proj.quotation.notes}</p>}
                {proj.quotation.validUntil&&<p className="text-[11px] text-gray-400 flex items-center gap-1"><Clock size={11}/> Valid until {proj.quotation.validUntil}</p>}
                {proj.status==='quotation_sent'&&(
                  <button onClick={()=>handleAcceptQuote(proj.id)}
                    className="w-full py-3 rounded-xl text-sm font-black text-white transition-all hover:scale-[1.02]"
                    style={{background:'linear-gradient(135deg,#10B981,#059669)',boxShadow:'0 4px 14px rgba(16,185,129,0.35)'}}>
                    <CheckCircle2 size={16} className="inline mr-2"/> Accept Quotation
                  </button>
                )}
                {proj.status==='quotation_accepted'&&(
                  <button onClick={()=>handleAdvancePaid(proj.id)}
                    className="w-full py-3 rounded-xl text-sm font-black text-white transition-all hover:scale-[1.02]"
                    style={{background:'linear-gradient(135deg,#0066FF,#0A84FF)',boxShadow:'0 4px 14px rgba(0,102,255,0.35)'}}>
                    <DollarSign size={16} className="inline mr-2"/> Confirm Advance Payment
                  </button>
                )}
                {proj.status==='advance_paid'&&(
                  <div className="flex items-center justify-center gap-2 py-3 rounded-xl font-black text-emerald-600 text-sm"
                    style={{background:'rgba(16,185,129,0.08)',border:'1px solid rgba(16,185,129,0.2)'}}>
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

  // ── MESSAGES ───────────────────────────────────────────────
  const MessagesTab=()=>{
    const sessionIds=Object.keys(sessionGroups).sort().reverse();
    useEffect(()=>{if(!selProject&&projects.length===1)setSelProject(projects[0]);},[]);
    return(
      <div className="space-y-3">
        <h2 className="text-base font-black text-gray-900 dark:text-white">Messages</h2>
        {projects.length>1&&(
          <div className="flex gap-2 overflow-x-auto pb-1">
            {projects.map(p=>(
              <button key={p.id} onClick={()=>setSelProject(p)}
                className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${selProject?.id===p.id?'text-white shadow-lg':'text-gray-600 border border-gray-200 bg-white hover:border-blue-200'}`}
                style={selProject?.id===p.id?{background:'linear-gradient(135deg,#0066FF,#0A84FF)',boxShadow:'0 4px 12px rgba(0,102,255,0.3)'}:{}}>
                {p.title}
              </button>
            ))}
          </div>
        )}
        {!selProject?(
          <div className="text-center py-16">
            <MessageCircle size={40} className="text-gray-300 dark:text-gray-600 mx-auto mb-3"/>
            <p className="text-sm text-gray-500">Select a project to message your team.</p>
          </div>
        ):(
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Staff panel */}
            {(()=>{const staff=getStaffByIds(selProject.assignedStaff||[]);if(!staff.length) return null;return(
              <div className="lg:w-44 shrink-0 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 px-1">Your Team</p>
                {staff.map(s=>(
                  <div key={s.id} className="flex items-center gap-2.5 p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
                    <div className={`w-9 h-9 rounded-xl ${s.avatarColor} flex items-center justify-center text-white font-black text-sm shrink-0`}>{s.avatar}</div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-900 truncate">{s.name}</p>
                      <p className="text-[10px] text-gray-500 truncate">{s.role}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"/>
                        <span className="text-[9px] text-emerald-600">Online</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );})()}
            {/* Chat */}
            <div className="flex-1 rounded-2xl overflow-hidden flex flex-col bg-white border border-gray-100 shadow-sm" style={{height:'480px'}}>
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3"
                style={{background:'linear-gradient(135deg,rgba(0,102,255,0.04),rgba(0,217,255,0.02))'}}>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-gray-900 truncate">{selProject.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>
                    <p className="text-[10px] text-gray-500">Team is active · Session resets daily</p>
                  </div>
                </div>
                <Chip status={selProject.status}/>
                {Object.keys(sessionGroups).filter(s=>s<todaySession).length>0&&(
                  <button onClick={()=>{setReportSession(Object.keys(sessionGroups).filter(s=>s<todaySession)[0]);setReportProject(selProject);setShowReport(true);}}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold text-blue-600 border border-blue-100 bg-blue-50 hover:bg-blue-100 transition-all whitespace-nowrap">
                    <FileText size={11}/> Reports
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {sessionIds.slice().reverse().map(sid=>{
                  const isToday=sid===todaySession;
                  return(
                    <div key={sid} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-px bg-gray-100"/>
                        <span className="text-[10px] text-gray-400 font-medium px-2 shrink-0">
                          {isToday?'Today':sid}
                        </span>
                        {!isToday&&(
                          <button onClick={()=>{setReportSession(sid);setReportProject(selProject);setShowReport(true);}}
                            className="text-[10px] font-bold text-blue-500 border border-blue-100 px-2 py-0.5 rounded-lg bg-blue-50 hover:bg-blue-100 transition-all shrink-0">
                            <FileText size={10} className="inline mr-0.5"/> Report
                          </button>
                        )}
                        <div className="flex-1 h-px bg-gray-100"/>
                      </div>
                      {sessionGroups[sid].map(msg=>{
                        const isMe=msg.senderId===uid;
                        const time=msg.timestamp?.toDate?.()?.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})||'';
                        const s=!isMe&&(getStaffByIds(selProject.assignedStaff||[]).find(x=>x.id===msg.senderId)||{avatar:msg.senderName?.[0]||'S',avatarColor:'bg-slate-400'});
                        return(
                          <div key={msg.id} className={`flex items-end gap-2 ${isMe?'justify-end':'justify-start'}`}>
                            {!isMe&&<div className={`w-7 h-7 rounded-full ${s.avatarColor} flex items-center justify-center text-white text-[10px] font-black shrink-0 mb-0.5`}>{s.avatar}</div>}
                            <div className={`max-w-[70%] flex flex-col gap-0.5 ${isMe?'items-end':'items-start'}`}>
                              {!isMe&&<span className="text-[10px] font-semibold text-gray-500 px-1">{msg.senderName}</span>}
                              <div className={`px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${isMe?'text-white rounded-br-sm':'text-gray-800 rounded-bl-sm border border-gray-100'}`}
                                style={isMe?{background:'linear-gradient(135deg,#0066FF,#0A84FF)',boxShadow:'0 2px 8px rgba(0,102,255,0.25)'}:{background:'#F8FAFC'}}>
                                {msg.text}
                              </div>
                              <span className="text-[9px] text-gray-400 px-1">{time}</span>
                            </div>
                            {isMe&&(
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-black shrink-0 mb-0.5"
                                style={{background:'linear-gradient(135deg,#0066FF,#00D9FF)'}}>
                                {client.name?.[0]?.toUpperCase()||'C'}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {isToday&&<div className="flex justify-center"><span className="text-[10px] text-gray-400 bg-gray-100 px-3 py-1 rounded-full">Session ends at midnight · Auto-report generated</span></div>}
                    </div>
                  );
                })}
                {messages.length===0&&(
                  <div className="h-full flex items-center justify-center flex-col gap-2">
                    <MessageCircle size={32} className="text-gray-200"/>
                    <p className="text-xs text-gray-400">No messages yet. Say hi! 👋</p>
                  </div>
                )}
                <div ref={msgEndRef}/>
              </div>
              <form onSubmit={handleSendMsg} className="px-3 py-3 border-t border-gray-100 flex items-center gap-2 bg-gray-50">
                <input type="text" value={msgText} onChange={e=>setMsgText(e.target.value)}
                  placeholder="Type a message... (Enter to send)" autoComplete="off"
                  onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSendMsg(e);}}}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-400 transition-colors"/>
                <button type="submit" disabled={!msgText.trim()||msgSending}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white disabled:opacity-40 transition-all hover:scale-105"
                  style={{background:'linear-gradient(135deg,#0066FF,#0A84FF)',boxShadow:'0 4px 12px rgba(0,102,255,0.3)'}}>
                  <Send size={15}/>
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── INVOICES ───────────────────────────────────────────────
  const InvoicesTab=()=>(
    <div className="space-y-4">
      <h2 className="text-base font-black text-gray-900 dark:text-white">Invoices</h2>
      {!client.invoices?.length?(
        <div className="text-center py-12">
          <FileText size={40} className="text-gray-300 dark:text-gray-600 mx-auto mb-3"/>
          <p className="text-sm text-gray-500">No invoices yet.</p>
        </div>
      ):(
        <div className="space-y-3">
          {client.invoices.map(inv=>(
            <div key={inv.id} className="p-4 rounded-2xl flex items-center justify-between gap-3 bg-white border border-gray-100 shadow-sm">
              <div>
                <div className="flex items-center gap-2"><span className="text-[10px] font-black text-blue-600 font-mono">{inv.id}</span><Chip status={inv.status}/></div>
                <p className="text-xs font-bold text-gray-900 dark:text-white mt-1">{inv.description}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{inv.date}</p>
              </div>
              <p className="text-sm font-black text-gray-900 dark:text-white shrink-0">{inv.amount}</p>
            </div>
          ))}
        </div>
      )}
      <p className="text-center text-[11px] text-gray-400">Invoice queries? <span className="text-blue-600 font-semibold">accounts@smartpvtltd.com</span></p>
    </div>
  );

  // ── SUPPORT ────────────────────────────────────────────────
  const SupportTab=()=>(
    <div className="space-y-4">
      <h2 className="text-base font-black text-gray-900 dark:text-white">Support</h2>
      <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-sm space-y-3">
        <p className="text-xs font-bold text-gray-900">Need help? Contact us directly</p>
        <a href={`https://wa.me/${company.contact.whatsapp.replace(/\D/g,'')}?text=${encodeURIComponent('Hi SMART Support, I need help.')}`}
          target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-3 p-3 rounded-xl transition-all hover:scale-[1.01]"
          style={{background:'linear-gradient(135deg,rgba(37,211,102,0.08),rgba(18,140,126,0.04))',border:'1px solid rgba(37,211,102,0.25)'}}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{background:'linear-gradient(135deg,#25D366,#128C7E)',boxShadow:'0 3px 10px rgba(37,211,102,0.3)'}}>
            <MessageSquare size={16} className="text-white"/>
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-emerald-700">WhatsApp Support</p>
            <p className="text-[11px] text-emerald-600/60">Fastest — typically replies in minutes</p>
          </div>
          <ExternalLink size={13} className="text-emerald-500"/>
        </a>
        <a href={`tel:${company.contact.phone}`}
          className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-all">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{background:'linear-gradient(135deg,#0066FF,#0A84FF)',boxShadow:'0 3px 10px rgba(0,102,255,0.25)'}}>
            <Phone size={16} className="text-white"/>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-900">Call Us</p>
            <p className="text-[11px] text-gray-500">{company.contact.phoneDisplay}</p>
          </div>
        </a>
      </div>
      <p className="text-center text-[11px] text-gray-400">Response: <strong className="text-gray-700">2–4 hrs</strong> · Hours: <strong className="text-gray-700">{company.contact.businessHours}</strong></p>
    </div>
  );

  const TABS={overview:<OverviewTab/>,projects:<ProjectsTab/>,quotation:<QuotationTab/>,messages:<MessagesTab/>,invoices:<InvoicesTab/>,support:<SupportTab/>};

  // ─── LAYOUT ────────────────────────────────────────────────
  return(
    <div className="min-h-screen flex" style={{background:'#F0F4FA'}}>
      <SEO title="My Dashboard" description="SMART Pvt Ltd client portal." noIndex/>

      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 sticky top-0 h-screen overflow-hidden"
        style={{background:'linear-gradient(160deg,#0A0F2C 0%,#0D1B4B 60%,#0A2060 100%)',borderRight:'1px solid rgba(255,255,255,0.06)'}}>
        <Sidebar/>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Mobile nav */}
        <div className="lg:hidden px-4 pt-4 pb-2 flex gap-1.5 overflow-x-auto" style={{background:'linear-gradient(135deg,#0A0F2C,#0D1B4B)'}}>
          {/* Logo */}
          <div className="flex items-center gap-2 mr-3 shrink-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center overflow-hidden" style={{background:'linear-gradient(135deg,#0052CC,#0066FF)'}}>
              <img src="/logos/SMART_LOGO_ONLY_HEAD_CMP.png" alt="S" className="w-5 h-5 object-contain" style={{filter:'brightness(0) invert(1)'}} onError={e=>{e.target.style.display='none';}}/>
            </div>
          </div>
          {NAV.map(({id,label,icon:Icon})=>{
            const badge=id==='quotation'?quoteSentCount:0;
            return(
              <button key={id} onClick={()=>setTab(id)}
                className="relative flex flex-col items-center gap-0.5 px-2.5 py-2 rounded-xl text-[10px] font-bold whitespace-nowrap shrink-0 transition-all"
                style={tab===id?{background:'rgba(0,102,255,0.3)',color:'#fff',border:'1px solid rgba(0,102,255,0.4)'}:{background:'transparent',color:'rgba(255,255,255,0.45)',border:'1px solid transparent'}}>
                <Icon size={15}/>
                {label}
                {badge>0&&<span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">{badge}</span>}
              </button>
            );
          })}
          <button onClick={handleLogout} className="flex flex-col items-center gap-0.5 px-2.5 py-2 rounded-xl text-[10px] font-bold whitespace-nowrap shrink-0 text-red-400 border border-transparent">
            <LogOut size={15}/> Out
          </button>
        </div>

        {/* Content */}
        <main ref={mainRef} className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="max-w-2xl mx-auto">
            {TABS[tab]}
            {/* Requirements inline */}
            {tab==='requirements'&&(
              <div className="space-y-5">
                {reqDone?(
                  <div className="text-center py-12 space-y-4">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
                      style={{background:'linear-gradient(135deg,rgba(16,185,129,0.15),rgba(5,150,105,0.08))',border:'1px solid rgba(16,185,129,0.3)'}}>
                      <CheckCircle2 size={30} className="text-emerald-500"/>
                    </div>
                    <h3 className="text-base font-black text-gray-900 dark:text-white">Request Submitted!</h3>
                    <p className="text-xs text-gray-500 max-w-xs mx-auto">Our team will review and send a quotation within 24 hours.</p>
                    <div className="flex flex-col gap-2 max-w-xs mx-auto pt-2">
                      <button onClick={()=>{setReqDone(false);setTab('projects');}}
                        className="py-3 rounded-xl text-sm font-black text-white transition-all hover:scale-[1.02]"
                        style={{background:'linear-gradient(135deg,#0066FF,#0A84FF)',boxShadow:'0 4px 14px rgba(0,102,255,0.3)'}}>
                        View My Projects
                      </button>
                      <button onClick={()=>setReqDone(false)} className="py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:text-gray-700 transition-all">
                        Submit Another
                      </button>
                    </div>
                  </div>
                ):(
                  <>
                    <div>
                      <h2 className="text-base font-black text-gray-900 dark:text-white">New Project Request</h2>
                      <p className="text-xs text-gray-500 mt-0.5">Step {step} of 2</p>
                      <div className="flex gap-1.5 mt-3">
                        {[1,2].map(s=>(
                          <div key={s} className="h-1.5 rounded-full flex-1 transition-all duration-300"
                            style={{background:s<=step?'linear-gradient(90deg,#0066FF,#00D9FF)':'rgba(0,0,0,0.08)'}}/>
                        ))}
                      </div>
                    </div>
                    {step===1&&(
                      <div className="space-y-4 bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1.5">Project Name <span className="text-red-500">*</span></label>
                          <input type="text" value={reqForm.projectTitle} onChange={e=>setReqForm(p=>({...p,projectTitle:e.target.value}))}
                            placeholder="e.g. Restaurant POS System" autoFocus
                            className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:border-blue-400 transition-colors"/>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1.5">Type of Service <span className="text-red-500">*</span></label>
                          <select value={reqForm.serviceType} onChange={e=>setReqForm(p=>({...p,serviceType:e.target.value}))}
                            className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm focus:outline-none focus:border-blue-400 transition-colors appearance-none">
                            <option value="">Select a service...</option>
                            {['ERP & POS System','Custom Software Development','Portfolio Website','Corporate Business Website','Mobile App (Android & iOS)','Business Process Automation','AI-Powered Solutions','Accounting & Tax Services','Audit & Assurance','Other'].map(s=><option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1.5">What do you need? <span className="text-red-500">*</span></label>
                          <textarea rows={4} value={reqForm.description} onChange={e=>setReqForm(p=>({...p,description:e.target.value}))}
                            placeholder="Describe your business and what you're trying to achieve..."
                            className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:border-blue-400 transition-colors resize-none"/>
                        </div>
                        <button type="button" disabled={!reqForm.projectTitle.trim()||!reqForm.serviceType||!reqForm.description.trim()} onClick={()=>setStep(2)}
                          className="w-full py-3 rounded-xl text-sm font-black text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-[1.01] flex items-center justify-center gap-2"
                          style={{background:'linear-gradient(135deg,#0066FF,#0A84FF)',boxShadow:'0 4px 14px rgba(0,102,255,0.3)'}}>
                          Continue <ArrowRight size={16}/>
                        </button>
                      </div>
                    )}
                    {step===2&&(
                      <div className="space-y-4 bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1.5">Timeline</label>
                            <select value={reqForm.timeline} onChange={e=>setReqForm(p=>({...p,timeline:e.target.value}))}
                              className="w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm focus:outline-none focus:border-blue-400 transition-colors appearance-none">
                              <option value="">Not sure</option>
                              {['Less than 1 month','1–2 months','2–3 months','3–6 months','6+ months','Flexible'].map(t=><option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1.5">Budget</label>
                            <select value={reqForm.budget} onChange={e=>setReqForm(p=>({...p,budget:e.target.value}))}
                              className="w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm focus:outline-none focus:border-blue-400 transition-colors appearance-none">
                              <option value="">Not sure</option>
                              {['Below LKR 25,000','LKR 25,000–50,000','LKR 50,000–100,000','LKR 100,000–250,000','LKR 250,000+','Let\'s discuss'].map(b=><option key={b} value={b}>{b}</option>)}
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1.5">Reference links <span className="text-gray-400 font-normal">(optional)</span></label>
                          <input type="text" value={reqForm.references} onChange={e=>setReqForm(p=>({...p,references:e.target.value}))} placeholder="e.g. https://example.com"
                            className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm focus:outline-none focus:border-blue-400 transition-colors"/>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1.5">Any other notes <span className="text-gray-400 font-normal">(optional)</span></label>
                          <textarea rows={2} value={reqForm.extraNotes} onChange={e=>setReqForm(p=>({...p,extraNotes:e.target.value}))} placeholder="Anything else we should know..."
                            className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm focus:outline-none focus:border-blue-400 transition-colors resize-none"/>
                        </div>
                        {reqError&&<div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600"><AlertCircle size={14}/>{reqError}</div>}
                        <div className="flex gap-2">
                          <button type="button" onClick={()=>setStep(1)}
                            className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all">← Back</button>
                          <button type="button" disabled={reqSubmitting} onClick={handleReqSubmit}
                            className="flex-1 py-3 rounded-xl text-sm font-black text-white disabled:opacity-60 transition-all hover:scale-[1.01] flex items-center justify-center gap-2"
                            style={{background:'linear-gradient(135deg,#0066FF,#0A84FF)',boxShadow:'0 4px 14px rgba(0,102,255,0.3)'}}>
                            {reqSubmitting?<><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Sending...</>:<><Send size={14}/>Send Request</>}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Session Report Modal */}
      {showReport&&reportSession&&reportProject&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between"
              style={{background:'linear-gradient(135deg,rgba(0,102,255,0.04),rgba(0,217,255,0.02))'}}>
              <div>
                <h3 className="text-sm font-black text-gray-900">📋 Session Report — {reportSession}</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">{reportProject.title} · {messages.filter(m=>m.sessionId===reportSession).length} messages</p>
              </div>
              <button onClick={()=>setShowReport(false)} className="w-7 h-7 rounded-xl bg-gray-100 flex items-center justify-center text-xs text-gray-500 hover:bg-gray-200 transition-all">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {messages.filter(m=>m.sessionId===reportSession).map((msg,i)=>{
                const isMe=msg.senderId===uid;
                const time=msg.timestamp?.toDate?.()?.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})||'';
                return(
                  <div key={i} className={`flex gap-3 ${isMe?'flex-row-reverse':''}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-black shrink-0 mt-0.5 ${isMe?'':'bg-slate-400'}`}
                      style={isMe?{background:'linear-gradient(135deg,#0066FF,#00D9FF)'}:{}}>
                      {isMe?client.name?.[0]:msg.senderName?.[0]}
                    </div>
                    <div className={`flex-1 ${isMe?'text-right':''}`}>
                      <div className={`flex items-center gap-2 ${isMe?'justify-end':''}`}>
                        <span className="text-[10px] font-semibold text-gray-500">{isMe?'You':msg.senderName}</span>
                        <span className="text-[9px] text-gray-400">{time}</span>
                      </div>
                      <p className={`text-xs mt-1 inline-block px-3 py-2 rounded-xl leading-relaxed ${isMe?'text-blue-700 bg-blue-50':'text-gray-800 bg-gray-100'}`}>{msg.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={()=>{navigator.clipboard.writeText(messages.filter(m=>m.sessionId===reportSession).map(m=>`[${m.timestamp?.toDate?.()?.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})||''}] ${m.senderRole==='client'?'You':m.senderName}: ${m.text}`).join('\n'));}}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all">
                <FileText size={13}/> Copy Report
              </button>
              <a href={`https://wa.me/${company.contact.whatsapp.replace(/\D/g,'')}?text=${encodeURIComponent(`📋 Session Report\nProject: ${reportProject.title}\nDate: ${reportSession}\n\n${messages.filter(m=>m.sessionId===reportSession).map(m=>`[${m.timestamp?.toDate?.()?.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})||''}] ${m.senderRole==='client'?'You':m.senderName}: ${m.text}`).join('\n')}`)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black text-white transition-all hover:scale-[1.02]"
                style={{background:'linear-gradient(135deg,#25D366,#128C7E)',boxShadow:'0 4px 12px rgba(37,211,102,0.3)'}}>
                <MessageSquare size={13}/> Send to Admin
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
