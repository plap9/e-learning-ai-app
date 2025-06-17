import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../utils/errors';

// Update profile validation schema
export const updateProfileSchema = Joi.object({
  firstName: Joi.string()
    .min(1)
    .max(50)
    .trim()
    .pattern(/^[a-zA-ZÀ-ỹ\s]+$/)
    .optional()
    .messages({
      'string.min': 'Tên phải có ít nhất 1 ký tự',
      'string.max': 'Tên không được quá 50 ký tự',
      'string.pattern.base': 'Tên chỉ được chứa chữ cái và khoảng trắng'
    }),
  lastName: Joi.string()
    .min(1)
    .max(50)
    .trim()
    .pattern(/^[a-zA-ZÀ-ỹ\s]+$/)
    .optional()
    .messages({
      'string.min': 'Họ phải có ít nhất 1 ký tự',
      'string.max': 'Họ không được quá 50 ký tự',
      'string.pattern.base': 'Họ chỉ được chứa chữ cái và khoảng trắng'
    }),
  avatar: Joi.string()
    .uri()
    .optional()
    .messages({
      'string.uri': 'Avatar phải là URL hợp lệ'
    }),
  dateOfBirth: Joi.date()
    .max('now')
    .optional()
    .messages({
      'date.max': 'Ngày sinh không được là tương lai'
    }),
  gender: Joi.string()
    .valid('MALE', 'FEMALE', 'OTHER')
    .optional()
    .messages({
      'any.only': 'Giới tính phải là MALE, FEMALE hoặc OTHER'
    }),
  phoneNumber: Joi.string()
    .pattern(/^\+?[\d\s\-()]+$/)
    .min(10)
    .max(15)
    .optional()
    .messages({
      'string.pattern.base': 'Số điện thoại không đúng định dạng',
      'string.min': 'Số điện thoại phải có ít nhất 10 số',
      'string.max': 'Số điện thoại không được quá 15 số'
    }),
  language: Joi.string()
    .valid('vi', 'en')
    .optional()
    .messages({
      'any.only': 'Ngôn ngữ phải là vi hoặc en'
    }),
  timezone: Joi.string()
    .optional()
    .messages({
      'string.base': 'Timezone phải là chuỗi hợp lệ'
    })
}).min(1).messages({
  'object.min': 'Phải có ít nhất một trường để cập nhật'
});

// Update preferences validation schema
export const updatePreferencesSchema = Joi.object({
  currentLevel: Joi.string()
    .valid('BEGINNER', 'INTERMEDIATE', 'ADVANCED')
    .optional()
    .messages({
      'any.only': 'Level hiện tại phải là BEGINNER, INTERMEDIATE hoặc ADVANCED'
    }),
  targetLevel: Joi.string()
    .valid('BEGINNER', 'INTERMEDIATE', 'ADVANCED')
    .optional()
    .messages({
      'any.only': 'Level mục tiêu phải là BEGINNER, INTERMEDIATE hoặc ADVANCED'
    }),
  learningGoals: Joi.array()
    .items(Joi.string().max(100))
    .max(10)
    .optional()
    .messages({
      'array.max': 'Không được có quá 10 mục tiêu học tập',
      'string.max': 'Mỗi mục tiêu không được quá 100 ký tự'
    }),
  interests: Joi.array()
    .items(Joi.string().max(50))
    .max(20)
    .optional()
    .messages({
      'array.max': 'Không được có quá 20 sở thích',
      'string.max': 'Mỗi sở thích không được quá 50 ký tự'
    }),
  preferredTopics: Joi.array()
    .items(Joi.string().max(50))
    .max(15)
    .optional()
    .messages({
      'array.max': 'Không được có quá 15 chủ đề ưa thích',
      'string.max': 'Mỗi chủ đề không được quá 50 ký tự'
    }),
  studyTimePerDay: Joi.number()
    .integer()
    .min(1)
    .max(1440) // 24 hours in minutes
    .optional()
    .messages({
      'number.min': 'Thời gian học mỗi ngày phải ít nhất 1 phút',
      'number.max': 'Thời gian học mỗi ngày không được quá 24 giờ'
    }),
  reminderTime: Joi.string()
    .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .optional()
    .messages({
      'string.pattern.base': 'Thời gian nhắc nhở phải có định dạng HH:MM'
    }),
  isPublic: Joi.boolean()
    .optional(),
  bio: Joi.string()
    .max(500)
    .optional()
    .messages({
      'string.max': 'Tiểu sử không được quá 500 ký tự'
    }),
  visualLearning: Joi.boolean().optional(),
  auditoryLearning: Joi.boolean().optional(),
  kinestheticLearning: Joi.boolean().optional(),
  weeklyGoalMinutes: Joi.number()
    .integer()
    .min(10)
    .max(10080) // 7 days * 24 hours * 60 minutes
    .optional()
    .messages({
      'number.min': 'Mục tiêu hàng tuần phải ít nhất 10 phút',
      'number.max': 'Mục tiêu hàng tuần không được quá 168 giờ'
    }),
  monthlyGoalMinutes: Joi.number()
    .integer()
    .min(40)
    .max(43200) // 30 days * 24 hours * 60 minutes
    .optional()
    .messages({
      'number.min': 'Mục tiêu hàng tháng phải ít nhất 40 phút',
      'number.max': 'Mục tiêu hàng tháng không được quá 720 giờ'
    })
}).min(1).messages({
  'object.min': 'Phải có ít nhất một trường để cập nhật'
});

// User ID parameter validation
export const userIdParamSchema = Joi.object({
  userId: Joi.string()
    .pattern(/^[a-zA-Z0-9_-]+$/)
    .required()
    .messages({
      'string.pattern.base': 'User ID không đúng định dạng',
      'any.required': 'User ID là bắt buộc'
    })
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

// Individual validation middleware functions
export const validateUpdateProfile = validateRequest(updateProfileSchema);
export const validateUpdatePreferences = validateRequest(updatePreferencesSchema);
export const validateUserId = validateParams(userIdParamSchema);

// Schema objects are already exported above 