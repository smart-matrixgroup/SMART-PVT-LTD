import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { clients } from '../config/clients';
import {
  ShieldCheck, Users, FileText, Bell, LogOut,
  CheckCircle2, XCircle, Clock, Eye, EyeOff,
  Copy, MessageSquare, ChevronRight, Sparkles,
  User, Building, Phone, Mail, Calendar, Lock,
  AlertCircle, LayoutDashboard, Inbox
} from 'lucide-react';

// ── Admin credentials ─────────────────────────────────────────
const ADMIN_ID       = 'SMART-ADMIN';
const ADMIN_PASSWORD = 'smart@erp2025';

// ── Status badge helper ───────────────────────────────────────
const Badge = ({ status }) => {
  const map = {
    'New':      'bg-blue-100  text-blue-700  border-blue-200  dark:bg-blue-500/15  dark:text-blue-300  dark:border-blue-500/30',
    'Accepted': 'bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30',
    'Rejected': 'bg-red-100   text-red-700   border-red-200   dark:bg-red-500/15   dark:text-red-300   dark:border-red-500/30',
    'Pending':  'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${map[status] || map['Pending']}`}>
      {status}
    </span>
  );
};

// ── Admin Login Screen ────────────────────────────────────────
function AdminLogin({ onLogin }) {
  const [id, setId]           = useState('');
  const [pass, setPass]       = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setTimeout(() => {
      if (id.trim() === ADMIN_ID && pass === ADMIN_PASSWORD) {
        onLogin();
      } else {
        setError('Invalid admin credentials.');
        setLoading(false);
      }
    }, 600);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F8FC] dark:bg-navy-950 px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-3xl p-8 border border-[#DCE6F2] dark:border-surface-border bg-white dark:bg-navy-900 shadow-xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-cyan border border-primary/30 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-extrabold text-[#0A1E3F] dark:text-white">Admin Panel</h1>
            <p className="text-xs text-[#5B6E88] dark:text-text-muted">SMART Pvt Ltd — Internal Access Only</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#29405E] dark:text-text-light mb-1.5">Admin ID</label>
              <div className="relative">
                <User className="w-4 h-4 text-[#5B6E88] dark:text-text-muted absolute left-3.5 top-3" />
                <input type="text" required value={id} onChange={e => setId(e.target.value)}
                  placeholder="SMART-ADMIN"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F4F8FC] dark:bg-navy-800 border border-[#C8D8EE] dark:border-surface-border text-[#0A1E3F] dark:text-white text-sm focus:outline-none focus:border-primary dark:focus:border-primary-electric"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#29405E] dark:text-text-light mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#5B6E88] dark:text-text-muted absolute left-3.5 top-3" />
                <input type={showPass ? 'text' : 'password'} required value={pass} onChange={e => setPass(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#F4F8FC] dark:bg-navy-800 border border-[#C8D8EE] dark:border-surface-border text-[#0A1E3F] dark:text-white text-sm focus:outline-none focus:border-primary dark:focus:border-primary-electric"
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-3 text-[#5B6E88] dark:text-text-muted hover:text-[#0A1E3F] dark:hover:text-white">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-xs text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary-hover disabled:opacity-60 transition-all flex items-center justify-center gap-2">
              {loading ? (
                <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Verifying...</>
              ) : (
                <>Enter Admin Panel <ChevronRight className="w-4 h-4" /></>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Main Admin Panel ──────────────────────────────────────────
export default function AdminPanelPage() {
  const navigate                = useNavigate();
  const [authed, setAuthed]     = useState(false);
  const [tab, setTab]           = useState('requests');
  const [requests, setRequests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [copied, setCopied]     = useState('');

  // Load quote requests from localStorage
  useEffect(() => {
    if (!authed) return;
    try {
      const raw = JSON.parse(localStorage.getItem('smart_leads') || '[]');
      setRequests(raw);
    } catch {
      setRequests([]);
    }
  }, [authed]);

  const handleLogout = () => {
    setAuthed(false);
    navigate('/');
  };

  const copyText = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  // Update request status in localStorage
  const updateStatus = (leadId, status) => {
    const updated = requests.map(r => r.leadId === leadId ? { ...r, status } : r);
    setRequests(updated);
    localStorage.setItem('smart_leads', JSON.stringify(updated));
    if (selected?.leadId === leadId) setSelected({ ...selected, status });
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

  if (!authed) return <AdminLogin onLogin={() => setAuthed(true)} />;

  const NAV = [
    { id: 'requests', label: 'Quote Requests', icon: Inbox,          count: requests.filter(r => r.status === 'New').length },
    { id: 'clients',  label: 'Active Clients', icon: Users,          count: clients.length },
  ];

  return (
    <div className="min-h-screen bg-[#F4F8FC] dark:bg-navy-950 pt-20">
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
                  <p className="text-[10px] text-[#5B6E88] dark:text-text-muted">SMART Pvt Ltd</p>
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
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab === id ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary dark:text-primary-cyan'}`}>
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

            {/* ══ REQUESTS TAB ══════════════════════════════════ */}
            {tab === 'requests' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-[#0A1E3F] dark:text-white">Quote Requests</h2>
                  <span className="text-xs text-[#5B6E88] dark:text-text-muted">{requests.length} total</span>
                </div>

                {requests.length === 0 && (
                  <div className="rounded-2xl p-10 border border-dashed border-[#C8D8EE] dark:border-surface-border bg-white dark:bg-navy-800 text-center">
                    <Inbox className="w-8 h-8 text-[#5B6E88] dark:text-text-muted mx-auto mb-3" />
                    <p className="text-sm text-[#5B6E88] dark:text-text-muted">No requests yet.</p>
                    <p className="text-xs text-[#5B6E88] dark:text-text-muted mt-1">Quote submissions will appear here.</p>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Request list */}
                  <div className="space-y-3">
                    {requests.map(req => (
                      <button key={req.leadId} onClick={() => setSelected(req)}
                        className={`w-full text-left rounded-2xl p-4 border transition-all ${
                          selected?.leadId === req.leadId
                            ? 'border-primary dark:border-primary-cyan bg-primary/5 dark:bg-primary/10'
                            : 'border-[#DCE6F2] dark:border-surface-border bg-white dark:bg-navy-800 hover:border-primary/40 dark:hover:border-primary-cyan/40'
                        }`}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-bold text-[#0A1E3F] dark:text-white">{req.name || 'Unknown'}</p>
                            <p className="text-[10px] text-[#5B6E88] dark:text-text-muted mt-0.5">{req.service || '—'}</p>
                            <p className="text-[10px] text-[#5B6E88] dark:text-text-muted">{req.whatsapp || req.email || '—'}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1.5">
                            <Badge status={req.status || 'New'} />
                            <span className="text-[9px] text-[#5B6E88] dark:text-text-muted font-mono">{req.leadId}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Request detail */}
                  {selected ? (
                    <div className="rounded-2xl border border-[#DCE6F2] dark:border-surface-border bg-white dark:bg-navy-800 p-5 space-y-4 sticky top-24">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-[10px] font-mono text-[#5B6E88] dark:text-text-muted">{selected.leadId}</p>
                          <h3 className="text-sm font-bold text-[#0A1E3F] dark:text-white mt-0.5">{selected.name}</h3>
                        </div>
                        <Badge status={selected.status || 'New'} />
                      </div>

                      {/* Details */}
                      <div className="space-y-2 text-xs">
                        {[
                          { icon: Building,  label: 'Company',  val: selected.company    },
                          { icon: Phone,     label: 'WhatsApp', val: selected.whatsapp   },
                          { icon: Mail,      label: 'Email',    val: selected.email      },
                          { icon: Sparkles,  label: 'Service',  val: selected.service    },
                          { icon: FileText,  label: 'Budget',   val: selected.budget     },
                          { icon: Calendar,  label: 'Contact',  val: selected.preferredContact },
                        ].filter(r => r.val).map(({ icon: Icon, label, val }) => (
                          <div key={label} className="flex items-start gap-2">
                            <Icon className="w-3.5 h-3.5 text-primary dark:text-primary-cyan shrink-0 mt-0.5" />
                            <span className="text-[#5B6E88] dark:text-text-muted">{label}:</span>
                            <span className="font-semibold text-[#0A1E3F] dark:text-white">{val}</span>
                          </div>
                        ))}
                        {selected.message && (
                          <div className="mt-2 p-3 rounded-xl bg-[#F4F8FC] dark:bg-navy-700 text-[#29405E] dark:text-text-light text-[11px] leading-relaxed">
                            {selected.message}
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="pt-3 border-t border-[#DCE6F2] dark:border-surface-border space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#5B6E88] dark:text-text-muted">Actions</p>

                        {/* Accept */}
                        <button onClick={() => updateStatus(selected.leadId, 'Accepted')}
                          className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all">
                          <CheckCircle2 className="w-4 h-4" /> Accept Request
                        </button>

                        {/* Reject */}
                        <button onClick={() => updateStatus(selected.leadId, 'Rejected')}
                          className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 border border-red-200 dark:border-red-500/30 transition-all">
                          <XCircle className="w-4 h-4" /> Reject Request
                        </button>

                        {/* Send credentials via WhatsApp — only when Accepted */}
                        {selected.status === 'Accepted' && (
                          <div className="mt-3 p-4 rounded-xl bg-[#F0F6FF] dark:bg-navy-700 border border-[#C8D8EE] dark:border-surface-border space-y-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-primary dark:text-primary-cyan">
                              Send Client Credentials via WhatsApp
                            </p>
                            <p className="text-[11px] text-[#5B6E88] dark:text-text-muted leading-relaxed">
                              Add this client to <code className="bg-[#E0EEFF] dark:bg-navy-600 px-1 rounded">clients.js</code> first, then send credentials:
                            </p>

                            {/* Email copy */}
                            <div className="flex items-center gap-2">
                              <code className="flex-1 text-[11px] bg-white dark:bg-navy-800 border border-[#DCE6F2] dark:border-surface-border px-2 py-1.5 rounded-lg text-[#0A1E3F] dark:text-white truncate">
                                {selected.email || 'No email provided'}
                              </code>
                              <button onClick={() => copyText(selected.email || '', 'email')}
                                className="px-2 py-1.5 rounded-lg bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-cyan text-[10px] font-bold hover:bg-primary/20 transition-all">
                                {copied === 'email' ? '✓' : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>

                            {/* WhatsApp send button */}
                            {selected.whatsapp && (
                              <a
                                href={buildWhatsApp(selected, selected.email || '', '(set in clients.js)')}
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
                  ) : (
                    <div className="rounded-2xl border border-dashed border-[#C8D8EE] dark:border-surface-border bg-white dark:bg-navy-800 p-8 text-center text-xs text-[#5B6E88] dark:text-text-muted hidden lg:block">
                      Select a request to view details
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
                      Add clients to <code className="bg-[#E0EEFF] dark:bg-navy-700 px-1 rounded">src/config/clients.js</code>
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {clients.map(c => (
                    <div key={c.id} className="rounded-2xl p-5 border border-[#DCE6F2] dark:border-surface-border bg-white dark:bg-navy-800 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-[10px] font-mono text-primary dark:text-primary-cyan">{c.id}</p>
                          <h3 className="text-sm font-bold text-[#0A1E3F] dark:text-white mt-0.5">{c.name}</h3>
                          <p className="text-xs text-[#5B6E88] dark:text-text-muted">{c.company}</p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-500/30">
                          Active
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                        {[
                          { label: 'Projects', val: c.projects.length },
                          { label: 'Invoices', val: c.invoices.length },
                          { label: 'Tickets',  val: c.tickets.length  },
                        ].map(({ label, val }) => (
                          <div key={label} className="p-2 rounded-xl bg-[#F4F8FC] dark:bg-navy-700">
                            <p className="text-base font-extrabold text-[#0A1E3F] dark:text-white">{val}</p>
                            <p className="text-[#5B6E88] dark:text-text-muted">{label}</p>
                          </div>
                        ))}
                      </div>
                      <div className="pt-2 border-t border-[#DCE6F2] dark:border-surface-border text-[11px] text-[#5B6E88] dark:text-text-muted flex items-center gap-3">
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
