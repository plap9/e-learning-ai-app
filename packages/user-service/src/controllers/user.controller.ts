import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

class UserController {
  // Internal API for API Gateway - get user by ID
  async getUserById(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      
      // Check if this is an internal service call
      const internalService = req.headers['internal-service'];
      if (internalService !== 'api-gateway') {
        return res.status(403).json({
          error: 'Access denied',
          message: 'This endpoint is for internal services only'
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isVerified: true,
          isActive: true,
          subscriptions: {
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { plan: true }
          }
        }
      });

      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          message: 'The requested user does not exist'
        });
      }

      return res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isVerified: user.isVerified,
        isActive: user.isActive,
        currentPlan: user.subscriptions[0]?.plan || 'FREE'
      });

    } catch (error: any) {
      console.error('Get user by ID error:', error);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch user information'
      });
    }
  }

  // Get current user profile
  async getProfile(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'User not authenticated'
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          profile: true,
          subscriptions: {
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      });

      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          message: 'User profile not found'
        });
      }

      return res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        phoneNumber: user.phoneNumber,
        language: user.language,
        timezone: user.timezone,
        isVerified: user.isVerified,
        currentPlan: user.subscriptions[0]?.plan || 'FREE',
        profile: user.profile
      });

    } catch (error: any) {
      console.error('Get profile error:', error);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch user profile'
      });
    }
  }

  // Update user profile
  async updateProfile(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'User not authenticated'
        });
      }

      const {
        firstName,
        lastName,
        avatar,
        dateOfBirth,
        gender,
        phoneNumber,
        language,
        timezone
      } = req.body;

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          firstName,
          lastName,
          avatar,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
          gender,
          phoneNumber,
          language,
          timezone,
          updatedAt: new Date()
        }
      });

      return res.json({
        message: 'Profile updated successfully',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          avatar: updatedUser.avatar,
          dateOfBirth: updatedUser.dateOfBirth,
          gender: updatedUser.gender,
          phoneNumber: updatedUser.phoneNumber,
          language: updatedUser.language,
          timezone: updatedUser.timezone
        }
      });

    } catch (error: any) {
      console.error('Update profile error:', error);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to update user profile'
      });
    }
  }

  // Get user preferences
  async getPreferences(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'User not authenticated'
        });
      }

      const userProfile = await prisma.userProfile.findUnique({
        where: { userId }
      });

      if (!userProfile) {
        // Create default profile if doesn't exist
        const newProfile = await prisma.userProfile.create({
          data: {
            userId,
            currentLevel: 'BEGINNER',
            targetLevel: 'INTERMEDIATE'
          }
        });
        
        return res.json(newProfile);
      }

      return res.json(userProfile);

    } catch (error: any) {
      console.error('Get preferences error:', error);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch user preferences'
      });
    }
  }

  // Update user preferences
  async updatePreferences(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'User not authenticated'
        });
      }

      const {
        currentLevel,
        targetLevel,
        learningGoals,
        interests,
        preferredTopics,
        studyTimePerDay,
        reminderTime,
        isPublic,
        bio,
        visualLearning,
        auditoryLearning,
        kinestheticLearning,
        weeklyGoalMinutes,
        monthlyGoalMinutes
      } = req.body;

      const updatedProfile = await prisma.userProfile.upsert({
        where: { userId },
        update: {
          currentLevel,
          targetLevel,
          learningGoals,
          interests,
          preferredTopics,
          studyTimePerDay,
          reminderTime,
          isPublic,
          bio,
          visualLearning,
          auditoryLearning,
          kinestheticLearning,
          weeklyGoalMinutes: weeklyGoalMinutes || 150,
 