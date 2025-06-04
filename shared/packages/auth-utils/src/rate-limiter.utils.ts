import { UserPlan } from './types';

// Advanced Rate Limiting với Sliding Window
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (identifier: string) => string;
  onLimitReached?: (identifier: string) => void;
  customLimits?: Map<string, { windowMs: number; maxRequests: number }>;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export class SlidingWindowRateLimiter {
  private windows = new Map<string, number[]>();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
    
    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if request is allowed
   */
  checkLimit(identifier: string, timestamp: number = Date.now()): RateLimitResult {
    const key = this.config.keyGenerator ? this.config.keyGenerator(identifier) : identifier;
    const customLimit = this.config.customLimits?.get(identifier);
    
    const windowMs = customLimit?.windowMs || this.config.windowMs;
    const maxRequests = customLimit?.maxRequests || this.config.maxRequests;
    
    let window = this.windows.get(key) || [];
    
    // Remove expired timestamps
    const cutoff = timestamp - windowMs;
    window = window.filter(ts => ts > cutoff);
    
    const allowed = window.length < maxRequests;
    
    if (allowed) {
      window.push(timestamp);
      this.windows.set(key, window);
    } else if (this.config.onLimitReached) {
      this.config.onLimitReached(identifier);
    }
    
    const resetTime = window.length > 0 ? window[0] + windowMs : timestamp + windowMs;
    const retryAfter = allowed ? undefined : Math.ceil((resetTime - timestamp) / 1000);
    
    return {
      allowed,
      limit: maxRequests,
      remaining: Math.max(0, maxRequests - window.length),
      resetTime,
      retryAfter
    };
  }

  /**
   * Record request (for post-processing)
   */
  recordRequest(identifier: string, success: boolean = true): void {
    if (this.config.skipSuccessfulRequests && success) return;
    if (this.config.skipFailedRequests && !success) return;
    
    // Request already recorded in checkLimit if allowed
  }

  /**
   * Set custom limit for specific identifier
   */
  setCustomLimit(identifier: string, windowMs: number, maxRequests: number): void {
    if (!this.config.customLimits) {
      this.config.customLimits = new Map();
    }
    this.config.customLimits.set(identifier, { windowMs, maxRequests });
  }

  /**
   * Remove custom limit
   */
  removeCustomLimit(identifier: string): void {
    this.config.customLimits?.delete(identifier);
  }

  /**
   * Get current usage for identifier
   */
  getCurrentUsage(identifier: string): {
    requests: number;
    window: number[];
    resetTime: number;
  } {
    const key = this.config.keyGenerator ? this.config.keyGenerator(identifier) : identifier;
    const customLimit = this.config.customLimits?.get(identifier);
    const windowMs = customLimit?.windowMs || this.config.windowMs;
    
    let window = this.windows.get(key) || [];
    const cutoff = Date.now() - windowMs;
    window = window.filter(ts => ts > cutoff);
    
    const resetTime = window.length > 0 ? window[0] + windowMs : Date.now() + windowMs;
    
    return {
      requests: window.length,
      window,
      resetTime
    };
  }

  /**
   * Reset limits for identifier
   */
  reset(identifier: string): void {
    const key = this.config.keyGenerator ? this.config.keyGenerator(identifier) : identifier;
    this.windows.delete(key);
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    
    for (const [key, window] of this.windows.entries()) {
      const cutoff = now - this.config.windowMs;
      const cleanWindow = window.filter(ts => ts > cutoff);
      
      if (cleanWindow.length === 0) {
        this.windows.delete(key);
      } else if (cleanWindow.length !== window.length) {
        this.windows.set(key, cleanWindow);
      }
    }
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalIdentifiers: number;
    activeWindows: number;
    memoryUsage: number;
    topUsers: Array<{ identifier: string; requests: number }>;
  } {
    const now = Date.now();
    let totalRequests = 0;
    const userRequests: Array<{ identifier: string; requests: number }> = [];
    
    for (const [identifier, window] of this.windows.entries()) {
      const cutoff = now - this.config.windowMs;
      const activeRequests = window.filter(ts => ts > cutoff).length;
      totalRequests += activeRequests;
      
      if (activeRequests > 0) {
        userRequests.push({ identifier, requests: activeRequests });
      }
    }
    
    userRequests.sort((a, b) => b.requests - a.requests);
    
    return {
      totalIdentifiers: this.windows.size,
      activeWindows: userRequests.length,
      memoryUsage: this.estimateMemoryUsage(),
      topUsers: userRequests.slice(0, 10)
    };
  }

  /**
   * Estimate memory usage
   */
  private estimateMemoryUsage(): number {
    let size = 0;
    for (const [key, window] of this.windows.entries()) {
      size += key.length * 2; // String size estimate
      size += window.length * 8; // Number array size
    }
    return size;
  }
}

// Plan-based Rate Limiting
export class PlanBasedRateLimiter {
  private limiters = new Map<string, SlidingWindowRateLimiter>();
  private userPlans = new Map<string, UserPlan>();

  constructor() {
    this.initializeLimiters();
  }

  private initializeLimiters(): void {
    // API Request limits per plan
    const apiLimits = {
      [UserPlan.FREE]: { windowMs: 15 * 60 * 1000, maxRequests: 100 },
      [UserPlan.PREMIUM]: { windowMs: 15 * 60 * 1000, maxRequests: 500 },
      [UserPlan.ENTERPRISE]: { windowMs: 15 * 60 * 1000, maxRequests: 2000 }
    };

    // Login attempt limits
    const loginLimits = {
      [UserPlan.FREE]: { windowMs: 15 * 60 * 1000, maxRequests: 5 },
      [UserPlan.PREMIUM]: { windowMs: 15 * 60 * 1000, maxRequests: 10 },
      [UserPlan.ENTERPRISE]: { windowMs: 15 * 60 * 1000, maxRequests: 20 }
    };

    // AI Service limits
    const aiLimits = {
      [UserPlan.FREE]: { windowMs: 60 * 60 * 1000, maxRequests: 10 },
      [UserPlan.PREMIUM]: { windowMs: 60 * 60 * 1000, maxRequests: 100 },
      [UserPlan.ENTERPRISE]: { windowMs: 60 * 60 * 1000, maxRequests: 1000 }
    };

    // Create limiters for each category
    Object.values(UserPlan).forEach(plan => {
      this.limiters.set(`api:${plan}`, new SlidingWindowRateLimiter(apiLimits[plan]));
      this.limiters.set(`login:${plan}`, new SlidingWindowRateLimiter(loginLimits[plan]));
      this.limiters.set(`ai:${plan}`, new SlidingWindowRateLimiter(aiLimits[plan]));
    });
  }

  /**
   * Set user plan
   */
  setUserPlan(userId: string, plan: UserPlan): void {
    this.userPlans.set(userId, plan);
  }

  /**
   * Check rate limit for user
   */
  checkLimit(userId: string, category: 'api' | 'login' | 'ai'): RateLimitResult {
    const plan = this.userPlans.get(userId) || UserPlan.FREE;
    const limiterKey = `${category}:${plan}`;
    const limiter = this.limiters.get(limiterKey);

    if (!limiter) {
      throw new Error(`Rate limiter not found for ${limiterKey}`);
    }

    return limiter.checkLimit(userId);
  }

  /**
   * Record request
   */
  recordRequest(userId: string, category: 'api' | 'login' | 'ai', success: boolean = true): void {
    const plan = this.userPlans.get(userId) || UserPlan.FREE;
    const limiterKey = `${category}:${plan}`;
    const limiter = this.limiters.get(limiterKey);

    if (limiter) {
      limiter.recordRequest(userId, success);
    }
  }

  /**
   * Get user current usage
   */
  getUserUsage(userId: string): {
    plan: UserPlan;
    api: any;
    login: any;
    ai: any;
  } {
    const plan = this.userPlans.get(userId) || UserPlan.FREE;
    
    return {
      plan,
      api: this.limiters.get(`api:${plan}`)?.getCurrentUsage(userId),
      login: this.limiters.get(`login:${plan}`)?.getCurrentUsage(userId),
      ai: this.limiters.get(`ai:${plan}`)?.getCurrentUsage(userId)
    };
  }

  /**
   * Reset user limits
   */
  resetUserLimits(userId: string): void {
    const plan = this.userPlans.get(userId) || UserPlan.FREE;
    
    this.limiters.get(`api:${plan}`)?.reset(userId);
    this.limiters.get(`login:${plan}`)?.reset(userId);
    this.limiters.get(`ai:${plan}`)?.reset(userId);
  }

  /**
   * Get global statistics
   */
  getGlobalStatistics(): {
    byPlan: Record<string, any>;
    totalUsers: number;
    heaviestUsers: Array<{ userId: string; totalRequests: number; plan: UserPlan }>;
  } {
    const byPlan: Record<string, any> = {};
    const userTotals = new Map<string, { requests: number; plan: UserPlan }>();

    // Aggregate statistics by plan
    Object.values(UserPlan).forEach(plan => {
      byPlan[plan] = {
        api: this.limiters.get(`api:${plan}`)?.getStatistics(),
        login: this.limiters.get(`login:${plan}`)?.getStatistics(),
        ai: this.limiters.get(`ai:${plan}`)?.getStatistics()
      };
    });

    // Calculate heaviest users
    for (const [userId, plan] of this.userPlans.entries()) {
      const apiUsage = this.limiters.get(`api:${plan}`)?.getCurrentUsage(userId);
      const loginUsage = this.limiters.get(`login:${plan}`)?.getCurrentUsage(userId);
      const aiUsage = this.limiters.get(`ai:${plan}`)?.getCurrentUsage(userId);
      
      const totalRequests = (apiUsage?.requests || 0) + (loginUsage?.requests || 0) + (aiUsage?.requests || 0);
      
      if (totalRequests > 0) {
        userTotals.set(userId, { requests: totalRequests, plan });
      }
    }

    const heaviestUsers = Array.from(userTotals.entries())
      .map(([userId, data]) => ({ userId, totalRequests: data.requests, plan: data.plan }))
      .sort((a, b) => b.totalRequests - a.totalRequests)
      .slice(0, 20);

    return {
      byPlan,
      totalUsers: this.userPlans.size,
      heaviestUsers
    };
  }
}

// Distributed Rate Limiting (Redis-based)
export interface DistributedRateLimitConfig {
  redisClient: any; // Redis client instance
  keyPrefix: string;
  windowMs: number;
  maxRequests: number;
  syncInterval?: number;
}

export class DistributedRateLimiter {
  private config: DistributedRateLimitConfig;
  private localCache = new Map<string, { count: number; expiry: number }>();

  constructor(config: DistributedRateLimitConfig) {
    this.config = {
      syncInterval: 5000, // 5 seconds
      ...config
    };

    // Sync with Redis periodically
    setInterval(() => this.syncWithRedis(), this.config.syncInterval);
  }

  /**
   * Check rate limit (hybrid local/Redis)
   */
  async checkLimit(identifier: string): Promise<RateLimitResult> {
    const key = `${this.config.keyPrefix}:${identifier}`;
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    try {
      // Use Redis for distributed state
      const count = await this.getRequestCount(key, windowStart, now);
      const allowed = count < this.config.maxRequests;

      if (allowed) {
        await this.incrementCount(key, now);
      }

      const resetTime = now + this.config.windowMs;
      const retryAfter = allowed ? undefined : Math.ceil(this.config.windowMs / 1000);

      return {
        allowed,
        limit: this.config.maxRequests,
        remaining: Math.max(0, this.config.maxRequests - count),
        resetTime,
        retryAfter
      };
    } catch (error) {
      // Fallback to local cache if Redis fails
      console.warn('Redis rate limiting failed, falling back to local cache:', error);
      return this.checkLimitLocal(identifier);
    }
  }

  /**
   * Get request count from Redis using sliding window
   */
  private async getRequestCount(key: string, windowStart: number, now: number): Promise<number> {
    const pipeline = this.config.redisClient.pipeline();
    
    // Remove expired entries
    pipeline.zremrangebyscore(key, 0, windowStart);
    
    // Count current entries
    pipeline.zcard(key);
    
    // Set expiry for cleanup
    pipeline.expire(key, Math.ceil(this.config.windowMs / 1000));
    
    const results = await pipeline.exec();
    return results[1][1] || 0;
  }

  /**
   * Increment request count in Redis
   */
  private async incrementCount(key: string, timestamp: number): Promise<void> {
    const pipeline = this.config.redisClient.pipeline();
    
    // Add current timestamp
    pipeline.zadd(key, timestamp, `${timestamp}-${Math.random()}`);
    
    // Clean up old entries
    pipeline.zremrangebyscore(key, 0, timestamp - this.config.windowMs);
    
    // Set expiry
    pipeline.expire(key, Math.ceil(this.config.windowMs / 1000));
    
    await pipeline.exec();
  }

  /**
   * Local cache fallback
   */
  private checkLimitLocal(identifier: string): RateLimitResult {
    const key = `local:${identifier}`;
    const now = Date.now();
    const cached = this.localCache.get(key);

    if (!cached || cached.expiry < now) {
      // Reset window
      this.localCache.set(key, { count: 1, expiry: now + this.config.windowMs });
      return {
        allowed: true,
        limit: this.config.maxRequests,
        remaining: this.config.maxRequests - 1,
        resetTime: now + this.config.windowMs
      };
    }

    const allowed = cached.count < this.config.maxRequests;
    
    if (allowed) {
      cached.count++;
    }

    return {
      allowed,
      limit: this.config.maxRequests,
      remaining: Math.max(0, this.config.maxRequests - cached.count),
      resetTime: cached.expiry,
      retryAfter: allowed ? undefined : Math.ceil((cached.expiry - now) / 1000)
    };
  }

  /**
   * Sync local cache with Redis
   */
  private async syncWithRedis(): Promise<void> {
    try {
      const now = Date.now();
      
      // Clean expired local entries
      for (const [key, cached] of this.localCache.entries()) {
        if (cached.expiry < now) {
          this.localCache.delete(key);
        }
      }
      
      // Additional Redis sync logic could be added here
    } catch (error) {
      console.warn('Redis sync failed:', error);
    }
  }

  /**
   * Reset limits for identifier
   */
  async reset(identifier: string): Promise<void> {
    const key = `${this.config.keyPrefix}:${identifier}`;
    
    try {
      await this.config.redisClient.del(key);
    } catch (error) {
      console.warn('Redis reset failed:', error);
    }
    
    this.localCache.delete(`local:${identifier}`);
  }

  /**
   * Get current usage from Redis
   */
  async getCurrentUsage(identifier: string): Promise<{
    requests: number;
    resetTime: number;
    remaining: number;
  }> {
    const key = `${this.config.keyPrefix}:${identifier}`;
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    try {
      const count = await this.getRequestCount(key, windowStart, now);
      
      return {
        requests: count,
        resetTime: now + this.config.windowMs,
        remaining: Math.max(0, this.config.maxRequests - count)
      };
    } catch (error) {
      // Fallback to local cache
      const cached = this.localCache.get(`local:${identifier}`);
      if (cached && cached.expiry > now) {
        return {
          requests: cached.count,
          resetTime: cached.expiry,
          remaining: Math.max(0, this.config.maxRequests - cached.count)
        };
      }
      
      return {
        requests: 0,
        resetTime: now + this.config.windowMs,
        remaining: this.config.maxRequests
      };
    }
  }
}

// Rate Limit Middleware Factory
export function createRateLimitMiddleware(limiter: SlidingWindowRateLimiter | PlanBasedRateLimiter | DistributedRateLimiter) {
  return async (req: any, res: any, next: any) => {
    try {
      const identifier = req.user?.id || req.ip || 'anonymous';
      let result: RateLimitResult;

      if (limiter instanceof PlanBasedRateLimiter) {
        result = limiter.checkLimit(identifier, 'api');
      } else if (limiter instanceof DistributedRateLimiter) {
        result = await limiter.checkLimit(identifier);
      } else {
        result = limiter.checkLimit(identifier);
      }

      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': new Date(result.resetTime).toISOString()
      });

      if (!result.allowed) {
        if (result.retryAfter) {
          res.set('Retry-After', result.retryAfter.toString());
        }
        
        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Bạn đã vượt quá giới hạn số lượng request. Vui lòng thử lại sau.',
          retryAfter: result.retryAfter
        });
      }

      next();
    } catch (error) {
      console.error('Rate limiting error:', error);
      // Allow request if rate limiting fails
      next();
    }
  };
} 