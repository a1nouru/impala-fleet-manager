"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client'; // Import the new client

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
  const supabase = createClient(); // Create the client instance

  useEffect(() => {
    //
    const getInitialUser = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
        
        if (user){
             console.log('✅ Initial user loaded:', user.email);
        }
       
      } catch (error) {
        console.error('❌ Error getting initial user:', error);
      } finally {
        setLoading(false);
      }
    };

    getInitialUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('🔄 Auth state change:', event);
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
             console.log('✅ User session updated:', currentUser.email);
        }
        else{
             console.log('🚪 No active session.');
        }

        setLoading(false);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: () => supabase.auth.signOut(),
    signUp: (email, password) => supabase.auth.signUp({ email, password }),
    signInWithMagicLink: (email) => supabase.auth.signInWithOtp({ email }),
    // The email link lands on /auth/callback, which exchanges the recovery
    // code for a session and forwards to the set-new-password page.
    resetPassword: (email) => supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    }),
    updatePassword: (password) => supabase.auth.updateUser({ password }),
    // The session is now automatically managed by the middleware and onAuthStateChange,
    // so extendSession is no longer needed.
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 