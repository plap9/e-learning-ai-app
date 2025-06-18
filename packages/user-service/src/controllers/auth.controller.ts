import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { asyncHandler } from '../middlewares/error.middleware';
import { appLogger as logger } from '../utils/logger';
import { authConfig } from '../config/auth.config';
import { ErrorHandler } from '../middlewares/error.middleware';
import { sanitizeInput } from '../utils/security.utils';
import { validateBody } from '../middlewares/validation.middleware';
import {
  RegisterUserSchema,
  LoginUserSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  VerifyEmailSchema,
  ResendVerificationSchema,
  LogoutSchema
} from '../schemas/auth.schemas';
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
} from '../exceptions';

// Type definitions
import { 
  AuthRequest, 
  ApiResponse, 
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
  WEAK_PASSWORD: 'AUTH_4006_WEAK_PASSWORD',
  MISSING_TOKEN: 'AUTH_4007_MISSING_TOKEN'
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
 * Tuân thủ SoC/SRP - chỉ xử lý HTTP request/response logic
 * Business logic được delegate hoàn toàn cho service layer
 */
export class AuthController {
  // Utility function for consistent success responses theo comprehensive rules
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
        ...(duration !== undefined && { duration }),
        service: 'user-service',
        environment: process.env.NODE_ENV || 'development'
      }
    };
  }

  // Enhanced logging với structured format
  private logAuthEvent(
    event: string,
    req: AuthRequest,
    details: Record<string, any> = {},
    severity: 'low' | 'medium' | 'high' = 'low'
  ): void {
    const requestLogger = req.logger || logger;
    
    const logData = {
      event,
      ...details,
      userAgent: req.context?.userAgent,
      ip: req.context?.ip,
      requestId: req.context?.requestId,
      duration: req.context ? Date.now() - req.context.startTime : undefined,
      timestamp: new Date().toISOString()
    };

    requestLogger.logSecurity(event, severity, logData);
  }

  // Enhanced security logging
  private logSecurityEvent(
    event: string,
    req: AuthRequest,
    severity: 'low' | 'medium' | 'high',
    details: Record<string, any> = {}
  ): void {
    logger.logSecurity(event, severity, {
      ...details,
      ip: req.context?.ip || 'unknown',
      userAgent: req.context?.userAgent || 'unknown',
      requestId: req.context?.requestId || 'unknown',
      url: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString()
    });
  }

  // Performance monitoring
  private checkPerformanceThresholds(req: AuthRequest): void {
    if (!req.context) return;
    
    const duration = Date.now() - req.context.startTime;
    
    if (duration > CONFIG.PERFORMANCE_THRESHOLDS.ERROR) {
      logger.error('Performance threshold exceeded', {
        duration,
        threshold: CONFIG.PERFORMANCE_THRESHOLDS.ERROR,
        requestId: req.context.requestId,
        url: req.originalUrl
      });
    } else if (duration > CONFIG.PERFORMANCE_THRESHOLDS.WARNING) {
      logger.warn('Performance threshold warning', {
        duration,
        threshold: CONFIG.PERFORMANCE_THRESHOLDS.WARNING,
        requestId: req.context.requestId,
        url: req.originalUrl
      });
    }
  }

  // Email masking utility for security
  private maskEmail(email: string): string {
    return email.replace(CONFIG.EMAIL_MASK_REGEX, '*');
  }

  // Registration endpoint - tuân thủ SoC: chỉ handle HTTP, delegate business logic
  register = [
    requestSizeLimit(),
    registrationRateLimit,
    validateBody(RegisterUserSchema.shape.body),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const startTime = Date.now();
      const { email, password, confirmPassword, firstName, lastName } = req.body;
      const requestLogger = req.logger || logger;

      // Enhanced security logging
      this.logAuthEvent('user_registration_attempt', req, {
        email: this.maskEmail(email),
        hasPassword: !!password,
        hasConfirmPassword: !!confirmPassword,
        firstName: firstName ? firstName.substring(0, 2) + '***' : undefined,
        lastName: lastName ? lastName.substring(0, 2) + '***' : undefined
      });

      try {
        // Sanitize input data
        const sanitizedData = sanitizeInput({
          email,
          password,
          confirmPassword,
          firstName,
          lastName
        });

        // Delegate to service layer (SoC principle)
        const result = await authService.registerUser(sanitizedData);

        // Performance monitoring
        this.checkPerformanceThresholds(req);

        const duration = Date.now() - startTime;
        
        // Enhanced success logging
        this.logAuthEvent('user_registration_success', req, {
          userId: result.userId,
          email: this.maskEmail(email),
          duration
        }, 'low');

        // Log security event
        this.logSecurityEvent('User registration completed', req, 'low', {
          userId: result.userId,
          email: this.maskEmail(email)
        });

        return res.status(201).json(
          this.formatSuccessResponse(
            { userId: result.userId },
            result.message,
            req
          )
        );
      } catch (error) {
        // Enhanced error logging
        this.logAuthEvent('user_registration_failed', req, {
          email: this.maskEmail(email),
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - startTime
        }, 'medium');

        throw error; // Let global error handler deal with it
      }
    })
  ];

  // Login endpoint - tuân thủ SoC
  login = [
    requestSizeLimit(),
    authRateLimit,
    validateBody(LoginUserSchema.shape.body),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const startTime = Date.now();
      const { email, password } = req.body;
      const requestLogger = req.logger || logger;

      this.logAuthEvent('user_login_attempt', req, {
        email: this.maskEmail(email),
        hasPassword: !!password
      });

      try {
        // Sanitize input
        const sanitizedData = sanitizeInput({ email, password });

        // Delegate to service layer
        const result = await authService.loginUser(sanitizedData.email, sanitizedData.password);

        // Performance monitoring
        this.checkPerformanceThresholds(req);

        const duration = Date.now() - startTime;
        
        this.logAuthEvent('user_login_success', req, {
          userId: result.user.id,
          email: this.maskEmail(email),
          plan: result.user.plan,
          duration
        }, 'low');

        // Security event
        this.logSecurityEvent('User login completed', req, 'low', {
          userId: result.user.id,
          email: this.maskEmail(email)
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
      } catch (error) {
        this.logAuthEvent('user_login_failed', req, {
          email: this.maskEmail(email),
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - startTime
        }, 'high');

        throw error;
      }
    })
  ];

  // Forgot password endpoint
  forgotPassword = [
    requestSizeLimit(),
    passwordResetRateLimit,
    validateBody(ForgotPasswordSchema.shape.body),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const startTime = Date.now();
      const { email } = req.body;

      this.logAuthEvent('forgot_password_request', req, {
        email: this.maskEmail(email)
      });

      try {
        const sanitizedEmail = sanitizeInput({ email }).email;
        const result = await authService.forgotPassword(sanitizedEmail);

        this.checkPerformanceThresholds(req);
        
        this.logAuthEvent('forgot_password_success', req, {
          email: this.maskEmail(email),
          duration: Date.now() - startTime
        });

        return res.status(200).json(
          this.formatSuccessResponse(
            {},
            result.message,
            req
          )
        );
      } catch (error) {
        this.logAuthEvent('forgot_password_failed', req, {
          email: this.maskEmail(email),
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - startTime
        }, 'medium');

        throw error;
      }
    })
  ];

  // Reset password endpoint
  resetPassword = [
    requestSizeLimit(),
    passwordResetRateLimit,
    validateBody(ResetPasswordSchema.shape.body),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const startTime = Date.now();
      const { token, newPassword, confirmNewPassword } = req.body;

      this.logAuthEvent('password_reset_attempt', req, {
        hasToken: !!token,
        hasNewPassword: !!newPassword,
        hasConfirmPassword: !!confirmNewPassword
      });

      try {
        const sanitizedData = sanitizeInput({ token, newPassword, confirmNewPassword });
        const result = await authService.resetPassword(
          sanitizedData.token,
          sanitizedData.newPassword,
          sanitizedData.confirmNewPassword
        );

        this.checkPerformanceThresholds(req);
        
        this.logAuthEvent('password_reset_success', req, {
          duration: Date.now() - startTime
        });

        return res.status(200).json(
          this.formatSuccessResponse(
            {},
            result.message,
            req
          )
        );
      } catch (error) {
        this.logAuthEvent('password_reset_failed', req, {
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - startTime
        }, 'high');

        throw error;
      }
    })
  ];

  // Verify email endpoint
  verifyEmail = [
    requestSizeLimit(),
    emailVerificationRateLimit,
    validateBody(VerifyEmailSchema.shape.body),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const startTime = Date.now();
      const { token } = req.body;

      this.logAuthEvent('email_verification_attempt', req, {
        hasToken: !!token
      });

      try {
        const sanitizedToken = sanitizeInput({ token }).token;
        const result = await authService.verifyEmail(sanitizedToken);

        this.checkPerformanceThresholds(req);
        
        this.logAuthEvent('email_verification_success', req, {
          userId: result.userId,
          duration: Date.now() - startTime
        });

        return res.status(200).json(
          this.formatSuccessResponse(
            { userId: result.userId },
            result.message,
            req
          )
        );
      } catch (error) {
        this.logAuthEvent('email_verification_failed', req, {
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - startTime
        }, 'medium');

        throw error;
      }
    })
  ];

  // Resend verification email endpoint
  resendVerificationEmail = [
    requestSizeLimit(),
    emailVerificationRateLimit,
    validateBody(ResendVerificationSchema.shape.body),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const startTime = Date.now();
      const { email } = req.body;

      this.logAuthEvent('resend_verification_request', req, {
        email: this.maskEmail(email)
      });

      try {
        const sanitizedEmail = sanitizeInput({ email }).email;
        const result = await authService.resendVerificationEmail(sanitizedEmail);

        this.checkPerformanceThresholds(req);
        
        this.logAuthEvent('resend_verification_success', req, {
          email: this.maskEmail(email),
          duration: Date.now() - startTime
        });

        return res.status(200).json(
          this.formatSuccessResponse(
            {},
            result.message,
            req
          )
        );
      } catch (error) {
        this.logAuthEvent('resend_verification_failed', req, {
          email: this.maskEmail(email),
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - startTime
        }, 'medium');

        throw error;
      }
    })
  ];

  // Logout endpoint
  logout = [
    requestSizeLimit(),
    validateBody(LogoutSchema.shape.body),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const startTime = Date.now();
      const { refreshToken } = req.body;

      this.logAuthEvent('user_logout_request', req, {
        hasRefreshToken: !!refreshToken,
        userId: req.user?.id
      });

      try {
        const sanitizedToken = refreshToken ? sanitizeInput({ refreshToken }).refreshToken : undefined;
        const result = await authService.logout(sanitizedToken);

        this.checkPerformanceThresholds(req);
        
        this.logAuthEvent('user_logout_success', req, {
          userId: req.user?.id,
          duration: Date.now() - startTime
        });

        return res.status(200).json(
          this.formatSuccessResponse(
            {},
            result.message,
            req
          )
        );
      } catch (error) {
        this.logAuthEvent('user_logout_failed', req, {
          userId: req.user?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - startTime
        }, 'medium');

        throw error;
      }
    })
  ];

  // Health check endpoint with enhanced monitoring
  health = [
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const startTime = Date.now();
      
      try {
        // Enhanced health data according to comprehensive rules
        const healthData = {
          status: 'healthy',
          service: 'user-service',
          component: 'auth-controller',
          timestamp: new Date().toISOString(),
          version: process.env.APP_VERSION || '1.0.0',
          uptime: process.uptime(),
          memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
            percentage: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100)
          },
          environment: process.env.NODE_ENV || 'development',
          requestId: req.context?.requestId,
          duration: Date.now() - startTime,
          checks: {
            database: 'pending',
            redis: 'pending',
            auth_service: 'healthy'
          }
        };

        logger.info('Health check completed', {
          requestId: req.context?.requestId,
          duration: healthData.duration,
          status: healthData.status
        });

        return res.status(200).json(healthData);
      } catch (error) {
        logger.error('Health check failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          requestId: req.context?.requestId,
          duration: Date.now() - startTime
        });

        throw error;
      }
    })
  ];

  // Get authentication status endpoint  
  status = [
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const startTime = Date.now();

      try {
        const statusData = {
          authenticated: !!req.user,
          user: req.user ? {
            id: req.user.id,
            email: this.maskEmail(req.user.email),
            plan: req.user.plan,
            isVerified: req.user.isVerified
          } : null,
          session: {
            requestId: req.context?.requestId,
            apiVersion: req.context?.apiVersion,
            timestamp: new Date().toISOString()
          }
        };

        this.checkPerformanceThresholds(req);

        return res.status(200).json(
          this.formatSuccessResponse(
            statusData,
            'Authentication status retrieved',
            req
          )
        );
      } catch (error) {
        logger.error('Auth status check failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          requestId: req.context?.requestId,
          duration: Date.now() - startTime
        });

        throw error;
      }
    })
  ];
}

// Export singleton instance
export const authController = new AuthController(); 