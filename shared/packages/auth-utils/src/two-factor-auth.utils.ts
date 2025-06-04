import crypto from 'crypto';

// TOTP (Time-based One-Time Password) Implementation
export class TOTPUtils {
  private static readonly DIGITS = 6;
  private static readonly PERIOD = 30; // seconds
  private static readonly ALGORITHM = 'sha1';
  private static readonly ISSUER = 'E-Learning AI App';

  /**
   * Generate TOTP secret cho user
   */
  static generateSecret(): string {
    const bytes = crypto.randomBytes(20);
    return this.base32Encode(bytes);
  }

  /**
   * Base32 encode function
   */
  private static base32Encode(buffer: Buffer): string {
    const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let result = '';
    let bits = 0;
    let value = 0;

    for (let i = 0; i < buffer.length; i++) {
      value = (value << 8) | buffer[i];
      bits += 8;

      while (bits >= 5) {
        result += base32Chars[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    if (bits > 0) {
      result += base32Chars[(value << (5 - bits)) & 31];
    }

    // Pad with '=' to make length multiple of 8
    while (result.length % 8 !== 0) {
      result += '=';
    }

    return result;
  }

  /**
   * Generate TOTP code từ secret
   */
  static generateTOTP(secret: string, timestamp?: number): string {
    const time = Math.floor((timestamp || Date.now()) / 1000 / this.PERIOD);
    const timeBuffer = Buffer.alloc(8);
    timeBuffer.writeBigUInt64BE(BigInt(time));

    const secretBuffer = this.base32ToBuffer(secret);
    const hmac = crypto.createHmac(this.ALGORITHM, secretBuffer);
    hmac.update(timeBuffer);
    const hash = hmac.digest();

    const offset = hash[hash.length - 1] & 0xf;
    const binary = 
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff);

    const otp = binary % Math.pow(10, this.DIGITS);
    return otp.toString().padStart(this.DIGITS, '0');
  }

  /**
   * Verify TOTP code
   */
  static verifyTOTP(token: string, secret: string, window: number = 1): boolean {
    const currentTime = Date.now();
    
    // Kiểm tra window time để accommodate clock drift
    for (let i = -window; i <= window; i++) {
      const timeStep = currentTime + (i * this.PERIOD * 1000);
      const expectedToken = this.generateTOTP(secret, timeStep);
      
      if (crypto.timingSafeEqual(
        Buffer.from(token, 'utf8'),
        Buffer.from(expectedToken, 'utf8')
      )) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Generate QR Code URL cho Google Authenticator
   */
  static generateQRCodeURL(secret: string, userEmail: string, issuer?: string): string {
    const serviceName = issuer || this.ISSUER;
    const otpauthURL = `otpauth://totp/${encodeURIComponent(serviceName)}:${encodeURIComponent(userEmail)}?secret=${secret}&issuer=${encodeURIComponent(serviceName)}&algorithm=${this.ALGORITHM}&digits=${this.DIGITS}&period=${this.PERIOD}`;
    return otpauthURL;
  }

  /**
   * Generate QR Code image (simplified - returns URL for external QR generator)
   */
  static async generateQRCode(secret: string, userEmail: string): Promise<string> {
    const url = this.generateQRCodeURL(secret, userEmail);
    // Return Google Charts QR Code API URL
    return `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(url)}`;
  }

  /**
   * Generate backup codes
   */
  static generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
  }

  /**
   * Convert base32 to buffer
   */
  private static base32ToBuffer(base32: string): Buffer {
    const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = '';
    
    for (const char of base32.toUpperCase()) {
      const index = base32Chars.indexOf(char);
      if (index === -1) continue;
      bits += index.toString(2).padStart(5, '0');
    }
    
    const bytes: number[] = [];
    for (let i = 0; i < bits.length; i += 8) {
      const byte = bits.substr(i, 8);
      if (byte.length === 8) {
        bytes.push(parseInt(byte, 2));
      }
    }
    
    return Buffer.from(bytes);
  }
}

// SMS-based 2FA Implementation
export interface SMSProvider {
  sendSMS(phoneNumber: string, message: string): Promise<boolean>;
}

export class TwilioSMSProvider implements SMSProvider {
  constructor(
    private accountSid: string,
    private authToken: string,
    private fromNumber: string
  ) {}

  async sendSMS(phoneNumber: string, message: string): Promise<boolean> {
    try {
      // Twilio REST API call simulation
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          From: this.fromNumber,
          To: phoneNumber,
          Body: message
        })
      });

      return response.ok;
    } catch (error) {
      console.error('Twilio SMS error:', error);
      return false;
    }
  }
}

export class ESMS_Provider implements SMSProvider {
  constructor(
    private apiKey: string,
    private secretKey: string,
    private brandName: string = 'E-Learning'
  ) {}

  async sendSMS(phoneNumber: string, message: string): Promise<boolean> {
    try {
      // eSMS.vn API call
      const response = await fetch('http://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ApiKey: this.apiKey,
          Content: message,
          Phone: phoneNumber,
          SecretKey: this.secretKey,
          SmsType: 2,
          Brandname: this.brandName
        })
      });

      const result = await response.json();
      return result.CodeResult === '100';
    } catch (error) {
      console.error('eSMS error:', error);
      return false;
    }
  }
}

export class SMS2FAManager {
  private smsProvider: SMSProvider;
  private codeStore = new Map<string, { code: string; expiry: number; attempts: number }>();
  private static readonly CODE_LENGTH = 6;
  private static readonly CODE_EXPIRY = 5 * 60 * 1000; // 5 minutes
  private static readonly MAX_ATTEMPTS = 3;

  constructor(smsProvider: SMSProvider) {
    this.smsProvider = smsProvider;
  }

  /**
   * Send SMS verification code
   */
  async sendVerificationCode(phoneNumber: string, userLanguage: 'vi' | 'en' = 'vi'): Promise<boolean> {
    // Generate 6-digit code
    const code = this.generateSMSCode();
    const expiry = Date.now() + SMS2FAManager.CODE_EXPIRY;

    // Store code
    this.codeStore.set(phoneNumber, {
      code,
      expiry,
      attempts: 0
    });

    // Prepare message
    const messages = {
      vi: `Mã xác thực của bạn là: ${code}. Mã có hiệu lực trong 5 phút.`,
      en: `Your verification code is: ${code}. Code expires in 5 minutes.`
    };

    const message = messages[userLanguage];

    // Send SMS
    return this.smsProvider.sendSMS(phoneNumber, message);
  }

  /**
   * Verify SMS code
   */
  verifyCode(phoneNumber: string, inputCode: string): { 
    isValid: boolean; 
    attemptsLeft: number;
    error?: string;
  } {
    const stored = this.codeStore.get(phoneNumber);
    
    if (!stored) {
      return { 
        isValid: false, 
        attemptsLeft: 0,
        error: 'Không tìm thấy mã xác thực. Vui lòng yêu cầu mã mới.'
      };
    }

    // Check expiry
    if (Date.now() > stored.expiry) {
      this.codeStore.delete(phoneNumber);
      return { 
        isValid: false, 
        attemptsLeft: 0,
        error: 'Mã xác thực đã hết hạn. Vui lòng yêu cầu mã mới.'
      };
    }

    // Check attempts
    if (stored.attempts >= SMS2FAManager.MAX_ATTEMPTS) {
      this.codeStore.delete(phoneNumber);
      return { 
        isValid: false, 
        attemptsLeft: 0,
        error: 'Đã vượt quá số lần thử. Vui lòng yêu cầu mã mới.'
      };
    }

    // Verify code
    stored.attempts++;
    const isValid = crypto.timingSafeEqual(
      Buffer.from(inputCode, 'utf8'),
      Buffer.from(stored.code, 'utf8')
    );

    if (isValid) {
      this.codeStore.delete(phoneNumber);
      return { isValid: true, attemptsLeft: 0 };
    } else {
      const attemptsLeft = SMS2FAManager.MAX_ATTEMPTS - stored.attempts;
      return { 
        isValid: false, 
        attemptsLeft,
        error: `Mã xác thực không đúng. Còn ${attemptsLeft} lần thử.`
      };
    }
  }

  /**
   * Generate SMS verification code
   */
  private generateSMSCode(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Clear expired codes
   */
  clearExpiredCodes(): void {
    const now = Date.now();
    for (const [phone, data] of this.codeStore.entries()) {
      if (data.expiry <= now) {
        this.codeStore.delete(phone);
      }
    }
  }
}

// Unified 2FA Manager
export interface TwoFactorMethod {
  type: 'totp' | 'sms' | 'backup';
  isEnabled: boolean;
  identifier: string; // secret for TOTP, phone for SMS
  backupCodes?: string[];
  createdAt: Date;
  lastUsed?: Date;
}

export class TwoFactorAuthManager {
  private sms2FA: SMS2FAManager;

  constructor(smsProvider: SMSProvider) {
    this.sms2FA = new SMS2FAManager(smsProvider);
  }

  /**
   * Setup TOTP for user
   */
  async setupTOTP(userEmail: string): Promise<{
    secret: string;
    qrCodeURL: string;
    qrCodeImage: string;
    backupCodes: string[];
  }> {
    const secret = TOTPUtils.generateSecret();
    const qrCodeURL = TOTPUtils.generateQRCodeURL(secret, userEmail);
    const qrCodeImage = await TOTPUtils.generateQRCode(secret, userEmail);
    const backupCodes = TOTPUtils.generateBackupCodes();

    return {
      secret,
      qrCodeURL,
      qrCodeImage,
      backupCodes
    };
  }

  /**
   * Verify 2FA code (supports multiple methods)
   */
  async verify2FA(
    method: TwoFactorMethod,
    code: string,
    phoneNumber?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      switch (method.type) {
        case 'totp':
          const isValidTOTP = TOTPUtils.verifyTOTP(code, method.identifier);
          return { 
            success: isValidTOTP,
            error: isValidTOTP ? undefined : 'Mã TOTP không hợp lệ'
          };

        case 'sms':
          if (!phoneNumber) {
            return { success: false, error: 'Thiếu số điện thoại' };
          }
          const smsResult = this.sms2FA.verifyCode(phoneNumber, code);
          return {
            success: smsResult.isValid,
            error: smsResult.error
          };

        case 'backup':
          if (!method.backupCodes) {
            return { success: false, error: 'Không có backup codes' };
          }
          const isValidBackup = method.backupCodes.includes(code.toUpperCase());
          if (isValidBackup) {
            // Remove used backup code
            method.backupCodes = method.backupCodes.filter(c => c !== code.toUpperCase());
          }
          return {
            success: isValidBackup,
            error: isValidBackup ? undefined : 'Backup code không hợp lệ'
          };

        default:
          return { success: false, error: 'Phương thức 2FA không được hỗ trợ' };
      }
    } catch (error) {
      return { 
        success: false, 
        error: `Lỗi xác thực 2FA: ${(error as Error).message}` 
      };
    }
  }

  /**
   * Send SMS code
   */
  async sendSMSCode(phoneNumber: string, language: 'vi' | 'en' = 'vi'): Promise<boolean> {
    return this.sms2FA.sendVerificationCode(phoneNumber, language);
  }

  /**
   * Generate new backup codes
   */
  generateNewBackupCodes(): string[] {
    return TOTPUtils.generateBackupCodes();
  }

  /**
   * Validate 2FA setup requirements
   */
  validate2FASetup(methods: TwoFactorMethod[]): {
    isValid: boolean;
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    const enabledMethods = methods.filter(m => m.isEnabled);

    if (enabledMethods.length === 0) {
      recommendations.push('Nên kích hoạt ít nhất một phương thức 2FA');
    }

    const hasTOTP = enabledMethods.some(m => m.type === 'totp');
    const hasSMS = enabledMethods.some(m => m.type === 'sms');
    const hasBackup = enabledMethods.some(m => m.type === 'backup' && m.backupCodes && m.backupCodes.length > 0);

    if (!hasTOTP && !hasSMS) {
      recommendations.push('Nên có ít nhất TOTP hoặc SMS 2FA');
    }

    if (enabledMethods.length > 0 && !hasBackup) {
      recommendations.push('Nên có backup codes để phòng trường hợp mất thiết bị');
    }

    if (hasTOTP && !hasSMS) {
      recommendations.push('Nên thêm SMS backup cho trường hợp mất app authenticator');
    }

    return {
      isValid: enabledMethods.length > 0,
      recommendations
    };
  }
}

// Rate limiting for 2FA attempts
export class TwoFactorRateLimit {
  private attempts = new Map<string, { count: number; resetTime: number }>();
  private static readonly MAX_ATTEMPTS = 5;
  private static readonly WINDOW_MS = 15 * 60 * 1000; // 15 minutes

  /**
   * Check if user can attempt 2FA
   */
  canAttempt(identifier: string): { allowed: boolean; timeLeft?: number } {
    const now = Date.now();
    const userAttempts = this.attempts.get(identifier);

    if (!userAttempts || now > userAttempts.resetTime) {
      // Reset or first attempt
      this.attempts.set(identifier, { count: 0, resetTime: now + TwoFactorRateLimit.WINDOW_MS });
      return { allowed: true };
    }

    if (userAttempts.count >= TwoFactorRateLimit.MAX_ATTEMPTS) {
      return { 
        allowed: false, 
        timeLeft: userAttempts.resetTime - now 
      };
    }

    return { allowed: true };
  }

  /**
   * Record 2FA attempt
   */
  recordAttempt(identifier: string, success: boolean): void {
    const now = Date.now();
    let userAttempts = this.attempts.get(identifier);

    if (!userAttempts || now > userAttempts.resetTime) {
      userAttempts = { count: 0, resetTime: now + TwoFactorRateLimit.WINDOW_MS };
    }

    if (!success) {
      userAttempts.count++;
    } else {
      // Reset on successful attempt
      userAttempts.count = 0;
    }

    this.attempts.set(identifier, userAttempts);
  }

  /**
   * Clear expired rate limit records
   */
  clearExpired(): void {
    const now = Date.now();
    for (const [identifier, attempts] of this.attempts.entries()) {
      if (now > attempts.resetTime) {
        this.attempts.delete(identifier);
      }
    }
  }
} 