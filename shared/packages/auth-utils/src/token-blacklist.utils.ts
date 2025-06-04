import { JWTUtils } from './jwt.utils';

export interface TokenBlacklistConfig {
  redisUrl?: string;
  keyPrefix?: string;
  cleanupInterval?: number;
}

export class TokenBlacklist {
  private redis: any; // Redis client
  private jwtUtils: JWTUtils;
  private keyPrefix: string;
  private cleanupInterval: number;
  private memoryBlacklist: Set<string> = new Set(); // Fallback for development

  constructor(jwtUtils: JWTUtils, config: TokenBlacklistConfig = {}) {
    this.jwtUtils = jwtUtils;
    this.keyPrefix = config.keyPrefix || 'blacklist:';
    this.cleanupInterval = config.cleanupInterval || 3600000; // 1 hour

    // Initialize Redis if available
    this.initializeRedis(config.redisUrl);
    
    // Start cleanup interval
    this.startCleanupInterval();
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
        console.log('✅ Redis connected for token blacklisting');
      }
    } catch (error) {
      console.warn('⚠️ Redis not available, using memory blacklist:', error);
      this.redis = null;
    }
  }

  /**
   * Blacklist a token
   */
  async blacklistToken(token: string, reason: string = 'logout'): Promise<void> {
    try {
      // Get token expiry to set TTL
      const remainingTime = this.jwtUtils.getTokenRemainingTime(token);
      
      if (remainingTime <= 0) {
        return; // Token already expired
      }

      const key = this.keyPrefix + token;
      const value = JSON.stringify({
        reason,
        blacklistedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + remainingTime * 1000).toISOString()
      });

      if (this.redis) {
        // Use Redis with TTL
        await this.redis.setEx(key, remainingTime, value);
      } else {
        // Use memory fallback
        this.memoryBlacklist.add(token);
      }

      console.log(`🚫 Token blacklisted: ${reason}`);
    } catch (error) {
      console.error('Error blacklisting token:', error);
      // Fallback to memory
      this.memoryBlacklist.add(token);
    }
  }

  /**
   * Check if token is blacklisted
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      const key = this.keyPrefix + token;

      if (this.redis) {
        const result = await this.redis.get(key);
        return result !== null;
      } else {
        return this.memoryBlacklist.has(token);
      }
    } catch (error) {
      console.error('Error checking token blacklist:', error);
      return this.memoryBlacklist.has(token);
    }
  }

  /**
   * Remove token from blacklist (if needed)
   */
  async removeTokenFromBlacklist(token: string): Promise<void> {
    try {
      const key = this.keyPrefix + token;

      if (this.redis) {
        await this.redis.del(key);
      } else {
        this.memoryBlacklist.delete(token);
      }
    } catch (error) {
      console.error('Error removing token from blacklist:', error);
    }
  }

  /**
   * Blacklist all user tokens (for logout all devices)
   */
  async blacklistAllUserTokens(userId: string, reason: string = 'logout_all'): Promise<void> {
    try {
      const userPattern = this.keyPrefix + 'user:' + userId + ':*';
      
      if (this.redis) {
        const keys = await this.redis.keys(userPattern);
        if (keys.length > 0) {
          const pipeline = this.redis.multi();
          keys.forEach((key: string) => {
            pipeline.del(key);
          });
          await pipeline.exec();
        }
      }

      // Mark user for token invalidation
      const userKey = this.keyPrefix + 'user:' + userId;
      const value = JSON.stringify({
        reason,
        blacklistedAt: new Date().toISOString(),
        type: 'user_logout_all'
      });

      if (this.redis) {
        await this.redis.setEx(userKey, 86400, value); // 24 hours
      }

      console.log(`🚫 All tokens blacklisted for user: ${userId}`);
    } catch (error) {
      console.error('Error blacklisting user tokens:', error);
    }
  }

  /**
   * Check if user has been logged out from all devices
   */
  async isUserLoggedOutFromAll(userId: string): Promise<boolean> {
    try {
      const userKey = this.keyPrefix + 'user:' + userId;
      
      if (this.redis) {
        const result = await this.redis.get(userKey);
        return result !== null;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking user logout status:', error);
      return false;
    }
  }

  /**
   * Get blacklist statistics
   */
  async getBlacklistStats(): Promise<{
    totalBlacklisted: number;
    memoryCount: number;
    redisConnected: boolean;
  }> {
    try {
      let totalBlacklisted = this.memoryBlacklist.size;
      
      if (this.redis) {
        const keys = await this.redis.keys(this.keyPrefix + '*');
        totalBlacklisted = keys.length;
      }

      return {
        totalBlacklisted,
        memoryCount: this.memoryBlacklist.size,
        redisConnected: this.redis !== null
      };
    } catch (error) {
      console.error('Error getting blacklist stats:', error);
      return {
        totalBlacklisted: this.memoryBlacklist.size,
        memoryCount: this.memoryBlacklist.size,
        redisConnected: false
      };
    }
  }

  /**
   * Cleanup expired tokens from memory blacklist
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanupMemoryBlacklist();
    }, this.cleanupInterval);
  }

  /**
   * Clean up expired tokens from memory
   */
  private cleanupMemoryBlacklist(): void {
    try {
      const expiredTokens: string[] = [];
      
      for (const token of this.memoryBlacklist) {
        if (this.jwtUtils.isTokenExpired(token)) {
          expiredTokens.push(token);
        }
      }

      expiredTokens.forEach(token => {
        this.memoryBlacklist.delete(token);
      });

      if (expiredTokens.length > 0) {
        console.log(`🧹 Cleaned up ${expiredTokens.length} expired tokens from memory`);
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
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
 * Create token blacklist instance
 */
export function createTokenBlacklist(
  jwtUtils: JWTUtils, 
  config?: TokenBlacklistConfig
): TokenBlacklist {
  return new TokenBlacklist(jwtUtils, config);
} 