import { JWTUtils } from './jwt.utils';
import { AuthUser } from './types';

export interface SessionConfig {
  redisUrl?: string;
  keyPrefix?: string;
  sessionTTL?: number; // in seconds
  maxSessionsPerUser?: number;
}

export interface SessionData {
  userId: string;
  sessionId: string;
  deviceInfo?: {
    userAgent?: string;
    ip?: string;
    platform?: string;
    deviceType?: 'mobile' | 'desktop' | 'tablet';
  };
  createdAt: string;
  lastAccessedAt: string;
  expiresAt: string;
  isActive: boolean;
}

export class SessionManager {
  private redis: any;
  private jwtUtils: JWTUtils;
  private keyPrefix: string;
  private sessionTTL: number;
  private maxSessionsPerUser: number;
  private memorySessions: Map<string, SessionData> = new Map();

  constructor(jwtUtils: JWTUtils, config: SessionConfig = {}) {
    this.jwtUtils = jwtUtils;
    this.keyPrefix = config.keyPrefix || 'session:';
    this.sessionTTL = config.sessionTTL || 86400; // 24 hours
    this.maxSessionsPerUser = config.maxSessionsPerUser || 5;

    this.initializeRedis(config.redisUrl);
  }

  /**
   * Initialize Redis connection
   */
  private async initializeRedis(redisUrl?: string) {
    try {
      if (redisUrl || process.env.REDIS_URL) {
        const Redis = await import('redis');
        this.redis = Redis.createClient({
          url: redisUrl || process.env.REDIS_URL
        });
        
        await this.redis.connect();
        console.log('✅ Redis connected for session management');
      }
    } catch (error) {
      console.warn('⚠️ Redis not available, using memory sessions:', error);
      this.redis = null;
    }
  }

  /**
   * Create a new session
   */
  async createSession(
    userId: string, 
    deviceInfo?: SessionData['deviceInfo']
  ): Promise<SessionData> {
    const sessionId = this.generateSessionId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.sessionTTL * 1000);

    const sessionData: SessionData = {
      userId,
      sessionId,
      deviceInfo,
      createdAt: now.toISOString(),
      lastAccessedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      isActive: true
    };

    // Check session limit per user
    await this.enforceSessionLimit(userId);

    // Store session
    const sessionKey = this.keyPrefix + sessionId;
    const userSessionsKey = this.keyPrefix + 'user:' + userId;

    if (this.redis) {
      // Store in Redis
      await this.redis.setEx(sessionKey, this.sessionTTL, JSON.stringify(sessionData));
      
      // Add to user's session list
      await this.redis.sAdd(userSessionsKey, sessionId);
      await this.redis.expire(userSessionsKey, this.sessionTTL);
    } else {
      // Store in memory
      this.memorySessions.set(sessionId, sessionData);
    }

    console.log(`✅ Session created for user ${userId}: ${sessionId}`);
    return sessionData;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      const sessionKey = this.keyPrefix + sessionId;

      if (this.redis) {
        const sessionData = await this.redis.get(sessionKey);
        return sessionData ? JSON.parse(sessionData) : null;
      } else {
        return this.memorySessions.get(sessionId) || null;
      }
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }

  /**
   * Update session last accessed time
   */
  async updateSessionAccess(sessionId: string): Promise<void> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) return;

      session.lastAccessedAt = new Date().toISOString();

      const sessionKey = this.keyPrefix + sessionId;

      if (this.redis) {
        await this.redis.setEx(sessionKey, this.sessionTTL, JSON.stringify(session));
      } else {
        this.memorySessions.set(sessionId, session);
      }
    } catch (error) {
      console.error('Error updating session access:', error);
    }
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string): Promise<SessionData[]> {
    try {
      const userSessionsKey = this.keyPrefix + 'user:' + userId;

      if (this.redis) {
        const sessionIds = await this.redis.sMembers(userSessionsKey);
        const sessions: SessionData[] = [];

        for (const sessionId of sessionIds) {
          const session = await this.getSession(sessionId);
          if (session && session.isActive) {
            sessions.push(session);
          }
        }

        return sessions;
      } else {
        // Filter memory sessions by userId
        const sessions: SessionData[] = [];
        for (const session of this.memorySessions.values()) {
          if (session.userId === userId && session.isActive) {
            sessions.push(session);
          }
        }
        return sessions;
      }
    } catch (error) {
      console.error('Error getting user sessions:', error);
      return [];
    }
  }

  /**
   * Invalidate a specific session
   */
  async invalidateSession(sessionId: string): Promise<void> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) return;

      session.isActive = false;

      const sessionKey = this.keyPrefix + sessionId;
      const userSessionsKey = this.keyPrefix + 'user:' + session.userId;

      if (this.redis) {
        await this.redis.del(sessionKey);
        await this.redis.sRem(userSessionsKey, sessionId);
      } else {
        this.memorySessions.delete(sessionId);
      }

      console.log(`🚫 Session invalidated: ${sessionId}`);
    } catch (error) {
      console.error('Error invalidating session:', error);
    }
  }

  /**
   * Invalidate all sessions for a user
   */
  async invalidateAllUserSessions(userId: string): Promise<void> {
    try {
      const sessions = await this.getUserSessions(userId);
      
      for (const session of sessions) {
        await this.invalidateSession(session.sessionId);
      }

      console.log(`🚫 All sessions invalidated for user: ${userId}`);
    } catch (error) {
      console.error('Error invalidating user sessions:', error);
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<void> {
    try {
      const now = new Date();

      if (this.redis) {
        // Redis TTL handles expiration automatically
        return;
      } else {
        // Clean memory sessions
        const expiredSessions: string[] = [];
        
        for (const [sessionId, session] of this.memorySessions.entries()) {
          const expiresAt = new Date(session.expiresAt);
          if (expiresAt < now) {
            expiredSessions.push(sessionId);
          }
        }

        expiredSessions.forEach(sessionId => {
          this.memorySessions.delete(sessionId);
        });

        if (expiredSessions.length > 0) {
          console.log(`🧹 Cleaned up ${expiredSessions.length} expired sessions`);
        }
      }
    } catch (error) {
      console.error('Error cleaning up sessions:', error);
    }
  }

  /**
   * Enforce session limit per user
   */
  private async enforceSessionLimit(userId: string): Promise<void> {
    try {
      const sessions = await this.getUserSessions(userId);
      
      if (sessions.length >= this.maxSessionsPerUser) {
        // Sort by last accessed (oldest first)
        sessions.sort((a, b) => 
          new Date(a.lastAccessedAt).getTime() - new Date(b.lastAccessedAt).getTime()
        );

        // Remove oldest sessions
        const sessionsToRemove = sessions.slice(0, sessions.length - this.maxSessionsPerUser + 1);
        
        for (const session of sessionsToRemove) {
          await this.invalidateSession(session.sessionId);
        }

        console.log(`🔄 Enforced session limit for user ${userId}: removed ${sessionsToRemove.length} old sessions`);
      }
    } catch (error) {
      console.error('Error enforcing session limit:', error);
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return Math.random().toString(36).substring(2) + 
           Date.now().toString(36) + 
           Math.random().toString(36).substring(2);
  }

  /**
   * Get session statistics
   */
  async getSessionStats(): Promise<{
    totalActiveSessions: number;
    memorySessionCount: number;
    redisConnected: boolean;
  }> {
    try {
      let totalActiveSessions = this.memorySessions.size;

      if (this.redis) {
        const keys = await this.redis.keys(this.keyPrefix + '*');
        // Filter out user session lists
        const sessionKeys = keys.filter((key: string) => !key.includes('user:'));
        totalActiveSessions = sessionKeys.length;
      }

      return {
        totalActiveSessions,
        memorySessionCount: this.memorySessions.size,
        redisConnected: this.redis !== null
      };
    } catch (error) {
      console.error('Error getting session stats:', error);
      return {
        totalActiveSessions: this.memorySessions.size,
        memorySessionCount: this.memorySessions.size,
        redisConnected: false
      };
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    try {
      if (this.redis) {
        await this.redis.quit();
      }
    } catch (error) {
      console.error('Error closing Redis connection:', error);
    }
  }
}

/**
 * Create session manager instance
 */
export function createSessionManager(
  jwtUtils: JWTUtils,
  config?: SessionConfig
): SessionManager {
  return new SessionManager(jwtUtils, config);
} 