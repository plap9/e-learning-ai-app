import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { asyncHandler } from '../middlewares/error.middleware';
import { appLogger } from '../utils/logger';
import { 
  validateRequest,
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema
} from '../validators/auth.validators';

class AuthController {
  register = asyncHandler(async (req: Request, res: Response) => {
    const { email, password, confirmPassword, firstName, lastName } = req.body;
    const requestLogger = (req as any).logger;

    requestLogger.info('User registration attempt', {
      email: email?.replace(/(?<=.{2}).(?=.*@)/g, '*')
    });

    const result = await authService.registerUser({
      email,
      password,
      confirmPassword,
      firstName,
      lastName
    });

    requestLogger.info('User registration successful', {
      userId: result.userId,
      email: email.replace(/(?<=.{2}).(?=.*@)/g, '*')
    });

    return res.status(201).json({
      success: true,
      data: result,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id']
      }
    });
  });

  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          error: 'Thiếu thông tin đăng nhập',
          message: 'Vui lòng nhập email và mật khẩu.'
        });
      }

      const result = await authService.loginUser(email, password);

      return res.status(200).json(result);
    } catch (error: any) {
      console.error('Login error:', error);
      
      switch (error.message) {
        case 'INVALID_CREDENTIALS':
          return res.status(401).json({
            error: 'Thông tin đăng nhập không chính xác',
            message: 'Email hoặc mật khẩu không đúng.'
          });
        
        case 'EMAIL_NOT_VERIFIED':
          return res.status(401).json({
            error: 'Email chưa được xác thực',
            message: 'Vui lòng kiểm tra email và xác thực tài khoản trước khi đăng nhập.',
            action: 'VERIFY_EMAIL'
          });
        
        default:
          return res.status(500).json({
            error: 'Lỗi hệ thống',
            message: 'Đã xảy ra lỗi khi đăng nhập. Vui lòng thử lại sau.'
          });
      }
    }
  }

  async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          error: 'Thiếu địa chỉ email',
          message: 'Vui lòng nhập địa chỉ email.'
        });
      }

      const result = await authService.forgotPassword(email);

      return res.status(200).json(result);
    } catch (error: any) {
      console.error('Forgot password error:', error);
      
      return res.status(500).json({
        error: 'Lỗi hệ thống',
        message: 'Đã xảy ra lỗi khi xử lý yêu cầu. Vui lòng thử lại sau.'
      });
    }
  }

  async resetPassword(req: Request, res: Response) {
    try {
      const { token, newPassword, confirmNewPassword } = req.body;

      if (!token || !newPassword || !confirmNewPassword) {
        return res.status(400).json({
          error: 'Thiếu thông tin bắt buộc',
          message: 'Vui lòng cung cấp đầy đủ token, mật khẩu mới và xác nhận mật khẩu.'
        });
      }

      const result = await authService.resetPassword(token, newPassword, confirmNewPassword);

      return res.status(200).json(result);
    } catch (error: any) {
      console.error('Reset password error:', error);
      
      switch (error.message) {
        case 'PASSWORDS_DO_NOT_MATCH':
          return res.status(400).json({
            error: 'Mật khẩu không khớp',
            message: 'Mật khẩu xác nhận không trùng với mật khẩu mới.'
          });
        
        case 'INVALID_OR_EXPIRED_TOKEN':
          return res.status(400).json({
            error: 'Token không hợp lệ hoặc đã hết hạn',
            message: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu đặt lại mật khẩu mới.'
          });
        
        case 'PASSWORD_TOO_SHORT':
        case 'PASSWORD_MISSING_UPPERCASE':
        case 'PASSWORD_MISSING_LOWERCASE':
        case 'PASSWORD_MISSING_NUMBER':
          return res.status(400).json({
            error: 'Mật khẩu không đủ mạnh',
            message: 'Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường và số.'
          });
        
        default:
          return res.status(500).json({
            error: 'Lỗi hệ thống',
            message: 'Đã xảy ra lỗi khi đặt lại mật khẩu. Vui lòng thử lại sau.'
          });
      }
    }
  }

  async verifyEmail(req: Request, res: Response) {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({
          error: 'Token không hợp lệ',
          message: 'Token xác thực email không hợp lệ.'
        });
      }

      const result = await authService.verifyEmail(token);

      // For web interface, you might want to redirect to a success page
      // res.redirect('/email-verified?success=true');
      
      return res.status(200).json(result);
    } catch (error: any) {
      console.error('Email verification error:', error);
      
      switch (error.message) {
        case 'INVALID_OR_EXPIRED_TOKEN':
          return res.status(400).json({
            error: 'Token không hợp lệ hoặc đã hết hạn',
            message: 'Liên kết xác thực email không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu gửi lại email xác thực.'
          });
        
        default:
          return res.status(500).json({
            error: 'Lỗi hệ thống',
            message: 'Đã xảy ra lỗi khi xác thực email. Vui lòng thử lại sau.'
          });
      }
    }
  }

  async resendVerificationEmail(req: Request, res: Response) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          error: 'Thiếu địa chỉ email',
          message: 'Vui lòng nhập địa chỉ email.'
        });
      }

      const result = await authService.resendVerificationEmail(email);

      return res.status(200).json(result);
    } catch (error: any) {
      console.error('Resend verification email error:', error);
      
      switch (error.message) {
        case 'USER_NOT_FOUND':
          return res.status(404).json({
            error: 'Không tìm thấy người dùng',
            message: 'Không tìm thấy tài khoản với địa chỉ email này.'
          });
        
        case 'EMAIL_ALREADY_VERIFIED':
          return res.status(409).json({
            error: 'Email đã được xác thực',
            message: 'Tài khoản này đã được xác thực. Bạn có thể đăng nhập bình thường.'
          });
        
        default:
          return res.status(500).json({
            error: 'Lỗi hệ thống',
            message: 'Đã xảy ra lỗi khi gửi email xác thực. Vui lòng thử lại sau.'
          });
      }
    }
  }

  async logout(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        return res.status(401).json({
          error: 'Không có token xác thực',
          message: 'Vui lòng đăng nhập để thực hiện thao tác này.'
        });
      }

      // If refresh token is provided, invalidate it
      if (refreshToken) {
        await authService.logout(refreshToken);
      }

      return res.status(200).json({
        message: 'Đăng xuất thành công.'
      });
    } catch (error: any) {
      console.error('Logout error:', error);
      
      return res.status(500).json({
        error: 'Lỗi hệ thống',
        message: 'Đã xảy ra lỗi khi đăng xuất. Vui lòng thử lại sau.'
      });
    }
  }
}

export const authController = new AuthController(); 