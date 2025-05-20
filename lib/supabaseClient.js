import { createClient } from '@supabase/supabase-js';
import { validateSupabaseEnv } from '../utils/envValidation';

// Validate Supabase environment variables
validateSupabaseEnv();

// Get environment variables - use the NEXT_PUBLIC versions for both server and client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create Supabase client
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Log initialization but don't expose sensitive info
if (typeof window === 'undefined') {
  console.log('✅ Supabase client initialized successfully on the server side');
} else {
  console.log('✅ Supabase client initialized successfully on the client side');
}

export default supabaseClient; 