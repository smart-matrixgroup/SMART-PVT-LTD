import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { company } from '../config/company';
import { MessageCircle, X } from 'lucide-react';

export default function WhatsAppButton() {
  const [showTooltip, setShowTooltip] = useState(true);
  const location = useLocation();

  const getCustomMessage = () => {
    const path = location.pathname;
    if (path.includes('portfolio-website')) {
      return "Hi SMART Pvt Ltd, I am interested in your Portfolio Website (LKR 15,000 package).";
    }
    if (path.includes('erp-pos')) {
      return "Hi SMART Pvt Ltd, I would like to schedule a demo for SMART ERP with POS.";
    }
    if (path.includes('custom-software')) {
      return "Hi SMART Pvt Ltd, I would like to discuss a custom business software requirement.";
    }
    if (path.includes('pricing')) {
      return "Hi SMART Pvt Ltd, I saw your pricing packages and would like to get a personalized quotation.";
    }
    return "Hi SMART Pvt Ltd, I would like to inquire about your technology and business services.";
  };

  const whatsappUrl = `https://wa.me/${company.contact.whatsapp.replace('+', '')}?text=${encodeURIComponent(getCustomMessage())}`;

  return (
    <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3">
      {/* Tooltip bubble */}
      {showTooltip && (
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-navy-800/90 text-white text-xs border border-surface-border shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-right-2">
          <span>Need quick advice? <strong>Chat on WhatsApp</strong></span>
          <button 
            onClick={() => setShowTooltip(false)} 
            className="text-text-muted hover:text-white p-0.5"
            aria-label="Dismiss message"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Floating Action Button */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat on WhatsApp with SMART Pvt Ltd"
        className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 flex items-center justify-center transition-all duration-300 transform hover:scale-110 active:scale-95 group relative"
      >
        <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-400"></span>
        </span>
        <MessageCircle className="w-7 h-7 fill-white/20 stroke-[2.2]" />
      </a>
    </div>
  );
}

