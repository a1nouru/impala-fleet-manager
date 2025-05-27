// import { supabase } from '../lib/supabase';
import supabaseClient from '../lib/supabaseClient';

/**
 * Authentication service for Supabase
 */
export const authService = {
  /**
   * Get the current session with retry logic
   */
  getCurrentSession: async (retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        const { data, error } = await supabaseClient.auth.getSession();
        if (error) throw error;
        
        // Log session status for debugging
        console.log(`📋 Session check attempt ${i + 1}:`, data.session ? '✅ Found' : '❌ Not found');
        
        return data;
      } catch (error) {
        console.error(`❌ Error getting session (attempt ${i + 1}):`, error);
        
        if (i === retries - 1) {
          throw error;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  },

  /**
   * Get the current user with retry logic
   */
  getCurrentUser: async (retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        const { data, error } = await supabaseClient.auth.getUser();
        if (error) throw error;
        
        console.log(`👤 User check attempt ${i + 1}:`, data.user ? '✅ Found' : '❌ Not found');
        
        return data.user;
      } catch (error) {
        console.error(`❌ Error getting user (attempt ${i + 1}):`, error);
        
        if (i === retries - 1) {
          return null;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    return null;
  },

  /**
   * Sign up with email and password
   */
  signUp: async (email, password) => {
    try {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
      });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error signing up:', error);
      throw error;
    }
  },

  /**
   * Sign in with email and password - Enhanced with better session handling
   */
  signIn: async (email, password) => {
    try {
      console.log('🔐 Starting sign in process...');
      
      // Clear any existing session conflicts first
      await authService.clearSessionConflicts();
      
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error('🚫 Supabase auth error:', error);
        throw error;
      }
      
      if (!data.session) {
        console.error('🚫 No session returned from Supabase');
        throw new Error('Authentication failed - no session created');
      }
      
      console.log('✅ Sign in successful, session created');
      
      // Verify the session was properly stored
      setTimeout(async () => {
        try {
          const { session } = await authService.getCurrentSession();
          if (!session) {
            console.warn('⚠️ Session not found after login, this might cause issues');
          } else {
            console.log('✅ Session verified after login');
          }
        } catch (error) {
          console.warn('⚠️ Could not verify session after login:', error);
        }
      }, 100);
      
      return data;
    } catch (error) {
      console.error('❌ Error signing in:', error);
      throw error;
    }
  },

  /**
   * Clear session conflicts that might prevent proper authentication
   */
  clearSessionConflicts: async () => {
    if (typeof window === 'undefined') return;
    
    try {
      // Clear any stale auth tokens
      const authKeys = Object.keys(localStorage).filter(key => 
        key.includes('supabase') && key.includes('auth')
      );
      
      // Only clear if there are multiple conflicting keys
      if (authKeys.length > 2) {
        console.log('🧹 Clearing session conflicts...');
        authKeys.forEach(key => localStorage.removeItem(key));
      }
    } catch (error) {
      console.warn('⚠️ Could not clear session conflicts:', error);
    }
  },

  /**
   * Sign in with magic link
   */
  signInWithMagicLink: async (email) => {
    try {
      const { data, error } = await supabaseClient.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error sending magic link:', error);
      throw error;
    }
  },

  /**
   * Sign out with enhanced cleanup
   */
  signOut: async () => {
    try {
      console.log('🚪 Starting sign out process...');
      
      // Clear Supabase session
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;
      
      // Clear all browser storage to prevent session conflicts
      if (typeof window !== 'undefined') {
        // Clear localStorage
        localStorage.removeItem('app-session-state');
        localStorage.removeItem('supabase.auth.token');
        
        // Clear sessionStorage
        sessionStorage.clear();
        
        // Clear any cached auth data
        const authKeys = Object.keys(localStorage).filter(key => 
          key.includes('supabase') || 
          key.includes('auth') || 
          key.includes('session')
        );
        authKeys.forEach(key => localStorage.removeItem(key));
        
        console.log('🧹 Browser storage cleared after logout');
      }
      
      console.log('✅ Sign out completed successfully');
      return true;
    } catch (error) {
      console.error('❌ Error signing out:', error);
      throw error;
    }
  },

  /**
   * Reset password
   */
  resetPassword: async (email) => {
    try {
      const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error sending password reset:', error);
      throw error;
    }
  },

  /**
   * Update password
   */
  updatePassword: async (newPassword) => {
    try {
      const { data, error } = await supabaseClient.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating password:', error);
      throw error;
    }
  },

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChange: (callback) => {
    return supabaseClient.auth.onAuthStateChange(callback);
  },

  /**
   * Force refresh the current session
   */
  refreshSession: async () => {
    try {
      console.log('🔄 Refreshing session...');
      const { data, error } = await supabaseClient.auth.refreshSession();
      if (error) throw error;
      console.log('✅ Session refreshed successfully');
      return data;
    } catch (error) {
      console.error('❌ Error refreshing session:', error);
      throw error;
    }
  },
}; 