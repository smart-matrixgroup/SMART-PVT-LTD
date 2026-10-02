import React, { useState, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import WhatsAppButton from './components/WhatsAppButton';
import QuoteModal from './components/QuoteModal';
import ClientRequestForm from './components/ClientRequestForm';

// HomePage loads eagerly (first paint). Every other route is code-split
// into its own chunk so a visitor only downloads the page they asked for.
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
const PrivacyPolicyPage   = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsPage           = lazy(() => import('./pages/TermsPage'));
const NotFoundPage        = lazy(() => import('./pages/NotFoundPage'));

// Firebase Auth is only relevant to the client/admin routes — lazy-load
// the provider + guard too, so public marketing pages (the vast majority
// of traffic) never download the Firebase SDK at all.
const AuthProvider  = lazy(() => import('./context/AuthContext').then(m => ({ default: m.AuthProvider })));
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

function AppContent() {
  const [isQuoteOpen, setIsQuoteOpen]               = useState(false);
  const [quoteService, setQuoteService]             = useState('');
  const [isClientRequestOpen, setIsClientRequestOpen] = useState(false);

  const handleOpenQuote = (serviceName = '') => {
    setQuoteService(serviceName);
    setIsQuoteOpen(true);
  };

  const handleCloseQuote = () => {
    setIsQuoteOpen(false);
  };

  const handleOpenClientRequest = () => setIsClientRequestOpen(true);
  const handleCloseClientRequest = () => setIsClientRequestOpen(false);

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#0A1E3F] dark:bg-navy-950 dark:text-white transition-colors duration-200">
      
      {/* Navigation Header */}
      <Navbar onOpenQuote={() => handleOpenQuote()} />

      {/* Main Content Area */}
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
          <Route path="/client-dashboard" element={
            <AuthProvider><ProtectedRoute role="client"><ClientDashboardPage /></ProtectedRoute></AuthProvider>
          } />
          <Route path="/admin-panel" element={
            <AuthProvider><ProtectedRoute role="admin"><AdminPanelPage /></ProtectedRoute></AuthProvider>
          } />
          {/* Legacy link — admin portal now lives at /admin-panel */}
          <Route path="/erp-system" element={<Navigate to="/admin-panel" replace />} />
          <Route path="/privacy" element={<PublicPage><PrivacyPolicyPage /></PublicPage>} />
          <Route path="/terms" element={<PublicPage><TermsPage /></PublicPage>} />
          <Route path="*" element={<PublicPage><NotFoundPage /></PublicPage>} />
        </Routes>
        </Suspense>
      </main>

      {/* Footer */}
      <Footer onOpenQuote={() => handleOpenQuote()} />

      {/* Floating WhatsApp Action */}
      <WhatsAppButton />

      {/* Interactive 5-Step Quote Modal */}
      <QuoteModal 
        isOpen={isQuoteOpen} 
        onClose={handleCloseQuote} 
        initialService={quoteService} 
      />

      {/* Client Request / Get Started Form */}
      <ClientRequestForm
        isOpen={isClientRequestOpen}
        onClose={handleCloseClientRequest}
      />

    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <Router>
        <AppContent />
      </Router>
    </ThemeProvider>
  );
}
