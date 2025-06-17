import { PrismaClient, SubscriptionPlan, SubscriptionStatus, TokenType, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { emailService } from './email.service';
import {
  EmailAlreadyExistsError,
  InvalidCredentialsError,
  EmailNotVerifiedError,
  UserAccountDeactivatedError,
  PasswordTooShortError,
  PasswordMissingRequirementsError,
  MissingRequiredFieldsError,
  InvalidEmailFormatError,
  SystemError,
  ExternalServiceError
} from '../utils/errors';
import {
  PasswordsDoNotMatchError,
  WeakPasswordError,
  InvalidTokenError,
  TokenExpiredError,
  InvalidRefreshTokenError,
  UserNotFoundError,
  EmailAlreadyVerifiedError,
  PasswordResetFailedError,
  EmailVerificationFailedError,
  LogoutFailedError
} from '../utils/custom-errors';
import { appLogger } from '../utils/logger';
import { validateEmail, validatePassword } from '../validators/auth.validators';
import { JWTUtils } from '../utils/jwt.utils';

const prisma = new PrismaClient();

interface RegisterUserInput {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
}

interface RegisterUserResponse {
  message: string;
  userId: string;
}

class AuthService {
  async registerUser(userData: RegisterUserInput): Promise<RegisterUserResponse> {
    const startTime = Date.now();
    const { email, password, confirmPassword, firstName, lastName } = userData;

    try {
      // 1. Validate input data
      this.validateRegistrationData(userData);

      // 2. Check if email already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase() }
      });

      if (existingUser) {
        appLogger.warn('Registration attempt with existing email', {
          email: email.replace(/(?<=.{2}).(?=.*@)/g, '*'),
          duration: Date.now() - startTime
        });
        throw new EmailAlreadyExistsError(email);
      }

    // 3. Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 4. Create user in database transaction
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          passwordHash,
          firstName,
          lastName,
          isVerified: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      // Create default FREE subscription
      await tx.subscription.create({
        data: {
          userId: user.id,
          plan: SubscriptionPlan.FREE,
          status: SubscriptionStatus.ACTIVE,
          startDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      // Create email verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // Token expires in 24 hours

      await tx.token.create({
        data: {
          userId: user.id,
          token: verificationToken,
          type: TokenType.EMAIL_VERIFICATION,
          expiresAt,
          isUsed: false,
          createdAt: new Date()
        }
      });

      return { user, verificationToken };
    });

    // 5. Send verification email
    try {
      await emailService.sendVerificationEmail(
        result.user.email,
        result.user.firstName,
        result.verificationToken
      );
    } catch (error) {
      console.error('Failed to send verification email:', error);
      // Note: We don't throw here to avoid rolling back user creation
      // The user can request a new verification email later
    }

      // Log successful registration
      appLogger.info('User registration successful', {
        userId: result.user.id,
        email: email.replace(/(?<=.{2}).(?=.*@)/g, '*'),
        duration: Date.now() - startTime
      });

      return {
        message: 'Registration successful. Please check your email to verify your account.',
        userId: result.user.id
      };
    } catch (error) {
      appLogger.error('Registration failed', {
        email: email.replace(/(?<=.{2}).(?=.*@)/g, '*'),
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      });
      
      // Re-throw known errors
      if (error instanceof EmailAlreadyExistsError || 
          error instanceof MissingRequiredFieldsError ||
          error instanceof InvalidEmailFormatError ||
          error instanceof PasswordTooShortError ||
          error instanceof PasswordMissingRequirementsError ||
          error instanceof PasswordsDoNotMatchError) {
        throw error;
      }
      
      // Wrap unknown errors
      throw new SystemError(
        'User registration failed due to system error',
        'SYSTEM_1001_REGISTRATION_FAILED',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async loginUser(email: string, password: string) {
    const startTime = Date.now();
    
    try {
      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        include: {
          subscriptions: {
            where: { status: SubscriptionStatus.ACTIVE },
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      });

      if (!user) {
        appLogger.warn('Login attempt with non-existent email', {
          email: email.replace(/(?<=.{2}).(?=.*@)/g, '*'),
          duration: Date.now() - startTime
        });
        throw new InvalidCredentialsError(email);
      }

      // Check if user account is active
      if (!user.isActive) {
        appLogger.warn('Login attempt with deactivated account', {
          email: email.replace(/(?<=.{2}).(?=.*@)/g, '*'),
          userId: user.id,
          duration: Date.now() - startTime
        });
        throw new UserAccountDeactivatedError(user.id);
      }

      // Check password
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        appLogger.warn('Login attempt with invalid password', {
          email: email.replace(/(?<=.{2}).(?=.*@)/g, '*'),
          userId: user.id,
          duration: Date.now() - startTime
        });
        throw new InvalidCredentialsError(email);
      }

      // Check if user is verified (optional - depends on your strategy)
      if (!user.isVerified) {
        appLogger.warn('Login attempt with unverified email', {
          email: email.replace(/(?<=.{2}).(?=.*@)/g, '*'),
          userId: user.id,
          duration: Date.now() - startTime
        });
        throw new EmailNotVerifiedError(email);
      }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    // Generate JWT tokens
    const accessToken = this.generateAccessToken(user.id, user.subscriptions[0]?.plan || SubscriptionPlan.FREE);
    const refreshToken = this.generateRefreshToken(user.id);

    // Save refresh token to database
    await prisma.userSession.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        createdAt: new Date()
      }
    });

      // Log successful login
      appLogger.info('User login successful', {
        userId: user.id,
        email: email.replace(/(?<=.{2}).(?=.*@)/g, '*'),
        duration: Date.now() - startTime
      });

      return {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          currentPlan: user.subscriptions[0]?.plan || SubscriptionPlan.FREE
        }
      };
    } catch (error) {
      appLogger.error('Login failed', {
        email: email.replace(/(?<=.{2}).(?=.*@)/g, '*'),
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      });
      
      // Re-throw known errors
      if (error instanceof InvalidCredentialsError || 
          error instanceof EmailNotVerifiedError ||
          error instanceof UserAccountDeactivatedError) {
        throw error;
      }
      
      // Wrap unknown errors
      throw new SystemError(
        'User login failed due to system error',
        'SYSTEM_1002_LOGIN_FAILED',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    // Always return success message for security (avoid email enumeration)
    const successMessage = 'If your email address exists in our system, you will receive a password reset link shortly.';

    if (!user) {
      return { message: successMessage };
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Token expires in 1 hour

    // Save reset token
    await prisma.token.create({
      data: {
        userId: user.id,
        token: resetToken,
        type: TokenType.PASSWORD_RESET,
        expiresAt,
        isUsed: false,
        createdAt: new Date()
      }
    });

    // Send reset email
    try {
      await emailService.sendPasswordResetEmail(user.email, user.firstName, resetToken);
    } catch (error) {
      console.error('Failed to send password reset email:', error);
    }

    return { message: successMessage };
  }

  async resetPassword(token: string, newPassword: string, confirmNewPassword: string) {
    try {
      // Validate passwords match
      if (newPassword !== confirmNewPassword) {
        throw new PasswordsDoNotMatchError();
      }

      // Validate password strength
      this.validatePassword(newPassword);

      // Find and validate token
      const tokenRecord = await prisma.token.findFirst({
        where: {
          token,
          type: TokenType.PASSWORD_RESET,
          isUsed: false,
          expiresAt: { gt: new Date() }
        },
        include: { user: true }
      });

      if (!tokenRecord) {
        throw new InvalidTokenError('Token không hợp lệ hoặc đã hết hạn');
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(newPassword, 12);

      // Update user password and mark token as used
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: tokenRecord.userId },
          data: { passwordHash, updatedAt: new Date() }
        });

        await tx.token.update({
          where: { id: tokenRecord.id },
          data: { isUsed: true }
        });
      });

      return { message: 'Password has been reset successfully. You can now login with your new password.' };
    } catch (error) {
      appLogger.error('Password reset failed', {
        error: error instanceof Error ? error.message : String(error),
        tokenProvided: !!token
      });

      // Re-throw known custom errors
      if (error instanceof PasswordsDoNotMatchError || 
          error instanceof WeakPasswordError ||
          error instanceof InvalidTokenError) {
        throw error;
      }

      // Wrap unknown errors
      throw new PasswordResetFailedError({
        originalError: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async verifyEmail(token: string) {
    // Find and validate token
    const tokenRecord = await prisma.token.findFirst({
      where: {
        token,
        type: TokenType.EMAIL_VERIFICATION,
        isUsed: false,
        expiresAt: { gt: new Date() }
      }
    });

    if (!tokenRecord) {
      throw new Error('INVALID_OR_EXPIRED_TOKEN');
    }

    // Update user verification status and mark token as used
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: tokenRecord.userId },
        data: { isVerified: true, updatedAt: new Date() }
      });

      await tx.token.update({
        where: { id: tokenRecord.id },
        data: { isUsed: true }
      });
    });

    return { message: 'Email verified successfully. You can now login.' };
  }

  async resendVerificationEmail(email: string) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    if (user.isVerified) {
      throw new Error('EMAIL_ALREADY_VERIFIED');
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Save new token (invalidate old ones implicitly by using newer one)
    await prisma.token.create({
      data: {
        userId: user.id,
        token: verificationToken,
        type: TokenType.EMAIL_VERIFICATION,
        expiresAt,
        isUsed: false,
        createdAt: new Date()
      }
    });

    // Send verification email
    await emailService.sendVerificationEmail(user.email, user.firstName, verificationToken);

    return { message: 'Verification email has been resent. Please check your inbox.' };
  }

  async logout(refreshToken: string) {
    // Invalidate refresh token
    await prisma.userSession.deleteMany({
      where: { token: refreshToken }
    });

    return { message: 'Logged out successfully.' };
  }

  private validateRegistrationData(data: RegisterUserInput) {
    const { email, password, confirmPassword, firstName, lastName } = data;

    // Check required fields
    const missingFields: string[] = [];
    if (!email) missingFields.push('email');
    if (!password) missingFields.push('password');
    if (!confirmPassword) missingFields.push('confirmPassword');
    if (!firstName) missingFields.push('firstName');
    if (!lastName) missingFields.push('lastName');
    
    if (missingFields.length > 0) {
      throw new MissingRequiredFieldsError(missingFields);
    }

    // Validate email format
    if (!validateEmail(email)) {
      throw new InvalidEmailFormatError(email);
    }

    // Check passwords match
    if (password !== confirmPassword) {
      throw new PasswordsDoNotMatchError();
    }

    // Validate password strength
    this.validatePassword(password);
  }

  private validatePassword(password: string) {
    const validation = validatePassword(password);
    
    if (!validation.isValid) {
      throw new PasswordMissingRequirementsError(validation.errors);
    }
  }

  private generateAccessToken(userId: string, plan: SubscriptionPlan): string {
    return JWTUtils.generateAccessToken(userId, plan);
  }

  private generateRefreshToken(userId: string): string {
    return JWTUtils.generateRefreshToken(userId, 'FREE'); // Plan is not needed for refresh tokens
  }
}

export const authService = new AuthService(); 