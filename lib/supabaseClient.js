import { createClient } from '@supabase/supabase-js';

let supabaseClient;

if (typeof window !== 'undefined') {
  // Client-side initialization
  supabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  );
} else {
  // Server-side initialization (only if needed)
  supabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  );
}

export default supabaseClient; 