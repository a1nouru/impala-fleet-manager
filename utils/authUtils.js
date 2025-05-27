/**
 * Authentication utilities to handle browser cache and session management
 */

/**
 * Clear all authentication-related data from browser storage
 */
export const clearAuthCache = () => {
  if (typeof window === 'undefined') return;
  
  try {
    // Clear localStorage auth data
    const authKeys = Object.keys(localStorage).filter(key => 
      key.includes('supabase') || 
      key.includes('auth') || 
      key.includes('session') ||
      key.includes('sb-') // Supabase keys often start with sb-
    );
    
    authKeys.forEach(key => {
      localStorage.removeItem(key);
      console.log(`🗑️ Cleared localStorage key: ${key}`);
    });
    
    // Clear sessionStorage
    sessionStorage.clear();
    console.log('🗑️ Cleared sessionStorage');
    
    // Clear any cached service worker data
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => {
          registration.unregister();
        });
      });
    }
    
    console.log('✅ Auth cache cleared successfully');
  } catch (error) {
    console.error('❌ Error clearing auth cache:', error);
  }
};

/**
 * Force refresh the page to clear any cached auth state
 */
export const forceAuthRefresh = () => {
  if (typeof window === 'undefined') return;
  
  // Clear cache first
  clearAuthCache();
  
  // Force a hard refresh
  window.location.reload();
};

/**
 * Check if there are conflicting auth sessions
 */
export const detectAuthConflicts = () => {
  if (typeof window === 'undefined') return false;
  
  try {
    const supabaseKeys = Object.keys(localStorage).filter(key => 
      key.includes('supabase') || key.includes('sb-')
    );
    
    const sessionKeys = Object.keys(localStorage).filter(key => 
      key.includes('session')
    );
    
    // If we have multiple auth-related keys, there might be conflicts
    const hasConflicts = supabaseKeys.length > 2 || sessionKeys.length > 1;
    
    if (hasConflicts) {
      console.warn('⚠️ Potential auth session conflicts detected');
      console.log('Supabase keys:', supabaseKeys);
      console.log('Session keys:', sessionKeys);
    }
    
    return hasConflicts;
  } catch (error) {
    console.error('Error detecting auth conflicts:', error);
    return false;
  }
};

/**
 * Prepare browser for fresh login
 */
export const prepareForLogin = () => {
  if (typeof window === 'undefined') return;
  
  console.log('🔄 Preparing browser for fresh login...');
  
  // Clear any existing auth data
  clearAuthCache();
  
  // Check for conflicts
  const hasConflicts = detectAuthConflicts();
  
  if (hasConflicts) {
    console.log('🔧 Resolving auth conflicts...');
    clearAuthCache();
  }
  
  console.log('✅ Browser prepared for login');
}; 