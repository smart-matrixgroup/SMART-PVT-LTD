import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CheckCircle2, Layers } from 'lucide-react';

export default function ProjectCard({ project }) {
  return (
    <div className="glass-card rounded-3xl p-6 sm:p-7 glow-on-hover flex flex-col justify-between group bg-navy-900/80 border border-surface-border relative">
      
      <div>
        {/* Category & Status */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <span className="text-[11px] font-bold uppercase tracking-wider text-primary-cyan bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/20">
            {project.category}
          </span>
          <span className="text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            {project.status}
          </span>
        </div>

        {/* Name */}
        <h3 className="text-lg sm:text-xl font-bold text-white group-hover:text-primary-electric transition-colors">
          {project.name}
        </h3>
        <p className="text-xs text-text-muted mt-1 font-medium">
          {project.clientType}
        </p>

        {/* Tagline */}
        <p className="text-xs text-text-light/90 mt-3 leading-relaxed">
          {project.tagline}
        </p>

        {/* Key Metrics / Results */}
        {project.results && project.results.length > 0 && (
          <div className="mt-4 pt-3 border-t border-surface-border/60 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
              Key Result:
            </span>
            <div className="flex items-start gap-1.5 text-xs text-text-muted">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span className="text-white text-[11px]">{project.results[0]}</span>
            </div>
          </div>
        )}

        {/* Tech Stack Badges */}
        <div className="flex flex-wrap gap-1.5 mt-4">
          {project.techStack.map((tech) => (
            <span 
              key={tech}
              className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-navy-800 text-text-muted border border-surface-border/60"
            >
              {tech}
            </span>
          ))}
        </div>
      </div>

      {/* View Case Study Link */}
      <div className="pt-6 mt-2 border-t border-surface-border/40 flex items-center justify-between">
        <Link
          to={`/projects/${project.slug}`}
          className="text-xs font-bold text-primary-electric group-hover:text-primary-cyan flex items-center gap-1.5 transition-colors"
        >
          View Case Study <ArrowUpRight className="w-4 h-4 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </Link>
        <span className="text-[11px] text-text-muted">Verified Solution</span>
      </div>

    </div>
  );
}

