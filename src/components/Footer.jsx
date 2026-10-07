import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { company } from '../config/company';
import { 
  Facebook, Linkedin, Youtube, Instagram, 
  Send, Heart, CheckCircle2 
} from 'lucide-react';

export default function Footer({ onOpenQuote }) {
  const { isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [subError, setSubError] = useState('');

  // Newsletter signups are saved as leads (source: "Newsletter") so they
  // appear in the ERP Leads page like every other website submission.
  const handleSubscribe = async (e) => {
    e.preventDefault();
    setSubError('');
    const emailTrimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      setSubError('Please enter a valid email address.');
      return;
    }
    setSubscribing(true);
    try {
      // Dynamic import: the footer renders on every page, so the Firestore
      // SDK is only pulled in when someone actually subscribes.
      const [{ collection, addDoc, serverTimestamp }, { db, isFirebaseConfigured }] = await Promise.all([
        import('firebase/firestore'),
        import('../config/firebase'),
      ]);
      if (!isFirebaseConfigured) {
        setSubError('Our newsletter service is temporarily unavailable. Please try again later.');
        return;
      }
      await addDoc(collection(db, 'leads'), {
        type:      'website_form',
        leadId:    `WEB-${Date.now().toString(36).toUpperCase()}`,
        status:    'New',
        createdAt: serverTimestamp(),
        name:      emailTrimmed.split('@')[0], // real subscriber, derived from their own email
        email:     emailTrimmed,
        service:   'Newsletter Subscription',
        message:   'Newsletter subscription from the website footer.',
        source:    'Newsletter',
        page:      'footer',
      });
      setSubscribed(true);
      setEmail('');
    } catch (err) {
      console.error('Newsletter subscribe error:', err);
      setSubError("Couldn't subscribe right now — please try again in a moment.");
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <footer className="relative overflow-hidden border-t border-[#173960] bg-[#06182F] text-[#B8CBE2]">
      <div className="pointer-events-none absolute -left-40 -top-44 h-96 w-96 rounded-full bg-[#0A61C9]/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-36 right-0 h-80 w-80 rounded-full bg-[#C59A5C]/10 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:linear-gradient(120deg,rgba(255,255,255,.09)_1px,transparent_1px)] [background-size:30px_30px]" />
      
      <div className="relative mx-auto max-w-7xl px-4 pb-8 pt-14 sm:px-6 lg:px-8 lg:pt-16">
        <div className="mb-12 flex flex-col items-start justify-between gap-6 border-b border-[#275078]/70 pb-10 lg:flex-row lg:items-center">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-[#71B2FF]">Let's build something remarkable</p>
            <h2 className="max-w-xl text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Ready to make your business smarter?</h2>
          </div>
          <button onClick={() => onOpenQuote()} className="group inline-flex items-center gap-2 rounded-lg bg-[#C59A5C] px-6 py-3.5 text-sm font-extrabold text-[#071A35] shadow-[0_10px_24px_rgba(197,154,92,.24)] transition-all duration-300 hover:-translate-y-1 hover:bg-[#E3B977]">
            Start Your Project <Send className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </button>
        </div>

        {/* Main Footer Grid */}
        <div className="grid grid-cols-1 gap-10 border-b border-[#275078]/70 pb-12 md:grid-cols-2 lg:grid-cols-12">
          
          {/* Col 1: Brand Info (4 Cols) */}
          <div className="space-y-5 text-left lg:col-span-4">
            <Link to="/" className="inline-block transition-transform duration-300 hover:scale-[1.025]">
              <img 
                src={company.logos.darkMode} 
                alt="SMART [PVT] LTD Logo" 
                className="h-20 w-auto object-contain drop-shadow-[0_8px_15px_rgba(0,136,255,.28)] sm:h-24"
              />
            </Link>
            <p className="max-w-sm text-sm leading-relaxed text-[#B8CBE2]">
              SMART Pvt Ltd is a technology and business solutions company providing software development, accounting, tax, audit and business advisory services.
            </p>
            <p className="font-script text-xl text-[#E3B977]">From Ideas to Impact.</p>

            {/* Social Icons */}
            <div className="flex items-center space-x-2 pt-1">
              <a href={company.social.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="rounded-lg border border-[#2A5884] bg-[#0A2343] p-2.5 text-[#80BAFF] transition-all duration-300 hover:-translate-y-1 hover:border-[#C59A5C] hover:bg-[#C59A5C] hover:text-[#071A35]">
                <Facebook className="w-3.5 h-3.5" />
              </a>
              <a href={company.social.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="rounded-lg border border-[#2A5884] bg-[#0A2343] p-2.5 text-[#80BAFF] transition-all duration-300 hover:-translate-y-1 hover:border-[#C59A5C] hover:bg-[#C59A5C] hover:text-[#071A35]">
                <Linkedin className="w-3.5 h-3.5" />
              </a>
              <a href={company.social.youtube} target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="rounded-lg border border-[#2A5884] bg-[#0A2343] p-2.5 text-[#80BAFF] transition-all duration-300 hover:-translate-y-1 hover:border-[#C59A5C] hover:bg-[#C59A5C] hover:text-[#071A35]">
                <Youtube className="w-3.5 h-3.5" />
              </a>
              <a href={company.social.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="rounded-lg border border-[#2A5884] bg-[#0A2343] p-2.5 text-[#80BAFF] transition-all duration-300 hover:-translate-y-1 hover:border-[#C59A5C] hover:bg-[#C59A5C] hover:text-[#071A35]">
                <Instagram className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Col 2: Quick Links (2 Cols) */}
          <div className="text-left lg:col-span-2">
            <h4 className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-white">
              Quick Links
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/" className="transition-colors hover:text-[#E3B977]">Home</Link></li>
              <li><Link to="/about" className="transition-colors hover:text-[#E3B977]">About Us</Link></li>
              <li><Link to="/services" className="transition-colors hover:text-[#E3B977]">Services</Link></li>
              <li><Link to="/services/erp-pos" className="transition-colors hover:text-[#E3B977]">Products</Link></li>
              <li><Link to="/projects" className="transition-colors hover:text-[#E3B977]">Projects</Link></li>
              <li><Link to="/insights" className="transition-colors hover:text-[#E3B977]">Blog</Link></li>
              <li><Link to="/contact" className="transition-colors hover:text-[#E3B977]">Contact</Link></li>
            </ul>
          </div>

          {/* Col 3: Our Services (3 Cols) */}
          <div className="text-left lg:col-span-3">
            <h4 className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-white">
              Our Services
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/services/erp-pos" className="transition-colors hover:text-[#E3B977]">ERP & POS</Link></li>
              <li><Link to="/services/business-website" className="transition-colors hover:text-[#E3B977]">Website Development</Link></li>
              <li><Link to="/services/mobile-app" className="transition-colors hover:text-[#E3B977]">Mobile Apps</Link></li>
              <li><Link to="/services/accounting" className="transition-colors hover:text-[#E3B977]">Accounting & Tax</Link></li>
              <li><Link to="/services/audit" className="transition-colors hover:text-[#E3B977]">Audit & Assurance</Link></li>
              <li><Link to="/services/business-automation" className="transition-colors hover:text-[#E3B977]">Business Advisory</Link></li>
            </ul>
          </div>

          {/* Col 4: Support & Newsletter (3 Cols) */}
          <div className="space-y-5 text-left lg:col-span-3">
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-white">
                Newsletter
              </h4>
              <p className="mb-3 text-xs text-[#B8CBE2]">
                Get the latest updates, tips and offers.
              </p>

              {!subscribed ? (
                <form onSubmit={handleSubscribe} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="w-full rounded-lg border border-[#2A5884] bg-[#0A2343] px-3 py-2.5 text-xs text-white placeholder:text-[#7493B5] focus:border-[#71B2FF] focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={subscribing}
                      className="rounded-lg bg-[#2A7BE4] px-3.5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#4A99FF] disabled:opacity-60"
                    >
                      {subscribing ? '...' : 'Subscribe'}
                    </button>
                  </div>
                  {subError && <p className="text-[11px] text-amber-300">{subError}</p>}
                </form>
              ) : (
                <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 p-2.5 text-xs font-semibold text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Subscribed successfully!
                </div>
              )}
            </div>

            <div className="space-y-2 border-l-2 border-[#C59A5C] pl-3 text-xs">
              <span className="block font-bold text-white">Support & Legal</span>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[#B8CBE2]">
                <Link to="/contact" className="hover:text-[#E3B977]">Help Center</Link>
                <Link to="/client-login" className="hover:text-[#E3B977]">Login</Link>
                <Link to="/privacy" className="hover:text-[#E3B977]">Privacy Policy</Link>
                <Link to="/terms" className="hover:text-[#E3B977]">Terms & Conditions</Link>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Bar: Copyright */}
        <div className="flex flex-col items-center justify-between gap-3 pt-7 text-xs text-[#8FA8C6] sm:flex-row">
          <p>© 2026 SMART Pvt Ltd. All rights reserved.</p>
          <p className="flex items-center gap-1 text-[13px]">
            Built with <Heart className="inline h-3.5 w-3.5 fill-[#E3B977] text-[#E3B977]" /> for a Smarter Future.
          </p>
        </div>

      </div>
    </footer>
  );
}
