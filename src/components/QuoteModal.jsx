import React from 'react';
import { RequestModal } from './QuoteRequestForm';
import ErrorBoundary from './ErrorBoundary';

// ── QuoteModal ─────────────────────────────────────────────────────
// Thin wrapper around the ONE shared request form (QuoteRequestForm).
//
// History: this used to be a separate 5-step wizard. A conditional
// return above its hooks once crashed React ("more hooks than previous
// render") and blanked the whole website when "Get Quote" was clicked.
// All duplicate forms are now unified into QuoteRequestForm, and this
// modal is wrapped in an ErrorBoundary so a form crash can never blank
// the page again.

export default function QuoteModal({ isOpen, onClose, initialService }) {
  return (
    <ErrorBoundary variant="form">
      <RequestModal
        isOpen={isOpen}
        onClose={onClose}
        source="Quote Request"
        eyebrow="Get a Quote"
        title="Request a Quote"
        subtitle="Tell us what you need — our team replies within 2 business hours."
        initialService={initialService}
      />
    </ErrorBoundary>
  );
}
