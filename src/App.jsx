import React, { useState, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';   // ← eager, single instance
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import WhatsAppButton from './components/WhatsAppButton';
import QuoteModal from './components/QuoteModal';
import ClientRequestForm from './components/ClientRequestForm';
import ErrorBoundary from './components/ErrorBoundary';

import HomePage from './pages/HomePage';

const AboutPage           = lazy(() => import('./pages/AboutPage'));
const ServicesPage        = lazy(() => import('./pages/ServicesPage'));
const ServiceDetailPage   = lazy(() => import('./pages/ServiceDetailPage'));
const QrServicePage       = lazy(() => import('./pages/QrServicePage'));
const SolutionsPage       = lazy(() => import('./pages/SolutionsPage'));
const ProjectsPage        = lazy(() => import('./pages/ProjectsPage'));
const ProjectDetailPage   = lazy(() => import('./pages/ProjectDetailPage'));
const PricingPage         = lazy(() => import('./pages/PricingPage'));
const InsightsPage        = lazy(() => import('./pages/InsightsPage'));
const InsightDetailPage   = lazy(() => import('./pages/InsightDetailPage'));
const ContactPage         = lazy(() => import('./pages/ContactPage'));
const ClientRequestQRPage = lazy(() => import('./pages/ClientRequestQRPage'));
const ClientLoginPage     = lazy(() => import('./pages/ClientLoginPage'));
const ClientDashboardPage = lazy(() => import('./pages/ClientDashboardPage'));
const AdminPanelPage      = lazy(() => import('./pages/AdminPanelPage'));
const ERPApp              = lazy(() => import('./erp/ERPApp'));
const StaffLoginPage      = lazy(() => import('./staff/StaffLoginPage'));
const StaffPortalApp      = lazy(() => import('./staff/StaffPortalApp'));
const StaffCheckInPage    = lazy(() => import('./pages/StaffCheckInPage'));
const PrivacyPolicyPage   = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsPage           = lazy(() => import('./pages/TermsPage'));
const NotFoundPage        = lazy(() => import('./pages/NotFoundPage'));
const ProtectedRoute      = lazy(() => import('./components/ProtectedRoute'));

// ── Fallbacks ─────────────────────────────────────────────────────
function RouteFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
    </div>
  );
}

function ERPFallback() {
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#040D1F' }}>
      <div style={{ width:36, height:36, borderRadius:'50%', border:'3px solid rgba(0,102,255,0.2)', borderTopColor:'#0066FF', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function PublicPage({ children }) {
  return <div className="public-page">{children}</div>;
}

// ── Standalone (ERP / Dashboard) — NO website chrome ──────────────
function StandaloneRoutes() {
  return (
    <Suspense fallback={<ERPFallback />}>
      <Routes>
        <Route path="/erp/*" element={
          <ProtectedRoute role="admin"><ERPApp /></ProtectedRoute>
        } />
        <Route path="/client-dashboard" element={
          <ProtectedRoute role="client"><ClientDashboardPage /></ProtectedRoute>
        } />
        <Route path="/admin-panel" element={
          <ProtectedRoute role="admin"><AdminPanelPage /></ProtectedRoute>
        } />
        <Route path="/staff-login" element={<StaffLoginPage />} />
        <Route path="/staff-checkin" element={<StaffCheckInPage />} />
        <Route path="/staff-portal" element={
          <ProtectedRoute role="staff" redirectTo="/staff-login"><StaffPortalApp /></ProtectedRoute>
        } />
        <Route path="/request" element={<ClientRequestQRPage />} />
        <Route path="/qr-request" element={<ClientRequestQRPage />} />
        <Route path="*" element={<ERPFallback />} />
      </Routes>
    </Suspense>
  );
}

// ── Website (with Navbar / Footer / WhatsApp) ─────────────────────
function WebsiteRoutes() {
  const { pathname } = useLocation();
  // QR scans get a phone-first "app" view without the website chrome.
  const isQrApp = pathname.startsWith('/services/qr/');
  const [isQuoteOpen,         setIsQuoteOpen]         = useState(false);
  const [quoteService,        setQuoteService]         = useState('');
  const [quoteSource,         setQuoteSource]          = useState('Quote Request');
  const [quoteTitle,          setQuoteTitle]           = useState('Request a Quote');
  const [quoteEyebrow,        setQuoteEyebrow]         = useState('Get a Quote');
  const [quoteSubtitle,       setQuoteSubtitle]        = useState('Tell us what you need — our team replies within 2 business hours.');
  const [isClientRequestOpen, setIsClientRequestOpen]  = useState(false);

  const handleOpenQuote = (s = '', opts = {}) => {
    setQuoteService(s);
    const isQR = window.location.pathname.startsWith('/services/qr/');
    setQuoteSource(isQR ? 'QR Scan' : (opts.source || 'Quote Request'));
    setQuoteTitle(opts.title || 'Request a Quote');
    setQuoteEyebrow(opts.eyebrow || 'Get a Quote');
    setQuoteSubtitle(opts.subtitle || 'Tell us what you need — our team replies within 2 business hours.');
    setIsQuoteOpen(true);
  };
  const handleCloseQuote         = ()       => setIsQuoteOpen(false);
  const handleOpenClientRequest  = ()       => setIsClientRequestOpen(true);
  const handleCloseClientRequest = ()       => setIsClientRequestOpen(false);

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-200 ${isQrApp ? 'bg-[#040D1F]' : 'bg-white text-[#0A1E3F] dark:bg-navy-950 dark:text-white'}`}>
      {!isQrApp && <Navbar onOpenQuote={() => handleOpenQuote()} />}
      <main className="flex-grow">
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<HomePage onOpenQuote={handleOpenQuote} onOpenClientRequest={handleOpenClientRequest} />} />
            <Route path="/about" element={<PublicPage><AboutPage onOpenQuote={handleOpenQuote} onOpenClientRequest={handleOpenClientRequest} /></PublicPage>} />
            <Route path="/services" element={<PublicPage><ServicesPage onOpenQuote={handleOpenQuote} onOpenClientRequest={handleOpenClientRequest} /></PublicPage>} />
            {/* QR codes point here. Same page a normal service visit shows —
                scanning simply opens that service's details. */}
            <Route path="/services/qr/:slug" element={<QrServicePage onOpenQuote={handleOpenQuote} />} />
            <Route path="/services/:slug" element={<PublicPage><ServiceDetailPage onOpenQuote={handleOpenQuote} onOpenClientRequest={handleOpenClientRequest} /></PublicPage>} />
            <Route path="/solutions" element={<PublicPage><SolutionsPage onOpenQuote={handleOpenQuote} onOpenClientRequest={handleOpenClientRequest} /></PublicPage>} />
            <Route path="/projects" element={<PublicPage><ProjectsPage onOpenQuote={handleOpenQuote} /></PublicPage>} />
            <Route path="/projects/:slug" element={<PublicPage><ProjectDetailPage onOpenQuote={handleOpenQuote} /></PublicPage>} />
            <Route path="/pricing" element={<PublicPage><PricingPage onOpenQuote={handleOpenQuote} onOpenClientRequest={handleOpenClientRequest} /></PublicPage>} />
            <Route path="/insights" element={<PublicPage><InsightsPage /></PublicPage>} />
            <Route path="/insights/:slug" element={<PublicPage><InsightDetailPage onOpenQuote={handleOpenQuote} onOpenClientRequest={handleOpenClientRequest} /></PublicPage>} />
            <Route path="/contact" element={<PublicPage><ContactPage onOpenQuote={handleOpenQuote} /></PublicPage>} />
            <Route path="/locations" element={<PublicPage><ContactPage onOpenQuote={handleOpenQuote} /></PublicPage>} />
            <Route path="/client-login" element={<PublicPage><ClientLoginPage onOpenQuote={handleOpenQuote} /></PublicPage>} />
            <Route path="/request" element={<ClientRequestQRPage />} />
            <Route path="/qr-request" element={<ClientRequestQRPage />} />
            <Route path="/privacy" element={<PublicPage><PrivacyPolicyPage /></PublicPage>} />
            <Route path="/terms" element={<PublicPage><TermsPage /></PublicPage>} />
            <Route path="/erp-system" element={<Navigate to="/erp" replace />} />
            <Route path="*" element={<PublicPage><NotFoundPage /></PublicPage>} />
          </Routes>
        </Suspense>
      </main>
      {!isQrApp && <Footer onOpenQuote={() => handleOpenQuote()} />}
      {!isQrApp && <WhatsAppButton />}
      <QuoteModal isOpen={isQuoteOpen} onClose={handleCloseQuote} initialService={quoteService} source={quoteSource} title={quoteTitle} eyebrow={quoteEyebrow} subtitle={quoteSubtitle} />
      <ClientRequestForm isOpen={isClientRequestOpen} onClose={handleCloseClientRequest} />
    </div>
  );
}

// ── Root: single AuthProvider wraps everything ────────────────────
function AppRouter() {
  const { pathname } = useLocation();

  const isStandalone =
    pathname.startsWith('/erp') ||
    pathname.startsWith('/client-dashboard') ||
    pathname.startsWith('/admin-panel') ||
    pathname.startsWith('/staff-portal') ||
    pathname.startsWith('/staff-login') ||
    pathname.startsWith('/staff-checkin');

  return isStandalone ? <StandaloneRoutes /> : <WebsiteRoutes />;
}

export default function App() {
  return (
    <ThemeProvider>
      <Router>
        {/* Single AuthProvider at app root — shared across ALL routes */}
        <AuthProvider>
          {/* Top-level error boundary: a crash in any route or form shows a
              friendly reload panel instead of a blank page */}
          <ErrorBoundary>
            <AppRouter />
          </ErrorBoundary>
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
}
