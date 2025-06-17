import jwt from 'jsonwebtoken';

// JWT payload interfaces
export interface JWTPayload {
  userId: string;
  plan: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export interface AccessTokenPayload extends JWTPayload {
  type: 'access';
}

export interface RefreshTokenPayload extends JWTPayload {
  type: 'refresh';
}

// JWT signing options
interface JWTSignOptions {
  expiresIn?: string | number;
  issuer?: string;
  audience?: string;
}

/**
 * Type-safe JWT utilities
 */
export class JWTUtils {
  private static getSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    if (secret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long');
    }
    return secret;
  }

  /**
   * Sign a JWT token with proper typing
   */
  static sign(payload: Omit<JWTPayload, 'iat' | 'exp'>, options?: JWTSignOptions): string {
    const secret = this.getSecret();
    
    return jwt.sign(
      payload,
      secret,
      {
        expiresIn: options?.expiresIn || '15m',
        issuer: options?.issuer || 'e-learning-app',
        audience: options?.audience || 'e-learning-users',
        ...options
      }
    );
  }

  /**
   * Verify a JWT token with proper typing
   */
  static verify(token: string): JWTPayload {
    const secret = this.getSecret();
    
    try {
      const decoded = jwt.verify(token, secret) as JWTPayload;
      
      // Validate required fields
      if (!decoded.userId || !decoded.plan || !decoded.type) {
        throw new Error('Invalid token payload structure');
      }
      
      if (!['access', 'refresh'].includes(decoded.type)) {
        throw new Error(`Invalid token type: ${decoded.type}`);
      }
      
      return decoded;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw error; // Re-throw JWT errors as-is
      }
      throw new jwt.JsonWebTokenError(`Token verification failed: ${(error as Error).message}`);
    }
  }

  /**
   * Generate access token
   */
  static generateAccessToken(userId: string, plan: string): string {
    return this.sign(
      {
        userId,
        plan,
        type: 'access'
      },
      {
        expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m'
      }
    );
  }

  /**
   * Generate refresh token
   */
  static generateRefreshToken(userId: string, plan: string): string {
    return this.sign(
      {
        userId,
        plan,
        type: 'refresh'
      },
      {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
      }
    );
  }

  /**
   * Decode token without verification (for debugging)
   */
  static decode(token: string): JWTPayload | null {
    try {
      const decoded = jwt.decode(token) as JWTPayload;
      return decoded;
    } catch {
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  static isTokenExpired(token: string): boolean {
    try {
      const decoded = this.decode(token);
      if (!decoded || !decoded.exp) {
        return true;
      }
      
      const currentTime = Math.floor(Date.now() / 1000);
      return decoded.exp < currentTime;
    } catch {
      return true;
    }
  }

  /**
   * Get token expiration date
   */
  static getTokenExpiration(token: string): Date | null {
    try {
      const decoded = this.decode(token);
      if (!decoded || !decoded.exp) {
        return null;
      }
      
      return new Date(decoded.exp * 1000);
    } catch {
      return null;
    }
  }
}

export default JWTUtils; 