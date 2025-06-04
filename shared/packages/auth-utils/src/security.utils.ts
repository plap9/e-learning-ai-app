import { Request, Response, NextFunction } from 'express';

export interface SecurityConfig {
  enableCSP?: boolean;
  enableHSTS?: boolean;
  enableXSSProtection?: boolean;
  enableClickjacking?: boolean;
  enableReferrerPolicy?: boolean;
  cspDirectives?: Record<string, string[]>;
  hstsMaxAge?: number;
  trustedOrigins?: string[];
}

export class SecurityUtils {
  private config: SecurityConfig;

  constructor(config: SecurityConfig = {}) {
    this.config = {
      enableCSP: true,
      enableHSTS: true,
      enableXSSProtection: true,
      enableClickjacking: true,
      enableReferrerPolicy: true,
      hstsMaxAge: 31536000, // 1 year
      trustedOrigins: ['http://localhost:3000', 'http://localhost:19006'],
      cspDirectives: {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'https:'],
        'font-src': ["'self'", 'https:'],
        'connect-src': ["'self'", 'wss:', 'ws:'],
        'frame-ancestors': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"]
      },
      ...config
    };
  }

  /**
   * Apply all security headers
   */
  applySecurityHeaders = (req: Request, res: Response, next: NextFunction): void => {
    // Content Security Policy
    if (this.config.enableCSP) {
      this.setCSPHeaders(res);
    }

    // HTTP Strict Transport Security
    if (this.config.enableHSTS) {
      this.setHSTSHeaders(res);
    }

    // XSS Protection
    if (this.config.enableXSSProtection) {
      this.setXSSProtectionHeaders(res);
    }

    // Clickjacking Protection
    if (this.config.enableClickjacking) {
      this.setClickjackingProtectionHeaders(res);
    }

    // Referrer Policy
    if (this.config.enableReferrerPolicy) {
      this.setReferrerPolicyHeaders(res);
    }

    // Additional security headers
    this.setAdditionalSecurityHeaders(res);

    next();
  };

  /**
   * Set Content Security Policy headers
   */
  private setCSPHeaders(res: Response): void {
    const directives = this.config.cspDirectives;
    if (!directives) return;

    const cspString = Object.entries(directives)
      .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
      .join('; ');

    res.setHeader('Content-Security-Policy', cspString);
    res.setHeader('X-Content-Security-Policy', cspString); // Legacy browsers
    res.setHeader('X-WebKit-CSP', cspString); // Webkit browsers
  }

  /**
   * Set HTTP Strict Transport Security headers
   */
  private setHSTSHeaders(res: Response): void {
    const maxAge = this.config.hstsMaxAge || 31536000;
    res.setHeader('Strict-Transport-Security', `max-age=${maxAge}; includeSubDomains; preload`);
  }

  /**
   * Set XSS Protection headers
   */
  private setXSSProtectionHeaders(res: Response): void {
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }

  /**
   * Set Clickjacking Protection headers
   */
  private setClickjackingProtectionHeaders(res: Response): void {
    res.setHeader('X-Frame-Options', 'DENY');
  }

  /**
   * Set Referrer Policy headers
   */
  private setReferrerPolicyHeaders(res: Response): void {
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  }

  /**
   * Set additional security headers
   */
  private setAdditionalSecurityHeaders(res: Response): void {
    // Prevent DNS prefetching
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    
    // Download options for IE8+
    res.setHeader('X-Download-Options', 'noopen');
    
    // Permitted cross-domain policies
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    
    // Remove server information
    res.removeHeader('X-Powered-By');
    
    // Cache control for sensitive pages
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }

  /**
   * Advanced CORS configuration with security
   */
  configureCORS = (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;
    const trustedOrigins = this.config.trustedOrigins || [];

    // Check if origin is trusted
    if (origin && trustedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (!origin) {
      // Allow same-origin requests
      res.setHeader('Access-Control-Allow-Origin', '*');
    }

    // Set other CORS headers
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization,X-CSRF-Token');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    next();
  };

  /**
   * Request validation middleware
   */
  validateRequest = (req: Request, res: Response, next: NextFunction): void => {
    // Check for suspicious headers
    const suspiciousHeaders = [
      'x-forwarded-for',
      'x-real-ip',
      'x-cluster-client-ip'
    ];

    for (const header of suspiciousHeaders) {
      const value = req.headers[header];
      if (value && this.isSuspiciousIP(value as string)) {
        console.warn(`🚨 Suspicious IP detected in ${header}: ${value}`);
        res.status(403).json({
          error: 'Access denied',
          message: 'Request blocked for security reasons'
        });
        return;
      }
    }

    // Validate Content-Type for POST/PUT requests
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const contentType = req.headers['content-type'];
      if (!contentType || !this.isValidContentType(contentType)) {
        res.status(400).json({
          error: 'Invalid Content-Type',
          message: 'Request must have valid Content-Type header'
        });
        return;
      }
    }

    // Check request size
    const contentLength = req.headers['content-length'];
    if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) { // 10MB limit
      res.status(413).json({
        error: 'Payload too large',
        message: 'Request body exceeds maximum size limit'
      });
      return;
    }

    next();
  };

  /**
   * Rate limiting based on IP and user
   */
  createRateLimiter = (options: {
    windowMs?: number;
    maxRequests?: number;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
  } = {}) => {
    const {
      windowMs = 15 * 60 * 1000, // 15 minutes
      maxRequests = 100,
      skipSuccessfulRequests = false,
      skipFailedRequests = false
    } = options;

    const requestCounts = new Map<string, { count: number; resetTime: number }>();

    return (req: Request, res: Response, next: NextFunction): void => {
      const identifier = this.getClientIdentifier(req);
      const now = Date.now();

      // Clean up expired entries
      for (const [key, data] of requestCounts.entries()) {
        if (now > data.resetTime) {
          requestCounts.delete(key);
        }
      }

      // Get or create request count
      let requestData = requestCounts.get(identifier);
      if (!requestData || now > requestData.resetTime) {
        requestData = {
          count: 0,
          resetTime: now + windowMs
        };
        requestCounts.set(identifier, requestData);
      }

      // Check if limit exceeded
      if (requestData.count >= maxRequests) {
        res.status(429).json({
          error: 'Too many requests',
          message: 'Rate limit exceeded. Try again later.',
          retryAfter: Math.ceil((requestData.resetTime - now) / 1000)
        });
        return;
      }

      // Increment counter
      requestData.count++;

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', (maxRequests - requestData.count).toString());
      res.setHeader('X-RateLimit-Reset', new Date(requestData.resetTime).toISOString());

      next();
    };
  };

  /**
   * Get client identifier for rate limiting
   */
  private getClientIdentifier(req: Request): string {
    // Use user ID if authenticated, otherwise use IP
    const userId = (req as any).user?.id;
    if (userId) {
      return `user:${userId}`;
    }

    // Get IP address
    const ip = req.ip || 
               req.connection.remoteAddress || 
               req.headers['x-forwarded-for'] || 
               req.headers['x-real-ip'] || 
               'unknown';

    return `ip:${ip}`;
  }

  /**
   * Check if IP is suspicious
   */
  private isSuspiciousIP(ip: string): boolean {
    // List of known malicious IP ranges/patterns
    const suspiciousPatterns = [
      /^127\./, // Localhost attempts
      /^0\./, // Invalid IPs
      /^192\.168\./, // Private networks (in production)
      /^10\./, // Private networks (in production)
      /^172\.(1[6-9]|2[0-9]|3[01])\./ // Private networks (in production)
    ];

    // In production, you might want to remove private network checks
    if (process.env.NODE_ENV === 'development') {
      return false;
    }

    return suspiciousPatterns.some(pattern => pattern.test(ip));
  }

  /**
   * Validate Content-Type header
   */
  private isValidContentType(contentType: string): boolean {
    const allowedTypes = [
      'application/json',
      'application/x-www-form-urlencoded',
      'multipart/form-data',
      'text/plain'
    ];

    return allowedTypes.some(type => contentType.toLowerCase().includes(type));
  }

  /**
   * Create CSRF protection middleware
   */
  createCSRFProtection = () => {
    const tokenStore = new Map<string, { token: string; expiresAt: number }>();

    return {
      generateToken: (req: Request, res: Response, next: NextFunction): void => {
        const token = this.generateCSRFToken();
        const expiresAt = Date.now() + 3600000; // 1 hour

        // Store token (in production, use Redis)
        const sessionId = (req as any).sessionID || req.ip;
        tokenStore.set(sessionId, { token, expiresAt });

        // Set token in cookie
        res.cookie('csrf-token', token, {
          httpOnly: false, // Allow JavaScript access
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 3600000
        });

        next();
      },

      validateToken: (req: Request, res: Response, next: NextFunction): void => {
        if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
          return next();
        }

        const tokenFromHeader = req.headers['x-csrf-token'] as string;
        const tokenFromBody = req.body?.csrfToken;
        const sessionId = (req as any).sessionID || req.ip;

        const storedData = tokenStore.get(sessionId);

        if (!storedData || Date.now() > storedData.expiresAt) {
          res.status(403).json({
            error: 'CSRF token expired',
            message: 'CSRF token has expired. Please refresh the page.'
          });
          return;
        }

        const submittedToken = tokenFromHeader || tokenFromBody;
        if (!submittedToken || submittedToken !== storedData.token) {
          res.status(403).json({
            error: 'CSRF token invalid',
            message: 'Invalid CSRF token. Request blocked for security.'
          });
          return;
        }

        next();
      }
    };
  };

  /**
   * Generate CSRF token
   */
  private generateCSRFToken(): string {
    return Math.random().toString(36).substring(2) + 
           Date.now().toString(36) + 
           Math.random().toString(36).substring(2);
  }
}

/**
 * Create security utils instance
 */
export function createSecurityUtils(config?: SecurityConfig): SecurityUtils {
  return new SecurityUtils(config);
}

/**
 * Export quick security middleware
 */
export const quickSecurity = {
  headers: (config?: SecurityConfig) => {
    const security = createSecurityUtils(config);
    return security.applySecurityHeaders;
  },

  cors: (config?: SecurityConfig) => {
    const security = createSecurityUtils(config);
    return security.configureCORS;
  },

  rateLimit: (options?: {
    windowMs?: number;
    maxRequests?: number;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
  }) => {
    const security = createSecurityUtils();
    return security.createRateLimiter(options);
  },

  validate: (config?: SecurityConfig) => {
    const security = createSecurityUtils(config);
    return security.validateRequest;
  }
}; 