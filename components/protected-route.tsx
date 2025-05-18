'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { LoginDialog } from './login-dialog';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, loading } = useAuth();
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  
  useEffect(() => {
    // Wait for auth state to be determined
    if (!loading && !isAuthenticated) {
      setShowLoginDialog(true);
    }
  }, [isAuthenticated, loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-lg text-gray-700">Loading...</span>
      </div>
    );
  }

  return (
    <>
      {isAuthenticated ? (
        children
      ) : (
        <div className="flex items-center justify-center min-h-screen">
          <LoginDialog open={showLoginDialog} onOpenChange={setShowLoginDialog} />
        </div>
      )}
    </>
  );
} 