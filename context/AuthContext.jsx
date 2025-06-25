'use client';

import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { authService } from '../services/authService';

// Create auth context
const AuthContext = createContext();

// Auth provider component
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  
  // Session timeout management - single timer reference to avoid race conditions
  const sessionTimeoutRef = useRef(null);
  const warningTimeoutRef = useRef(null);
  const SESSION_TIMEOUT_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds
  const WARNING_BEFORE_EXPIRY = 5 * 60 * 1000; // 5 minutes before expiry

  // Function to handle session timeout (avoid circular dependency)
  const handleSessionTimeout = useCallback(async () => {
    console.log('⌛ Session timeout reached - auto logging out');
    try {
      // Clear local state immediately to prevent race conditions
      setUser(null);
      setSession(null);
      setLoading(true);
      
      // Clear session timeout immediately
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current);
        sessionTimeoutRef.current = null;
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
        warningTimeoutRef.current = null;
      }
      
      // Call the auth service to clear Supabase session and browser storage
      await authService.signOut();
      
      console.log('✅ Auto logout completed successfully');
    } catch (error) {
      console.error('❌ Error during auto logout:', error);
      // Even if there's an error, ensure local state is cleared
      setUser(null);
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Function to clear session timeout
  const clearSessionTimeout = useCallback(() => {
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
      sessionTimeoutRef.current = null;
      console.log('⏰ Session timeout cleared');
    }
    // Also clear warning timeout
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
  }, []);

  // Function to start session timeout
  const startSessionTimeout = useCallback(() => {
    // Always clear existing timeouts first to avoid multiple timers
    clearSessionTimeout();
    
    // Set warning timeout (25 minutes)
    warningTimeoutRef.current = setTimeout(() => {
      console.log('⚠️ Session expiring in 5 minutes');
      // You can add a toast notification here if needed
    }, SESSION_TIMEOUT_DURATION - WARNING_BEFORE_EXPIRY);
    
    // Set main session timeout (30 minutes)
    sessionTimeoutRef.current = setTimeout(handleSessionTimeout, SESSION_TIMEOUT_DURATION);
    
    console.log('⏰ Session timeout started - 30 minutes');
  }, [clearSessionTimeout, handleSessionTimeout]);

  // Function to extend session (restart timeout on user activity)
  const extendSession = useCallback(() => {
    if (!!user && !!session && sessionTimeoutRef.current) {
      console.log('🔄 Session extended due to activity');
      startSessionTimeout();
    }
  }, [user, session, startSessionTimeout]);

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
        console.log('🔄 Loading user data...');
        
        // Get the current session
        const { session } = await authService.getCurrentSession();
        console.log('📋 Session data:', session ? '✅ Found' : '❌ Not found');
        setSession(session);
        
        // If session exists, get user data and start timeout
        if (session) {
          const user = await authService.getCurrentUser();
          console.log('👤 User data:', user ? '✅ Found' : '❌ Not found');
          setUser(user);
          
          // Start session timeout for existing session
          startSessionTimeout();
        } else {
          setUser(null);
          // Clear any existing timeout when no session
          clearSessionTimeout();
        }
      } catch (error) {
        console.error('❌ Error loading user data:', error);
        setUser(null);
        setSession(null);
        clearSessionTimeout();
      } finally {
        setLoading(false);
        console.log('✅ Auth state loading complete');
      }
    }
    
    loadUserData();

    // Subscribe to auth changes with enhanced logging
    const { data: authListener } = authService.onAuthStateChange(
      async (event, session) => {
        console.log(`🔔 Auth state change: ${event}`, session ? '✅ Session exists' : '❌ No session');
        
        setSession(session);
        
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          console.log('🔑 User signed in, fetching user data...');
          try {
            const user = await authService.getCurrentUser();
            console.log('👤 User fetched:', user ? '✅ Success' : '❌ Failed');
            setUser(user);
            
            // Start session timeout on successful login
            startSessionTimeout();
            
            // Force a small delay to ensure state updates
            setTimeout(() => {
              console.log('🎯 Auth state should be updated now');
            }, 100);
          } catch (error) {
            console.error('❌ Error fetching user after sign in:', error);
            setUser(null);
            clearSessionTimeout();
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('🚪 User signed out');
          setUser(null);
          setSession(null);
          // Always clear timeout on sign out
          clearSessionTimeout();
        }
      }
    );
    
    // Cleanup subscription and timeout on unmount
    return () => {
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
        console.log('🧹 Auth listener cleaned up');
      }
      // Clear timeout on component unmount
      clearSessionTimeout();
    };
  }, [mounted, startSessionTimeout, clearSessionTimeout]);

  // Enhanced sign in with better state management
  const signIn = async (email, password) => {
    try {
      console.log('🔐 Attempting sign in...');
      const result = await authService.signIn(email, password);
      console.log('✅ Sign in successful:', result ? '✅ Data received' : '❌ No data');
      
      // Force refresh auth state after successful login
      if (result?.session) {
        console.log('🔄 Forcing auth state refresh...');
        setSession(result.session);
        
        // Get fresh user data
        const user = await authService.getCurrentUser();
        setUser(user);
        console.log('🎯 Auth state manually updated');
      }
      
      return result;
    } catch (error) {
      console.error('❌ Sign in error:', error);
      throw error;
    }
  };

  // Define auth actions
  const signUp = async (email, password) => {
    try {
      return await authService.signUp(email, password);
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
      
      // Clear session timeout immediately
      clearSessionTimeout();
      
      // Clear local state immediately
      setUser(null);
      setSession(null);
      
      // Call the auth service to clear Supabase session and browser storage
      await authService.signOut();
      
      console.log('✅ User signed out successfully');
    } catch (error) {
      console.error('Error during sign out:', error);
      // Even if there's an error, clear local state and timeout
      setUser(null);
      setSession(null);
      clearSessionTimeout();
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

  // Enhanced authentication check with logging
  const isAuthenticated = !!user && !!session;
  
  // Debug logging for auth state
  useEffect(() => {
    console.log('🔍 Auth state debug:', {
      user: user ? '✅ Present' : '❌ Missing',
      session: session ? '✅ Present' : '❌ Missing',
      isAuthenticated,
      loading
    });
  }, [user, session, isAuthenticated, loading]);

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
    extendSession,
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