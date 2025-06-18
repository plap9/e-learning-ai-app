import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import {
  AuthenticationError,
  ValidationError,
  UserNotFoundError,
  SystemError
} from '../exceptions';
import { appLogger as logger } from '../utils/logger';
import { authConfig } from '../config/auth.config';
import {
  extractInternalToken,
  verifyServicePermission,
  sanitizeInput,
  sanitizeUserId,
  generateUserRateLimitKey,
  generateIPRateLimitKey
} from '../utils/security.utils';
import {
  validateUpdateProfile,
  validateUpdatePreferences,
  validateUserId
} from '../schemas/user.schemas';

// Import service layer for proper SoC
import { userService } from '../services/user.service';

// Type definitions
import { AuthRequest, ApiResponse, RequestContext } from '../types/express';

// Rate limiting configurations - following comprehensive rules
export const profileUpdateRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each user to 5 profile updates per window
  message: {
    error: 'Too many profile updates',
    message: 'Quá nhiều lần cập nhật profile. Thử lại sau 15 phút.'
  },
  keyGenerator: (req: Request) => {
    const userId = req.user?.id || req.ip || 'anonymous';
    return generateUserRateLimitKey('profile_update', userId);
  },
  standardHeaders: true,
  legacyHeaders: false
});

export const internalApiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // limit each service to 100 requests per minute
  message: {
    error: 'Too many internal API requests',
    message: 'Internal API rate limit exceeded'
  },
  keyGenerator: (req: Request) => {
    const service = req.headers['x-service-name'] || req.ip || 'unknown';
    return generateIPRateLimitKey('internal_api', service as string);
  },
  standardHeaders: true,
  legacyHeaders: false
});

// AsyncHandler for error handling
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => 
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// Authentication middleware
export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user?.id) {
    logger.logSecurity('Authentication failed - No user in request', 'medium', {
      ip: req.ip,
      url: req.originalUrl,
      method: req.method,
      requestId: (req as AuthRequest).context?.requestId || 'unknown'
    });
    
    throw new AuthenticationError(
      'User not authenticated',
      'AUTH_2001_NOT_AUTHENTICATED'
    );
  }
  
  logger.logSecurity('Authentication successful', 'low', {
    userId: req.user.id,
    ip: req.ip,
    requestId: (req as AuthRequest).context?.requestId || 'unknown'
  });
  
  next();
};

// Internal service authentication middleware - enhanced according to comprehensive rules
export const requireInternalAuth = (requiredService?: string, requiredPermission?: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const correlationId = req.headers['x-request-id'] as string || 'unknown';
    
    try {
      const payload = extractInternalToken(req);
      
      // Check specific service if required
      if (requiredService && payload.service !== requiredService) {
        logger.logSecurity('Internal service access denied - wrong service', 'high', {
          correlationId,
          requestedService: requiredService,
          actualService: payload.service,
          ip: req.ip,
          url: req.originalUrl
        });
        
        throw new AuthenticationError(
          'Service not authorized',
          'AUTH_2008_SERVICE_NOT_AUTHORIZED'
        );
      }
      
      // Check permission if required
      if (requiredPermission && !verifyServicePermission(payload, requiredPermission)) {
        logger.logSecurity('Internal service access denied - insufficient permissions', 'high', {
          correlationId,
          service: payload.service,
          requiredPermission,
          userPermissions: payload.permissions,
          ip: req.ip,
          url: req.originalUrl
        });
        
        throw new AuthenticationError(
          'Insufficient permissions',
          'AUTH_2009_INSUFFICIENT_PERMISSIONS'
        );
      }
      
      logger.logSecurity('Internal service authentication successful', 'low', {
        correlationId,
        service: payload.service,
        permissions: payload.permissions,
        ip: req.ip
      });
      
      // Add service info to request
      (req as Request & { internalService: typeof payload }).internalService = payload;
      next();
    } catch (error) {
      logger.error('Internal service authentication failed', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        ip: req.ip,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      next(error);
    }
  };
};

/**
 * User Controller Class
 * Tuân thủ SoC/SRP - chỉ xử lý HTTP request/response logic
 * Business logic được delegate hoàn toàn cho service layer
 */
class UserController {
  // Utility function for consistent success responses theo comprehensive rules
  private formatSuccessResponse<T>(
    data: T, 
    message?: string, 
    req?: Request
  ): ApiResponse<T> {
    const authReq = req as AuthRequest;
    const duration = authReq?.context ? Date.now() - authReq.context.startTime : undefined;
    
    return {
      success: true,
      message,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: authReq?.context?.requestId,
        version: authReq?.context?.apiVersion || authConfig.DEFAULT_API_VERSION,
        ...(duration !== undefined && { duration }),
        service: 'user-service',
        environment: process.env.NODE_ENV || 'development'
      }
    };
  }

  // Enhanced logging with structured format
  private logUserEvent(
    event: string,
    req: Request,
    details: Record<string, any> = {},
    severity: 'low' | 'medium' | 'high' = 'low'
  ): void {
    const authReq = req as AuthRequest;
    
    logger.logSecurity(event, severity, {
      event,
      ...details,
      userId: req.user?.id,
      ip: authReq.context?.ip || req.ip,
      userAgent: authReq.context?.userAgent || req.headers['user-agent'],
      requestId: authReq.context?.requestId || 'unknown',
      url: req.originalUrl,
      method: req.method,
      duration: authReq.context ? Date.now() - authReq.context.startTime : undefined,
      timestamp: new Date().toISOString()
    });
  }

  // Performance monitoring
  private checkPerformanceThresholds(req: Request): void {
    const authReq = req as AuthRequest;
    if (!authReq.context) return;
    
    const duration = Date.now() - authReq.context.startTime;
    
    if (duration > authConfig.PERFORMANCE_THRESHOLDS.ERROR) {
      logger.error('Performance threshold exceeded', {
        duration,
        threshold: authConfig.PERFORMANCE_THRESHOLDS.ERROR,
        requestId: authReq.context.requestId,
        url: req.originalUrl,
        method: req.method
      });
    } else if (duration > authConfig.PERFORMANCE_THRESHOLDS.WARNING) {
      logger.warn('Performance threshold warning', {
        duration,
        threshold: authConfig.PERFORMANCE_THRESHOLDS.WARNING,
        requestId: authReq.context.requestId,
        url: req.originalUrl,
        method: req.method
      });
    }
  }

  // Request size limiting middleware
  private requestSizeLimit = (maxSize?: number) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const contentLength = req.headers['content-length'];
      const limit = maxSize || authConfig.DEFAULT_REQUEST_SIZE_LIMIT;
      
      if (contentLength && parseInt(contentLength) > limit) {
        const error = new ValidationError(
          'Request body quá lớn',
          'VALIDATION_4005_REQUEST_TOO_LARGE'
        );
        throw error;
      }
      next();
    };
  };

  // Internal API for API Gateway - get user by ID (tuân thủ SoC)
  public getUserByIdEndpoint = [
    internalApiRateLimit,
    requireInternalAuth('api-gateway', 'user:read'),
    validateUserId,
    this.requestSizeLimit(),
    asyncHandler(this.getUserById.bind(this))
  ];

  async getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const { userId } = req.params;
    
    this.logUserEvent('get_user_by_id_attempt', req, {
      targetUserId: userId,
      service: (req as Request & { internalService?: { service: string } }).internalService?.service
    });

    try {
      const sanitizedUserId = sanitizeUserId(userId || '');
      
      // Delegate to service layer (SoC principle)
      const userData = await userService.getUserById(sanitizedUserId);

      this.checkPerformanceThresholds(req);

      this.logUserEvent('get_user_by_id_success', req, {
        targetUserId: sanitizedUserId,
        duration: Date.now() - startTime
      });

      res.json(this.formatSuccessResponse(
        userData,
        'User data retrieved successfully',
        req
      ));

    } catch (error) {
      this.logUserEvent('get_user_by_id_failed', req, {
        targetUserId: userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      }, 'medium');

      throw error; // Let global error handler deal with it
    }
  }

  // Get current user profile (tuân thủ SoC)
  public getProfileEndpoint = [
    requireAuth,
    this.requestSizeLimit(),
    asyncHandler(this.getProfile.bind(this))
  ];

  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const userId = req.user!.id;
    
    this.logUserEvent('get_profile_attempt', req, {
      userId
    });

    try {
      // Delegate to service layer
      const userProfile = await userService.getUserProfile(userId);

      this.checkPerformanceThresholds(req);

      this.logUserEvent('get_profile_success', req, {
        userId,
        duration: Date.now() - startTime
      });

      res.json(this.formatSuccessResponse(
        userProfile,
        'Profile retrieved successfully',
        req
      ));

    } catch (error) {
      this.logUserEvent('get_profile_failed', req, {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      }, 'medium');

      throw error;
    }
  }

  // Update user profile (tuân thủ SoC)
  public updateProfileEndpoint = [
    profileUpdateRateLimit,
    requireAuth,
    validateUpdateProfile,
    this.requestSizeLimit(),
    asyncHandler(this.updateProfile.bind(this))
  ];

  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const userId = req.user!.id;
    
    this.logUserEvent('update_profile_attempt', req, {
      userId,
      fieldsToUpdate: Object.keys(req.body)
    });

    try {
      // Sanitize input data
      const sanitizedData = sanitizeInput(req.body);
      
      // Delegate to service layer (SoC principle)
      const updatedUser = await userService.updateUserProfile(userId, sanitizedData);

      this.checkPerformanceThresholds(req);

      this.logUserEvent('update_profile_success', req, {
        userId,
        fieldsUpdated: Object.keys(sanitizedData),
        duration: Date.now() - startTime
      });

      res.json(this.formatSuccessResponse(
        updatedUser,
        'Profile updated successfully',
        req
      ));

    } catch (error) {
      this.logUserEvent('update_profile_failed', req, {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      }, 'medium');

      throw error;
    }
  }

  // Get user preferences (tuân thủ SoC)
  public getPreferencesEndpoint = [
    requireAuth,
    this.requestSizeLimit(),
    asyncHandler(this.getPreferences.bind(this))
  ];

  async getPreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const userId = req.user!.id;
    
    this.logUserEvent('get_preferences_attempt', req, {
      userId
    });

    try {
      // Delegate to service layer
      const userPreferences = await userService.getUserPreferences(userId);

      this.checkPerformanceThresholds(req);

      this.logUserEvent('get_preferences_success', req, {
        userId,
        duration: Date.now() - startTime
      });

      res.json(this.formatSuccessResponse(
        userPreferences,
        userPreferences ? 'Preferences retrieved successfully' : 'Default preferences created',
        req
      ));

    } catch (error) {
      this.logUserEvent('get_preferences_failed', req, {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      }, 'medium');

      throw error;
    }
  }

  // Update user preferences (tuân thủ SoC)
  public updatePreferencesEndpoint = [
    profileUpdateRateLimit,
    requireAuth,
    validateUpdatePreferences,
    this.requestSizeLimit(),
    asyncHandler(this.updatePreferences.bind(this))
  ];

  async updatePreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const userId = req.user!.id;
    
    this.logUserEvent('update_preferences_attempt', req, {
      userId,
      fieldsToUpdate: Object.keys(req.body)
    });

    try {
      // Sanitize input data
      const sanitizedData = sanitizeInput(req.body);
      
      // Delegate to service layer (SoC principle)
      const updatedPreferences = await userService.updateUserPreferences(userId, sanitizedData);

      this.checkPerformanceThresholds(req);

      this.logUserEvent('update_preferences_success', req, {
        userId,
        fieldsUpdated: Object.keys(sanitizedData),
        duration: Date.now() - startTime
      });

      res.json(this.formatSuccessResponse(
        updatedPreferences,
        'Preferences updated successfully',
        req
      ));

    } catch (error) {
      this.logUserEvent('update_preferences_failed', req, {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      }, 'medium');

      throw error;
    }
  }

  // Get user statistics (new endpoint for comprehensive monitoring)
  public getUserStatsEndpoint = [
    requireAuth,
    this.requestSizeLimit(),
    asyncHandler(this.getUserStats.bind(this))
  ];

  async getUserStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const userId = req.user!.id;
    
    this.logUserEvent('get_user_stats_attempt', req, {
      userId
    });

    try {
      // Delegate to service layer
      const userStats = await userService.getUserStatistics(userId);

      this.checkPerformanceThresholds(req);

      this.logUserEvent('get_user_stats_success', req, {
        userId,
        duration: Date.now() - startTime
      });

      res.json(this.formatSuccessResponse(
        userStats,
        'User statistics retrieved successfully',
        req
      ));

    } catch (error) {
      this.logUserEvent('get_user_stats_failed', req, {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      }, 'medium');

      throw error;
    }
  }

  // Deactivate user account (enhanced security endpoint)
  public deactivateAccountEndpoint = [
    profileUpdateRateLimit,
    requireAuth,
    this.requestSizeLimit(),
    asyncHandler(this.deactivateAccount.bind(this))
  ];

  async deactivateAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const userId = req.user!.id;
    
    this.logUserEvent('deactivate_account_attempt', req, {
      userId
    }, 'high');

    try {
      // Delegate to service layer
      await userService.deactivateUserAccount(userId);

      this.checkPerformanceThresholds(req);

      this.logUserEvent('deactivate_account_success', req, {
        userId,
        duration: Date.now() - startTime
      }, 'high');

      res.json(this.formatSuccessResponse(
        { deactivated: true },
        'Account deactivated successfully',
        req
      ));

    } catch (error) {
      this.logUserEvent('deactivate_account_failed', req, {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      }, 'high');

      throw error;
    }
  }

  // Health check endpoint với enhanced monitoring
  public healthEndpoint = [
    asyncHandler(this.health.bind(this))
  ];

  async health(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Enhanced health data according to comprehensive rules
      const healthData = {
        status: 'healthy',
        service: 'user-service',
        component: 'user-controller',
        timestamp: new Date().toISOString(),
        version: process.env.APP_VERSION || '1.0.0',
        uptime: process.uptime(),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          percentage: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100)
        },
        environment: process.env.NODE_ENV || 'development',
        requestId: (req as AuthRequest).context?.requestId,
        duration: Date.now() - startTime,
        checks: {
          database: 'pending',
          redis: 'pending',
          user_service: 'healthy',
          auth_middleware: 'healthy'
        }
      };

      logger.info('User controller health check completed', {
        requestId: (req as AuthRequest).context?.requestId,
        duration: healthData.duration,
        status: healthData.status
      });

      res.status(200).json(healthData);

    } catch (error) {
      logger.error('User controller health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: (req as AuthRequest).context?.requestId,
        duration: Date.now() - startTime
      });

      throw error;
    }
  }
}

// Export singleton instance theo comprehensive rules
export default new UserController(); 