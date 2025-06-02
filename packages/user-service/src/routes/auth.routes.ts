import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticateToken, requirePlan, refreshToken } from '../middlewares/auth.middleware';
import { validateRegistration, validateLogin, validateForgotPassword, validateResetPassword, validateResendVerification } from '../validators/auth.validators';

const router: Router = Router();

// Public authentication routes
router.post('/register', validateRegistration, authController.register);
router.post('/login', validateLogin, authController.login);
router.post('/forgot-password', validateForgotPassword, authController.forgotPassword);
router.post('/reset-password', validateResetPassword, authController.resetPassword);
router.get('/verify-email', authController.verifyEmail);
router.post('/resend-verification-email', validateResendVerification, authController.resendVerificationEmail);

// Token management
router.post('/refresh-token', refreshToken);
router.post('/logout', authController.logout);

// Protected routes examples
router.get('/profile', authenticateToken, (req, res) => {
  res.json({
    message: 'Thông tin profile người dùng',
    user: req.user
  });
});

router.get('/premium-feature', authenticateToken, requirePlan('PREMIUM'), (req, res) => {
  res.json({
    message: 'Đây là tính năng dành cho gói Premium',
    user: req.user
  });
});

router.get('/enterprise-feature', authenticateToken, requirePlan('ENTERPRISE'), (req, res) => {
  res.json({
    message: 'Đây là tính năng dành cho gói Enterprise',
    user: req.user
  });
});

export default router; 