/**
 * Authentication diagnostics utility
 * Helps identify and resolve common authentication issues
 */

import { authService } from '../services/authService';

/**
 * Run comprehensive authentication diagnostics
 */
export const runAuthDiagnostics = async () => {
  console.log('🔍 Running authentication diagnostics...');
  
  const diagnostics = {
    timestamp: new Date().toISOString(),
    browser: getBrowserInfo(),
    storage: getStorageInfo(),
    supabase: await getSupabaseInfo(),
    recommendations: []
  };
  
  // Analyze results and provide recommendations
  diagnostics.recommendations = generateRecommendations(diagnostics);
  
  console.log('📊 Authentication Diagnostics Report:', diagnostics);
  return diagnostics;
};

/**
 * Get browser information
 */
const getBrowserInfo = () => {
  if (typeof window === 'undefined') return { environment: 'server' };
  
  return {
    environment: 'client',
    userAgent: navigator.userAgent,
    cookiesEnabled: navigator.cookieEnabled,
    localStorage: typeof Storage !== 'undefined',
    sessionStorage: typeof sessionStorage !== 'undefined',
    url: window.location.href,
    origin: window.location.origin
  };
};

/**
 * Get storage information
 */
const getStorageInfo = () => {
  if (typeof window === 'undefined') return { available: false };
  
  try {
    const localStorageKeys = Object.keys(localStorage);
    const sessionStorageKeys = Object.keys(sessionStorage);
    
    const supabaseKeys = localStorageKeys.filter(key => 
      key.includes('supabase') || key.includes('sb-')
    );
    
    const authKeys = localStorageKeys.filter(key => 
      key.includes('auth') || key.includes('session')
    );
    
    return {
      available: true,
      localStorageKeys: localStorageKeys.length,
      sessionStorageKeys: sessionStorageKeys.length,
      supabaseKeys,
      authKeys,
      hasConflicts: supabaseKeys.length > 2 || authKeys.length > 1
    };
  } catch (error) {
    return {
      available: false,
      error: error.message
    };
  }
};

/**
 * Get Supabase authentication information
 */
const getSupabaseInfo = async () => {
  try {
    const sessionResult = await authService.getCurrentSession();
    const user = await authService.getCurrentUser();
    
    return {
      sessionExists: !!sessionResult?.session,
      userExists: !!user,
      sessionValid: sessionResult?.session && !isSessionExpired(sessionResult.session),
      userId: user?.id || null,
      userEmail: user?.email || null,
      lastSignIn: user?.last_sign_in_at || null,
      sessionExpiry: sessionResult?.session?.expires_at || null
    };
  } catch (error) {
    return {
      error: error.message,
      sessionExists: false,
      userExists: false,
      sessionValid: false
    };
  }
};

/**
 * Check if session is expired
 */
const isSessionExpired = (session) => {
  if (!session?.expires_at) return true;
  return new Date(session.expires_at * 1000) < new Date();
};

/**
 * Generate recommendations based on diagnostics
 */
const generateRecommendations = (diagnostics) => {
  const recommendations = [];
  
  // Check for storage conflicts
  if (diagnostics.storage.hasConflicts) {
    recommendations.push({
      type: 'storage_conflict',
      severity: 'high',
      message: 'Multiple authentication keys detected in storage',
      action: 'Clear browser storage and try logging in again'
    });
  }
  
  // Check for expired session
  if (diagnostics.supabase.sessionExists && !diagnostics.supabase.sessionValid) {
    recommendations.push({
      type: 'expired_session',
      severity: 'medium',
      message: 'Session exists but is expired',
      action: 'Refresh the session or log in again'
    });
  }
  
  // Check for missing session with user
  if (diagnostics.supabase.userExists && !diagnostics.supabase.sessionExists) {
    recommendations.push({
      type: 'session_mismatch',
      severity: 'high',
      message: 'User data exists but no valid session found',
      action: 'Clear authentication data and log in again'
    });
  }
  
  // Check for browser compatibility
  if (!diagnostics.browser.localStorage || !diagnostics.browser.cookiesEnabled) {
    recommendations.push({
      type: 'browser_compatibility',
      severity: 'critical',
      message: 'Browser storage or cookies are disabled',
      action: 'Enable cookies and local storage in browser settings'
    });
  }
  
  return recommendations;
};

/**
 * Fix common authentication issues automatically
 */
export const fixAuthIssues = async () => {
  console.log('🔧 Attempting to fix authentication issues...');
  
  const diagnostics = await runAuthDiagnostics();
  let fixesApplied = [];
  
  // Fix storage conflicts
  if (diagnostics.storage.hasConflicts) {
    try {
      clearAuthStorage();
      fixesApplied.push('Cleared conflicting storage keys');
    } catch (error) {
      console.error('Failed to clear storage:', error);
    }
  }
  
  // Refresh expired session
  if (diagnostics.supabase.sessionExists && !diagnostics.supabase.sessionValid) {
    try {
      await authService.refreshSession();
      fixesApplied.push('Refreshed expired session');
    } catch (error) {
      console.error('Failed to refresh session:', error);
      // If refresh fails, clear the invalid session
      clearAuthStorage();
      fixesApplied.push('Cleared invalid session');
    }
  }
  
  console.log('✅ Fixes applied:', fixesApplied);
  return fixesApplied;
};

/**
 * Clear authentication storage
 */
const clearAuthStorage = () => {
  if (typeof window === 'undefined') return;
  
  try {
    const keysToRemove = Object.keys(localStorage).filter(key => 
      key.includes('supabase') || 
      key.includes('auth') || 
      key.includes('session') ||
      key.includes('sb-')
    );
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    sessionStorage.clear();
    
    console.log('🧹 Cleared authentication storage');
  } catch (error) {
    console.error('Failed to clear storage:', error);
  }
};

/**
 * Monitor authentication state for debugging
 */
export const startAuthMonitoring = () => {
  if (typeof window === 'undefined') return;
  
  console.log('👁️ Starting authentication monitoring...');
  
  // Monitor localStorage changes
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = function(key, value) {
    if (key.includes('supabase') || key.includes('auth')) {
      console.log(`📝 localStorage.setItem: ${key}`);
    }
    return originalSetItem.apply(this, arguments);
  };
  
  const originalRemoveItem = localStorage.removeItem;
  localStorage.removeItem = function(key) {
    if (key.includes('supabase') || key.includes('auth')) {
      console.log(`🗑️ localStorage.removeItem: ${key}`);
    }
    return originalRemoveItem.apply(this, arguments);
  };
  
  // Monitor page visibility changes
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      console.log('👁️ Page became visible, checking auth state...');
      setTimeout(() => runAuthDiagnostics(), 1000);
    }
  });
  
  console.log('✅ Authentication monitoring started');
}; 