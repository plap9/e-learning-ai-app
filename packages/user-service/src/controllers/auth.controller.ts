import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { asyncHandler } from '../middlewares/error.middleware';
import { appLogger as logger } from '../utils/logger';
import { authConfig } from '../config/auth.config';
import { ErrorHandler } from '../utils/error-handler.utils';
import { healthCache as healthCacheUtil } from '../utils/cache.utils';
import { 
  validateRegistration,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateVerifyEmail,
  validateResendVerification
} from '../validators/auth.validators';
import {
  authRateLimit,
  registrationRateLimit,
  passwordResetRateLimit,
  emailVerificationRateLimit
} from '../middlewares/rate-limit.middleware';
import {
  InvalidCredentialsError,
  EmailNotVerifiedError,
  UserNotFoundError,
  InvalidTokenError,
  PasswordsDoNotMatchError,
  ValidationError,
  SystemError
} from '../utils/errors';

// Type definitions
interface Logger {
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
  logAuth: (event: string, email?: string, userId?: string, success?: boolean) => void;
  logSecurity: (event: string, severity: 'low' | 'medium' | 'high', details: Record<string, unknown>) => void;
}

interface UserPayload {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isVerified: boolean;
  plan: string;
}

interface RequestContext {
  requestId: string;
  userId?: string;
  userAgent: string;
  ip: string;
  startTime: number;
  apiVersion: string;
}

interface AuthRequest extends Request {
  logger?: Logger;
  user?: UserPayload;
  context?: RequestContext;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  meta: {
    timestamp: string;
    requestId?: string;
    version: string;
    duration?: number;
    [key: string]: unknown;
  };
}

interface HealthMetrics {
  status: string;
  timestamp: string;
  uptime: number;
  memory: NodeJS.MemoryUsage;
  cpu: NodeJS.CpuUsage;
  nodeVersion: string;
  environment: string;
  version: string;
}

// Configuration constants (using centralized config)
const CONFIG = authConfig;

// Error codes standardization
const AUTH_ERROR_CODES = {
  INVALID_TOKEN: 'AUTH_4001_INVALID_TOKEN',
  TOKEN_EXPIRED: 'AUTH_4002_TOKEN_EXPIRED',
  INVALID_CREDENTIALS: 'AUTH_4003_INVALID_CREDENTIALS',
  EMAIL_NOT_VERIFIED: 'AUTH_4004_EMAIL_NOT_VERIFIED',
  REQUEST_TOO_LARGE: 'AUTH_4005_REQUEST_TOO_LARGE',
  WEAK_PASSWORD: 'AUTH_4006_WEAK_PASSWORD'
} as const;

// Health endpoint now uses enhanced cache utility from cache.utils

// Metrics collection utility
class MetricsCollector {
  private static recordMetric(operation: string, duration: number, success: boolean): void {
    logger.info('Metrics recorded', {
      operation: `auth.${operation}`,
      duration,
      success,
      performanceLevel: duration > CONFIG.PERFORMANCE_THRESHOLDS.ERROR ? 'error' : 
                       duration > CONFIG.PERFORMANCE_THRESHOLDS.WARNING ? 'warning' : 'good'
    });
    
    // In production, send to monitoring service (Prometheus, etc.)
    // metrics.increment(`auth.${operation}.count`);
    // metrics.histogram(`auth.${operation}.duration`, duration);
    // if (!success) metrics.increment(`auth.${operation}.errors`);
  }

  static trackOperation<T>(
    operation: string, 
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    return fn()
      .then(result => {
        this.recordMetric(operation, Date.now() - startTime, true);
        return result;
      })
      .catch(error => {
        this.recordMetric(operation, Date.now() - startTime, false);
        throw error;
      });
  }
}

// Request size limiting middleware
const requestSizeLimit = (maxSize: number = CONFIG.DEFAULT_REQUEST_SIZE_LIMIT) => {
  return (req: AuthRequest, res: Response, next: NextFunction): Response | void => {
    const contentLength = req.headers['content-length'];
    if (contentLength && parseInt(contentLength) > maxSize) {
      const error = new ValidationError(
        'Request body quá lớn',
        AUTH_ERROR_CODES.REQUEST_TOO_LARGE
      );
      return ErrorHandler.handleValidationError(error, req, res);
    }
    next();
  };
};

// Note: requestContextMiddleware is now handled in security middleware stack

class AuthController {
  // Utility function for consistent success responses
  private formatSuccessResponse<T>(
    data: T, 
    message?: string, 
    req?: AuthRequest
  ): ApiResponse<T> {
    const duration = req?.context ? Date.now() - req.context.startTime : undefined;
    
    return {
      success: true,
      message,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req?.context?.requestId,
        version: req?.context?.apiVersion || CONFIG.DEFAULT_API_VERSION,
        ...(duration !== undefined && { duration })
      }
    };
  }

  // Utility function for consistent error responses  
  private formatErrorResponse(
    error: string, 
    message: string, 
    action?: string, 
    req?: AuthRequest
  ): Omit<ApiResponse, 'data'> & { error: string; action?: string } {
    const duration = req?.context ? Date.now() - req.context.startTime : undefined;
    
    return {
      success: false,
      error,
      message,
      ...(action && { action }),
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req?.context?.requestId,
        version: req?.context?.apiVersion || CONFIG.DEFAULT_API_VERSION,
        ...(duration !== undefined && { duration })
      }
    };
  }

  // Email masking utility
  private maskEmail(email: string): string {
    return email.replace(CONFIG.EMAIL_MASK_REGEX, '*');
  }

  // Registration endpoint with validation and rate limiting
  register = [
    requestSizeLimit(),
    registrationRateLimit,
    validateRegistration,
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const { email, password, confirmPassword, firstName, lastName } = req.body;
      const requestLogger = req.logger || logger;

      requestLogger.info('User registration attempt', {
        email: this.maskEmail(email),
        userAgent: req.context?.userAgent,
        ip: req.context?.ip,
        requestId: req.context?.requestId
      });

      const result = await MetricsCollector.trackOperation('register', async () => {
        return await authService.registerUser({
          email,
          password,
          confirmPassword,
          firstName,
          lastName
        });
      });

      const duration = req.context ? Date.now() - req.context.startTime : 0;
      requestLogger.info('User registration successful', {
        userId: result.userId,
        email: this.maskEmail(email),
        duration,
        requestId: req.context?.requestId
      });

      // Log security event
      logger.logSecurity('User registration completed', 'low', {
        userId: result.userId,
        email: this.maskEmail(email),
        ip: req.context?.ip || 'unknown',
        requestId: req.context?.requestId
      });

      return res.status(201).json(
        this.formatSuccessResponse(result, 'Đăng ký thành công', req)
      );
    })
  ];

  // Login endpoint with validation and rate limiting
  login = [
    requestSizeLimit(),
    authRateLimit,
    validateLogin,
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const { email, password, rememberMe } = req.body;
      const requestLogger = req.logger || logger;

      requestLogger.info('User login attempt', {
        email: this.maskEmail(email),
        userAgent: req.context?.userAgent,
        ip: req.context?.ip,
        rememberMe,
        requestId: req.context?.requestId
      });

      const result = await MetricsCollector.trackOperation('login', async () => {
        return await authService.loginUser(email, password);
      });

      const duration = req.context ? Date.now() - req.context.startTime : 0;
      requestLogger.info('User login successful', {
        userId: result.user.id,
        email: this.maskEmail(email),
        duration,
        requestId: req.context?.requestId
      });

      // Log security event
      logger.logSecurity('User login successful', 'low', {
        userId: result.user.id,
        email: this.maskEmail(email),
        ip: req.context?.ip || 'unknown',
        requestId: req.context?.requestId
      });

      return res.status(200).json(
        this.formatSuccessResponse(result, 'Đăng nhập thành công', req)
      );
    })
  ];

  // Forgot password endpoint with validation and rate limiting
  forgotPassword = [
    requestSizeLimit(),
    passwordResetRateLimit,
    validateForgotPassword,
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const { email } = req.body;
      const requestLogger = req.logger || logger;

      requestLogger.info('Forgot password request', {
        email: this.maskEmail(email),
        ip: req.context?.ip,
        requestId: req.context?.requestId
      });

      const result = await MetricsCollector.trackOperation('forgotPassword', async () => {
        return await authService.forgotPassword(email);
      });

      const duration = req.context ? Date.now() - req.context.startTime : 0;
      requestLogger.info('Forgot password email sent', {
        email: this.maskEmail(email),
        duration,
        requestId: req.context?.requestId
      });

      // Log security event
      logger.logSecurity('Password reset requested', 'medium', {
        email: this.maskEmail(email),
        ip: req.context?.ip || 'unknown',
        requestId: req.context?.requestId
      });

      return res.status(200).json(
        this.formatSuccessResponse(result, result.message, req)
      );
    })
  ];

  // Reset password endpoint with validation and rate limiting
  resetPassword = [
    requestSizeLimit(),
    passwordResetRateLimit,
    validateResetPassword,
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const { token, newPassword, confirmNewPassword } = req.body;
      const requestLogger = req.logger || logger;

      requestLogger.info('Password reset attempt', {
        tokenExists: !!token,
        ip: req.context?.ip,
        requestId: req.context?.requestId
      });

      const result = await MetricsCollector.trackOperation('resetPassword', async () => {
        return await authService.resetPassword(token, newPassword, confirmNewPassword);
      });

      const duration = req.context ? Date.now() - req.context.startTime : 0;
      requestLogger.info('Password reset successful', {
        duration,
        requestId: req.context?.requestId
      });

      // Log security event
      logger.logSecurity('Password reset completed', 'medium', {
        ip: req.context?.ip || 'unknown',
        requestId: req.context?.requestId
      });

      return res.status(200).json(
        this.formatSuccessResponse(result, result.message, req)
      );
    })
  ];

  // Email verification endpoint with validation and rate limiting
  verifyEmail = [
    emailVerificationRateLimit,
    validateVerifyEmail,
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const { token } = req.query;
      const requestLogger = req.logger || logger;

      // Note: Token validation is now handled by validateVerifyEmail validator

      requestLogger.info('Email verification attempt', {
        tokenExists: !!token,
        ip: req.context?.ip,
        requestId: req.context?.requestId
      });

      const result = await MetricsCollector.trackOperation('verifyEmail', async () => {
        return await authService.verifyEmail(token as string);
      });

      const duration = req.context ? Date.now() - req.context.startTime : 0;
      requestLogger.info('Email verification successful', {
        duration,
        requestId: req.context?.requestId
      });

      // Log security event
      logger.logSecurity('Email verification completed', 'low', {
        ip: req.context?.ip || 'unknown',
        requestId: req.context?.requestId
      });

      return res.status(200).json(
        this.formatSuccessResponse(result, result.message, req)
      );
    })
  ];

  // Resend verification email endpoint with validation and rate limiting
  resendVerificationEmail = [
    requestSizeLimit(),
    emailVerificationRateLimit,
    validateResendVerification,
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const { email } = req.body;
      const requestLogger = req.logger || logger;

      requestLogger.info('Resend verification email request', {
        email: this.maskEmail(email),
        ip: req.context?.ip,
        requestId: req.context?.requestId
      });

      const result = await MetricsCollector.trackOperation('resendVerification', async () => {
        return await authService.resendVerificationEmail(email);
      });

      const duration = req.context ? Date.now() - req.context.startTime : 0;
      requestLogger.info('Verification email resent', {
        email: this.maskEmail(email),
        duration,
        requestId: req.context?.requestId
      });

      return res.status(200).json(
        this.formatSuccessResponse(result, 'Email xác thực đã được gửi lại', req)
      );
    })
  ];

  // Logout endpoint with validation
  logout = [
    requestSizeLimit(),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const { refreshToken } = req.body;
      const requestLogger = req.logger || logger;
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        throw new InvalidCredentialsError('Không có token xác thực');
      }

      requestLogger.info('User logout attempt', {
        hasRefreshToken: !!refreshToken,
        ip: req.context?.ip,
        requestId: req.context?.requestId
      });

      // If refresh token is provided, invalidate it
      if (refreshToken) {
        await MetricsCollector.trackOperation('logout', async () => {
          await authService.logout(refreshToken);
        });
      }

      const duration = req.context ? Date.now() - req.context.startTime : 0;
      requestLogger.info('User logout successful', {
        duration,
        requestId: req.context?.requestId
      });

      // Log security event
      logger.logSecurity('User logout completed', 'low', {
        ip: req.context?.ip || 'unknown',
        requestId: req.context?.requestId
      });

      return res.status(200).json(
        this.formatSuccessResponse({}, 'Đăng xuất thành công', req)
      );
    })
  ];

  // Health check endpoint with enhanced caching
  health = [
    asyncHandler(async (req: AuthRequest, res: Response) => {
      // Check enhanced cache first
      const cachedData = healthCacheUtil.get('default');
      if (cachedData) {
        return res.status(200).json(
          this.formatSuccessResponse(cachedData, 'Auth service is healthy (cached)', req)
        );
      }

      // Generate fresh health data
      const healthData: HealthMetrics = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0'
      };

      // Cache the result using enhanced cache
      healthCacheUtil.set(healthData, 'default');

      return res.status(200).json(
        this.formatSuccessResponse(healthData, 'Auth service is healthy', req)
      );
    })
  ];
}

export const authController = new AuthController(); 