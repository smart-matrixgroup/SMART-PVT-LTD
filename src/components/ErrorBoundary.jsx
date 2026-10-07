import React from 'react';
import { company } from '../config/company';

// ── ErrorBoundary ──────────────────────────────────────────────────
// Guarantees a crash never shows a blank page.
//
//  variant="form"    → friendly inline panel (used around every form /
//                      modal instance) with retry + WhatsApp fallback.
//  default (page)    → full-page fallback with Reload / Homepage actions
//                      (used at the app root in App.jsx).

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || String(error) };
  }

  componentDidCatch(error, info) {
    // Surface for debugging without breaking the user experience.
    console.error('[SMART] ErrorBoundary caught:', error, info);
  }

  handleRetry = () => this.setState({ hasError: false, message: '' });

  render() {
    if (!this.state.hasError) return this.props.children;

    // ── Form variant: inline, keeps the rest of the page usable ──
    if (this.props.variant === 'form') {
      const wa = `https://wa.me/${company.contact.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
        'Hi SMART Pvt Ltd, the form on your website showed an error so I am contacting you here.'
      )}`;
      return (
        <div className="p-6 rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-center space-y-3">
          <p className="text-sm font-bold text-red-600 dark:text-red-400">
            Something went wrong with this form.
          </p>
          <p className="text-xs text-[#5B6E88] dark:text-text-muted leading-relaxed">
            The rest of the page is unaffected and nothing was lost. You can retry,
            or reach us directly — we reply within 2 business hours.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-1">
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary-hover transition-all"
            >
              Try again
            </button>
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100 transition-all"
            >
              WhatsApp us instead
            </a>
          </div>
        </div>
      );
    }

    // ── Page variant: full-page fallback (never a blank screen) ──
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6 bg-white dark:bg-navy-950">
        <div className="max-w-md text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 flex items-center justify-center mx-auto text-2xl font-extrabold">
            !
          </div>
          <h1 className="text-xl font-extrabold text-[#0A1E3F] dark:text-white">
            Something went wrong
          </h1>
          <p className="text-xs text-[#5B6E88] dark:text-text-muted leading-relaxed">
            An unexpected error occurred while loading this page. Reloading usually
            fixes it — or head back to the homepage and continue browsing.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-1">
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary-hover transition-all"
            >
              Reload page
            </button>
            <button
              onClick={() => { window.location.href = '/'; }}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-[#29405E] dark:text-text-light bg-[#F0F6FF] dark:bg-navy-800 hover:bg-[#E0EEFF] dark:hover:bg-navy-700 border border-[#C8D8EE] dark:border-surface-border transition-colors"
            >
              Go to homepage
            </button>
          </div>
        </div>
      </div>
    );
  }
}
