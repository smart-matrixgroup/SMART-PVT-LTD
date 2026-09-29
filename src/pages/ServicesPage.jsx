import React, { useState } from 'react';
import { services } from '../config/services';
import SEO from '../components/SEO';
import ServiceCard from '../components/ServiceCard';
import { LayoutGrid, Code2, Globe, Cpu, Calculator, Sparkles, Filter } from 'lucide-react';

export default function ServicesPage({ onOpenQuote }) {
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = [
    'All',
    'Software & Cloud',
    'Web & Mobile',
    'Automation & AI',
    'Finance & Compliance'
  ];

  const filteredServices = selectedCategory === 'All' 
    ? services 
    : services.filter(s => s.category === selectedCategory);

  return (
    <div className="pt-28 pb-20 space-y-16">
      <SEO 
        title="Services & Solutions" 
        description="Explore SMART Pvt Ltd's full suite of 10 core services: ERP & POS, custom software, websites, mobile apps, automation, AI, accounting, tax, and audit."
      />

      {/* Hero Header */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary-cyan text-xs font-bold uppercase tracking-wider mb-4">
          Complete Capabilities
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight max-w-4xl mx-auto">
          Intelligent Technology & <span className="gradient-text-blue">Business Services.</span>
        </h1>
        <p className="text-sm sm:text-base text-text-muted max-w-2xl mx-auto mt-4 leading-relaxed">
          From quick-start portfolio websites to full-scale multi-branch enterprise ERPs and tax compliance schedules, discover our end-to-end solutions.
        </p>

        {/* Category Filters */}
        <div className="flex items-center justify-center flex-wrap gap-2 mt-8">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                selectedCategory === cat
                  ? 'bg-primary text-white shadow-glow-sm'
                  : 'bg-navy-900 text-text-muted hover:text-white border border-surface-border hover:border-surface-borderHighlight'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Services Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map((service) => (
            <ServiceCard 
              key={service.id} 
              service={service} 
              onOpenQuote={onOpenQuote}
            />
          ))}
        </div>
      </section>

      {/* Custom Requirement Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 sm:p-10 rounded-3xl glass-card border border-surface-borderHighlight/30 bg-gradient-to-r from-navy-900 via-surface-card to-navy-900 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <span className="text-xs font-bold uppercase tracking-wider text-primary-cyan">
              Need a Custom Solution?
            </span>
            <h3 className="text-xl sm:text-2xl font-bold text-white">
              Don't see your exact requirement listed?
            </h3>
            <p className="text-xs sm:text-sm text-text-muted max-w-xl">
              We specialize in tailor-made software architecture, custom database designs, and bespoke business automations.
            </p>
          </div>
          <button
            onClick={() => onOpenQuote("Custom Requirement")}
            className="px-6 py-3 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary-hover shadow-glow-sm transition-all shrink-0"
          >
            Discuss Custom Scope
          </button>
        </div>
      </section>

    </div>
  );
}

