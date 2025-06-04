import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        plan: string;
        isVerified: boolean;
      };
    }
  }
}

interface JWTPayload {
  userId: string;
  plan: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

// User lookup function for API Gateway
async function getUserById(userId: string): Promise<any | null> {
  try {
    // In API Gateway, we can make HTTP request to user service
    const userServiceUrl = process.env.USER_SERVICE_URL || 'http://localhost:3001';
    
    const response = await fetch(`${userServiceUrl}/users/${userId}`, {
      headers: {
        'Content-Type': 'application/json',
        'Internal-Service': 'api-gateway' // Internal service header
      }
    });

    if (!response.ok) {
      console.error(`Failed to fetch user ${userId}: ${response.status}`);
      return null;
    }

    const userData = await response.json();
    
    return {
      id: userData.id,
      email: userData.email,
      plan: userData.currentPlan || 'FREE',
      isVerified: userData.isVerified || false
    };
  } catch (error) {
    console.error('Error fetching user from user service:', error);
    return null;
  }
}

// Routes that should skip authentication
const skipRoutes = [
  '/health',
  '/api/docs',
  '/',
  '/api/users/auth/login',
  '/api/users/auth/register',
  '/api/users/auth/verify-email',
  '/api/users/auth/forgot-password',
  '/api/users/auth/reset-password',
  '/api/users/auth/resend-verification'
];

// Main authentication middleware
export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Skip authentication for certain routes
    if (skipRoutes.some(route => req.path === route || req.path.startsWith(route))) {
      return next();
    }

    // Extract token from header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({
        error: 'Token không được cung cấp',
        message: 'Vui lòng đăng nhập để truy cập tài nguyên này.'
      });
      return;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      res.status(401).json({
        error: 'Authorization header format không đúng',
        message: 'Expected: Bearer <token>'
      });
      return;
    }

    const token = parts[1];
    
    // Verify token
    const secret = process.env.JWT_SECRET || 'fallback-secret-key';
    const decoded = jwt.verify(token, secret as string) as unknown as JWTPayload;

    // Check if token is access token
    if (decoded.type !== 'access') {
      res.status(401).json({
        error: 'Token không hợp lệ',
        message: 'Vui lòng sử dụng access token.'
      });
      return;
    }

    // Get user details
    const user = await getUserById(decoded.userId);
    
    if (!user) {
      res.status(401).json({
        error: 'Người dùng không tồn tại',
        message: 'Tài khoản đã bị xóa hoặc không hợp lệ.'
      });
      return;
    }

    // Check if email verification is required
    if (!user.isVerified) {
      res.status(401).json({
        error: 'Email chưa được xác thực',
        message: 'Vui lòng xác thực email trước khi truy cập tài nguyên này.',
        action: 'VERIFY_EMAIL'
      });
      return;
    }

    // Attach user to request
    req.user = user;
    next();

  } catch (error: any) {
    console.error('Authentication error:', error);

    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        error: 'Token đã hết hạn',
        message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
        action: 'REFRESH_TOKEN'
      });
      return;
    }

    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({
        error: 'Token không hợp lệ',
        message: 'Token xác thực không đúng định dạng.'
      });
      return;
    }

    res.status(500).json({
      error: 'Lỗi xác thực',
      message: 'Đã xảy ra lỗi khi xác thực. Vui lòng thử lại sau.'
    });
  }
};

// Optional authentication - doesn't fail if no token
export const optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return next();
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return next();
    }

    const token = parts[1];
    const secret = process.env.JWT_SECRET || 'fallback-secret-key';
    const decoded = jwt.verify(token, secret as string) as unknown as JWTPayload;

    if (decoded.type === 'access') {
      const user = await getUserById(decoded.userId);
      if (user && user.isVerified) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // For optional auth, we don't return errors
    next();
  }
};

// Plan-based middleware
export const requirePlan = (requiredPlans: string | string[]) => {
  const plans = Array.isArray(requiredPlans) ? requiredPlans : [requiredPlans];
  
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Chưa xác thực',
        message: 'Vui lòng đăng nhập để truy cập tài nguyên này.'
      });
      return;
    }

    if (!plans.includes(req.user.plan)) {
      res.status(403).json({
        error: 'Không đủ quyền truy cập',
        message: `Tính năng này yêu cầu gói ${plans.join(' hoặc ')}.`,
        currentPlan: req.user.plan,
        requiredPlans: plans,
        action: 'UPGRADE_PLAN'
      });
      return;
    }

    next();
  };
};

// Plan-specific middlewares
export const requirePremium = requirePlan(['PREMIUM', 'ENTERPRISE']);
export const requireEnterprise = requirePlan('ENTERPRISE');

// Custom middleware for API Gateway specific needs
export const apiGatewayAuth = {
  /**
   * Middleware to check rate limiting based on user plan
   */
  planBasedRateLimit: (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(); // Let authenticate middleware handle this
    }

    const plan = req.user.plan;
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes

    // Define rate limits per plan
    const rateLimits: Record<string, number> = {
      'FREE': 100,
      'PREMIUM': 500,
      'ENTERPRISE': 2000
    };

    const limit = rateLimits[plan] || 100;
    
    // TODO: Implement Redis-based rate limiting
    // For now, just add headers
    res.set({
      'X-RateLimit-Limit': limit.toString(),
      'X-RateLimit-Remaining': Math.max(0, limit - 1).toString(),
      'X-RateLimit-Reset': new Date(now + windowMs).toISOString()
    });

    next();
  },

  /**
   * Middleware to log user activities
   */
  auditLog: (req: Request, res: Response, next: NextFunction) => {
    if (req.user) {
      console.log(`[AUDIT] User ${req.user.id} (${req.user.plan}) accessed ${req.method} ${req.path}`);
    }
    next();
  }
};

// Route protection helpers
export const protectRoute = {
  /**
   * Protect routes that require authentication
   */
  auth: [authenticate, apiGatewayAuth.planBasedRateLimit, apiGatewayAuth.auditLog],
  
  /**
   * Protect routes that require premium plan
   */
  premium: [authenticate, requirePremium, apiGatewayAuth.planBasedRateLimit, apiGatewayAuth.auditLog],
  
  /**
   * Protect routes that require enterprise plan
   */
  enterprise: [authenticate, requireEnterprise, apiGatewayAuth.planBasedRateLimit, apiGatewayAuth.auditLog]
}; 