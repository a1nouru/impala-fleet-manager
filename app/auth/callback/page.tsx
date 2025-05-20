'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function AuthCallbackPage() {
  const router = useRouter();
  
  useEffect(() => {
    // When the page loads, redirect to the dashboard
    // The Supabase client will automatically process the auth callback
    const timer = setTimeout(() => {
      router.push('/dashboard/maintenance');
    }, 1500); // Wait briefly to allow auth processing
    
    return () => clearTimeout(timer);
  }, [router]);
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-600 to-blue-800">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 text-white animate-spin" />
        <p className="text-white text-lg font-medium">Completing authentication...</p>
      </div>
    </div>
  );
} 