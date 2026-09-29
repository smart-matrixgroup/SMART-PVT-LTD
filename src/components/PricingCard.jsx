import React from 'react';
import { Link } from 'react-router-dom';
import { Check, Sparkles, ArrowRight } from 'lucide-react';

export default function PricingCard({ tier, onOpenQuote }) {
  return (
    <div className={`glass-card rounded-3xl p-7 flex flex-col justify-between relative transition-all duration-300 ${
      tier.highlight 
        ? 'border-2 border-primary-electric/70 shadow-glow-md bg-navy-900/90 scale-100 lg:-translate-y-2' 
        : 'border border-surface-border bg-navy-900/80 hover:border-surface-borderHighlight'
    }`}>
      
      {/* Popular Badge */}
      {tier.badge && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="px-3.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider text-white bg-gradient-to-r from-primary to-primary-electric shadow-glow-sm flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-cyan-200" />
            {tier.badge}
          </span>
        </div>
      )}

      <div>
        <div className="mb-6">
          <span className="text-[11px] font-bold uppercase tracking-wider text-primary-cyan">
            {tier.category}
          </span>
          <h3 className="text-xl font-bold text-white mt-1">
            {tier.name}
          </h3>
          <p className="text-xs text-text-muted mt-2 leading-relaxed min-h-[36px]">
            {tier.description}
          </p>
        </div>

        {/* Price Tag */}
        <div className="py-4 my-2 border-y border-surface-border/60">
          <div className="flex items-baseline gap-1.5">
            {tier.currency && (
              <span className="text-xs font-bold text-text-muted">{tier.currency}</span>
            )}
            <span className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              {tier.price}
            </span>
          </div>
          <span className="text-[11px] text-text-muted font-medium mt-0.5 block">
            {tier.period}
          </span>
        </div>

        {/* Feature List */}
        <div className="space-y-3 py-4">
          <p className="text-xs font-bold uppercase tracking-wider text-text-light">
            Included Deliverables:
          </p>
          <ul className="space-y-2.5">
            {tier.features.map((feat, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-xs text-text-muted">
                <span className="p-0.5 rounded-full bg-primary/20 text-primary-cyan shrink-0 mt-0.5">
                  <Check className="w-3 h-3" />
                </span>
                <span className="text-text-light/90">{feat}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Action Button */}
      <div className="pt-6 border-t border-surface-border/50">
        <button
          onClick={() => onOpenQuote(tier.name)}
          className={`w-full py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            tier.highlight
              ? 'bg-gradient-to-r from-primary to-primary-electric text-white shadow-glow-sm hover:opacity-95'
              : 'bg-surface-card hover:bg-primary text-text-light hover:text-white border border-surface-border'
          }`}
        >
          {tier.ctaText} <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

    </div>
  );
}

