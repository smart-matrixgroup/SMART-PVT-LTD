import React from 'react';
import { solutions } from '../config/solutions';
import SEO from '../components/SEO';
import { CheckCircle2, ArrowRight, Sparkles, Utensils, ShoppingBag, Building2, Briefcase } from 'lucide-react';

export default function SolutionsPage({ onOpenQuote, onOpenClientRequest }) {
  const getSolutionIcon = (id) => {
    switch (id) {
      case 'restaurants': return <Utensils className="w-6 h-6 text-amber-500 dark:text-amber-400" />;
      case 'retail': return <ShoppingBag className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />;
      case 'sme': return <Building2 className="w-6 h-6 text-primary dark:text-primary-cyan" />;
      case 'professional-services': return <Briefcase className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />;
      default: return <Sparkles className="w-6 h-6 text-primary dark:text-primary-electric" />;
    }
  };

  return (
    <div className="pt-28 pb-20 space-y-20">
      <SEO 
        title="Industry Solutions" 
        description="Tailored technology and business ecosystems engineered specifically for Restaurants, Supermarkets, SMEs, and Accounting / Professional firms."
      />

      {/* Hero Header */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary-cyan text-xs font-bold uppercase tracking-wider mb-4">
          Tailored Stacks
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-[#0A1E3F] dark:text-white tracking-tight max-w-4xl mx-auto">
          Solutions Built for <span className="gradient-text-blue">Your Industry.</span>
        </h1>
        <p className="text-sm sm:text-base text-[#5B6E88] dark:text-text-muted max-w-2xl mx-auto mt-4 leading-relaxed">
          One size never fits all. Explore how SMART Pvt Ltd packages software, hardware integrations, and compliance tools specifically for your sector.
        </p>
      </section>

      {/* Deep-Dive Solution Cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {solutions.map((sol, idx) => (
          <div 
            key={sol.id}
            id={sol.slug}
            className="glass-card rounded-3xl p-8 sm:p-10 border border-surface-border bg-navy-900/90 glow-on-hover"
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Left Column */}
              <div className="lg:col-span-5 space-y-4">

                {/* Icon Box */}
                <div className="p-3.5 rounded-2xl bg-[#EBF3FC] dark:bg-navy-800 border border-[#C8D8EE] dark:border-surface-border inline-block">
                  {getSolutionIcon(sol.id)}
                </div>

                {/* Title */}
                <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0A1E3F] dark:text-white">
                  {sol.title}
                </h2>

                {/* Headline */}
                <p className="text-xs sm:text-sm font-semibold text-primary dark:text-primary-cyan">
                  {sol.headline}
                </p>

                {/* Short Description */}
                <p className="text-xs sm:text-sm text-[#5B6E88] dark:text-text-muted leading-relaxed">
                  {sol.shortDesc}
                </p>

                {/* Recommended Stack Box */}
                <div className="p-4 rounded-2xl bg-[#F0F6FF] dark:bg-navy-800/80 border border-[#C8D8EE] dark:border-surface-border space-y-2">
                  <span className="text-[12px] font-bold uppercase tracking-wider text-[#29405E] dark:text-text-light">
                    Recommended Tech Stack:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {sol.recommendedStack.map((st, i) => (
                      <span key={i} className="text-[13px] font-medium px-2.5 py-1 rounded-lg bg-[#E0EEFF] dark:bg-navy-700 text-primary dark:text-primary-cyan border border-primary/20">
                        {st}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => onOpenClientRequest()}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary-hover shadow-glow-sm transition-all"
                  >
                    Build Solution for My Business
                  </button>
                </div>
              </div>

              {/* Right Column: Features & Solved Challenges */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* Solved Challenges */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Industry Bottlenecks Solved:
                  </h4>
                  <ul className="space-y-1.5 text-xs text-[#5B6E88] dark:text-text-muted">
                    {sol.keyChallenges.map((ch, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-red-500 dark:text-red-400 font-bold">•</span>
                        <span>{ch}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Key Features Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  {sol.features.map((feat, i) => (
                    <div key={i} className="p-4 rounded-2xl bg-[#F4F8FC] dark:bg-navy-800/50 border border-[#DCE6F2] dark:border-surface-border/60 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-[#0A1E3F] dark:text-white text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>{feat.title}</span>
                      </div>
                      <p className="text-[13px] text-[#5B6E88] dark:text-text-muted leading-relaxed pl-5">
                        {feat.desc}
                      </p>
                    </div>
                  ))}
                </div>

              </div>

            </div>
          </div>
        ))}
      </section>

    </div>
  );
}
