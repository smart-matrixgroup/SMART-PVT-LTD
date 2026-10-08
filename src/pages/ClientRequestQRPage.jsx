// ─────────────────────────────────────────────────────────────────
//  Public Client Request / Onboarding Form Page (Triggered by QR Code Scan)
//  Route: /request?source=qr or /qr-request
//  When submitted, creates a Lead in Firestore with source: 'QR Code Scan'
//  which appears in real-time under ERP Leads.
// ─────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import { company } from '../config/company';
import { services } from '../config/services';
import SEO from '../components/SEO';
import {
  Send, CheckCircle2, AlertCircle, Phone, Mail, Building,
  User, Briefcase, FileText, Sparkles, ArrowRight, MessageSquare,
  ShieldCheck, HelpCircle
} from 'lucide-react';

const SERVICE_OPTIONS = [
  ...services.map(s => s.title),
  'ERP & POS System',
  'Custom Software Development',
  'Corporate Business Website',
  'Mobile App (Android & iOS)',
  'Business Process Automation',
  'AI-Powered Solutions',
  'Accounting & Tax Services',
  'Other / Custom Requirement'
];
// Deduplicate
const UNIQUE_SERVICES = [...new Set(SERVICE_OPTIONS)];

const BUDGET_OPTIONS = [
  'Below LKR 50,000',
  'LKR 50,000 – LKR 100,000',
  'LKR 100,000 – LKR 250,000',
  'LKR 250,000 – LKR 500,000',
  'LKR 500,000+',
  'Flexible / Let\'s discuss'
];

export default function ClientRequestQRPage() {
  const [params] = useSearchParams();
  const source = params.get('source') || 'QR Code Scan';

  const [form, setForm] = useState({
    name: '',
    company: '',
    phone: '',
    email: '',
    service: 'ERP & POS System',
    budget: 'LKR 100,000 – LKR 250,000',
    message: '',
  });

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Please enter your name.'); return; }
    if (!form.phone.trim()) { setError('Please enter your WhatsApp / phone number.'); return; }
    if (!form.email.trim()) { setError('Please enter your email address.'); return; }
    if (!form.message.trim()) { setError('Please describe your project requirements.'); return; }

    setLoading(true);
    setError('');

    try {
      const payload = {
        name: form.name.trim(),
        company: form.company.trim() || 'Individual Client',
        phone: form.phone.trim(),
        whatsapp: form.phone.trim(),
        email: form.email.trim().toLowerCase(),
        service: form.service,
        budget: form.budget,
        description: form.message.trim(),
        message: form.message.trim(),
        source: 'QR Code Scan',
        type: 'client_request',
        status: 'New',
        createdAt: serverTimestamp(),
      };

      if (isFirebaseConfigured) {
        await addDoc(collection(db, 'leads'), payload);
      }

      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setError('Unable to send request. Please check your internet connection or contact us directly on WhatsApp.');
    } finally {
      setLoading(false);
    }
  };

  const whatsappUrl = `https://wa.me/${company.contact.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hi SMART Pvt Ltd! I just submitted a project request for "${form.service}". Looking forward to your response.`)}`;

  return (
    <div className="min-h-screen bg-[#040D1F] text-white flex flex-col justify-between py-8 px-4 sm:px-6">
      <SEO
        title="Submit Project Request — SMART Pvt Ltd"
        description="Scan & Submit your project requirements to SMART Pvt Ltd engineering team."
      />

      <div className="max-w-xl w-full mx-auto my-auto">

        {/* Brand Header */}
        <div className="text-center mb-6">
          <Link to="/" className="inline-block mb-3">
            <img
              src={company.logos.darkMode || company.logos.lightMode}
              alt="SMART Pvt Ltd"
              className="h-10 mx-auto object-contain"
              onError={e => { e.currentTarget.style.display = 'none'; }}
            />
          </Link>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 border border-primary/40 text-primary-cyan text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5" /> Direct QR Request Portal
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Project Request & Onboarding
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-md mx-auto">
            Scan & submit your project details directly to the SMART Pvt Ltd administration team. We will review and reach out with an official quotation.
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#071230] border border-blue-900/40 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
          {/* Top subtle glow */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary-electric to-transparent" />

          {submitted ? (
            <div className="text-center py-6 space-y-5 animate-in fade-in duration-300">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div>
                <h2 className="text-xl font-extrabold text-white">Request Received Successfully!</h2>
                <p className="text-xs sm:text-sm text-slate-300 mt-1.5 max-w-sm mx-auto leading-relaxed">
                  Thank you, <strong>{form.name}</strong>. Your project request has been transmitted directly to our admin team under ERP Leads.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#0A1838] border border-slate-700/60 text-left text-xs space-y-2 text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Service:</span>
                  <span className="font-bold text-white">{form.service}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Phone / WhatsApp:</span>
                  <span className="font-bold text-white">{form.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Lead Source:</span>
                  <span className="font-bold text-primary-cyan">QR Code Scan</span>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all"
                >
                  <MessageSquare className="w-4 h-4" /> Chat on WhatsApp Now
                </a>
                <button
                  type="button"
                  onClick={() => { setSubmitted(false); setForm({ name: '', company: '', phone: '', email: '', service: 'ERP & POS System', budget: 'LKR 100,000 – LKR 250,000', message: '' }); }}
                  className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-all"
                >
                  Submit Another Request
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Your Name <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="e.g. Rahul Mendis"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#0A1838] border border-slate-700/80 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-primary-electric transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Company / Organization
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      name="company"
                      value={form.company}
                      onChange={handleChange}
                      placeholder="e.g. RMG Holdings"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#0A1838] border border-slate-700/80 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-primary-electric transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    WhatsApp / Phone Number <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="tel"
                      required
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      placeholder="e.g. +94 77 123 4567"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#0A1838] border border-slate-700/80 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-primary-electric transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Email Address <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      required
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="e.g. rahul@company.com"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#0A1838] border border-slate-700/80 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-primary-electric transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Service Required <span className="text-rose-400">*</span>
                  </label>
                  <select
                    name="service"
                    value={form.service}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A1838] border border-slate-700/80 text-white text-xs focus:outline-none focus:border-primary-electric transition-colors cursor-pointer"
                  >
                    {UNIQUE_SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Estimated Budget
                  </label>
                  <select
                    name="budget"
                    value={form.budget}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A1838] border border-slate-700/80 text-white text-xs focus:outline-none focus:border-primary-electric transition-colors cursor-pointer"
                  >
                    {BUDGET_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Project Details / Requirements <span className="text-rose-400">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  name="message"
                  value={form.message}
                  onChange={handleChange}
                  placeholder="Describe your project requirements, features needed, timeline or current challenges..."
                  className="w-full p-3 rounded-xl bg-[#0A1838] border border-slate-700/80 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-primary-electric transition-colors resize-vertical"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-primary to-primary-hover hover:from-primary-hover hover:to-blue-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/30"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending Request to Admin...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Submit Project Request
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <span className="text-[11px] text-slate-400">
                  🔒 Encrypted submission • Logged under SMART ERP Leads with real-time alerts.
                </span>
              </div>
            </form>
          )}

        </div>

      </div>

      <div className="text-center text-xs text-slate-500 mt-6">
        © {new Date().getFullYear()} {company.fullName}. All rights reserved.
      </div>
    </div>
  );
}
