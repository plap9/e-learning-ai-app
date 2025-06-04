import jwt from 'jsonwebtoken';
import { JWTPayload, TokenPair, AuthConfig, AuthError, AuthErrorCodes } from './types';

export class JWTUtils {
  private config: AuthConfig;

  constructor(config: AuthConfig) {
    this.config = config;
  }

  /**
   * Generate access token
   */
  generateAccessToken(userId: string, plan: string): string {
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId,
      plan,
      type: 'access'
    };

    return jwt.sign(payload, this.config.jwtSecret, {
      expiresIn: this.config.accessTokenExpiry
    } as jwt.SignOptions);
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(userId: string): string {
    const payload: Omit<JWTPayload, 'iat' | 'exp' | 'plan'> = {
      userId,
      type: 'refresh'
    };

    return jwt.sign(payload, this.config.jwtSecret, {
      expiresIn: this.config.refreshTokenExpiry
    } as jwt.SignOptions);
  }

  /**
   * Generate both access and refresh tokens
   */
  generateTokenPair(userId: string, plan: string): TokenPair {
    return {
      accessToken: this.generateAccessToken(userId, plan),
      refreshToken: this.generateRefreshToken(userId)
    };
  }

  /**
   * Verify and decode JWT token
   */
  verifyToken(token: string, expectedType?: 'access' | 'refresh'): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret) as JWTPayload;
      
      if (expectedType && decoded.type !== expectedType) {
        throw this.createAuthError(
          AuthErrorCodes.INVALID_TOKEN,
          `Expected ${expectedType} token but received ${decoded.type} token`,
          401
        );
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw this.createAuthError(
          AuthErrorCodes.TOKEN_EXPIRED,
          'Token đã hết hạn',
          401
        );
      }

      if (error instanceof jwt.JsonWebTokenError) {
        throw this.createAuthError(
          AuthErrorCodes.INVALID_TOKEN,
          'Token không hợp lệ',
          401
        );
      }

      throw error;
    }
  }

  /**
   * Extract token from Authorization header
   */
  extractTokenFromHeader(authHeader: string | undefined): string {
    if (!authHeader) {
      throw this.createAuthError(
        AuthErrorCodes.TOKEN_MISSING,
        'Authorization header không được cung cấp',
        401
      );
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
      throw this.createAuthError(
        AuthErrorCodes.INVALID_TOKEN,
        'Authorization header format không đúng. Expected: Bearer <token>',
        401
      );
    }

    return parts[1];
  }

  /**
   * Get token expiry time
   */
  getTokenExpiry(token: string): Date {
    const decoded = this.verifyToken(token);
    if (!decoded.exp) {
      throw new Error('Token không có thông tin expiry');
    }
    return new Date(decoded.exp * 1000);
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    try {
      const expiry = this.getTokenExpiry(token);
      return expiry < new Date();
    } catch {
      return true;
    }
  }

  /**
   * Get remaining time before token expires (in seconds)
   */
  getTokenRemainingTime(token: string): number {
    try {
      const expiry = this.getTokenExpiry(token);
      const now = new Date();
      return Math.max(0, Math.floor((expiry.getTime() - now.getTime()) / 1000));
    } catch {
      return 0;
    }
  }

  /**
   * Create standardized auth error
   */
  private createAuthError(code: AuthErrorCodes, message: string, statusCode: number): AuthError {
    const error = new Error(message) as unknown as AuthError;
    error.code = code;
    error.message = message;
    error.statusCode = statusCode;
    return error;
  }
}

/**
 * Create JWT utilities instance with default config
 */
export function createJWTUtils(config?: Partial<AuthConfig>): JWTUtils {
  const defaultConfig: AuthConfig = {
    jwtSecret: process.env.JWT_SECRET || 'fallback-secret-key',
    accessTokenExpiry: process.env.JWT_EXPIRES_IN || '15m',
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12')
  };

  return new JWTUtils({ ...defaultConfig, ...config });
} 