import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import { 
  ShieldCheck, Lock, Mail, ArrowRight, 
  Sparkles, CheckCircle2, AlertCircle, Eye, EyeOff 
} from 'lucide-react';

export default function ClientLoginPage({ onOpenQuote }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [simulatedLogin, setSimulatedLogin] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    setSimulatedLogin(true);
  };

  return (
    <div className="pt-28 pb-20 min-h-[85vh] flex items-center justify-center">
      <SEO 
        title="Client Portal & ERP Gateway" 
        description="SMART Pvt Ltd future enterprise client portal and cloud ERP gateway."
      />

      <div className="w-full max-w-md mx-auto px-4">
        <div className="glass-card rounded-3xl p-8 border border-surface-borderHighlight/40 bg-navy-900/95 shadow-2xl space-y-6">
          
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-primary/20 text-primary-cyan border border-primary/30 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-extrabold text-white">Client Portal & ERP Gateway</h1>
            <p className="text-xs text-text-muted">
              Secure client gateway for SMARTORIX ERP, projects, invoices, and support tickets.
            </p>
          </div>

          {!simulatedLogin ? (
            <form onSubmit={handleLogin} className="space-y-4">
              
              {/* Notice Banner */}
              <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/30 text-xs text-text-light flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-primary-cyan shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  <strong>Client Portal Preview:</strong> Enterprise client single-sign-on (SSO) is currently provisioned for active SMART clients.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-light mb-1.5">
                  Corporate Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-text-muted absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="client@company.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-navy-800 border border-surface-border text-white text-sm focus:outline-none focus:border-primary-electric"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-light mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-text-muted absolute left-3.5 top-3.5" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-navy-800 border border-surface-border text-white text-sm focus:outline-none focus:border-primary-electric"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3.5 top-3.5 text-text-muted hover:text-white"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-text-muted pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" className="rounded bg-navy-800 border-surface-border" />
                  <span>Remember session</span>
                </label>
                <a href="#reset" onClick={(e) => { e.preventDefault(); alert("Please contact support@smartpvtltd.com for password reset assistance."); }} className="text-primary-cyan hover:underline">
                  Forgot PIN?
                </a>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-primary to-primary-electric hover:shadow-glow-sm transition-all flex items-center justify-center gap-2"
              >
                Enter Portal <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <div className="text-center py-4 space-y-4 animate-in fade-in duration-200">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Gateway Connected</h3>
                <p className="text-xs text-text-muted mt-1">
                  Access granted for <strong>{email}</strong>. In Phase 2, this will redirect directly to your active SMARTORIX ERP workspace.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-navy-800 text-left text-xs space-y-2 border border-surface-border">
                <p className="font-semibold text-white">Available Portal Modules:</p>
                <p className="text-text-muted">• Live Project Milestone Tracker</p>
                <p className="text-text-muted">• Invoices & Payment Receipts</p>
                <p className="text-text-muted">• SMARTORIX Cloud ERP Dashboard</p>
                <p className="text-text-muted">• Priority 24/7 SLA Support Desk</p>
              </div>

              <button
                onClick={() => setSimulatedLogin(false)}
                className="w-full py-2.5 rounded-xl text-xs font-semibold text-text-light bg-surface-card hover:bg-surface-cardHover border border-surface-border"
              >
                Sign Out / Return
              </button>
            </div>
          )}

          {/* Footer Assistance */}
          <div className="pt-4 border-t border-surface-border text-center text-xs text-text-muted">
            <span>New client? </span>
            <button
              onClick={() => onOpenQuote()}
              className="text-primary-cyan font-bold hover:underline"
            >
              Request onboarding & quotation →
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

