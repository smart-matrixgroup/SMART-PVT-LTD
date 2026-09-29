import React, { useState } from 'react';
import { branches } from '../config/branches';
import { MapPin, Phone, Mail, Clock, ExternalLink } from 'lucide-react';

export default function BranchMapSection() {
  const [selectedBranch, setSelectedBranch] = useState(branches[0]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
      {/* Branch Cards Column */}
      <div className="lg:col-span-5 space-y-4">
        {branches.map((branch) => {
          const isSelected = selectedBranch.branchId === branch.branchId;
          return (
            <div
              key={branch.branchId}
              onClick={() => setSelectedBranch(branch)}
              className={`glass-card rounded-3xl p-6 cursor-pointer border transition-all ${
                isSelected
                  ? 'border-primary-cyan/60 bg-navy-900/95 shadow-glow-sm'
                  : 'border-surface-border bg-navy-900/60 hover:bg-navy-900/80 hover:border-surface-borderHighlight'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-primary/20 text-primary-cyan border border-primary/30">
                  {branch.badge}
                </span>
                <span className="text-[11px] text-text-muted font-mono">{branch.branchId}</span>
              </div>

              <h4 className="text-base font-bold text-white">
                {branch.name}
              </h4>

              <div className="mt-4 space-y-2.5 text-xs text-text-muted">
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-primary-cyan shrink-0 mt-0.5" />
                  <span>{branch.address}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{branch.phone}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-primary-electric shrink-0" />
                  <span>{branch.email}</span>
                </div>
                <div className="flex items-center gap-2.5 pt-1 text-[11px] text-text-muted/80">
                  <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Mon-Sat: {branch.businessHours.weekdays}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Google Maps Embed Column */}
      <div className="lg:col-span-7 rounded-3xl overflow-hidden glass-card border border-surface-border min-h-[380px] relative shadow-2xl">
        <iframe
          title={`Google Map for ${selectedBranch.name}`}
          src={selectedBranch.googleMapsEmbedUrl}
          className="w-full h-full min-h-[380px] border-0 grayscale-[20%] contrast-[110%] rounded-3xl"
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
        />
        
        {/* Overlay Badge */}
        <div className="absolute bottom-4 left-4 right-4 sm:right-auto glass-card p-3 rounded-2xl border border-surface-border flex items-center justify-between gap-4 bg-navy-950/85 backdrop-blur-md">
          <div className="text-xs">
            <p className="font-bold text-white">{selectedBranch.name}</p>
            <p className="text-[11px] text-text-muted">{selectedBranch.city}</p>
          </div>
          <a
            href="https://maps.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-xl bg-primary text-white hover:bg-primary-hover transition-colors"
            aria-label="Open in Google Maps"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}

