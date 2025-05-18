/**
 * Validates that required environment variables are present
 * @param {string[]} requiredVars - Array of required environment variable names
 * @param {string} scope - Scope of the variables (e.g., 'Supabase', 'API')
 * @returns {boolean} - True if all required variables are present
 */
export function validateEnvVars(requiredVars, scope = 'Application') {
  const missingVars = [];

  for (const varName of requiredVars) {
    const value = process.env[varName];
    if (!value || value.trim() === '') {
      missingVars.push(varName);
      console.error(`❌ Missing environment variable: ${varName}`);
    }
  }

  if (missingVars.length > 0) {
    const errorMessage = `${scope} configuration error: Missing required environment variables: ${missingVars.join(', ')}`;
    
    // In production builds, we want to fail immediately
    if (process.env.NODE_ENV === 'production') {
      throw new Error(errorMessage);
    }
    
    // In development, we'll log a visible warning
    console.error('');
    console.error('🚨 ENVIRONMENT CONFIGURATION ERROR 🚨');
    console.error(errorMessage);
    console.error('');
    console.error('Please add these variables to your .env.local file');
    console.error('');
    
    return false;
  }
  
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