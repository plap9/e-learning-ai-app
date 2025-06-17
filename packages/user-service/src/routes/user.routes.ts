import { Router } from 'express';
import userController from '../controllers/user.controller';
import { securityMiddlewareStack } from '../middlewares/security.middleware';
import { createErrorMiddleware } from '../utils/error-handler.utils';

const router: Router = Router();

// Apply security middleware stack to all routes
router.use(securityMiddlewareStack);

// Apply centralized error handling
router.use(createErrorMiddleware());

// Internal API for API Gateway - get user by ID
router.get('/internal/:userId', ...userController.getUserByIdEndpoint);

// Public user routes (require authentication)
router.get('/profile', ...userController.getProfileEndpoint);
router.put('/profile', ...userController.updateProfileEndpoint);
router.get('/preferences', ...userController.getPreferencesEndpoint);
router.put('/preferences', ...userController.updatePreferencesEndpoint);

export default router; 