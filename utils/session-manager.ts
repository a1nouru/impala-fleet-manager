/**
 * Session State Manager for Cold Start Recovery
 * Handles session/state conflicts that can occur during container wake-ups
 */

interface SessionState {
  timestamp: string;
  sessionId: string;
  isValid: boolean;
  lastActivity: string;
}

class SessionManager {
  private static instance: SessionManager;
  private sessionKey = 'app-session-state';
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  /**
   * Initialize session management
   */
  initialize(): void {
    if (typeof window === 'undefined') return;

    console.log('🔐 Initializing session manager...');
    
    // Check for existing session
    const existingSession = this.getStoredSession();
    
    if (!existingSession || !this.isSessionValid(existingSession)) {
      console.log('🆕 Creating new session...');
      this.createNewSession();
    } else {
      console.log('✅ Existing session is valid');
      this.updateLastActivity();
    }

    // Start heartbeat
    this.startHeartbeat();

    // Listen for page visibility changes
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    
    // Listen for beforeunload to cleanup
    window.addEventListener('beforeunload', this.cleanup.bind(this));
  }

  /**
   * Create a new session
   */
  private createNewSession(): void {
    const session: SessionState = {
      timestamp: new Date().toISOString(),
      sessionId: this.generateSessionId(),
      isValid: true,
      lastActivity: new Date().toISOString(),
    };

    this.storeSession(session);
    console.log(`🔑 New session created: ${session.sessionId}`);
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Store session in localStorage
   */
  private storeSession(session: SessionState): void {
    try {
      localStorage.setItem(this.sessionKey, JSON.stringify(session));
    } catch (error) {
      console.error('❌ Failed to store session:', error);
    }
  }

  /**
   * Get stored session from localStorage
   */
  private getStoredSession(): SessionState | null {
    try {
      const stored = localStorage.getItem(this.sessionKey);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('❌ Failed to retrieve session:', error);
      return null;
    }
  }

  /**
   * Check if session is valid
   */
  private isSessionValid(session: SessionState): boolean {
    if (!session.isValid) return false;

    const lastActivity = new Date(session.lastActivity).getTime();
    const now = Date.now();
    
    return (now - lastActivity) < this.SESSION_TIMEOUT;
  }

  /**
   * Update last activity timestamp
   */
  updateLastActivity(): void {
    const session = this.getStoredSession();
    if (session) {
      session.lastActivity = new Date().toISOString();
      this.storeSession(session);
    }
  }

  /**
   * Start heartbeat to keep session alive
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      this.updateLastActivity();
      
      // Ping health endpoint to maintain warmth
      fetch('/api/health', {
        method: 'GET',
        headers: {
          'User-Agent': 'Session-Heartbeat',
        },
      }).catch(() => {
        // Ignore errors, this is just a keepalive
      });

      console.log('💓 Session heartbeat');
    }, this.HEARTBEAT_INTERVAL);
  }

  /**
   * Handle page visibility changes
   */
  private handleVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      console.log('👁️ Page became visible - checking session...');
      
      const session = this.getStoredSession();
      if (!session || !this.isSessionValid(session)) {
        console.log('🔄 Session expired or invalid - creating new session');
        this.createNewSession();
      } else {
        this.updateLastActivity();
      }
      
      // Restart heartbeat if needed
      if (!this.heartbeatInterval) {
        this.startHeartbeat();
      }
    } else {
      console.log('👁️‍🗨️ Page became hidden');
    }
  }

  /**
   * Get current session info
   */
  getCurrentSession(): SessionState | null {
    return this.getStoredSession();
  }

  /**
   * Invalidate current session
   */
  invalidateSession(): void {
    const session = this.getStoredSession();
    if (session) {
      session.isValid = false;
      this.storeSession(session);
    }
    console.log('❌ Session invalidated');
  }

  /**
   * Check if we're recovering from a cold start
   */
  detectColdStart(): boolean {
    const session = this.getStoredSession();
    if (!session) return true;

    const sessionAge = Date.now() - new Date(session.timestamp).getTime();
    const lastActivity = Date.now() - new Date(session.lastActivity).getTime();
    
    // If session is old or there's been a long gap in activity
    const isColdStart = sessionAge > this.SESSION_TIMEOUT || lastActivity > this.SESSION_TIMEOUT;
    
    if (isColdStart) {
      console.log('🧊 Cold start detected');
    }
    
    return isColdStart;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    document.removeEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    window.removeEventListener('beforeunload', this.cleanup.bind(this));
  }
}

export const sessionManager = SessionManager.getInstance();

// Convenience functions
export const initializeSession = () => sessionManager.initialize();
export const updateActivity = () => sessionManager.updateLastActivity();
export const getCurrentSession = () => sessionManager.getCurrentSession();
export const detectColdStart = () => sessionManager.detectColdStart();
export const invalidateSession = () => sessionManager.invalidateSession(); 