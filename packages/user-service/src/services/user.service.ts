import { PrismaClient, User, UserProfile, Prisma, SubscriptionPlan } from '@prisma/client';
import { UserRepository } from '../repositories/user.repository';
import { appLogger as logger } from '../utils/logger';
import {
  UserNotFoundError,
  SystemError,
  ValidationError
} from '../exceptions';

// Type definitions for service responses
export interface UserWithSubscription {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isVerified: boolean;
  isActive: boolean;
  currentPlan: SubscriptionPlan;
}

export interface UserProfileData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  dateOfBirth?: Date;
  gender?: string;
  phoneNumber?: string;
  language: string;
  timezone: string;
  isVerified: boolean;
  currentPlan: SubscriptionPlan;
  profile?: UserProfile;
}

export interface UserStatistics {
  totalStudyTime: number;
  currentStreak: number;
  longestStreak: number;
  totalStudyDays: number;
  weeklyProgress: number;
  monthlyProgress: number;
  completedCourses: number;
  activeCourses: number;
  achievementsEarned: number;
}

export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  avatar?: string;
  dateOfBirth?: string;
  gender?: string;
  phoneNumber?: string;
  language?: string;
  timezone?: string;
}

export interface UpdatePreferencesData {
  currentLevel?: string;
  targetLevel?: string;
  learningGoals?: string[];
  interests?: string[];
  preferredTopics?: string[];
  studyTimePerDay?: number;
  reminderTime?: string;
  isPublic?: boolean;
  bio?: string;
  visualLearning?: boolean;
  auditoryLearning?: boolean;
  kinestheticLearning?: boolean;
  weeklyGoalMinutes?: number;
  monthlyGoalMinutes?: number;
}

/**
 * User Service
 * Tuân thủ SoC/SRP - chỉ chứa business logic cho user operations
 * Sử dụng repository pattern để truy cập database
 */
export class UserService {
  private userRepository: UserRepository;
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.userRepository = new UserRepository(prisma);
  }

  /**
   * Get user by ID for internal APIs
   */
  async getUserById(userId: string): Promise<UserWithSubscription> {
    try {
      logger.info('Getting user by ID', { userId });

      const user = await this.userRepository.findById(userId);

      if (!user) {
        throw new UserNotFoundError(userId);
      }

      // Get active subscription
      const activeSubscription = await this.prisma.subscription.findFirst({
        where: {
          userId: user.id,
          status: 'ACTIVE'
        },
        orderBy: { createdAt: 'desc' }
      });

      const result: UserWithSubscription = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isVerified: user.isVerified,
        isActive: user.isActive,
        currentPlan: activeSubscription?.plan || 'FREE'
      };

      logger.info('User retrieved successfully', { userId });
      return result;

    } catch (error) {
      logger.error('Failed to get user by ID', { 
        userId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Get user profile with complete information
   */
  async getUserProfile(userId: string): Promise<UserProfileData> {
    try {
      logger.info('Getting user profile', { userId });

      const user = await this.prisma.user.findUnique({
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
        throw new UserNotFoundError(userId);
      }

      const result: UserProfileData = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar || undefined,
        dateOfBirth: user.dateOfBirth || undefined,
        gender: user.gender || undefined,
        phoneNumber: user.phoneNumber || undefined,
        language: user.language,
        timezone: user.timezone,
        isVerified: user.isVerified,
        currentPlan: user.subscriptions[0]?.plan || 'FREE',
        profile: user.profile || undefined
      };

      logger.info('User profile retrieved successfully', { userId });
      return result;

    } catch (error) {
      logger.error('Failed to get user profile', { 
        userId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, updateData: UpdateProfileData): Promise<UserProfileData> {
    try {
      logger.info('Updating user profile', { 
        userId, 
        fieldsToUpdate: Object.keys(updateData) 
      });

      // Validate update data
      this.validateProfileUpdateData(updateData);

      const updatedUser = await this.userRepository.update(userId, {
        firstName: updateData.firstName,
        lastName: updateData.lastName,
        avatar: updateData.avatar,
        dateOfBirth: updateData.dateOfBirth ? new Date(updateData.dateOfBirth) : undefined,
        gender: updateData.gender ? updateData.gender as any : undefined,
        phoneNumber: updateData.phoneNumber,
        language: updateData.language,
        timezone: updateData.timezone,
        updatedAt: new Date()
      });

      // Get the updated profile with subscriptions
      const result = await this.getUserProfile(userId);

      logger.info('User profile updated successfully', { 
        userId, 
        fieldsUpdated: Object.keys(updateData) 
      });
      
      return result;

    } catch (error) {
      logger.error('Failed to update user profile', { 
        userId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Get user preferences (UserProfile)
   */
  async getUserPreferences(userId: string): Promise<UserProfile> {
    try {
      logger.info('Getting user preferences', { userId });

      const userProfile = await this.prisma.userProfile.findUnique({
        where: { userId }
      });

      if (!userProfile) {
        // Create default profile if doesn't exist
        logger.info('Creating default user profile', { userId });
        
        const newProfile = await this.prisma.userProfile.create({
          data: {
            userId,
            currentLevel: 'BEGINNER',
            targetLevel: 'INTERMEDIATE',
            weeklyGoalMinutes: 150,
            monthlyGoalMinutes: 600
          }
        });
        
        logger.info('Default user profile created', { userId });
        return newProfile;
      }

      logger.info('User preferences retrieved successfully', { userId });
      return userProfile;

    } catch (error) {
      logger.error('Failed to get user preferences', { 
        userId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(userId: string, updateData: UpdatePreferencesData): Promise<UserProfile> {
    try {
      logger.info('Updating user preferences', { 
        userId, 
        fieldsToUpdate: Object.keys(updateData) 
      });

      // Validate preferences data
      this.validatePreferencesUpdateData(updateData);

      const updatedProfile = await this.prisma.userProfile.upsert({
        where: { userId },
        update: {
          currentLevel: updateData.currentLevel as any,
          targetLevel: updateData.targetLevel as any,
          learningGoals: updateData.learningGoals,
          interests: updateData.interests,
          preferredTopics: updateData.preferredTopics,
          studyTimePerDay: updateData.studyTimePerDay,
          reminderTime: updateData.reminderTime,
          isPublic: updateData.isPublic,
          bio: updateData.bio,
          visualLearning: updateData.visualLearning,
          auditoryLearning: updateData.auditoryLearning,
          kinestheticLearning: updateData.kinestheticLearning,
          weeklyGoalMinutes: updateData.weeklyGoalMinutes || 150,
          monthlyGoalMinutes: updateData.monthlyGoalMinutes || 600,
          updatedAt: new Date()
        },
        create: {
          userId,
          currentLevel: (updateData.currentLevel as any) || 'BEGINNER',
          targetLevel: (updateData.targetLevel as any) || 'INTERMEDIATE',
          learningGoals: updateData.learningGoals,
          interests: updateData.interests,
          preferredTopics: updateData.preferredTopics,
          studyTimePerDay: updateData.studyTimePerDay,
          reminderTime: updateData.reminderTime,
          isPublic: updateData.isPublic || false,
          bio: updateData.bio,
          visualLearning: updateData.visualLearning || false,
          auditoryLearning: updateData.auditoryLearning || false,
          kinestheticLearning: updateData.kinestheticLearning || false,
          weeklyGoalMinutes: updateData.weeklyGoalMinutes || 150,
          monthlyGoalMinutes: updateData.monthlyGoalMinutes || 600
        }
      });

      logger.info('User preferences updated successfully', { 
        userId, 
        fieldsUpdated: Object.keys(updateData) 
      });

      return updatedProfile;

    } catch (error) {
      logger.error('Failed to update user preferences', { 
        userId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Get user statistics for monitoring
   */
  async getUserStatistics(userId: string): Promise<UserStatistics> {
    try {
      logger.info('Getting user statistics', { userId });

      // Get user profile with stats
      const userProfile = await this.prisma.userProfile.findUnique({
        where: { userId }
      });

      // Get enrollment counts
      const [completedCourses, activeCourses] = await Promise.all([
        this.prisma.enrollment.count({
          where: { userId, isCompleted: true }
        }),
        this.prisma.enrollment.count({
          where: { userId, isCompleted: false }
        })
      ]);

      // Get achievements count
      const achievementsEarned = await this.prisma.userAchievement.count({
        where: { userId }
      });

      // Calculate progress percentages
      const weeklyProgress = userProfile ? 
        Math.min((userProfile.totalStudyTime / userProfile.weeklyGoalMinutes) * 100, 100) : 0;
      
      const monthlyProgress = userProfile ? 
        Math.min((userProfile.totalStudyTime / userProfile.monthlyGoalMinutes) * 100, 100) : 0;

      const result: UserStatistics = {
        totalStudyTime: userProfile?.totalStudyTime || 0,
        currentStreak: userProfile?.currentStreak || 0,
        longestStreak: userProfile?.longestStreak || 0,
        totalStudyDays: userProfile?.totalStudyDays || 0,
        weeklyProgress: Math.round(weeklyProgress),
        monthlyProgress: Math.round(monthlyProgress),
        completedCourses,
        activeCourses,
        achievementsEarned
      };

      logger.info('User statistics retrieved successfully', { userId });
      return result;

    } catch (error) {
      logger.error('Failed to get user statistics', { 
        userId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Deactivate user account
   */
  async deactivateUserAccount(userId: string): Promise<void> {
    try {
      logger.info('Deactivating user account', { userId });

      // Use transaction for consistency
      await this.prisma.$transaction(async (tx) => {
        // Deactivate user
        await tx.user.update({
          where: { id: userId },
          data: { 
            isActive: false,
            deletedAt: new Date(),
            updatedAt: new Date()
          }
        });

        // Cancel active subscriptions
        await tx.subscription.updateMany({
          where: { 
            userId,
            status: 'ACTIVE'
          },
          data: { 
            status: 'CANCELLED',
            updatedAt: new Date()
          }
        });

        // Invalidate all user sessions
        await tx.userSession.deleteMany({
          where: { userId }
        });

        logger.info('User account deactivated successfully', { userId });
      });

    } catch (error) {
      logger.error('Failed to deactivate user account', { 
        userId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  // Private validation methods
  private validateProfileUpdateData(data: UpdateProfileData): void {
    if (data.firstName && data.firstName.length > 50) {
      throw new ValidationError(
        'First name quá dài (tối đa 50 ký tự)',
        'VALIDATION_4001_FIRST_NAME_TOO_LONG'
      );
    }

    if (data.lastName && data.lastName.length > 50) {
      throw new ValidationError(
        'Last name quá dài (tối đa 50 ký tự)',
        'VALIDATION_4002_LAST_NAME_TOO_LONG'
      );
    }

    if (data.phoneNumber && !/^\+?[\d\s\-\(\)]+$/.test(data.phoneNumber)) {
      throw new ValidationError(
        'Số điện thoại không hợp lệ',
        'VALIDATION_4003_INVALID_PHONE_NUMBER'
      );
    }

    if (data.dateOfBirth) {
      const birthDate = new Date(data.dateOfBirth);
      const now = new Date();
      const age = now.getFullYear() - birthDate.getFullYear();
      
      if (age < 13 || age > 120) {
        throw new ValidationError(
          'Tuổi phải từ 13 đến 120',
          'VALIDATION_4004_INVALID_AGE'
        );
      }
    }

    if (data.gender && !['MALE', 'FEMALE', 'OTHER'].includes(data.gender)) {
      throw new ValidationError(
        'Giới tính không hợp lệ. Chỉ chấp nhận: MALE, FEMALE, OTHER',
        'VALIDATION_4005_INVALID_GENDER'
      );
    }
  }

  private validatePreferencesUpdateData(data: UpdatePreferencesData): void {
    if (data.studyTimePerDay && (data.studyTimePerDay < 5 || data.studyTimePerDay > 480)) {
      throw new ValidationError(
        'Thời gian học mỗi ngày phải từ 5 đến 480 phút',
        'VALIDATION_4006_INVALID_STUDY_TIME'
      );
    }

    if (data.weeklyGoalMinutes && (data.weeklyGoalMinutes < 30 || data.weeklyGoalMinutes > 3360)) {
      throw new ValidationError(
        'Mục tiêu hàng tuần phải từ 30 đến 3360 phút',
        'VALIDATION_4007_INVALID_WEEKLY_GOAL'
      );
    }

    if (data.monthlyGoalMinutes && (data.monthlyGoalMinutes < 120 || data.monthlyGoalMinutes > 14400)) {
      throw new ValidationError(
        'Mục tiêu hàng tháng phải từ 120 đến 14400 phút',
        'VALIDATION_4008_INVALID_MONTHLY_GOAL'
      );
    }
  }
}

// Export singleton instance
export const userService = new UserService(new PrismaClient()); 