import React from 'react';
import SEO from '../components/SEO';
import { FileText } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="pt-28 pb-20">
      <SEO 
        title="Terms & Conditions" 
        description="SMART Pvt Ltd terms and conditions governing software development contracts, SMART ERP subscriptions, and professional services."
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="glass-card rounded-3xl p-8 sm:p-12 border border-surface-border bg-navy-900/90 space-y-6">
          
          <div className="border-b border-surface-border pb-6 flex items-center gap-3">
            <FileText className="w-8 h-8 text-primary-cyan" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Terms & Conditions</h1>
              <p className="text-xs text-text-muted mt-0.5">Corporate Agreement Terms • September 2026</p>
            </div>
          </div>

          <div className="space-y-6 text-xs sm:text-sm text-text-light/90 leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-base font-bold text-white">1. Scope of Agreement</h2>
              <p>
                By accessing this website, requesting a quotation, or commissioning SMART Pvt Ltd for software development, ERP licensing, website builds, or accounting/tax consulting, you agree to these standard operating terms.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-white">2. Intellectual Property & Ownership</h2>
              <p>
                Upon receipt of full contract payment, the bespoke custom software artifacts developed specifically for a client belong exclusively to that client. SMART ERP core engine licenses remain the proprietary IP of SMART Pvt Ltd with continuous operational usage granted to the subscriber.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-white">3. Milestone Delivery & Payments</h2>
              <p>
                Software and website projects adhere to written milestone schedules. Work commences following advance deposit clearance. Final deployment or source handover takes place upon milestone verification and final balance settlement.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-white">4. Professional & Statutory Compliance Services</h2>
              <p>
                All tax computation, bookkeeping setup, and audit support services are rendered based on the financial documentation provided by the client. Clients are responsible for ensuring underlying business data is genuine and accurate.
              </p>
            </section>
          </div>

        </div>
      </div>
    </div>
  );
}

