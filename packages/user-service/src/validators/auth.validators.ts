import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../utils/errors';

// Common validation patterns
const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Base schemas
const emailSchema = Joi.string()
  .email({ tlds: { allow: false } })
  .pattern(emailPattern)
  .lowercase()
  .trim()
  .max(255)
  .required()
  .messages({
    'string.email': 'Email không đúng định dạng',
    'string.pattern.base': 'Email không đúng định dạng',
    'string.empty': 'Email không được để trống',
    'any.required': 'Email là bắt buộc',
    'string.max': 'Email không được quá 255 ký tự'
  });

const passwordSchema = Joi.string()
  .min(8)
  .max(128)
  .pattern(new RegExp('(?=.*[a-z])')) // lowercase
  .pattern(new RegExp('(?=.*[A-Z])')) // uppercase
  .pattern(new RegExp('(?=.*[0-9])')) // number
  .pattern(new RegExp('(?=.*[!@#$%^&*])')) // special character
  .required()
  .messages({
    'string.min': 'Mật khẩu phải có ít nhất 8 ký tự',
    'string.max': 'Mật khẩu không được quá 128 ký tự',
    'string.pattern.base': 'Mật khẩu phải chứa ít nhất 1 chữ hoa, 1 chữ thường, 1 số và 1 ký tự đặc biệt',
    'string.empty': 'Mật khẩu không được để trống',
    'any.required': 'Mật khẩu là bắt buộc'
  });

const nameSchema = Joi.string()
  .min(1)
  .max(50)
  .pattern(/^[a-zA-ZÀ-ỹ\s]+$/)
  .trim()
  .required()
  .messages({
    'string.min': 'Tên phải có ít nhất 1 ký tự',
    'string.max': 'Tên không được quá 50 ký tự',
    'string.pattern.base': 'Tên chỉ được chứa chữ cái và khoảng trắng',
    'string.empty': 'Tên không được để trống',
    'any.required': 'Tên là bắt buộc'
  });

// Registration validation schema
export const registerSchema = Joi.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: Joi.string()
    .valid(Joi.ref('password'))
    .required()
    .messages({
      'any.only': 'Mật khẩu xác nhận không khớp với mật khẩu',
      'any.required': 'Xác nhận mật khẩu là bắt buộc'
    }),
  firstName: nameSchema.messages({
    'any.required': 'Họ là bắt buộc',
    'string.empty': 'Họ không được để trống'
  }),
  lastName: nameSchema.messages({
    'any.required': 'Tên là bắt buộc',
    'string.empty': 'Tên không được để trống'
  }),
  acceptTerms: Joi.boolean()
    .valid(true)
    .required()
    .messages({
      'any.only': 'Bạn phải đồng ý với điều khoản sử dụng',
      'any.required': 'Bạn phải đồng ý với điều khoản sử dụng'
    })
});

// Login validation schema
export const loginSchema = Joi.object({
  email: emailSchema,
  password: Joi.string()
    .required()
    .messages({
      'string.empty': 'Mật khẩu không được để trống',
      'any.required': 'Mật khẩu là bắt buộc'
    }),
  rememberMe: Joi.boolean().default(false)
});

// Forgot password validation schema
export const forgotPasswordSchema = Joi.object({
  email: emailSchema
});

// Reset password validation schema
export const resetPasswordSchema = Joi.object({
  token: Joi.string()
    .required()
    .messages({
      'string.empty': 'Token không được để trống',
      'any.required': 'Token là bắt buộc'
    }),
  newPassword: passwordSchema,
  confirmNewPassword: Joi.string()
    .valid(Joi.ref('newPassword'))
    .required()
    .messages({
      'any.only': 'Mật khẩu xác nhận không khớp với mật khẩu mới',
      'any.required': 'Xác nhận mật khẩu mới là bắt buộc'
    })
});

// Change password validation schema
export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string()
    .required()
    .messages({
      'string.empty': 'Mật khẩu hiện tại không được để trống',
      'any.required': 'Mật khẩu hiện tại là bắt buộc'
    }),
  newPassword: passwordSchema,
  confirmNewPassword: Joi.string()
    .valid(Joi.ref('newPassword'))
    .required()
    .messages({
      'any.only': 'Mật khẩu xác nhận không khớp với mật khẩu mới',
      'any.required': 'Xác nhận mật khẩu mới là bắt buộc'
    })
});

// Verify email validation schema
export const verifyEmailSchema = Joi.object({
  token: Joi.string()
    .required()
    .messages({
      'string.empty': 'Token xác thực không được để trống',
      'any.required': 'Token xác thực là bắt buộc'
    })
});

// Resend verification email schema
export const resendVerificationSchema = Joi.object({
  email: emailSchema
});

// Update profile validation schema
export const updateProfileSchema = Joi.object({
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  phoneNumber: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Số điện thoại không đúng định dạng'
    }),
  dateOfBirth: Joi.date()
    .max('now')
    .optional()
    .messages({
      'date.max': 'Ngày sinh không được là tương lai'
    }),
  gender: Joi.string()
    .valid('MALE', 'FEMALE', 'OTHER')
    .optional(),
  language: Joi.string()
    .valid('vi', 'en')
    .optional(),
  timezone: Joi.string()
    .optional()
}).min(1).messages({
  'object.min': 'Phải có ít nhất một trường để cập nhật'
});

// Validation middleware factory
export const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true
    });

    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      const firstError = validationErrors[0];
      if (!firstError) {
        throw new ValidationError(
          'Validation failed',
          'VALIDATION_4000_GENERIC'
        );
      }

      throw new ValidationError(
        firstError.message,
        'VALIDATION_4000_GENERIC'
      );
    }

    req.body = value;
    next();
  };
};

// Query validation schemas
export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string().valid('createdAt', 'updatedAt', 'name', 'email').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

export const userSearchSchema = Joi.object({
  q: Joi.string().min(1).max(100).optional(),
  status: Joi.string().valid('active', 'inactive', 'verified', 'unverified').optional(),
  role: Joi.string().valid('user', 'admin', 'moderator').optional()
});

// Validate query parameters
export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true
    });

    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      const firstError = validationErrors[0];
      if (!firstError) {
        throw new ValidationError(
          'Query validation failed',
          'VALIDATION_4000_QUERY'
        );
      }

      throw new ValidationError(
        firstError.message,
        'VALIDATION_4000_QUERY'
      );
    }

    req.query = value;
    next();
  };
};

// Validate URL parameters
export const validateParams = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true
    });

    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      const firstError = validationErrors[0];
      if (!firstError) {
        throw new ValidationError(
          'Params validation failed',
          'VALIDATION_4000_PARAMS'
        );
      }

      throw new ValidationError(
        firstError.message,
        'VALIDATION_4000_PARAMS'
      );
    }

    req.params = value;
    next();
  };
};

// Common parameter schemas
export const idParamSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[a-zA-Z0-9_-]+$/)
    .required()
    .messages({
      'string.pattern.base': 'ID không đúng định dạng',
      'any.required': 'ID là bắt buộc'
    })
});

// File upload validation
export const avatarUploadSchema = Joi.object({
  mimetype: Joi.string()
    .valid('image/jpeg', 'image/png', 'image/webp')
    .required()
    .messages({
      'any.only': 'Chỉ chấp nhận file ảnh định dạng JPEG, PNG, WebP'
    }),
  size: Joi.number()
    .max(5 * 1024 * 1024) // 5MB
    .required()
    .messages({
      'number.max': 'File ảnh không được vượt quá 5MB'
    })
});

// Comprehensive validation helper
export const createValidationMiddleware = (options: {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
}) => {
  return [
    ...(options.params ? [validateParams(options.params)] : []),
    ...(options.query ? [validateQuery(options.query)] : []),
    ...(options.body ? [validateRequest(options.body)] : [])
  ];
};

// Custom validation functions
export const validateEmail = (email: string): boolean => {
  return emailPattern.test(email);
};

export const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Mật khẩu phải có ít nhất 8 ký tự');
  }
  
  if (!/(?=.*[a-z])/.test(password)) {
    errors.push('Mật khẩu phải chứa ít nhất 1 chữ cái thường');
  }
  
  if (!/(?=.*[A-Z])/.test(password)) {
    errors.push('Mật khẩu phải chứa ít nhất 1 chữ cái hoa');
  }
  
  if (!/(?=.*[0-9])/.test(password)) {
    errors.push('Mật khẩu phải chứa ít nhất 1 số');
  }
  
  if (!/(?=.*[!@#$%^&*])/.test(password)) {
    errors.push('Mật khẩu phải chứa ít nhất 1 ký tự đặc biệt');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Individual validation middleware functions for routes
export const validateRegistration = validateRequest(registerSchema);
export const validateLogin = validateRequest(loginSchema);
export const validateForgotPassword = validateRequest(forgotPasswordSchema);
export const validateResetPassword = validateRequest(resetPasswordSchema);
export const validateResendVerification = validateRequest(resendVerificationSchema);
export const validateChangePassword = validateRequest(changePasswordSchema);
export const validateVerifyEmail = validateRequest(verifyEmailSchema);
export const validateUpdateProfile = validateRequest(updateProfileSchema);

// Export all schemas for direct use
export {
  emailSchema,
  passwordSchema,
  nameSchema
};