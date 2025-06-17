import winston from 'winston';
import { Request } from 'express';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
};

winston.addColors(colors);

// Custom format for structured logging
const structuredFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, service, requestId, userId, method, url, statusCode, duration, error, ...meta } = info;
    
    const logObject: any = {
      timestamp,
      level: level.toUpperCase(),
      service: service || 'user-service',
      message
    };
    
    if (requestId) logObject.requestId = requestId;
    if (userId) logObject.userId = userId;
    if (method) logObject.method = method;
    if (url) logObject.url = url;
    if (statusCode) logObject.statusCode = statusCode;
    if (duration) logObject.duration = duration;
    if (error) logObject.error = error;
    if (Object.keys(meta).length > 0) logObject.meta = meta;

    return JSON.stringify(logObject);
  })
);

// Development format (more readable)
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf((info) => {
    const { timestamp, level, message, requestId, userId, method, url, error } = info;
    let logMessage = `${timestamp} [${level}]`;
    
    if (requestId) logMessage += ` [${requestId}]`;
    if (userId) logMessage += ` [user:${userId}]`;
    if (method && url) logMessage += ` ${method} ${url}`;
    
    logMessage += `: ${message}`;
    
    if (error) {
      logMessage += `\n${error}`;
    }
    
    return logMessage;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format: process.env.NODE_ENV === 'production' ? structuredFormat : developmentFormat,
  defaultMeta: {
    service: 'user-service',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.APP_VERSION || '1.0.0'
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true
    }),

    // Error log file
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      format: structuredFormat
    }),

    // Combined log file
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      format: structuredFormat
    }),

    // Warning log file
    new winston.transports.File({
      filename: 'logs/warnings.log',
      level: 'warn',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      format: structuredFormat
    })
  ],
  exitOnError: false
});

// Logger interface for consistent usage
interface LogMeta {
  requestId?: string;
  userId?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  duration?: number;
  error?: string | Error;
  [key: string]: any;
}

// Enhanced logger with convenience methods
class Logger {
  private winston: winston.Logger;

  constructor(winstonLogger: winston.Logger) {
    this.winston = winstonLogger;
  }

  error(message: string, meta?: LogMeta): void {
    this.winston.error(message, meta);
  }

  warn(message: string, meta?: LogMeta): void {
    this.winston.warn(message, meta);
  }

  info(message: string, meta?: LogMeta): void {
    this.winston.info(message, meta);
  }

  debug(message: string, meta?: LogMeta): void {
    this.winston.debug(message, meta);
  }

  // Request logging
  logRequest(req: Request, statusCode: number, duration: number, userId?: string): void {
    const message = `${req.method} ${req.originalUrl} - ${statusCode} (${duration}ms)`;
    const meta: LogMeta = {
      requestId: req.headers['x-request-id'] as string,
      userId,
      method: req.method,
      url: req.originalUrl,
      statusCode,
      duration,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress
    };

    if (statusCode >= 400) {
      this.error(message, meta);
    } else if (statusCode >= 300) {
      this.warn(message, meta);
    } else {
      this.info(message, meta);
    }
  }

  // Authentication logging
  logAuth(event: string, email?: string, userId?: string, success: boolean = true, error?: Error): void {
    const message = `Authentication ${event}: ${success ? 'SUCCESS' : 'FAILED'}`;
    const meta: LogMeta = {
      event,
      email: email ? this.maskEmail(email) : undefined,
      userId,
      success,
      ...(error && { error: error.message })
    };

    if (success) {
      this.info(message, meta);
    } else {
      this.warn(message, meta);
    }
  }

  // Security event logging
  logSecurity(event: string, severity: 'low' | 'medium' | 'high', details: any): void {
    const message = `Security Event: ${event}`;
    const meta: LogMeta = {
      securityEvent: true,
      event,
      severity,
      details,
      timestamp: new Date().toISOString()
    };

    if (severity === 'high') {
      this.error(message, meta);
    } else if (severity === 'medium') {
      this.warn(message, meta);
    } else {
      this.info(message, meta);
    }
  }

  // Database operation logging
  logDatabase(operation: string, table: string, duration: number, recordsAffected?: number, error?: Error): void {
    const message = `Database ${operation} on ${table} (${duration}ms)`;
    const meta: LogMeta = {
      database: true,
      operation,
      table,
      duration,
      recordsAffected,
      ...(error && { error: error.message })
    };

    if (error) {
      this.error(message, meta);
    } else if (duration > 1000) { // Slow query warning
      this.warn(`Slow query detected: ${message}`, meta);
    } else {
      this.debug(message, meta);
    }
  }

  // Performance logging
  logPerformance(operation: string, duration: number, details?: any): void {
    const message = `Performance: ${operation} took ${duration}ms`;
    const meta: LogMeta = {
      performance: true,
      operation,
      duration,
      ...(details && { details })
    };

    if (duration > 5000) {
      this.error(`Very slow operation: ${message}`, meta);
    } else if (duration > 1000) {
      this.warn(`Slow operation: ${message}`, meta);
    } else {
      this.debug(message, meta);
    }
  }

  // Email utility
  private maskEmail(email: string): string {
    return email.replace(/(?<=.{2}).(?=.*@)/g, '*');
  }

  // Create child logger with default metadata
  child(defaultMeta: LogMeta): Logger {
    const childLogger = this.winston.child(defaultMeta);
    return new Logger(childLogger);
  }

  // Get underlying winston instance
  getWinstonLogger(): winston.Logger {
    return this.winston;
  }
}

// Create and export the main logger instance
export const appLogger = new Logger(logger);

// Export request correlation middleware factory
export const createRequestLogger = (requestId?: string) => {
  return appLogger.child({ requestId });
};

// Express middleware for automatic request logging
export const requestLoggingMiddleware = (req: Request, res: any, next: any) => {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] as string || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Add request ID to headers for tracing
  req.headers['x-request-id'] = requestId;
  res.setHeader('x-request-id', requestId);

  // Create request-specific logger
  const requestLogger = createRequestLogger(requestId);
  
  // Attach logger to request for use in controllers
  (req as any).logger = requestLogger;

  // Log incoming request
  requestLogger.info(`Incoming request: ${req.method} ${req.originalUrl}`, {
    method: req.method,
    url: req.originalUrl,
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.connection.remoteAddress,
    body: req.method !== 'GET' ? sanitizeBody(req.body) : undefined
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: string) {
    const duration = Date.now() - startTime;
    const userId = (req as any).user?.id;
    
    requestLogger.logRequest(req, res.statusCode, duration, userId);
    
    originalEnd.call(this, chunk, encoding);
  };

  next();
};

// Utility function to sanitize request body (remove sensitive data)
function sanitizeBody(body: any): any {
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

// Error logging helper
export const logError = (error: Error, context?: string, meta?: LogMeta) => {
  const message = context ? `${context}: ${error.message}` : error.message;
  appLogger.error(message, {
    error: error.stack,
    ...meta
  });
};

export default appLogger; 