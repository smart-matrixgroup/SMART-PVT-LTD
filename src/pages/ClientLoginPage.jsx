import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SEO from '../components/SEO';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck, Lock, Mail, ArrowRight,
  Sparkles, Eye, EyeOff, User, AlertCircle
} from 'lucide-react';

export default function ClientLoginPage({ onOpenQuote }) {
  const navigate = useNavigate();
  const { login, isFirebaseConfigured } = useAuth();

  const [identifier, setIdentifier] = useState('');   // email
  const [password, setPassword]     = useState('');
  const [showPass, setShowPass]     = useState(false);
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!isFirebaseConfigured) {
      setError('Login is not configured yet. Contact the SMART team.');
      return;
    }

    setLoading(true);
    try {
      const result = await login(identifier.trim(), password);
      navigate(result.role === 'admin' ? '/erp' : '/client-dashboard');
    } catch (err) {
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-28 pb-20 min-h-[85vh] flex items-center justify-center bg-white dark:bg-navy-950">
      <SEO
        title="Login"
        description="Sign in to your SMART Pvt Ltd account."
      />

      <div className="w-full max-w-md mx-auto px-4">

        {/* Card */}
        <div className="rounded-3xl p-8 border border-[#DCE6F2] dark:border-surface-border bg-white dark:bg-navy-900 shadow-xl dark:shadow-2xl space-y-6">

          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-cyan border border-primary/30 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-extrabold text-[#0A1E3F] dark:text-white">
              Sign In to Your Account
            </h1>
            <p className="text-xs text-[#5B6E88] dark:text-text-muted">
              Sign in to access your projects, invoices, and support desk.
            </p>
          </div>

          {/* Info Banner */}
          <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-primary/5 dark:bg-primary/10 border border-primary/20">
            <Sparkles className="w-4 h-4 text-primary dark:text-primary-cyan shrink-0 mt-0.5" />
            <p className="text-[13px] leading-relaxed text-[#29405E] dark:text-text-light">
              <strong>Active clients</strong> — use the email address registered during your project onboarding.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">

            {/* Identifier */}
            <div>
              <label className="block text-xs font-semibold text-[#29405E] dark:text-text-light mb-1.5">
                Email Address <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#5B6E88] dark:text-text-muted absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="client@company.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F4F8FC] dark:bg-navy-800 border border-[#C8D8EE] dark:border-surface-border text-[#0A1E3F] dark:text-white text-sm placeholder:text-[#8B9AAF] focus:outline-none focus:border-primary dark:focus:border-primary-electric transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-[#29405E] dark:text-text-light mb-1.5">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#5B6E88] dark:text-text-muted absolute left-3.5 top-3" />
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#F4F8FC] dark:bg-navy-800 border border-[#C8D8EE] dark:border-surface-border text-[#0A1E3F] dark:text-white text-sm placeholder:text-[#8B9AAF] focus:outline-none focus:border-primary dark:focus:border-primary-electric transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-3 text-[#5B6E88] dark:text-text-muted hover:text-[#0A1E3F] dark:hover:text-white transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-xs text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Options row */}
            <div className="flex items-center justify-between text-xs text-[#5B6E88] dark:text-text-muted">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input type="checkbox" className="rounded border-[#C8D8EE] dark:border-surface-border accent-primary" />
                <span>Remember me</span>
              </label>
              <button
                type="button"
                onClick={() => alert('Please contact support@smartpvtltd.com for password reset.')}
                className="text-primary dark:text-primary-cyan hover:underline"
              >
                Forgot password?
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed shadow-glow-sm transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Verifying...
                </>
              ) : (
                <>Sign In <ArrowRight className="w-3.5 h-3.5" /></>
              )}
            </button>

          </form>

          {/* Footer */}
          <div className="pt-2 border-t border-[#DCE6F2] dark:border-surface-border text-center text-xs text-[#5B6E88] dark:text-text-muted">
            Not a client yet?{' '}
            <button
              onClick={() => onOpenQuote()}
              className="text-primary dark:text-primary-cyan font-bold hover:underline"
            >
              Request onboarding →
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
