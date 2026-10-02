import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, doc, serverTimestamp, getDocs
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import SEO from '../components/SEO';
import {
  LayoutDashboard, FolderKanban, FileText,
  HeadphonesIcon, LogOut, MessageSquare, Sparkles,
  User, Building, Shield, ChevronRight, CheckCircle2,
  Clock, Calendar, ExternalLink, Send, AlertCircle,
  ClipboardList, Receipt, TrendingUp, Phone, Mail,
  ArrowRight, Info, DollarSign, Package, Layers,
  CheckSquare, MessageCircle
} from 'lucide-react';
import { company } from '../config/company';

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

const SB = ({ status, size = 'sm' }) => {
  const map = {
    'requirements_pending': 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
    'quotation_sent':       'bg-blue-100  text-blue-700  border-blue-200  dark:bg-blue-500/15  dark:text-blue-300  dark:border-blue-500/30',
    'quotation_accepted':   'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30',
    'advance_paid':         'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
    'In Progress':          'bg-blue-100  text-blue-700  border-blue-200  dark:bg-blue-500/15  dark:text-blue-300  dark:border-blue-500/30',
    'Completed':            'bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30',
    'Paid':                 'bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30',
    'Pending':              'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
    'Open':                 'bg-blue-100  text-blue-700  border-blue-200  dark:bg-blue-500/15  dark:text-blue-300  dark:border-blue-500/30',
    'Resolved':             'bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30',
    'New':                  'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30',
  };
  const base = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1';
  const label = {
    'requirements_pending': 'Requirements Pending',
    'quotation_sent':       'Quotation Sent',
    'quotation_accepted':   'Quotation Accepted',
    'advance_paid':         'Advance Paid',
  }[status] || status;
  return <span className={`${base} font-bold rounded-full border ${map[status] || 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30'}`}>{label}</span>;
};

const Card = ({ children, className = '' }) => (
  <div className={`rounded-2xl border border-[#DCE6F2] dark:border-surface-border bg-white dark:bg-navy-800 ${className}`}>
    {children}
  </div>
);

const Empty = ({ icon: Icon, title, sub }) => (
  <Card className="p-10 text-center space-y-3">
    <Icon className="w-8 h-8 text-[#5B6E88] dark:text-text-muted mx-auto" />
    <p className="text-sm font-semibold text-[#0A1E3F] dark:text-white">{title}</p>
    {sub && <p className="text-xs text-[#5B6E88] dark:text-text-muted">{sub}</p>}
  </Card>
);

// ─────────────────────────────────────────────────────────────────
// NAV
// ─────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'overview',      label: 'Overview',        icon: LayoutDashboard },
  { id: 'requirements',  label: 'New Project',      icon: ClipboardList   },
  { id: 'projects',      label: 'My Projects',      icon: FolderKanban    },
  { id: 'quotation',     label: 'Quotations',       icon: Receipt         },
  { id: 'messages',      label: 'Messages',         icon: MessageCircle   },
  { id: 'invoices',      label: 'Invoices',         icon: FileText        },
  { id: 'support',       label: 'Support',          icon: HeadphonesIcon  },
];

// ─────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────
export default function ClientDashboardPage() {
  const navigate = useNavigate();
  const { clientProfile, logout, currentUser } = useAuth();
  const [tab, setTab] = useState('overview');

  // Firestore real-time data
  const [projects,  setProjects]  = useState([]);
  const [messages,  setMessages]  = useState([]);         // for selected project
  const [selProject, setSelProject] = useState(null);     // selected project for messages

  // Requirements form state
  const [reqForm, setReqForm] = useState({
    projectTitle: '', serviceType: '', description: '',
    timeline: '', budget: '', references: '', extraNotes: '',
  });
  const [reqSubmitting, setReqSubmitting] = useState(false);
  const [reqDone, setReqDone]             = useState(false);
  const [reqError, setReqError]           = useState('');

  // Message composer state
  const [msgText, setMsgText]     = useState('');
  const [msgSending, setMsgSending] = useState(false);
  const msgEndRef                 = useRef(null);

  const client = clientProfile && {
    projects: [], invoices: [], tickets: [], ...clientProfile,
  };

  const uid = currentUser?.uid;

  // ── Load projects for this client ────────────────────────────
  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, 'projects'),
      where('clientId', '==', uid),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, snap => {
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [uid]);

  // ── Load messages for selected project (real-time) ───────────
  useEffect(() => {
    if (!selProject) { setMessages([]); return; }
    const q = query(
      collection(db, 'messages', selProject.id, 'chats'),
      orderBy('timestamp', 'asc')
    );
    return onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [selProject]);

  // ── Scroll to latest message ─────────────────────────────────
  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleLogout = async () => { await logout(); navigate('/client-login'); };

  if (!client) return null;

  // ─────────────────────────────────────────────────────────────
  // SUBMIT REQUIREMENTS
  // ─────────────────────────────────────────────────────────────
  const handleReqSubmit = async (e) => {
    e.preventDefault();
    setReqError('');
    if (!reqForm.projectTitle.trim() || !reqForm.serviceType || !reqForm.description.trim()) {
      setReqError('Please fill in all required fields.');
      return;
    }
    setReqSubmitting(true);
    try {
      await addDoc(collection(db, 'projects'), {
        clientId:     uid,
        clientName:   client.name,
        clientCompany: client.company || '',
        status:       'requirements_pending',
        createdAt:    serverTimestamp(),
        updatedAt:    serverTimestamp(),
        // Requirements form data
        title:        reqForm.projectTitle.trim(),
        serviceType:  reqForm.serviceType,
        description:  reqForm.description.trim(),
        timeline:     reqForm.timeline,
        budget:       reqForm.budget,
        references:   reqForm.references.trim(),
        extraNotes:   reqForm.extraNotes.trim(),
        // Placeholders admin will fill
        quotation:    null,
        milestones:   [],
        completion:   0,
        assignedStaff: [],
      });
      setReqDone(true);
      setReqForm({ projectTitle:'', serviceType:'', description:'', timeline:'', budget:'', references:'', extraNotes:'' });
    } catch (err) {
      console.error(err);
      setReqError('Submission failed. Please try again.');
    } finally {
      setReqSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // ACCEPT QUOTATION
  // ─────────────────────────────────────────────────────────────
  const handleAcceptQuotation = async (projectId) => {
    try {
      await updateDoc(doc(db, 'projects', projectId), {
        status:    'quotation_accepted',
        updatedAt: serverTimestamp(),
        'quotation.acceptedAt': serverTimestamp(),
      });
    } catch (err) { console.error(err); }
  };

  // ─────────────────────────────────────────────────────────────
  // CONFIRM ADVANCE PAYMENT
  // ─────────────────────────────────────────────────────────────
  const handleAdvancePaid = async (projectId) => {
    try {
      await updateDoc(doc(db, 'projects', projectId), {
        status:    'advance_paid',
        updatedAt: serverTimestamp(),
        'payment.advancePaidAt': serverTimestamp(),
        'payment.advancePaidByClient': true,
      });
    } catch (err) { console.error(err); }
  };

  // ─────────────────────────────────────────────────────────────
  // SEND MESSAGE
  // ─────────────────────────────────────────────────────────────
  const handleSendMsg = async (e) => {
    e.preventDefault();
    if (!msgText.trim() || !selProject) return;
    setMsgSending(true);
    try {
      // Session ID = date string (YYYY-MM-DD) — new session every 24h
      const sessionId = new Date().toISOString().slice(0, 10);
      await addDoc(collection(db, 'messages', selProject.id, 'chats'), {
        senderId:   uid,
        senderName: client.name,
        senderRole: 'client',
        text:       msgText.trim(),
        timestamp:  serverTimestamp(),
        sessionId,
      });
      setMsgText('');
    } catch (err) { console.error(err); }
    finally { setMsgSending(false); }
  };

  // ─────────────────────────────────────────────────────────────
  // SIDEBAR
  // ─────────────────────────────────────────────────────────────
  const Sidebar = () => (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 border-b border-[#DCE6F2] dark:border-surface-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-cyan border border-primary/20 flex items-center justify-center shrink-0">
            <User className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-[#0A1E3F] dark:text-white truncate">{client.name}</p>
            <p className="text-[11px] text-[#5B6E88] dark:text-text-muted truncate">{client.company}</p>
          </div>
        </div>
      </div>
      <nav className="px-3 py-4 space-y-1 flex-1">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              tab === id
                ? 'bg-primary text-white shadow-glow-sm'
                : 'text-[#3E526C] dark:text-text-muted hover:bg-[#F0F6FF] dark:hover:bg-navy-700 hover:text-[#0A1E3F] dark:hover:text-white'
            }`}>
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </button>
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-[#DCE6F2] dark:border-surface-border">
        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all">
          <LogOut className="w-4 h-4 shrink-0" /> Sign Out
        </button>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────
  // TAB: OVERVIEW
  // ─────────────────────────────────────────────────────────────
  const OverviewTab = () => {
    const active    = projects.filter(p => p.status === 'In Progress' || p.status === 'advance_paid');
    const completed = projects.filter(p => p.status === 'Completed');
    const pending   = projects.filter(p => p.status === 'requirements_pending');
    const quoteSent = projects.filter(p => p.status === 'quotation_sent');

    return (
      <div className="space-y-6">
        {/* Welcome banner */}
        <div className="rounded-2xl p-5 bg-gradient-to-r from-primary to-primary-electric text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider opacity-80">Welcome back</p>
            <h2 className="text-xl font-extrabold mt-0.5">{client.name}</h2>
            <p className="text-xs opacity-75 mt-1">{client.company} · Client since {client.clientSince || '—'}</p>
          </div>
          <div className="flex items-center gap-2 text-xs bg-white/15 px-3 py-2 rounded-xl shrink-0">
            <Shield className="w-3.5 h-3.5" />
            ID: {uid?.slice(0,8).toUpperCase()}
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Active',       value: active.length,    icon: TrendingUp,    color: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-50 dark:bg-blue-500/10'   },
            { label: 'Pending Quote',value: quoteSent.length, icon: Receipt,       color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-500/10'},
            { label: 'Requirements', value: pending.length,   icon: ClipboardList, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
            { label: 'Completed',    value: completed.length, icon: CheckCircle2,  color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-500/10' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <Card key={label} className="p-4">
              <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className="text-2xl font-extrabold text-[#0A1E3F] dark:text-white">{value}</p>
              <p className="text-[11px] text-[#5B6E88] dark:text-text-muted mt-0.5">{label}</p>
            </Card>
          ))}
        </div>

        {/* New project CTA */}
        <div className="rounded-2xl p-5 border border-dashed border-primary/40 dark:border-primary-cyan/30 bg-primary/5 dark:bg-primary/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-[#0A1E3F] dark:text-white">Have a new project in mind?</p>
            <p className="text-xs text-[#5B6E88] dark:text-text-muted mt-0.5">Fill in your requirements and our team will create a custom quotation.</p>
          </div>
          <button onClick={() => setTab('requirements')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary-hover shadow-glow-sm transition-all shrink-0">
            <ClipboardList className="w-4 h-4" /> Start New Project
          </button>
        </div>

        {/* Active project progress */}
        {active.length > 0 && (
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#0A1E3F] dark:text-white">Active Projects</h3>
              <button onClick={() => setTab('projects')} className="text-xs text-primary dark:text-primary-cyan font-semibold hover:underline flex items-center gap-1">
                View all <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            {active.map(proj => (
              <div key={proj.id} className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#0A1E3F] dark:text-white">{proj.title}</span>
                  <span className="font-bold text-primary dark:text-primary-cyan">{proj.completion || 0}%</span>
                </div>
                <div className="w-full h-2 bg-[#EBF3FC] dark:bg-navy-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary to-primary-electric rounded-full transition-all"
                    style={{ width: `${proj.completion || 0}%` }} />
                </div>
              </div>
            ))}
          </Card>
        )}

        {/* Quotation alert */}
        {quoteSent.length > 0 && (
          <div className="rounded-2xl p-4 border border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10 flex items-start gap-3">
            <Info className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-bold text-violet-700 dark:text-violet-300">
                You have {quoteSent.length} quotation{quoteSent.length > 1 ? 's' : ''} waiting for your review!
              </p>
              <button onClick={() => setTab('quotation')} className="text-xs text-violet-600 dark:text-violet-400 hover:underline font-semibold mt-0.5">
                Review & Accept →
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {projects.length === 0 && (
          <Empty icon={Sparkles}
            title="Your portal is ready!"
            sub="Submit a project request and our team will get back to you with a quotation." />
        )}
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────
  // TAB: REQUIREMENTS FORM
  // ─────────────────────────────────────────────────────────────
  const RequirementsTab = () => {
    const services = [
      'ERP & POS System', 'Custom Software Development',
      'Portfolio Website', 'Corporate Business Website',
      'Mobile App (Android & iOS)', 'Business Process Automation',
      'AI-Powered Solutions', 'Accounting & Tax Services',
      'Audit & Assurance', 'Other',
    ];
    const timelines = ['Less than 1 month','1–2 months','2–3 months','3–6 months','6+ months','Flexible'];
    const budgets   = ['Below LKR 25,000','LKR 25,000–50,000','LKR 50,000–100,000','LKR 100,000–250,000','LKR 250,000+','Discuss with team'];

    if (reqDone) return (
      <div className="space-y-5">
        <Card className="p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-extrabold text-[#0A1E3F] dark:text-white">Requirements Submitted!</h3>
          <p className="text-xs text-[#5B6E88] dark:text-text-muted max-w-sm mx-auto leading-relaxed">
            Our team will review your requirements and create a custom quotation. You'll be notified when it's ready.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <button onClick={() => { setReqDone(false); setTab('projects'); }}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary-hover transition-all">
              View My Projects →
            </button>
            <button onClick={() => setReqDone(false)}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-[#29405E] dark:text-text-light bg-[#F0F6FF] dark:bg-navy-700 border border-[#C8D8EE] dark:border-surface-border transition-all">
              Submit Another
            </button>
          </div>
        </Card>
      </div>
    );

    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-bold text-[#0A1E3F] dark:text-white">New Project Requirements</h2>
          <p className="text-xs text-[#5B6E88] dark:text-text-muted mt-0.5">
            Fill in the details below. Our team will review and send you a tailored quotation.
          </p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleReqSubmit} className="space-y-5">

            {/* Project title + service */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#29405E] dark:text-text-light mb-1.5">
                  Project Title <span className="text-red-500">*</span>
                </label>
                <input type="text" required value={reqForm.projectTitle}
                  onChange={e => setReqForm(p => ({ ...p, projectTitle: e.target.value }))}
                  placeholder="e.g. Restaurant POS System"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F8FC] dark:bg-navy-700 border border-[#C8D8EE] dark:border-surface-border text-[#0A1E3F] dark:text-white text-sm placeholder:text-[#8B9AAF] focus:outline-none focus:border-primary dark:focus:border-primary-electric transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#29405E] dark:text-text-light mb-1.5">
                  Service Type <span className="text-red-500">*</span>
                </label>
                <select required value={reqForm.serviceType}
                  onChange={e => setReqForm(p => ({ ...p, serviceType: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F8FC] dark:bg-navy-700 border border-[#C8D8EE] dark:border-surface-border text-[#0A1E3F] dark:text-white text-sm focus:outline-none focus:border-primary dark:focus:border-primary-electric transition-colors appearance-none">
                  <option value="" disabled>Select service...</option>
                  {services.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-[#29405E] dark:text-text-light mb-1.5">
                Project Description <span className="text-red-500">*</span>
              </label>
              <textarea required rows={4} value={reqForm.description}
                onChange={e => setReqForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Describe your business, what you need, current problems you're trying to solve..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F8FC] dark:bg-navy-700 border border-[#C8D8EE] dark:border-surface-border text-[#0A1E3F] dark:text-white text-sm placeholder:text-[#8B9AAF] focus:outline-none focus:border-primary dark:focus:border-primary-electric transition-colors resize-none"
              />
            </div>

            {/* Timeline + Budget */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#29405E] dark:text-text-light mb-1.5">Expected Timeline</label>
                <select value={reqForm.timeline}
                  onChange={e => setReqForm(p => ({ ...p, timeline: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F8FC] dark:bg-navy-700 border border-[#C8D8EE] dark:border-surface-border text-[#0A1E3F] dark:text-white text-sm focus:outline-none focus:border-primary dark:focus:border-primary-electric transition-colors appearance-none">
                  <option value="">Not sure</option>
                  {timelines.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#29405E] dark:text-text-light mb-1.5">Budget Range</label>
                <select value={reqForm.budget}
                  onChange={e => setReqForm(p => ({ ...p, budget: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F8FC] dark:bg-navy-700 border border-[#C8D8EE] dark:border-surface-border text-[#0A1E3F] dark:text-white text-sm focus:outline-none focus:border-primary dark:focus:border-primary-electric transition-colors appearance-none">
                  <option value="">Not sure</option>
                  {budgets.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>

            {/* References + Notes */}
            <div>
              <label className="block text-xs font-semibold text-[#29405E] dark:text-text-light mb-1.5">
                Reference Links / Examples <span className="text-[#5B6E88] dark:text-text-muted font-normal">(optional)</span>
              </label>
              <input type="text" value={reqForm.references}
                onChange={e => setReqForm(p => ({ ...p, references: e.target.value }))}
                placeholder="e.g. https://example.com — a website you like"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F8FC] dark:bg-navy-700 border border-[#C8D8EE] dark:border-surface-border text-[#0A1E3F] dark:text-white text-sm placeholder:text-[#8B9AAF] focus:outline-none focus:border-primary dark:focus:border-primary-electric transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#29405E] dark:text-text-light mb-1.5">
                Additional Notes <span className="text-[#5B6E88] dark:text-text-muted font-normal">(optional)</span>
              </label>
              <textarea rows={2} value={reqForm.extraNotes}
                onChange={e => setReqForm(p => ({ ...p, extraNotes: e.target.value }))}
                placeholder="Any other details, integrations needed, or special requirements..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F8FC] dark:bg-navy-700 border border-[#C8D8EE] dark:border-surface-border text-[#0A1E3F] dark:text-white text-sm placeholder:text-[#8B9AAF] focus:outline-none focus:border-primary dark:focus:border-primary-electric transition-colors resize-none"
              />
            </div>

            {/* Error */}
            {reqError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-xs text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0" /> {reqError}
              </div>
            )}

            <button type="submit" disabled={reqSubmitting}
              className="w-full py-3 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary-hover disabled:opacity-60 shadow-glow-sm transition-all flex items-center justify-center gap-2">
              {reqSubmitting ? (
                <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Submitting...</>
              ) : (
                <><Send className="w-4 h-4" /> Submit Requirements</>
              )}
            </button>
          </form>
        </Card>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────
  // TAB: MY PROJECTS
  // ─────────────────────────────────────────────────────────────
  const ProjectsTab = () => (
    <div className="space-y-5">
      <h2 className="text-lg font-bold text-[#0A1E3F] dark:text-white">My Projects</h2>
      {projects.length === 0
        ? <Empty icon={FolderKanban} title="No projects yet" sub="Submit your requirements to get started." />
        : projects.map(proj => (
          <Card key={proj.id} className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="text-[11px] text-[#5B6E88] dark:text-text-muted font-mono">{proj.id.slice(0,10).toUpperCase()}</p>
                <h3 className="text-sm font-bold text-[#0A1E3F] dark:text-white mt-0.5">{proj.title}</h3>
                <p className="text-xs text-[#5B6E88] dark:text-text-muted mt-0.5">{proj.serviceType}</p>
              </div>
              <SB status={proj.status} size="md" />
            </div>

            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-[#5B6E88] dark:text-text-muted">Completion</span>
                <span className="font-bold text-primary dark:text-primary-cyan">{proj.completion || 0}%</span>
              </div>
              <div className="w-full h-2 bg-[#EBF3FC] dark:bg-navy-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary to-primary-electric rounded-full"
                  style={{ width: `${proj.completion || 0}%` }} />
              </div>
            </div>

            {/* Milestones */}
            {proj.milestones?.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#5B6E88] dark:text-text-muted">Milestones</p>
                {proj.milestones.map((m, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-xs">
                    {m.done
                      ? <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                      : <Clock className="w-4 h-4 text-[#5B6E88] dark:text-text-muted shrink-0" />}
                    <span className={`${m.done ? 'line-through opacity-60' : ''} text-[#0A1E3F] dark:text-white`}>{m.title}</span>
                    {m.done && <span className="text-[10px] text-green-600 dark:text-green-400 font-semibold">Done</span>}
                  </div>
                ))}
              </div>
            )}

            {/* Message button */}
            <button
              onClick={() => { setSelProject(proj); setTab('messages'); }}
              className="flex items-center gap-2 text-xs font-semibold text-primary dark:text-primary-cyan hover:underline">
              <MessageCircle className="w-3.5 h-3.5" /> Open project messages
            </button>
          </Card>
        ))
      }
    </div>
  );

  // ─────────────────────────────────────────────────────────────
  // TAB: QUOTATION
  // ─────────────────────────────────────────────────────────────
  const QuotationTab = () => {
    const quoted = projects.filter(p => p.status === 'quotation_sent' || p.status === 'quotation_accepted' || p.status === 'advance_paid');
    return (
      <div className="space-y-5">
        <h2 className="text-lg font-bold text-[#0A1E3F] dark:text-white">Quotations</h2>
        {quoted.length === 0
          ? <Empty icon={Receipt} title="No quotations yet" sub="Quotations will appear here once our team reviews your requirements." />
          : quoted.map(proj => (
            <Card key={proj.id} className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="text-sm font-bold text-[#0A1E3F] dark:text-white">{proj.title}</h3>
                  <p className="text-xs text-[#5B6E88] dark:text-text-muted mt-0.5">{proj.serviceType}</p>
                </div>
                <SB status={proj.status} size="md" />
              </div>

              {/* Quotation details */}
              {proj.quotation && (
                <div className="p-4 rounded-xl bg-[#F4F8FC] dark:bg-navy-700 border border-[#DCE6F2] dark:border-surface-border space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#0A1E3F] dark:text-white">Total Quotation</span>
                    <span className="text-xl font-extrabold text-primary dark:text-primary-cyan">{proj.quotation.totalAmount}</span>
                  </div>

                  {proj.quotation.breakdown?.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#5B6E88] dark:text-text-muted">Breakdown</p>
                      {proj.quotation.breakdown.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-[#29405E] dark:text-text-light">{item.label}</span>
                          <span className="font-semibold text-[#0A1E3F] dark:text-white">{item.amount}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {proj.quotation.advanceAmount && (
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-[#DCE6F2] dark:border-surface-border">
                      <span className="text-[#5B6E88] dark:text-text-muted">Advance Payment Required</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{proj.quotation.advanceAmount}</span>
                    </div>
                  )}

                  {proj.quotation.validUntil && (
                    <p className="text-[11px] text-[#5B6E88] dark:text-text-muted flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Valid until: {proj.quotation.validUntil}
                    </p>
                  )}

                  {proj.quotation.notes && (
                    <p className="text-[11px] text-[#29405E] dark:text-text-light bg-white dark:bg-navy-800 p-3 rounded-lg border border-[#DCE6F2] dark:border-surface-border leading-relaxed">
                      {proj.quotation.notes}
                    </p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                {proj.status === 'quotation_sent' && (
                  <button onClick={() => handleAcceptQuotation(proj.id)}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Accept Quotation
                  </button>
                )}
                {proj.status === 'quotation_accepted' && (
                  <button onClick={() => handleAdvancePaid(proj.id)}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary-hover shadow-glow-sm transition-all flex items-center justify-center gap-2">
                    <DollarSign className="w-4 h-4" /> Confirm Advance Payment
                  </button>
                )}
                {proj.status === 'advance_paid' && (
                  <div className="flex-1 py-2.5 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Advance Paid — Work Starting Soon
                  </div>
                )}
              </div>
            </Card>
          ))
        }
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────
  // TAB: MESSAGES (real-time)
  // ─────────────────────────────────────────────────────────────
  const MessagesTab = () => {
    const sessionId = new Date().toISOString().slice(0, 10);

    // Group messages by sessionId
    const sessions = messages.reduce((acc, msg) => {
      const sid = msg.sessionId || sessionId;
      if (!acc[sid]) acc[sid] = [];
      acc[sid].push(msg);
      return acc;
    }, {});

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-bold text-[#0A1E3F] dark:text-white">Messages</h2>
          {projects.length > 0 && (
            <select
              value={selProject?.id || ''}
              onChange={e => setSelProject(projects.find(p => p.id === e.target.value) || null)}
              className="px-3 py-2 rounded-xl bg-[#F4F8FC] dark:bg-navy-700 border border-[#C8D8EE] dark:border-surface-border text-[#0A1E3F] dark:text-white text-xs focus:outline-none focus:border-primary dark:focus:border-primary-electric">
              <option value="">Select project...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          )}
        </div>

        {!selProject
          ? <Empty icon={MessageCircle} title="Select a project" sub="Choose a project above to view and send messages." />
          : (
            <div className="flex flex-col rounded-2xl border border-[#DCE6F2] dark:border-surface-border bg-white dark:bg-navy-800 overflow-hidden" style={{ height: '520px' }}>

              {/* Project header */}
              <div className="px-4 py-3 border-b border-[#DCE6F2] dark:border-surface-border bg-[#F4F8FC] dark:bg-navy-700 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#0A1E3F] dark:text-white">{selProject.title}</p>
                  <p className="text-[11px] text-[#5B6E88] dark:text-text-muted">Project chat · Session resets every 24 hrs</p>
                </div>
                <SB status={selProject.status} />
              </div>

              {/* Messages area */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {messages.length === 0 && (
                  <div className="h-full flex items-center justify-center text-center">
                    <div className="space-y-2">
                      <MessageCircle className="w-8 h-8 text-[#C8D8EE] dark:text-text-muted mx-auto" />
                      <p className="text-xs text-[#5B6E88] dark:text-text-muted">No messages yet. Start the conversation!</p>
                    </div>
                  </div>
                )}

                {/* Group by session */}
                {Object.entries(sessions).map(([sid, msgs]) => (
                  <div key={sid} className="space-y-3">
                    {/* Session divider */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-px bg-[#DCE6F2] dark:bg-surface-border" />
                      <span className="text-[10px] text-[#5B6E88] dark:text-text-muted px-2 shrink-0 font-medium">
                        Session: {sid}
                      </span>
                      <div className="flex-1 h-px bg-[#DCE6F2] dark:bg-surface-border" />
                    </div>

                    {msgs.map(msg => {
                      const isMe = msg.senderId === uid;
                      return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[75%] space-y-1 ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                            <div className={`flex items-center gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                              <span className={`text-[10px] font-semibold ${isMe ? 'text-primary dark:text-primary-cyan' : 'text-[#5B6E88] dark:text-text-muted'}`}>
                                {isMe ? 'You' : msg.senderName}
                              </span>
                              <span className="text-[9px] text-[#5B6E88] dark:text-text-muted">
                                {msg.timestamp?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '—'}
                              </span>
                            </div>
                            <div className={`px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                              isMe
                                ? 'bg-primary text-white rounded-tr-sm'
                                : 'bg-[#F4F8FC] dark:bg-navy-700 text-[#0A1E3F] dark:text-white rounded-tl-sm border border-[#DCE6F2] dark:border-surface-border'
                            }`}>
                              {msg.text}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
                <div ref={msgEndRef} />
              </div>

              {/* Message input */}
              <form onSubmit={handleSendMsg} className="px-4 py-3 border-t border-[#DCE6F2] dark:border-surface-border bg-[#F4F8FC] dark:bg-navy-700 flex gap-2">
                <input
                  type="text"
                  value={msgText}
                  onChange={e => setMsgText(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 px-3.5 py-2 rounded-xl bg-white dark:bg-navy-800 border border-[#C8D8EE] dark:border-surface-border text-[#0A1E3F] dark:text-white text-xs focus:outline-none focus:border-primary dark:focus:border-primary-electric transition-colors"
                />
                <button type="submit" disabled={!msgText.trim() || msgSending}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary-hover disabled:opacity-50 transition-all flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Send</span>
                </button>
              </form>
            </div>
          )
        }
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────
  // TAB: INVOICES
  // ─────────────────────────────────────────────────────────────
  const InvoicesTab = () => (
    <div className="space-y-5">
      <h2 className="text-lg font-bold text-[#0A1E3F] dark:text-white">Invoices & Payments</h2>
      {!client.invoices?.length
        ? <Empty icon={FileText} title="No invoices yet" sub="Your invoices will appear here once your project milestones are billed." />
        : (
          <Card className="overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-5 py-3 bg-[#F4F8FC] dark:bg-navy-700 border-b border-[#DCE6F2] dark:border-surface-border text-[10px] font-bold uppercase tracking-wider text-[#5B6E88] dark:text-text-muted">
              <span className="col-span-2">Invoice</span>
              <span className="col-span-2">Date</span>
              <span className="col-span-4">Description</span>
              <span className="col-span-2">Amount</span>
              <span className="col-span-2">Status</span>
            </div>
            {client.invoices.map((inv, i) => (
              <div key={inv.id} className={`grid grid-cols-12 gap-2 px-5 py-4 text-xs items-center ${i < client.invoices.length - 1 ? 'border-b border-[#DCE6F2] dark:border-surface-border' : ''}`}>
                <span className="col-span-2 font-mono font-bold text-primary dark:text-primary-cyan text-[10px]">{inv.id}</span>
                <span className="col-span-2 text-[#5B6E88] dark:text-text-muted text-[11px]">{inv.date}</span>
                <span className="col-span-4 text-[#29405E] dark:text-text-light">{inv.description}</span>
                <span className="col-span-2 font-bold text-[#0A1E3F] dark:text-white">{inv.amount}</span>
                <span className="col-span-2"><SB status={inv.status} /></span>
              </div>
            ))}
          </Card>
        )
      }
      <div className="p-4 rounded-2xl bg-[#F0F6FF] dark:bg-navy-800 border border-[#C8D8EE] dark:border-surface-border text-xs text-[#5B6E88] dark:text-text-muted flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary dark:text-primary-cyan shrink-0" />
        For receipts or payment queries: <strong className="text-primary dark:text-primary-cyan ml-1">accounts@smartpvtltd.com</strong>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────
  // TAB: SUPPORT
  // ─────────────────────────────────────────────────────────────
  const SupportTab = () => (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold text-[#0A1E3F] dark:text-white">Support Tickets</h2>
        <a href={`https://wa.me/${company.contact.whatsapp.replace(/\D/g,'')}?text=${encodeURIComponent(`Hi SMART Support, I need help. UID: ${uid?.slice(0,8)}`)}`}
          target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all">
          <MessageSquare className="w-3.5 h-3.5" /> New Ticket via WhatsApp
        </a>
      </div>
      {!client.tickets?.length
        ? <Empty icon={HeadphonesIcon} title="No support tickets" sub="Raise a ticket via WhatsApp for fastest response." />
        : client.tickets.map(t => (
          <Card key={t.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono font-bold text-primary dark:text-primary-cyan">{t.id}</span>
                <SB status={t.status} /><SB status={t.priority} />
              </div>
              <p className="text-xs font-semibold text-[#0A1E3F] dark:text-white">{t.subject}</p>
              <p className="text-[11px] text-[#5B6E88] dark:text-text-muted flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {t.date}
              </p>
            </div>
            {t.status === 'Open' && (
              <a href={`https://wa.me/${company.contact.whatsapp.replace(/\D/g,'')}?text=${encodeURIComponent(`Hi SMART, UID: ${uid?.slice(0,8)} — following up on ticket ${t.id}: ${t.subject}`)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline shrink-0">
                <ExternalLink className="w-3.5 h-3.5" /> Follow up
              </a>
            )}
          </Card>
        ))
      }
      <Card className="p-4 text-xs text-[#5B6E88] dark:text-text-muted flex items-center gap-2">
        <HeadphonesIcon className="w-4 h-4 text-primary dark:text-primary-cyan shrink-0" />
        Response: <strong className="text-[#0A1E3F] dark:text-white mx-1">2–4 hrs</strong> · Priority SLA: <strong className="text-[#0A1E3F] dark:text-white ml-1">same day</strong>
      </Card>
    </div>
  );

  // ─────────────────────────────────────────────────────────────
  // TAB ROUTER
  // ─────────────────────────────────────────────────────────────
  const TAB_CONTENT = {
    overview:     <OverviewTab />,
    requirements: <RequirementsTab />,
    projects:     <ProjectsTab />,
    quotation:    <QuotationTab />,
    messages:     <MessagesTab />,
    invoices:     <InvoicesTab />,
    support:      <SupportTab />,
  };

  // ─────────────────────────────────────────────────────────────
  // LAYOUT
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F4F8FC] dark:bg-navy-950 pt-20">
      <SEO title="Client Dashboard" description="Your SMART Pvt Ltd client portal." noIndex />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6 items-start">

          {/* Desktop sidebar */}
          <aside className="hidden lg:flex flex-col w-56 shrink-0 rounded-2xl border border-[#DCE6F2] dark:border-surface-border bg-white dark:bg-navy-900 overflow-hidden sticky top-24 h-[calc(100vh-7rem)]">
            <Sidebar />
          </aside>

          {/* Mobile nav */}
          <div className="lg:hidden w-full mb-2">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setTab(id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                    tab === id ? 'bg-primary text-white' : 'bg-white dark:bg-navy-800 text-[#3E526C] dark:text-text-muted border border-[#DCE6F2] dark:border-surface-border'
                  }`}>
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
              <button onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap bg-white dark:bg-navy-800 text-red-600 dark:text-red-400 border border-[#DCE6F2] dark:border-surface-border shrink-0">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Main content */}
          <main className="flex-1 min-w-0">
            {TAB_CONTENT[tab]}
          </main>

        </div>
      </div>
    </div>
  );
}
