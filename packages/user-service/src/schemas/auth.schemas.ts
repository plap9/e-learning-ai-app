import { z } from 'zod';

/**
 * Authentication Validation Schemas
 * Following comprehensive-rules.md for proper input validation
 */

// Base email validation với custom message
const emailSchema = z
  .string({
    required_error: 'Email là bắt buộc',
    invalid_type_error: 'Email phải là chuỗi ký tự'
  })
  .email('Định dạng email không hợp lệ')
  .min(5, 'Email phải có ít nhất 5 ký tự')
  .max(100, 'Email không được vượt quá 100 ký tự')
  .toLowerCase()
  .trim();

// Strong password validation theo security requirements
const passwordSchema = z
  .string({
    required_error: 'Mật khẩu là bắt buộc',
    invalid_type_error: 'Mật khẩu phải là chuỗi ký tự'
  })
  .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
  .max(128, 'Mật khẩu không được vượt quá 128 ký tự')
  .regex(/^(?=.*[a-z])/, 'Mật khẩu phải có ít nhất 1 chữ thường')
  .regex(/^(?=.*[A-Z])/, 'Mật khẩu phải có ít nhất 1 chữ hoa')
  .regex(/^(?=.*\d)/, 'Mật khẩu phải có ít nhất 1 số')
  .regex(/^(?=.*[@$!%*?&])/, 'Mật khẩu phải có ít nhất 1 ký tự đặc biệt (@$!%*?&)');

// Name validation với Vietnamese character support
const nameSchema = z
  .string({
    required_error: 'Tên là bắt buộc',
    invalid_type_error: 'Tên phải là chuỗi ký tự'
  })
  .min(1, 'Tên không được để trống')
  .max(50, 'Tên không được vượt quá 50 ký tự')
  .regex(/^[a-zA-ZÀ-ỹ\s]+$/, 'Tên chỉ được chứa chữ cái và khoảng trắng')
  .trim();

// Token validation
const tokenSchema = z
  .string({
    required_error: 'Token là bắt buộc',
    invalid_type_error: 'Token phải là chuỗi ký tự'
  })
  .min(32, 'Token không hợp lệ')
  .max(1024, 'Token quá dài')
  .trim();

/**
 * Registration Schema
 * Validates user registration input with comprehensive rules
 */
export const RegisterUserSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string({
      required_error: 'Xác nhận mật khẩu là bắt buộc'
    }),
    firstName: nameSchema,
    lastName: nameSchema
  }).refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không trùng khớp',
    path: ['confirmPassword']
  })
});

/**
 * Login Schema
 * Validates user login credentials
 */
export const LoginUserSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: z.string({
      required_error: 'Mật khẩu là bắt buộc',
      invalid_type_error: 'Mật khẩu phải là chuỗi ký tự'
    }).min(1, 'Mật khẩu không được để trống')
  })
});

/**
 * Forgot Password Schema
 * Validates email for password reset request
 */
export const ForgotPasswordSchema = z.object({
  body: z.object({
    email: emailSchema
  })
});

/**
 * Reset Password Schema
 * Validates password reset with token
 */
export const ResetPasswordSchema = z.object({
  body: z.object({
    token: tokenSchema,
    newPassword: passwordSchema,
    confirmNewPassword: z.string({
      required_error: 'Xác nhận mật khẩu mới là bắt buộc'
    })
  }).refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'Mật khẩu xác nhận không trùng khớp',
    path: ['confirmNewPassword']
  })
});

/**
 * Email Verification Schema
 * Validates email verification token
 */
export const VerifyEmailSchema = z.object({
  body: z.object({
    token: tokenSchema
  })
});

/**
 * Resend Verification Email Schema
 * Validates email for resending verification
 */
export const ResendVerificationSchema = z.object({
  body: z.object({
    email: emailSchema
  })
});

/**
 * Logout Schema
 * Validates logout request with optional refresh token
 */
export const LogoutSchema = z.object({
  body: z.object({
    refreshToken: z.string().optional()
  })
});

/**
 * Query Parameter Schemas
 */
export const AuthQuerySchema = z.object({
  query: z.object({
    sendWelcomeEmail: z
      .string()
      .optional()
      .transform(val => val === 'true'),
    returnUrl: z
      .string()
      .url('Return URL phải là URL hợp lệ')
      .optional(),
    source: z
      .enum(['web', 'mobile', 'api'])
      .optional()
      .default('web')
  }).optional()
});

/**
 * Request Headers Schema
 */
export const AuthHeadersSchema = z.object({
  headers: z.object({
    'user-agent': z.string().optional(),
    'x-forwarded-for': z.string().optional(),
    'x-real-ip': z.string().optional(),
    'accept-language': z.string().optional(),
    'x-request-id': z.string().uuid().optional()
  }).optional()
});

/**
 * Type exports for TypeScript integration
 */
export type RegisterUserRequest = z.infer<typeof RegisterUserSchema>;
export type LoginUserRequest = z.infer<typeof LoginUserSchema>;
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordRequest = z.infer<typeof ResetPasswordSchema>;
export type VerifyEmailRequest = z.infer<typeof VerifyEmailSchema>;
export type ResendVerificationRequest = z.infer<typeof ResendVerificationSchema>;
export type LogoutRequest = z.infer<typeof LogoutSchema>;

/**
 * Combined schemas for complex validation scenarios
 */
export const RegisterWithQuerySchema = RegisterUserSchema.merge(AuthQuerySchema);
export const LoginWithQuerySchema = LoginUserSchema.merge(AuthQuerySchema);

/**
 * Schema validation utilities
 */
export const validateAuthRequest = <T extends z.ZodSchema>(schema: T) => {
  return (data: unknown): z.infer<T> => {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));
        throw new Error(`Validation failed: ${formattedErrors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  };
};

/**
 * Custom validation refinements
 */
export const emailDomainRefinement = (allowedDomains: string[]) => {
  return (email: string) => {
    const domain = email.split('@')[1];
    return domain ? allowedDomains.includes(domain) : false;
  };
};

export const passwordStrengthRefinement = (password: string) => {
  const score = [
    /[a-z]/.test(password), // lowercase
    /[A-Z]/.test(password), // uppercase  
    /\d/.test(password),    // digit
    /[@$!%*?&]/.test(password), // special char
    password.length >= 12   // length bonus
  ].filter(Boolean).length;
  
  return score >= 4; // Require at least 4 criteria
}; 