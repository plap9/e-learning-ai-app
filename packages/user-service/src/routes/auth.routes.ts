import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticateToken, requirePlan, refreshToken } from '../middlewares/auth.middleware';
import { securityMiddlewareStack } from '../middlewares/security.middleware';
import { createErrorMiddleware } from '../utils/error-handler.utils';

const router: Router = Router();

// Apply security middleware stack to all routes
router.use(securityMiddlewareStack);

// Apply centralized error handling
router.use(createErrorMiddleware());

// Public authentication routes - validation and rate limiting built into controller
router.post('/register', ...authController.register);
router.post('/login', ...authController.login);
router.post('/forgot-password', ...authController.forgotPassword);
router.post('/reset-password', ...authController.resetPassword);
router.get('/verify-email', ...authController.verifyEmail);
router.post('/resend-verification-email', ...authController.resendVerificationEmail);

// Token management
router.post('/refresh-token', refreshToken);
router.post('/logout', ...authController.logout);

// Health check
router.get('/health', ...authController.health);

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