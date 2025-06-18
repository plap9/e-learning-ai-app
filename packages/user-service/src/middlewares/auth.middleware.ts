import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authConfig } from '../config/auth.config';
import { ErrorHandler } from './error.middleware';
import { appLogger as logger } from '../utils/logger';
import { AuthenticationError } from '../exceptions';
import { setContextUserId, getRequestContext } from './request-context.middleware';
import { AuthRequest, UserPayload, RequestContext } from '../types/express';
import { JWTUtils } from '../utils/jwt.utils';
import type { JWTPayload } from '../utils/jwt.utils';

const prisma = new PrismaClient();

export const authenticateToken = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
  const authReq = req as AuthRequest;
  
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    // Enhanced security logging for token access attempts
    logger.logSecurity('Token authentication attempt', 'low', {
      hasToken: !!token,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: authReq.context?.requestId || 'unknown',
      url: req.originalUrl,
      method: req.method
    });

    if (!token) {
      const error = new AuthenticationError(
        'Token không được cung cấp',
        'AUTH_4001_MISSING_TOKEN'
      );
      
      return ErrorHandler.handleAuthenticationError(error, authReq, res);
    }

    // Verify JWT token
    const decoded = JWTUtils.verify(token);

    // Check if token is access token
    if (decoded.type !== 'access') {
      const error = new AuthenticationError(
        'Vui lòng sử dụng access token',
        'AUTH_4002_INVALID_TOKEN_TYPE'
      );
      
      logger.logSecurity('Invalid token type used', 'medium', {
        tokenType: decoded.type,
        expectedType: 'access',
        userId: decoded.userId,
        ip: req.ip,
        requestId: authReq.context?.requestId || 'unknown'
      });
      
      return ErrorHandler.handleAuthenticationError(error, authReq, res);
    }

    // Check if user still exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isVerified: true,
        subscriptions: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { plan: true }
        }
      }
    });

    if (!user) {
      const error = new AuthenticationError(
        'Tài khoản đã bị xóa hoặc không hợp lệ',
        'AUTH_4003_USER_NOT_FOUND'
      );
      
      logger.logSecurity('Token user not found', 'high', {
        userId: decoded.userId,
        ip: req.ip,
        requestId: authReq.context?.requestId || 'unknown'
      });
      
      return ErrorHandler.handleAuthenticationError(error, authReq, res);
    }

    // Optional: Check if email is verified
    if (!user.isVerified) {
      const error = new AuthenticationError(
        'Vui lòng xác thực email trước khi truy cập tài nguyên này',
        'AUTH_4004_EMAIL_NOT_VERIFIED'
      );
      
      logger.logSecurity('Unverified user attempted access', 'medium', {
        userId: decoded.userId,
        email: user.email.replace(authConfig.EMAIL_MASK_REGEX, '*'),
        ip: req.ip,
        requestId: authReq.context?.requestId || 'unknown'
      });
      
      return ErrorHandler.handleAuthenticationError(error, authReq, res);
    }

    // Add user info to request
    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isVerified: user.isVerified,
      plan: user.subscriptions[0]?.plan || 'FREE'
    };

    // Update request context with user info
    setContextUserId(authReq, user.id);

    // Log successful authentication
    logger.logSecurity('Token authentication successful', 'low', {
      userId: user.id,
      plan: user.subscriptions[0]?.plan || 'FREE',
      ip: req.ip,
      requestId: authReq.context?.requestId || 'unknown'
    });

    next();
  } catch (error: any) {
    logger.error('Auth middleware error', {
      error: error.message,
      stack: error.stack,
      ip: req.ip,
      requestId: authReq.context?.requestId || 'unknown'
    });

    if (error.name === 'JsonWebTokenError') {
      const authError = new AuthenticationError(
        'Token đã bị thay đổi hoặc không đúng định dạng',
        'AUTH_4005_INVALID_TOKEN_FORMAT'
      );
      
      logger.logSecurity('Invalid JWT token format', 'high', {
        error: error.message,
        ip: req.ip,
        requestId: authReq.context?.requestId || 'unknown'
      });
      
      return ErrorHandler.handleAuthenticationError(authError, authReq, res);
    }

    if (error.name === 'TokenExpiredError') {
      const authError = new AuthenticationError(
        'Vui lòng đăng nhập lại để tiếp tục',
        'AUTH_4006_TOKEN_EXPIRED'
      );
      
      logger.logSecurity('Expired token used', 'medium', {
        expiredAt: error.expiredAt,
        ip: req.ip,
        requestId: authReq.context?.requestId || 'unknown'
      });
      
      return ErrorHandler.handleAuthenticationError(authError, authReq, res);
    }

    // For other errors, use generic error handler
    return ErrorHandler.handleGenericError(error, authReq, res);
  }
};

// Middleware to check subscription plan
export const requirePlan = (requiredPlan: 'FREE' | 'BASIC' | 'PREMIUM' | 'ENTERPRISE') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Chưa xác thực',
        message: 'Vui lòng đăng nhập trước.'
      });
      return;
    }

    const planHierarchy = {
      'FREE': 0,
      'BASIC': 1,
      'PREMIUM': 2,
      'ENTERPRISE': 3
    };

    const userPlanLevel = planHierarchy[req.user.plan as keyof typeof planHierarchy] || 0;
    const requiredPlanLevel = planHierarchy[requiredPlan];

    if (userPlanLevel < requiredPlanLevel) {
      res.status(403).json({
        error: 'Gói dịch vụ không đủ',
        message: `Tính năng này yêu cầu gói ${requiredPlan} trở lên. Gói hiện tại của bạn: ${req.user.plan}`,
        action: 'UPGRADE_PLAN',
        currentPlan: req.user.plan,
        requiredPlan
      });
      return;
    }

    next();
  };
};

// Middleware to refresh JWT token
export const refreshToken = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(401).json({
        error: 'Refresh token không được cung cấp',
        message: 'Vui lòng đăng nhập lại.'
      });
      return;
    }

    // Verify refresh token
    const decoded = JWTUtils.verify(refreshToken);

    if (decoded.type !== 'refresh') {
      res.status(401).json({
        error: 'Token không hợp lệ',
        message: 'Vui lòng sử dụng refresh token.'
      });
      return;
    }

    // Check if refresh token exists in database
    const session = await prisma.userSession.findFirst({
      where: {
        userId: decoded.userId,
        token: refreshToken,
        expiresAt: { gt: new Date() }
      },
      include: {
        user: {
          include: {
            subscriptions: {
              where: { status: 'ACTIVE' },
              orderBy: { createdAt: 'desc' },
              take: 1
            }
          }
        }
      }
    });

    if (!session) {
      res.status(401).json({
        error: 'Refresh token không hợp lệ',
        message: 'Token đã hết hạn hoặc không tồn tại. Vui lòng đăng nhập lại.'
      });
      return;
    }

    // Generate new access token
    const accessTokenPayload = {
      userId: session.user.id,
      plan: session.user.subscriptions[0]?.plan || 'FREE',
      type: 'access'
    };

    const newAccessToken = JWTUtils.generateAccessToken(
      session.user.id, 
      session.user.subscriptions[0]?.plan || 'FREE'
    );

    res.status(200).json({
      accessToken: newAccessToken,
      user: {
        id: session.user.id,
        email: session.user.email,
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        currentPlan: session.user.subscriptions[0]?.plan || 'FREE'
      }
    });
  } catch (error: any) {
    const authReq = req as AuthRequest;
    
    logger.error('Refresh token error', { 
      error: error.message, 
      stack: error.stack,
      requestId: authReq.context?.requestId || 'unknown'
    });

    if (error.name === 'JsonWebTokenError') {
      const authError = new AuthenticationError(
        'Refresh token không hợp lệ',
        'AUTH_4015_INVALID_REFRESH_TOKEN'
      );
      return ErrorHandler.handleAuthenticationError(authError, authReq, res);
    }

    if (error.name === 'TokenExpiredError') {
      const authError = new AuthenticationError(
        'Refresh token đã hết hạn. Vui lòng đăng nhập lại',
        'AUTH_4016_REFRESH_TOKEN_EXPIRED'
      );
      return ErrorHandler.handleAuthenticationError(authError, authReq, res);
    }

    // Handle known custom errors
    if (error instanceof AuthenticationError) {
      return ErrorHandler.handleAuthenticationError(error, authReq, res);
    }

    // Handle unknown errors
    return ErrorHandler.handleGenericError(error, authReq, res);
  }
}; 