import { PrismaClient, SubscriptionPlan, SubscriptionStatus, TokenType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { emailService } from './email.service';

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
    const { email, password, confirmPassword, firstName, lastName } = userData;

    // 1. Validate input data
    this.validateRegistrationData(userData);

    // 2. Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      throw new Error('EMAIL_ALREADY_EXISTS');
    }

    // 3. Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 4. Create user in database transaction
    const result = await prisma.$transaction(async (tx) => {
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

    return {
      message: 'Registration successful. Please check your email to verify your account.',
      userId: result.user.id
    };
  }

  async loginUser(email: string, password: string) {
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
      throw new Error('INVALID_CREDENTIALS');
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('INVALID_CREDENTIALS');
    }

    // Check if user is verified (optional - depends on your strategy)
    if (!user.isVerified) {
      throw new Error('EMAIL_NOT_VERIFIED');
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
    // Validate passwords match
    if (newPassword !== confirmNewPassword) {
      throw new Error('PASSWORDS_DO_NOT_MATCH');
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
      throw new Error('INVALID_OR_EXPIRED_TOKEN');
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
    if (!email || !password || !confirmPassword || !firstName || !lastName) {
      throw new Error('MISSING_REQUIRED_FIELDS');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('INVALID_EMAIL_FORMAT');
    }

    // Check passwords match
    if (password !== confirmPassword) {
      throw new Error('PASSWORDS_DO_NOT_MATCH');
    }

    // Validate password strength
    this.validatePassword(password);
  }

  private validatePassword(password: string) {
    if (password.length < 8) {
      throw new Error('PASSWORD_TOO_SHORT');
    }

    // Check for at least one uppercase letter
    if (!/[A-Z]/.test(password)) {
      throw new Error('PASSWORD_MISSING_UPPERCASE');
    }

    // Check for at least one lowercase letter
    if (!/[a-z]/.test(password)) {
      throw new Error('PASSWORD_MISSING_LOWERCASE');
    }

    // Check for at least one number
    if (!/[0-9]/.test(password)) {
      throw new Error('PASSWORD_MISSING_NUMBER');
    }
  }

  private generateAccessToken(userId: string, plan: SubscriptionPlan): string {
    const payload = {
      userId,
      plan,
      type: 'access'
    };

    const secret = process.env.JWT_SECRET || 'fallback-secret-key';
    const expiresIn = process.env.JWT_EXPIRES_IN || '15m';

    return (jwt.sign as any)(payload, secret, { expiresIn });
  }

  private generateRefreshToken(userId: string): string {
    const payload = {
      userId,
      type: 'refresh'
    };

    const secret = process.env.JWT_SECRET || 'fallback-secret-key';
    const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

    return (jwt.sign as any)(payload, secret, { expiresIn });
  }
}

export const authService = new AuthService(); 