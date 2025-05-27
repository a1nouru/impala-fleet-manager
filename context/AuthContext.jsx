'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { authService } from '../services/authService';

// Create auth context
const AuthContext = createContext();

// Auth provider component
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Only run on client-side
  useEffect(() => {
    setMounted(true);
  }, []);

  // Initialize auth state
  useEffect(() => {
    // Skip auth initialization during SSR
    if (!mounted) return;

    async function loadUserData() {
      try {
        setLoading(true);
        
        // Get the current session
        const { session } = await authService.getCurrentSession();
        setSession(session);
        
        // If session exists, get user data
        if (session) {
          const user = await authService.getCurrentUser();
          setUser(user);
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadUserData();

    // Subscribe to auth changes
    const { data: authListener } = authService.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          const user = await authService.getCurrentUser();
          setUser(user);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setSession(null);
        }
      }
    );
    
    // Cleanup subscription on unmount
    return () => {
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, [mounted]);

  // Define auth actions
  const signUp = async (email, password) => {
    try {
      return await authService.signUp(email, password);
    } catch (error) {
      throw error;
    }
  };

  const signIn = async (email, password) => {
    try {
      return await authService.signIn(email, password);
    } catch (error) {
      throw error;
    }
  };

  const signInWithMagicLink = async (email) => {
    try {
      return await authService.signInWithMagicLink(email);
    } catch (error) {
      throw error;
    }
  };

  const signOut = async () => {
    try {
      // Set loading state to prevent UI issues
      setLoading(true);
      
      // Clear local state immediately
      setUser(null);
      setSession(null);
      
      // Call the auth service to clear Supabase session and browser storage
      await authService.signOut();
      
      console.log('✅ User signed out successfully');
    } catch (error) {
      console.error('Error during sign out:', error);
      // Even if there's an error, clear local state
      setUser(null);
      setSession(null);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email) => {
    try {
      return await authService.resetPassword(email);
    } catch (error) {
      throw error;
    }
  };

  const updatePassword = async (newPassword) => {
    try {
      return await authService.updatePassword(newPassword);
    } catch (error) {
      throw error;
    }
  };

  // Value to expose to consumers
  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signInWithMagicLink,
    signOut,
    resetPassword,
    updatePassword,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Custom hook for using auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 