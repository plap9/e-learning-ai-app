import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../utils/errors';

// Type-only import để tránh lỗi runtime
type ZodSchema = any; // Will be replaced with proper Zod schema

/**
 * Validation middleware for request validation using Zod
 * Follows comprehensive rules for input validation
 */
export const validateRequest = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Parse and validate request data
      const validationResult = schema.safeParse({
        body: req.body,
        query: req.query,
        params: req.params
      });

      if (!validationResult.success) {
        const errors = validationResult.error.errors.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));

        const errorMessage = errors.map((err: any) => `${err.field}: ${err.message}`).join(', ');
        
        throw new ValidationError(
          errorMessage,
          'VALIDATION_4000_REQUEST_VALIDATION_FAILED',
          'request',
          errors
        );
      }

      // Apply validated data back to request
      if (validationResult.data.body) {
        req.body = validationResult.data.body;
      }
      if (validationResult.data.query) {
        req.query = validationResult.data.query;
      }
      if (validationResult.data.params) {
        req.params = validationResult.data.params;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Simple validation functions for immediate use
 * These can be used until Zod schemas are fully implemented
 */
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Mật khẩu phải có ít nhất 8 ký tự');
  }
  
  if (!/(?=.*[a-z])/.test(password)) {
    errors.push('Mật khẩu phải có ít nhất 1 chữ thường');
  }
  
  if (!/(?=.*[A-Z])/.test(password)) {
    errors.push('Mật khẩu phải có ít nhất 1 chữ hoa');
  }
  
  if (!/(?=.*\d)/.test(password)) {
    errors.push('Mật khẩu phải có ít nhất 1 số');
  }
  
  if (!/(?=.*[@$!%*?&])/.test(password)) {
    errors.push('Mật khẩu phải có ít nhất 1 ký tự đặc biệt');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateName = (name: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!name || name.trim().length === 0) {
    errors.push('Tên không được để trống');
  }
  
  if (name.length > 50) {
    errors.push('Tên không được vượt quá 50 ký tự');
  }
  
  if (!/^[a-zA-ZÀ-ỹ\s]+$/.test(name)) {
    errors.push('Tên chỉ được chứa chữ cái và khoảng trắng');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Registration validation middleware
 */
export const validateRegistration = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const { email, password, confirmPassword, firstName, lastName } = req.body;
    const errors: string[] = [];

    // Validate required fields
    if (!email) errors.push('Email là bắt buộc');
    if (!password) errors.push('Mật khẩu là bắt buộc');
    if (!confirmPassword) errors.push('Xác nhận mật khẩu là bắt buộc');
    if (!firstName) errors.push('Tên là bắt buộc');
    if (!lastName) errors.push('Họ là bắt buộc');

    // Validate email format
    if (email && !validateEmail(email)) {
      errors.push('Định dạng email không hợp lệ');
    }

    // Validate password
    if (password) {
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        errors.push(...passwordValidation.errors);
      }
    }

    // Validate password confirmation
    if (password && confirmPassword && password !== confirmPassword) {
      errors.push('Mật khẩu xác nhận không trùng khớp');
    }

    // Validate names
    if (firstName) {
      const firstNameValidation = validateName(firstName);
      if (!firstNameValidation.isValid) {
        errors.push(...firstNameValidation.errors.map(err => `Tên: ${err}`));
      }
    }

    if (lastName) {
      const lastNameValidation = validateName(lastName);
      if (!lastNameValidation.isValid) {
        errors.push(...lastNameValidation.errors.map(err => `Họ: ${err}`));
      }
    }

    if (errors.length > 0) {
      throw new ValidationError(
        errors.join(', '),
        'VALIDATION_4001_REGISTRATION_VALIDATION_FAILED'
      );
    }

    // Sanitize input
    req.body.email = email.toLowerCase().trim();
    req.body.firstName = firstName.trim();
    req.body.lastName = lastName.trim();

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Login validation middleware
 */
export const validateLogin = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const { email, password } = req.body;
    const errors: string[] = [];

    if (!email) errors.push('Email là bắt buộc');
    if (!password) errors.push('Mật khẩu là bắt buộc');

    if (email && !validateEmail(email)) {
      errors.push('Định dạng email không hợp lệ');
    }

    if (errors.length > 0) {
      throw new ValidationError(
        errors.join(', '),
        'VALIDATION_4002_LOGIN_VALIDATION_FAILED'
      );
    }

    // Sanitize input
    req.body.email = email.toLowerCase().trim();

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Forgot password validation middleware
 */
export const validateForgotPassword = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const { email } = req.body;
    const errors: string[] = [];

    if (!email) errors.push('Email là bắt buộc');
    if (email && !validateEmail(email)) {
      errors.push('Định dạng email không hợp lệ');
    }

    if (errors.length > 0) {
      throw new ValidationError(
        errors.join(', '),
        'VALIDATION_4003_FORGOT_PASSWORD_VALIDATION_FAILED'
      );
    }

    // Sanitize input
    req.body.email = email.toLowerCase().trim();

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Reset password validation middleware
 */
export const validateResetPassword = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const { token, newPassword, confirmNewPassword } = req.body;
    const errors: string[] = [];

    if (!token) errors.push('Token là bắt buộc');
    if (!newPassword) errors.push('Mật khẩu mới là bắt buộc');
    if (!confirmNewPassword) errors.push('Xác nhận mật khẩu mới là bắt buộc');

    if (newPassword) {
      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        errors.push(...passwordValidation.errors);
      }
    }

    if (newPassword && confirmNewPassword && newPassword !== confirmNewPassword) {
      errors.push('Mật khẩu xác nhận không trùng khớp');
    }

    if (errors.length > 0) {
      throw new ValidationError(
        errors.join(', '),
        'VALIDATION_4004_RESET_PASSWORD_VALIDATION_FAILED'
      );
    }

    next();
  } catch (error) {
    next(error);
  }
}; 