import { Request, Response, NextFunction } from 'express';
import { BaseError } from '../exceptions/base.error';
import { appLogger } from './logger';

/**
 * Error handler utility functions
 * Implements centralized error handling following SoC principles
 */

/**
 * Helper function to safely get request ID from headers
 */
const getRequestId = (req: Request): string | undefined => {
  const requestId = req.headers['x-request-id'];
  return Array.isArray(requestId) ? requestId[0] : requestId;
};

/**
 * Async wrapper to catch and forward errors to error handler
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Create error middleware for specific routes
 */
export const createErrorMiddleware = () => {
  return (error: Error, req: Request, res: Response, next: NextFunction): void => {
    const requestId = getRequestId(req);
    
    // Log error với request context
    appLogger.error('Route error occurred', {
      error: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId
    });

    // Handle known errors
    if (error instanceof BaseError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.errorCode,
          message: error.message,
          ...(process.env.NODE_ENV === 'development' && { 
            context: error.context,
            stack: error.stack 
          })
        },
        requestId
      });
      return;
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message
        },
        requestId
      });
      return;
    }

    // Handle JWT errors
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Invalid or expired token'
        },
        requestId
      });
      return;
    }

    // Handle unknown errors
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred'
      },
      requestId
    });
  };
};

/**
 * Global error handler middleware (should be last middleware)
 */
export const globalErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = getRequestId(req);
  
  // Log error với full context
  appLogger.error('Global error handler triggered', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.body,
    params: req.params,
    query: req.query,
    requestId
  });

  // Handle operational errors
  if (error instanceof BaseError && error.isOperational) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.errorCode,
        message: error.message,
        ...(process.env.NODE_ENV === 'development' && { 
          context: error.context 
        })
      },
      requestId
    });
    return;
  }

  // Handle programming errors (don't expose details in production)
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: isDevelopment ? error.message : 'An unexpected error occurred',
      ...(isDevelopment && { 
        stack: error.stack,
        type: error.name 
      })
    },
    requestId
  });
};

/**
 * Handle unhandled promise rejections
 */
export const handleUnhandledRejection = (reason: any, promise: Promise<any>): void => {
  appLogger.error('Unhandled Promise Rejection', {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise: promise.toString()
  });

  // Graceful shutdown
  process.exit(1);
};

/**
 * Handle uncaught exceptions
 */
export const handleUncaughtException = (error: Error): void => {
  appLogger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack
  });

  // Graceful shutdown
  process.exit(1);
};

/**
 * Setup global error handlers
 */
export const setupGlobalErrorHandlers = (): void => {
  process.on('unhandledRejection', handleUnhandledRejection);
  process.on('uncaughtException', handleUncaughtException);
};

/**
 * Create standardized error response
 */
export const createErrorResponse = (
  error: BaseError | Error,
  requestId?: string
) => {
  if (error instanceof BaseError) {
    return {
      success: false,
      error: {
        code: error.errorCode,
        message: error.message,
        ...(process.env.NODE_ENV === 'development' && { 
          context: error.context 
        })
      },
      requestId
    };
  }

  return {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'development' 
        ? error.message 
        : 'An unexpected error occurred'
    },
    requestId
  };
}; 