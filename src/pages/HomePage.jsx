import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { company } from '../config/company';
import { branches } from '../config/branches';
import SEO from '../components/SEO';
import { 
  ArrowRight, CheckCircle2, Play, Star, 
  LayoutGrid, Code2, Globe, Smartphone, 
  Calculator, Cpu, ShieldCheck, Sparkles, 
  ShoppingBag, Utensils, Hotel, Factory, 
  Briefcase, Stethoscope, GraduationCap, HeartHandshake,
  Award, HelpCircle, ChevronDown, MessageSquare, ExternalLink,
  Layers, Users, BarChart3, Database, Cloud, Clock, X, DollarSign,
  TrendingUp, Check, Phone, Mail, MapPin, Building, Shield, FileText
} from 'lucide-react';

export default function HomePage({ onOpenQuote }) {
  const { isDark } = useTheme();
  const [activeBranch, setActiveBranch] = useState(branches[0]);
  const [openFaq, setOpenFaq] = useState(0);
  const [isVideoOpen, setIsVideoOpen] = useState(false);

  // 8 Quick Services Strip
  const quickServices = [
    { title: "ERP & POS Systems", icon: LayoutGrid, slug: "erp-pos" },
    { title: "Custom Software Development", icon: Code2, slug: "custom-software" },
    { title: "Website Development", icon: Globe, slug: "business-website" },
    { title: "Mobile App Development", icon: Smartphone, slug: "mobile-app" },
    { title: "Accounting, Tax & Audit Services", icon: Calculator, slug: "accounting" },
    { title: "Business Process Automation", icon: Cpu, slug: "business-automation" },
    { title: "IT Consulting & Support", icon: ShieldCheck, slug: "custom-software" },
    { title: "AI-Powered Solutions", icon: Sparkles, slug: "ai-automation" },
  ];

  // 6 Services with cover images
  const coreServices = [
    {
      title: "Custom Software Development",
      desc: "Tailor-made solutions for your unique needs.",
      slug: "custom-software",
      image: "https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=600&q=80"
    },
    {
      title: "Website Development",
      desc: "Professional websites & e-commerce solutions.",
      slug: "business-website",
      image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=600&q=80"
    },
    {
      title: "Mobile App Development",
      desc: "Android & iOS cross-platform applications.",
      slug: "mobile-app",
      image: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=600&q=80"
    },
    {
      title: "Accounting & Tax Services",
      desc: "Tax filing, financial statements and compliance.",
      slug: "accounting",
      image: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80"
    },
    {
      title: "Audit & Assurance",
      desc: "Independent audits for business confidence.",
      slug: "audit",
      image: "https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=600&q=80"
    },
    {
      title: "Business Advisory",
      desc: "Strategic guidance for sustainable growth.",
      slug: "business-automation",
      image: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=600&q=80"
    },
  ];

  // 8 Industries
  const industries = [
    { name: "Retail & Supermarkets", icon: ShoppingBag },
    { name: "Restaurants & Cafes", icon: Utensils },
    { name: "Hotels & Hospitality", icon: Hotel },
    { name: "Manufacturing", icon: Factory },
    { name: "Professional Services", icon: Briefcase },
    { name: "Healthcare", icon: Stethoscope },
    { name: "Education", icon: GraduationCap },
    { name: "NGOs & Non-Profits", icon: HeartHandshake },
  ];

  // 4 Featured Projects
  const featuredProjects = [
    {
      name: "Restaurant POS System",
      category: "Food & Beverage",
      image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80",
      slug: "smartorix-restaurant-pos"
    },
    {
      name: "Corporate Website",
      category: "Business Services",
      image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80",
      slug: "mehala-personal-portfolio"
    },
    {
      name: "Inventory Management",
      category: "Retail Business",
      image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80",
      slug: "retail-smart-pos-inventory"
    },
    {
      name: "Hotel Management",
      category: "Hospitality Industry",
      image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80",
      slug: "smartorix-restaurant-pos"
    }
  ];

  // FAQs
  const homeFaqs = [
    {
      q: "What services does SMART Pvt Ltd offer?",
      a: "We provide complete technology and business solutions including custom software development, SMARTORIX ERP & POS, corporate & portfolio websites, mobile applications, business automation, accounting setup, tax return filing, and audit assurance support."
    },
    {
      q: "How much does a website cost?",
      a: "Our single-page Portfolio Website package starts from LKR 15,000 with free cloud deployment. Multi-page corporate business websites and custom web applications are quoted based on specific features and scope."
    },
    {
      q: "Do you provide accounting and tax filing services?",
      a: "Yes. Our qualified finance division handles bookkeeping setup, financial statement preparations, TIN registrations, and periodic Corporate Income Tax (CIT), VAT, SSCL, and WHT/AIT filings."
    },
    {
      q: "Can I get a custom ERP for my business?",
      a: "Yes! SMARTORIX is modular and can be customized specifically for retail stores, restaurant chains, distribution warehouses, or service companies with offline POS sync."
    },
    {
      q: "Do you offer ongoing support?",
      a: "Absolutely. All our deliverables include a post-launch warranty, followed by flexible SLA maintenance agreements covering cloud hosting, security patches, and system enhancements."
    }
  ];

  return (
    <div className="space-y-0 text-[#0A1E3F] dark:text-text-light bg-white dark:bg-navy-950 transition-colors duration-200">
      <SEO 
        title="SMART [PVT] LTD | Technology That Makes Business Smarter" 
        description="SMART Pvt Ltd provides software development, ERP & POS systems, websites, mobile apps, along with accounting, tax and audit services — all under one roof."
      />

      {/* =========================================================================
          1. HERO / BANNER SECTION
         ========================================================================= */}
      <section className="relative overflow-hidden border-b border-[#E2EAF4] bg-[#F7FAFE] pt-28 pb-12 font-['Inter'] dark:border-[#1C3A66] dark:bg-[#071B38] lg:pt-32 lg:pb-16">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_86%_25%,rgba(167,215,255,.62),transparent_30%),radial-gradient(circle_at_8%_88%,rgba(193,224,255,.45),transparent_24%)] dark:bg-[radial-gradient(circle_at_86%_25%,rgba(36,123,230,.28),transparent_30%),radial-gradient(circle_at_8%_88%,rgba(22,91,180,.22),transparent_28%)]" />
        <div className="pointer-events-none absolute -right-24 top-8 h-80 w-80 rounded-full border-[28px] border-[#D9ECFF]/80 dark:border-[#17477D]/45" />

        <div className="relative z-10 mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-5">
            <div className="space-y-5 text-left lg:col-span-6 lg:pt-1">
              
              {/* Category Pill Tag */}
              <div className="inline-flex items-center gap-2 rounded-full border border-[#CDE0FF] bg-[#EBF3FC] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#0066FF] shadow-sm dark:border-[#2C639C] dark:bg-[#0D315B] dark:text-[#65B5FF]">
                <span>SOFTWARE | ACCOUNTING | AUDIT | BUSINESS SOLUTIONS</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-[2.55rem] font-extrabold leading-[1.08] tracking-[-0.04em] text-[#071E46] dark:text-white sm:text-5xl lg:text-[58px]">
                Technology That <br />
                Makes Business <br />
                <span className="text-[#0066FF] dark:text-primary-electric">Smarter.</span>
              </h1>

              {/* Subtitle */}
              <p className="max-w-xl text-sm leading-relaxed text-[#4A5E78] dark:text-[#C3D4EB] sm:text-base">
                SMART Pvt Ltd is a technology and business solutions company providing software development, ERP & POS systems, website & mobile app development, along with accounting, tax and audit services — all under one roof.
              </p>

              {/* CTA Action Buttons */}
              <div className="flex flex-wrap items-center gap-3.5 pt-1">
                <button
                  onClick={() => onOpenQuote()}
                  className="px-6 py-3.5 rounded-full text-xs sm:text-sm font-bold text-white bg-[#0066FF] hover:bg-[#0052CC] shadow-lg shadow-blue-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2"
                >
                  Get Started <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setIsVideoOpen(true)}
                  className="px-5 py-3.5 rounded-full text-xs sm:text-sm font-bold text-[#0A1E3F] dark:text-white bg-white dark:bg-navy-800 hover:bg-[#F4F8FC] border border-[#DCE6F2] dark:border-surface-border shadow-xs transition-all flex items-center gap-2"
                >
                  <div className="w-5 h-5 rounded-full bg-[#0066FF] flex items-center justify-center text-white">
                    <Play className="w-2.5 h-2.5 fill-white ml-0.5" />
                  </div>
                  Watch Video
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-5 sm:grid-cols-4">
                
                {/* 1. Client Base */}
                <div className="p-3.5 rounded-2xl bg-white/95 dark:bg-navy-900/90 backdrop-blur-md border border-[#E2EAF4] dark:border-surface-border shadow-sm flex flex-col items-center justify-center text-center">
                  <div className="w-7 h-7 rounded-full bg-[#EBF3FC] dark:bg-primary/20 flex items-center justify-center text-[#0066FF] dark:text-primary-cyan mb-1.5">
                    <Users className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-sm font-black text-[#0066FF] dark:text-primary-cyan block leading-none">
                    Multi-Industry
                  </span>
                  <span className="text-[11px] font-semibold text-[#5B6E88] dark:text-text-muted block mt-1">
                    Client Base
                  </span>
                </div>

                {/* 2. Project Delivery */}
                <div className="p-3.5 rounded-2xl bg-white/95 dark:bg-navy-900/90 backdrop-blur-md border border-[#E2EAF4] dark:border-surface-border shadow-sm flex flex-col items-center justify-center text-center">
                  <div className="w-7 h-7 rounded-full bg-[#EBF3FC] dark:bg-primary/20 flex items-center justify-center text-[#0066FF] dark:text-primary-cyan mb-1.5">
                    <FileText className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-sm font-black text-[#0066FF] dark:text-primary-cyan block leading-none">
                    End-to-End
                  </span>
                  <span className="text-[11px] font-semibold text-[#5B6E88] dark:text-text-muted block mt-1">
                    Project Delivery
                  </span>
                </div>

                {/* 3. Ongoing Support */}
                <div className="p-3.5 rounded-2xl bg-white/95 dark:bg-navy-900/90 backdrop-blur-md border border-[#E2EAF4] dark:border-surface-border shadow-sm flex flex-col items-center justify-center text-center">
                  <div className="w-7 h-7 rounded-full bg-[#EBF3FC] dark:bg-primary/20 flex items-center justify-center text-[#0066FF] dark:text-primary-cyan mb-1.5">
                    <Award className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-sm font-black text-[#0066FF] dark:text-primary-cyan block leading-none">
                    Dedicated
                  </span>
                  <span className="text-[11px] font-semibold text-[#5B6E88] dark:text-text-muted block mt-1">
                    Ongoing Support
                  </span>
                </div>

                {/* 4. Branch Locations */}
                <div className="p-3.5 rounded-2xl bg-white/95 dark:bg-navy-900/90 backdrop-blur-md border border-[#E2EAF4] dark:border-surface-border shadow-sm flex flex-col items-center justify-center text-center">
                  <div className="w-7 h-7 rounded-full bg-[#EBF3FC] dark:bg-primary/20 flex items-center justify-center text-[#0066FF] dark:text-primary-cyan mb-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xl font-black text-[#0066FF] dark:text-primary-cyan block leading-none">
                    3
                  </span>
                  <span className="text-[11px] font-semibold text-[#5B6E88] dark:text-text-muted block mt-1">
                    Branch Locations
                  </span>
                </div>

              </div>

            </div>

            {/* Corporate headquarters showcase */}
            <div className="relative mx-auto w-full max-w-[660px] lg:col-span-6 lg:max-w-none">
              <div className="relative aspect-[1.18/1] overflow-hidden rounded-[2rem] border border-[#B9D9FA] bg-[#DDEFFF] shadow-[0_22px_55px_rgba(37,104,176,.22)]">
                <img
                  src="/images/SMART-BANNER-BG.webp"
                  alt="SMART Pvt Ltd corporate headquarters"
                  width="660"
                  height="559"
                  loading="eager"
                  fetchpriority="high"
                  className="absolute inset-0 h-full w-full scale-[1.15] object-cover object-[72%_50%]"
                />
                <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[#061D46]/90 via-[#061D46]/20 to-transparent" />

                <div className="absolute bottom-5 left-5 text-white sm:bottom-7 sm:left-7">
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#086DFF] px-3 py-1.5 text-[10px] font-bold tracking-wide shadow-lg sm:text-xs">
                    <MapPin className="h-3.5 w-3.5 fill-white" /> CORPORATE HEADQUARTERS
                  </div>
                  <p className="text-base font-bold sm:text-lg">SMART [PVT] LTD Commercial Center</p>
                  <p className="text-xs text-blue-100 sm:text-sm">Colombo, Sri Lanka</p>
                </div>

                <div className="absolute left-5 top-5 hidden items-center gap-3 rounded-[1.5rem] bg-white/90 p-3 pr-5 shadow-lg backdrop-blur-md sm:flex">
                  <img src="/logos/SMART_LOGO_ONLY_HEAD_CMP.png" alt="SMART" className="h-14 w-14 object-contain" />
                  <div>
                    <p className="text-sm font-bold text-[#0A1E3F]">Your Growth.</p>
                    <p className="text-sm font-bold text-[#0A1E3F]">Our Technology.</p>
                    <span className="mt-2 block h-1.5 w-11 rounded-full bg-[#086DFF]" />
                  </div>
                </div>
              </div>

              <div className="absolute -right-12 bottom-12 hidden w-[200px] rounded-[1.4rem] border border-white/80 bg-white/95 p-5 shadow-[0_16px_35px_rgba(13,58,116,.2)] backdrop-blur-md xl:block">
                <p className="text-base font-extrabold leading-tight text-[#0A1E3F]">One Partner.<br />Complete Solutions.</p>
                <span className="my-3 block h-1 w-10 rounded-full bg-[#086DFF]" />
                <ul className="space-y-2 text-xs font-medium text-[#314B70]">
                  {['Software Development', 'Accounting & Tax Services', 'Audit & Assurance', 'Business Advisory'].map((item) => (
                    <li key={item} className="flex items-center gap-2"><Check className="h-4 w-4 rounded-full bg-[#086DFF] p-0.5 text-white" />{item}</li>
                  ))}
                </ul>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* =========================================================================
          2. HORIZONTAL 8-ITEM CAPABILITY STRIP
         ========================================================================= */}
      <section className="py-8 bg-white dark:bg-navy-900 border-b border-[#E2EAF4] dark:border-surface-border">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {quickServices.map((svc, idx) => {
              const Icon = svc.icon;
              return (
                <Link
                  key={idx}
                  to={`/services/${svc.slug}`}
                  className="p-3.5 rounded-2xl bg-[#F8FAFC] dark:bg-navy-800/60 hover:bg-[#EBF3FC] dark:hover:bg-primary/20 border border-[#E2EAF4] dark:border-surface-border hover:border-[#B8D5FF] dark:hover:border-primary/50 text-center transition-all group flex flex-col items-center justify-center min-h-[100px]"
                >
                  <div className="p-2.5 rounded-xl bg-white dark:bg-navy-700 text-[#0066FF] dark:text-primary-cyan shadow-2xs group-hover:scale-110 transition-transform">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-bold text-[#0A1E3F] dark:text-text-light group-hover:text-[#0066FF] dark:group-hover:text-primary-cyan transition-colors mt-2 line-clamp-2 leading-tight">
                    {svc.title}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================================
          3. ABOUT SMART PVT LTD
         ========================================================================= */}
      <section className="py-16 lg:py-20 bg-[#F4F8FC] dark:bg-midnight">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            
            {/* Left: About Text & 4 Checkpoints */}
            <div className="lg:col-span-5 space-y-5 flex flex-col justify-between text-left">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0066FF] dark:text-primary-cyan">
                  ABOUT SMART PVT LTD
                </span>
                <h2 className="text-2xl sm:text-3xl lg:text-[34px] font-extrabold text-[#0A1E3F] dark:text-white tracking-tight mt-1 leading-tight">
                  Your Trusted Partner for <br />
                  Technology & <span className="text-[#0066FF]">Business Growth</span>
                </h2>
                <p className="text-xs sm:text-sm text-[#5B6E88] dark:text-text-muted mt-3 leading-relaxed">
                  We combine technology, financial expertise and industry knowledge to deliver reliable, innovative and scalable solutions for businesses of all sizes. Our goal is to help you operate smarter, grow faster and achieve long-term success.
                </p>

                {/* 4 Checkpoints Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-4">
                  {[
                    "Experienced & professional team",
                    "Modern technology & secure systems",
                    "Trusted across multiple industries",
                    "End-to-end business solutions"
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs font-semibold text-[#0A1E3F] dark:text-text-light">
                      <CheckCircle2 className="w-4 h-4 text-[#0066FF] dark:text-primary-cyan shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <Link
                  to="/about"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold text-white bg-[#0066FF] hover:bg-[#0052CC] shadow-md shadow-blue-500/20 transition-all"
                >
                  Learn More About Us <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Center: Team Picture with Quote Overlay */}
            <div className="lg:col-span-4 rounded-3xl overflow-hidden shadow-xl border border-[#E2EAF4] dark:border-surface-border relative group min-h-[320px]">
              <img
                src="/images/team_collaboration.webp"
                alt="SMART Team collaboration"
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#06112B]/90 via-[#06112B]/20 to-transparent" />
              
              {/* Quote Card Overlay */}
              <div className="absolute bottom-4 left-4 right-4 p-3.5 rounded-2xl bg-white/95 dark:bg-navy-900/95 backdrop-blur-md shadow-lg border border-[#DCE6F2] dark:border-surface-border text-center">
                <p className="text-xs font-bold text-[#0A1E3F] dark:text-white italic">
                  “People + Technology = A Smarter Tomorrow”
                </p>
                <span className="text-[10px] font-bold text-[#0066FF] dark:text-primary-cyan mt-0.5 block">
                  — SMART Pvt Ltd
                </span>
              </div>
            </div>

            {/* Right: Mission, Vision, Values 3-Cards */}
            <div className="lg:col-span-3 space-y-3 flex flex-col justify-between text-left">
              
              {/* Mission */}
              <div className="p-4 rounded-2xl bg-white dark:bg-navy-800/80 border border-[#E2EAF4] dark:border-surface-border shadow-xs hover:border-[#0066FF]/40 transition-colors">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="p-1.5 rounded-lg bg-[#EBF3FC] text-[#0066FF] dark:bg-primary/20 dark:text-primary-cyan">
                    <Users className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-extrabold text-[#0A1E3F] dark:text-white uppercase tracking-wider">
                    Our Mission
                  </h4>
                </div>
                <p className="text-xs text-[#5B6E88] dark:text-text-muted leading-relaxed">
                  To empower businesses with technology and professional services for a smarter future.
                </p>
              </div>

              {/* Vision */}
              <div className="p-4 rounded-2xl bg-white dark:bg-navy-800/80 border border-[#E2EAF4] dark:border-surface-border shadow-xs hover:border-[#0066FF]/40 transition-colors">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="p-1.5 rounded-lg bg-[#EBF3FC] text-[#0066FF] dark:bg-primary/20 dark:text-primary-cyan">
                    <Globe className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-extrabold text-[#0A1E3F] dark:text-white uppercase tracking-wider">
                    Our Vision
                  </h4>
                </div>
                <p className="text-xs text-[#5B6E88] dark:text-text-muted leading-relaxed">
                  To be the most trusted and innovative business solutions provider in Sri Lanka and beyond.
                </p>
              </div>

              {/* Values */}
              <div className="p-4 rounded-2xl bg-white dark:bg-navy-800/80 border border-[#E2EAF4] dark:border-surface-border shadow-xs hover:border-[#0066FF]/40 transition-colors">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="p-1.5 rounded-lg bg-[#EBF3FC] text-[#0066FF] dark:bg-primary/20 dark:text-primary-cyan">
                    <Award className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-extrabold text-[#0A1E3F] dark:text-white uppercase tracking-wider">
                    Our Values
                  </h4>
                </div>
                <p className="text-xs text-[#5B6E88] dark:text-text-muted leading-relaxed">
                  Integrity, Innovation, Client Success, Continuous Improvement.
                </p>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* =========================================================================
          4. OUR PRODUCT: SMARTORIX ERP with POS (Royal Blue Gradient Banner)
         ========================================================================= */}
      <section className="py-16 bg-gradient-to-br from-[#0A2540] via-[#06112B] to-[#0A1838] text-white relative overflow-hidden border-y border-[#20345D]">
        
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Left Header & Features */}
            <div className="lg:col-span-4 space-y-4 text-left">
              <span className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-cyan-400/20 text-[#00D9FF] border border-cyan-400/30">
                OUR PRODUCT
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                SMARTORIX ERP <br />
                <span className="text-[#00D9FF]">with POS</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                A complete business management system for retail, distribution, inventory, finance, HR and more.
              </p>

              {/* 4 Feature Badges */}
              <div className="space-y-2 pt-2">
                {[
                  "All-in-one ERP solution",
                  "Cloud-based & secure",
                  "Realtime reports & analytics",
                  "Scalable for any business"
                ].map((point, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                    <CheckCircle2 className="w-4 h-4 text-[#00D9FF] shrink-0" />
                    <span>{point}</span>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex items-center gap-3">
                <button
                  onClick={() => onOpenQuote("SMARTORIX ERP")}
                  className="px-5 py-2.5 rounded-full text-xs font-bold text-white bg-[#0066FF] hover:bg-blue-600 shadow-md shadow-blue-500/30 transition-all flex items-center gap-1.5"
                >
                  View Demo <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <Link
                  to="/services/erp-pos"
                  className="px-4 py-2.5 rounded-full text-xs font-semibold text-slate-200 hover:text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-colors"
                >
                  Learn More
                </Link>
              </div>
            </div>

            {/* Center: Multi-Device Dashboard Illustration */}
            <div className="lg:col-span-5 relative">
              <div className="p-4 sm:p-6 rounded-3xl bg-navy-900/90 border border-cyan-500/30 shadow-2xl backdrop-blur-md space-y-4">
                
                {/* Simulated Desktop Bar */}
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <span className="text-[11px] font-bold text-slate-300 ml-2">
                      SMARTORIX Live Dashboard
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                    Online • POS Terminal #01
                  </span>
                </div>

                {/* Dashboard Metrics Cards */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-[10px] text-slate-400 block">Today's Sales</span>
                    <strong className="text-xs sm:text-sm text-emerald-400 font-bold">LKR 184,500</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-[10px] text-slate-400 block">Orders</span>
                    <strong className="text-xs sm:text-sm text-white font-bold">92 Bills</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-[10px] text-slate-400 block">Low Stock</span>
                    <strong className="text-xs sm:text-sm text-amber-400 font-bold">1 Alert</strong>
                  </div>
                </div>

                {/* Simulated Chart Bars */}
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
                  <div className="flex justify-between text-[11px] font-semibold text-slate-300">
                    <span>Revenue Velocity</span>
                    <span className="text-emerald-400 font-bold">+18.4%</span>
                  </div>
                  <div className="flex items-end gap-1.5 h-16 pt-2">
                    {[35, 55, 45, 75, 60, 85, 95, 80, 100].map((val, i) => (
                      <div key={i} className="flex-1 bg-gradient-to-t from-blue-600 to-cyan-400 rounded-t-sm transition-all" style={{ height: `${val}%` }} />
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-300 pt-1">
                  <span>ESC/POS Thermal Connected</span>
                  <span className="text-[#00D9FF]">Multi-branch Sync</span>
                </div>

              </div>
            </div>

            {/* Right: 8 Module Capability Icons + Script Note */}
            <div className="lg:col-span-3 space-y-4">
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { name: "Sales & POS", icon: ShoppingBag },
                  { name: "Inventory", icon: Layers },
                  { name: "Accounting", icon: Calculator },
                  { name: "HR & Payroll", icon: Users },
                  { name: "Reports", icon: BarChart3 },
                  { name: "Multi-Branch", icon: Building },
                  { name: "Cloud Access", icon: Cloud },
                  { name: "Mobile App", icon: Smartphone },
                ].map((mod, idx) => {
                  const Icon = mod.icon;
                  return (
                    <div 
                      key={idx} 
                      className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors flex items-center gap-2.5 text-left"
                    >
                      <div className="p-1.5 rounded-lg bg-blue-600/30 text-[#00D9FF]">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-semibold text-white">
                        {mod.name}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Script Note */}
              <div className="pt-2 text-right">
                <span className="text-sm sm:text-base font-bold text-cyan-300 italic">
                  “Manage Everything in One Place”
                </span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* =========================================================================
          5. OUR SERVICES: Complete Technology & Business Solutions
         ========================================================================= */}
      <section className="py-16 lg:py-20 bg-white dark:bg-navy-900 border-b border-[#E2EAF4] dark:border-surface-border">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10 text-left">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0066FF] dark:text-primary-cyan">
                OUR SERVICES
              </span>
              <h2 className="text-2xl sm:text-3xl lg:text-[34px] font-extrabold text-[#0A1E3F] dark:text-white tracking-tight mt-1">
                Complete Technology & <span className="text-[#0066FF]">Business Solutions.</span>
              </h2>
            </div>
            <Link
              to="/services"
              className="text-xs font-bold text-[#0066FF] hover:underline flex items-center gap-1 self-start sm:self-auto"
            >
              View All Services <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* 6 Service Cards with Real Image Covers (Left 8 Cols) */}
            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {coreServices.map((srv, idx) => (
                <Link
                  key={idx}
                  to={`/services/${srv.slug}`}
                  className="smart-card rounded-2xl overflow-hidden group flex flex-col justify-between text-left"
                >
                  <div>
                    <div className="h-32 overflow-hidden relative">
                      <img
                        src={srv.image}
                        alt={srv.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    </div>
                    <div className="p-4">
                      <h3 className="text-xs font-extrabold text-[#0A1E3F] dark:text-white group-hover:text-[#0066FF] transition-colors line-clamp-1">
                        {srv.title}
                      </h3>
                      <p className="text-[11px] text-[#5B6E88] dark:text-text-muted mt-1 leading-relaxed line-clamp-2">
                        {srv.desc}
                      </p>
                    </div>
                  </div>
                  <div className="p-4 pt-0 flex justify-end">
                    <span className="p-1.5 rounded-full bg-[#EBF3FC] text-[#0066FF] group-hover:bg-[#0066FF] group-hover:text-white transition-colors">
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            {/* Right 4 Cols: Why Choose SMART? Card */}
            <div className="lg:col-span-4 p-6 sm:p-7 rounded-3xl bg-[#F0F6FD] dark:bg-navy-800 border border-[#DCE6F2] dark:border-surface-border shadow-md space-y-6 text-left">
              
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-extrabold text-[#0A1E3F] dark:text-white">
                    Why Choose SMART?
                  </h3>
                  <p className="text-[11px] text-[#5B6E88] dark:text-text-muted mt-0.5">
                    Your complete technology & business growth partner.
                  </p>
                </div>
                <div className="p-2.5 rounded-2xl bg-white dark:bg-navy-700 text-[#0066FF] shadow-2xs">
                  <Award className="w-6 h-6" />
                </div>
              </div>

              {/* Checklist */}
              <ul className="space-y-3 text-xs text-[#0A1E3F] dark:text-text-light font-medium">
                {[
                  "One-stop solution for all your needs",
                  "Professional and experienced team",
                  "Affordable and transparent pricing",
                  "Client-focused approach",
                  "Ongoing support and maintenance"
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#0066FF] shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="pt-2">
                <button
                  onClick={() => onOpenQuote()}
                  className="w-full py-2.5 rounded-full text-xs font-bold text-white bg-[#0066FF] hover:bg-[#0052CC] shadow-md transition-all"
                >
                  Consult Our Team
                </button>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* =========================================================================
          6. INDUSTRIES WE SERVE & FEATURED PROJECTS & CLIENT SUCCESS
         ========================================================================= */}
      <section className="py-16 bg-[#F4F8FC] dark:bg-midnight border-b border-[#E2EAF4] dark:border-surface-border">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left 3 Cols: Industries We Serve */}
            <div className="lg:col-span-3 space-y-4 text-left">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#0066FF]">
                INDUSTRIES WE SERVE
              </span>
              <div className="grid grid-cols-2 gap-2">
                {industries.map((ind, idx) => {
                  const Icon = ind.icon;
                  return (
                    <div 
                      key={idx}
                      className="p-3 rounded-2xl bg-white dark:bg-navy-800 border border-[#E2EAF4] dark:border-surface-border text-center flex flex-col items-center justify-center shadow-2xs hover:border-[#0066FF] transition-colors"
                    >
                      <Icon className="w-4 h-4 text-[#0066FF] mb-1.5" />
                      <span className="text-[10px] font-bold text-[#0A1E3F] dark:text-text-light line-clamp-2">
                        {ind.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Center 6 Cols: Featured Projects: Real Projects. Real Results. */}
            <div className="lg:col-span-6 space-y-4 text-left">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#0066FF]">
                    FEATURED PROJECTS
                  </span>
                  <h3 className="text-xl font-extrabold text-[#0A1E3F] dark:text-white">
                    Real Projects. Real Results.
                  </h3>
                </div>
                <Link to="/projects" className="text-[11px] font-bold text-[#0066FF] hover:underline">
                  View All Projects →
                </Link>
              </div>

              {/* 4 Project Cards Grid with UI Screenshots */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {featuredProjects.map((proj, idx) => (
                  <Link
                    key={idx}
                    to={`/projects/${proj.slug}`}
                    className="smart-card rounded-2xl overflow-hidden group text-left flex flex-col justify-between"
                  >
                    <div>
                      <div className="h-24 overflow-hidden relative">
                        <img
                          src={proj.image}
                          alt={proj.name}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                      </div>
                      <div className="p-2.5">
                        <h4 className="text-[11px] font-bold text-[#0A1E3F] dark:text-white group-hover:text-[#0066FF] line-clamp-1">
                          {proj.name}
                        </h4>
                        <span className="text-[9px] text-[#5B6E88] dark:text-text-muted block">
                          {proj.category}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Right 3 Cols: Client Success Stats & Review */}
            <div className="lg:col-span-3 space-y-4 text-left">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#0066FF]">
                CLIENT SUCCESS
              </span>
              
              {/* Trust 4-Box — capability claims only, no fabricated metrics */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-2xl bg-white dark:bg-navy-800 border border-[#E2EAF4] dark:border-surface-border text-center">
                  <span className="text-sm font-extrabold text-[#0066FF]">Multi-Industry</span>
                  <span className="text-[10px] text-[#5B6E88] dark:text-text-muted block">Clients Served</span>
                </div>
                <div className="p-3 rounded-2xl bg-white dark:bg-navy-800 border border-[#E2EAF4] dark:border-surface-border text-center">
                  <span className="text-sm font-extrabold text-emerald-500">Transparent</span>
                  <span className="text-[10px] text-[#5B6E88] dark:text-text-muted block">Pricing & Scope</span>
                </div>
                <div className="p-3 rounded-2xl bg-white dark:bg-navy-800 border border-[#E2EAF4] dark:border-surface-border text-center">
                  <span className="text-sm font-extrabold text-[#0066FF]">End-to-End</span>
                  <span className="text-[10px] text-[#5B6E88] dark:text-text-muted block">Delivery</span>
                </div>
                <div className="p-3 rounded-2xl bg-white dark:bg-navy-800 border border-[#E2EAF4] dark:border-surface-border text-center">
                  <span className="text-sm font-extrabold text-amber-500">Dedicated</span>
                  <span className="text-[10px] text-[#5B6E88] dark:text-text-muted block">Support</span>
                </div>
              </div>

              {/* Testimonial Card */}
              <div className="p-4 rounded-2xl bg-white dark:bg-navy-800 border border-[#E2EAF4] dark:border-surface-border shadow-xs text-left space-y-2">
                <div className="flex items-center gap-1 text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                  ))}
                </div>
                <p className="text-[11px] text-[#4A5E78] dark:text-text-light italic leading-relaxed">
                  “SMART helped us digitize our operations with a custom ERP. Their support and service are exceptional!”
                </p>
                <div className="flex items-center gap-2 pt-1 border-t border-[#E2EAF4] dark:border-surface-border">
                  <div className="w-6 h-6 rounded-full bg-[#0066FF] text-white text-[10px] font-bold flex items-center justify-center">
                    M
                  </div>
                  <div>
                    <strong className="text-[11px] text-[#0A1E3F] dark:text-white block">Mehala T.</strong>
                    <span className="text-[9px] text-[#5B6E88]">Business Owner</span>
                  </div>
                </div>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* =========================================================================
          7. OUR BRANCHES & INTERACTIVE MAP & FAQ & FINAL CTA
         ========================================================================= */}
      <section className="py-16 bg-white dark:bg-navy-900">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left 3 Cols: Our Branches */}
            <div className="lg:col-span-3 space-y-4 text-left">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#0066FF]">
                OUR BRANCHES
              </span>
              <h3 className="text-xl font-extrabold text-[#0A1E3F] dark:text-white">
                Visit Our Branches.
              </h3>
              <p className="text-xs text-[#5B6E88] dark:text-text-muted">
                We're here to serve you across multiple locations in Sri Lanka.
              </p>

              {/* Branch Switcher Tabs */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {branches.map((b) => (
                  <button
                    key={b.branchId}
                    onClick={() => setActiveBranch(b)}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                      activeBranch.branchId === b.branchId
                        ? 'bg-[#0066FF] text-white shadow-2xs'
                        : 'bg-[#F0F6FD] text-[#4A5E78] hover:bg-[#E2EAF4]'
                    }`}
                  >
                    {b.city}
                  </button>
                ))}
              </div>

              {/* Active Branch Cards List */}
              <div className="space-y-3 pt-2">
                {branches.map((b) => (
                  <div 
                    key={b.branchId}
                    onClick={() => setActiveBranch(b)}
                    className={`p-3.5 rounded-2xl border text-xs cursor-pointer transition-all ${
                      activeBranch.branchId === b.branchId
                        ? 'border-[#0066FF] bg-[#F4F8FC] dark:bg-navy-800 shadow-2xs'
                        : 'border-[#E2EAF4] dark:border-surface-border bg-white dark:bg-navy-900 hover:border-[#0066FF]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <strong className="text-[#0A1E3F] dark:text-white font-bold">{b.name}</strong>
                      <span className="text-[9px] font-bold text-[#0066FF]">{b.badge}</span>
                    </div>
                    <p className="text-[#5B6E88] text-[11px]">{b.address}</p>
                    <p className="text-[#0066FF] font-bold text-[11px] mt-1">{b.phone}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Center-Left 3 Cols: Interactive Map */}
            <div className="lg:col-span-3 rounded-3xl overflow-hidden border border-[#E2EAF4] dark:border-surface-border shadow-md min-h-[340px] relative bg-slate-100">
              <iframe
                title={`Map for ${activeBranch.name}`}
                src={activeBranch.googleMapsEmbedUrl}
                className="w-full h-full min-h-[340px] border-0 grayscale-[10%]"
                loading="lazy"
              />
              <div className="absolute bottom-3 left-3 right-3 p-2.5 rounded-xl bg-white/95 dark:bg-navy-900/95 backdrop-blur-md text-xs flex items-center justify-between shadow-md">
                <div>
                  <p className="font-bold text-[#0A1E3F] dark:text-white text-[11px]">{activeBranch.city}</p>
                  <p className="text-[10px] text-[#5B6E88]">{activeBranch.address}</p>
                </div>
                <a
                  href="https://maps.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg bg-[#0066FF] text-white hover:bg-blue-600 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Center-Right 3 Cols: Frequently Asked Questions Accordion */}
            <div className="lg:col-span-3 space-y-3 text-left">
              <h3 className="text-base font-extrabold text-[#0A1E3F] dark:text-white">
                Frequently Asked Questions
              </h3>
              <div className="space-y-2">
                {homeFaqs.map((faq, idx) => {
                  const isOpen = openFaq === idx;
                  return (
                    <div 
                      key={idx}
                      className="p-3 rounded-2xl bg-[#F8FAFC] dark:bg-navy-800 border border-[#E2EAF4] dark:border-surface-border text-xs"
                    >
                      <button
                        onClick={() => setOpenFaq(isOpen ? -1 : idx)}
                        className="w-full text-left font-bold text-[#0A1E3F] dark:text-white flex items-center justify-between gap-2"
                      >
                        <span className="text-[11px]">{faq.q}</span>
                        <ChevronDown className={`w-3.5 h-3.5 text-[#0066FF] shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isOpen && (
                        <p className="text-[11px] text-[#5B6E88] dark:text-text-muted mt-2 pt-2 border-t border-[#E2EAF4] dark:border-surface-border leading-relaxed animate-in fade-in">
                          {faq.a}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Far Right 3 Cols: Let's Build Something Great Together CTA Box */}
            <div className="lg:col-span-3 p-5 rounded-3xl bg-gradient-to-br from-[#0A2540] to-[#0066FF] text-white shadow-xl space-y-4 text-left">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-200">
                  LET'S CONNECT
                </span>
                <h3 className="text-lg sm:text-xl font-extrabold mt-1 leading-tight">
                  Let's Build Something Great <span className="text-cyan-300">Together.</span>
                </h3>
                <p className="text-xs text-blue-100 mt-2 leading-relaxed">
                  Have a project in mind? Get in touch with us today for a free quotation and architecture consultation.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  onClick={() => onOpenQuote()}
                  className="w-full py-2.5 rounded-full text-xs font-bold text-[#0A1E3F] bg-white hover:bg-slate-100 shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  Get a Free Consultation <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <a
                  href={`https://wa.me/${company.contact.whatsapp.replace('+', '')}?text=${encodeURIComponent('Hi SMART Pvt Ltd, I would like to consult about your services.')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 rounded-full text-xs font-semibold text-white bg-emerald-500/90 hover:bg-emerald-500 shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Chat on WhatsApp
                </a>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* =========================================================================
          VIDEO MODAL PREVIEW
         ========================================================================= */}
      {isVideoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-2xl bg-navy-900 rounded-3xl p-6 border border-surface-border text-white space-y-4">
            <button
              onClick={() => setIsVideoOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold">SMART [PVT] LTD — Corporate Showcase</h3>
            <div className="aspect-video bg-black rounded-2xl flex items-center justify-center relative overflow-hidden">
              <img
                src="/images/SMART-BANNER-BG.webp"
                alt="Video placeholder"
                loading="lazy"
                className="w-full h-full object-cover opacity-60"
              />
              <div className="absolute flex flex-col items-center justify-center text-center p-4">
                <div className="w-16 h-16 rounded-full bg-[#0066FF] flex items-center justify-center shadow-lg text-white mb-2">
                  <Play className="w-8 h-8 fill-white ml-1" />
                </div>
                <p className="text-xs text-white font-semibold">SMART Pvt Ltd Corporate Video</p>
                <span className="text-[10px] text-slate-300">Intelligent Solutions. Smarter Future.</span>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
