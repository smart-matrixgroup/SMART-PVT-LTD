import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { services } from '../config/services';
import { company } from '../config/company';
import SEO from '../components/SEO';
import FAQAccordion from '../components/FAQAccordion';
import { 
  CheckCircle2, ArrowRight, ArrowLeft, Sparkles, 
  MessageSquare, Clock, ShieldCheck, DollarSign,
  HelpCircle, Layers
} from 'lucide-react';

export default function ServiceDetailPage({ onOpenQuote }) {
  const { slug } = useParams();
  const service = services.find(s => s.slug === slug);

  if (!service) {
    return <Navigate to="/services" replace />;
  }

  const relatedServices = services.filter(s => s.slug !== slug).slice(0, 3);

  const getWhatsAppServiceUrl = () => {
    const text = `Hi SMART Pvt Ltd, I am interested in your ${service.title} service.`;
    return `https://wa.me/${company.contact.whatsapp.replace('+', '')}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="pt-28 pb-20 space-y-16">
      <SEO 
        title={service.title} 
        description={service.shortDesc}
      />

      {/* 1. HERO SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Back Link */}
        <Link 
          to="/services" 
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-primary-cyan transition-colors mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to all services
        </Link>

        <div className="glass-card rounded-3xl p-8 sm:p-12 border border-surface-borderHighlight/40 bg-gradient-to-br from-navy-900 via-surface-card to-navy-900 relative overflow-hidden">
          
          <div className="max-w-3xl space-y-5 relative z-10">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-primary/20 text-primary-cyan border border-primary/30">
                {service.category}
              </span>
              {service.badge && (
                <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {service.badge}
                </span>
              )}
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight">
              {service.title}
            </h1>
            <p className="text-base sm:text-lg font-semibold text-primary-electric">
              {service.subtitle}
            </p>
            <p className="text-sm sm:text-base text-text-muted leading-relaxed">
              {service.overview}
            </p>

            {/* Quick Pricing & Timeline Badges */}
            <div className="pt-2 flex flex-wrap items-center gap-4 text-xs">
              <div className="p-3 rounded-xl bg-navy-800 border border-surface-border flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <div>
                  <span className="text-text-muted block text-[10px]">Starting Investment</span>
                  <strong className="text-white">{service.startingPrice}</strong>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-navy-800 border border-surface-border flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <div>
                  <span className="text-text-muted block text-[10px]">Estimated Timeline</span>
                  <strong className="text-white">{service.timeline}</strong>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={() => onOpenQuote(service.title)}
                className="px-6 py-3 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary-hover shadow-glow-sm transition-all"
              >
                Request Quotation & Scope
              </button>
              <a
                href={getWhatsAppServiceUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-3 rounded-xl text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 flex items-center gap-2 transition-all"
              >
                <MessageSquare className="w-4 h-4" />
                Quick Chat on WhatsApp
              </a>
            </div>
          </div>

        </div>
      </section>

      {/* 2. CORE FEATURES & CAPABILITIES */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            Key Features & Functional Capabilities
          </h2>
          <p className="text-xs sm:text-sm text-text-muted mt-2">
            Every component is engineered for reliability, security, and measurable operational value.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {service.features.map((feat, idx) => (
            <div 
              key={idx}
              className="glass-card rounded-2xl p-6 border border-surface-border hover:border-primary-cyan/40 transition-all bg-navy-900/80"
            >
              <div className="flex items-start gap-3.5">
                <span className="p-2 rounded-xl bg-primary/20 text-primary-cyan border border-primary/30 shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-white">{feat.name}</h3>
                  <p className="text-xs text-text-muted mt-1.5 leading-relaxed">{feat.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. DELIVERABLES & PRICING CONTEXT */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Deliverables */}
          <div className="lg:col-span-7 glass-card rounded-3xl p-8 border border-surface-border bg-navy-900/90 space-y-6">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary-cyan" />
              What You Receive (Deliverables)
            </h3>
            <ul className="space-y-3 text-xs text-text-light">
              {service.deliverables.map((item, idx) => (
                <li key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-navy-800/60 border border-surface-border/50">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Pricing & Scope Guide */}
          <div className="lg:col-span-5 glass-card rounded-3xl p-8 border border-surface-border bg-navy-900/90 space-y-5">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary-electric" />
              Pricing & Scope Guidelines
            </h3>
            
            <div className="p-4 rounded-2xl bg-navy-800 border border-surface-border space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-text-muted">Pricing Baseline:</span>
                <span className="text-base font-bold text-emerald-400">{service.startingPrice}</span>
              </div>
              <p className="text-[11px] text-text-muted leading-relaxed">
                {service.priceNote}
              </p>
            </div>

            <div className="text-xs text-text-muted space-y-2">
              <p className="font-semibold text-white">What Factors Affect Final Cost?</p>
              <ul className="list-disc list-inside space-y-1 text-[11px]">
                <li>Number of custom workflow roles & approval levels</li>
                <li>Third-party API connectors and hardware integrations</li>
                <li>Initial data migration volume (items, past ledgers)</li>
                <li>On-site vs. remote training and dedicated SLA tier</li>
              </ul>
            </div>

            <button
              onClick={() => onOpenQuote(service.title)}
              className="w-full py-3 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary-hover shadow-glow-sm transition-all"
            >
              Get Itemized Quotation
            </button>
          </div>

        </div>
      </section>

      {/* 4. SERVICE SPECIFIC FAQS */}
      {service.faqs && service.faqs.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Frequently Asked Questions
            </h2>
            <p className="text-xs sm:text-sm text-text-muted mt-1">
              Common questions regarding {service.title}
            </p>
          </div>
          <FAQAccordion items={service.faqs} />
        </section>
      )}

      {/* 5. RELATED SERVICES */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 border-t border-surface-border">
        <h3 className="text-lg font-bold text-white mb-6">Explore Related Solutions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {relatedServices.map((rel) => (
            <Link
              key={rel.id}
              to={`/services/${rel.slug}`}
              className="p-5 rounded-2xl glass-card border border-surface-border hover:border-primary-cyan/50 transition-all group bg-navy-900/80"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary-cyan">
                {rel.category}
              </span>
              <h4 className="text-sm font-bold text-white group-hover:text-primary-electric transition-colors mt-1">
                {rel.title}
              </h4>
              <p className="text-xs text-text-muted mt-1 line-clamp-2">
                {rel.shortDesc}
              </p>
            </Link>
          ))}
        </div>
      </section>

    </div>
  );
}

