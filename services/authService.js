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
        return data;
      } catch (error) {
        console.error(`Session error (attempt ${i + 1}):`, error);
        if (i === retries - 1) throw error;
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
        return data.user;
      } catch (error) {
        console.error(`User error (attempt ${i + 1}):`, error);
        if (i === retries - 1) return null;
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
      console.error('Sign up error:', error);
      throw error;
    }
  },

  /**
   * Sign in with email and password - Enhanced with better session handling
   */
  signIn: async (email, password) => {
    try {
      console.log('🔐 Starting sign in...');
      
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error('🚫 Auth error:', error);
        throw error;
      }
      
      if (!data.session) {
        throw new Error('No session created');
      }
      
      console.log('✅ Sign in successful');
      return data;
    } catch (error) {
      console.error('❌ Sign in error:', error);
      throw error;
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
      console.error('Magic link error:', error);
      throw error;
    }
  },

  /**
   * Sign out with enhanced cleanup
   */
  signOut: async () => {
    try {
      console.log('🚪 Starting sign out...');
      
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;
      
      // Clear browser storage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('app-session-state');
        const authKeys = Object.keys(localStorage).filter(key => 
          key.includes('supabase') || key.includes('auth')
        );
        authKeys.forEach(key => localStorage.removeItem(key));
      }
      
      console.log('✅ Sign out completed');
      return true;
    } catch (error) {
      console.error('❌ Sign out error:', error);
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
      console.error('Reset password error:', error);
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
      console.error('Update password error:', error);
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