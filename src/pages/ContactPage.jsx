import React, { useState } from 'react';
import { company } from '../config/company';
import SEO from '../components/SEO';
import BranchMapSection from '../components/BranchMapSection';
import { 
  Phone, Mail, MessageSquare, MapPin, Clock, 
  Send, CheckCircle2, Sparkles, User, Building, MessageCircle 
} from 'lucide-react';

export default function ContactPage({ onOpenQuote }) {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: '', company: '', phone: '', email: '', message: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const getDirectWhatsAppUrl = () => {
    const text = `Hi SMART Pvt Ltd, I am contacting you from your official website contact page.`;
    return `https://wa.me/${company.contact.whatsapp.replace('+', '')}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="pt-28 pb-20 space-y-20">
      <SEO 
        title="Contact & Locations" 
        description="Get in touch with SMART Pvt Ltd. Consult our technical specialists via WhatsApp, phone, email, or visit our corporate office."
      />

      {/* Hero Header */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary-cyan text-xs font-bold uppercase tracking-wider mb-4">
          Direct Channels
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-[#0A1E3F] dark:text-white tracking-tight max-w-4xl mx-auto">
          Let's Start a <span className="gradient-text-blue">Conversation.</span>
        </h1>
        <p className="text-sm sm:text-base text-[#5B6E88] dark:text-text-muted max-w-2xl mx-auto mt-4 leading-relaxed">
          Whether you need an immediate demo, a quote for custom software, or advice on ERP implementation, our specialists are ready to help.
        </p>
      </section>

      {/* Contact Cards & Form Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Direct Channels Column */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* WhatsApp Card */}
            <div className="glass-card rounded-3xl p-6 border border-emerald-500/30 bg-navy-900/90 space-y-3">
              <div className="flex items-center justify-between">
                <span className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  <MessageCircle className="w-5 h-5" />
                </span>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  Fastest Response
                </span>
              </div>
              <h3 className="text-base font-bold text-[#0A1E3F] dark:text-white">Direct WhatsApp Support</h3>
              <p className="text-xs text-[#5B6E88] dark:text-text-muted">
                Connect directly with our solutions consultant for quick quotes and queries.
              </p>
              <a
                href={getDirectWhatsAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-glow-sm transition-all"
              >
                <MessageSquare className="w-3.5 h-3.5" /> Chat on WhatsApp ({company.contact.whatsappDisplay})
              </a>
            </div>

            {/* Phone & Email Card */}
            <div className="glass-card rounded-3xl p-6 border border-surface-border bg-navy-900/80 space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3 text-xs">
                  <Phone className="w-4 h-4 text-primary dark:text-primary-cyan shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[#5B6E88] dark:text-text-muted block text-[11px]">Direct Phone Line</span>
                    <strong className="text-[#0A1E3F] dark:text-white text-sm">{company.contact.phoneDisplay}</strong>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-xs">
                  <Mail className="w-4 h-4 text-primary dark:text-primary-electric shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[#5B6E88] dark:text-text-muted block text-[11px]">Official Email</span>
                    <strong className="text-[#0A1E3F] dark:text-white text-sm">{company.contact.email}</strong>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-xs">
                  <Clock className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[#5B6E88] dark:text-text-muted block text-[11px]">Business Operating Hours</span>
                    <strong className="text-[#0A1E3F] dark:text-white text-xs">{company.contact.businessHours}</strong>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Quick Message Form Column */}
          <div className="lg:col-span-7 glass-card rounded-3xl p-8 border border-surface-border bg-navy-900/90 shadow-2xl">
            {!submitted ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <h3 className="text-xl font-bold text-[#0A1E3F] dark:text-white">Send Us a Direct Message</h3>
                  <p className="text-xs text-[#5B6E88] dark:text-text-muted mt-1">
                    Fill out the form below and our team will get back to you within 2 business hours.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-[#29405E] dark:text-text-light mb-1">Your Name *</label>
                    <input
                      type="text" required placeholder="e.g. John Perera"
                      value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F8FC] dark:bg-navy-800 border border-[#C8D8EE] dark:border-surface-border text-[#0A1E3F] dark:text-white text-sm focus:outline-none focus:border-primary dark:focus:border-primary-electric"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#29405E] dark:text-text-light mb-1">Company / Organization</label>
                    <input
                      type="text" placeholder="Optional"
                      value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F8FC] dark:bg-navy-800 border border-[#C8D8EE] dark:border-surface-border text-[#0A1E3F] dark:text-white text-sm focus:outline-none focus:border-primary dark:focus:border-primary-electric"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#29405E] dark:text-text-light mb-1">Phone / WhatsApp *</label>
                    <input
                      type="tel" required placeholder="+94 77 000 0000"
                      value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F8FC] dark:bg-navy-800 border border-[#C8D8EE] dark:border-surface-border text-[#0A1E3F] dark:text-white text-sm focus:outline-none focus:border-primary dark:focus:border-primary-electric"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#29405E] dark:text-text-light mb-1">Email Address</label>
                    <input
                      type="email" placeholder="john@example.com"
                      value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F8FC] dark:bg-navy-800 border border-[#C8D8EE] dark:border-surface-border text-[#0A1E3F] dark:text-white text-sm focus:outline-none focus:border-primary dark:focus:border-primary-electric"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#29405E] dark:text-text-light mb-1">How can we help you? *</label>
                  <textarea
                    rows={4} required
                    placeholder="Tell us about your requirements, existing software, or timeline..."
                    value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className="w-full p-3.5 rounded-xl bg-[#F4F8FC] dark:bg-navy-800 border border-[#C8D8EE] dark:border-surface-border text-[#0A1E3F] dark:text-white text-sm focus:outline-none focus:border-primary dark:focus:border-primary-electric resize-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button type="submit" className="px-6 py-3 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary-hover shadow-glow-sm transition-all flex items-center gap-2">
                    <Send className="w-3.5 h-3.5" /> Send Message
                  </button>
                  <button type="button" onClick={onOpenQuote} className="text-xs font-semibold text-primary dark:text-primary-cyan hover:underline">
                    Or use 5-Step Quote Builder →
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center py-10 space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold text-[#0A1E3F] dark:text-white">Thank You, {form.name}!</h3>
                <p className="text-xs text-[#5B6E88] dark:text-text-muted max-w-sm mx-auto">
                  Your message has been safely recorded. A SMART team member will reach out shortly.
                </p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-[#29405E] dark:text-text-light bg-[#F0F6FF] dark:bg-surface-card hover:bg-[#E0EEFF] dark:hover:bg-surface-cardHover border border-[#C8D8EE] dark:border-surface-border"
                >
                  Send another message
                </button>
              </div>
            )}
          </div>

        </div>
      </section>

      {/* Branch Locations & Map */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#0A1E3F] dark:text-white">Our Branch Locations</h2>
          <p className="text-xs sm:text-sm text-[#5B6E88] dark:text-text-muted mt-1">Visit our offices for on-site meetings and consultations.</p>
        </div>
        <BranchMapSection />
      </section>

    </div>
  );
}
