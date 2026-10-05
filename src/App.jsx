import React, { useState, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import WhatsAppButton from './components/WhatsAppButton';
import QuoteModal from './components/QuoteModal';
import ClientRequestForm from './components/ClientRequestForm';

import HomePage from './pages/HomePage';

const AboutPage           = lazy(() => import('./pages/AboutPage'));
const ServicesPage        = lazy(() => import('./pages/ServicesPage'));
const ServiceDetailPage   = lazy(() => import('./pages/ServiceDetailPage'));
const SolutionsPage       = lazy(() => import('./pages/SolutionsPage'));
const ProjectsPage        = lazy(() => import('./pages/ProjectsPage'));
const ProjectDetailPage   = lazy(() => import('./pages/ProjectDetailPage'));
const PricingPage         = lazy(() => import('./pages/PricingPage'));
const InsightsPage        = lazy(() => import('./pages/InsightsPage'));
const InsightDetailPage   = lazy(() => import('./pages/InsightDetailPage'));
const ContactPage         = lazy(() => import('./pages/ContactPage'));
const ClientLoginPage     = lazy(() => import('./pages/ClientLoginPage'));
const ClientDashboardPage = lazy(() => import('./pages/ClientDashboardPage'));
const AdminPanelPage      = lazy(() => import('./pages/AdminPanelPage'));
const ERPApp              = lazy(() => import('./erp/ERPApp'));
const PrivacyPolicyPage   = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsPage           = lazy(() => import('./pages/TermsPage'));
const NotFoundPage        = lazy(() => import('./pages/NotFoundPage'));

const AuthProvider   = lazy(() => import('./context/AuthContext').then(m => ({ default: m.AuthProvider })));
const ProtectedRoute = lazy(() => import('./components/ProtectedRoute'));

function RouteFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
    </div>
  );
}

function PublicPage({ children }) {
  return <div className="public-page">{children}</div>;
}

// ── Standalone routes (NO Navbar / Footer / WhatsApp) ─────────────
// ERP, Client Dashboard, Admin Panel — all have their own layout
function StandaloneRoutes() {
  return (
    <Suspense fallback={
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#040D1F' }}>
        <div style={{ width:36, height:36, borderRadius:'50%', border:'3px solid rgba(0,102,255,0.2)', borderTopColor:'#0066FF', animation:'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <Routes>
        {/* ERP System */}
        <Route path="/erp/*" element={
          <AuthProvider><ProtectedRoute role="admin"><ERPApp /></ProtectedRoute></AuthProvider>
        } />
        {/* Client Dashboard */}
        <Route path="/client-dashboard" element={
          <AuthProvider><ProtectedRoute role="client"><ClientDashboardPage /></ProtectedRoute></AuthProvider>
        } />
        {/* Admin Panel (legacy) */}
        <Route path="/admin-panel" element={
          <AuthProvider><ProtectedRoute role="admin"><AdminPanelPage /></ProtectedRoute></AuthProvider>
        } />
        {/* No match → fall through to website routes */}
        <Route path="*" element={null} />
      </Routes>
    </Suspense>
  );
}

// ── Website routes (WITH Navbar / Footer / WhatsApp) ──────────────
function WebsiteRoutes() {
  const [isQuoteOpen,          setIsQuoteOpen]          = useState(false);
  const [quoteService,         setQuoteService]          = useState('');
  const [isClientRequestOpen,  setIsClientRequestOpen]   = useState(false);

  const handleOpenQuote         = (s = '') => { setQuoteService(s); setIsQuoteOpen(true); };
  const handleCloseQuote        = ()       => setIsQuoteOpen(false);
  const handleOpenClientRequest = ()       => setIsClientRequestOpen(true);
  const handleCloseClientRequest= ()       => setIsClientRequestOpen(false);

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#0A1E3F] dark:bg-navy-950 dark:text-white transition-colors duration-200">
      <Navbar onOpenQuote={() => handleOpenQuote()} />

      <main className="flex-grow">
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<HomePage onOpenQuote={handleOpenQuote} onOpenClientRequest={handleOpenClientRequest} />} />
            <Route path="/about" element={<PublicPage><AboutPage onOpenQuote={handleOpenQuote} onOpenClientRequest={handleOpenClientRequest} /></PublicPage>} />
            <Route path="/services" element={<PublicPage><ServicesPage onOpenQuote={handleOpenQuote} onOpenClientRequest={handleOpenClientRequest} /></PublicPage>} />
            <Route path="/services/:slug" element={<PublicPage><ServiceDetailPage onOpenQuote={handleOpenQuote} onOpenClientRequest={handleOpenClientRequest} /></PublicPage>} />
            <Route path="/solutions" element={<PublicPage><SolutionsPage onOpenQuote={handleOpenQuote} onOpenClientRequest={handleOpenClientRequest} /></PublicPage>} />
            <Route path="/projects" element={<PublicPage><ProjectsPage onOpenQuote={handleOpenQuote} /></PublicPage>} />
            <Route path="/projects/:slug" element={<PublicPage><ProjectDetailPage onOpenQuote={handleOpenQuote} /></PublicPage>} />
            <Route path="/pricing" element={<PublicPage><PricingPage onOpenQuote={handleOpenQuote} onOpenClientRequest={handleOpenClientRequest} /></PublicPage>} />
            <Route path="/insights" element={<PublicPage><InsightsPage /></PublicPage>} />
            <Route path="/insights/:slug" element={<PublicPage><InsightDetailPage onOpenQuote={handleOpenQuote} onOpenClientRequest={handleOpenClientRequest} /></PublicPage>} />
            <Route path="/contact" element={<PublicPage><ContactPage onOpenQuote={handleOpenQuote} /></PublicPage>} />
            <Route path="/locations" element={<PublicPage><ContactPage onOpenQuote={handleOpenQuote} /></PublicPage>} />
            <Route path="/client-login" element={
              <AuthProvider><PublicPage><ClientLoginPage onOpenQuote={handleOpenQuote} /></PublicPage></AuthProvider>
            } />
            <Route path="/privacy" element={<PublicPage><PrivacyPolicyPage /></PublicPage>} />
            <Route path="/terms" element={<PublicPage><TermsPage /></PublicPage>} />
            <Route path="/erp-system" element={<Navigate to="/erp" replace />} />
            {/* Skip standalone routes — they are handled above */}
            <Route path="/erp/*" element={null} />
            <Route path="/client-dashboard" element={null} />
            <Route path="/admin-panel" element={null} />
            <Route path="*" element={<PublicPage><NotFoundPage /></PublicPage>} />
          </Routes>
        </Suspense>
      </main>

      <Footer onOpenQuote={() => handleOpenQuote()} />
      <WhatsAppButton />

      <QuoteModal
        isOpen={isQuoteOpen}
        onClose={handleCloseQuote}
        initialService={quoteService}
      />
      <ClientRequestForm
        isOpen={isClientRequestOpen}
        onClose={handleCloseClientRequest}
      />
    </div>
  );
}

// ── Root Router ───────────────────────────────────────────────────
function AppRouter() {
  const location = useLocation();
  const path = location.pathname;

  // These paths use their own full-screen layout — no website chrome
  const isStandalone =
    path.startsWith('/erp') ||
    path.startsWith('/client-dashboard') ||
    path.startsWith('/admin-panel');

  if (isStandalone) return <StandaloneRoutes />;
  return <WebsiteRoutes />;
}

export default function App() {
  return (
    <ThemeProvider>
      <Router>
        <AppRouter />
      </Router>
    </ThemeProvider>
  );
}
