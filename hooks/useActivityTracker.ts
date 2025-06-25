import { useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';

/**
 * Hook to track user activity and extend session automatically
 * Tracks common user interactions to keep session active
 */
export function useActivityTracker() {
  const { extendSession, isAuthenticated } = useAuth();
  const lastActivityRef = useRef<number>(Date.now());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Minimum time between session extensions (5 minutes)
  const MIN_EXTENSION_INTERVAL = 5 * 60 * 1000;

  const handleActivity = useCallback(() => {
    if (!isAuthenticated) return;
    
    const now = Date.now();
    const timeSinceLastActivity = now - lastActivityRef.current;
    
    // Only extend session if enough time has passed since last extension
    if (timeSinceLastActivity >= MIN_EXTENSION_INTERVAL) {
      console.log('🔄 User activity detected - extending session');
      extendSession();
      lastActivityRef.current = now;
    }
  }, [isAuthenticated, extendSession]);

  const throttledHandleActivity = useCallback(() => {
    // Clear existing timeout to prevent multiple calls
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Set new timeout to handle activity (debounced)
    timeoutRef.current = setTimeout(handleActivity, 1000);
  }, [handleActivity]);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Activity events to track
    const events = [
      'mousedown',
      'mousemove', 
      'keypress',
      'scroll',
      'touchstart',
      'click'
    ];

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, throttledHandleActivity, { passive: true });
    });

    console.log('🎯 Activity tracker started');

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, throttledHandleActivity);
      });
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      console.log('🧹 Activity tracker cleaned up');
    };
  }, [isAuthenticated, throttledHandleActivity]);

  return { lastActivity: lastActivityRef.current };
} 