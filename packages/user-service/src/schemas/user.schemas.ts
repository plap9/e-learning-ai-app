import { z } from 'zod';

/**
 * User ID validation schema
 */
const userIdSchema = z.string()
  .uuid('User ID phải là UUID hợp lệ');

/**
 * Profile validation schemas
 */
export const UpdateProfileSchema = z.object({
  body: z.object({
    firstName: z.string()
      .min(1, 'Tên không được để trống')
      .max(50, 'Tên không được vượt quá 50 ký tự')
      .regex(/^[a-zA-ZÀ-ỹ\s]+$/, 'Tên chỉ được chứa chữ cái và khoảng trắng')
      .trim()
      .optional(),
    lastName: z.string()
      .min(1, 'Họ không được để trống')
      .max(50, 'Họ không được vượt quá 50 ký tự')
      .regex(/^[a-zA-ZÀ-ỹ\s]+$/, 'Họ chỉ được chứa chữ cái và khoảng trắng')
      .trim()
      .optional(),
    bio: z.string()
      .max(500, 'Bio không được vượt quá 500 ký tự')
      .optional(),
    phoneNumber: z.string()
      .regex(/^(\+84|0)[3-9]\d{8}$/, 'Số điện thoại không hợp lệ')
      .optional(),
    dateOfBirth: z.string()
      .refine((date) => {
        const birthDate = new Date(date);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        return age >= 13 && age <= 120;
      }, 'Tuổi phải từ 13 đến 120')
      .optional(),
    address: z.object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zipCode: z.string().optional(),
      country: z.string().optional()
    }).optional()
  })
});

export type UpdateProfileRequest = z.infer<typeof UpdateProfileSchema>;

/**
 * User preferences validation schema
 */
export const UpdatePreferencesSchema = z.object({
  body: z.object({
    language: z.enum(['vi', 'en'], {
      errorMap: () => ({ message: 'Ngôn ngữ phải là "vi" hoặc "en"' })
    }).optional(),
    timezone: z.string()
      .regex(/^[A-Za-z_\/]+$/, 'Timezone không hợp lệ')
      .optional(),
    emailNotifications: z.object({
      marketing: z.boolean().optional(),
      updates: z.boolean().optional(),
      reminders: z.boolean().optional()
    }).optional(),
    pushNotifications: z.object({
      enabled: z.boolean().optional(),
      quiet_hours: z.object({
        start: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Định dạng giờ không hợp lệ').optional(),
        end: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Định dạng giờ không hợp lệ').optional()
      }).optional()
    }).optional(),
    privacy: z.object({
      profileVisibility: z.enum(['public', 'private', 'friends'], {
        errorMap: () => ({ message: 'Visibility phải là "public", "private" hoặc "friends"' })
      }).optional(),
      showEmail: z.boolean().optional(),
      showPhone: z.boolean().optional()
    }).optional()
  })
});

export type UpdatePreferencesRequest = z.infer<typeof UpdatePreferencesSchema>;

/**
 * User ID param validation
 */
export const UserIdSchema = z.object({
  params: z.object({
    id: userIdSchema
  })
});

export type UserIdRequest = z.infer<typeof UserIdSchema>;

/**
 * Helper validation functions to match old validators interface
 */
export const validateUserId = (req: any, res: any, next: any) => {
  try {
    UserIdSchema.parse({ params: req.params });
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: error.errors[0]?.message || 'Validation failed'
      });
    }
    next(error);
  }
};

export const validateUpdateProfile = (req: any, res: any, next: any) => {
  try {
    UpdateProfileSchema.parse({ body: req.body });
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: error.errors[0]?.message || 'Validation failed'
      });
    }
    next(error);
  }
};

export const validateUpdatePreferences = (req: any, res: any, next: any) => {
  try {
    UpdatePreferencesSchema.parse({ body: req.body });
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: error.errors[0]?.message || 'Validation failed'
      });
    }
    next(error);
  }
}; 