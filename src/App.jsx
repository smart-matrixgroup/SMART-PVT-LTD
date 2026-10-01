import React, { useState, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import WhatsAppButton from './components/WhatsAppButton';
import QuoteModal from './components/QuoteModal';

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
  const [isQuoteOpen, setIsQuoteOpen] = useState(false);
  const [quoteService, setQuoteService] = useState('');

  const handleOpenQuote = (serviceName = '') => {
    setQuoteService(serviceName);
    setIsQuoteOpen(true);
  };

  const handleCloseQuote = () => {
    setIsQuoteOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#0A1E3F] dark:bg-navy-950 dark:text-white transition-colors duration-200">
      
      {/* Navigation Header */}
      <Navbar onOpenQuote={() => handleOpenQuote()} />

      {/* Main Content Area */}
      <main className="flex-grow">
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<HomePage onOpenQuote={handleOpenQuote} />} />
          <Route path="/about" element={<PublicPage><AboutPage onOpenQuote={handleOpenQuote} /></PublicPage>} />
          <Route path="/services" element={<PublicPage><ServicesPage onOpenQuote={handleOpenQuote} /></PublicPage>} />
          <Route path="/services/:slug" element={<PublicPage><ServiceDetailPage onOpenQuote={handleOpenQuote} /></PublicPage>} />
          <Route path="/solutions" element={<PublicPage><SolutionsPage onOpenQuote={handleOpenQuote} /></PublicPage>} />
          <Route path="/projects" element={<PublicPage><ProjectsPage onOpenQuote={handleOpenQuote} /></PublicPage>} />
          <Route path="/projects/:slug" element={<PublicPage><ProjectDetailPage onOpenQuote={handleOpenQuote} /></PublicPage>} />
          <Route path="/pricing" element={<PublicPage><PricingPage onOpenQuote={handleOpenQuote} /></PublicPage>} />
          <Route path="/insights" element={<PublicPage><InsightsPage /></PublicPage>} />
          <Route path="/insights/:slug" element={<PublicPage><InsightDetailPage onOpenQuote={handleOpenQuote} /></PublicPage>} />
          <Route path="/contact" element={<PublicPage><ContactPage onOpenQuote={handleOpenQuote} /></PublicPage>} />
          <Route path="/locations" element={<PublicPage><ContactPage onOpenQuote={handleOpenQuote} /></PublicPage>} />
          <Route path="/client-login" element={<PublicPage><ClientLoginPage onOpenQuote={handleOpenQuote} /></PublicPage>} />
          <Route path="/client-dashboard" element={<ClientDashboardPage />} />
          <Route path="/admin-panel" element={<AdminPanelPage />} />
          <Route path="/erp-system" element={
            <div className="min-h-screen flex items-center justify-center bg-navy-950 text-white">
              <div className="text-center space-y-4 p-8">
                <div className="w-16 h-16 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto">
                  <span className="text-2xl">⚙️</span>
                </div>
                <h1 className="text-2xl font-extrabold">SMARTORIX ERP System</h1>
                <p className="text-text-muted text-sm">Admin portal — Phase 2 deployment in progress.</p>
                <button onClick={() => { sessionStorage.clear(); window.location.href='/client-login'; }}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover">
                  ← Back to Login
                </button>
              </div>
            </div>
          } />
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
