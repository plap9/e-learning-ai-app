import jwt from 'jsonwebtoken';
import { Request } from 'express';
import { AuthenticationError, SystemError } from './errors';

// Internal service token verification
export interface InternalTokenPayload {
  service: string;
  permissions: string[];
  iat: number;
  exp: number;
}

/**
 * Verify internal service JWT token
 */
export const verifyInternalToken = (token: string): InternalTokenPayload => {
  try {
    const secret = process.env.INTERNAL_JWT_SECRET;
    
    if (!secret) {
      throw new SystemError(
        'Internal JWT secret not configured',
        'SYSTEM_1001_CONFIG_MISSING'
      );
    }

    const payload = jwt.verify(token, secret) as InternalTokenPayload;
    
    // Validate required fields
    if (!payload.service || !payload.permissions) {
      throw new SystemError(
        'Invalid internal token structure',
        'SYSTEM_1002_INVALID_TOKEN'
      );
    }

    return payload;
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      throw new AuthenticationError(
        'Invalid internal token',
        'AUTH_2006_INVALID_TOKEN'
      );
    }
    
    if (error.name === 'TokenExpiredError') {
      throw new AuthenticationError(
        'Internal token expired',
        'AUTH_2007_TOKEN_EXPIRED'
      );
    }
    
    // Re-throw custom errors
    if (error instanceof SystemError || error instanceof AuthenticationError) {
      throw error;
    }
    
    throw new SystemError(
      'Token verification failed',
      'SYSTEM_1003_VERIFICATION_FAILED'
    );
  }
};

/**
 * Verify internal service has required permission
 */
export const verifyServicePermission = (
  payload: InternalTokenPayload,
  requiredPermission: string
): boolean => {
  return payload.permissions.includes(requiredPermission) || 
         payload.permissions.includes('*');
};

/**
 * Extract and verify internal token from request
 */
export const extractInternalToken = (req: Request): InternalTokenPayload => {
  const authHeader = req.headers.authorization;
  const tokenHeader = req.headers['x-internal-token'] as string;
  
  let token: string | undefined;
  
  // Try Authorization header first (Bearer token)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } 
  // Fallback to custom header
  else if (tokenHeader) {
    token = tokenHeader;
  }
  
  if (!token) {
    throw new AuthenticationError(
      'Internal token required',
      'AUTH_2005_TOKEN_MISSING'
    );
  }
  
  return verifyInternalToken(token);
};

/**
 * Check if request is from authorized internal service
 */
export const isAuthorizedInternalService = (
  req: Request,
  requiredService?: string,
  requiredPermission?: string
): boolean => {
  try {
    const payload = extractInternalToken(req);
    
    // Check specific service if required
    if (requiredService && payload.service !== requiredService) {
      return false;
    }
    
    // Check permission if required
    if (requiredPermission && !verifyServicePermission(payload, requiredPermission)) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
};

/**
 * Input sanitization for XSS prevention
 */
export const sanitizeInput = (input: any): any => {
  if (typeof input === 'string') {
    return input
      .replace(/[<>]/g, '') // Remove HTML tags
      .trim();
  }
  
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  
  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return input;
};

/**
 * Validate user ID format and sanitize
 */
export const sanitizeUserId = (userId: string): string => {
  const sanitized = userId.replace(/[^a-zA-Z0-9_-]/g, '');
  
  if (sanitized !== userId) {
    throw new SystemError(
      'Invalid user ID format',
      'SYSTEM_1004_INVALID_USER_ID'
    );
  }
  
  return sanitized;
};

/**
 * Rate limiting key generators
 */
export const generateRateLimitKey = (
  prefix: string,
  identifier: string
): string => {
  return `rate_limit:${prefix}:${identifier}`;
};

export const generateUserRateLimitKey = (
  endpoint: string,
  userId: string
): string => {
  return generateRateLimitKey(`user:${endpoint}`, userId);
};

export const generateIPRateLimitKey = (
  endpoint: string,
  ip: string
): string => {
  return generateRateLimitKey(`ip:${endpoint}`, ip);
}; 