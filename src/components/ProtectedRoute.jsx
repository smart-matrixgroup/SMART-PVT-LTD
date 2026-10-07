import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ role, redirectTo = '/client-login', children }) {
  const { currentUser, role: userRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (!currentUser || userRole !== role) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}
