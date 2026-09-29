import React, { useState } from 'react';
import { projects, projectCategories } from '../config/projects';
import SEO from '../components/SEO';
import ProjectCard from '../components/ProjectCard';

export default function ProjectsPage({ onOpenQuote }) {
  const [selectedCategory, setSelectedCategory] = useState('All');

  const filteredProjects = selectedCategory === 'All'
    ? projects
    : projects.filter(p => p.category === selectedCategory || (selectedCategory === 'ERP & POS' && (p.category === 'ERP' || p.category === 'POS' || p.category === 'ERP & POS')));

  return (
    <div className="pt-28 pb-20 space-y-16">
      <SEO 
        title="Projects & Case Studies" 
        description="Explore our delivered case studies across ERP & POS, portfolio websites, mobile apps, business automation engines, and AI document processors."
      />

      {/* Hero Header */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary-cyan text-xs font-bold uppercase tracking-wider mb-4">
          Verified Portfolio
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-[#0A1E3F] dark:text-white tracking-tight max-w-4xl mx-auto">
          Case Studies & <span className="gradient-text-blue">Delivered Systems.</span>
        </h1>
        <p className="text-sm sm:text-base text-[#5B6E88] dark:text-text-muted max-w-2xl mx-auto mt-4 leading-relaxed">
          Real business challenges solved through robust engineering, modern design systems, and measurable operational results.
        </p>

        {/* Category Filters */}
        <div className="flex items-center justify-center flex-wrap gap-2 mt-8">
          {projectCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                selectedCategory === cat
                  ? 'bg-primary text-white shadow-glow-sm'
                  : 'bg-[#F0F6FF] dark:bg-navy-900 text-[#3E526C] dark:text-text-muted hover:bg-primary hover:text-white border border-[#C8D8EE] dark:border-surface-border hover:border-primary dark:hover:border-surface-borderHighlight'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Projects Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </section>

      {/* Start Project Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 sm:p-10 rounded-3xl glass-card border border-surface-border bg-navy-900/90 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div>
            <h3 className="text-xl sm:text-2xl font-bold text-[#0A1E3F] dark:text-white">Have a project you want to build?</h3>
            <p className="text-xs sm:text-sm text-[#5B6E88] dark:text-text-muted mt-1">
              Let's analyze your requirement and prepare a milestone-based architecture and quote.
            </p>
          </div>
          <button
            onClick={() => onOpenQuote()}
            className="px-6 py-3 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary-hover shadow-glow-sm transition-all shrink-0"
          >
            Start Your Project
          </button>
        </div>
      </section>

    </div>
  );
}
