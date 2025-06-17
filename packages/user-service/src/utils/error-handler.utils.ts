import { Request, Response } from 'express';
import { ValidationError, AuthenticationError, SystemError } from './errors';
import { appLogger as logger } from './logger';
import { authConfig } from '../config/auth.config';

// Enhanced Request interface for error handling
interface ErrorRequest extends Request {
  context?: {
    requestId: string;
    userId?: string;
    userAgent: string;
    ip: string;
    startTime: number;
    apiVersion: string;
  };
}

// Error response interface
interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  code?: string;
  action?: string;
  meta: {
    timestamp: string;
    requestId?: string;
    version: string;
    duration?: number;
  };
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Error context interface
interface ErrorContext {
  method: string;
  url: string;
  ip: string;
  userAgent: string;
  userId?: string;
  requestId: string;
  apiVersion: string;
  duration?: number;
}

export class ErrorHandler {
  // Format error response consistently
  static formatErrorResponse(
    error: string,
    message: string,
    code?: string,
    action?: string,
    req?: ErrorRequest
  ): ErrorResponse {
    const duration = req?.context ? Date.now() - req.context.startTime : undefined;

    return {
      success: false,
      error,
      message,
      ...(code && { code }),
      ...(action && { action }),
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req?.context?.requestId,
        version: req?.context?.apiVersion || authConfig.DEFAULT_API_VERSION,
        ...(duration !== undefined && { duration })
      }
    };
  }

  // Handle validation errors with security logging
  static handleValidationError(
    error: ValidationError,
    req: ErrorRequest,
    res: Response
  ): Response {
    const context = this.getErrorContext(req);
    
    // Determine severity based on error type
    const severity = this.getValidationErrorSeverity(error);
    
    // Log security event for validation failures
    logger.logSecurity('Validation failed', severity as 'low' | 'medium' | 'high', {
      error: error.message,
      code: error.errorCode,
      validationField: this.extractValidationField(error),
      ...context
    });

    // Log general error
    logger.warn('Validation error occurred', {
      error: error.message,
      code: error.errorCode,
      stack: error.stack,
      ...context
    });

    const response = this.formatErrorResponse(
      'VALIDATION_ERROR',
      error.message,
      error.errorCode,
      this.getValidationAction(error),
      req
    );

    return res.status(400).json(response);
  }

  // Handle authentication errors
  static handleAuthenticationError(
    error: AuthenticationError,
    req: ErrorRequest,
    res: Response
  ): Response {
    const context = this.getErrorContext(req);
    
    // Authentication failures are always medium to high severity
    logger.logSecurity('Authentication failed', 'high', {
      error: error.message,
      code: error.errorCode,
      attemptedAction: req.method + ' ' + req.originalUrl,
      ...context
    });

    logger.warn('Authentication error occurred', {
      error: error.message,
      code: error.errorCode,
      ...context
    });

    const response = this.formatErrorResponse(
      'AUTHENTICATION_ERROR',
      error.message,
      error.errorCode,
      'LOGIN_REQUIRED',
      req
    );

    return res.status(401).json(response);
  }

  // Handle system errors
  static handleSystemError(
    error: SystemError,
    req: ErrorRequest,
    res: Response
  ): Response {
    const context = this.getErrorContext(req);
    
    // System errors are critical
    logger.logSecurity('System error occurred', 'high', {
      error: error.message,
      code: error.errorCode,
      systemContext: error.context,
      ...context
    });

    logger.error('System error occurred', {
      error: error.message,
      code: error.errorCode,
      stack: error.stack,
      context: error.context,
      ...context
    });

    const response = this.formatErrorResponse(
      'SYSTEM_ERROR',
      'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.',
      error.errorCode,
      'RETRY_LATER',
      req
    );

    return res.status(500).json(response);
  }

  // Handle generic errors
  static handleGenericError(
    error: Error,
    req: ErrorRequest,
    res: Response
  ): Response {
    const context = this.getErrorContext(req);
    
    // Unknown errors are high severity
    logger.logSecurity('Unknown error occurred', 'high', {
      error: error.message,
      name: error.name,
      ...context
    });

    logger.error('Generic error occurred', {
      error: error.message,
      name: error.name,
      stack: error.stack,
      ...context
    });

    const response = this.formatErrorResponse(
      'INTERNAL_ERROR',
      'Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.',
      'INTERNAL_5000_GENERIC_ERROR',
      'CONTACT_SUPPORT',
      req
    );

    return res.status(500).json(response);
  }

  // Main error handling dispatcher
  static handleError(
    error: Error,
    req: ErrorRequest,
    res: Response
  ): Response {
    // Add response time header
    this.addResponseTimeHeader(req, res);

    if (error instanceof ValidationError) {
      return this.handleValidationError(error, req, res);
    }

    if (error instanceof AuthenticationError) {
      return this.handleAuthenticationError(error, req, res);
    }

    if (error instanceof SystemError) {
      return this.handleSystemError(error, req, res);
    }

    return this.handleGenericError(error, req, res);
  }

  // Extract error context from request
  private static getErrorContext(req: ErrorRequest): ErrorContext {
    return {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip || req.context?.ip || 'unknown',
      userAgent: req.headers['user-agent'] || req.context?.userAgent || 'unknown',
      userId: req.context?.userId,
      requestId: req.context?.requestId || 'unknown',
      apiVersion: req.context?.apiVersion || authConfig.DEFAULT_API_VERSION,
      duration: req.context ? Date.now() - req.context.startTime : undefined
    };
  }

  // Determine validation error severity
  private static getValidationErrorSeverity(error: ValidationError): ErrorSeverity {
    const securityRelatedCodes = [
      'AUTH_4005_REQUEST_TOO_LARGE',
      'AUTH_4008_UNSUPPORTED_EMAIL_DOMAIN',
      'AUTH_4009_INVALID_NAME_CHARACTERS',
      'AUTH_4007_UNSUPPORTED_API_VERSION'
    ];

    if (securityRelatedCodes.includes(error.errorCode)) {
      return ErrorSeverity.MEDIUM;
    }

    return ErrorSeverity.LOW;
  }

  // Extract validation field from error
  private static extractValidationField(error: ValidationError): string | undefined {
    // Try to extract field name from error code or message
    const codeMatch = error.errorCode.match(/([A-Z_]+)$/);
    if (codeMatch && codeMatch[1]) {
      return codeMatch[1].toLowerCase();
    }

    // Try to extract from message
    const messageMatch = error.message.match(/trường ([a-zA-Z]+)/i);
    if (messageMatch && messageMatch[1]) {
      return messageMatch[1];
    }

    return undefined;
  }

  // Get validation action suggestion
  private static getValidationAction(error: ValidationError): string | undefined {
    if (error.errorCode.includes('EMAIL')) {
      return 'CHECK_EMAIL_FORMAT';
    }

    if (error.errorCode.includes('PASSWORD')) {
      return 'CHECK_PASSWORD_REQUIREMENTS';
    }

    if (error.errorCode.includes('NAME')) {
      return 'CHECK_NAME_FORMAT';
    }

    if (error.errorCode.includes('REQUEST_TOO_LARGE')) {
      return 'REDUCE_REQUEST_SIZE';
    }

    return 'CHECK_INPUT_FORMAT';
  }

  // Add response time header
  private static addResponseTimeHeader(req: ErrorRequest, res: Response): void {
    if (req.context) {
      const responseTime = Date.now() - req.context.startTime;
      res.set('X-Response-Time', `${responseTime}ms`);
    }
  }
}

// Centralized error middleware factory
export const createErrorMiddleware = () => {
  return (error: Error, req: ErrorRequest, res: Response, next: Function) => {
    // Handle the error using our centralized handler
    return ErrorHandler.handleError(error, req, res);
  };
};

// Security-specific error handlers
export class SecurityErrorHandler {
  // Handle rate limiting errors
  static handleRateLimit(req: ErrorRequest, res: Response): Response {
    const context = (ErrorHandler as any).getErrorContext(req);
    
    logger.logSecurity('Rate limit exceeded', 'medium', {
      rateLimitType: 'endpoint',
      ...context
    });

    const response = ErrorHandler.formatErrorResponse(
      'RATE_LIMIT_EXCEEDED',
      'Quá nhiều requests. Vui lòng thử lại sau.',
      'AUTH_4290_RATE_LIMIT_EXCEEDED',
      'WAIT_AND_RETRY',
      req
    );

    return res.status(429).json(response);
  }

  // Handle CORS errors
  static handleCorsError(req: ErrorRequest, res: Response): Response {
    const context = (ErrorHandler as any).getErrorContext(req);
    
    logger.logSecurity('CORS violation detected', 'high', {
      origin: req.headers.origin,
      ...context
    });

    const response = ErrorHandler.formatErrorResponse(
      'CORS_ERROR',
      'CORS policy violation',
      'AUTH_4403_CORS_VIOLATION',
      'CHECK_ORIGIN',
      req
    );

    return res.status(403).json(response);
  }
}

export default {
  ErrorHandler,
  SecurityErrorHandler,
  createErrorMiddleware,
  ErrorSeverity
}; 