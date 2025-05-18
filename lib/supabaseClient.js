import { createClient } from '@supabase/supabase-js';
import { validateSupabaseEnv } from '../utils/envValidation';

// Validate Supabase environment variables
validateSupabaseEnv();

// Get environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let supabaseClient;

if (typeof window === 'undefined') {
  // Server-side initialization
  supabaseClient = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );
  console.log('✅ Supabase client initialized successfully on the server side');
} else {
  // Client-side initialization
  supabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  console.log('✅ Supabase client initialized successfully on the client side');
}

export default supabaseClient; 