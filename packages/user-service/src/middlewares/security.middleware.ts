import { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { authConfig } from '../config/auth.config';
import { ValidationError } from '../utils/errors';
import { appLogger as logger } from '../utils/logger';
import { requestContextMiddleware, getRequestContext } from './request-context.middleware';
import { loggerMiddleware } from './logger.middleware';
import { RequestContext } from '../types/express';

// Enhanced Request interface (using shared RequestContext)
interface SecurityRequest extends Request {
  context?: RequestContext;
}

// Security headers middleware
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Apply security headers from config
  res.set(authConfig.SECURITY_HEADERS);
  
  // Add dynamic security headers
  res.set({
    'X-Request-ID': req.headers['x-request-id'] as string || `req_${Date.now()}`,
    'X-API-Version': req.headers['api-version'] as string || authConfig.DEFAULT_API_VERSION
  });

  next();
};

// CORS middleware with configuration
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (authConfig.CORS_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      logger.logSecurity('CORS origin blocked', 'medium', {
        origin,
        allowedOrigins: authConfig.CORS_ORIGINS,
        timestamp: new Date().toISOString()
      });
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-Request-ID',
    'API-Version',
    'Accept-Version'
  ],
  exposedHeaders: [
    'X-Request-ID',
    'X-API-Version',
    'X-Response-Time',
    'X-Rate-Limit-Remaining',
    'X-Rate-Limit-Reset'
  ],
  maxAge: 86400 // 24 hours
});

// API versioning middleware
export const apiVersionMiddleware = (req: SecurityRequest, res: Response, next: NextFunction): void => {
  const version = (req.headers['api-version'] || req.headers['accept-version'] || authConfig.DEFAULT_API_VERSION) as string;
  
  if (!authConfig.SUPPORTED_API_VERSIONS.includes(version)) {
    logger.logSecurity('Unsupported API version requested', 'low', {
      requestedVersion: version,
      supportedVersions: authConfig.SUPPORTED_API_VERSIONS,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    throw new ValidationError(
      `API version '${version}' is not supported. Supported versions: ${authConfig.SUPPORTED_API_VERSIONS.join(', ')}`,
      'AUTH_4007_UNSUPPORTED_API_VERSION'
    );
  }

  // Add version to request context
  if (req.context) {
    req.context.apiVersion = version;
  }

  // Set response header
  res.set('X-API-Version', version);
  
  next();
};

// Input sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  const { SANITIZATION_CONFIG } = authConfig;
  
  if (req.body && typeof req.body === 'object') {
    // Email normalization
    if (req.body.email && typeof req.body.email === 'string') {
      req.body.email = req.body.email.toLowerCase().trim();
      
      // Check email domain whitelist if configured
      if (SANITIZATION_CONFIG.EMAIL_DOMAIN_WHITELIST.length > 0) {
        const emailDomain = req.body.email.split('@')[1];
        if (emailDomain && !SANITIZATION_CONFIG.EMAIL_DOMAIN_WHITELIST.includes(emailDomain)) {
          logger.logSecurity('Email domain not in whitelist', 'medium', {
            email: req.body.email.replace(authConfig.EMAIL_MASK_REGEX, '*'),
            domain: emailDomain,
            ip: req.ip
          });
          
          throw new ValidationError(
            'Email domain không được hỗ trợ',
            'AUTH_4008_UNSUPPORTED_EMAIL_DOMAIN'
          );
        }
      }
    }

    // Name field sanitization
    ['firstName', 'lastName', 'name', 'displayName'].forEach(field => {
      if (req.body[field] && typeof req.body[field] === 'string') {
        // Remove dangerous characters
        req.body[field] = req.body[field]
          .replace(/[<>\"'&]/g, '') // Remove XSS chars
          .trim();
          
        // Validate against allowed characters
        if (!SANITIZATION_CONFIG.ALLOWED_NAME_CHARS.test(req.body[field])) {
          throw new ValidationError(
            `Trường ${field} chứa ký tự không hợp lệ`,
            'AUTH_4009_INVALID_NAME_CHARACTERS'
          );
        }
        
        // Check length
        if (req.body[field].length > SANITIZATION_CONFIG.MAX_NAME_LENGTH) {
          throw new ValidationError(
            `Trường ${field} quá dài (tối đa ${SANITIZATION_CONFIG.MAX_NAME_LENGTH} ký tự)`,
            'AUTH_4010_NAME_TOO_LONG'
          );
        }
      }
    });

    // Phone number sanitization
    if (req.body.phoneNumber && typeof req.body.phoneNumber === 'string') {
      req.body.phoneNumber = req.body.phoneNumber.replace(/[^\d+\-\s()]/g, '').trim();
    }

    // Remove null bytes and control characters
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].replace(/[\x00-\x1f\x7f]/g, '');
      }
    });
  }

  next();
};

// Request size limiting middleware
export const requestSizeLimit = (maxSize?: number) => {
  const limit = maxSize || authConfig.DEFAULT_REQUEST_SIZE_LIMIT;
  
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = req.headers['content-length'];
    
    if (contentLength && parseInt(contentLength) > limit) {
      logger.logSecurity('Request size exceeded limit', 'medium', {
        contentLength: parseInt(contentLength),
        limit,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      throw new ValidationError(
        `Request body quá lớn. Tối đa ${Math.round(limit / 1024)}KB`,
        'AUTH_4005_REQUEST_TOO_LARGE'
      );
    }
    
    next();
  };
};

// Response time middleware
export const responseTimeMiddleware = (req: SecurityRequest, res: Response, next: NextFunction): void => {
  const context = getRequestContext(req);
  if (!context) {
    logger.warn('Response time middleware: Request context not available');
    return next();
  }
  
  res.on('finish', () => {
    const responseTime = Date.now() - context.startTime;
    
    // Add response time header (only if headers not sent)
    if (!res.headersSent) {
      res.set('X-Response-Time', `${responseTime}ms`);
    }
    
    // Log performance metrics
    const level = responseTime > authConfig.PERFORMANCE_THRESHOLDS.ERROR ? 'error' :
                  responseTime > authConfig.PERFORMANCE_THRESHOLDS.WARNING ? 'warning' : 'good';
    
    logger.info('Response time recorded', {
      responseTime,
      performanceLevel: level,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      requestId: req.context?.requestId
    });
    
    // Alert on slow responses
    if (responseTime > authConfig.PERFORMANCE_THRESHOLDS.ERROR) {
      logger.logSecurity('Slow response detected', 'high', {
        responseTime,
        threshold: authConfig.PERFORMANCE_THRESHOLDS.ERROR,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip
      });
    }
  });
  
  next();
};

// Content Security Policy middleware
export const cspMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const cspPolicy = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self'",
    "font-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');
  
  res.set('Content-Security-Policy', cspPolicy);
  next();
};

// Combined security middleware stack
export const securityMiddlewareStack = [
  requestContextMiddleware, // MUST be first to set up context
  loggerMiddleware, // Setup req.logger with requestId
  responseTimeMiddleware,
  securityHeaders,
  corsMiddleware,
  cspMiddleware,
  apiVersionMiddleware,
  requestSizeLimit(),
  sanitizeInput
];

export default {
  securityHeaders,
  corsMiddleware,
  apiVersionMiddleware,
  sanitizeInput,
  requestSizeLimit,
  responseTimeMiddleware,
  cspMiddleware,
  securityMiddlewareStack
}; 