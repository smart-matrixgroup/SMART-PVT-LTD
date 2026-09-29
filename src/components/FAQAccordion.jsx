import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

export default function FAQAccordion({ items = [] }) {
  const [openIdx, setOpenIdx] = useState(0);

  const defaultItems = [
    {
      q: "How does SMART Pvt Ltd differ from a generic software agency?",
      a: "We integrate technology architecture with deep operational, accounting, and compliance understanding. We do not just build software; we engineer systems around your actual business workflows, staff roles, and financial controls."
    },
    {
      q: "What is the typical timeframe for a project?",
      a: "Portfolio websites are delivered in 3-5 business days. Corporate business websites take 2-4 weeks. Complex custom software and multi-branch SMARTORIX ERP implementations range from 4-12 weeks based on scope."
    },
    {
      q: "How does the LKR 15,000 Portfolio Website package work?",
      a: "It is our fixed starting package for professionals, freelancers, and executives. It includes a responsive single-page web portfolio, project gallery, contact capture, direct WhatsApp CTA, and free Firebase deployment."
    },
    {
      q: "Can SMARTORIX ERP work if our internet disconnects?",
      a: "Yes. SMARTORIX features local offline capability for POS billing and floor orders, syncing automatically with cloud databases once your connection is restored."
    },
    {
      q: "Do you provide accounting, tax, and audit compliance support?",
      a: "Yes. Our team provides dedicated accounting software setup, financial statement preparations, IRD tax returns (CIT, VAT, SSCL, WHT/AIT), and independent external audit coordination."
    }
  ];

  const faqList = items.length > 0 ? items : defaultItems;

  return (
    <div className="space-y-3 max-w-3xl mx-auto">
      {faqList.map((item, idx) => {
        const isOpen = openIdx === idx;
        return (
          <div
            key={idx}
            className="glass-card rounded-2xl border border-surface-border overflow-hidden transition-all bg-navy-900/70"
          >
            <button
              onClick={() => setOpenIdx(isOpen ? -1 : idx)}
              className="w-full p-5 text-left flex items-center justify-between gap-4 focus:outline-none"
            >
              <span className="text-sm sm:text-base font-bold text-white flex items-center gap-3">
                <HelpCircle className="w-4 h-4 text-primary-cyan shrink-0" />
                {item.q}
              </span>
              <ChevronDown className={`w-4 h-4 text-text-muted shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary-electric' : ''}`} />
            </button>

            {isOpen && (
              <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-text-muted leading-relaxed border-t border-surface-border/40 animate-in fade-in duration-200">
                {item.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

