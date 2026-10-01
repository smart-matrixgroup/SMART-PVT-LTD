import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import WhatsAppButton from './components/WhatsAppButton';
import QuoteModal from './components/QuoteModal';

// Pages
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import ServicesPage from './pages/ServicesPage';
import ServiceDetailPage from './pages/ServiceDetailPage';
import SolutionsPage from './pages/SolutionsPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import PricingPage from './pages/PricingPage';
import InsightsPage from './pages/InsightsPage';
import InsightDetailPage from './pages/InsightDetailPage';
import ContactPage from './pages/ContactPage';
import ClientLoginPage from './pages/ClientLoginPage';
import ClientDashboardPage from './pages/ClientDashboardPage';
import AdminPanelPage from './pages/AdminPanelPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsPage from './pages/TermsPage';
import NotFoundPage from './pages/NotFoundPage';

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
