import React, { useEffect, useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import { services } from '../config/services';
import { company } from '../config/company';
import {
  X, User, Building, Phone, Mail, Briefcase, FileText,
  Send, CheckCircle2, AlertCircle, MessageSquare, ArrowRight, Sparkles,
} from 'lucide-react';

// ── ONE service dropdown for every request form ────────────────────
// Titles come from the canonical services list (src/config/services.js)
// so the website, quote modal and contact form can never drift apart.
const SERVICE_OPTIONS = [...services.map(s => s.title), 'Other / Not Sure Yet'];

const EMPTY_FORM = { name: '', company: '', email: '', phone: '', service: '', message: '' };

// Resolve a free-text service hint ("SMART ERP" from the homepage
// banner, a full service title from a service page, etc.) to the closest
// dropdown option so CTA buttons can pre-select the right service.
export function matchServiceOption(hint) {
  const q = String(hint || '').trim().toLowerCase();
  if (!q) return '';
  const exact = SERVICE_OPTIONS.find(s => s.toLowerCase() === q);
  if (exact) return exact;
  const partial = SERVICE_OPTIONS.find(
    s => s.toLowerCase().includes(q) || q.includes(s.toLowerCase().split(' with ')[0])
  );
  return partial || '';
}

// ── Validation ─────────────────────────────────────────────────────
function validate(form) {
  if (!form.name.trim())                return 'Please enter your name.';
  if (!form.email.trim())               return 'Please enter your email address.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
                                        return 'That email address doesn\'t look right — please check it.';
  if (!form.phone.trim())               return 'Please enter your phone / WhatsApp number.';
  if (form.phone.replace(/\D/g, '').length < 9)
                                        return 'Please enter a valid phone number (at least 9 digits).';
  if (!form.service)                    return 'Please select the service you\'re interested in.';
  if (!form.message.trim())             return 'Please tell us briefly what you need.';
  return '';
}

// ═══════════════════════════════════════════════════════════════════
//  QuoteRequestForm — THE single request form on the whole website.
//  Used by: QuoteModal (navbar/hero/CTA buttons), ClientRequestForm
//  ("Get Started" buttons) and the Contact page inline form.
//
//  • `source` records where the lead came from (e.g. "Quote Request",
//    "Get Started", "Contact Form") and is stored on the lead document,
//    so the ERP Leads page can show a real Source column.
//  • `initialService` pre-selects the service when the visitor clicked
//    a CTA on a specific service page.
//  • Every submission is saved to the `leads` collection in Firestore.
//    On failure a visible error is shown — never a blank page.
// ═══════════════════════════════════════════════════════════════════
export default function QuoteRequestForm({ source = 'Quote Request', initialService = '', onSubmitted }) {
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [refId,     setRefId]     = useState('');

  // Pre-select the service when opened from a service page / product CTA.
  useEffect(() => {
    if (!initialService) return;
    setForm(prev => prev.service ? prev : { ...prev, service: matchServiceOption(initialService) });
  }, [initialService]);

  const set = (field, val) => setForm(prev => ({ ...prev, [field]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const validationError = validate(form);
    if (validationError) { setError(validationError); return; }

    if (!isFirebaseConfigured) {
      setError('Our online form service is temporarily unavailable. Please reach us directly on WhatsApp or email ' + company.contact.email + '.');
      return;
    }

    setLoading(true);
    const generatedId = `WEB-${Date.now().toString(36).toUpperCase()}`;
    try {
      await addDoc(collection(db, 'leads'), {
        // Identification / workflow
        type:      'website_form',
        leadId:    generatedId,
        status:    'New',
        createdAt: serverTimestamp(),

        // Client details
        name:        form.name.trim(),
        company:     form.company.trim(),
        email:       form.email.trim(),
        phone:       form.phone.trim(),
        whatsapp:    form.phone.trim(),   // mirrored: ERP WhatsApp actions + security rules
        service:     form.service,
        message:     form.message.trim(),
        description: form.message.trim(), // mirrored: older ERP/admin views read this field

        // Origin
        source:      source,
        page:        window.location.pathname,
      });
      setRefId(generatedId);
      setSubmitted(true);
      setForm(EMPTY_FORM);            // clear the form after success
      if (onSubmitted) onSubmitted(generatedId);
    } catch (err) {
      console.error('QuoteRequestForm submit error:', err);
      setError('We couldn\'t submit your request just now — please try again in a moment, or message us directly on WhatsApp.');
    } finally {
      setLoading(false);
    }
  };

  const whatsappUrl = `https://wa.me/${company.contact.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
    `Hi SMART Pvt Ltd! I just submitted a request via your website (Ref: ${refId}). My name is ${form.name || '—'}.`
  )}`;

  const inputCls = "w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#F4F8FC] dark:bg-navy-800 border border-[#C8D8EE] dark:border-surface-border text-[#0A1E3F] dark:text-white text-sm placeholder:text-[#8B9AAF] focus:outline-none focus:border-primary dark:focus:border-primary-electric transition-colors";
  const labelCls = "block text-xs font-semibold text-[#29405E] dark:text-text-light mb-1.5";

  // ── Success state ────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="text-center space-y-5 py-4">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <div>
          <h3 className="text-xl font-extrabold text-[#0A1E3F] dark:text-white">Request Received!</h3>
          <p className="text-xs text-[#5B6E88] dark:text-text-muted mt-1 max-w-sm mx-auto leading-relaxed">
            Your reference ID is{' '}
            <strong className="text-[#0A1E3F] dark:text-white bg-[#F0F6FF] dark:bg-navy-800 px-2 py-0.5 rounded border border-[#C8D8EE] dark:border-surface-border font-mono">
              {refId}
            </strong>
            . Our team will review it and contact you within 2 business hours.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all"
          >
            <MessageSquare className="w-4 h-4" /> Follow up on WhatsApp
          </a>
          <button
            type="button"
            onClick={() => { setSubmitted(false); setRefId(''); }}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-[#29405E] dark:text-text-light bg-[#F0F6FF] dark:bg-navy-800 hover:bg-[#E0EEFF] dark:hover:bg-navy-700 border border-[#C8D8EE] dark:border-surface-border transition-colors"
          >
            Send another request
          </button>
        </div>
      </div>
    );
  }

  // ── Form state ───────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>

      {/* Name + Company */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Full Name <span className="text-red-500">*</span></label>
          <div className="relative">
            <User className="w-4 h-4 text-[#5B6E88] dark:text-text-muted absolute left-3 top-3" />
            <input type="text" required value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="e.g. John Perera" className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Company / Organisation</label>
          <div className="relative">
            <Building className="w-4 h-4 text-[#5B6E88] dark:text-text-muted absolute left-3 top-3" />
            <input type="text" value={form.company} onChange={e => set('company', e.target.value)}
              placeholder="Optional" className={inputCls} />
          </div>
        </div>
      </div>

      {/* Email + Phone */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Email Address <span className="text-red-500">*</span></label>
          <div className="relative">
            <Mail className="w-4 h-4 text-[#5B6E88] dark:text-text-muted absolute left-3 top-3" />
            <input type="email" required value={form.email} onChange={e => set('email', e.target.value)}
              placeholder="john@company.com" className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Phone / WhatsApp <span className="text-red-500">*</span></label>
          <div className="relative">
            <Phone className="w-4 h-4 text-[#5B6E88] dark:text-text-muted absolute left-3 top-3" />
            <input type="tel" required value={form.phone} onChange={e => set('phone', e.target.value)}
              placeholder="+94 77 123 4567" className={inputCls} />
          </div>
        </div>
      </div>

      {/* Service */}
      <div>
        <label className={labelCls}>What are you looking for? <span className="text-red-500">*</span></label>
        <div className="relative">
          <Briefcase className="w-4 h-4 text-[#5B6E88] dark:text-text-muted absolute left-3 top-3 pointer-events-none" />
          <select required value={form.service} onChange={e => set('service', e.target.value)}
            className={`${inputCls} appearance-none`}>
            <option value="" disabled>Select a service...</option>
            {SERVICE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Message */}
      <div>
        <label className={labelCls}>Tell us about your requirement <span className="text-red-500">*</span></label>
        <div className="relative">
          <FileText className="w-4 h-4 text-[#5B6E88] dark:text-text-muted absolute left-3 top-3" />
          <textarea required rows={4} value={form.message} onChange={e => set('message', e.target.value)}
            placeholder="Your business, current challenges, and what you expect from this solution..."
            className={`${inputCls} resize-none`} />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
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
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Submitting...
          </>
        ) : (
          <><Send className="w-4 h-4" /> Send My Request <ArrowRight className="w-3.5 h-3.5" /></>
        )}
      </button>

      <p className="text-center text-[11px] text-[#5B6E88] dark:text-text-muted">
        By submitting, you agree to be contacted by our team regarding your request.
      </p>
    </form>
  );
}

// ── Modal shell used by QuoteModal / ClientRequestForm ─────────────
export function RequestModal({ isOpen, onClose, source, eyebrow, title, subtitle, initialService }) {
  // Close on Escape — hook runs every render (never conditionally).
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog" aria-modal="true" aria-label={title}
    >
      <div className="relative w-full max-w-lg bg-white dark:bg-navy-900 rounded-3xl shadow-2xl border border-[#DCE6F2] dark:border-surface-border overflow-hidden max-h-[92vh] flex flex-col">

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-[#5B6E88] dark:text-text-muted hover:text-[#0A1E3F] dark:hover:text-white hover:bg-[#F4F8FC] dark:hover:bg-navy-800 border border-[#DCE6F2] dark:border-surface-border transition-colors z-10"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="p-6 sm:p-8 pb-4 pr-14">
          <div className="flex items-center gap-2 mb-2">
            <span className="p-1.5 rounded-lg bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-cyan border border-primary/20">
              <Sparkles className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-primary dark:text-primary-cyan">
              {eyebrow || 'Get Started'}
            </span>
          </div>
          <h2 className="text-xl font-extrabold text-[#0A1E3F] dark:text-white leading-tight">{title}</h2>
          {subtitle && (
            <p className="text-xs text-[#5B6E88] dark:text-text-muted mt-1">{subtitle}</p>
          )}
        </div>

        {/* Scrollable form body */}
        <div className="px-6 sm:px-8 pb-6 sm:pb-8 overflow-y-auto flex-1">
          <QuoteRequestForm source={source} initialService={initialService} />
        </div>
      </div>
    </div>
  );
}
