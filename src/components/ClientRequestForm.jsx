import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import {
  X, User, Building, Phone, Mail,
  Briefcase, FileText, Send, CheckCircle2,
  AlertCircle, Sparkles, ArrowRight, MessageSquare
} from 'lucide-react';
import { company } from '../config/company';

const SERVICES = [
  'ERP & POS System',
  'Custom Software Development',
  'Portfolio Website',
  'Corporate Business Website',
  'Mobile App (Android & iOS)',
  'Business Process Automation',
  'AI-Powered Solutions',
  'Accounting & Tax Services',
  'Audit & Assurance',
  'Other / Not Sure Yet',
];

export default function ClientRequestForm({ isOpen, onClose }) {
  const [form, setForm] = useState({
    name:        '',
    company:     '',
    phone:       '',
    email:       '',
    service:     '',
    description: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [refId, setRefId]         = useState('');

  if (!isOpen) return null;

  const set = (field, val) => setForm(prev => ({ ...prev, [field]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Basic validation
    if (!form.name.trim() || !form.phone.trim()) {
      setError('Name and phone number are required.');
      return;
    }

    setLoading(true);

    const generatedId = `REQ-${Date.now().toString(36).toUpperCase()}`;

    const payload = {
      // Identification
      type:        'client_request',   // distinguishes from quote modal leads
      leadId:      generatedId,
      status:      'New',
      createdAt:   serverTimestamp(),

      // Client details
      name:        form.name.trim(),
      company:     form.company.trim(),
      whatsapp:    form.phone.trim(),   // stored as whatsapp so AdminPanel can send WA message
      phone:       form.phone.trim(),
      email:       form.email.trim(),
      service:     form.service || 'Not specified',
      message:     form.description.trim(),
      description: form.description.trim(),

      // Source
      source:      'Get Started Form',
    };

    try {
      if (isFirebaseConfigured) {
        const docRef = await addDoc(collection(db, 'leads'), payload);
        setRefId(generatedId);
      } else {
        // Fallback — save to localStorage when Firebase not configured
        const existing = JSON.parse(localStorage.getItem('smart_leads') || '[]');
        existing.unshift({ ...payload, createdAt: new Date().toISOString() });
        localStorage.setItem('smart_leads', JSON.stringify(existing));
        setRefId(generatedId);
        console.warn('[SMART] Firebase not configured — lead saved to localStorage only.');
      }
      setSubmitted(true);
    } catch (err) {
      console.error('ClientRequestForm submit error:', err);
      setError('Something went wrong. Please try WhatsApp instead.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setForm({ name: '', company: '', phone: '', email: '', service: '', description: '' });
    setSubmitted(false);
    setError('');
    setRefId('');
    onClose();
  };

  const whatsappUrl = `https://wa.me/${company.contact.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
    `Hi SMART Pvt Ltd! I just submitted a client request (Ref: ${refId}). My name is ${form.name}. Please get in touch with me.`
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-navy-900 rounded-3xl shadow-2xl border border-[#DCE6F2] dark:border-surface-border overflow-hidden max-h-[92vh] flex flex-col">

        {/* Close */}
        <button
          onClick={handleReset}
          className="absolute top-4 right-4 p-2 rounded-xl text-[#5B6E88] dark:text-text-muted hover:text-[#0A1E3F] dark:hover:text-white hover:bg-[#F4F8FC] dark:hover:bg-navy-800 border border-[#DCE6F2] dark:border-surface-border transition-colors z-10"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* ── Success State ─────────────────────────────────── */}
        {submitted ? (
          <div className="p-8 text-center space-y-5 overflow-y-auto">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-xl font-extrabold text-[#0A1E3F] dark:text-white">Request Received!</h2>
              <p className="text-xs text-[#5B6E88] dark:text-text-muted mt-1 max-w-sm mx-auto leading-relaxed">
                Your reference ID is{' '}
                <strong className="text-[#0A1E3F] dark:text-white bg-[#F0F6FF] dark:bg-navy-800 px-2 py-0.5 rounded border border-[#C8D8EE] dark:border-surface-border font-mono">
                  {refId}
                </strong>
                . Our team will review your request and contact you shortly.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#F4F8FC] dark:bg-navy-800 border border-[#DCE6F2] dark:border-surface-border text-left space-y-1.5 text-xs">
              <p className="font-bold text-[#0A1E3F] dark:text-white text-[11px] uppercase tracking-wider">Your Submission</p>
              {[
                { label: 'Name',    val: form.name    },
                { label: 'Company', val: form.company || '—' },
                { label: 'Phone',   val: form.phone   },
                { label: 'Service', val: form.service || '—' },
              ].map(({ label, val }) => (
                <div key={label} className="flex gap-2">
                  <span className="text-[#5B6E88] dark:text-text-muted w-16 shrink-0">{label}:</span>
                  <span className="font-semibold text-[#0A1E3F] dark:text-white">{val}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all"
              >
                <MessageSquare className="w-4 h-4" />
                Follow up on WhatsApp
              </a>
              <button
                onClick={handleReset}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-[#29405E] dark:text-text-light bg-[#F0F6FF] dark:bg-navy-800 hover:bg-[#E0EEFF] dark:hover:bg-navy-700 border border-[#C8D8EE] dark:border-surface-border transition-colors"
              >
                Done
              </button>
            </div>
          </div>

        ) : (

          /* ── Form State ──────────────────────────────────── */
          <div className="p-6 sm:p-8 space-y-5 overflow-y-auto flex-1">

            {/* Header */}
            <div className="pr-8">
              <div className="flex items-center gap-2 mb-2">
                <span className="p-1.5 rounded-lg bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-cyan border border-primary/20">
                  <Sparkles className="w-4 h-4" />
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-primary dark:text-primary-cyan">
                  Get Started
                </span>
              </div>
              <h2 className="text-xl font-extrabold text-[#0A1E3F] dark:text-white leading-tight">
                Tell us about your requirement
              </h2>
              <p className="text-xs text-[#5B6E88] dark:text-text-muted mt-1">
                Fill in your details and our team will get back to you within 2 business hours.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Name + Company */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#29405E] dark:text-text-light mb-1.5">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#5B6E88] dark:text-text-muted absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={e => set('name', e.target.value)}
                      placeholder="e.g. John Perera"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#F4F8FC] dark:bg-navy-800 border border-[#C8D8EE] dark:border-surface-border text-[#0A1E3F] dark:text-white text-sm placeholder:text-[#8B9AAF] focus:outline-none focus:border-primary dark:focus:border-primary-electric transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#29405E] dark:text-text-light mb-1.5">
                    Company / Organisation
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-[#5B6E88] dark:text-text-muted absolute left-3 top-3" />
                    <input
                      type="text"
                      value={form.company}
                      onChange={e => set('company', e.target.value)}
                      placeholder="e.g. Perera Holdings"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#F4F8FC] dark:bg-navy-800 border border-[#C8D8EE] dark:border-surface-border text-[#0A1E3F] dark:text-white text-sm placeholder:text-[#8B9AAF] focus:outline-none focus:border-primary dark:focus:border-primary-electric transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Phone + Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#29405E] dark:text-text-light mb-1.5">
                    Phone / WhatsApp <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-[#5B6E88] dark:text-text-muted absolute left-3 top-3" />
                    <input
                      type="tel"
                      required
                      value={form.phone}
                      onChange={e => set('phone', e.target.value)}
                      placeholder="+94 77 123 4567"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#F4F8FC] dark:bg-navy-800 border border-[#C8D8EE] dark:border-surface-border text-[#0A1E3F] dark:text-white text-sm placeholder:text-[#8B9AAF] focus:outline-none focus:border-primary dark:focus:border-primary-electric transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#29405E] dark:text-text-light mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#5B6E88] dark:text-text-muted absolute left-3 top-3" />
                    <input
                      type="email"
                      value={form.email}
                      onChange={e => set('email', e.target.value)}
                      placeholder="john@company.com"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#F4F8FC] dark:bg-navy-800 border border-[#C8D8EE] dark:border-surface-border text-[#0A1E3F] dark:text-white text-sm placeholder:text-[#8B9AAF] focus:outline-none focus:border-primary dark:focus:border-primary-electric transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Service Interest */}
              <div>
                <label className="block text-xs font-semibold text-[#29405E] dark:text-text-light mb-1.5">
                  What are you looking for? <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-[#5B6E88] dark:text-text-muted absolute left-3 top-3 pointer-events-none" />
                  <select
                    required
                    value={form.service}
                    onChange={e => set('service', e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#F4F8FC] dark:bg-navy-800 border border-[#C8D8EE] dark:border-surface-border text-[#0A1E3F] dark:text-white text-sm focus:outline-none focus:border-primary dark:focus:border-primary-electric transition-colors appearance-none"
                  >
                    <option value="" disabled>Select a service...</option>
                    {SERVICES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-[#29405E] dark:text-text-light mb-1.5">
                  Brief Description <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <FileText className="w-4 h-4 text-[#5B6E88] dark:text-text-muted absolute left-3 top-3" />
                  <textarea
                    required
                    rows={4}
                    value={form.description}
                    onChange={e => set('description', e.target.value)}
                    placeholder="Tell us about your business, current challenges, and what you expect from this solution..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#F4F8FC] dark:bg-navy-800 border border-[#C8D8EE] dark:border-surface-border text-[#0A1E3F] dark:text-white text-sm placeholder:text-[#8B9AAF] focus:outline-none focus:border-primary dark:focus:border-primary-electric transition-colors resize-none"
                  />
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-xs text-red-600 dark:text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed shadow-glow-sm transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send My Request
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              <p className="text-center text-[11px] text-[#5B6E88] dark:text-text-muted">
                By submitting, you agree to be contacted by our team regarding your request.
              </p>

            </form>
          </div>
        )}
      </div>
    </div>
  );
}
