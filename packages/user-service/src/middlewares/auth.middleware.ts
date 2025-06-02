import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface JWTPayload {
  userId: string;
  plan: string;
  type: string;
  iat?: number;
  exp?: number;
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        plan: string;
      };
    }
  }
}

export const authenticateToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        error: 'Token không được cung cấp',
        message: 'Vui lòng đăng nhập để truy cập tài nguyên này.'
      });
      return;
    }

    // Verify JWT token
    const secret = process.env.JWT_SECRET || 'fallback-secret-key';
    const decoded = jwt.verify(token, secret) as JWTPayload;

    // Check if token is access token
    if (decoded.type !== 'access') {
      res.status(401).json({
        error: 'Token không hợp lệ',
        message: 'Vui lòng sử dụng access token.'
      });
      return;
    }

    // Check if user still exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
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
      res.status(401).json({
        error: 'Người dùng không tồn tại',
        message: 'Tài khoản đã bị xóa hoặc không hợp lệ.'
      });
      return;
    }

    // Optional: Check if email is verified
    if (!user.isVerified) {
      res.status(401).json({
        error: 'Email chưa được xác thực',
        message: 'Vui lòng xác thực email trước khi truy cập tài nguyên này.',
        action: 'VERIFY_EMAIL'
      });
      return;
    }

    // Add user info to request
    req.user = {
      id: user.id,
      plan: user.subscriptions[0]?.plan || 'FREE'
    };

    next();
  } catch (error: any) {
    console.error('Auth middleware error:', error);

    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({
        error: 'Token không hợp lệ',
        message: 'Token đã bị thay đổi hoặc không đúng định dạng.'
      });
      return;
    }

    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        error: 'Token đã hết hạn',
        message: 'Vui lòng đăng nhập lại để tiếp tục.',
        action: 'REFRESH_TOKEN'
      });
      return;
    }

    res.status(500).json({
      error: 'Lỗi hệ thống',
      message: 'Đã xảy ra lỗi khi xác thực. Vui lòng thử lại sau.'
    });
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
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
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
    const secret = process.env.JWT_SECRET || 'fallback-secret-key';
    const decoded = jwt.verify(refreshToken, secret) as JWTPayload;

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

    const newAccessToken = (jwt.sign as any)(accessTokenPayload, secret, {
      expiresIn: process.env.JWT_EXPIRES_IN || '15m'
    });

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
    console.error('Refresh token error:', error);

    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      res.status(401).json({
        error: 'Refresh token không hợp lệ',
        message: 'Vui lòng đăng nhập lại.'
      });
      return;
    }

    res.status(500).json({
      error: 'Lỗi hệ thống',
      message: 'Đã xảy ra lỗi khi làm mới token.'
    });
  }
}; 