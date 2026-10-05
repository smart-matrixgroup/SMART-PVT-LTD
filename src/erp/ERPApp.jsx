import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ERPLayout from './layout/ERPLayout';

// Eager load dashboard (first page admin sees)
import ERPDashboard from './pages/ERPDashboard';

// Lazy load all other ERP pages
const ERPLeads        = lazy(() => import('./pages/ERPLeads'));
const ERPClients      = lazy(() => import('./pages/ERPClients'));
const ERPProjects     = lazy(() => import('./pages/ERPProjects'));
const ERPRequirements = lazy(() => import('./pages/ERPRequirements'));
const ERPQuotations   = lazy(() => import('./pages/ERPQuotations'));
const ERPInvoices     = lazy(() => import('./pages/ERPInvoices'));
const ERPStaff        = lazy(() => import('./pages/ERPStaff'));
const ERPMessages     = lazy(() => import('./pages/ERPMessages'));
const ERPAnalytics    = lazy(() => import('./pages/ERPAnalytics'));
const ERPAchievements = lazy(() => import('./pages/ERPAchievements'));
const ERPSettings     = lazy(() => import('./pages/ERPSettings'));

function ERPFallback() {
  return (
    <div style={{
      height:'60vh', display:'flex', alignItems:'center', justifyContent:'center',
    }}>
      <div style={{
        width:36, height:36, borderRadius:'50%',
        border:'3px solid rgba(0,102,255,0.2)',
        borderTopColor:'#0066FF',
        animation:'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export default function ERPApp() {
  return (
    <Routes>
      <Route element={<ERPLayout />}>
        <Route index                    element={<ERPDashboard />} />
        <Route path="leads"             element={<Suspense fallback={<ERPFallback/>}><ERPLeads /></Suspense>} />
        <Route path="clients"           element={<Suspense fallback={<ERPFallback/>}><ERPClients /></Suspense>} />
        <Route path="projects"          element={<Suspense fallback={<ERPFallback/>}><ERPProjects /></Suspense>} />
        <Route path="requirements"      element={<Suspense fallback={<ERPFallback/>}><ERPRequirements /></Suspense>} />
        <Route path="quotations"        element={<Suspense fallback={<ERPFallback/>}><ERPQuotations /></Suspense>} />
        <Route path="invoices"          element={<Suspense fallback={<ERPFallback/>}><ERPInvoices /></Suspense>} />
        <Route path="staff"             element={<Suspense fallback={<ERPFallback/>}><ERPStaff /></Suspense>} />
        <Route path="messages"          element={<Suspense fallback={<ERPFallback/>}><ERPMessages /></Suspense>} />
        <Route path="analytics"         element={<Suspense fallback={<ERPFallback/>}><ERPAnalytics /></Suspense>} />
        <Route path="achievements"      element={<Suspense fallback={<ERPFallback/>}><ERPAchievements /></Suspense>} />
        <Route path="settings"          element={<Suspense fallback={<ERPFallback/>}><ERPSettings /></Suspense>} />
        <Route path="*"                 element={<Navigate to="/erp" replace />} />
      </Route>
    </Routes>
  );
}
