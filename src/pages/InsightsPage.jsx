import React from 'react';
import { Link } from 'react-router-dom';
import { insights } from '../config/insights';
import SEO from '../components/SEO';
import { ArrowRight, Clock, BookOpen, Calendar } from 'lucide-react';

export default function InsightsPage() {
  return (
    <div className="pt-28 pb-20 space-y-16">
      <SEO 
        title="Insights & Tech Knowledge" 
        description="Thought leadership, ERP selection guides, website tips, and workflow automation strategies from SMART Pvt Ltd."
      />

      {/* Hero Header */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary-cyan text-xs font-bold uppercase tracking-wider mb-4">
          Knowledge Base
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight max-w-4xl mx-auto">
          Technology & Business <span className="gradient-text-blue">Insights.</span>
        </h1>
        <p className="text-sm sm:text-base text-text-muted max-w-2xl mx-auto mt-4 leading-relaxed">
          Practical articles on choosing business systems, automating workflows, and building a high-credibility digital brand.
        </p>
      </section>

      {/* Articles Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {insights.map((item) => (
            <div 
              key={item.id}
              className="glass-card rounded-3xl p-6 sm:p-7 glow-on-hover flex flex-col justify-between bg-navy-900/80 border border-surface-border group"
            >
              <div>
                <div className="flex items-center justify-between text-xs text-text-muted mb-4">
                  <span className="font-bold uppercase tracking-wider text-primary-cyan bg-cyan-500/10 px-2.5 py-0.5 rounded-full border border-cyan-500/20">
                    {item.category}
                  </span>
                  <span className="flex items-center gap-1 text-[11px]">
                    <Clock className="w-3 h-3 text-amber-400" />
                    {item.readTime}
                  </span>
                </div>

                <h2 className="text-lg font-bold text-white group-hover:text-primary-electric transition-colors leading-snug">
                  {item.title}
                </h2>
                <p className="text-xs text-text-muted mt-3 leading-relaxed line-clamp-3">
                  {item.summary}
                </p>
              </div>

              <div className="pt-6 mt-4 border-t border-surface-border/50 flex items-center justify-between">
                <span className="text-[11px] text-text-muted flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {item.date}
                </span>
                <Link
                  to={`/insights/${item.slug}`}
                  className="text-xs font-bold text-primary-electric group-hover:text-primary-cyan flex items-center gap-1 transition-colors"
                >
                  Read Article <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}

