import { Request, Response, NextFunction } from 'express';
import { BaseError, ValidationError, AuthenticationError, SystemError, isOperationalError } from '../exceptions';
import { appLogger } from '../utils/logger';
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

// Standard error response interface
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    statusCode: number;
    timestamp: string;
    requestId?: string;
    details?: any;
  };
  success: false;
}

// Enhanced error response interface
interface EnhancedErrorResponse {
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
    service: string;
    environment: string;
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

/**
 * Enhanced Error Handler Class
 * Consolidated from error-handler.utils.ts
 */
export class ErrorHandler {
  // Format enhanced error response consistently
  static formatEnhancedResponse(
    error: string,
    message: string,
    code?: string,
    action?: string,
    req?: ErrorRequest
  ): EnhancedErrorResponse {
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
        ...(duration !== undefined && { duration }),
        service: 'user-service',
        environment: process.env.NODE_ENV || 'development'
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
    appLogger.logSecurity('Validation failed', severity as 'low' | 'medium' | 'high', {
      error: error.message,
      code: error.errorCode,
      validationField: this.extractValidationField(error),
      ...context
    });

    // Log general error
    appLogger.warn('Validation error occurred', {
      error: error.message,
      code: error.errorCode,
      stack: error.stack,
      ...context
    });

    const response = this.formatEnhancedResponse(
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
    appLogger.logSecurity('Authentication failed', 'high', {
      error: error.message,
      code: error.errorCode,
      attemptedAction: req.method + ' ' + req.originalUrl,
      ...context
    });

    appLogger.warn('Authentication error occurred', {
      error: error.message,
      code: error.errorCode,
      ...context
    });

    const response = this.formatEnhancedResponse(
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
    appLogger.logSecurity('System error occurred', 'high', {
      error: error.message,
      code: error.errorCode,
      systemContext: error.context,
      ...context
    });

    appLogger.error('System error occurred', {
      error: error.message,
      code: error.errorCode,
      stack: error.stack,
      context: error.context,
      ...context
    });

    const response = this.formatEnhancedResponse(
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
    appLogger.logSecurity('Unknown error occurred', 'high', {
      error: error.message,
      name: error.name,
      ...context
    });

    appLogger.error('Generic error occurred', {
      error: error.message,
      name: error.name,
      stack: error.stack,
      ...context
    });

    const response = this.formatEnhancedResponse(
      'INTERNAL_ERROR',
      'Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.',
      'INTERNAL_5000_GENERIC_ERROR',
      'CONTACT_SUPPORT',
      req
    );

    return res.status(500).json(response);
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
}

// Security-specific error handlers
export class SecurityErrorHandler {
  // Handle rate limiting errors
  static handleRateLimit(req: ErrorRequest, res: Response): Response {
    const context = ErrorHandler['getErrorContext'](req);
    
    appLogger.logSecurity('Rate limit exceeded', 'medium', {
      rateLimitType: 'endpoint',
      ...context
    });

    const response = ErrorHandler.formatEnhancedResponse(
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
    const context = ErrorHandler['getErrorContext'](req);
    
    appLogger.logSecurity('CORS violation detected', 'high', {
      origin: req.headers.origin,
      ...context
    });

    const response = ErrorHandler.formatEnhancedResponse(
      'CORS_ERROR',
      'CORS policy violation',
      'AUTH_4403_CORS_VIOLATION',
      'CHECK_ORIGIN',
      req
    );

    return res.status(403).json(response);
  }
}

// Global error handler middleware - Enhanced version
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errorReq = req as ErrorRequest;

  // First try to use enhanced error handler for our custom errors
  if (isOperationalError(err)) {
    ErrorHandler.handleError(err, errorReq, res);
    return;
  }

  // Legacy error handling for other types
  const requestId = req.headers['x-request-id'] as string;
  const userId = (req as any).user?.id;

  // Handle Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaError = err as any;
    
    appLogger.error(`Prisma Error: ${prismaError.message}`, {
      requestId,
      userId,
      prismaCode: prismaError.code,
      meta: prismaError.meta,
      method: req.method,
      url: req.originalUrl
    });

    let message = 'Database operation failed';
    let statusCode = 500;
    let errorCode = 'DATABASE_ERROR';

    // Handle specific Prisma error codes
    switch (prismaError.code) {
      case 'P2002':
        message = 'Dữ liệu đã tồn tại';
        statusCode = 409;
        errorCode = 'DUPLICATE_ENTRY';
        break;
      case 'P2025':
        message = 'Không tìm thấy dữ liệu';
        statusCode = 404;
        errorCode = 'NOT_FOUND';
        break;
      case 'P2003':
        message = 'Dữ liệu tham chiếu không hợp lệ';
        statusCode = 400;
        errorCode = 'FOREIGN_KEY_CONSTRAINT';
        break;
    }

    const errorResponse: ErrorResponse = {
      error: {
        code: errorCode,
        message,
        statusCode,
        timestamp: new Date().toISOString(),
        requestId
      },
      success: false
    };

    res.status(statusCode).json(errorResponse);
    return;
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    appLogger.warn(`JWT Error: ${err.message}`, {
      requestId,
      userId,
      jwtError: err.name,
      method: req.method,
      url: req.originalUrl
    });

    const errorResponse: ErrorResponse = {
      error: {
        code: 'INVALID_TOKEN',
        message: 'Token không hợp lệ hoặc đã hết hạn',
        statusCode: 401,
        timestamp: new Date().toISOString(),
        requestId
      },
      success: false
    };

    res.status(401).json(errorResponse);
    return;
  }

  // Handle validation errors from express-validator
  if (err.name === 'ValidationError' || (err as any).array) {
    const validationErrors = (err as any).array ? (err as any).array() : [err];
    
    appLogger.warn(`Validation Error: ${JSON.stringify(validationErrors)}`, {
      requestId,
      userId,
      validationErrors,
      method: req.method,
      url: req.originalUrl
    });

    const errorResponse: ErrorResponse = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dữ liệu đầu vào không hợp lệ',
        statusCode: 400,
        timestamp: new Date().toISOString(),
        requestId,
        details: validationErrors
      },
      success: false
    };

    res.status(400).json(errorResponse);
    return;
  }

  // Handle unexpected errors (programming errors, system errors)
  appLogger.error(`Unexpected Error: ${err.message}`, {
    requestId,
    userId,
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    body: sanitizeRequestBody(req.body),
    headers: sanitizeHeaders(req.headers)
  });

  // Send generic error response (don't expose internal details)
  const errorResponse: ErrorResponse = {
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'development' 
        ? `Internal server error: ${err.message}` 
        : 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau',
      statusCode: 500,
      timestamp: new Date().toISOString(),
      requestId,
      ...(process.env.NODE_ENV === 'development' && {
        details: {
          stack: err.stack,
          message: err.message
        }
      })
    },
    success: false
  };

  res.status(500).json(errorResponse);
};

// 404 handler for undefined routes
export const notFoundHandler = (req: Request, res: Response): void => {
  const requestId = req.headers['x-request-id'] as string;
  
  appLogger.warn(`Route not found: ${req.method} ${req.originalUrl}`, {
    requestId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip
  });

  const errorResponse: ErrorResponse = {
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} không tồn tại`,
      statusCode: 404,
      timestamp: new Date().toISOString(),
      requestId
    },
    success: false
  };

  res.status(404).json(errorResponse);
};

// Async error handler wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Centralized error middleware factory
export const createErrorMiddleware = () => {
  return (error: Error, req: ErrorRequest, res: Response, next: Function) => {
    // Handle the error using our centralized handler
    return ErrorHandler.handleError(error, req, res);
  };
};

// Utility functions
function sanitizeRequestBody(body: any): any {
  if (!body || typeof body !== 'object') return body;
  
  const sensitiveFields = ['password', 'confirmPassword', 'token', 'secret', 'key'];
  const sanitized = { ...body };
  
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

function sanitizeHeaders(headers: any): any {
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
  const sanitized = { ...headers };
  
  sensitiveHeaders.forEach(header => {
    if (sanitized[header]) {
      sanitized[header] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

// Error handler for unhandled promise rejections
export const handleUnhandledRejection = (reason: any, promise: Promise<any>) => {
  appLogger.error('Unhandled Promise Rejection', {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise: promise.toString()
  });
  
  // Gracefully close the server
  process.exit(1);
};

// Error handler for uncaught exceptions
export const handleUncaughtException = (error: Error) => {
  appLogger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack
  });
  
  // Gracefully close the server
  process.exit(1);
};

// Rate limit error handler
export const rateLimitHandler = (req: Request, res: Response): void => {
  const requestId = req.headers['x-request-id'] as string;
  
  appLogger.warn('Rate limit exceeded', {
    requestId,
    ip: req.ip,
    method: req.method,
    url: req.originalUrl,
    userAgent: req.headers['user-agent']
  });

  const errorResponse: ErrorResponse = {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau',
      statusCode: 429,
      timestamp: new Date().toISOString(),
      requestId
    },
    success: false
  };

  res.status(429).json(errorResponse);
}; 