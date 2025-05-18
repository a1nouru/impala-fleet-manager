// import { supabase } from '../lib/supabase';
import supabaseClient from '../lib/supabaseClient';

/**
 * Authentication service for Supabase
 */
export const authService = {
  /**
   * Get the current session
   */
  getCurrentSession: async () => {
    try {
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting session:', error);
      throw error;
    }
  },

  /**
   * Get the current user
   */
  getCurrentUser: async () => {
    try {
      const { data, error } = await supabaseClient.auth.getUser();
      if (error) throw error;
      return data.user;
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
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
   * Sign in with email and password
   */
  signIn: async (email, password) => {
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error signing in:', error);
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
      console.error('Error sending magic link:', error);
      throw error;
    }
  },

  /**
   * Sign out
   */
  signOut: async () => {
    try {
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error signing out:', error);
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
}; 