// Base error class for authentication and validation errors
export class BaseAuthError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly timestamp: string;

  constructor(
    message: string,
    statusCode: number = 400,
    errorCode: string = 'AUTH_ERROR'
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.timestamp = new Date().toISOString();

    // Maintains proper stack trace for where error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// Password related errors
export class PasswordsDoNotMatchError extends BaseAuthError {
  constructor() {
    super(
      'Mật khẩu và xác nhận mật khẩu không khớp',
      400,
      'AUTH_4010_PASSWORDS_DO_NOT_MATCH'
    );
  }
}

export class WeakPasswordError extends BaseAuthError {
  constructor(requirements: string[]) {
    super(
      `Mật khẩu không đủ mạnh. Yêu cầu: ${requirements.join(', ')}`,
      400,
      'AUTH_4011_WEAK_PASSWORD'
    );
  }
}

// Token related errors
export class InvalidTokenError extends BaseAuthError {
  constructor(message: string = 'Token không hợp lệ') {
    super(message, 401, 'AUTH_4012_INVALID_TOKEN');
  }
}

export class TokenExpiredError extends BaseAuthError {
  constructor(message: string = 'Token đã hết hạn') {
    super(message, 401, 'AUTH_4013_TOKEN_EXPIRED');
  }
}

export class InvalidRefreshTokenError extends BaseAuthError {
  constructor() {
    super(
      'Refresh token không hợp lệ hoặc đã hết hạn',
      401,
      'AUTH_4014_INVALID_REFRESH_TOKEN'
    );
  }
}

// User related errors
export class UserNotFoundError extends BaseAuthError {
  constructor() {
    super(
      'Người dùng không tồn tại',
      404,
      'AUTH_4015_USER_NOT_FOUND'
    );
  }
}

export class EmailAlreadyVerifiedError extends BaseAuthError {
  constructor() {
    super(
      'Email đã được xác thực trước đó',
      400,
      'AUTH_4016_EMAIL_ALREADY_VERIFIED'
    );
  }
}

// System errors
export class PasswordResetFailedError extends BaseAuthError {
  constructor(details?: Record<string, unknown>) {
    super(
      'Đặt lại mật khẩu thất bại',
      500,
      'AUTH_5017_PASSWORD_RESET_FAILED'
    );
    
    if (details) {
      (this as any).details = details;
    }
  }
}

export class EmailVerificationFailedError extends BaseAuthError {
  constructor(details?: Record<string, unknown>) {
    super(
      'Xác thực email thất bại',
      500,
      'AUTH_5018_EMAIL_VERIFICATION_FAILED'
    );
    
    if (details) {
      (this as any).details = details;
    }
  }
}

// Logout errors
export class LogoutFailedError extends BaseAuthError {
  constructor(details?: Record<string, unknown>) {
    super(
      'Đăng xuất thất bại',
      500,
      'AUTH_5019_LOGOUT_FAILED'
    );
    
    if (details) {
      (this as any).details = details;
    }
  }
}

// Type guard functions
export const isAuthError = (error: unknown): error is BaseAuthError => {
  return error instanceof BaseAuthError;
};

export const isTokenError = (error: unknown): boolean => {
  return error instanceof InvalidTokenError || 
         error instanceof TokenExpiredError ||
         error instanceof InvalidRefreshTokenError;
};

export const isPasswordError = (error: unknown): boolean => {
  return error instanceof PasswordsDoNotMatchError ||
         error instanceof WeakPasswordError;
}; 