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

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const navLinks = [
    { name: "Home", path: "/" },
    { name: "About", path: "/about" },
    { name: "Services", path: "/services" },
    { name: "Products", path: "/services/erp-pos" },
    { name: "Industries", path: "/solutions" },
    { name: "Projects", path: "/projects" },
    { name: "Pricing", path: "/pricing" },
    { name: "Blog", path: "/insights" },
    { name: "Contact", path: "/contact" },
  ];

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-[transform,background-color,padding,box-shadow] duration-300 ease-out ${
        isHeaderVisible ? 'translate-y-0' : '-translate-y-full'
      } ${
        scrolled
          ? 'bg-white/97 py-1 shadow-[0_5px_22px_rgba(10,30,63,.08)] dark:bg-navy-950/97'
          : 'bg-white/93 py-2.5 shadow-[0_3px_18px_rgba(10,30,63,.045)] dark:bg-navy-950/93'
      }`}>
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-[52px] items-center justify-between">
          
          {/* Brand Logo */}
          <Link to="/" className="relative flex shrink-0 items-center gap-2 focus:outline-none">
            <span className="absolute left-2 top-1/2 h-9 w-24 -translate-y-1/2 rounded-full bg-[#E9DCC7]/45 blur-xl" />
            <img 
              src={isDark ? company.logos.darkMode : company.logos.lightMode} 
              alt="SMART [PVT] LTD Logo" 
              className="relative h-12 w-auto object-contain drop-shadow-[0_4px_8px_rgba(10,30,63,.13)] transition-transform duration-300 hover:scale-[1.035] sm:h-[62px]"
            />
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden items-center gap-0.5 border-l border-[#D8E0E9] pl-4 dark:border-surface-border xl:flex">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.name}
                  to={link.path}
                  className={`relative mx-1 shrink-0 whitespace-nowrap px-2 py-2 text-[11px] font-medium tracking-[0.01em] transition-colors duration-300 after:absolute after:bottom-0 after:left-2 after:h-0.5 after:rounded-full after:transition-all after:duration-300 ${
                    isActive 
                      ? 'text-[#0A1E3F] after:w-[calc(100%-1rem)] after:bg-[#C59A5C] dark:text-[#F2C98D]' 
                      : 'text-[#53657C] after:w-0 after:bg-[#C59A5C] hover:text-[#0A1E3F] hover:after:w-[calc(100%-1rem)] dark:text-text-muted dark:hover:text-white'
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </nav>

          {/* Right Action Controls */}
          <div className="hidden shrink-0 items-center gap-1.5 xl:flex">
            
            {/* Search Button */}
            <button
              onClick={() => onOpenQuote()}
              aria-label="Search"
              className="p-2.5 text-[#64748B] transition-colors hover:text-[#0A1E3F] dark:text-text-muted dark:hover:text-white"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Theme Toggle (Sun / Moon) */}
            <button
              onClick={toggleTheme}
              aria-label="Toggle Theme"
              className="p-2.5 text-[#64748B] transition-colors hover:text-[#C59A5C] dark:text-text-muted dark:hover:text-[#F2C98D]"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Sun className="w-4 h-4 text-[#5B6E88] hover:text-[#C59A5C]" />}
            </button>

            {/* Client Portal Button (Pill with User icon) */}
            <Link
              to="/client-login"
              className="flex items-center gap-2 border-l border-[#D8E0E9] py-2 pl-4 pr-2 text-xs font-bold text-[#0A1E3F] transition-colors hover:text-[#8A6235] dark:border-surface-border dark:text-white dark:hover:text-[#F2C98D]"
            >
              <User className="w-3.5 h-3.5 text-[#8A6235]" />
              Client Portal
            </Link>

            {/* Get a Quote Button (Bright Blue Pill with Arrow) */}
            <button
              onClick={() => onOpenQuote()}
              className="flex items-center gap-2 rounded-lg bg-[#102A4C] px-5 py-2.5 text-xs font-extrabold text-white shadow-[0_7px_16px_rgba(10,30,63,.2)] transition-all hover:-translate-y-0.5 hover:bg-[#1D467A] active:translate-y-0 dark:bg-[#C59A5C] dark:text-[#0A1E3F]"
            >
              Get a Quote <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Mobile Menu & Theme Toggle */}
          <div className="flex items-center space-x-2 xl:hidden">
            <button
              onClick={toggleTheme}
              className="p-2.5 text-[#5B6E88] hover:text-[#C59A5C] dark:text-text-muted"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Sun className="w-4 h-4 text-[#8A6235]" />}
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2.5 text-[#0A1E3F] hover:text-[#C59A5C] dark:text-white"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>

      {/* Mobile Drawer */}
      {isOpen && (
        <div className="xl:hidden mt-1.5 space-y-2 border-t border-[#E2EAF4] bg-white px-4 pb-5 pt-3 shadow-xl animate-in slide-in-from-top-3 dark:border-surface-border dark:bg-navy-900">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              to={link.path}
              className={`block px-3 py-2 rounded-xl text-sm font-semibold ${
                location.pathname === link.path
                  ? 'border-l-2 border-[#C59A5C] bg-[#FCF8F2] text-[#0A1E3F] dark:bg-primary/20 dark:text-[#F2C98D]'
                  : 'text-[#3E526C] hover:text-[#8A6235] dark:text-text-muted'
              }`}
            >
              {link.name}
            </Link>
          ))}

          <div className="pt-3 border-t border-[#E2EAF4] dark:border-surface-border space-y-2">
            <Link
              to="/client-login"
              className="flex w-full items-center justify-center gap-2 border border-[#E4D6C2] bg-[#FCF8F2] py-2.5 text-xs font-bold text-[#0A1E3F] dark:border-surface-border dark:bg-navy-800 dark:text-white"
            >
              <User className="h-4 w-4 text-[#8A6235]" />
              Client Portal
            </Link>
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenQuote();
              }}
              className="w-full rounded-lg bg-[#102A4C] py-2.5 text-xs font-bold text-white hover:bg-[#1D467A]"
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
