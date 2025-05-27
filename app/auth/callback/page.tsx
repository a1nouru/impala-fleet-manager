'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { authService } from '@/services/authService';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState('Processing authentication...');
  
  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        setStatus('Verifying session...');
        
        // Wait a moment for Supabase to process the URL
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Check if we have a valid session
        const { session } = await authService.getCurrentSession();
        
        if (session) {
          setStatus('Authentication successful! Redirecting...');
          console.log('✅ Auth callback successful');
          
          // Clear any stale session data
          if (typeof window !== 'undefined') {
            localStorage.removeItem('app-session-state');
          }
          
          // Redirect to dashboard
          router.push('/dashboard/maintenance');
        } else {
          setStatus('Authentication failed. Redirecting to home...');
          console.log('❌ Auth callback failed - no session');
          router.push('/');
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        setStatus('Authentication error. Redirecting to home...');
        router.push('/');
      }
    };
    
    handleAuthCallback();
  }, [router]);
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-600 to-blue-800">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 text-white animate-spin" />
        <p className="text-white text-lg font-medium">{status}</p>
      </div>
    </div>
  );
} 