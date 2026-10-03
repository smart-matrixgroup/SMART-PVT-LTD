import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { getStaffByIds } from '../config/staff';
import SEO from '../components/SEO';
import { company } from '../config/company';
import {
  LayoutDashboard, FolderKanban, FileText,
  HeadphonesIcon, LogOut, MessageSquare, Sparkles,
  User, Shield, ChevronRight, CheckCircle2,
  Clock, Calendar, Send, AlertCircle,
  ClipboardList, Receipt, TrendingUp,
  Info, DollarSign, MessageCircle, Bell,
  Plus, ArrowRight, ChevronDown, ChevronUp,
  Phone, ExternalLink, Zap,
} from 'lucide-react';

// ─── DEV MOCK DATA ────────────────────────────────────────────────
const DEV_PROJECTS = [
  {
    id: 'dev-proj-001',
    clientId: 'dev-client-001',
    title: 'Corporate Website Redesign',
    serviceType: 'Corporate Business Website',
    description: 'Full website redesign with modern UI.',
    status: 'In Progress',
    completion: 65,
    createdAt: null,
    milestones: [
      { title: 'Discovery & Blueprint', done: true  },
      { title: 'UI/UX Design',          done: true  },
      { title: 'Development',           done: false },
      { title: 'QA & Testing',          done: false },
      { title: 'Deployment',            done: false },
    ],
    quotation: {
      totalAmount: 'LKR 85,000', advanceAmount: 'LKR 30,000',
      breakdown: [
        { label: 'Design & UI/UX',   amount: 'LKR 25,000' },
        { label: 'Development',      amount: 'LKR 45,000' },
        { label: 'SEO & Deployment', amount: 'LKR 15,000' },
      ],
      validUntil: 'Nov 15, 2026',
      notes: 'Includes 3 months free support after launch.',
    },
    assignedStaff: ['STAFF-001', 'STAFF-002'],
  },
  {
    id: 'dev-proj-002',
    clientId: 'dev-client-001',
    title: 'Mobile App Development',
    serviceType: 'Mobile App (Android & iOS)',
    description: 'Cross-platform mobile app for order management.',
    status: 'quotation_sent',
    completion: 0,
    createdAt: null,
    milestones: [],
    quotation: {
      totalAmount: 'LKR 150,000', advanceAmount: 'LKR 50,000',
      breakdown: [
        { label: 'Architecture & Design',    amount: 'LKR 40,000' },
        { label: 'Android & iOS Dev',        amount: 'LKR 90,000' },
        { label: 'Testing & Deployment',     amount: 'LKR 20,000' },
      ],
      validUntil: 'Nov 30, 2026',
      notes: 'Cross-platform using React Native.',
    },
    assignedStaff: [],
  },
];
const DEV_MESSAGES = [
  { id: 'msg-001', senderId: 'staff-001', senderName: 'Ashan', senderRole: 'staff',
    text: 'Hi! The homepage design is ready for your review. Please check and let me know your feedback.',
    sessionId: new Date().toISOString().slice(0,10), timestamp: { toDate: () => new Date(Date.now()-3600000) } },
  { id: 'msg-002', senderId: 'dev-client-001', senderName: 'You', senderRole: 'client',
    text: 'Looks great! Can we change the hero section color to blue?',
    sessionId: new Date().toISOString().slice(0,10), timestamp: { toDate: () => new Date(Date.now()-1800000) } },
  { id: 'msg-003', senderId: 'staff-001', senderName: 'Ashan', senderRole: 'staff',
    text: 'Sure! Will update that and send you the revised version by EOD.',
    sessionId: new Date().toISOString().slice(0,10), timestamp: { toDate: () => new Date(Date.now()-900000) } },
];

// ─── HELPERS ──────────────────────────────────────────────────────
const statusConfig = {
  'requirements_pending': { label: 'Under Review',      color: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30' },
  'quotation_sent':       { label: 'Quote Ready',        color: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30' },
  'quotation_accepted':   { label: 'Quote Accepted',     color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30' },
  'advance_paid':         { label: 'Starting Soon',      color: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30' },
  'In Progress':          { label: 'In Progress',        color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30' },
  'Completed':            { label: 'Completed',          color: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30' },
  'Paid':                 { label: 'Paid',               color: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30' },
  'Pending':              { label: 'Pending',            color: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30' },
  'Open':                 { label: 'Open',               color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30' },
  'Resolved':             { label: 'Resolved',           color: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30' },
};

const Chip = ({ status, size = 'sm' }) => {
  const cfg = statusConfig[status] || { label: status, color: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30' };
  return (
    <span className={`font-semibold rounded-full border ${size === 'sm' ? 'text-[10px] px-2.5 py-0.5' : 'text-xs px-3 py-1'} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
};

const Card = ({ children, className = '', onClick }) => (
  <div onClick={onClick}
    className={`rounded-2xl border border-[#E8EFF8] dark:border-surface-border bg-white dark:bg-navy-800 shadow-sm ${onClick ? 'cursor-pointer hover:shadow-md hover:border-primary/30 dark:hover:border-primary-cyan/30 transition-all' : ''} ${className}`}>
    {children}
  </div>
);

// ─── NAV CONFIG ───────────────────────────────────────────────────
const NAV = [
  { id: 'overview',     label: 'Home',         icon: LayoutDashboard },
  { id: 'projects',     label: 'My Projects',  icon: FolderKanban    },
  { id: 'requirements', label: 'New Request',  icon: Plus            },
  { id: 'quotation',    label: 'Quotations',   icon: Receipt         },
  { id: 'messages',     label: 'Messages',     icon: MessageCircle   },
  { id: 'invoices',     label: 'Invoices',     icon: FileText        },
  { id: 'support',      label: 'Support',      icon: HeadphonesIcon  },
];

// ─── MAIN ─────────────────────────────────────────────────────────
export default function ClientDashboardPage() {
  const navigate = useNavigate();
  const { clientProfile, logout, currentUser, isDevSession } = useAuth();
  const [tab, setTab]             = useState('overview');
  const [projects, setProjects]   = useState([]);
  const [messages, setMessages]   = useState([]);
  const [selProject, setSelProject] = useState(null);
  const [expandedProj, setExpandedProj] = useState(null);
  const [msgText, setMsgText]     = useState('');
  const [msgSending, setMsgSending] = useState(false);
  const msgEndRef                 = useRef(null);

  // Requirements form
  const [step, setStep]           = useState(1); // multi-step form
  const [reqForm, setReqForm]     = useState({ projectTitle:'', serviceType:'', description:'', timeline:'', budget:'', references:'', extraNotes:'' });
  const [reqSubmitting, setReqSubmitting] = useState(false);
  const [reqDone, setReqDone]     = useState(false);
  const [reqError, setReqError]   = useState('');

  const client = clientProfile && { projects:[], invoices:[], tickets:[], ...clientProfile };
  const uid    = currentUser?.uid;

  // Load projects
  useEffect(() => {
    if (!uid) return;
    // Skip Firestore for dev mock sessions — use local mock data
    if (!isFirebaseConfigured || isDevSession) {
      setProjects(DEV_PROJECTS.filter(() => uid.startsWith('dev-')));
      return;
    }
    const q = query(collection(db,'projects'), where('clientId','==',uid), orderBy('createdAt','desc'));
    return onSnapshot(q, snap => setProjects(snap.docs.map(d => ({ id:d.id, ...d.data() }))));
  }, [uid, isDevSession]);

  // Load messages
  useEffect(() => {
    if (!selProject) { setMessages([]); return; }
    // Skip Firestore for dev mock sessions
    if (!isFirebaseConfigured || isDevSession) { setMessages(DEV_MESSAGES); return; }
    const q = query(collection(db,'messages',selProject.id,'chats'), orderBy('timestamp','asc'));
    return onSnapshot(q, snap => setMessages(snap.docs.map(d => ({ id:d.id, ...d.data() }))));
  }, [selProject, isDevSession]);

  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages]);

  const handleLogout = async () => { await logout(); navigate('/client-login'); };

  if (!client) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F8FC] dark:bg-navy-950">
      <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
    </div>
  );

  // Derived counts for badges
  const quoteSentCount  = projects.filter(p => p.status === 'quotation_sent').length;
  const activeCount     = projects.filter(p => ['In Progress','advance_paid'].includes(p.status)).length;

  // ── SEND MESSAGE ────────────────────────────────────────────
  const handleSendMsg = async (e) => {
    e.preventDefault();
    if (!msgText.trim() || !selProject) return;
    setMsgSending(true);
    const sessionId = new Date().toISOString().slice(0,10);
    const newMsg = { id:`msg-${Date.now()}`, senderId:uid, senderName:client.name, senderRole:'client',
      text:msgText.trim(), sessionId, timestamp:{ toDate:()=>new Date() } };
    if (!isFirebaseConfigured || isDevSession) {
      setMessages(prev => [...prev, newMsg]);
    } else {
      try {
        await addDoc(collection(db,'messages',selProject.id,'chats'),
          { senderId:uid, senderName:client.name, senderRole:'client', text:msgText.trim(), timestamp:serverTimestamp(), sessionId });
      } catch(err) { console.error(err); }
    }
    setMsgText(''); setMsgSending(false);
  };

  // ── ACCEPT QUOTATION ────────────────────────────────────────
  const handleAcceptQuote = async (projectId) => {
    if (!isFirebaseConfigured || isDevSession) { setProjects(p => p.map(x => x.id===projectId ? {...x,status:'quotation_accepted'} : x)); return; }
    try { await updateDoc(doc(db,'projects',projectId), { status:'quotation_accepted', updatedAt:serverTimestamp() }); }
    catch(err) { console.error(err); }
  };

  // ── ADVANCE PAID ─────────────────────────────────────────────
  const handleAdvancePaid = async (projectId) => {
    if (!isFirebaseConfigured || isDevSession) { setProjects(p => p.map(x => x.id===projectId ? {...x,status:'advance_paid'} : x)); return; }
    try { await updateDoc(doc(db,'projects',projectId), { status:'advance_paid', updatedAt:serverTimestamp(), 'payment.advancePaidByClient':true }); }
    catch(err) { console.error(err); }
  };

  // ── SUBMIT REQUIREMENTS ──────────────────────────────────────
  const handleReqSubmit = async (e) => {
    e.preventDefault();
    setReqError('');
    if (!reqForm.projectTitle.trim() || !reqForm.serviceType || !reqForm.description.trim()) {
      setReqError('Please fill in all required fields.'); return;
    }
    setReqSubmitting(true);
    const payload = { clientId:uid, clientName:client.name, clientCompany:client.company||'',
      status:'requirements_pending', title:reqForm.projectTitle.trim(), serviceType:reqForm.serviceType,
      description:reqForm.description.trim(), timeline:reqForm.timeline, budget:reqForm.budget,
      references:reqForm.references.trim(), extraNotes:reqForm.extraNotes.trim(),
      quotation:null, milestones:[], completion:0, assignedStaff:[] };
    try {
      if (!isFirebaseConfigured || isDevSession) {
        setProjects(prev => [{ id:`dev-proj-${Date.now()}`, ...payload, createdAt:null }, ...prev]);
      } else {
        await addDoc(collection(db,'projects'), { ...payload, createdAt:serverTimestamp(), updatedAt:serverTimestamp() });
      }
      setReqDone(true); setStep(1);
      setReqForm({ projectTitle:'', serviceType:'', description:'', timeline:'', budget:'', references:'', extraNotes:'' });
    } catch(err) { console.error(err); setReqError('Submission failed. Please try again.'); }
    finally { setReqSubmitting(false); }
  };

  // ════════════════════════════════════════════════════════════
  // OVERVIEW
  // ════════════════════════════════════════════════════════════
  const OverviewTab = () => {
    const active    = projects.filter(p => ['In Progress','advance_paid'].includes(p.status));
    const completed = projects.filter(p => p.status === 'Completed');
    const quoted    = projects.filter(p => p.status === 'quotation_sent');

    return (
      <div className="space-y-5">
        {/* Welcome */}
        <div className="rounded-2xl p-5 bg-gradient-to-br from-[#0052CC] to-[#0066FF] text-white overflow-hidden relative">
          <div className="absolute right-0 top-0 w-40 h-40 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/4" />
          <div className="absolute right-8 bottom-0 w-24 h-24 rounded-full bg-white/5 translate-y-1/2" />
          <div className="relative">
            <p className="text-xs font-medium opacity-75">Welcome back 👋</p>
            <h2 className="text-xl font-extrabold mt-1">{client.name}</h2>
            <p className="text-xs opacity-70 mt-0.5">{client.company}</p>
          </div>
        </div>

        {/* Quick action pills — quotation alert */}
        {quoted.length > 0 && (
          <button onClick={() => setTab('quotation')}
            className="w-full flex items-center gap-3 p-4 rounded-2xl bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/30 hover:bg-violet-100 dark:hover:bg-violet-500/15 transition-all text-left">
            <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-violet-700 dark:text-violet-300">
                {quoted.length} quotation{quoted.length>1?'s':''} waiting for your review
              </p>
              <p className="text-[11px] text-violet-500 dark:text-violet-400 mt-0.5">Tap to review and accept →</p>
            </div>
            <ChevronRight className="w-4 h-4 text-violet-400 shrink-0" />
          </button>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Active',    value: active.length,    color: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-50 dark:bg-blue-500/10',   icon: TrendingUp   },
            { label: 'Completed', value: completed.length, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-500/10', icon: CheckCircle2 },
            { label: 'Total',     value: projects.length,  color: 'text-[#5B6E88] dark:text-text-muted', bg: 'bg-[#F4F8FC] dark:bg-navy-700',   icon: FolderKanban },
          ].map(({ label, value, color, bg, icon: Icon }) => (
            <Card key={label} className="p-4 text-center">
              <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center mx-auto mb-2`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className="text-xl font-extrabold text-[#0A1E3F] dark:text-white">{value}</p>
              <p className="text-[11px] text-[#5B6E88] dark:text-text-muted">{label}</p>
            </Card>
          ))}
        </div>

        {/* Active projects */}
        {active.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#0A1E3F] dark:text-white">Active Projects</h3>
              <button onClick={() => setTab('projects')} className="text-xs text-primary dark:text-primary-cyan font-semibold hover:underline flex items-center gap-1">
                See all <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            {active.map(proj => {
              const staff = getStaffByIds(proj.assignedStaff || []);
              const done  = (proj.milestones||[]).filter(m=>m.done).length;
              const total = (proj.milestones||[]).length;
              return (
                <Card key={proj.id} className="p-4 space-y-3" onClick={() => setTab('projects')}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#0A1E3F] dark:text-white truncate">{proj.title}</p>
                      <p className="text-[11px] text-[#5B6E88] dark:text-text-muted mt-0.5">{proj.serviceType}</p>
                    </div>
                    <Chip status={proj.status} />
                  </div>
                  {/* Progress */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-[#5B6E88] dark:text-text-muted">{total>0 ? `${done}/${total} milestones` : 'Progress'}</span>
                      <span className="font-bold text-primary dark:text-primary-cyan">{proj.completion||0}%</span>
                    </div>
                    <div className="w-full h-2 bg-[#EBF3FC] dark:bg-navy-700 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-primary to-primary-electric rounded-full transition-all duration-500"
                        style={{ width:`${proj.completion||0}%` }} />
                    </div>
                  </div>
                  {/* Team */}
                  {staff.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-1.5">
                        {staff.map(s => (
                          <div key={s.id} title={`${s.name} — ${s.role}`}
                            className={`w-6 h-6 rounded-full ${s.avatarColor} border-2 border-white dark:border-navy-800 flex items-center justify-center text-white text-[9px] font-bold`}>
                            {s.avatar}
                          </div>
                        ))}
                      </div>
                      <span className="text-[11px] text-[#5B6E88] dark:text-text-muted">
                        {staff.map(s=>s.name.split(' ')[0]).join(' & ')}
                      </span>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* New project CTA */}
        <Card className="p-5 border-dashed border-primary/30 dark:border-primary-cyan/20 bg-gradient-to-br from-primary/5 to-transparent dark:from-primary/10">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-primary dark:text-primary-cyan" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-[#0A1E3F] dark:text-white">Start a new project</p>
              <p className="text-[11px] text-[#5B6E88] dark:text-text-muted mt-0.5">Tell us what you need — we'll send a quote</p>
            </div>
            <button onClick={() => setTab('requirements')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary-hover transition-all shrink-0">
              <Plus className="w-3.5 h-3.5" /> Start
            </button>
          </div>
        </Card>

        {/* Empty state */}
        {projects.length === 0 && (
          <div className="text-center py-8 space-y-2">
            <Sparkles className="w-10 h-10 text-[#C8D8EE] dark:text-text-muted mx-auto" />
            <p className="text-sm font-semibold text-[#0A1E3F] dark:text-white">Your portal is ready!</p>
            <p className="text-xs text-[#5B6E88] dark:text-text-muted">Submit a project request to get started.</p>
          </div>
        )}
      </div>
    );
  };

  // ════════════════════════════════════════════════════════════
  // MY PROJECTS
  // ════════════════════════════════════════════════════════════
  const ProjectsTab = () => (
    <div className="space-y-4">
      <h2 className="text-base font-bold text-[#0A1E3F] dark:text-white">My Projects</h2>

      {projects.length === 0 && (
        <div className="text-center py-12">
          <FolderKanban className="w-10 h-10 text-[#C8D8EE] dark:text-text-muted mx-auto mb-3" />
          <p className="text-sm text-[#5B6E88] dark:text-text-muted">No projects yet.</p>
          <button onClick={() => setTab('requirements')}
            className="mt-3 text-xs font-bold text-primary dark:text-primary-cyan hover:underline">
            + Start your first project
          </button>
        </div>
      )}

      {projects.map(proj => {
        const isExpanded = expandedProj === proj.id;
        const staff      = getStaffByIds(proj.assignedStaff || []);
        const doneMiles  = (proj.milestones||[]).filter(m=>m.done).length;

        return (
          <Card key={proj.id} className="overflow-hidden">
            {/* Header — always visible */}
            <button className="w-full p-4 text-left" onClick={() => setExpandedProj(isExpanded ? null : proj.id)}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Chip status={proj.status} />
                  </div>
                  <p className="text-sm font-bold text-[#0A1E3F] dark:text-white mt-1.5 truncate">{proj.title}</p>
                  <p className="text-[11px] text-[#5B6E88] dark:text-text-muted mt-0.5">{proj.serviceType}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-sm font-bold text-primary dark:text-primary-cyan">{proj.completion||0}%</span>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-[#5B6E88]" /> : <ChevronDown className="w-4 h-4 text-[#5B6E88]" />}
                </div>
              </div>
              {/* Mini progress bar */}
              <div className="mt-3 w-full h-1.5 bg-[#EBF3FC] dark:bg-navy-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary to-primary-electric rounded-full"
                  style={{ width:`${proj.completion||0}%` }} />
              </div>
            </button>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="px-4 pb-4 space-y-4 border-t border-[#F0F4F8] dark:border-surface-border pt-4">

                {/* Milestones */}
                {(proj.milestones||[]).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#5B6E88] dark:text-text-muted">
                      Milestones — {doneMiles}/{proj.milestones.length} done
                    </p>
                    <div className="space-y-1.5">
                      {proj.milestones.map((m, i) => (
                        <div key={i} className="flex items-center gap-2.5">
                          {m.done
                            ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                            : <div className="w-4 h-4 rounded-full border-2 border-[#C8D8EE] dark:border-surface-border shrink-0" />}
                          <span className={`text-xs ${m.done ? 'line-through text-[#8B9AAF] dark:text-text-muted' : 'text-[#0A1E3F] dark:text-white'}`}>
                            {m.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Assigned team */}
                {staff.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#5B6E88] dark:text-text-muted">Your Team</p>
                    <div className="flex flex-wrap gap-2">
                      {staff.map(s => (
                        <div key={s.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#F4F8FC] dark:bg-navy-700 border border-[#E8EFF8] dark:border-surface-border">
                          <div className={`w-8 h-8 rounded-xl ${s.avatarColor} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                            {s.avatar}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-[#0A1E3F] dark:text-white leading-none">{s.name}</p>
                            <p className="text-[10px] text-[#5B6E88] dark:text-text-muted mt-0.5">{s.role}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Work progress steps — shown when advance paid or in progress */}
                {['advance_paid','In Progress'].includes(proj.status) && (proj.milestones||[]).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#5B6E88] dark:text-text-muted">
                      Work Progress
                    </p>
                    <div className="relative">
                      {/* Vertical line */}
                      <div className="absolute left-3.5 top-4 bottom-4 w-px bg-[#E8EFF8] dark:bg-surface-border" />
                      <div className="space-y-3">
                        {proj.milestones.map((m, i) => (
                          <div key={i} className="flex items-start gap-3 relative">
                            {/* Step dot */}
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 border-2 ${
                              m.done
                                ? 'bg-emerald-500 border-emerald-500'
                                : i === (proj.milestones.findIndex(x=>!x.done))
                                  ? 'bg-white dark:bg-navy-800 border-primary dark:border-primary-cyan animate-pulse'
                                  : 'bg-white dark:bg-navy-800 border-[#C8D8EE] dark:border-surface-border'
                            }`}>
                              {m.done
                                ? <CheckCircle2 className="w-4 h-4 text-white" />
                                : <span className="text-[10px] font-bold text-[#5B6E88] dark:text-text-muted">{i+1}</span>
                              }
                            </div>
                            {/* Step content */}
                            <div className={`flex-1 pb-3 ${i < proj.milestones.length-1 ? '' : ''}`}>
                              <p className={`text-xs font-semibold ${
                                m.done ? 'text-[#5B6E88] dark:text-text-muted line-through' :
                                i === (proj.milestones.findIndex(x=>!x.done)) ? 'text-primary dark:text-primary-cyan' :
                                'text-[#0A1E3F] dark:text-white'
                              }`}>{m.title}</p>
                              {i === (proj.milestones.findIndex(x=>!x.done)) && (
                                <span className="text-[10px] text-primary dark:text-primary-cyan font-medium">← In progress</span>
                              )}
                              {m.done && (
                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">✓ Completed</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Staff allocated alert — shown right after advance paid */}
                {proj.status === 'advance_paid' && staff.length > 0 && (
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Team Allocated!</p>
                      <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
                        {staff.map(s=>s.name.split(' ')[0]).join(' & ')} {staff.length===1?'has':'have'} been assigned to your project and will begin work shortly.
                      </p>
                    </div>
                  </div>
                )}

                {/* Message button */}
                <button onClick={() => { setSelProject(proj); setTab('messages'); }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-primary dark:text-primary-cyan bg-primary/5 dark:bg-primary/10 border border-primary/20 dark:border-primary-cyan/20 hover:bg-primary/10 transition-all w-full justify-center">
                  <MessageCircle className="w-3.5 h-3.5" /> Message project team
                </button>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );

  // ════════════════════════════════════════════════════════════
  // NEW REQUEST (multi-step)
  // ════════════════════════════════════════════════════════════
  const RequirementsTab = () => {
    const services  = ['ERP & POS System','Custom Software Development','Portfolio Website','Corporate Business Website','Mobile App (Android & iOS)','Business Process Automation','AI-Powered Solutions','Accounting & Tax Services','Audit & Assurance','Other'];
    const timelines = ['Less than 1 month','1–2 months','2–3 months','3–6 months','6+ months','Flexible'];
    const budgets   = ['Below LKR 25,000','LKR 25,000–50,000','LKR 50,000–100,000','LKR 100,000–250,000','LKR 250,000+','Let\'s discuss'];

    if (reqDone) return (
      <div className="py-12 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h3 className="text-base font-extrabold text-[#0A1E3F] dark:text-white">Request Submitted!</h3>
          <p className="text-xs text-[#5B6E88] dark:text-text-muted mt-1 max-w-xs mx-auto">
            Our team will review and send you a quotation within 24 hours.
          </p>
        </div>
        <div className="flex flex-col gap-2 max-w-xs mx-auto pt-2">
          <button onClick={() => { setReqDone(false); setTab('projects'); }}
            className="py-2.5 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary-hover transition-all">
            View My Projects
          </button>
          <button onClick={() => setReqDone(false)}
            className="py-2.5 rounded-xl text-xs font-semibold text-[#5B6E88] dark:text-text-muted hover:text-[#0A1E3F] dark:hover:text-white transition-all">
            Submit Another Request
          </button>
        </div>
      </div>
    );

    const inputCls = "w-full px-4 py-3 rounded-xl bg-[#F4F8FC] dark:bg-navy-700 border border-[#E8EFF8] dark:border-surface-border text-[#0A1E3F] dark:text-white text-sm placeholder:text-[#A0B0C0] focus:outline-none focus:border-primary dark:focus:border-primary-electric transition-colors";
    const selectCls = inputCls + " appearance-none";

    return (
      <div className="space-y-5">
        {/* Step header */}
        <div>
          <h2 className="text-base font-bold text-[#0A1E3F] dark:text-white">New Project Request</h2>
          <p className="text-xs text-[#5B6E88] dark:text-text-muted mt-0.5">Step {step} of 2</p>
          {/* Step indicator */}
          <div className="flex gap-1.5 mt-3">
            {[1,2].map(s => (
              <div key={s} className={`h-1 rounded-full flex-1 transition-all ${s<=step ? 'bg-primary dark:bg-primary-cyan' : 'bg-[#E8EFF8] dark:bg-navy-700'}`} />
            ))}
          </div>
        </div>

        <form onSubmit={step===2 ? handleReqSubmit : (e) => { e.preventDefault(); setStep(2); }} className="space-y-4">

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#29405E] dark:text-text-light mb-1.5">
                  Project Name <span className="text-red-400">*</span>
                </label>
                <input type="text" required value={reqForm.projectTitle}
                  onChange={e => setReqForm(p=>({...p,projectTitle:e.target.value}))}
                  placeholder="e.g. Restaurant POS System"
                  className={inputCls} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#29405E] dark:text-text-light mb-1.5">
                  Type of Service <span className="text-red-400">*</span>
                </label>
                <select required value={reqForm.serviceType}
                  onChange={e => setReqForm(p=>({...p,serviceType:e.target.value}))}
                  className={selectCls}>
                  <option value="" disabled>Select a service...</option>
                  {services.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#29405E] dark:text-text-light mb-1.5">
                  What do you need? <span className="text-red-400">*</span>
                </label>
                <textarea required rows={4} value={reqForm.description}
                  onChange={e => setReqForm(p=>({...p,description:e.target.value}))}
                  placeholder="Describe your business and what you're trying to achieve..."
                  className={inputCls + " resize-none"} />
              </div>

              <button type="submit" disabled={!reqForm.projectTitle||!reqForm.serviceType||!reqForm.description}
                className="w-full py-3 rounded-xl text-sm font-bold text-white bg-primary hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#29405E] dark:text-text-light mb-1.5">Timeline</label>
                  <select value={reqForm.timeline} onChange={e=>setReqForm(p=>({...p,timeline:e.target.value}))} className={selectCls}>
                    <option value="">Not sure</option>
                    {timelines.map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#29405E] dark:text-text-light mb-1.5">Budget</label>
                  <select value={reqForm.budget} onChange={e=>setReqForm(p=>({...p,budget:e.target.value}))} className={selectCls}>
                    <option value="">Not sure</option>
                    {budgets.map(b=><option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#29405E] dark:text-text-light mb-1.5">
                  Reference links <span className="text-[#8B9AAF] font-normal">(optional)</span>
                </label>
                <input type="text" value={reqForm.references}
                  onChange={e=>setReqForm(p=>({...p,references:e.target.value}))}
                  placeholder="e.g. https://example.com"
                  className={inputCls} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#29405E] dark:text-text-light mb-1.5">
                  Any other notes <span className="text-[#8B9AAF] font-normal">(optional)</span>
                </label>
                <textarea rows={2} value={reqForm.extraNotes}
                  onChange={e=>setReqForm(p=>({...p,extraNotes:e.target.value}))}
                  placeholder="Anything else we should know..."
                  className={inputCls + " resize-none"} />
              </div>

              {reqError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-xs text-red-600 dark:text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {reqError}
                </div>
              )}

              <div className="flex gap-2">
                <button type="button" onClick={() => setStep(1)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-[#5B6E88] dark:text-text-muted bg-[#F4F8FC] dark:bg-navy-700 border border-[#E8EFF8] dark:border-surface-border transition-all">
                  ← Back
                </button>
                <button type="submit" disabled={reqSubmitting}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-primary hover:bg-primary-hover disabled:opacity-60 transition-all flex items-center justify-center gap-2">
                  {reqSubmitting ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Sending...</> : <><Send className="w-4 h-4" /> Send Request</>}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    );
  };

  // ════════════════════════════════════════════════════════════
  // QUOTATIONS
  // ════════════════════════════════════════════════════════════
  const QuotationTab = () => {
    const quoted = projects.filter(p => ['quotation_sent','quotation_accepted','advance_paid'].includes(p.status));
    return (
      <div className="space-y-4">
        <h2 className="text-base font-bold text-[#0A1E3F] dark:text-white">Quotations</h2>

        {quoted.length === 0 && (
          <div className="text-center py-12">
            <Receipt className="w-10 h-10 text-[#C8D8EE] dark:text-text-muted mx-auto mb-3" />
            <p className="text-sm text-[#5B6E88] dark:text-text-muted">No quotations yet.</p>
            <p className="text-xs text-[#5B6E88] dark:text-text-muted mt-1">Quotes appear here after you submit a project request.</p>
          </div>
        )}

        {quoted.map(proj => (
          <Card key={proj.id} className="overflow-hidden">
            {/* Project name + status */}
            <div className="p-4 border-b border-[#F0F4F8] dark:border-surface-border flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[#0A1E3F] dark:text-white">{proj.title}</p>
                <p className="text-[11px] text-[#5B6E88] dark:text-text-muted mt-0.5">{proj.serviceType}</p>
              </div>
              <Chip status={proj.status} />
            </div>

            {/* Quote details */}
            {proj.quotation && (
              <div className="p-4 space-y-4">
                {/* Total */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-[#F4F8FC] dark:bg-navy-700">
                  <div>
                    <p className="text-[11px] text-[#5B6E88] dark:text-text-muted">Total Amount</p>
                    <p className="text-2xl font-extrabold text-[#0A1E3F] dark:text-white mt-0.5">{proj.quotation.totalAmount}</p>
                  </div>
                  {proj.quotation.advanceAmount && (
                    <div className="text-right">
                      <p className="text-[11px] text-[#5B6E88] dark:text-text-muted">Advance</p>
                      <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{proj.quotation.advanceAmount}</p>
                    </div>
                  )}
                </div>

                {/* Breakdown */}
                {proj.quotation.breakdown?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#5B6E88] dark:text-text-muted">Breakdown</p>
                    {proj.quotation.breakdown.map((item,i) => (
                      <div key={i} className="flex justify-between text-xs py-1.5 border-b border-[#F0F4F8] dark:border-surface-border last:border-0">
                        <span className="text-[#29405E] dark:text-text-light">{item.label}</span>
                        <span className="font-semibold text-[#0A1E3F] dark:text-white">{item.amount}</span>
                      </div>
                    ))}
                  </div>
                )}

                {proj.quotation.notes && (
                  <p className="text-[11px] text-[#5B6E88] dark:text-text-muted bg-[#F4F8FC] dark:bg-navy-700 p-3 rounded-xl leading-relaxed">
                    📋 {proj.quotation.notes}
                  </p>
                )}

                {proj.quotation.validUntil && (
                  <p className="text-[11px] text-[#5B6E88] dark:text-text-muted flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Valid until {proj.quotation.validUntil}
                  </p>
                )}

                {/* Action */}
                {proj.status === 'quotation_sent' && (
                  <button onClick={() => handleAcceptQuote(proj.id)}
                    className="w-full py-3 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Accept Quotation
                  </button>
                )}
                {proj.status === 'quotation_accepted' && (
                  <button onClick={() => handleAdvancePaid(proj.id)}
                    className="w-full py-3 rounded-xl text-sm font-bold text-white bg-primary hover:bg-primary-hover shadow-glow-sm transition-all flex items-center justify-center gap-2">
                    <DollarSign className="w-4 h-4" /> Confirm Advance Payment Sent
                  </button>
                )}
                {proj.status === 'advance_paid' && (
                  <div className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
                    <CheckCircle2 className="w-4 h-4" /> Advance Paid — Work Starting Soon!
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
    );
  };

  // ════════════════════════════════════════════════════════════
  // MESSAGES — improved with staff panel + smooth typing
  // ════════════════════════════════════════════════════════════
  const MessagesTab = () => {
    const inputRef = useRef(null);

    // Auto-select first project if only one exists
    useEffect(() => {
      if (!selProject && projects.length === 1) setSelProject(projects[0]);
    }, []);

    return (
    <div className="space-y-3">
      <h2 className="text-base font-bold text-[#0A1E3F] dark:text-white">Messages</h2>

      {/* Project selector tabs */}
      {projects.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {projects.map(p => (
            <button key={p.id} onClick={() => setSelProject(p)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                selProject?.id === p.id
                  ? 'bg-primary text-white'
                  : 'bg-[#F4F8FC] dark:bg-navy-700 text-[#5B6E88] dark:text-text-muted border border-[#E8EFF8] dark:border-surface-border hover:border-primary/30'
              }`}>
              {p.title}
            </button>
          ))}
        </div>
      )}

      {!selProject ? (
        <div className="text-center py-16">
          <MessageCircle className="w-10 h-10 text-[#C8D8EE] dark:text-text-muted mx-auto mb-3" />
          <p className="text-sm text-[#5B6E88] dark:text-text-muted">Select a project above to message your team.</p>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-3">

          {/* ── Staff panel (left on desktop, top on mobile) ── */}
          {(() => {
            const staff = getStaffByIds(selProject.assignedStaff || []);
            if (!staff.length) return null;
            return (
              <div className="lg:w-48 shrink-0 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#5B6E88] dark:text-text-muted px-1">Your Team</p>
                {staff.map(s => (
                  <div key={s.id} className="flex items-center gap-2.5 p-3 rounded-xl bg-white dark:bg-navy-800 border border-[#E8EFF8] dark:border-surface-border">
                    <div className={`w-9 h-9 rounded-xl ${s.avatarColor} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                      {s.avatar}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#0A1E3F] dark:text-white truncate">{s.name}</p>
                      <p className="text-[10px] text-[#5B6E88] dark:text-text-muted truncate">{s.role}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        <span className="text-[9px] text-green-600 dark:text-green-400">Online</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* ── Chat window ── */}
          <div className="flex-1 min-w-0 rounded-2xl border border-[#E8EFF8] dark:border-surface-border bg-white dark:bg-navy-800 overflow-hidden flex flex-col" style={{height:'480px'}}>
            {/* Header */}
            <div className="px-4 py-3 bg-[#F4F8FC] dark:bg-navy-700 border-b border-[#E8EFF8] dark:border-surface-border flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[#0A1E3F] dark:text-white truncate">{selProject.title}</p>
                <p className="text-[10px] text-[#5B6E88] dark:text-text-muted flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" />
                  Team is active
                </p>
              </div>
              <Chip status={selProject.status} />
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.length === 0 && (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center space-y-2">
                    <MessageCircle className="w-8 h-8 text-[#C8D8EE] dark:text-text-muted mx-auto" />
                    <p className="text-xs text-[#5B6E88] dark:text-text-muted">No messages yet. Say hi to your team! 👋</p>
                  </div>
                </div>
              )}
              {messages.map(msg => {
                const isMe = msg.senderId === uid;
                const time = msg.timestamp?.toDate?.()?.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) || '';
                return (
                  <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                    {/* Staff avatar */}
                    {!isMe && (() => {
                      const s = getStaffByIds(selProject.assignedStaff||[]).find(x => x.id === msg.senderId) ||
                                { avatar: msg.senderName?.[0]||'S', avatarColor:'bg-slate-500' };
                      return (
                        <div className={`w-7 h-7 rounded-full ${s.avatarColor} flex items-center justify-center text-white text-[10px] font-bold shrink-0 mb-0.5`}>
                          {s.avatar}
                        </div>
                      );
                    })()}
                    <div className={`max-w-[72%] flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                      {!isMe && <span className="text-[10px] font-medium text-[#5B6E88] dark:text-text-muted px-1">{msg.senderName}</span>}
                      <div className={`px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                        isMe
                          ? 'bg-primary text-white rounded-br-sm'
                          : 'bg-[#F4F8FC] dark:bg-navy-700 text-[#0A1E3F] dark:text-white rounded-bl-sm border border-[#E8EFF8] dark:border-surface-border'
                      }`}>
                        {msg.text}
                      </div>
                      <span className="text-[9px] text-[#8B9AAF] dark:text-text-muted px-1">{time}</span>
                    </div>
                    {/* My avatar */}
                    {isMe && (
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary-electric flex items-center justify-center text-white text-[10px] font-bold shrink-0 mb-0.5">
                        {client.name?.[0]?.toUpperCase()||'C'}
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={msgEndRef} />
            </div>

            {/* Input — smooth, no mouse needed */}
            <form onSubmit={handleSendMsg}
              className="px-3 py-3 border-t border-[#E8EFF8] dark:border-surface-border bg-[#F4F8FC] dark:bg-navy-700 flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={msgText}
                onChange={e => setMsgText(e.target.value)}
                onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSendMsg(e); }}}
                placeholder="Type a message... (Enter to send)"
                autoComplete="off"
                autoFocus={!!selProject}
                className="flex-1 px-4 py-2.5 rounded-xl bg-white dark:bg-navy-800 border border-[#E8EFF8] dark:border-surface-border text-[#0A1E3F] dark:text-white text-sm placeholder:text-[#A0B0C0] focus:outline-none focus:border-primary dark:focus:border-primary-electric transition-colors"
              />
              <button type="submit" disabled={!msgText.trim() || msgSending}
                className="w-10 h-10 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-40 transition-all flex items-center justify-center shrink-0">
                <Send className="w-4 h-4 text-white" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
    );
  };

  // ════════════════════════════════════════════════════════════
  // INVOICES
  // ════════════════════════════════════════════════════════════
  const InvoicesTab = () => (
    <div className="space-y-4">
      <h2 className="text-base font-bold text-[#0A1E3F] dark:text-white">Invoices</h2>
      {!client.invoices?.length ? (
        <div className="text-center py-12">
          <FileText className="w-10 h-10 text-[#C8D8EE] dark:text-text-muted mx-auto mb-3" />
          <p className="text-sm text-[#5B6E88] dark:text-text-muted">No invoices yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {client.invoices.map(inv => (
            <Card key={inv.id} className="p-4 flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold text-primary dark:text-primary-cyan">{inv.id}</span>
                  <Chip status={inv.status} />
                </div>
                <p className="text-xs font-semibold text-[#0A1E3F] dark:text-white mt-1">{inv.description}</p>
                <p className="text-[11px] text-[#5B6E88] dark:text-text-muted mt-0.5 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {inv.date}
                </p>
              </div>
              <p className="text-sm font-extrabold text-[#0A1E3F] dark:text-white shrink-0">{inv.amount}</p>
            </Card>
          ))}
        </div>
      )}
      <p className="text-center text-[11px] text-[#5B6E88] dark:text-text-muted">
        Invoice queries? Email <span className="text-primary dark:text-primary-cyan font-medium">accounts@smartpvtltd.com</span>
      </p>
    </div>
  );

  // ════════════════════════════════════════════════════════════
  // SUPPORT
  // ════════════════════════════════════════════════════════════
  const SupportTab = () => (
    <div className="space-y-4">
      <h2 className="text-base font-bold text-[#0A1E3F] dark:text-white">Support</h2>

      {/* Quick contact */}
      <Card className="p-4">
        <p className="text-xs font-bold text-[#0A1E3F] dark:text-white mb-3">Need help? Contact us directly</p>
        <div className="space-y-2">
          <a href={`https://wa.me/${company.contact.whatsapp.replace(/\D/g,'')}?text=${encodeURIComponent(`Hi SMART Support, I need help.`)}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-500/15 transition-all">
            <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">WhatsApp Support</p>
              <p className="text-[11px] text-emerald-600/70 dark:text-emerald-400/70">Fastest — typically replies in minutes</p>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          </a>
          <a href={`tel:${company.contact.phone}`}
            className="flex items-center gap-3 p-3 rounded-xl bg-[#F4F8FC] dark:bg-navy-700 border border-[#E8EFF8] dark:border-surface-border hover:border-primary/30 transition-all">
            <Phone className="w-4 h-4 text-primary dark:text-primary-cyan shrink-0" />
            <div>
              <p className="text-xs font-bold text-[#0A1E3F] dark:text-white">Call Us</p>
              <p className="text-[11px] text-[#5B6E88] dark:text-text-muted">{company.contact.phoneDisplay}</p>
            </div>
          </a>
        </div>
      </Card>

      {/* Tickets — only show if admin has added tickets to client profile */}



      <p className="text-center text-[11px] text-[#5B6E88] dark:text-text-muted">
        Response time: <strong className="text-[#0A1E3F] dark:text-white">2–4 hrs</strong> · Hours: <strong className="text-[#0A1E3F] dark:text-white">{company.contact.businessHours}</strong>
      </p>
    </div>
  );

  // ════════════════════════════════════════════════════════════
  // TAB ROUTER
  // ════════════════════════════════════════════════════════════
  const TABS = {
    overview: <OverviewTab />, projects: <ProjectsTab />,
    requirements: <RequirementsTab />, quotation: <QuotationTab />,
    messages: <MessagesTab />, invoices: <InvoicesTab />, support: <SupportTab />,
  };

  // ════════════════════════════════════════════════════════════
  // LAYOUT
  // ════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#F4F8FC] dark:bg-navy-950 pt-16">
      <SEO title="My Dashboard" description="SMART Pvt Ltd client portal." noIndex />

      <div className="max-w-6xl mx-auto px-4 py-6 flex gap-6 items-start">

        {/* ── Desktop Sidebar ─────────────────────────────── */}
        <aside className="hidden lg:flex flex-col w-52 shrink-0 rounded-2xl border border-[#E8EFF8] dark:border-surface-border bg-white dark:bg-navy-900 overflow-hidden sticky top-20 shadow-sm" style={{minHeight:'calc(100vh - 6rem)'}}>
          {/* User info */}
          <div className="p-4 border-b border-[#F0F4F8] dark:border-surface-border">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-electric flex items-center justify-center text-white font-bold text-sm shrink-0">
                {client.name?.[0]?.toUpperCase() || 'C'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#0A1E3F] dark:text-white truncate">{client.name}</p>
                <p className="text-[10px] text-[#5B6E88] dark:text-text-muted truncate">{client.company}</p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="p-2 flex-1">
            {NAV.map(({ id, label, icon: Icon }) => {
              const badge = id==='quotation' ? quoteSentCount : id==='projects' ? activeCount : 0;
              return (
                <button key={id} onClick={() => setTab(id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all mb-0.5 ${
                    tab === id
                      ? 'bg-primary text-white'
                      : 'text-[#5B6E88] dark:text-text-muted hover:bg-[#F4F8FC] dark:hover:bg-navy-700 hover:text-[#0A1E3F] dark:hover:text-white'
                  }`}>
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1 text-left">{label}</span>
                  {badge > 0 && (
                    <span className={`text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${tab===id ? 'bg-white/25 text-white' : 'bg-primary/10 text-primary dark:text-primary-cyan'}`}>
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Logout */}
          <div className="p-2 border-t border-[#F0F4F8] dark:border-surface-border">
            <button onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all">
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </aside>

        {/* ── Main Content ─────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">

          {/* Mobile tab bar */}
          <div className="lg:hidden flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
            {NAV.map(({ id, label, icon: Icon }) => {
              const badge = id==='quotation' ? quoteSentCount : 0;
              return (
                <button key={id} onClick={() => setTab(id)}
                  className={`relative flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl text-[10px] font-semibold whitespace-nowrap shrink-0 transition-all ${
                    tab===id ? 'bg-primary text-white' : 'bg-white dark:bg-navy-800 text-[#5B6E88] dark:text-text-muted border border-[#E8EFF8] dark:border-surface-border'
                  }`}>
                  <Icon className="w-4 h-4" />
                  {label}
                  {badge>0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{badge}</span>}
                </button>
              );
            })}
            <button onClick={handleLogout}
              className="flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl text-[10px] font-semibold whitespace-nowrap shrink-0 bg-white dark:bg-navy-800 text-red-500 dark:text-red-400 border border-[#E8EFF8] dark:border-surface-border">
              <LogOut className="w-4 h-4" /> Out
            </button>
          </div>

          {/* Page content */}
          <div className="min-w-0">
            {TABS[tab]}
          </div>
        </div>
      </div>
    </div>
  );
}
