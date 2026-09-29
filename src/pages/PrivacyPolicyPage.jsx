import React from 'react';
import SEO from '../components/SEO';
import { ShieldCheck } from 'lucide-react';

export default function PrivacyPolicyPage() {
  return (
    <div className="pt-28 pb-20">
      <SEO 
        title="Privacy Policy" 
        description="SMART Pvt Ltd corporate privacy policy regarding client data protection, confidentiality, and platform security."
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="glass-card rounded-3xl p-8 sm:p-12 border border-surface-border bg-navy-900/90 space-y-6">
          
          <div className="border-b border-surface-border pb-6 flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-primary-cyan" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Privacy Policy</h1>
              <p className="text-xs text-text-muted mt-0.5">Last updated: September 2026</p>
            </div>
          </div>

          <div className="space-y-6 text-xs sm:text-sm text-text-light/90 leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-base font-bold text-white">1. Commitment to Data Confidentiality</h2>
              <p>
                SMART Pvt Ltd ("we", "our", or "the Company") respects your privacy and is dedicated to protecting proprietary business data, accounting figures, and personal information entrusted to us by our clients and website visitors.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-white">2. Information We Collect</h2>
              <p>
                We only collect information necessary to fulfill your technical quotations, system development, and support engagements:
              </p>
              <ul className="list-disc list-inside space-y-1 text-text-muted pl-2">
                <li>Contact details: Name, corporate email, phone/WhatsApp number.</li>
                <li>Project scope details: Requirement descriptions, software configurations, and budget ranges.</li>
                <li>Technical logs: Standard anonymous analytics data to monitor page performance.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-white">3. Protection of Business & Financial Records</h2>
              <p>
                Proprietary client source code, database credentials, IRD tax calculations, and audit workpapers are stored in strictly isolated, encrypted environments. We never sell, lease, or distribute your information to third-party marketing firms.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-white">4. Contact Information</h2>
              <p>
                If you have questions regarding this policy, please reach out to our compliance desk at <strong>info@smartpvtltd.com</strong>.
              </p>
            </section>
          </div>

        </div>
      </div>
    </div>
  );
}

