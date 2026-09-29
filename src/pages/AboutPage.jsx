import React from 'react';
import { Link } from 'react-router-dom';
import { company } from '../config/company';
import SEO from '../components/SEO';
import ProcessTimeline from '../components/ProcessTimeline';
import { 
  Shield, CheckCircle2, Award, Target, 
  Lightbulb, Users, ArrowRight, HeartHandshake,
  Cpu, Layers, Sparkles
} from 'lucide-react';

export default function AboutPage({ onOpenQuote }) {
  return (
    <div className="relative overflow-hidden pt-28 pb-20 space-y-20">
      <SEO 
        title="About Us" 
        description="Learn about SMART Pvt Ltd - our philosophy, technology engineering, and comprehensive business solutions in Sri Lanka."
      />

      {/* Hero Header */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-full bg-[radial-gradient(circle_at_12%_18%,rgba(193,224,255,.52),transparent_25%),radial-gradient(circle_at_88%_25%,rgba(221,237,255,.8),transparent_28%)] dark:bg-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="relative inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary-cyan text-xs font-bold uppercase tracking-wider mb-4">
            Corporate Profile
          </div>
          <h1 className="relative text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight max-w-4xl mx-auto">
            Technology Engineered Around <span className="gradient-text-blue">Real Operations.</span>
          </h1>
          <p className="relative text-sm sm:text-base text-text-muted max-w-3xl mx-auto mt-6 leading-relaxed">
            {company.mission}
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          {[
            { icon: Users, value: 'Client-first', label: 'Every solution starts with listening' },
            { icon: Shield, value: 'Secure by design', label: 'Practical systems built to protect data' },
            { icon: Layers, value: 'One team', label: 'Technology, finance and operations together' },
            { icon: Award, value: 'Long-term', label: 'Support beyond the launch date' },
          ].map(({ icon: Icon, value, label }) => (
            <div key={value} className="smart-card rounded-2xl p-4 sm:p-5 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#EBF3FC] text-[#0066FF] dark:bg-primary/20 dark:text-primary-cyan"><Icon className="h-5 w-5" /></div>
              <p className="text-sm font-extrabold text-white">{value}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-text-muted">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Story & Vision */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          <div className="space-y-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Who We Are & What Drives Us
            </h2>
            <p className="text-sm text-text-muted leading-relaxed">
              SMART Pvt Ltd was established with a clear mission: to bridge the gap between technical software development and actual business management. Many companies receive software that looks flashy but fails to adapt to their real-world billing, inventory bottlenecks, or accounting compliance needs.
            </p>
            <p className="text-sm text-text-muted leading-relaxed">
              We design and implement custom systems, cloud ERPs, and automation pipelines that are inherently practical, secure, and built to scale alongside your organization's growth.
            </p>

            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="p-4 rounded-2xl bg-navy-800/80 border border-surface-border">
                <Target className="w-6 h-6 text-primary-cyan mb-2" />
                <h4 className="text-sm font-bold text-white">Our Vision</h4>
                <p className="text-xs text-text-muted mt-1">
                  To be the most trusted technology and business automation partner for enterprises and entrepreneurs.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-navy-800/80 border border-surface-border">
                <Lightbulb className="w-6 h-6 text-primary-electric mb-2" />
                <h4 className="text-sm font-bold text-white">Our Approach</h4>
                <p className="text-xs text-text-muted mt-1">
                  Understand first, blueprint carefully, code cleanly, deploy securely, and support long-term.
                </p>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-3xl p-8 border border-surface-borderHighlight/40 shadow-2xl bg-gradient-to-br from-navy-900 to-surface-card space-y-6">
            <h3 className="text-xl font-bold text-white">The SMART Commitment</h3>
            <ul className="space-y-4 text-xs text-text-light">
              {[
                { title: "No Invented Claims", desc: "We pride ourselves on transparent scopes, verified case studies, and honest pricing." },
                { title: "Enterprise Grade Reliability", desc: "Built with modern frameworks (React, PostgreSQL, Spring Boot, Firebase) and zero bloat." },
                { title: "Unified Service Suite", desc: "From domain setup and mobile apps to IRD tax schedules and independent audits under one roof." },
                { title: "Complete Data Privacy", desc: "Your proprietary customer data and financial records are never shared or compromised." }
              ].map((item, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="p-1 rounded-lg bg-primary/20 text-primary-cyan shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </span>
                  <div>
                    <strong className="text-white block">{item.title}</strong>
                    <span className="text-text-muted">{item.desc}</span>
                  </div>
                </li>
              ))}
            </ul>

            <div className="pt-4 border-t border-surface-border flex items-center justify-between">
              <span className="text-xs text-text-muted">Want to discuss your requirements?</span>
              <button
                onClick={onOpenQuote}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary-hover shadow-glow-sm"
              >
                Schedule Consultation
              </button>
            </div>
          </div>

        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { icon: HeartHandshake, title: 'Built around people', text: 'We make technology approachable for owners, managers and frontline teams—not just technical teams.' },
            { icon: Cpu, title: 'Practical engineering', text: 'Every workflow is designed around the day-to-day work that keeps a business moving.' },
            { icon: Sparkles, title: 'Clear partnership', text: 'Honest communication, transparent scopes and support that stays with you as your business grows.' },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="smart-card rounded-3xl p-6">
              <div className="mb-4 inline-flex rounded-2xl bg-[#EBF3FC] p-3 text-[#0066FF] dark:bg-primary/20 dark:text-primary-cyan"><Icon className="h-5 w-5" /></div>
              <h3 className="text-lg font-bold text-white">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 9-Step Transformation Process */}
      <section className="bg-navy-950 py-16 border-y border-surface-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Our 9-Step Delivery Standard
            </h2>
            <p className="text-xs sm:text-sm text-text-muted mt-2">
              How we take your idea from initial requirement discovery to production deployment and ongoing support.
            </p>
          </div>

          <ProcessTimeline />
        </div>
      </section>

    </div>
  );
}
