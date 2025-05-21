import { createClient } from '@supabase/supabase-js';
import { validateSupabaseEnv } from '../utils/envValidation';

// Validate Supabase environment variables - this will now log warnings but won't throw errors
validateSupabaseEnv();

// Function to get environment variables with fallbacks
function getEnvVariable(name, fallback = '') {
  // Check env vars first
  if (process.env[name] && process.env[name].trim() !== '') {
    return process.env[name];
  }
  
  // Then check browser storage as fallback (client-side only)
  if (typeof window !== 'undefined' && window.sessionStorage) {
    const value = window.sessionStorage.getItem(name);
    if (value) return value;
  }
  
  // Return the fallback value if nothing else works
  return fallback;
}

// Get environment variables with fallbacks
const supabaseUrl = getEnvVariable('NEXT_PUBLIC_SUPABASE_URL', 'https://hymravaveedguejtazsc.supabase.co');
const supabaseAnonKey = getEnvVariable('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5bXJhdmF2ZWVkZ3VlanRhenNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwMDI2NTgsImV4cCI6MjA2MjU3ODY1OH0.oLRhI41ul4OTd37TEgWkZRxQ-0Tg-0hBcYKQIkgb8Ag');

// Log to help with debugging
console.log('Supabase configuration:', {
  urlPresent: !!supabaseUrl,
  keyPresent: !!supabaseAnonKey,
  urlSource: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'env' : (typeof window !== 'undefined' && window.sessionStorage.getItem('NEXT_PUBLIC_SUPABASE_URL') ? 'sessionStorage' : 'fallback'),
  keySource: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'env' : (typeof window !== 'undefined' && window.sessionStorage.getItem('NEXT_PUBLIC_SUPABASE_ANON_KEY') ? 'sessionStorage' : 'fallback')
});

// Create Supabase client with optimized settings
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: {
    headers: { 'x-application-name': 'royal-express-fleet-manager' },
  },
  // Cache and performance settings
  db: {
    schema: 'public'
  },
  realtime: {
    timeout: 30000 // Increase timeout for better reliability
  }
});

// Log initialization but don't expose sensitive info
if (typeof window === 'undefined') {
  console.log('✅ Supabase client initialized on the server side');
} else {
  console.log('✅ Supabase client initialized on the client side');
}

// Export a memoized instance to prevent multiple initializations
export default supabaseClient; 