import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { insights } from '../config/insights';
import SEO from '../components/SEO';
import { ArrowLeft, Clock, Calendar, Sparkles } from 'lucide-react';

export default function InsightDetailPage({ onOpenQuote }) {
  const { slug } = useParams();
  const article = insights.find(a => a.slug === slug);

  if (!article) {
    return <Navigate to="/insights" replace />;
  }

  return (
    <div className="pt-28 pb-20 space-y-16">
      <SEO 
        title={article.title} 
        description={article.summary}
      />

      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Back Link */}
        <Link 
          to="/insights" 
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-primary-cyan transition-colors mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to insights
        </Link>

        {/* Article Container */}
        <article className="glass-card rounded-3xl p-8 sm:p-12 border border-surface-border bg-navy-900/90 space-y-8">
          
          {/* Header */}
          <div className="space-y-4 border-b border-surface-border pb-6">
            <div className="flex items-center gap-3 text-xs">
              <span className="font-bold uppercase tracking-wider text-primary-cyan bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20">
                {article.category}
              </span>
              <span className="text-text-muted flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> {article.date}
              </span>
              <span className="text-text-muted">•</span>
              <span className="text-text-muted flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" /> {article.readTime}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight">
              {article.title}
            </h1>
          </div>

          {/* Body Paragraphs */}
          <div className="space-y-4 text-sm sm:text-base text-text-light/90 leading-relaxed font-normal">
            {article.content.map((p, i) => (
              <p key={i} className="leading-relaxed">
                {p}
              </p>
            ))}
          </div>

          {/* CTA Box */}
          <div className="pt-8 border-t border-surface-border p-6 rounded-2xl bg-navy-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-white">Ready to implement this for your business?</h4>
              <p className="text-xs text-text-muted mt-0.5">Let's talk with our technical consultants today.</p>
            </div>
            <button
              onClick={() => onOpenQuote()}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary-hover shadow-glow-sm transition-all shrink-0"
            >
              Get Free Consultation
            </button>
          </div>

        </article>
      </section>

    </div>
  );
}

