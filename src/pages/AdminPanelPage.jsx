import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { toMillis } from '../erp/formatWhen';
import SEO from '../components/SEO';
import { staffList, getStaffByIds, STATUS_COLORS } from '../config/staff';
import {
  ShieldCheck, Users, FileText, LogOut,
  CheckCircle2, XCircle, FolderKanban,
  Copy, MessageSquare, Sparkles,
  Building, Phone, Mail, Calendar,
  Inbox, UserPlus, Briefcase, X,
  ChevronDown, Award, Star
} from 'lucide-react';

// ── Status badge helper ───────────────────────────────────────
const Badge = ({ status }) => {
  const map = {
    'New':      'bg-blue-100  text-blue-700  border-blue-200  dark:bg-blue-500/15  dark:text-blue-300  dark:border-blue-500/30',
    'Accepted': 'bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30',
    'Rejected': 'bg-red-100   text-red-700   border-red-200   dark:bg-red-500/15   dark:text-red-300   dark:border-red-500/30',
    'Pending':  'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
  };
  return (
    <span className={`text-[12px] font-bold px-2 py-0.5 rounded-full border ${map[status] || map['Pending']}`}>
      {status}
    </span>
  );
};

// ── Reusable Request Detail Panel ────────────────────────────
function RequestDetailPanel({ selected, copied, onCopy, onUpdateStatus, buildWhatsApp }) {
  return (
    <div className="rounded-2xl border border-[#DCE6F2] dark:border-surface-border bg-white dark:bg-navy-800 p-5 space-y-4 sticky top-24">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-mono text-[#5B6E88] dark:text-text-muted">{selected.leadId}</p>
          <h3 className="text-sm font-bold text-[#0A1E3F] dark:text-white mt-0.5">{selected.name}</h3>
        </div>
        <Badge status={selected.status || 'New'} />
      </div>

      {/* Details */}
      <div className="space-y-2 text-xs">
        {[
          { icon: Building,  label: 'Company',     val: selected.company            },
          { icon: Phone,     label: 'Phone',        val: selected.phone || selected.whatsapp },
          { icon: Mail,      label: 'Email',        val: selected.email              },
          { icon: Sparkles,  label: 'Service',      val: selected.service            },
          { icon: FileText,  label: 'Budget',       val: selected.budget             },
          { icon: Calendar,  label: 'Contact Pref', val: selected.preferredContact   },
        ].filter(r => r.val).map(({ icon: Icon, label, val }) => (
          <div key={label} className="flex items-start gap-2">
            <Icon className="w-3.5 h-3.5 text-primary dark:text-primary-cyan shrink-0 mt-0.5" />
            <span className="text-[#5B6E88] dark:text-text-muted w-20 shrink-0">{label}:</span>
            <span className="font-semibold text-[#0A1E3F] dark:text-white break-all">{val}</span>
          </div>
        ))}
        {(selected.message || selected.description) && (
          <div className="mt-2 p-3 rounded-xl bg-[#F4F8FC] dark:bg-navy-700 text-[#29405E] dark:text-text-light text-[11px] leading-relaxed">
            <p className="font-bold text-[#0A1E3F] dark:text-white mb-1 text-[10px] uppercase tracking-wider">Description</p>
            {selected.message || selected.description}
          </div>
        )}
      </div>

      {/* Source badge */}
      {selected.source && (
        <div className="flex items-center gap-2 text-[10px] text-[#5B6E88] dark:text-text-muted">
          <span className="px-2 py-0.5 rounded-full bg-[#F0F6FF] dark:bg-navy-700 border border-[#C8D8EE] dark:border-surface-border">
            📍 Source: {selected.source}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="pt-3 border-t border-[#DCE6F2] dark:border-surface-border space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#5B6E88] dark:text-text-muted">Actions</p>

        <button onClick={() => onUpdateStatus(selected.leadId, 'Accepted')}
          disabled={selected.status === 'Accepted'}
          className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
          <CheckCircle2 className="w-4 h-4" /> Accept Request
        </button>

        <button onClick={() => onUpdateStatus(selected.leadId, 'Rejected')}
          disabled={selected.status === 'Rejected'}
          className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 border border-red-200 dark:border-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
          <XCircle className="w-4 h-4" /> Reject Request
        </button>

        {/* Send credentials — only after Accept */}
        {selected.status === 'Accepted' && (
          <div className="p-4 rounded-xl bg-[#F0F6FF] dark:bg-navy-700 border border-[#C8D8EE] dark:border-surface-border space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary dark:text-primary-cyan">
              Send Login Credentials via WhatsApp
            </p>
            <p className="text-[11px] text-[#5B6E88] dark:text-text-muted leading-relaxed">
              Create client in Firebase Console first, then send their credentials:
            </p>

            {/* Email copy */}
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[11px] bg-white dark:bg-navy-800 border border-[#DCE6F2] dark:border-surface-border px-2 py-1.5 rounded-lg text-[#0A1E3F] dark:text-white truncate">
                {selected.email || 'No email provided'}
              </code>
              <button onClick={() => onCopy(selected.email || '', 'email')}
                className="px-2 py-1.5 rounded-lg bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-cyan font-bold hover:bg-primary/20 transition-all">
                {copied === 'email' ? '✓' : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* WhatsApp button */}
            {(selected.whatsapp || selected.phone) && (
              <a
                href={buildWhatsApp(selected, selected.email || '', '(set in Firebase Console)')}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all"
              >
                <MessageSquare className="w-4 h-4" />
                Send Login Details on WhatsApp
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Admin Panel ──────────────────────────────────────────
// Authentication/authorization is already enforced by <ProtectedRoute
// role="admin"> in App.jsx before this component ever renders.
export default function AdminPanelPage() {
  const navigate                   = useNavigate();
  const { logout, isDevSession }   = useAuth();
  const [tab, setTab]              = useState('client_requests');
  const [allLeads, setAllLeads]    = useState([]);
  const [clients,  setClients]     = useState([]);
  const [projects, setProjects]    = useState([]);
  const [selected, setSelected]    = useState(null);
  const [copied,   setCopied]      = useState('');
  const [leadsError, setLeadsError] = useState('');

  // Assign modal state
  const [assignProject, setAssignProject] = useState(null); // project being assigned
  const [assignLoading, setAssignLoading] = useState(false);

  // Derived — split leads by type
  const clientRequests = allLeads.filter(r => r.type === 'client_request');
  const quoteLeads     = allLeads.filter(r => r.type !== 'client_request');

  // Live leads from Firestore (all types).
  // NOTE: no orderBy('createdAt') in the query — Firestore silently drops
  // documents missing that field, which made leads "load then disappear".
  // Sort client-side instead so every lead stays visible.
  useEffect(() => {
    if (isDevSession || !isFirebaseConfigured) { setAllLeads([]); return; }
    const unsubscribe = onSnapshot(collection(db, 'leads'), (snap) => {
      const rows = snap.docs.map(d => ({ leadId: d.id, ...d.data() }));
      rows.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      setAllLeads(rows);
      setLeadsError('');
    }, (err) => {
      console.error('Leads listener error', err);
      setLeadsError(err.message || "Couldn't load leads.");
    });
    return unsubscribe;
  }, [isDevSession]);

  // Live client list from Firestore
  useEffect(() => {
    if (isDevSession) { setClients([]); return; }
    const unsubscribe = onSnapshot(collection(db, 'clients'), (snap) => {
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error('Clients listener error', err));
    return unsubscribe;
  }, [isDevSession]);

  // Live projects from Firestore
  useEffect(() => {
    if (!isFirebaseConfigured || isDevSession) {
      setProjects([
        { id: 'dev-proj-001', clientId: 'dev-client-001', clientName: 'Test Client', clientCompany: 'Test Company Pvt Ltd', title: 'Corporate Website Redesign', serviceType: 'Corporate Business Website', status: 'In Progress', completion: 65, assignedStaff: ['STAFF-001', 'STAFF-002'] },
        { id: 'dev-proj-002', clientId: 'dev-client-001', clientName: 'Test Client', clientCompany: 'Test Company Pvt Ltd', title: 'Mobile App Development', serviceType: 'Mobile App (Android & iOS)', status: 'quotation_sent', completion: 0, assignedStaff: [] },
      ]);
      return;
    }
    // No orderBy — same disappearing-documents pitfall as the leads query.
    return onSnapshot(collection(db, 'projects'), snap => {
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      rows.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      setProjects(rows);
    }, (err) => console.error('Projects listener error', err));
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  // ── Toggle staff assignment on a project ─────────────────────
  const handleToggleStaff = async (projectId, staffId, currentAssigned) => {
    const isAssigned = currentAssigned.includes(staffId);
    const updated    = isAssigned
      ? currentAssigned.filter(id => id !== staffId)
      : [...currentAssigned, staffId];

    // Update local state immediately (optimistic)
    setProjects(prev =>
      prev.map(p => p.id === projectId ? { ...p, assignedStaff: updated } : p)
    );
    if (assignProject?.id === projectId) {
      setAssignProject(prev => ({ ...prev, assignedStaff: updated }));
    }

    // Persist to Firestore if configured
    if (isFirebaseConfigured && !isDevSession) {
      try {
        await updateDoc(doc(db, 'projects', projectId), { assignedStaff: updated });
      } catch (err) { console.error('Staff assign error', err); }
    }
  };

  const copyText = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  // Update request status in Firestore
  const updateStatus = async (leadId, status) => {
    try {
      await updateDoc(doc(db, 'leads', leadId), { status });
      if (selected?.leadId === leadId) setSelected({ ...selected, status });
    } catch (err) {
      console.error('Failed to update lead status', err);
    }
  };

  // Build WhatsApp message for client
  const buildWhatsApp = (req, email, password) => {
    const text = `Hi ${req.name || 'there'}, 

Your SMART Pvt Ltd Client Portal is ready! 🎉

Login here: ${window.location.origin}/client-login

📧 Email: ${email}
🔑 Password: ${password}

You can track your project progress, invoices and support tickets from your dashboard.

— SMART Pvt Ltd Team`;
    return `https://wa.me/${(req.whatsapp || '').replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
  };

  const NAV = [
    { id: 'client_requests', label: 'Client Requests', icon: UserPlus,      count: clientRequests.filter(r => r.status === 'New').length },
    { id: 'quote_leads',     label: 'Quote Leads',     icon: Inbox,         count: quoteLeads.filter(r => r.status === 'New').length     },
    { id: 'projects',        label: 'Projects',         icon: FolderKanban, count: projects.filter(p => p.status === 'requirements_pending').length },
    { id: 'staff',           label: 'Staff',            icon: Users,        count: staffList.length                                      },
    { id: 'clients',         label: 'Active Clients',   icon: Briefcase,    count: clients.length                                        },
  ];

  return (
    <div className="min-h-screen bg-[#F4F8FC] dark:bg-navy-950 pt-20">
      <SEO title="Admin Panel" description="SMART Pvt Ltd internal admin panel." noIndex />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6 items-start">

          {/* ── Sidebar ─────────────────────────────────────── */}
          <aside className="hidden lg:flex flex-col w-56 shrink-0 rounded-2xl border border-[#DCE6F2] dark:border-surface-border bg-white dark:bg-navy-900 overflow-hidden sticky top-24">
            <div className="px-5 py-5 border-b border-[#DCE6F2] dark:border-surface-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-cyan flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#0A1E3F] dark:text-white">Admin</p>
                  <p className="text-[12px] text-[#5B6E88] dark:text-text-muted">SMART Pvt Ltd</p>
                </div>
              </div>
            </div>
            <nav className="px-3 py-4 space-y-1 flex-1">
              {NAV.map(({ id, label, icon: Icon, count }) => (
                <button key={id} onClick={() => setTab(id)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    tab === id
                      ? 'bg-primary text-white'
                      : 'text-[#3E526C] dark:text-text-muted hover:bg-[#F0F6FF] dark:hover:bg-navy-800'
                  }`}>
                  <span className="flex items-center gap-2"><Icon className="w-4 h-4" />{label}</span>
                  {count > 0 && (
                    <span className={`text-[12px] font-bold px-1.5 py-0.5 rounded-full ${tab === id ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary dark:text-primary-cyan'}`}>
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
            <div className="px-3 py-4 border-t border-[#DCE6F2] dark:border-surface-border">
              <button onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all">
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          </aside>

          {/* ── Mobile nav ──────────────────────────────────── */}
          <div className="lg:hidden w-full mb-4">
            <div className="flex gap-2">
              {NAV.map(({ id, label, icon: Icon, count }) => (
                <button key={id} onClick={() => setTab(id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    tab === id ? 'bg-primary text-white' : 'bg-white dark:bg-navy-800 text-[#3E526C] dark:text-text-muted border border-[#DCE6F2] dark:border-surface-border'
                  }`}>
                  <Icon className="w-3.5 h-3.5" />{label}
                  {count > 0 && <span className="ml-0.5 font-bold">({count})</span>}
                </button>
              ))}
              <button onClick={handleLogout}
                className="ml-auto flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 bg-white dark:bg-navy-800 border border-[#DCE6F2] dark:border-surface-border">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* ── Main content ────────────────────────────────── */}
          <main className="flex-1 min-w-0 space-y-5">

            {leadsError && (
              <div className="rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-xs text-red-600 dark:text-red-300">
                {leadsError}
              </div>
            )}

            {/* ══ CLIENT REQUESTS TAB ═══════════════════════════ */}
            {tab === 'client_requests' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-[#0A1E3F] dark:text-white">Client Requests</h2>
                    <p className="text-xs text-[#5B6E88] dark:text-text-muted mt-0.5">Submitted via "Get Started" form</p>
                  </div>
                  <span className="text-xs text-[#5B6E88] dark:text-text-muted">{clientRequests.length} total</span>
                </div>

                {clientRequests.length === 0 && (
                  <div className="rounded-2xl p-10 border border-dashed border-[#C8D8EE] dark:border-surface-border bg-white dark:bg-navy-800 text-center">
                    <UserPlus className="w-8 h-8 text-[#5B6E88] dark:text-text-muted mx-auto mb-3" />
                    <p className="text-sm text-[#5B6E88] dark:text-text-muted">No client requests yet.</p>
                    <p className="text-xs text-[#5B6E88] dark:text-text-muted mt-1">
                      Requests submitted via the "Get Started" form will appear here.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Request list */}
                  <div className="space-y-3">
                    {clientRequests.map(req => (
                      <button key={req.leadId} onClick={() => setSelected(req)}
                        className={`w-full text-left rounded-2xl p-4 border transition-all ${
                          selected?.leadId === req.leadId
                            ? 'border-primary dark:border-primary-cyan bg-primary/5 dark:bg-primary/10'
                            : 'border-[#DCE6F2] dark:border-surface-border bg-white dark:bg-navy-800 hover:border-primary/40 dark:hover:border-primary-cyan/40'
                        }`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#0A1E3F] dark:text-white truncate">{req.name || 'Unknown'}</p>
                            <p className="text-[11px] text-[#5B6E88] dark:text-text-muted mt-0.5 truncate">{req.company || '—'}</p>
                            <p className="text-[11px] text-[#5B6E88] dark:text-text-muted truncate">{req.service || '—'}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <Badge status={req.status || 'New'} />
                            <span className="text-[10px] text-[#5B6E88] dark:text-text-muted font-mono">{req.leadId}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Detail panel */}
                  {selected && clientRequests.some(r => r.leadId === selected.leadId) ? (
                    <RequestDetailPanel
                      selected={selected}
                      copied={copied}
                      onCopy={copyText}
                      onUpdateStatus={updateStatus}
                      buildWhatsApp={buildWhatsApp}
                    />
                  ) : (
                    <div className="rounded-2xl border border-dashed border-[#C8D8EE] dark:border-surface-border bg-white dark:bg-navy-800 p-8 text-center text-xs text-[#5B6E88] dark:text-text-muted hidden lg:flex lg:items-center lg:justify-center">
                      Select a request to view details
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ══ QUOTE LEADS TAB ═══════════════════════════════ */}
            {tab === 'quote_leads' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-[#0A1E3F] dark:text-white">Quote Leads</h2>
                    <p className="text-xs text-[#5B6E88] dark:text-text-muted mt-0.5">All website form submissions — quote request, contact, newsletter</p>
                  </div>
                  <span className="text-xs text-[#5B6E88] dark:text-text-muted">{quoteLeads.length} total</span>
                </div>

                {quoteLeads.length === 0 && (
                  <div className="rounded-2xl p-10 border border-dashed border-[#C8D8EE] dark:border-surface-border bg-white dark:bg-navy-800 text-center">
                    <Inbox className="w-8 h-8 text-[#5B6E88] dark:text-text-muted mx-auto mb-3" />
                    <p className="text-sm text-[#5B6E88] dark:text-text-muted">No quote leads yet.</p>
                    <p className="text-xs text-[#5B6E88] dark:text-text-muted mt-1">Quote modal submissions will appear here.</p>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    {quoteLeads.map(req => (
                      <button key={req.leadId} onClick={() => setSelected(req)}
                        className={`w-full text-left rounded-2xl p-4 border transition-all ${
                          selected?.leadId === req.leadId
                            ? 'border-primary dark:border-primary-cyan bg-primary/5 dark:bg-primary/10'
                            : 'border-[#DCE6F2] dark:border-surface-border bg-white dark:bg-navy-800 hover:border-primary/40 dark:hover:border-primary-cyan/40'
                        }`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#0A1E3F] dark:text-white truncate">{req.name || 'Unknown'}</p>
                            <p className="text-[11px] text-[#5B6E88] dark:text-text-muted mt-0.5 truncate">{req.service || '—'}</p>
                            <p className="text-[11px] text-[#5B6E88] dark:text-text-muted truncate">{req.whatsapp || req.email || '—'}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <Badge status={req.status || 'New'} />
                            <span className="text-[10px] text-[#5B6E88] dark:text-text-muted font-mono">{req.leadId}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  {selected && quoteLeads.some(r => r.leadId === selected.leadId) ? (
                    <RequestDetailPanel
                      selected={selected}
                      copied={copied}
                      onCopy={copyText}
                      onUpdateStatus={updateStatus}
                      buildWhatsApp={buildWhatsApp}
                    />
                  ) : (
                    <div className="rounded-2xl border border-dashed border-[#C8D8EE] dark:border-surface-border bg-white dark:bg-navy-800 p-8 text-center text-xs text-[#5B6E88] dark:text-text-muted hidden lg:flex lg:items-center lg:justify-center">
                      Select a lead to view details
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ══ PROJECTS TAB ══════════════════════════════════ */}
            {tab === 'projects' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-[#0A1E3F] dark:text-white">Projects</h2>
                    <p className="text-xs text-[#5B6E88] dark:text-text-muted mt-0.5">All client projects — assign staff and track progress</p>
                  </div>
                  <span className="text-xs text-[#5B6E88] dark:text-text-muted">{projects.length} total</span>
                </div>

                {projects.length === 0 && (
                  <div className="rounded-2xl p-10 border border-dashed border-[#C8D8EE] dark:border-surface-border bg-white dark:bg-navy-800 text-center">
                    <FolderKanban className="w-8 h-8 text-[#5B6E88] dark:text-text-muted mx-auto mb-3" />
                    <p className="text-sm text-[#5B6E88] dark:text-text-muted">No projects yet.</p>
                  </div>
                )}

                <div className="space-y-3">
                  {projects.map(proj => {
                    const assigned = getStaffByIds(proj.assignedStaff || []);
                    const statusMap = {
                      'requirements_pending': 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
                      'quotation_sent':       'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30',
                      'quotation_accepted':   'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30',
                      'advance_paid':         'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
                      'In Progress':          'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30',
                      'Completed':            'bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30',
                    };
                    const statusLabel = {
                      'requirements_pending': 'Requirements Pending',
                      'quotation_sent':       'Quotation Sent',
                      'quotation_accepted':   'Quotation Accepted',
                      'advance_paid':         'Advance Paid',
                    }[proj.status] || proj.status;

                    return (
                      <div key={proj.id} className="rounded-2xl border border-[#DCE6F2] dark:border-surface-border bg-white dark:bg-navy-800 p-5 space-y-4">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <p className="text-[10px] font-mono text-[#5B6E88] dark:text-text-muted">{proj.clientName} · {proj.clientCompany}</p>
                            <h3 className="text-sm font-bold text-[#0A1E3F] dark:text-white mt-0.5">{proj.title}</h3>
                            <p className="text-xs text-[#5B6E88] dark:text-text-muted mt-0.5">{proj.serviceType}</p>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusMap[proj.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                            {statusLabel}
                          </span>
                        </div>

                        {/* Progress bar */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-[#5B6E88] dark:text-text-muted">Completion</span>
                            <span className="font-bold text-primary dark:text-primary-cyan">{proj.completion || 0}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-[#EBF3FC] dark:bg-navy-700 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-primary to-primary-electric rounded-full"
                              style={{ width: `${proj.completion || 0}%` }} />
                          </div>
                        </div>

                        {/* Assigned staff */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#5B6E88] dark:text-text-muted">
                              Assigned Staff ({assigned.length})
                            </p>
                            <button
                              onClick={() => setAssignProject(proj)}
                              className="flex items-center gap-1 text-[11px] font-bold text-primary dark:text-primary-cyan hover:underline">
                              <UserPlus className="w-3 h-3" /> Manage
                            </button>
                          </div>

                          {assigned.length === 0 ? (
                            <p className="text-[11px] text-[#5B6E88] dark:text-text-muted italic">No staff assigned yet.</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {assigned.map(s => (
                                <div key={s.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#F4F8FC] dark:bg-navy-700 border border-[#DCE6F2] dark:border-surface-border">
                                  <div className={`w-6 h-6 rounded-full ${s.avatarColor} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                                    {s.avatar}
                                  </div>
                                  <div>
                                    <p className="text-[11px] font-semibold text-[#0A1E3F] dark:text-white leading-none">{s.name}</p>
                                    <p className="text-[10px] text-[#5B6E88] dark:text-text-muted">{s.role}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ══ STAFF TAB ════════════════════════════════════ */}
            {tab === 'staff' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-[#0A1E3F] dark:text-white">Staff Members</h2>
                    <p className="text-xs text-[#5B6E88] dark:text-text-muted mt-0.5">All staff — add new members in <code className="bg-[#E0EEFF] dark:bg-navy-700 px-1 rounded">src/config/staff.js</code></p>
                  </div>
                  <span className="text-xs text-[#5B6E88] dark:text-text-muted">{staffList.length} members</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {staffList.map(s => (
                    <div key={s.id} className="rounded-2xl border border-[#DCE6F2] dark:border-surface-border bg-white dark:bg-navy-800 p-5 space-y-3">
                      {/* Header */}
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-2xl ${s.avatarColor} flex items-center justify-center text-white text-lg font-bold shrink-0`}>
                          {s.avatar}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-[#0A1E3F] dark:text-white">{s.name}</h3>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[s.status]}`}>
                              {s.status}
                            </span>
                          </div>
                          <p className="text-xs text-[#5B6E88] dark:text-text-muted">{s.role}</p>
                          <p className="text-[11px] text-[#5B6E88] dark:text-text-muted">{s.department}</p>
                        </div>
                      </div>

                      {/* Contact */}
                      <div className="space-y-1.5 text-[11px] text-[#5B6E88] dark:text-text-muted">
                        <div className="flex items-center gap-2">
                          <Mail className="w-3 h-3 text-primary dark:text-primary-cyan shrink-0" />
                          <span>{s.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>{s.phone}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3 text-[#5B6E88] dark:text-text-muted shrink-0" />
                          <span>Joined: {s.joinedDate}</span>
                        </div>
                      </div>

                      {/* Skills */}
                      <div className="flex flex-wrap gap-1.5">
                        {s.skills.map(skill => (
                          <span key={skill} className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-[#EBF3FC] dark:bg-navy-700 text-primary dark:text-primary-cyan border border-primary/20">
                            {skill}
                          </span>
                        ))}
                      </div>

                      {/* Projects assigned */}
                      <div className="pt-2 border-t border-[#DCE6F2] dark:border-surface-border">
                        <p className="text-[10px] text-[#5B6E88] dark:text-text-muted">
                          Assigned to <strong className="text-[#0A1E3F] dark:text-white">
                            {projects.filter(p => (p.assignedStaff || []).includes(s.id)).length}
                          </strong> project(s)
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {tab === 'clients' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-[#0A1E3F] dark:text-white">Active Clients</h2>
                  <span className="text-xs text-[#5B6E88] dark:text-text-muted">{clients.length} clients</span>
                </div>

                {clients.length === 0 && (
                  <div className="rounded-2xl p-10 border border-dashed border-[#C8D8EE] dark:border-surface-border bg-white dark:bg-navy-800 text-center">
                    <Users className="w-8 h-8 text-[#5B6E88] dark:text-text-muted mx-auto mb-3" />
                    <p className="text-sm text-[#5B6E88] dark:text-text-muted">No clients yet.</p>
                    <p className="text-xs text-[#5B6E88] dark:text-text-muted mt-1">
                      Create a client in Firebase Console (Authentication → Add user), then add a
                      matching document to the <code className="bg-[#E0EEFF] dark:bg-navy-700 px-1 rounded">clients</code> Firestore collection (doc ID = that user's UID).
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {clients.map(c => (
                    <div key={c.id} className="rounded-2xl p-5 border border-[#DCE6F2] dark:border-surface-border bg-white dark:bg-navy-800 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-[12px] font-mono text-primary dark:text-primary-cyan">{c.id}</p>
                          <h3 className="text-sm font-bold text-[#0A1E3F] dark:text-white mt-0.5">{c.name}</h3>
                          <p className="text-xs text-[#5B6E88] dark:text-text-muted">{c.company}</p>
                        </div>
                        <span className="text-[12px] font-bold px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-500/30">
                          Active
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-[12px]">
                        {[
                          { label: 'Projects', val: (c.projects || []).length },
                          { label: 'Invoices', val: (c.invoices || []).length },
                          { label: 'Tickets',  val: (c.tickets  || []).length },
                        ].map(({ label, val }) => (
                          <div key={label} className="p-2 rounded-xl bg-[#F4F8FC] dark:bg-navy-700">
                            <p className="text-base font-extrabold text-[#0A1E3F] dark:text-white">{val}</p>
                            <p className="text-[#5B6E88] dark:text-text-muted">{label}</p>
                          </div>
                        ))}
                      </div>
                      <div className="pt-2 border-t border-[#DCE6F2] dark:border-surface-border text-[13px] text-[#5B6E88] dark:text-text-muted flex items-center gap-3">
                        <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Since {c.clientSince}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </main>
        </div>
      </div>

      {/* ══ ASSIGN STAFF MODAL ══════════════════════════════════ */}
      {assignProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-navy-900 rounded-3xl border border-[#DCE6F2] dark:border-surface-border shadow-2xl overflow-hidden">

            {/* Modal header */}
            <div className="px-6 py-4 border-b border-[#DCE6F2] dark:border-surface-border flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[#0A1E3F] dark:text-white">Assign Staff</h3>
                <p className="text-[11px] text-[#5B6E88] dark:text-text-muted mt-0.5 truncate">{assignProject.title}</p>
              </div>
              <button onClick={() => setAssignProject(null)}
                className="p-1.5 rounded-xl text-[#5B6E88] dark:text-text-muted hover:text-[#0A1E3F] dark:hover:text-white hover:bg-[#F4F8FC] dark:hover:bg-navy-800 transition-colors shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Staff list */}
            <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
              <p className="text-[11px] text-[#5B6E88] dark:text-text-muted mb-3">
                Click to toggle assignment. ✓ = currently assigned.
              </p>
              {staffList.map(s => {
                const isAssigned = (assignProject.assignedStaff || []).includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => handleToggleStaff(assignProject.id, s.id, assignProject.assignedStaff || [])}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all text-left ${
                      isAssigned
                        ? 'border-primary dark:border-primary-cyan bg-primary/5 dark:bg-primary/10'
                        : 'border-[#DCE6F2] dark:border-surface-border hover:border-primary/40 dark:hover:border-primary-cyan/40 bg-white dark:bg-navy-800'
                    }`}>
                    {/* Avatar */}
                    <div className={`w-9 h-9 rounded-xl ${s.avatarColor} flex items-center justify-center text-white text-sm font-bold shrink-0`}>
                      {s.avatar}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-[#0A1E3F] dark:text-white truncate">{s.name}</p>
                      <p className="text-[11px] text-[#5B6E88] dark:text-text-muted truncate">{s.role}</p>
                    </div>
                    {/* Status badge + check */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[s.status]}`}>
                        {s.status}
                      </span>
                      {isAssigned && (
                        <div className="w-5 h-5 rounded-full bg-primary dark:bg-primary-cyan flex items-center justify-center">
                          <CheckCircle2 className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[#DCE6F2] dark:border-surface-border flex items-center justify-between">
              <span className="text-xs text-[#5B6E88] dark:text-text-muted">
                {(assignProject.assignedStaff || []).length} staff assigned
              </span>
              <button onClick={() => setAssignProject(null)}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary-hover transition-all">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
