// Base Error Class
export abstract class BaseError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly isOperational: boolean;
  public readonly context?: any;
  public readonly timestamp: string;

  constructor(
    message: string,
    statusCode: number,
    errorCode: string,
    isOperational = true,
    context?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;
    this.context = context;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }
}

// Authentication Domain Errors (2xxx series)
export class AuthenticationError extends BaseError {
  constructor(message: string, errorCode: string, context?: any) {
    super(message, 401, errorCode, true, context);
  }
}

export class AuthorizationError extends BaseError {
  constructor(message: string, errorCode: string, context?: any) {
    super(message, 403, errorCode, true, context);
  }
}

// Validation Domain Errors (4xxx series)
export class ValidationError extends BaseError {
  constructor(message: string, errorCode: string, field?: string, value?: any) {
    super(message, 400, errorCode, true, { field, value });
  }
}

// Business Logic Domain Errors (5xxx series)
export class BusinessLogicError extends BaseError {
  constructor(message: string, errorCode: string, context?: any) {
    super(message, 422, errorCode, true, context);
  }
}

// System Errors (1xxx series)
export class SystemError extends BaseError {
  constructor(message: string, errorCode: string, context?: any) {
    super(message, 500, errorCode, false, context);
  }
}

// External Service Errors (9xxx series)
export class ExternalServiceError extends BaseError {
  constructor(message: string, errorCode: string, service: string, context?: any) {
    super(message, 503, errorCode, true, { service, ...context });
  }
}

// Specific Authentication Errors
export class InvalidCredentialsError extends AuthenticationError {
  constructor(email?: string) {
    super(
      'Email hoặc mật khẩu không đúng',
      'AUTH_2001_INVALID_CREDENTIALS',
      { email: email ? email.replace(/(?<=.{2}).(?=.*@)/g, '*') : undefined }
    );
  }
}

export class EmailNotVerifiedError extends AuthenticationError {
  constructor(email: string) {
    super(
      'Email chưa được xác thực. Vui lòng kiểm tra email và xác thực tài khoản',
      'AUTH_2002_EMAIL_NOT_VERIFIED',
      { email: email.replace(/(?<=.{2}).(?=.*@)/g, '*') }
    );
  }
}

export class TokenExpiredError extends AuthenticationError {
  constructor(tokenType: string) {
    super(
      'Token đã hết hạn',
      'AUTH_2003_TOKEN_EXPIRED',
      { tokenType }
    );
  }
}

export class InvalidTokenError extends AuthenticationError {
  constructor(tokenType: string) {
    super(
      'Token không hợp lệ',
      'AUTH_2004_INVALID_TOKEN',
      { tokenType }
    );
  }
}

// Specific Validation Errors
export class EmailAlreadyExistsError extends ValidationError {
  constructor(email: string) {
    super(
      'Email đã được sử dụng để đăng ký tài khoản khác',
      'VALIDATION_4001_EMAIL_EXISTS',
      'email',
      email.replace(/(?<=.{2}).(?=.*@)/g, '*')
    );
  }
}

export class InvalidEmailFormatError extends ValidationError {
  constructor(email: string) {
    super(
      'Định dạng email không hợp lệ',
      'VALIDATION_4002_INVALID_EMAIL',
      'email',
      email
    );
  }
}

export class PasswordTooShortError extends ValidationError {
  constructor(minLength: number = 8) {
    super(
      `Mật khẩu phải có ít nhất ${minLength} ký tự`,
      'VALIDATION_4003_PASSWORD_TOO_SHORT',
      'password',
      `Minimum length: ${minLength}`
    );
  }
}

export class PasswordMissingRequirementsError extends ValidationError {
  constructor(missing: string[]) {
    super(
      `Mật khẩu thiếu: ${missing.join(', ')}`,
      'VALIDATION_4004_PASSWORD_REQUIREMENTS',
      'password',
      missing
    );
  }
}

export class PasswordsDoNotMatchError extends ValidationError {
  constructor() {
    super(
      'Mật khẩu xác nhận không trùng với mật khẩu đã nhập',
      'VALIDATION_4005_PASSWORDS_MISMATCH',
      'confirmPassword'
    );
  }
}

export class MissingRequiredFieldsError extends ValidationError {
  constructor(fields: string[]) {
    super(
      `Thiếu thông tin bắt buộc: ${fields.join(', ')}`,
      'VALIDATION_4006_MISSING_FIELDS',
      'required',
      fields
    );
  }
}

// Specific Business Logic Errors
export class UserNotFoundError extends BusinessLogicError {
  constructor(identifier: string) {
    super(
      'Người dùng không tồn tại',
      'BUSINESS_5001_USER_NOT_FOUND',
      { identifier: identifier.replace(/(?<=.{2}).(?=.*@)/g, '*') }
    );
  }
}

export class UserAccountDeactivatedError extends BusinessLogicError {
  constructor(userId: string) {
    super(
      'Tài khoản đã bị vô hiệu hóa',
      'BUSINESS_5002_ACCOUNT_DEACTIVATED',
      { userId }
    );
  }
}

// Rate Limiting Error
export class RateLimitExceededError extends BaseError {
  constructor(limit: number, windowMs: number) {
    super(
      `Quá nhiều yêu cầu. Thử lại sau ${Math.ceil(windowMs / 1000)} giây`,
      429,
      'RATE_LIMIT_EXCEEDED',
      true,
      { limit, windowMs }
    );
  }
}

// Error Factory for consistent error creation
export class ErrorFactory {
  static createValidationError(field: string, value: any, requirement: string): ValidationError {
    return new ValidationError(
      `Giá trị không hợp lệ cho trường ${field}: ${requirement}`,
      'VALIDATION_4000_GENERIC',
      field,
      value
    );
  }

  static createAuthenticationError(reason: string): AuthenticationError {
    return new AuthenticationError(
      'Xác thực thất bại',
      'AUTH_2000_GENERIC',
      { reason }
    );
  }

  static createSystemError(operation: string, originalError?: Error): SystemError {
    return new SystemError(
      `Lỗi hệ thống khi thực hiện: ${operation}`,
      'SYSTEM_1000_GENERIC',
      {
        operation,
        originalError: originalError?.message,
        stack: originalError?.stack
      }
    );
  }
}

// Error type guards
export const isOperationalError = (error: Error): error is BaseError => {
  return error instanceof BaseError && error.isOperational;
};

export const isValidationError = (error: Error): error is ValidationError => {
  return error instanceof ValidationError;
};

export const isAuthenticationError = (error: Error): error is AuthenticationError => {
  return error instanceof AuthenticationError;
};

export const isSystemError = (error: Error): error is SystemError => {
  return error instanceof SystemError;
}; 