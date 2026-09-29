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
