import { createClient } from '@supabase/supabase-js';
import { validateSupabaseEnv } from '../utils/envValidation';

// Validate Supabase environment variables - this will now log warnings but won't throw errors
validateSupabaseEnv();

// Get environment variables - use the NEXT_PUBLIC versions for both server and client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Log to help with debugging
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase client initialized with empty credentials:', { 
    urlPresent: !!supabaseUrl, 
    keyPresent: !!supabaseAnonKey 
  });
  console.warn('This might cause issues with Supabase functionality');
}

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