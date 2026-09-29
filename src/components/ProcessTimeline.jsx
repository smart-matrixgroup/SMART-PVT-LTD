import React from 'react';
import { company } from '../config/company';
import { CheckCircle2 } from 'lucide-react';

export default function ProcessTimeline() {
  return (
    <div className="py-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
        {company.processSteps.map((item, idx) => (
          <div 
            key={item.step}
            className="glass-card rounded-2xl p-5 border border-[#DCE6F2] dark:border-navy-700 hover:border-primary/40 dark:hover:border-primary-cyan/40 transition-all group bg-white dark:bg-navy-800 relative"
          >
            {/* Step Number Badge */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-extrabold px-2.5 py-1 rounded-lg bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-cyan border border-primary/30 font-mono">
                STAGE {item.step}
              </span>
              <span className="text-[#5B6E88]/60 dark:text-text-muted/40 font-mono text-xs">0{idx + 1}/09</span>
            </div>

            <h4 className="text-base font-bold text-[#0A1E3F] dark:text-white group-hover:text-primary dark:group-hover:text-primary-electric transition-colors">
              {item.title}
            </h4>
            <p className="text-xs text-[#5B6E88] dark:text-text-muted mt-2 leading-relaxed">
              {item.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
