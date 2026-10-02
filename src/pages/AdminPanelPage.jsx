import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, orderBy, query, doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import SEO from '../components/SEO';
import {
  ShieldCheck, Users, FileText, LogOut,
  CheckCircle2, XCircle, Clock,
  Copy, MessageSquare, Sparkles,
  Building, Phone, Mail, Calendar,
  Inbox, UserPlus
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
  const navigate                = useNavigate();
  const { logout }              = useAuth();
  const [tab, setTab]              = useState('client_requests');
  const [allLeads, setAllLeads]    = useState([]);
  const [clients, setClients]      = useState([]);
  const [selected, setSelected]    = useState(null);
  const [copied, setCopied]        = useState('');

  // Derived — split leads by type
  const clientRequests = allLeads.filter(r => r.type === 'client_request');
  const quoteLeads     = allLeads.filter(r => r.type !== 'client_request');

  // Live leads from Firestore (all types)
  useEffect(() => {
    const q = query(collection(db, 'leads'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setAllLeads(snap.docs.map(d => ({ leadId: d.id, ...d.data() })));
    }, (err) => console.error('Leads listener error', err));
    return unsubscribe;
  }, []);

  // Live client list from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'clients'), (snap) => {
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error('Clients listener error', err));
    return unsubscribe;
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/');
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
    { id: 'client_requests', label: 'Client Requests', icon: UserPlus, count: clientRequests.filter(r => r.status === 'New').length },
    { id: 'quote_leads',     label: 'Quote Leads',     icon: Inbox,    count: quoteLeads.filter(r => r.status === 'New').length     },
    { id: 'clients',         label: 'Active Clients',  icon: Users,    count: clients.length                                        },
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
                    <p className="text-xs text-[#5B6E88] dark:text-text-muted mt-0.5">Submitted via Quote Modal</p>
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

            {/* ══ CLIENTS TAB ══════════════════════════════════ */}
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
    </div>
  );
}
