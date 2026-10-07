import React from 'react';
import { company } from '../config/company';
import SEO from '../components/SEO';
import BranchMapSection from '../components/BranchMapSection';
import QuoteRequestForm from '../components/QuoteRequestForm';
import ErrorBoundary from '../components/ErrorBoundary';
import {
  Phone, Mail, MessageSquare, Clock, MessageCircle
} from 'lucide-react';

export default function ContactPage() {
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
                <span className="text-[12px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
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
                    <span className="text-[#5B6E88] dark:text-text-muted block text-[13px]">Direct Phone Line</span>
                    <strong className="text-[#0A1E3F] dark:text-white text-sm">{company.contact.phoneDisplay}</strong>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-xs">
                  <Mail className="w-4 h-4 text-primary dark:text-primary-electric shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[#5B6E88] dark:text-text-muted block text-[13px]">Official Email</span>
                    <strong className="text-[#0A1E3F] dark:text-white text-sm">{company.contact.email}</strong>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-xs">
                  <Clock className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[#5B6E88] dark:text-text-muted block text-[13px]">Business Operating Hours</span>
                    <strong className="text-[#0A1E3F] dark:text-white text-xs">{company.contact.businessHours}</strong>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Request Form Column — the ONE shared request form, wrapped so
              a crash can never blank the page */}
          <div className="lg:col-span-7 glass-card rounded-3xl p-8 border border-surface-border bg-navy-900/90 shadow-2xl">
            <div className="mb-5">
              <h3 className="text-xl font-bold text-[#0A1E3F] dark:text-white">Send Us a Direct Message</h3>
              <p className="text-xs text-[#5B6E88] dark:text-text-muted mt-1">
                Fill out the form below and our team will get back to you within 2 business hours.
              </p>
            </div>
            <ErrorBoundary variant="form">
              <QuoteRequestForm source="Contact Form" />
            </ErrorBoundary>
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
