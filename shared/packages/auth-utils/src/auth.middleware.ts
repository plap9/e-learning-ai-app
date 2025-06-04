import { Request, Response, NextFunction } from 'express';
import { JWTUtils, createJWTUtils } from './jwt.utils';
import { AuthUser, AuthConfig, AuthErrorCodes } from './types';

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export interface AuthMiddlewareConfig extends Partial<AuthConfig> {
  getUserById?: (userId: string) => Promise<AuthUser | null>;
  skipRoutes?: string[];
  requireVerification?: boolean;
}

export class AuthMiddleware {
  private jwtUtils: JWTUtils;
  private config: AuthMiddlewareConfig;

  constructor(config: AuthMiddlewareConfig = {}) {
    this.config = config;
    this.jwtUtils = createJWTUtils(config);
  }

  /**
   * Main authentication middleware
   */
  authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Skip authentication for certain routes
      if (this.shouldSkipAuth(req.path)) {
        return next();
      }

      // Extract token from header
      const token = this.jwtUtils.extractTokenFromHeader(req.headers.authorization);
      
      // Verify token
      const decoded = this.jwtUtils.verifyToken(token, 'access');

      // Get user details if getUserById function is provided
      let user: AuthUser | null = null;
      
      if (this.config.getUserById) {
        user = await this.config.getUserById(decoded.userId);
        
        if (!user) {
          res.status(401).json({
            error: 'Người dùng không tồn tại',
            message: 'Tài khoản đã bị xóa hoặc không hợp lệ.',
            code: AuthErrorCodes.USER_NOT_FOUND
          });
          return;
        }

        // Check if email verification is required
        if (this.config.requireVerification && !user.isVerified) {
          res.status(401).json({
            error: 'Email chưa được xác thực',
            message: 'Vui lòng xác thực email trước khi truy cập tài nguyên này.',
            code: AuthErrorCodes.EMAIL_NOT_VERIFIED,
            action: 'VERIFY_EMAIL'
          });
          return;
        }
      } else {
        // Use basic user info from token
        user = {
          id: decoded.userId,
          email: '', // Not available in token
          plan: decoded.plan || 'FREE',
          isVerified: true // Assume verified if no verification check
        };
      }

      // Attach user to request
      req.user = user;
      next();

    } catch (error: any) {
      this.handleAuthError(error, res);
    }
  };

  /**
   * Middleware to require specific subscription plans
   */
  requirePlan = (requiredPlans: string | string[]) => {
    const plans = Array.isArray(requiredPlans) ? requiredPlans : [requiredPlans];
    
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          error: 'Chưa xác thực',
          message: 'Vui lòng đăng nhập để truy cập tài nguyên này.',
          code: AuthErrorCodes.UNAUTHORIZED
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

  /**
   * Optional authentication - doesn't fail if no token
   */
  optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        return next();
      }

      const token = this.jwtUtils.extractTokenFromHeader(authHeader);
      const decoded = this.jwtUtils.verifyToken(token, 'access');

      // Get user details if function is provided
      if (this.config.getUserById) {
        const user = await this.config.getUserById(decoded.userId);
        if (user && (!this.config.requireVerification || user.isVerified)) {
          req.user = user;
        }
      } else {
        req.user = {
          id: decoded.userId,
          email: '',
          plan: decoded.plan || 'FREE',
          isVerified: true
        };
      }

      next();

    } catch (error) {
      // For optional auth, we don't return errors
      next();
    }
  };

  /**
   * Refresh token middleware
   */
  refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(401).json({
          error: 'Refresh token không được cung cấp',
          message: 'Vui lòng đăng nhập lại.',
          code: AuthErrorCodes.TOKEN_MISSING
        });
        return;
      }

      // Verify refresh token
      const decoded = this.jwtUtils.verifyToken(refreshToken, 'refresh');

      // Get user details
      if (!this.config.getUserById) {
        res.status(500).json({
          error: 'Cấu hình không đúng',
          message: 'Không thể refresh token. Vui lòng đăng nhập lại.'
        });
        return;
      }

      const user = await this.config.getUserById(decoded.userId);
      
      if (!user) {
        res.status(401).json({
          error: 'Người dùng không tồn tại',
          message: 'Tài khoản đã bị xóa hoặc không hợp lệ.',
          code: AuthErrorCodes.USER_NOT_FOUND
        });
        return;
      }

      // Generate new access token
      const newAccessToken = this.jwtUtils.generateAccessToken(user.id, user.plan);

      res.json({
        accessToken: newAccessToken,
        user: {
          id: user.id,
          email: user.email,
          plan: user.plan
        }
      });

    } catch (error: any) {
      this.handleAuthError(error, res);
    }
  };

  /**
   * Check if route should skip authentication
   */
  private shouldSkipAuth(path: string): boolean {
    if (!this.config.skipRoutes) return false;
    
    return this.config.skipRoutes.some(route => {
      if (route.includes('*')) {
        const pattern = route.replace(/\*/g, '.*');
        return new RegExp(`^${pattern}$`).test(path);
      }
      return path === route;
    });
  }

  /**
   * Handle authentication errors
   */
  private handleAuthError(error: any, res: Response): void {
    console.error('Authentication error:', error);

    if (error.code === AuthErrorCodes.TOKEN_EXPIRED) {
      res.status(401).json({
        error: 'Token đã hết hạn',
        message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
        code: AuthErrorCodes.TOKEN_EXPIRED,
        action: 'REFRESH_TOKEN'
      });
      return;
    }

    if (error.code === AuthErrorCodes.INVALID_TOKEN) {
      res.status(401).json({
        error: 'Token không hợp lệ',
        message: 'Token xác thực không đúng định dạng.',
        code: AuthErrorCodes.INVALID_TOKEN
      });
      return;
    }

    if (error.code === AuthErrorCodes.TOKEN_MISSING) {
      res.status(401).json({
        error: 'Token không được cung cấp',
        message: 'Vui lòng đăng nhập để truy cập tài nguyên này.',
        code: AuthErrorCodes.TOKEN_MISSING
      });
      return;
    }

    // Default error
    res.status(500).json({
      error: 'Lỗi xác thực',
      message: 'Đã xảy ra lỗi khi xác thực. Vui lòng thử lại sau.'
    });
  }
}

/**
 * Create auth middleware instance
 */
export function createAuthMiddleware(config: AuthMiddlewareConfig = {}): AuthMiddleware {
  return new AuthMiddleware(config);
}

/**
 * Quick middleware functions for common use cases
 */
export const quickAuth = {
  /**
   * Basic JWT authentication
   */
  jwt: (config?: AuthMiddlewareConfig) => {
    const middleware = createAuthMiddleware(config);
    return middleware.authenticate;
  },

  /**
   * Optional authentication
   */
  optional: (config?: AuthMiddlewareConfig) => {
    const middleware = createAuthMiddleware(config);
    return middleware.optionalAuth;
  },

  /**
   * Require specific plan
   */
  requirePlan: (plans: string | string[], config?: AuthMiddlewareConfig) => {
    const middleware = createAuthMiddleware(config);
    return [middleware.authenticate, middleware.requirePlan(plans)];
  }
}; 