import { Request, Response, NextFunction } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import rateLimit from 'express-rate-limit';
import {
  AuthenticationError,
  ValidationError,
  UserNotFoundError,
  SystemError
} from '../utils/errors';
import { appLogger as logger } from '../utils/logger';
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

const prisma = new PrismaClient();

// Rate limiting configurations
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

// Logger helper functions - match signatures from logger.ts
const logAuth = (event: string, email?: string, userId?: string, success: boolean = true): void => {
  logger.logAuth(event, email, userId, success);
};

const logSecurity = (event: string, severity: 'low' | 'medium' | 'high', details: Record<string, unknown>): void => {
  logger.logSecurity(event, severity, details);
};

// Authentication middleware
export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user?.id) {
    logAuth('Authentication failed - No user in request', undefined, undefined, false);
    
    throw new AuthenticationError(
      'User not authenticated',
      'AUTH_2001_NOT_AUTHENTICATED'
    );
  }
  
  logAuth('Authentication successful', undefined, req.user.id, true);
  
  next();
};

// Internal service authentication middleware
export const requireInternalAuth = (requiredService?: string, requiredPermission?: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const correlationId = req.headers['x-request-id'] as string || 'unknown';
    
    try {
      const payload = extractInternalToken(req);
      
      // Check specific service if required
      if (requiredService && payload.service !== requiredService) {
        logSecurity('Internal service access denied - wrong service', 'high', {
          correlationId,
          requestedService: requiredService,
          actualService: payload.service,
          ip: req.ip
        });
        
        throw new AuthenticationError(
          'Service not authorized',
          'AUTH_2008_SERVICE_NOT_AUTHORIZED'
        );
      }
      
      // Check permission if required
      if (requiredPermission && !verifyServicePermission(payload, requiredPermission)) {
        logSecurity('Internal service access denied - insufficient permissions', 'high', {
          correlationId,
          service: payload.service,
          requiredPermission,
          userPermissions: payload.permissions,
          ip: req.ip
        });
        
        throw new AuthenticationError(
          'Insufficient permissions',
          'AUTH_2009_INSUFFICIENT_PERMISSIONS'
        );
      }
      
      logSecurity('Internal service authentication successful', 'low', {
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
        ip: req.ip
      });
      
      next(error);
    }
  };
};

// Response formatting utilities
interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  meta: {
    timestamp: string;
    requestId?: string;
    [key: string]: unknown;
  };
}

const formatSuccessResponse = <T = unknown>(
  data: T, 
  message?: string, 
  meta?: Record<string, unknown>
): ApiResponse<T> => {
  const correlationId = meta?.correlationId;
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: correlationId as string | undefined,
      ...meta
    }
  };
  
  // Remove undefined values
  if (response.message === undefined) {
    delete response.message;
  }
  
  return response;
};

// Database error mapping
const handleDatabaseError = (error: unknown, operation: string): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        throw new ValidationError(
          'Dữ liệu đã tồn tại',
          'VALIDATION_4007_DUPLICATE_DATA'
        );
      case 'P2025':
        throw new UserNotFoundError('User not found');
      case 'P2003':
        throw new ValidationError(
          'Dữ liệu tham chiếu không hợp lệ',
          'VALIDATION_4008_FOREIGN_KEY_CONSTRAINT'
        );
      default:
        logger.error('Database error', {
          operation,
          errorCode: error.code,
          errorMessage: error.message
        });
        throw new SystemError(
          'Database operation failed',
          'SYSTEM_1005_DATABASE_ERROR'
        );
    }
  }
  
  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    logger.error('Unknown database error', {
      operation,
      errorMessage: error.message
    });
    throw new SystemError(
      'Unknown database error',
      'SYSTEM_1006_UNKNOWN_DATABASE_ERROR'
    );
  }
  
  throw error;
};

class UserController {
  // Internal API for API Gateway - get user by ID
  public getUserByIdEndpoint = [
    internalApiRateLimit,
    requireInternalAuth('api-gateway', 'user:read'),
    validateUserId,
    asyncHandler(this.getUserById.bind(this))
  ];

  async getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const correlationId = req.headers['x-request-id'] as string || 'unknown';
    const { userId } = req.params;
    
    try {
      const sanitizedUserId = sanitizeUserId(userId || '');
      
      logger.info('Fetching user by ID', {
        correlationId,
        userId: sanitizedUserId,
        service: (req as Request & { internalService?: { service: string } }).internalService?.service
      });

      const user = await prisma.user.findUnique({
        where: { id: sanitizedUserId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isVerified: true,
          isActive: true,
          subscriptions: {
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { plan: true }
          }
        }
      });

      if (!user) {
        throw new UserNotFoundError(sanitizedUserId);
      }

      const responseData = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isVerified: user.isVerified,
        isActive: user.isActive,
        currentPlan: user.subscriptions[0]?.plan || 'FREE'
      };

      logger.info('User fetch completed', {
        correlationId,
        userId: sanitizedUserId,
        duration: Date.now() - startTime
      });

      res.json(formatSuccessResponse(
        responseData,
        'User data retrieved successfully',
        { correlationId, duration: Date.now() - startTime }
      ));

    } catch (error: unknown) {
      handleDatabaseError(error, 'getUserById');
    }
  }

  // Get current user profile
  public getProfileEndpoint = [
    requireAuth,
    asyncHandler(this.getProfile.bind(this))
  ];

  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const correlationId = req.headers['x-request-id'] as string || 'unknown';
    const userId = req.user!.id;
    
    try {
      logger.info('Fetching user profile', {
        correlationId,
        userId
      });

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          profile: true,
          subscriptions: {
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      });

      if (!user) {
        throw new UserNotFoundError(userId);
      }

      const responseData = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        phoneNumber: user.phoneNumber,
        language: user.language,
        timezone: user.timezone,
        isVerified: user.isVerified,
        currentPlan: user.subscriptions[0]?.plan || 'FREE',
        profile: user.profile
      };

      logger.info('Profile fetch completed', {
        correlationId,
        userId,
        duration: Date.now() - startTime
      });

      res.json(formatSuccessResponse(
        responseData,
        'Profile retrieved successfully',
        { correlationId, duration: Date.now() - startTime }
      ));

    } catch (error: unknown) {
      handleDatabaseError(error, 'getProfile');
    }
  }

  // Update user profile
  public updateProfileEndpoint = [
    profileUpdateRateLimit,
    requireAuth,
    validateUpdateProfile,
    asyncHandler(this.updateProfile.bind(this))
  ];

  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const correlationId = req.headers['x-request-id'] as string || 'unknown';
    const userId = req.user!.id;
    
    try {
      // Sanitize input data
      const sanitizedData = sanitizeInput(req.body);
      
      logger.info('Updating user profile', {
        correlationId,
        userId,
        fieldsToUpdate: Object.keys(sanitizedData)
      });

      const {
        firstName,
        lastName,
        avatar,
        dateOfBirth,
        gender,
        phoneNumber,
        language,
        timezone
      } = sanitizedData;

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          firstName,
          lastName,
          avatar,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
          gender,
          phoneNumber,
          language,
          timezone,
          updatedAt: new Date()
        }
      });

      const responseData = {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        avatar: updatedUser.avatar,
        dateOfBirth: updatedUser.dateOfBirth,
        gender: updatedUser.gender,
        phoneNumber: updatedUser.phoneNumber,
        language: updatedUser.language,
        timezone: updatedUser.timezone
      };

      logger.info('Profile update completed', {
        correlationId,
        userId,
        duration: Date.now() - startTime
      });

      res.json(formatSuccessResponse(
        responseData,
        'Profile updated successfully',
        { correlationId, duration: Date.now() - startTime }
      ));

    } catch (error: unknown) {
      handleDatabaseError(error, 'updateProfile');
    }
  }

  // Get user preferences
  public getPreferencesEndpoint = [
    requireAuth,
    asyncHandler(this.getPreferences.bind(this))
  ];

  async getPreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const correlationId = req.headers['x-request-id'] as string || 'unknown';
    const userId = req.user!.id;
    
    try {
      logger.info('Fetching user preferences', {
        correlationId,
        userId
      });

      const userProfile = await prisma.userProfile.findUnique({
        where: { userId }
      });

      if (!userProfile) {
        // Create default profile if doesn't exist
        logger.info('Creating default user profile', {
          correlationId,
          userId
        });
        
        const newProfile = await prisma.userProfile.create({
          data: {
            userId,
            currentLevel: 'BEGINNER',
            targetLevel: 'INTERMEDIATE'
          }
        });
        
        logger.info('Default profile created', {
          correlationId,
          userId,
          duration: Date.now() - startTime
        });
        
        res.json(formatSuccessResponse(
          newProfile,
          'Default preferences created',
          { correlationId, duration: Date.now() - startTime }
        ));
        return;
      }

      logger.info('Preferences fetch completed', {
        correlationId,
        userId,
        duration: Date.now() - startTime
      });

      res.json(formatSuccessResponse(
        userProfile,
        'Preferences retrieved successfully',
        { correlationId, duration: Date.now() - startTime }
      ));

    } catch (error: unknown) {
      handleDatabaseError(error, 'getPreferences');
    }
  }

  // Update user preferences
  public updatePreferencesEndpoint = [
    profileUpdateRateLimit,
    requireAuth,
    validateUpdatePreferences,
    asyncHandler(this.updatePreferences.bind(this))
  ];

  async updatePreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const correlationId = req.headers['x-request-id'] as string || 'unknown';
    const userId = req.user!.id;
    
    try {
      // Sanitize input data
      const sanitizedData = sanitizeInput(req.body);
      
      logger.info('Updating user preferences', {
        correlationId,
        userId,
        fieldsToUpdate: Object.keys(sanitizedData)
      });

      const {
        currentLevel,
        targetLevel,
        learningGoals,
        interests,
        preferredTopics,
        studyTimePerDay,
        reminderTime,
        isPublic,
        bio,
        visualLearning,
        auditoryLearning,
        kinestheticLearning,
        weeklyGoalMinutes,
        monthlyGoalMinutes
      } = sanitizedData;

      const updatedProfile = await prisma.userProfile.upsert({
        where: { userId },
        update: {
          currentLevel,
          targetLevel,
          learningGoals,
          interests,
          preferredTopics,
          studyTimePerDay,
          reminderTime,
          isPublic,
          bio,
          visualLearning,
          auditoryLearning,
          kinestheticLearning,
          weeklyGoalMinutes: weeklyGoalMinutes || 150,
          monthlyGoalMinutes: monthlyGoalMinutes || 600,
          updatedAt: new Date()
        },
        create: {
          userId,
          currentLevel: currentLevel || 'BEGINNER',
          targetLevel: targetLevel || 'INTERMEDIATE',
          learningGoals,
          interests,
          preferredTopics,
          studyTimePerDay,
          reminderTime,
          isPublic: isPublic || false,
          bio,
          visualLearning: visualLearning || false,
          auditoryLearning: auditoryLearning || false,
          kinestheticLearning: kinestheticLearning || false,
          weeklyGoalMinutes: weeklyGoalMinutes || 150,
          monthlyGoalMinutes: monthlyGoalMinutes || 600
        }
      });

      logger.info('Preferences update completed', {
        correlationId,
        userId,
        duration: Date.now() - startTime
      });

      res.json(formatSuccessResponse(
        updatedProfile,
        'Preferences updated successfully',
        { correlationId, duration: Date.now() - startTime }
      ));

    } catch (error: unknown) {
      handleDatabaseError(error, 'updatePreferences');
    }
  }
}

// Request interface is already defined in auth middleware

export default new UserController(); 