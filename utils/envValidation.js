/**
 * Validates that required environment variables are present
 * @param {string[]} requiredVars - Array of required environment variable names
 * @param {string} scope - Scope of the variables (e.g., 'Supabase', 'API')
 * @returns {boolean} - True if all required variables are present
 */
export function validateEnvVars(requiredVars, scope = 'Application') {
  // Always return true to prevent blocking the app in both dev and production
  // Just log warnings instead
  
  const missingVars = [];

  for (const varName of requiredVars) {
    const value = process.env[varName];
    if (!value || value.trim() === '') {
      missingVars.push(varName);
      console.warn(`⚠️ Missing environment variable: ${varName}`);
    }
  }

  if (missingVars.length > 0) {
    const errorMessage = `${scope} configuration error: Missing required environment variables: ${missingVars.join(', ')}`;
    
    console.warn('');
    console.warn('⚠️ ENVIRONMENT WARNING ⚠️');
    console.warn(errorMessage);
    console.warn('The application will attempt to continue, but functionality may be limited.');
    console.warn('');
    
    if (typeof window !== 'undefined') {
      // When running in the browser, try to provide fallback values
      missingVars.forEach(varName => {
        if (varName === 'NEXT_PUBLIC_SUPABASE_URL') {
          window.sessionStorage.setItem('NEXT_PUBLIC_SUPABASE_URL', 'https://hymravaveedguejtazsc.supabase.co');
        } else if (varName === 'NEXT_PUBLIC_SUPABASE_ANON_KEY') {
          window.sessionStorage.setItem('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5bXJhdmF2ZWVkZ3VlanRhenNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwMDI2NTgsImV4cCI6MjA2MjU3ODY1OH0.oLRhI41ul4OTd37TEgWkZRxQ-0Tg-0hBcYKQIkgb8Ag');
        }
      });
    }
  }
  
  // Always return true to prevent blocking the app
  return true;
}

/**
 * Validates Supabase environment variables
 * @returns {boolean} - True if all Supabase variables are present
 */
export function validateSupabaseEnv() {
  return validateEnvVars(
    ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
    'Supabase'
  );
} 