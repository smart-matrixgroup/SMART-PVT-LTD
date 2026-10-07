import React from 'react';
import { RequestModal } from './QuoteRequestForm';
import ErrorBoundary from './ErrorBoundary';

// ── ClientRequestForm ──────────────────────────────────────────────
// Thin wrapper around the ONE shared request form (QuoteRequestForm).
// This used to be a second, duplicate lead form with its own service
// list and payload shape; it now reuses the shared form so every
// website submission lands in the `leads` collection with the same
// schema, with `source` recording where it came from.
// (The old localStorage fallback was removed: leads must be saved to
// the database — if Firebase is not configured the shared form shows
// a clear WhatsApp/email error instead of silently dropping the lead.)

export default function ClientRequestForm({ isOpen, onClose }) {
  return (
    <ErrorBoundary variant="form">
      <RequestModal
        isOpen={isOpen}
        onClose={onClose}
        source="Get Started"
        eyebrow="Get Started"
        title="Tell us about your requirement"
        subtitle="Fill in your details and our team will get back to you within 2 business hours."
      />
    </ErrorBoundary>
  );
}
