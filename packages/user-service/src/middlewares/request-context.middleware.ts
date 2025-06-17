import { Request, Response, NextFunction } from 'express';
import { authConfig } from '../config/auth.config';
import { RequestContext } from '../types/express';

/**
 * Request context middleware - should be first in middleware chain
 * Sets up request context with unique ID, timing, and metadata
 */
export const requestContextMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  
  // Generate unique request ID
  const requestId = (req.headers['x-request-id'] as string) || 
                   `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Set up request context
  req.context = {
    requestId,
    userAgent: req.headers['user-agent'] || 'unknown',
    ip: req.ip || req.connection.remoteAddress || 'unknown',
    startTime: Date.now(),
    apiVersion: (req.headers['api-version'] || req.headers['accept-version'] || authConfig.DEFAULT_API_VERSION) as string,
    userId: undefined // Will be set by auth middleware
  };

  // Add request ID to response headers
  res.set('X-Request-ID', requestId);
  
  next();
};

/**
 * Utility function to get request context
 */
export const getRequestContext = (req: Request): RequestContext | undefined => {
  return req.context;
};

/**
 * Utility function to update user ID in context
 */
export const setContextUserId = (req: Request, userId: string): void => {
  const context = getRequestContext(req);
  if (context) {
    context.userId = userId;
  }
};

/**
 * Utility function to get request duration
 */
export const getRequestDuration = (req: Request): number => {
  const context = getRequestContext(req);
  return context ? Date.now() - context.startTime : 0;
};

export default {
  requestContextMiddleware,
  getRequestContext,
  setContextUserId,
  getRequestDuration
}; 