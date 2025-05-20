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

// Create Supabase client (will still create even with empty credentials to avoid breaking the app)
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Log initialization but don't expose sensitive info
if (typeof window === 'undefined') {
  console.log('✅ Supabase client initialized on the server side');
} else {
  console.log('✅ Supabase client initialized on the client side');
}

export default supabaseClient; 