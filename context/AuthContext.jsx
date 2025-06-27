"use client";

import { createContext, useContext, useEffect, useState } from 'react';

// Create auth context
const AuthContext = createContext();

// Custom hook for using auth context  
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Auth provider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authService, setAuthService] = useState(null);

  // FIXED: Dynamically import authService to prevent SSR issues
  useEffect(() => {
    const loadAuthService = async () => {
      try {
        const { authService: service } = await import('@/services/authService');
        setAuthService(service);
        console.log('✅ AuthService loaded successfully');
      } catch (error) {
        console.error('❌ Failed to load authService:', error);
      }
    };
    
    loadAuthService();
  }, []);

  // SIMPLIFIED: Load user data when authService is available
  const loadUserData = async () => {
    if (!authService) return;
    
    try {
      console.log('🔍 Loading user data...');
      const session = await authService.getCurrentSession();
      
      if (session?.user) {
        console.log('✅ User session found:', session.user.email);
        setUser(session.user);
      } else {
        console.log('❌ No user session found');
        setUser(null);
      }
    } catch (error) {
      console.error('❌ Error loading user data:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authService) return;

    loadUserData();

    // FIXED: Use authService.onAuthStateChange instead of accessing .supabase directly
    const { data: { subscription } } = authService.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state change:', event);
        
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('✅ User signed in:', session.user.email);
          setUser(session.user);
          setLoading(false);
        } else if (event === 'SIGNED_OUT') {
          console.log('🚪 User signed out');
          setUser(null);
          setLoading(false);
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          console.log('🔄 Token refreshed for:', session.user.email);
          setUser(session.user);
          setLoading(false);
        }
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, [authService]);

  // SIMPLIFIED: Authentication functions with proper error handling
  const signIn = async (email, password) => {
    if (!authService) throw new Error('AuthService not available');
    
    setLoading(true);
    try {
      console.log('🔐 Signing in user:', email);
      const result = await authService.signIn(email, password);
      
      if (result.error) {
        throw result.error;
      }
      
      if (!result?.session?.user) {
        // This case can happen with invalid credentials where Supabase doesn't return an error object.
        throw new Error("Invalid login credentials.");
      }

      // The onAuthStateChange listener will set the user. We return the result
      // for any component that might need it.
      console.log('✅ Sign in successful');
      return result;

    } catch (error) {
      console.error('❌ Sign in error:', error);
      setUser(null); // Ensure user is cleared on failed sign-in.
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    if (!authService) throw new Error('AuthService not available');
    
    setLoading(true);
    try {
      console.log('🚪 Signing out user...');
      await authService.signOut();
      // User will be set to null via onAuthStateChange listener.
      console.log('✅ Sign out successful');
    } catch (error) {
      console.error('❌ Sign out error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email, password) => {
    if (!authService) throw new Error('AuthService not available');
    
    setLoading(true);
    try {
      console.log('📝 Signing up user:', email);
      const result = await authService.signUp(email, password);
       if (result.error) {
        throw result.error;
      }
      console.log('✅ Sign up successful');
      return result;
    } catch (error) {
      console.error('❌ Sign up error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signInWithMagicLink = async (email) => {
    if (!authService) throw new Error('AuthService not available');
    
    try {
      console.log('✨ Sending magic link to:', email);
      const result = await authService.signInWithMagicLink(email);
      console.log('✅ Magic link sent');
      return result;
    } catch (error) {
      console.error('❌ Magic link error:', error);
      throw error;
    }
  };

  const resetPassword = async (email) => {
    if (!authService) throw new Error('AuthService not available');
    
    try {
      console.log('🔑 Sending password reset to:', email);
      const result = await authService.resetPassword(email);
      console.log('✅ Password reset sent');
      return result;
    } catch (error) {
      console.error('❌ Password reset error:', error);
      throw error;
    }
  };

  const value = {
    user,
    loading: loading || !authService,
    isAuthenticated: !!user,
    signIn,
    signOut,
    signUp,
    signInWithMagicLink,
    resetPassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 