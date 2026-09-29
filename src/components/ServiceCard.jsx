import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, LayoutGrid, Code2, Globe, 
  Smartphone, Cpu, Sparkles, Calculator, 
  FileCheck, ShieldCheck, UserCheck 
} from 'lucide-react';

export default function ServiceCard({ service, onOpenQuote }) {
  const getIcon = (iconName) => {
    switch (iconName) {
      case 'LayoutGrid': return <LayoutGrid className="w-6 h-6 text-primary dark:text-primary-cyan" />;
      case 'Code2': return <Code2 className="w-6 h-6 text-primary dark:text-primary-electric" />;
      case 'UserCheck': return <UserCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />;
      case 'Globe': return <Globe className="w-6 h-6 text-primary" />;
      case 'Smartphone': return <Smartphone className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />;
      case 'Cpu': return <Cpu className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />;
      case 'Sparkles': return <Sparkles className="w-6 h-6 text-amber-600 dark:text-amber-400" />;
      case 'Calculator': return <Calculator className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />;
      case 'FileCheck': return <FileCheck className="w-6 h-6 text-blue-600 dark:text-blue-400" />;
      case 'ShieldCheck': return <ShieldCheck className="w-6 h-6 text-purple-600 dark:text-purple-400" />;
      default: return <Globe className="w-6 h-6 text-primary dark:text-primary-cyan" />;
    }
  };

  return (
    <div className="glass-card rounded-3xl p-6 sm:p-7 glow-on-hover flex flex-col justify-between group relative overflow-hidden bg-navy-900/80">
      
      {/* Glow highlight on top right */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[50px] rounded-full group-hover:bg-primary-cyan/20 transition-colors pointer-events-none" />

      <div>
        {/* Header: Icon & Badge */}
        <div className="flex items-center justify-between mb-5">
          <div className="p-3.5 rounded-2xl bg-[#EBF3FC] dark:bg-navy-800 border border-[#C8D8EE] dark:border-surface-border group-hover:border-primary/40 dark:group-hover:border-primary-cyan/40 group-hover:bg-primary/10 dark:group-hover:bg-primary/20 transition-all">
            {getIcon(service.icon)}
          </div>
          {service.badge && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-primary/10 text-primary dark:text-primary-cyan border border-primary/25">
              {service.badge}
            </span>
          )}
        </div>

        {/* Title & Subtitle */}
        <h3 className="text-lg sm:text-xl font-bold text-[#0A1E3F] dark:text-white group-hover:text-primary dark:group-hover:text-primary-electric transition-colors">
          {service.title}
        </h3>
        <p className="text-xs font-semibold text-primary/80 dark:text-primary-cyan/80 mt-1">
          {service.subtitle}
        </p>

        {/* Short Description */}
        <p className="text-xs text-[#5B6E88] dark:text-text-muted mt-3 leading-relaxed line-clamp-3">
          {service.shortDesc}
        </p>

        {/* Starting price tag */}
        <div className="mt-4 pt-3 border-t border-[#DCE6F2] dark:border-surface-border/60 flex items-baseline justify-between text-xs">
          <span className="text-[#5B6E88] dark:text-text-muted text-[11px]">Investment:</span>
          <span className="font-bold text-[#0A1E3F] dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
            {service.startingPrice}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-6 mt-2 flex items-center justify-between gap-3">
        <Link
          to={`/services/${service.slug}`}
          className="text-xs font-bold text-primary dark:text-primary-electric hover:text-primary-hover dark:hover:text-primary-cyan flex items-center gap-1.5 transition-colors group/link"
        >
          Explore Details <ArrowRight className="w-3.5 h-3.5 transform group-hover/link:translate-x-1 transition-transform" />
        </Link>
        <button
          onClick={() => onOpenQuote(service.title)}
          className="px-3 py-1.5 rounded-xl text-[11px] font-semibold text-[#29405E] dark:text-text-light hover:text-white bg-[#F0F6FF] dark:bg-surface-card hover:bg-primary border border-[#C8D8EE] dark:border-surface-border transition-colors"
        >
          Inquire
        </button>
      </div>

    </div>
  );
}
