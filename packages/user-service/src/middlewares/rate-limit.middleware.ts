import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { createClient } from 'redis';
import { RateLimitExceededError } from '../utils/errors';
import { appLogger } from '../utils/logger';

// Redis client for distributed rate limiting
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => {
  appLogger.error('Redis connection error', { error: err.message });
});

redisClient.on('connect', () => {
  appLogger.info('Redis connected for rate limiting');
});

// Connect to Redis
redisClient.connect().catch((error) => {
  appLogger.error('Failed to connect to Redis', { 
    error: error instanceof Error ? error.message : String(error) 
  });
});

// Rate limit store using Redis
class RedisStore {
  private client = redisClient;
  private prefix: string;

  constructor(prefix: string = 'rl:') {
    this.prefix = prefix;
  }

  async increment(key: string, windowMs: number): Promise<{ totalHits: number; resetTime: Date }> {
    const redisKey = `${this.prefix}${key}`;
    const window = Math.floor(Date.now() / windowMs);
    const redisKeyWithWindow = `${redisKey}:${window}`;

    try {
      const current = await this.client.incr(redisKeyWithWindow);
      
      if (current === 1) {
        // Set expiration for the key
        await this.client.expire(redisKeyWithWindow, Math.ceil(windowMs / 1000));
      }

      const resetTime = new Date((window + 1) * windowMs);
      
      return {
        totalHits: current,
        resetTime
      };
    } catch (error) {
      appLogger.error('Redis rate limit error', { 
        error: error instanceof Error ? error.message : String(error), 
        key: redisKey 
      });
      // Fallback: allow request if Redis fails
      return {
        totalHits: 1,
        resetTime: new Date(Date.now() + windowMs)
      };
    }
  }

  async get(key: string, windowMs: number): Promise<number> {
    const redisKey = `${this.prefix}${key}`;
    const window = Math.floor(Date.now() / windowMs);
    const redisKeyWithWindow = `${redisKey}:${window}`;

    try {
      const current = await this.client.get(redisKeyWithWindow);
      return current ? parseInt(current, 10) : 0;
    } catch (error) {
      appLogger.error('Redis rate limit get error', { 
        error: error instanceof Error ? error.message : String(error), 
        key: redisKey 
      });
      return 0;
    }
  }

  async reset(key: string): Promise<void> {
    const redisKey = `${this.prefix}${key}`;
    
    try {
      // Delete all keys matching the pattern
      const keys = await this.client.keys(`${redisKey}:*`);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      appLogger.error('Redis rate limit reset error', { 
        error: error instanceof Error ? error.message : String(error), 
        key: redisKey 
      });
    }
  }
}

// Rate limit configuration interface
interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request, res: Response) => boolean;
  onLimitReached?: (req: Request, res: Response) => void;
}

// Create rate limiter with Redis store (simplified version)
export const createRateLimiter = (config: RateLimitConfig) => {
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    message: config.message || 'Quá nhiều yêu cầu. Vui lòng thử lại sau',
    standardHeaders: config.standardHeaders ?? true,
    legacyHeaders: config.legacyHeaders ?? false,
    keyGenerator: config.keyGenerator || ((req: Request) => {
      // Default key generator: IP + User ID (if authenticated)
      const userId = (req as any).user?.id || '';
      return `${req.ip}:${userId}`;
    }),
    skip: config.skip || (() => false),
    handler: (req: Request, res: Response) => {
      const requestId = req.headers['x-request-id'] as string;
      const userId = (req as any).user?.id;
      
      // Log rate limit exceeded
      appLogger.warn('Rate limit exceeded', {
        requestId,
        userId,
        ip: req.ip,
        method: req.method,
        url: req.originalUrl,
        userAgent: req.headers['user-agent'],
        limit: config.max,
        windowMs: config.windowMs
      });

      // Call custom handler if provided
      if (config.onLimitReached) {
        config.onLimitReached(req, res);
      }

      // Throw custom rate limit error
      throw new RateLimitExceededError(config.max, config.windowMs);
    }
  });
};

// Pre-configured rate limiters for different endpoints
export const generalRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút'
});

export const authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 authentication attempts per 15 minutes
  message: 'Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau 15 phút',
  keyGenerator: (req: Request) => {
    // Rate limit by IP for auth endpoints
    return `auth:${req.ip}`;
  },
  onLimitReached: (req: Request, res: Response) => {
    // Log security event
    appLogger.logSecurity('Multiple failed authentication attempts', 'medium', {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      endpoint: req.originalUrl
    });
  }
});

export const registrationRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 registration attempts per hour
  message: 'Quá nhiều lần đăng ký. Vui lòng thử lại sau 1 giờ',
  keyGenerator: (req: Request) => {
    return `register:${req.ip}`;
  }
});

export const passwordResetRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 password reset attempts per hour
  message: 'Quá nhiều yêu cầu đặt lại mật khẩu. Vui lòng thử lại sau 1 giờ',
  keyGenerator: (req: Request) => {
    const email = req.body.email || req.query.email || '';
    return `reset:${email}:${req.ip}`;
  }
});

export const emailVerificationRateLimit = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // 3 verification emails per 5 minutes
  message: 'Quá nhiều yêu cầu gửi email xác thực. Vui lòng thử lại sau 5 phút',
  keyGenerator: (req: Request) => {
    const email = req.body.email || req.query.email || '';
    return `verify:${email}`;
  }
});

export const profileUpdateRateLimit = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10, // 10 profile updates per 10 minutes
  message: 'Quá nhiều lần cập nhật thông tin. Vui lòng thử lại sau 10 phút',
  keyGenerator: (req: Request) => {
    const userId = (req as any).user?.id || req.ip;
    return `profile:${userId}`;
  }
});

export const apiRateLimit = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute for API endpoints
  message: 'Quá nhiều yêu cầu API. Vui lòng thử lại sau 1 phút'
});

// Strict rate limiter for sensitive operations
export const strictRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour
  message: 'Giới hạn nghiêm ngặt: Quá nhiều yêu cầu cho thao tác nhạy cảm',
  keyGenerator: (req: Request) => {
    const userId = (req as any).user?.id || req.ip;
    return `strict:${userId}:${req.ip}`;
  }
});

// Sliding window rate limiter for premium users
export const premiumRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // 500 requests per 15 minutes for premium users
  message: 'Giới hạn cho người dùng premium đã đạt tối đa',
  skip: (req: Request) => {
    const userPlan = (req as any).user?.subscription?.plan;
    return userPlan !== 'PREMIUM' && userPlan !== 'ENTERPRISE';
  }
});

// Dynamic rate limiter based on user plan
export const dynamicRateLimit = (req: Request, res: Response, next: any) => {
  const userPlan = (req as any).user?.subscription?.plan;
  
  let rateLimiter;
  
  switch (userPlan) {
    case 'PREMIUM':
      rateLimiter = premiumRateLimit;
      break;
    case 'ENTERPRISE':
      // No rate limiting for enterprise users
      return next();
    default:
      rateLimiter = generalRateLimit;
  }
  
  return rateLimiter(req, res, next);
};

// IP whitelist middleware
const whitelistedIPs = new Set(process.env.WHITELISTED_IPS?.split(',') || []);

export const ipWhitelist = (req: Request, res: Response, next: any) => {
  const clientIP = req.ip || req.connection.remoteAddress || '';
  
  if (whitelistedIPs.has(clientIP)) {
    appLogger.info('Whitelisted IP bypassing rate limit', {
      ip: clientIP,
      url: req.originalUrl
    });
    return next();
  }
  
  return next();
};

// Rate limit status endpoint
export const getRateLimitStatus = async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const ip = req.ip || '';
  const key = userId ? `${ip}:${userId}` : ip;
  
  const store = new RedisStore();
  
  try {
    const generalLimit = await store.get(key, 15 * 60 * 1000);
    const authLimit = await store.get(`auth:${ip}`, 15 * 60 * 1000);
    
    res.json({
      success: true,
      data: {
        general: {
          current: generalLimit,
          limit: 100,
          windowMs: 15 * 60 * 1000
        },
        auth: {
          current: authLimit,
          limit: 5,
          windowMs: 15 * 60 * 1000
        }
      }
    });
  } catch (error) {
    appLogger.error('Error getting rate limit status', { 
      error: error instanceof Error ? error.message : String(error), 
      userId, 
      ip 
    });
    res.status(500).json({
      success: false,
      error: 'Unable to get rate limit status'
    });
  }
};

// Cleanup function
export const cleanupRateLimitStore = async () => {
  try {
    await redisClient.quit();
    appLogger.info('Rate limit store cleanup completed');
  } catch (error) {
    appLogger.error('Error during rate limit store cleanup', { 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
};

export default {
  createRateLimiter,
  generalRateLimit,
  authRateLimit,
  registrationRateLimit,
  passwordResetRateLimit,
  emailVerificationRateLimit,
  profileUpdateRateLimit,
  apiRateLimit,
  strictRateLimit,
  premiumRateLimit,
  dynamicRateLimit,
  ipWhitelist,
  getRateLimitStatus,
  cleanupRateLimitStore
}; 