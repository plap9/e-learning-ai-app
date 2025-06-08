import { Router } from 'express';
import userController from '../controllers/user.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router: Router = Router();

// Internal route for API Gateway to fetch user info
router.get('/users/:userId', userController.getUserById);

// User profile routes (protected)
router.get('/profile', authenticateToken, userController.getProfile);
router.put('/profile', authenticateToken, userController.updateProfile);

// User preferences
router.get('/preferences', authenticateToken, userController.getPreferences);
router.put('/preferences', authenticateToken, userController.updatePreferences);

export { router as userRoutes }; 