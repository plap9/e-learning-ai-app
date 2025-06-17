import { Request, Response, NextFunction } from 'express';
import { getRequestContext } from './request-context.middleware';
import { appLogger } from '../utils/logger';
import { Logger } from '../types/express';

/**
 * Logger middleware - creates request-specific logger với requestId
 * Should be placed after requestContextMiddleware
 */
export const loggerMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const context = getRequestContext(req);
  
  if (!context) {
    console.warn('Logger middleware: Request context not available');
    req.logger = appLogger; // Fallback to global logger
    return next();
  }

  // Create request-specific logger with requestId
  const requestLogger: Logger = {
    info: (message: string, meta?: Record<string, unknown>) => {
      appLogger.info(message, {
        ...meta,
        requestId: context.requestId,
        userId: context.userId
      });
    },
    
    warn: (message: string, meta?: Record<string, unknown>) => {
      appLogger.warn(message, {
        ...meta,
        requestId: context.requestId,
        userId: context.userId
      });
    },
    
    error: (message: string, meta?: Record<string, unknown>) => {
      appLogger.error(message, {
        ...meta,
        requestId: context.requestId,
        userId: context.userId
      });
    },
    
    logAuth: (event: string, email?: string, userId?: string, success?: boolean) => {
      appLogger.logAuth(event, email, userId, success);
      // Also log with requestId context
      appLogger.info(`Auth Event: ${event}`, {
        email,
        userId,
        success,
        requestId: context.requestId
      });
    },
    
    logSecurity: (event: string, severity: 'low' | 'medium' | 'high', details: Record<string, unknown>) => {
      appLogger.logSecurity(event, severity, {
        ...details,
        requestId: context.requestId,
        userId: context.userId
      });
    }
  };

  // Attach logger to request
  req.logger = requestLogger;
  
  next();
};

export default loggerMiddleware; 