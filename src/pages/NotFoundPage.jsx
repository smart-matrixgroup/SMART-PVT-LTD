import React from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import { ArrowLeft, Home, Sparkles } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="pt-32 pb-20 min-h-[75vh] flex items-center justify-center">
      <SEO title="Page Not Found (404)" />

      <div className="max-w-md mx-auto px-4 text-center space-y-6">
        <div className="inline-flex p-4 rounded-3xl bg-primary/20 text-primary-cyan border border-primary/30">
          <Sparkles className="w-12 h-12" />
        </div>

        <h1 className="text-5xl font-extrabold text-white">404</h1>
        <h2 className="text-xl font-bold text-text-light">Page Not Found</h2>
        <p className="text-xs text-text-muted">
          The link or page you are looking for may have been relocated or is under construction.
        </p>

        <div className="pt-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary-hover shadow-glow-sm transition-all"
          >
            <Home className="w-4 h-4" /> Return to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}

