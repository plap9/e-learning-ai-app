import bcrypt from 'bcryptjs';
import { PasswordValidation, AuthConfig } from './types';

export class PasswordUtils {
  private saltRounds: number;

  constructor(config: AuthConfig) {
    this.saltRounds = config.bcryptSaltRounds;
  }

  /**
   * Hash password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  /**
   * Compare password with hash
   */
  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Validate password strength
   */
  validatePassword(password: string): PasswordValidation {
    const errors: string[] = [];

    // Check minimum length
    if (password.length < 8) {
      errors.push('Mật khẩu phải có ít nhất 8 ký tự');
    }

    // Check maximum length
    if (password.length > 128) {
      errors.push('Mật khẩu không được vượt quá 128 ký tự');
    }

    // Check for at least one lowercase letter
    if (!/[a-z]/.test(password)) {
      errors.push('Mật khẩu phải có ít nhất một chữ cái thường');
    }

    // Check for at least one uppercase letter
    if (!/[A-Z]/.test(password)) {
      errors.push('Mật khẩu phải có ít nhất một chữ cái hoa');
    }

    // Check for at least one number
    if (!/\d/.test(password)) {
      errors.push('Mật khẩu phải có ít nhất một chữ số');
    }

    // Check for at least one special character
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
      errors.push('Mật khẩu phải có ít nhất một ký tự đặc biệt');
    }

    // Check for common weak passwords
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123',
      'password123', 'admin', 'letmein', 'welcome', 'monkey',
      'dragon', 'master', 'shadow', 'hello', 'superman'
    ];

    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('Mật khẩu này quá phổ biến và không an toàn');
    }

    // Check for sequential characters
    if (this.hasSequentialCharacters(password)) {
      errors.push('Mật khẩu không được chứa ký tự liên tiếp (như abc, 123)');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check password strength level
   */
  getPasswordStrength(password: string): 'weak' | 'medium' | 'strong' | 'very-strong' {
    let score = 0;

    // Length score
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;

    // Character variety score
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) score += 1;

    // Pattern penalties
    if (this.hasRepeatedCharacters(password)) score -= 1;
    if (this.hasSequentialCharacters(password)) score -= 1;

    if (score <= 3) return 'weak';
    if (score <= 5) return 'medium';
    if (score <= 7) return 'strong';
    return 'very-strong';
  }

  /**
   * Generate a secure random password
   */
  generateSecurePassword(length: number = 16): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    const allChars = lowercase + uppercase + numbers + symbols;
    
    let password = '';
    
    // Ensure at least one character from each category
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * Check for repeated characters
   */
  private hasRepeatedCharacters(password: string): boolean {
    const repeatedPattern = /(.)\1{2,}/;
    return repeatedPattern.test(password);
  }

  /**
   * Check for sequential characters
   */
  private hasSequentialCharacters(password: string): boolean {
    const sequences = [
      'abcdefghijklmnopqrstuvwxyz',
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      '0123456789',
      'qwertyuiop',
      'asdfghjkl',
      'zxcvbnm'
    ];

    for (const sequence of sequences) {
      for (let i = 0; i <= sequence.length - 3; i++) {
        const subseq = sequence.substring(i, i + 3);
        if (password.toLowerCase().includes(subseq)) {
          return true;
        }
      }
    }

    return false;
  }
}

/**
 * Create password utilities instance
 */
export function createPasswordUtils(config?: Partial<AuthConfig>): PasswordUtils {
  const defaultConfig: AuthConfig = {
    jwtSecret: process.env.JWT_SECRET || 'fallback-secret-key',
    accessTokenExpiry: process.env.JWT_EXPIRES_IN || '15m',
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12')
  };

  return new PasswordUtils({ ...defaultConfig, ...config });
} 