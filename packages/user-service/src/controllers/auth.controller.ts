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
  validateResetPassword
} from '../middlewares/validation.middleware';
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
import { 
  AuthRequest, 
  ApiResponse, 
  HealthMetrics, 
  Logger, 
  UserPayload, 
  RequestContext 
} from '../types/express';

// Configuration constants
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

/**
 * Authentication Controller
 * Handles only HTTP request/response logic
 * Follows Single Responsibility Principle
 */
export class AuthController {
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

      const result = await authService.registerUser({
        email,
        password,
        confirmPassword,
        firstName,
        lastName
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
        this.formatSuccessResponse(
          { userId: result.userId },
          result.message,
          req
        )
      );
    })
  ];

  // Login endpoint with validation and rate limiting
  login = [
    requestSizeLimit(),
    authRateLimit,
    validateLogin,
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const { email, password } = req.body;
      const requestLogger = req.logger || logger;

      requestLogger.info('User login attempt', {
        email: this.maskEmail(email),
        userAgent: req.context?.userAgent,
        ip: req.context?.ip,
        requestId: req.context?.requestId
      });

      const result = await authService.loginUser(email, password);

      const duration = req.context ? Date.now() - req.context.startTime : 0;
      requestLogger.info('User login successful', {
        userId: result.user.id,
        email: this.maskEmail(email),
        plan: result.user.plan,
        duration,
        requestId: req.context?.requestId
      });

      // Log security event
      logger.logSecurity('User login completed', 'low', {
        userId: result.user.id,
        email: this.maskEmail(email),
        ip: req.context?.ip || 'unknown',
        requestId: req.context?.requestId
      });

      return res.status(200).json(
        this.formatSuccessResponse(
          {
            user: result.user,
            tokens: result.tokens
          },
          result.message,
          req
        )
      );
    })
  ];

  // Forgot password endpoint
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

      const result = await authService.forgotPassword(email);

      return res.status(200).json(
        this.formatSuccessResponse(
          {},
          result.message,
          req
        )
      );
    })
  ];

  // Reset password endpoint
  resetPassword = [
    requestSizeLimit(),
    passwordResetRateLimit,
    validateResetPassword,
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const { token, newPassword, confirmNewPassword } = req.body;
      const requestLogger = req.logger || logger;

      requestLogger.info('Password reset attempt', {
        hasToken: !!token,
        requestId: req.context?.requestId
      });

      const result = await authService.resetPassword(token, newPassword, confirmNewPassword);

      requestLogger.info('Password reset successful', {
        requestId: req.context?.requestId
      });

      return res.status(200).json(
        this.formatSuccessResponse(
          {},
          result.message,
          req
        )
      );
    })
  ];

  // Verify email endpoint
  verifyEmail = [
    requestSizeLimit(),
    emailVerificationRateLimit,
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const { token } = req.body;
      const requestLogger = req.logger || logger;

      if (!token) {
        throw new ValidationError(
          'Token xác thực là bắt buộc',
          'VALIDATION_4007_MISSING_TOKEN'
        );
      }

      requestLogger.info('Email verification attempt', {
        hasToken: !!token,
        requestId: req.context?.requestId
      });

      const result = await authService.verifyEmail(token);

      requestLogger.info('Email verification successful', {
        userId: result.userId,
        requestId: req.context?.requestId
      });

      return res.status(200).json(
        this.formatSuccessResponse(
          { userId: result.userId },
          result.message,
          req
        )
      );
    })
  ];

  // Resend verification email endpoint
  resendVerificationEmail = [
    requestSizeLimit(),
    emailVerificationRateLimit,
    validateForgotPassword, // Reuse same validation (just email)
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const { email } = req.body;
      const requestLogger = req.logger || logger;

      requestLogger.info('Resend verification email request', {
        email: this.maskEmail(email),
        ip: req.context?.ip,
        requestId: req.context?.requestId
      });

      const result = await authService.resendVerificationEmail(email);

      return res.status(200).json(
        this.formatSuccessResponse(
          {},
          result.message,
          req
        )
      );
    })
  ];

  // Logout endpoint
  logout = [
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const { refreshToken } = req.body;
      const requestLogger = req.logger || logger;

      requestLogger.info('User logout request', {
        hasRefreshToken: !!refreshToken,
        requestId: req.context?.requestId
      });

      const result = await authService.logout(refreshToken);

      requestLogger.info('User logout successful', {
        requestId: req.context?.requestId
      });

      return res.status(200).json(
        this.formatSuccessResponse(
          {},
          result.message,
          req
        )
      );
    })
  ];

  // Health check endpoint
  health = [
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const healthData = {
        status: 'healthy',
        service: 'auth-service',
        timestamp: new Date().toISOString(),
        version: process.env.APP_VERSION || '1.0.0',
        uptime: process.uptime(),
        memory: process.memoryUsage()
      };

      return res.status(200).json(healthData);
    })
  ];
}

// Export singleton instance
export const authController = new AuthController(); 