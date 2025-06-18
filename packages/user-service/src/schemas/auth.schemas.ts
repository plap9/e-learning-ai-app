import { z } from 'zod';

/**
 * Password validation schema with comprehensive requirements
 */
const passwordSchema = z.string()
  .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
  .regex(/^(?=.*[a-z])/, 'Mật khẩu phải có ít nhất 1 chữ thường')
  .regex(/^(?=.*[A-Z])/, 'Mật khẩu phải có ít nhất 1 chữ hoa')
  .regex(/^(?=.*\d)/, 'Mật khẩu phải có ít nhất 1 số')
  .regex(/^(?=.*[@$!%*?&])/, 'Mật khẩu phải có ít nhất 1 ký tự đặc biệt');

/**
 * Email validation schema
 */
const emailSchema = z.string()
  .email('Định dạng email không hợp lệ')
  .toLowerCase()
  .trim();

/**
 * Name validation schema
 */
const nameSchema = z.string()
  .min(1, 'Tên không được để trống')
  .max(50, 'Tên không được vượt quá 50 ký tự')
  .regex(/^[a-zA-ZÀ-ỹ\s]+$/, 'Tên chỉ được chứa chữ cái và khoảng trắng')
  .trim();

/**
 * Registration schema
 */
export const RegisterSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    firstName: nameSchema,
    lastName: nameSchema
  }).refine((data: any) => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không trùng khớp',
    path: ['confirmPassword']
  })
});

export type RegisterRequest = z.infer<typeof RegisterSchema>;

/**
 * Login schema
 */
export const LoginSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: z.string().min(1, 'Mật khẩu không được để trống')
  })
});

export type LoginRequest = z.infer<typeof LoginSchema>;

/**
 * Forgot password schema
 */
export const ForgotPasswordSchema = z.object({
  body: z.object({
    email: emailSchema
  })
});

export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordSchema>;

/**
 * Reset password schema
 */
export const ResetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Token không được để trống'),
    newPassword: passwordSchema,
    confirmNewPassword: z.string()
  }).refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'Mật khẩu xác nhận không trùng khớp',
    path: ['confirmNewPassword']
  })
});

export type ResetPasswordRequest = z.infer<typeof ResetPasswordSchema>;

/**
 * Verify email schema
 */
export const VerifyEmailSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Token xác thực không được để trống')
  })
});

export type VerifyEmailRequest = z.infer<typeof VerifyEmailSchema>;

/**
 * Resend verification email schema
 */
export const ResendVerificationSchema = z.object({
  body: z.object({
    email: emailSchema
  })
});

export type ResendVerificationRequest = z.infer<typeof ResendVerificationSchema>;

/**
 * Refresh token schema
 */
export const RefreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token không được để trống')
  })
});

export type RefreshTokenRequest = z.infer<typeof RefreshTokenSchema>;

/**
 * Logout schema
 */
export const LogoutSchema = z.object({
  body: z.object({
    refreshToken: z.string().optional()
  })
});

export type LogoutRequest = z.infer<typeof LogoutSchema>;

/**
 * Change password schema (for authenticated users)
 */
export const ChangePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Mật khẩu hiện tại không được để trống'),
    newPassword: passwordSchema,
    confirmNewPassword: z.string()
  }).refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'Mật khẩu xác nhận không trùng khớp',
    path: ['confirmNewPassword']
  })
});

export type ChangePasswordRequest = z.infer<typeof ChangePasswordSchema>; 