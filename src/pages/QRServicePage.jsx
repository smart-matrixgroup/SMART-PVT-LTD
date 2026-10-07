import React, { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { services } from '../config/services';
import { company } from '../config/company';
import SEO from '../components/SEO';
import {
  CheckCircle2, ArrowRight, Phone, MessageSquare, ExternalLink,
  ShieldCheck, Sparkles, Building2, Globe, FileCheck, Calculator,
  Cpu, Smartphone, Code2, LayoutGrid, Receipt, ChevronDown, ChevronUp,
  Search, Award, Clock, DollarSign, Layers
} from 'lucide-react';

const ICON_MAP = {
  LayoutGrid, Code2, UserCheck: Award, Globe, Smartphone,
  Cpu, Sparkles, Calculator, FileCheck, ShieldCheck, Building2, Receipt
};

export default function QRServicePage({ onOpenQuote }) {
  const { slug } = useParams();
  const [search, setSearch] = useState('');
  const [expandedFaq, setExpandedFaq] = useState(null);

  // Normalize slug matching
  const scannedSlug = (slug || '').toLowerCase().trim();

  // Find scanned service (check slug, id, or close match)
  const scannedService = useMemo(() => {
    return (
      services.find(s => s.slug?.toLowerCase() === scannedSlug || s.id?.toLowerCase() === scannedSlug) ||
      services.find(s => s.title?.toLowerCase().includes(scannedSlug)) ||
      services[0]
    );
  }, [scannedSlug]);

  const ScannedIcon = ICON_MAP[scannedService?.icon] || Sparkles;

  const filteredServices = useMemo(() => {
    if (!search.trim()) return services;
    const q = search.toLowerCase();
    return services.filter(
      s => s.title.toLowerCase().includes(q) ||
           s.category.toLowerCase().includes(q) ||
           s.shortDesc?.toLowerCase().includes(q)
    );
  }, [search]);

  const whatsappUrl = `https://wa.me/${company.contact.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
    `Hello SMART Pvt Ltd, I scanned the QR code for ${scannedService?.title}. I would like more information.`
  )}`;

  return (
    <div className="min-h-screen bg-[#070D1F] text-slate-100 selection:bg-blue-600 selection:text-white">
      <SEO
        title={`${scannedService?.title || 'Service'} — SMART Verified QR`}
        description={scannedService?.shortDesc || 'SMART Pvt Ltd official service details.'}
      />

      {/* Top Banner / Verification Header */}
      <header className="border-b border-white/10 bg-[#0B1530]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3 group">
            <img
              src="/logos/SMART_LOGO_DM_WTHOT_BG_1.png"
              alt="SMART Pvt Ltd"
              className="h-9 w-auto object-contain drop-shadow"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <div className="hidden sm:flex flex-col">
              <span className="font-extrabold text-white text-sm tracking-tight leading-none group-hover:text-blue-400 transition-colors">
                {company.fullName}
              </span>
              <span className="text-[10px] text-slate-400 font-medium tracking-wider uppercase mt-0.5">
                Verified Service System
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <ShieldCheck size={14} className="text-emerald-400 flex-shrink-0" />
            <span>Verified QR Scan</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 md:py-12 space-y-12">
        {/* ══════════════════════════════════════════════════════════════ */}
        {/* 1. SCANNED SERVICE HIGHLIGHTED SECTION (HERO)                  */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <section className="relative overflow-hidden rounded-3xl border-2 border-blue-500/60 bg-gradient-to-br from-[#10234E] via-[#0E1A3A] to-[#0A1329] p-6 sm:p-10 shadow-2xl shadow-blue-900/30">
          {/* Subtle Ambient Backing Glow */}
          <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-blue-600/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-indigo-600/15 blur-3xl pointer-events-none" />

          {/* Scanned Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/20 border border-blue-400/40 text-blue-300 text-xs font-bold uppercase tracking-wider mb-6">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            Scanned Service Highlight
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-8 space-y-5">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-600/30 flex-shrink-0">
                  <ScannedIcon size={28} />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                    {scannedService.title}
                  </h1>
                  <p className="text-blue-300 font-medium text-sm sm:text-base mt-1">
                    {scannedService.subtitle}
                  </p>
                </div>
              </div>

              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                {scannedService.overview || scannedService.shortDesc}
              </p>

              {/* Quick Tags / Meta */}
              <div className="flex flex-wrap gap-3 pt-2">
                <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300 flex items-center gap-1.5 font-medium">
                  <Layers size={13} className="text-blue-400" />
                  Category: <span className="text-white font-semibold">{scannedService.category}</span>
                </div>
                {scannedService.startingPrice && (
                  <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300 flex items-center gap-1.5 font-medium">
                    <DollarSign size={13} className="text-emerald-400" />
                    Starting: <span className="text-emerald-300 font-semibold">{scannedService.startingPrice}</span>
                  </div>
                )}
                {scannedService.timeline && (
                  <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300 flex items-center gap-1.5 font-medium">
                    <Clock size={13} className="text-amber-400" />
                    Timeline: <span className="text-amber-300 font-semibold">{scannedService.timeline}</span>
                  </div>
                )}
              </div>
            </div>

            {/* CTA Box */}
            <div className="lg:col-span-4 bg-[#081226]/80 rounded-2xl border border-white/10 p-5 space-y-4">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Direct Engagement
              </div>
              <p className="text-xs text-slate-300 leading-normal">
                Ready to get started or request an official quotation? Connect directly with our specialists.
              </p>

              <div className="space-y-2.5">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-900/40 transition-transform active:scale-95"
                >
                  <MessageSquare size={16} />
                  Inquire via WhatsApp
                </a>

                {onOpenQuote && (
                  <button
                    onClick={() => onOpenQuote(scannedService.title)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-900/40 transition-colors"
                  >
                    Request Quotation
                  </button>
                )}

                <a
                  href={`tel:${company.contact.phone}`}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-semibold text-xs transition-colors"
                >
                  <Phone size={13} className="text-slate-400" />
                  Call {company.contact.phoneDisplay}
                </a>
              </div>
            </div>
          </div>

          {/* Key Features Breakdown */}
          {scannedService.features && scannedService.features.length > 0 && (
            <div className="mt-8 pt-8 border-t border-white/10">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                <Sparkles size={14} className="text-blue-400" /> Key Features & Capabilities
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {scannedService.features.map((feat, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:border-blue-500/30 transition-colors"
                  >
                    <div className="font-bold text-xs sm:text-sm text-slate-100 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                      {feat.name}
                    </div>
                    {feat.desc && (
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed pl-3.5">
                        {feat.desc}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deliverables Checklist */}
          {scannedService.deliverables && scannedService.deliverables.length > 0 && (
            <div className="mt-6 pt-6 border-t border-white/10">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-400" /> Official Deliverables
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {scannedService.deliverables.map((del, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-300">
                    <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>{del}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FAQs */}
          {scannedService.faqs && scannedService.faqs.length > 0 && (
            <div className="mt-6 pt-6 border-t border-white/10 space-y-3">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-2">
                Frequently Asked Questions
              </h3>
              {scannedService.faqs.map((faq, idx) => {
                const isOpen = expandedFaq === idx;
                return (
                  <div
                    key={idx}
                    className="rounded-xl bg-white/[0.03] border border-white/[0.08] overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedFaq(isOpen ? null : idx)}
                      className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 text-xs sm:text-sm font-semibold text-slate-200 hover:text-white"
                    >
                      <span>{faq.q}</span>
                      {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-3.5 text-xs text-slate-400 leading-relaxed border-t border-white/[0.05] pt-2.5">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* 2. ALL OTHER SERVICES LISTED BELOW                             */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                All SMART Services & Solutions
              </h2>
              <p className="text-slate-400 text-xs sm:text-sm mt-1">
                Explore our full ecosystem of business technology and financial services.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search services..."
                className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredServices.map((service) => {
              const isCurrent = service.slug === scannedService.slug || service.id === scannedService.id;
              const CardIcon = ICON_MAP[service.icon] || Sparkles;

              return (
                <div
                  key={service.slug || service.id}
                  className={`relative rounded-2xl p-6 transition-all duration-200 flex flex-col justify-between ${
                    isCurrent
                      ? 'bg-gradient-to-br from-[#122554] to-[#0A1636] border-2 border-blue-400 shadow-xl shadow-blue-900/30 ring-2 ring-blue-500/20'
                      : 'bg-[#0E172E] border border-white/10 hover:border-white/25 hover:-translate-y-1'
                  }`}
                >
                  {/* Highlight Tag on Scanned One */}
                  {isCurrent && (
                    <div className="absolute -top-3 left-4 px-3 py-0.5 rounded-full bg-blue-500 text-white text-[10px] font-extrabold uppercase tracking-wider shadow-md">
                      Currently Scanned
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isCurrent
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/40'
                          : 'bg-white/5 text-slate-300'
                      }`}>
                        <CardIcon size={20} />
                      </div>
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white/5 text-slate-400 border border-white/10">
                        {service.category}
                      </span>
                    </div>

                    <div>
                      <h3 className={`font-bold text-base leading-snug ${isCurrent ? 'text-white' : 'text-slate-100'}`}>
                        {service.title}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {service.shortDesc || service.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-white/[0.08] flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-emerald-400">
                      {service.startingPrice || 'Custom Quote'}
                    </span>

                    <Link
                      to={`/services/qr/${service.slug}`}
                      className={`inline-flex items-center gap-1.5 text-xs font-bold transition-colors ${
                        isCurrent
                          ? 'text-blue-300 hover:text-white'
                          : 'text-slate-300 hover:text-blue-400'
                      }`}
                    >
                      {isCurrent ? 'Viewing' : 'View Details'} <ArrowRight size={12} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* 3. COMPANY FOOTER / TRUST BANNER                               */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center space-y-3">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            {company.name} · Official Public Portal
          </div>
          <p className="text-xs text-slate-400 max-w-xl mx-auto">
            {company.description}
          </p>
          <div className="pt-2 text-xs text-slate-500">
            Head Office: {company.contact.address} · Tel: {company.contact.phoneDisplay}
          </div>
        </section>
      </main>
    </div>
  );
}
