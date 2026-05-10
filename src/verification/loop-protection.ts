/**
 * Loop protection for OpenGuard verification system
 */

import { VerificationConfig } from './types.js';

/**
 * Session information for tracking verification depth
 */
interface SessionInfo {
  sessionId: string;
  currentDepth: number;
  maxDepth: number;
  createdAt: number;
  lastActivity: number;
}

/**
 * Loop protection manager
 */
export class LoopProtectionManager {
  private static sessions: Map<string, SessionInfo> = new Map();
  private static cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize loop protection
   */
  static initialize(): void {
    // Clean up old sessions every 5 minutes
    if (!this.cleanupInterval) {
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, 5 * 60 * 1000);
    }
  }

  /**
   * Check if verification can proceed
   */
  static canProceed(config: VerificationConfig): { canProceed: boolean; updatedConfig: VerificationConfig } {
    this.initialize();

    const sessionId = config.loopProtection.sessionId || this.generateSessionId();
    const session = this.sessions.get(sessionId);

    if (!session) {
      // Create new session
      const newSession: SessionInfo = {
        sessionId,
        currentDepth: 1,
        maxDepth: config.loopProtection.maxDepth,
        createdAt: Date.now(),
        lastActivity: Date.now(),
      };
      this.sessions.set(sessionId, newSession);

      return {
        canProceed: true,
        updatedConfig: {
          ...config,
          loopProtection: {
            ...config.loopProtection,
            currentDepth: 1,
            sessionId,
          },
        },
      };
    }

    // Update session activity
    session.lastActivity = Date.now();
    session.currentDepth++;

    // Check depth limit
    if (session.currentDepth > session.maxDepth) {
      return {
        canProceed: false,
        updatedConfig: config,
      };
    }

    return {
      canProceed: true,
      updatedConfig: {
        ...config,
        loopProtection: {
          ...config.loopProtection,
          currentDepth: session.currentDepth,
          sessionId,
        },
      },
    };
  }

  /**
   * Mark verification as completed for a session
   */
  static completeVerification(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.currentDepth = Math.max(0, session.currentDepth - 1);
      session.lastActivity = Date.now();
    }
  }

  /**
   * Reset session depth
   */
  static resetSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.currentDepth = 0;
      session.lastActivity = Date.now();
    }
  }

  /**
   * Get session information
   */
  static getSessionInfo(sessionId: string): SessionInfo | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Generate unique session ID
   */
  private static generateSessionId(): string {
    return `verify_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clean up old sessions (older than 30 minutes)
   */
  private static cleanup(): void {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivity > maxAge) {
        this.sessions.delete(sessionId);
      }
    }
  }

  /**
   * Get all active sessions
   */
  static getActiveSessions(): SessionInfo[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Clear all sessions (for testing)
   */
  static clearAllSessions(): void {
    this.sessions.clear();
  }

  /**
   * Shutdown loop protection
   */
  static shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.sessions.clear();
  }
}
