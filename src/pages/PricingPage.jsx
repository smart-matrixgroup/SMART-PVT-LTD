import React from 'react';
import { pricingTiers, addonServices } from '../config/pricing';
import SEO from '../components/SEO';
import PricingCard from '../components/PricingCard';
import FAQAccordion from '../components/FAQAccordion';
import { Sparkles, ShieldCheck, CheckCircle2, HelpCircle } from 'lucide-react';

export default function PricingPage({ onOpenQuote, onOpenClientRequest }) {
  return (
    <div className="pt-28 pb-20 space-y-20">
      <SEO 
        title="Transparent Pricing & Packages" 
        description="Clear, honest pricing for portfolio websites (from LKR 15,000), corporate web platforms, SMART ERP, and bespoke software systems."
      />

      {/* Hero Header */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary-cyan text-xs font-bold uppercase tracking-wider mb-4">
          Transparent Investment
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-[#0A1E3F] dark:text-white tracking-tight max-w-4xl mx-auto">
          Honest, Value-Driven <span className="gradient-text-blue">Pricing Structure.</span>
        </h1>
        <p className="text-sm sm:text-base text-[#5B6E88] dark:text-text-muted max-w-2xl mx-auto mt-4 leading-relaxed">
          No hidden fees, no unnecessary bloat. Fixed baseline rates for personal sites and customized milestone quotations for enterprise systems.
        </p>
      </section>

      {/* 4 Pricing Cards Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch pt-6">
          {pricingTiers.map((tier) => (
            <PricingCard 
              key={tier.id} 
              tier={tier} 
              onOpenQuote={onOpenQuote}
            />
          ))}
        </div>
      </section>

      {/* Add-ons & Professional Services Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="glass-card rounded-3xl p-8 sm:p-10 border border-surface-border bg-navy-900/90 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-[#0A1E3F] dark:text-white">Add-On & Professional Support Services</h3>
              <p className="text-xs text-[#5B6E88] dark:text-text-muted mt-1">
                Optional cloud, domain, and accounting compliance services available with any package.
              </p>
            </div>
            <button
              onClick={() => onOpenQuote("Add-On Services")}
              className="px-4 py-2 rounded-xl text-xs font-bold text-primary-cyan bg-primary/20 hover:bg-primary/30 border border-primary/30 self-start sm:self-auto"
            >
              Inquire Add-ons
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {addonServices.map((add, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-[#F0F6FF] dark:bg-navy-800/60 border border-[#C8D8EE] dark:border-surface-border/60 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#29405E] dark:text-text-light">{add.name}</span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 shrink-0">{add.price}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing FAQs */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#0A1E3F] dark:text-white">
            Pricing & Payment FAQs
          </h2>
        </div>
        <FAQAccordion items={[
          { q: "Are there any hidden recurring fees for the LKR 15,000 Portfolio Website?", a: "No. We deploy portfolio websites on Firebase Hosting which has a generous zero-cost free tier. The only recurring cost you need to maintain is your custom domain name registration (e.g., .com or .lk), which is paid annually." },
          { q: "How are enterprise software and ERP projects billed?", a: "Enterprise projects are billed in structured milestones: Initial Discovery & Blueprint Deposit, UI/UX & Staging Milestone, Beta QA Testing Milestone, and Final Production Handover." },
          { q: "Do you offer post-launch maintenance packages?", a: "Yes. All our custom software packages include a warranty bug-fixing period, followed by optional monthly or annual SLA maintenance plans." }
        ]} />
      </section>

    </div>
  );
}

