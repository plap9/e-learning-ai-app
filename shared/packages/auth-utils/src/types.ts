export interface JWTPayload {
  userId: string;
  plan: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export interface AuthUser {
  id: string;
  email: string;
  plan: string;
  isVerified: boolean;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthRequest {
  user?: AuthUser;
  headers: {
    authorization?: string;
    [key: string]: string | string[] | undefined;
  };
}

export interface AuthConfig {
  jwtSecret: string;
  accessTokenExpiry: string;
  refreshTokenExpiry: string;
  bcryptSaltRounds: number;
}

export interface PasswordValidation {
  isValid: boolean;
  errors: string[];
}

export interface AuthError {
  code: string;
  message: string;
  statusCode: number;
}

export enum AuthErrorCodes {
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_MISSING = 'TOKEN_MISSING',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  WEAK_PASSWORD = 'WEAK_PASSWORD',
  UNAUTHORIZED = 'UNAUTHORIZED'
}

export enum UserPlan {
  FREE = 'FREE',
  PREMIUM = 'PREMIUM', 
  ENTERPRISE = 'ENTERPRISE'
} 