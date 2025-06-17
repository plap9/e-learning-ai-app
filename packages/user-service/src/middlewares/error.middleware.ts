import { Request, Response, NextFunction } from 'express';
import { BaseError, isOperationalError } from '../utils/errors';
import { appLogger } from '../utils/logger';

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

// Global error handler middleware
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = req.headers['x-request-id'] as string;
  const userId = (req as any).user?.id;

  // Handle operational errors (known errors)
  if (isOperationalError(err)) {
    const operationalError = err as BaseError;
    
    // Log the error
    appLogger.error(`Operational Error: ${operationalError.message}`, {
      requestId,
      userId,
      errorCode: operationalError.errorCode,
      statusCode: operationalError.statusCode,
      context: operationalError.context,
      stack: operationalError.stack,
      method: req.method,
      url: req.originalUrl
    });

    // Send structured error response
    const errorResponse: ErrorResponse = {
      error: {
        code: operationalError.errorCode,
        message: operationalError.message,
        statusCode: operationalError.statusCode,
        timestamp: operationalError.timestamp,
        requestId,
        ...(process.env.NODE_ENV === 'development' && operationalError.context && {
          details: operationalError.context
        })
      },
      success: false
    };

    res.status(operationalError.statusCode).json(errorResponse);
    return;
  }

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