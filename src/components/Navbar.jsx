import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { company } from '../config/company';
import {
  Menu, X, Sun, Moon, Search,
  User, ArrowRight
} from 'lucide-react';

export default function Navbar({ onOpenQuote }) {
  const { isDark, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const location = useLocation();

  useEffect(() => {
    let previousScrollY = window.scrollY;
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setScrolled(currentScrollY > 15);
      if (currentScrollY < 80 || currentScrollY < previousScrollY) {
        setIsHeaderVisible(true);
      } else if (currentScrollY > previousScrollY) {
        setIsHeaderVisible(false);
        setIsOpen(false);
      }
      previousScrollY = currentScrollY;
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => { setIsOpen(false); }, [location.pathname]);

  const navLinks = [
    { name: "Home",       path: "/" },
    { name: "About",      path: "/about" },
    { name: "Services",   path: "/services" },
    { name: "Products",   path: "/services/erp-pos" },
    { name: "Industries", path: "/solutions" },
    { name: "Projects",   path: "/projects" },
    { name: "Pricing",    path: "/pricing" },
    { name: "Blog",       path: "/insights" },
    { name: "Contact",    path: "/contact" },
  ];

  // ── Color tokens ─────────────────────────────────────────────────
  // Light mode : white bg, navy text, gold underline
  // Dark mode  : navy-950 bg, white text, gold underline
  // Scrolled   : add backdrop-blur + stronger shadow (same bg logic)

  const headerBase = [
    'fixed inset-x-0 top-0 z-50',
    'transition-[transform,padding,box-shadow,border-color,background-color]',
    'duration-300 ease-out border-b',
    isHeaderVisible ? 'translate-y-0' : '-translate-y-full',
  ].join(' ');

  const headerTheme = isDark
    ? scrolled
      ? 'bg-[#040D1F]/95 backdrop-blur-md border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.5)] py-1'
      : 'bg-[#040D1F]/90 backdrop-blur-sm border-white/5 shadow-none py-2.5'
    : scrolled
      ? 'bg-white/95 backdrop-blur-md border-[#E2EAF4] shadow-[0_4px_24px_rgba(10,30,63,0.1)] py-1'
      : 'bg-white/90 backdrop-blur-sm border-transparent shadow-none py-2.5';

  const linkBase = 'relative mx-1 shrink-0 whitespace-nowrap px-2 py-2 text-[13px] font-medium tracking-[0.01em] transition-colors duration-200 after:absolute after:bottom-0 after:left-2 after:h-0.5 after:rounded-full after:transition-all after:duration-300';
  const linkActive = isDark
    ? 'text-white after:w-[calc(100%-1rem)] after:bg-[#C59A5C]'
    : 'text-[#0A1E3F] after:w-[calc(100%-1rem)] after:bg-[#C59A5C]';
  const linkInactive = isDark
    ? 'text-white/70 after:w-0 after:bg-[#C59A5C] hover:text-white hover:after:w-[calc(100%-1rem)]'
    : 'text-[#374151] after:w-0 after:bg-[#C59A5C] hover:text-[#0A1E3F] hover:after:w-[calc(100%-1rem)]';

  const iconBtn = isDark
    ? 'p-2.5 text-white/60 transition-colors hover:text-white'
    : 'p-2.5 text-[#64748B] transition-colors hover:text-[#0A1E3F]';

  const dividerBorder = isDark ? 'border-white/10' : 'border-[#E2EAF4]';
  const navBorder     = isDark ? 'border-white/10' : 'border-[#E2EAF4]';

  const loginCls = isDark
    ? 'flex items-center gap-2 border-l border-white/10 py-2 pl-4 pr-2 text-xs font-bold text-white/70 hover:text-[#C59A5C] transition-colors'
    : 'flex items-center gap-2 border-l border-[#E2EAF4] py-2 pl-4 pr-2 text-xs font-bold text-[#374151] hover:text-[#0A1E3F] transition-colors';

  const mobileBtnCls = isDark
    ? 'p-2.5 text-white/70 hover:text-white'
    : 'p-2.5 text-[#374151] hover:text-[#0A1E3F]';

  const mobileMenuBg  = isDark ? '#06111F' : '#FFFFFF';
  const mobileLinkActive = isDark
    ? 'border-l-2 border-[#C59A5C] bg-white/5 text-white'
    : 'border-l-2 border-[#C59A5C] bg-[#FDF8F2] text-[#0A1E3F]';
  const mobileLinkInactive = isDark
    ? 'text-white/60 hover:text-white hover:bg-white/5'
    : 'text-[#374151] hover:text-[#0A1E3F] hover:bg-[#F8FAFC]';

  return (
    <header className={`${headerBase} ${headerTheme}`}>
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-[52px] items-center justify-between">

          {/* Logo — light logo in light mode, dark logo in dark mode */}
          <Link to="/" className="relative flex shrink-0 items-center gap-2 focus:outline-none">
            <img
              src={isDark ? company.logos.darkMode : company.logos.lightMode}
              alt="SMART [PVT] LTD Logo"
              className="h-12 w-auto object-contain transition-transform duration-300 hover:scale-[1.035] sm:h-[62px]"
            />
          </Link>

          {/* Desktop Nav Links */}
          <nav className={`hidden items-center gap-0.5 border-l ${navBorder} pl-4 xl:flex`}>
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.name}
                  to={link.path}
                  className={`${linkBase} ${isActive ? linkActive : linkInactive}`}
                >
                  {link.name}
                </Link>
              );
            })}
          </nav>

          {/* Right Controls */}
          <div className="hidden shrink-0 items-center gap-1 xl:flex">

            {/* Search */}
            <button onClick={() => onOpenQuote()} aria-label="Search" className={iconBtn}>
              <Search className="w-4 h-4" />
            </button>

            {/* Theme Toggle */}
            <button onClick={toggleTheme} aria-label="Toggle Theme" className={iconBtn}>
              {isDark
                ? <Moon className="w-4 h-4 text-amber-400" />
                : <Sun className="w-4 h-4 text-amber-500" />}
            </button>

            {/* Login */}
            <Link to="/client-login" className={loginCls}>
              <User className="w-3.5 h-3.5 text-[#C59A5C]" />
              Login
            </Link>

            {/* Get a Quote */}
            <button
              onClick={() => onOpenQuote()}
              className="ml-1 flex items-center gap-2 rounded-lg bg-[#0A1E3F] px-5 py-2.5 text-xs font-extrabold text-white shadow-[0_4px_14px_rgba(10,30,63,0.25)] transition-all hover:-translate-y-0.5 hover:bg-[#1D3A6B] active:translate-y-0 dark:bg-[#C59A5C] dark:text-[#0A1E3F] dark:hover:bg-[#D4A96A]"
            >
              Get a Quote <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Mobile Controls */}
          <div className="flex items-center space-x-1 xl:hidden">
            <button onClick={toggleTheme} className={mobileBtnCls}>
              {isDark
                ? <Moon className="w-4 h-4 text-amber-400" />
                : <Sun className="w-4 h-4 text-amber-500" />}
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className={mobileBtnCls}
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>

        {/* Mobile Drawer */}
        {isOpen && (
          <div
            className={`xl:hidden mt-1.5 space-y-1 border-t ${dividerBorder} px-4 pb-5 pt-3 shadow-xl animate-in slide-in-from-top-3`}
            style={{ backgroundColor: mobileMenuBg }}
          >
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                className={`block px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  location.pathname === link.path ? mobileLinkActive : mobileLinkInactive
                }`}
              >
                {link.name}
              </Link>
            ))}

            <div className={`pt-3 border-t ${dividerBorder} space-y-2`}>
              <Link
                to="/client-login"
                className={`flex w-full items-center justify-center gap-2 border ${isDark ? 'border-white/10 bg-white/5 text-white' : 'border-[#E2EAF4] bg-[#F8FAFC] text-[#0A1E3F]'} py-2.5 text-xs font-bold rounded-lg`}
              >
                <User className="h-4 w-4 text-[#C59A5C]" />
                Login
              </Link>
              <button
                onClick={() => { setIsOpen(false); onOpenQuote(); }}
                className="w-full rounded-lg bg-[#0A1E3F] py-2.5 text-xs font-bold text-white hover:bg-[#1D3A6B] dark:bg-[#C59A5C] dark:text-[#0A1E3F] dark:hover:bg-[#D4A96A]"
              >
                Get a Quote →
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
