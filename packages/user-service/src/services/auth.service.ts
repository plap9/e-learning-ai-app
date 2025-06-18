import { PrismaClient, SubscriptionPlan, TokenType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { UserRepository, TokenRepository } from '../repositories';
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
  PasswordsDoNotMatchError,
  InvalidTokenError,
  TokenExpiredError,
  UserNotFoundError
} from '../utils/errors';
import { appLogger } from '../utils/logger';
import { validateEmail, validatePassword } from '../middlewares/validation.middleware';
import { JWTUtils } from '../utils/jwt.utils';

// Service DTOs
export interface RegisterUserInput {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
}

export interface RegisterUserResponse {
  message: string;
  userId: string;
}

export interface LoginUserResponse {
  message: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    isVerified: boolean;
    plan: SubscriptionPlan;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

export interface ForgotPasswordResponse {
  message: string;
}

export interface ResetPasswordResponse {
  message: string;
}

export interface VerifyEmailResponse {
  message: string;
  userId: string;
}

export interface ResendVerificationResponse {
  message: string;
}

export interface LogoutResponse {
  message: string;
}

// Service interface
export interface IAuthService {
  registerUser(userData: RegisterUserInput): Promise<RegisterUserResponse>;
  loginUser(email: string, password: string): Promise<LoginUserResponse>;
  forgotPassword(email: string): Promise<ForgotPasswordResponse>;
  resetPassword(token: string, newPassword: string, confirmNewPassword: string): Promise<ResetPasswordResponse>;
  verifyEmail(token: string): Promise<VerifyEmailResponse>;
  resendVerificationEmail(email: string): Promise<ResendVerificationResponse>;
  logout(refreshToken: string): Promise<LogoutResponse>;
}

/**
 * Authentication Service
 * Contains only business logic, uses repositories for data access
 * Follows Single Responsibility Principle
 */
export class AuthService implements IAuthService {
  private userRepository: UserRepository;
  private tokenRepository: TokenRepository;

  constructor(prisma: PrismaClient) {
    this.userRepository = new UserRepository(prisma);
    this.tokenRepository = new TokenRepository(prisma);
  }

  /**
   * Register new user
   */
  async registerUser(userData: RegisterUserInput): Promise<RegisterUserResponse> {
    const startTime = Date.now();
    const { email, password, confirmPassword, firstName, lastName } = userData;

    try {
      // 1. Validate business rules
      this.validateRegistrationData(userData);

      // 2. Check if email already exists
      const existingUser = await this.userRepository.findByEmail(email);
      if (existingUser) {
        appLogger.warn('Registration attempt with existing email', {
          email: this.maskEmail(email),
          duration: Date.now() - startTime
        });
        throw new EmailAlreadyExistsError(email);
      }

      // 3. Hash password
      const passwordHash = await this.hashPassword(password);

      // 4. Create user with subscription in transaction
      const user = await this.userRepository.createWithSubscription({
        email: email.toLowerCase(),
        passwordHash,
        firstName,
        lastName,
        isVerified: false
      });

      // 5. Create email verification token
      const verificationToken = this.generateSecureToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours

      await this.tokenRepository.createVerificationToken(
        user.id,
        verificationToken,
        expiresAt
      );

      // 6. Send verification email (non-blocking)
      this.sendVerificationEmailAsync(user.email, user.firstName, verificationToken);

      // 7. Log successful registration
      appLogger.info('User registration successful', {
        userId: user.id,
        email: this.maskEmail(email),
        duration: Date.now() - startTime
      });

      return {
        message: 'Registration successful. Please check your email to verify your account.',
        userId: user.id
      };
    } catch (error) {
      appLogger.error('Registration failed', {
        email: this.maskEmail(email),
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      });
      
      // Re-throw known errors
      if (this.isKnownError(error)) {
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

  /**
   * Login user
   */
  async loginUser(email: string, password: string): Promise<LoginUserResponse> {
    const startTime = Date.now();
    
    try {
      // Find user with subscriptions
      const user = await this.userRepository.findByEmailWithSubscriptions(email);
      if (!user) {
        appLogger.warn('Login attempt with non-existent email', {
          email: this.maskEmail(email),
          duration: Date.now() - startTime
        });
        throw new InvalidCredentialsError(email);
      }

      // Check if account is active
      if (!user.isActive) {
        appLogger.warn('Login attempt with deactivated account', {
          email: this.maskEmail(email),
          userId: user.id,
          duration: Date.now() - startTime
        });
        throw new UserAccountDeactivatedError(user.id);
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        appLogger.warn('Login attempt with invalid password', {
          email: this.maskEmail(email),
          userId: user.id,
          duration: Date.now() - startTime
        });
        throw new InvalidCredentialsError(email);
      }

      // Check email verification
      if (!user.isVerified) {
        appLogger.warn('Login attempt with unverified email', {
          email: this.maskEmail(email),
          userId: user.id,
          duration: Date.now() - startTime
        });
        throw new EmailNotVerifiedError(email);
      }

      // Get user's active subscription plan
      const plan = user.subscriptions?.[0]?.plan || SubscriptionPlan.FREE;

      // Generate tokens
      const accessToken = this.generateAccessToken(user.id, plan);
      const refreshToken = this.generateRefreshToken(user.id);

      // Update last login time
      await this.userRepository.update(user.id, {
        lastLoginAt: new Date()
      });

      appLogger.info('User login successful', {
        userId: user.id,
        email: this.maskEmail(email),
        plan,
        duration: Date.now() - startTime
      });

      return {
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isVerified: user.isVerified,
          plan
        },
        tokens: {
          accessToken,
          refreshToken
        }
      };
    } catch (error) {
      appLogger.error('Login failed', {
        email: this.maskEmail(email),
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      });

      if (this.isKnownError(error)) {
        throw error;
      }

      throw new SystemError(
        'Login failed due to system error',
        'SYSTEM_1002_LOGIN_FAILED',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Forgot password
   */
  async forgotPassword(email: string): Promise<ForgotPasswordResponse> {
    const startTime = Date.now();

    try {
      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        // Security: Don't reveal if email exists
        appLogger.warn('Forgot password request for non-existent email', {
          email: this.maskEmail(email),
          duration: Date.now() - startTime
        });
        return {
          message: 'If the email exists, a password reset link has been sent.'
        };
      }

      // Revoke existing password reset tokens
      await this.tokenRepository.revokeUserTokens(user.id, TokenType.PASSWORD_RESET);

      // Generate reset token
      const resetToken = this.generateSecureToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour

      await this.tokenRepository.createPasswordResetToken(
        user.id,
        resetToken,
        expiresAt
      );

      // Send reset email (non-blocking)
      this.sendPasswordResetEmailAsync(user.email, user.firstName, resetToken);

      appLogger.info('Password reset requested', {
        userId: user.id,
        email: this.maskEmail(email),
        duration: Date.now() - startTime
      });

      return {
        message: 'If the email exists, a password reset link has been sent.'
      };
    } catch (error) {
      appLogger.error('Forgot password failed', {
        email: this.maskEmail(email),
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      });

      // Always return success message for security
      return {
        message: 'If the email exists, a password reset link has been sent.'
      };
    }
  }

  /**
   * Reset password
   */
  async resetPassword(
    token: string, 
    newPassword: string, 
    confirmNewPassword: string
  ): Promise<ResetPasswordResponse> {
    const startTime = Date.now();

    try {
      // Validate passwords match
      if (newPassword !== confirmNewPassword) {
        throw new PasswordsDoNotMatchError();
      }

      // Validate password strength
      this.validatePasswordStrength(newPassword);

      // Find and validate token
      const tokenRecord = await this.tokenRepository.findValidToken(
        token, 
        TokenType.PASSWORD_RESET
      );

      if (!tokenRecord) {
        throw new InvalidTokenError('password reset');
      }

      // Hash new password
      const passwordHash = await this.hashPassword(newPassword);

      // Update user password and mark token as used
      await Promise.all([
        this.userRepository.updatePassword(tokenRecord.userId, passwordHash),
        this.tokenRepository.markTokenAsUsed(tokenRecord.id)
      ]);

      appLogger.info('Password reset successful', {
        userId: tokenRecord.userId,
        duration: Date.now() - startTime
      });

      return {
        message: 'Password has been reset successfully. You can now login with your new password.'
      };
    } catch (error) {
      appLogger.error('Password reset failed', {
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      });

      if (this.isKnownError(error)) {
        throw error;
      }

      throw new SystemError(
        'Password reset failed due to system error',
        'SYSTEM_1003_PASSWORD_RESET_FAILED',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Verify email
   */
  async verifyEmail(token: string): Promise<VerifyEmailResponse> {
    const startTime = Date.now();

    try {
      // Find and validate token
      const tokenRecord = await this.tokenRepository.findValidToken(
        token,
        TokenType.EMAIL_VERIFICATION
      );

      if (!tokenRecord) {
        throw new InvalidTokenError('email verification');
      }

      // Verify user email and mark token as used
      const [user] = await Promise.all([
        this.userRepository.verifyEmail(tokenRecord.userId),
        this.tokenRepository.markTokenAsUsed(tokenRecord.id)
      ]);

      appLogger.info('Email verification successful', {
        userId: user.id,
        email: this.maskEmail(user.email),
        duration: Date.now() - startTime
      });

      return {
        message: 'Email verified successfully. You can now login to your account.',
        userId: user.id
      };
    } catch (error) {
      appLogger.error('Email verification failed', {
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      });

      if (this.isKnownError(error)) {
        throw error;
      }

      throw new SystemError(
        'Email verification failed due to system error',
        'SYSTEM_1004_EMAIL_VERIFICATION_FAILED',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(email: string): Promise<ResendVerificationResponse> {
    const startTime = Date.now();

    try {
      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        throw new UserNotFoundError(email);
      }

      if (user.isVerified) {
        return {
          message: 'Email is already verified.'
        };
      }

      // Revoke existing verification tokens
      await this.tokenRepository.revokeUserTokens(user.id, TokenType.EMAIL_VERIFICATION);

      // Generate new verification token
      const verificationToken = this.generateSecureToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours

      await this.tokenRepository.createVerificationToken(
        user.id,
        verificationToken,
        expiresAt
      );

      // Send verification email (non-blocking)
      this.sendVerificationEmailAsync(user.email, user.firstName, verificationToken);

      appLogger.info('Verification email resent', {
        userId: user.id,
        email: this.maskEmail(email),
        duration: Date.now() - startTime
      });

      return {
        message: 'Verification email has been sent. Please check your inbox.'
      };
    } catch (error) {
      appLogger.error('Resend verification email failed', {
        email: this.maskEmail(email),
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      });

      if (this.isKnownError(error)) {
        throw error;
      }

      throw new SystemError(
        'Resend verification email failed due to system error',
        'SYSTEM_1005_RESEND_VERIFICATION_FAILED',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Logout user
   */
  async logout(refreshToken: string): Promise<LogoutResponse> {
    try {
      // In this implementation, we don't store refresh tokens in database
      // For a more secure implementation, you should store and revoke them
      // For now, we just return success as tokens are stateless JWT
      
      appLogger.info('User logout successful');

      return {
        message: 'Logout successful'
      };
    } catch (error) {
      appLogger.error('Logout failed', {
        error: error instanceof Error ? error.message : String(error)
      });

      throw new SystemError(
        'Logout failed due to system error',
        'SYSTEM_1006_LOGOUT_FAILED',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Private helper methods
  private validateRegistrationData(data: RegisterUserInput): void {
    const { email, password, confirmPassword, firstName, lastName } = data;

    if (!email || !password || !confirmPassword || !firstName || !lastName) {
      throw new MissingRequiredFieldsError(['email', 'password', 'confirmPassword', 'firstName', 'lastName'].filter(field => !data[field as keyof RegisterUserInput]));
    }

    if (!validateEmail(email)) {
      throw new InvalidEmailFormatError(email);
    }

    if (password !== confirmPassword) {
      throw new PasswordsDoNotMatchError();
    }

    this.validatePasswordStrength(password);
  }

  private validatePasswordStrength(password: string): void {
    const validation = validatePassword(password);
    if (!validation.isValid) {
      if (password.length < 8) {
        throw new PasswordTooShortError();
      } else {
        throw new PasswordMissingRequirementsError(validation.errors);
      }
    }
  }

  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  private generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private generateAccessToken(userId: string, plan: SubscriptionPlan): string {
    return JWTUtils.generateAccessToken(userId, plan.toString());
  }

  private generateRefreshToken(userId: string): string {
    return JWTUtils.generateRefreshToken(userId, SubscriptionPlan.FREE.toString());
  }

  private maskEmail(email: string): string {
    return email.replace(/(?<=.{2}).(?=.*@)/g, '*');
  }

  private isKnownError(error: any): boolean {
    return error instanceof EmailAlreadyExistsError ||
           error instanceof MissingRequiredFieldsError ||
           error instanceof InvalidEmailFormatError ||
           error instanceof PasswordTooShortError ||
           error instanceof PasswordMissingRequirementsError ||
           error instanceof PasswordsDoNotMatchError ||
           error instanceof InvalidCredentialsError ||
           error instanceof EmailNotVerifiedError ||
           error instanceof UserAccountDeactivatedError ||
           error instanceof InvalidTokenError ||
           error instanceof TokenExpiredError ||
           error instanceof UserNotFoundError;
  }

  private sendVerificationEmailAsync(email: string, firstName: string, token: string): void {
    emailService.sendVerificationEmail(email, firstName, token).catch(error => {
      appLogger.error('Failed to send verification email', {
        email: this.maskEmail(email),
        error: error.message
      });
    });
  }

  private sendPasswordResetEmailAsync(email: string, firstName: string, token: string): void {
    emailService.sendPasswordResetEmail?.(email, firstName, token)?.catch(error => {
      appLogger.error('Failed to send password reset email', {
        email: this.maskEmail(email),
        error: error.message
      });
    });
  }
}

// Export singleton instance
const prisma = new PrismaClient();
export const authService = new AuthService(prisma); 