import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SEO from '../components/SEO';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, FolderKanban, FileText, 
  HeadphonesIcon, LogOut, Bell, CheckCircle2,
  Clock, AlertCircle, ChevronRight, Download,
  MessageSquare, Sparkles, User, Building,
  TrendingUp, Calendar, Shield, ExternalLink
} from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────
const StatusBadge = ({ status, size = 'sm' }) => {
  const map = {
    'In Progress': 'bg-blue-100  text-blue-700  border-blue-200  dark:bg-blue-500/15  dark:text-blue-300  dark:border-blue-500/30',
    'Completed':   'bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30',
    'Paid':        'bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30',
    'Pending':     'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
    'Open':        'bg-blue-100  text-blue-700  border-blue-200  dark:bg-blue-500/15  dark:text-blue-300  dark:border-blue-500/30',
    'Resolved':    'bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30',
    'High':        'bg-red-100   text-red-700   border-red-200   dark:bg-red-500/15   dark:text-red-300   dark:border-red-500/30',
    'Medium':      'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
    'Low':         'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30',
  };
  const base = size === 'sm' ? 'text-[12px] px-2 py-0.5' : 'text-xs px-2.5 py-1';
  return (
    <span className={`${base} font-bold rounded-full border ${map[status] || map['Low']}`}>
      {status}
    </span>
  );
};

// ── Sidebar nav items ─────────────────────────────────────────────
const NAV = [
  { id: 'overview',  label: 'Overview',         icon: LayoutDashboard },
  { id: 'projects',  label: 'My Projects',       icon: FolderKanban },
  { id: 'invoices',  label: 'Invoices',          icon: FileText },
  { id: 'support',   label: 'Support Tickets',   icon: HeadphonesIcon },
];

export default function ClientDashboardPage() {
  const navigate  = useNavigate();
  const { clientProfile, logout } = useAuth();
  const [tab, setTab]         = useState('overview');
  const [sideOpen, setSideOpen] = useState(false);
  // Normalize once here so every tab below can safely assume arrays exist,
  // even if the admin hasn't populated a client's Firestore doc fully yet.
  const client = clientProfile && {
    projects: [],
    invoices: [],
    tickets: [],
    ...clientProfile,
  };

  const handleLogout = async () => {
    await logout();
    navigate('/client-login');
  };

  // ProtectedRoute already guarantees an authenticated client before this
  // page renders; guard here only covers the instant before Firestore
  // profile data lands.
  if (!client) return null;

  // ── Sidebar ────────────────────────────────────────────────────
  const Sidebar = () => (
    <aside className="flex flex-col justify-between h-full">
      {/* Logo + greeting */}
      <div>
        <div className="px-5 py-5 border-b border-[#DCE6F2] dark:border-surface-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-cyan border border-primary/20 flex items-center justify-center shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#0A1E3F] dark:text-white truncate">{client.name}</p>
              <p className="text-[12px] text-[#5B6E88] dark:text-text-muted truncate">{client.company}</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="px-3 py-4 space-y-1">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setTab(id); setSideOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                tab === id
                  ? 'bg-primary text-white shadow-glow-sm'
                  : 'text-[#3E526C] dark:text-text-muted hover:bg-[#F0F6FF] dark:hover:bg-navy-800 hover:text-[#0A1E3F] dark:hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-[#DCE6F2] dark:border-surface-border">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign Out
        </button>
      </div>
    </aside>
  );

  // ── OVERVIEW TAB ───────────────────────────────────────────────
  const OverviewTab = () => {
    const activeProjects    = client.projects.filter(p => p.status === 'In Progress');
    const completedProjects = client.projects.filter(p => p.status === 'Completed');
    const pendingInvoices   = client.invoices.filter(i => i.status === 'Pending');
    const openTickets       = client.tickets.filter(t => t.status === 'Open');

    return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="rounded-2xl p-5 bg-gradient-to-r from-primary to-primary-electric text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider opacity-80">Welcome back</p>
          <h2 className="text-xl font-extrabold mt-0.5">{client.name}</h2>
          <p className="text-xs opacity-75 mt-1">{client.company} · Client since {client.clientSince}</p>
        </div>
        <div className="flex items-center gap-2 text-xs bg-white/15 px-3 py-2 rounded-xl">
          <Shield className="w-3.5 h-3.5" />
          ID: {client.id}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Active Projects',    value: activeProjects.length,    icon: FolderKanban,   color: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-50  dark:bg-blue-500/10'  },
          { label: 'Pending Invoices',   value: pendingInvoices.length,   icon: FileText,       color: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-50 dark:bg-amber-500/10' },
          { label: 'Open Tickets',       value: openTickets.length,       icon: HeadphonesIcon, color: 'text-primary dark:text-primary-cyan', bg: 'bg-primary/5 dark:bg-primary/10'  },
          { label: 'Completed Projects', value: completedProjects.length, icon: CheckCircle2,   color: 'text-green-600 dark:text-green-400',  bg: 'bg-green-50 dark:bg-green-500/10' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="rounded-2xl p-4 border border-[#DCE6F2] dark:border-surface-border bg-white dark:bg-navy-800">
            <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center mb-3`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className="text-2xl font-extrabold text-[#0A1E3F] dark:text-white">{value}</p>
            <p className="text-[13px] text-[#5B6E88] dark:text-text-muted mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Getting started — shown when no data yet */}
      {client.projects.length === 0 && client.invoices.length === 0 && client.tickets.length === 0 && (
        <div className="rounded-2xl p-8 border border-dashed border-[#C8D8EE] dark:border-surface-border bg-[#F9FBFF] dark:bg-navy-800/50 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6 text-primary dark:text-primary-cyan" />
          </div>
          <h3 className="text-sm font-bold text-[#0A1E3F] dark:text-white">Your portal is ready!</h3>
          <p className="text-xs text-[#5B6E88] dark:text-text-muted max-w-sm mx-auto leading-relaxed">
            Your projects, invoices and support tickets will appear here once your account manager sets everything up.
          </p>
          <a
            href={`https://wa.me/94770000000?text=${encodeURIComponent(`Hi SMART, I just logged in to my portal. Client ID: ${client.id}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all"
          >
            <MessageSquare className="w-3.5 h-3.5" /> Contact your account manager
          </a>
        </div>
      )}

      {/* Active project progress */}
      {activeProjects.length > 0 && (
      <div className="rounded-2xl p-5 border border-[#DCE6F2] dark:border-surface-border bg-white dark:bg-navy-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#0A1E3F] dark:text-white">Active Project Progress</h3>
          <button onClick={() => setTab('projects')} className="text-xs text-primary dark:text-primary-cyan font-semibold hover:underline flex items-center gap-1">
            View all <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        {activeProjects.map(proj => (
          <div key={proj.id} className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#0A1E3F] dark:text-white">{proj.name}</span>
              <span className="font-bold text-primary dark:text-primary-cyan">{proj.completion}%</span>
            </div>
            <div className="w-full h-2 bg-[#EBF3FC] dark:bg-navy-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary-electric rounded-full transition-all duration-500"
                style={{ width: `${proj.completion}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {proj.milestones.map((m, i) => (
                <span key={i} className={`flex items-center gap-1 text-[12px] font-medium px-2 py-0.5 rounded-md border ${
                  m.done
                    ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/20'
                    : 'bg-[#F4F8FC] dark:bg-navy-700 text-[#5B6E88] dark:text-text-muted border-[#DCE6F2] dark:border-surface-border'
                }`}>
                  {m.done ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                  {m.title}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      )}

      {/* Recent invoice + ticket row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Latest invoice */}
        {client.invoices.length > 0 && (
        <div className="rounded-2xl p-4 border border-[#DCE6F2] dark:border-surface-border bg-white dark:bg-navy-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#0A1E3F] dark:text-white">Latest Invoice</h3>
            <button onClick={() => setTab('invoices')} className="text-[12px] text-primary dark:text-primary-cyan hover:underline">View all</button>
          </div>
          {client.invoices.slice(0, 1).map(inv => (
            <div key={inv.id} className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-[#0A1E3F] dark:text-white">{inv.id}</p>
                <p className="text-[12px] text-[#5B6E88] dark:text-text-muted">{inv.description}</p>
                <p className="text-xs font-bold text-[#0A1E3F] dark:text-white mt-1">{inv.amount}</p>
              </div>
              <StatusBadge status={inv.status} />
            </div>
          ))}
        </div>
        )}

        {/* Latest ticket */}
        {client.tickets.length > 0 && (
        <div className="rounded-2xl p-4 border border-[#DCE6F2] dark:border-surface-border bg-white dark:bg-navy-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#0A1E3F] dark:text-white">Latest Support Ticket</h3>
            <button onClick={() => setTab('support')} className="text-[12px] text-primary dark:text-primary-cyan hover:underline">View all</button>
          </div>
          {client.tickets.slice(0, 1).map(t => (
            <div key={t.id}>
              <p className="text-xs font-semibold text-[#0A1E3F] dark:text-white">{t.id}</p>
              <p className="text-[12px] text-[#5B6E88] dark:text-text-muted mt-0.5 line-clamp-2">{t.subject}</p>
              <div className="flex gap-2 mt-2">
                <StatusBadge status={t.status} />
                <StatusBadge status={t.priority} />
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
    );
  };

  // ── PROJECTS TAB ───────────────────────────────────────────────
  const ProjectsTab = () => (
    <div className="space-y-5">
      <h2 className="text-lg font-bold text-[#0A1E3F] dark:text-white">My Projects</h2>
      {client.projects.length === 0 && (
        <div className="rounded-2xl p-8 border border-[#DCE6F2] dark:border-surface-border bg-white dark:bg-navy-800 text-center text-sm text-[#5B6E88] dark:text-text-muted">
          No projects yet. Contact your account manager for updates.
        </div>
      )}
      {client.projects.map(proj => (
        <div key={proj.id} className="rounded-2xl p-5 border border-[#DCE6F2] dark:border-surface-border bg-white dark:bg-navy-800 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[12px] text-[#5B6E88] dark:text-text-muted font-mono">{proj.id}</p>
              <h3 className="text-sm font-bold text-[#0A1E3F] dark:text-white mt-0.5">{proj.name}</h3>
              <div className="flex gap-3 text-[13px] text-[#5B6E88] dark:text-text-muted mt-1">
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Started: {proj.startDate}</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Due: {proj.expectedDelivery}</span>
              </div>
            </div>
            <StatusBadge status={proj.status} size="md" />
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[13px]">
              <span className="text-[#5B6E88] dark:text-text-muted">Overall Completion</span>
              <span className="font-bold text-primary dark:text-primary-cyan">{proj.completion}%</span>
            </div>
            <div className="w-full h-2.5 bg-[#EBF3FC] dark:bg-navy-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary-electric rounded-full"
                style={{ width: `${proj.completion}%` }}
              />
            </div>
          </div>

          {/* Milestones */}
          <div className="space-y-2">
            <p className="text-[12px] font-bold uppercase tracking-wider text-[#5B6E88] dark:text-text-muted">Milestones</p>
            {proj.milestones.map((m, i) => (
              <div key={i} className="flex items-center gap-2.5 text-xs">
                {m.done
                  ? <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                  : <Clock className="w-4 h-4 text-[#5B6E88] dark:text-text-muted shrink-0" />}
                <span className={m.done ? 'text-[#0A1E3F] dark:text-white line-through opacity-60' : 'text-[#0A1E3F] dark:text-white'}>
                  {m.title}
                </span>
                {m.done && <span className="text-[12px] text-green-600 dark:text-green-400 font-semibold">Done</span>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  // ── INVOICES TAB ───────────────────────────────────────────────
  const InvoicesTab = () => (
    <div className="space-y-5">
      <h2 className="text-lg font-bold text-[#0A1E3F] dark:text-white">Invoices & Payments</h2>
      {client.invoices.length === 0 ? (
        <div className="rounded-2xl p-8 border border-[#DCE6F2] dark:border-surface-border bg-white dark:bg-navy-800 text-center text-sm text-[#5B6E88] dark:text-text-muted">
          No invoices yet.
        </div>
      ) : (
      <div className="rounded-2xl border border-[#DCE6F2] dark:border-surface-border bg-white dark:bg-navy-800 overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-12 gap-2 px-5 py-3 bg-[#F4F8FC] dark:bg-navy-700 border-b border-[#DCE6F2] dark:border-surface-border text-[12px] font-bold uppercase tracking-wider text-[#5B6E88] dark:text-text-muted">
          <span className="col-span-2">Invoice</span>
          <span className="col-span-2">Date</span>
          <span className="col-span-4">Description</span>
          <span className="col-span-2">Amount</span>
          <span className="col-span-2">Status</span>
        </div>
        {client.invoices.map((inv, i) => (
          <div
            key={inv.id}
            className={`grid grid-cols-12 gap-2 px-5 py-4 text-xs items-center ${
              i < client.invoices.length - 1 ? 'border-b border-[#DCE6F2] dark:border-surface-border' : ''
            }`}
          >
            <span className="col-span-2 font-mono font-bold text-primary dark:text-primary-cyan text-[12px]">{inv.id}</span>
            <span className="col-span-2 text-[#5B6E88] dark:text-text-muted text-[13px]">{inv.date}</span>
            <span className="col-span-4 text-[#29405E] dark:text-text-light">{inv.description}</span>
            <span className="col-span-2 font-bold text-[#0A1E3F] dark:text-white text-[13px]">{inv.amount}</span>
            <span className="col-span-2"><StatusBadge status={inv.status} /></span>
          </div>
        ))}
      </div>
      )}

      <div className="p-4 rounded-2xl bg-[#F0F6FF] dark:bg-navy-800 border border-[#C8D8EE] dark:border-surface-border text-xs text-[#5B6E88] dark:text-text-muted flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary dark:text-primary-cyan shrink-0" />
        For official receipts or payment queries, contact your account manager or email <strong className="text-primary dark:text-primary-cyan ml-1">accounts@smartpvtltd.com</strong>
      </div>
    </div>
  );

  // ── SUPPORT TAB ────────────────────────────────────────────────
  const SupportTab = () => (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold text-[#0A1E3F] dark:text-white">Support Tickets</h2>
        <a
          href={`https://wa.me/94770000000?text=${encodeURIComponent(`Hi SMART Support, I need help. Client ID: ${client.id}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all"
        >
          <MessageSquare className="w-3.5 h-3.5" /> New Ticket via WhatsApp
        </a>
      </div>

      {client.tickets.length === 0 && (
        <div className="rounded-2xl p-8 border border-[#DCE6F2] dark:border-surface-border bg-white dark:bg-navy-800 text-center text-sm text-[#5B6E88] dark:text-text-muted">
          No support tickets yet.
        </div>
      )}

      <div className="space-y-3">
        {client.tickets.map(t => (
          <div key={t.id} className="rounded-2xl p-4 border border-[#DCE6F2] dark:border-surface-border bg-white dark:bg-navy-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[12px] font-mono font-bold text-primary dark:text-primary-cyan">{t.id}</span>
                <StatusBadge status={t.status} />
                <StatusBadge status={t.priority} />
              </div>
              <p className="text-xs font-semibold text-[#0A1E3F] dark:text-white">{t.subject}</p>
              <p className="text-[12px] text-[#5B6E88] dark:text-text-muted flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {t.date}
              </p>
            </div>
            <div className="shrink-0">
              {t.status === 'Open' ? (
                <a
                  href={`https://wa.me/94770000000?text=${encodeURIComponent(`Hi SMART Support, Client ID: ${client.id} — following up on ticket ${t.id}: ${t.subject}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[13px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Follow up
                </a>
              ) : (
                <span className="text-[13px] text-[#5B6E88] dark:text-text-muted">Closed</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 rounded-2xl bg-[#F0F6FF] dark:bg-navy-800 border border-[#C8D8EE] dark:border-surface-border text-xs text-[#5B6E88] dark:text-text-muted flex items-center gap-2">
        <HeadphonesIcon className="w-4 h-4 text-primary dark:text-primary-cyan shrink-0" />
        Average response time: <strong className="text-[#0A1E3F] dark:text-white mx-1">2–4 business hours</strong> · Priority SLA: <strong className="text-[#0A1E3F] dark:text-white ml-1">same day</strong>
      </div>
    </div>
  );

  const TAB_CONTENT = { overview: <OverviewTab />, projects: <ProjectsTab />, invoices: <InvoicesTab />, support: <SupportTab /> };

  // ── Layout ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F4F8FC] dark:bg-navy-950 pt-20">
      <SEO title="Client Dashboard" description="Your SMART Pvt Ltd client portal — projects, invoices, and support." noIndex />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6 items-start">

          {/* ── Desktop Sidebar ──────────────────────────────── */}
          <aside className="hidden lg:flex flex-col w-56 shrink-0 rounded-2xl border border-[#DCE6F2] dark:border-surface-border bg-white dark:bg-navy-900 overflow-hidden sticky top-24 h-[calc(100vh-7rem)]">
            <Sidebar />
          </aside>

          {/* ── Mobile top nav ────────────────────────────────── */}
          <div className="lg:hidden w-full mb-2">
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {NAV.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                    tab === id
                      ? 'bg-primary text-white'
                      : 'bg-white dark:bg-navy-800 text-[#3E526C] dark:text-text-muted border border-[#DCE6F2] dark:border-surface-border'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap bg-white dark:bg-navy-800 text-red-600 dark:text-red-400 border border-[#DCE6F2] dark:border-surface-border shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </div>
          </div>

          {/* ── Main content ──────────────────────────────────── */}
          <main className="flex-1 min-w-0">
            {TAB_CONTENT[tab]}
          </main>

        </div>
      </div>
    </div>
  );
}
