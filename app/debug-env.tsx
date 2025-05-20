'use client';

import { useEffect } from 'react';

export function DebugEnvironment() {
  useEffect(() => {
    // Only run in development mode and on client-side
    if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
      console.group('🔍 Environment Variables Debug Info');
      console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Not set');
      console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Not set');
      console.log('NODE_ENV:', process.env.NODE_ENV);
      console.log('VERCEL:', process.env.VERCEL === '1' ? '✅ Running on Vercel' : '❌ Not on Vercel');
      console.groupEnd();
    }
  }, []);

  // This component doesn't render anything
  return null;
} 