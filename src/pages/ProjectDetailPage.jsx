import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { projects } from '../config/projects';
import SEO from '../components/SEO';
import { 
  ArrowLeft, CheckCircle2, Layers, Cpu, 
  ExternalLink, Sparkles, Trophy, ArrowRight 
} from 'lucide-react';

export default function ProjectDetailPage({ onOpenQuote }) {
  const { slug } = useParams();
  const project = projects.find(p => p.slug === slug);

  if (!project) {
    return <Navigate to="/projects" replace />;
  }

  return (
    <div className="pt-28 pb-20 space-y-16">
      <SEO 
        title={project.name} 
        description={project.tagline}
      />

      {/* Header & Meta */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link 
          to="/projects" 
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-primary-cyan transition-colors mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to case studies
        </Link>

        <div className="glass-card rounded-3xl p-8 sm:p-12 border border-surface-borderHighlight/40 bg-gradient-to-br from-navy-900 via-surface-card to-navy-900 relative overflow-hidden">
          <div className="max-w-3xl space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-primary/20 text-primary-cyan border border-primary/30">
                {project.category}
              </span>
              <span className="text-xs font-medium px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {project.status}
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight">
              {project.name}
            </h1>
            <p className="text-sm font-semibold text-primary-electric">
              Client Profile: {project.clientType}
            </p>
            <p className="text-base text-text-muted leading-relaxed">
              {project.tagline}
            </p>

            {/* Tech Stack Pills */}
            <div className="pt-2 flex flex-wrap gap-2">
              {project.techStack.map((tech) => (
                <span key={tech} className="px-3 py-1 rounded-lg bg-navy-800 text-xs font-medium text-white border border-surface-border">
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Challenge, Solution & Results */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          <div className="lg:col-span-8 space-y-8">
            
            {/* The Challenge */}
            <div className="glass-card rounded-3xl p-8 border border-surface-border bg-navy-900/80 space-y-3">
              <h3 className="text-lg font-bold text-amber-400">The Challenge & Operational Problem</h3>
              <p className="text-sm text-text-muted leading-relaxed">
                {project.challenge}
              </p>
            </div>

            {/* The Solution */}
            <div className="glass-card rounded-3xl p-8 border border-surface-border bg-navy-900/80 space-y-3">
              <h3 className="text-lg font-bold text-primary-cyan">The SMART Engineered Solution</h3>
              <p className="text-sm text-text-muted leading-relaxed">
                {project.solution}
              </p>
            </div>

            {/* Modules Implemented */}
            {project.modules && (
              <div className="glass-card rounded-3xl p-8 border border-surface-border bg-navy-900/80 space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-primary-electric" /> Modules & Features Implemented
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {project.modules.map((mod, i) => (
                    <div key={i} className="p-3 rounded-xl bg-navy-800 border border-surface-border/60 text-xs font-semibold text-text-light flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-primary-cyan shrink-0" />
                      <span>{mod}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Results Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            <div className="glass-card rounded-3xl p-7 border border-primary/30 bg-navy-900/90 shadow-glow-sm space-y-5">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <Trophy className="w-5 h-5" />
                <span>Measurable Results</span>
              </div>
              <ul className="space-y-3 text-xs text-text-light">
                {project.results.map((res, i) => (
                  <li key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-navy-800/80 border border-surface-border">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{res}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => onOpenQuote(project.name)}
                className="w-full py-3 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary-hover shadow-glow-sm transition-all"
              >
                Request Similar System
              </button>
            </div>
          </div>

        </div>
      </section>

    </div>
  );
}

