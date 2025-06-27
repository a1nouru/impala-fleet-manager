'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
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

  // SIMPLIFIED auth state initialization - no complex timeout management
  useEffect(() => {
    if (!mounted) return;

    async function loadUserData() {
      try {
        console.log('🔄 Loading auth state...');
        setLoading(true);
        
        const { session } = await authService.getCurrentSession();
        setSession(session);
        
        if (session) {
          const user = await authService.getCurrentUser();
          setUser(user);
          console.log('✅ Auth loaded:', user ? 'User found' : 'No user');
        } else {
          setUser(null);
          console.log('❌ No session found');
        }
      } catch (error) {
        console.error('❌ Auth load error:', error);
        setUser(null);
        setSession(null);
      } finally {
        setLoading(false);
      }
    }
    
    loadUserData();

    // SIMPLIFIED auth state change listener - no complex timeout logic
    const { data: authListener } = authService.onAuthStateChange(
      async (event, session) => {
        console.log(`🔔 Auth event: ${event}`);
        
        setSession(session);
        
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session) {
            try {
              const user = await authService.getCurrentUser();
              setUser(user);
              console.log('✅ User updated:', user ? 'Success' : 'Failed');
            } catch (error) {
              console.error('❌ User fetch error:', error);
              setUser(null);
            }
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setSession(null);
          console.log('🚪 User signed out');
        }
        
        setLoading(false);
      }
    );
    
    return () => {
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, [mounted]);

  // SIMPLIFIED sign in - no manual state forcing
  const signIn = async (email, password) => {
    try {
      console.log('🔐 Signing in...');
      setLoading(true);
      
      const result = await authService.signIn(email, password);
      
      // Let the auth state change listener handle state updates
      console.log('✅ Sign in complete');
      return result;
    } catch (error) {
      console.error('❌ Sign in error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // SIMPLIFIED sign out
  const signOut = async () => {
    try {
      console.log('🚪 Signing out...');
      setLoading(true);
      
      await authService.signOut();
      
      setUser(null);
      setSession(null);
      console.log('✅ Sign out complete');
    } catch (error) {
      console.error('❌ Sign out error:', error);
      setUser(null);
      setSession(null);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email, password) => {
    return await authService.signUp(email, password);
  };

  const signInWithMagicLink = async (email) => {
    return await authService.signInWithMagicLink(email);
  };

  const resetPassword = async (email) => {
    return await authService.resetPassword(email);
  };

  const updatePassword = async (newPassword) => {
    return await authService.updatePassword(newPassword);
  };

  const isAuthenticated = !!user && !!session;

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
    isAuthenticated,
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