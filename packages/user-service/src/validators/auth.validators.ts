import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';

// Helper function to handle validation results
const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      error: 'Dữ liệu không hợp lệ',
      message: 'Vui lòng kiểm tra lại thông tin đã nhập.',
      details: errors.array().map(error => ({
        field: error.type === 'field' ? (error as any).path : 'unknown',
        message: error.msg
      }))
    });
    return;
  }
  next();
};

// Registration validation
export const validateRegistration = [
  body('email')
    .isEmail()
    .withMessage('Email không hợp lệ')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Mật khẩu phải có ít nhất 8 ký tự')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Mật khẩu phải chứa ít nhất một chữ thường, một chữ hoa và một số'),
  
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Mật khẩu xác nhận không khớp');
      }
      return true;
    }),
  
  body('firstName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Tên phải có từ 1-50 ký tự')
    .matches(/^[a-zA-ZÀ-ỹ\s]+$/)
    .withMessage('Tên chỉ được chứa chữ cái và khoảng trắng'),
  
  body('lastName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Họ phải có từ 1-50 ký tự')
    .matches(/^[a-zA-ZÀ-ỹ\s]+$/)
    .withMessage('Họ chỉ được chứa chữ cái và khoảng trắng'),
  
  handleValidationErrors
];

// Login validation
export const validateLogin = [
  body('email')
    .isEmail()
    .withMessage('Email không hợp lệ')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('Mật khẩu không được để trống'),
  
  handleValidationErrors
];

// Forgot password validation
export const validateForgotPassword = [
  body('email')
    .isEmail()
    .withMessage('Email không hợp lệ')
    .normalizeEmail(),
  
  handleValidationErrors
];

// Reset password validation
export const validateResetPassword = [
  body('token')
    .notEmpty()
    .withMessage('Token không được để trống'),
  
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Mật khẩu mới phải có ít nhất 8 ký tự')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Mật khẩu mới phải chứa ít nhất một chữ thường, một chữ hoa và một số'),
  
  body('confirmNewPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Mật khẩu xác nhận không khớp');
      }
      return true;
    }),
  
  handleValidationErrors
];

// Resend verification email validation
export const validateResendVerification = [
  body('email')
    .isEmail()
    .withMessage('Email không hợp lệ')
    .normalizeEmail(),
  
  handleValidationErrors
]; 