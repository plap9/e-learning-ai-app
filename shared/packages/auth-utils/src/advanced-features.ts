// Simplified Advanced Security Features for Demo
import crypto from 'crypto';
import { UserPlan } from './types';

// Simple 2FA Implementation
export class SimpleTOTP {
  /**
   * Generate TOTP secret
   */
  static generateSecret(): string {
    return crypto.randomBytes(20).toString('hex');
  }

  /**
   * Generate TOTP code
   */
  static generateTOTP(secret: string, timestamp?: number): string {
    const time = Math.floor((timestamp || Date.now()) / 1000 / 30);
    const timeBuffer = Buffer.alloc(8);
    timeBuffer.writeBigUInt64BE(BigInt(time));

    const secretBuffer = Buffer.from(secret, 'hex');
    const hmac = crypto.createHmac('sha1', secretBuffer);
    hmac.update(timeBuffer);
    const hash = hmac.digest();

    const offset = hash[hash.length - 1] & 0xf;
    const binary = 
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff);

    const otp = binary % Math.pow(10, 6);
    return otp.toString().padStart(6, '0');
  }

  /**
   * Verify TOTP code
   */
  static verifyTOTP(token: string, secret: string): boolean {
    const currentTime = Date.now();
    
    // Check current and ±1 time windows
    for (let i = -1; i <= 1; i++) {
      const timeStep = currentTime + (i * 30 * 1000);
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
}

// Simple Rate Limiting
export class SimpleRateLimiter {
  private requests = new Map<string, number[]>();
  private limits: Record<UserPlan, { requests: number; windowMs: number }> = {
    [UserPlan.FREE]: { requests: 100, windowMs: 15 * 60 * 1000 },
    [UserPlan.PREMIUM]: { requests: 500, windowMs: 15 * 60 * 1000 },
    [UserPlan.ENTERPRISE]: { requests: 2000, windowMs: 15 * 60 * 1000 }
  };

  /**
   * Check rate limit
   */
  checkLimit(identifier: string, plan: UserPlan): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
  } {
    const limit = this.limits[plan];
    const now = Date.now();
    const windowStart = now - limit.windowMs;

    let userRequests = this.requests.get(identifier) || [];
    
    // Remove expired requests
    userRequests = userRequests.filter(time => time > windowStart);
    
    const allowed = userRequests.length < limit.requests;
    
    if (allowed) {
      userRequests.push(now);
      this.requests.set(identifier, userRequests);
    }
    
    return {
      allowed,
      remaining: Math.max(0, limit.requests - userRequests.length),
      resetTime: now + limit.windowMs
    };
  }

  /**
   * Reset user limits
   */
  reset(identifier: string): void {
    this.requests.delete(identifier);
  }
}

// Device Fingerprinting
export interface DeviceInfo {
  userAgent: string;
  ip: string;
  screenResolution?: string;
  timezone?: string;
  language?: string;
}

export class SimpleDeviceTracker {
  private devices = new Map<string, {
    hash: string;
    info: DeviceInfo;
    firstSeen: Date;
    lastSeen: Date;
    trustScore: number;
  }>();

  /**
   * Generate device fingerprint
   */
  generateFingerprint(device: DeviceInfo): string {
    const components = [
      device.userAgent,
      device.screenResolution || '',
      device.timezone || '',
      device.language || ''
    ].join('|');

    return crypto.createHash('sha256')
      .update(components + 'device-salt')
      .digest('hex');
  }

  /**
   * Register or update device
   */
  registerDevice(userId: string, device: DeviceInfo): {
    isNewDevice: boolean;
    trustScore: number;
    deviceId: string;
  } {
    const deviceId = this.generateFingerprint(device);
    const key = `${userId}:${deviceId}`;
    const existing = this.devices.get(key);

    if (existing) {
      existing.lastSeen = new Date();
      existing.trustScore = Math.min(100, existing.trustScore + 5);
      
      return {
        isNewDevice: false,
        trustScore: existing.trustScore,
        deviceId
      };
    } else {
      this.devices.set(key, {
        hash: deviceId,
        info: device,
        firstSeen: new Date(),
        lastSeen: new Date(),
        trustScore: 20 // New devices start with low trust
      });

      return {
        isNewDevice: true,
        trustScore: 20,
        deviceId
      };
    }
  }

  /**
   * Get user devices
   */
  getUserDevices(userId: string): Array<{
    deviceId: string;
    info: DeviceInfo;
    firstSeen: Date;
    lastSeen: Date;
    trustScore: number;
  }> {
    const userDevices: Array<any> = [];
    
    for (const [key, device] of this.devices.entries()) {
      if (key.startsWith(`${userId}:`)) {
        userDevices.push({
          deviceId: device.hash,
          info: device.info,
          firstSeen: device.firstSeen,
          lastSeen: device.lastSeen,
          trustScore: device.trustScore
        });
      }
    }
    
    return userDevices.sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime());
  }
}

// Security Monitoring
export enum SecurityEventType {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  SUSPICIOUS_LOGIN = 'SUSPICIOUS_LOGIN',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  NEW_DEVICE = 'NEW_DEVICE',
  BRUTE_FORCE = 'BRUTE_FORCE'
}

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  userId?: string;
  ip: string;
  userAgent: string;
  timestamp: Date;
  metadata: any;
}

export class SimpleSecurityMonitor {
  private events: SecurityEvent[] = [];
  private alerts: Array<{
    id: string;
    title: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    events: SecurityEvent[];
    createdAt: Date;
  }> = [];

  /**
   * Log security event
   */
  logEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): string {
    const securityEvent: SecurityEvent = {
      ...event,
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date()
    };

    this.events.push(securityEvent);

    // Check for patterns
    this.checkForPatterns(securityEvent);

    // Keep only last 1000 events
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }

    return securityEvent.id;
  }

  /**
   * Check for suspicious patterns
   */
  private checkForPatterns(event: SecurityEvent): void {
    // Brute force detection
    if (event.type === SecurityEventType.LOGIN_FAILURE) {
      const recentFailures = this.events.filter(e => 
        e.type === SecurityEventType.LOGIN_FAILURE &&
        e.ip === event.ip &&
        Date.now() - e.timestamp.getTime() < 15 * 60 * 1000 // Last 15 minutes
      );

      if (recentFailures.length >= 5) {
        this.createAlert(
          'Brute Force Attack Detected',
          'HIGH',
          recentFailures.slice(-5)
        );

        this.logEvent({
          type: SecurityEventType.BRUTE_FORCE,
          ip: event.ip,
          userAgent: event.userAgent,
          userId: event.userId,
          metadata: { attemptCount: recentFailures.length }
        });
      }
    }

    // Rate limiting alerts
    if (event.type === SecurityEventType.RATE_LIMIT_EXCEEDED) {
      const recentRateLimits = this.events.filter(e =>
        e.type === SecurityEventType.RATE_LIMIT_EXCEEDED &&
        e.ip === event.ip &&
        Date.now() - e.timestamp.getTime() < 5 * 60 * 1000 // Last 5 minutes
      );

      if (recentRateLimits.length >= 3) {
        this.createAlert(
          'Repeated Rate Limiting Violations',
          'MEDIUM',
          recentRateLimits
        );
      }
    }
  }

  /**
   * Create security alert
   */
  private createAlert(
    title: string,
    severity: 'LOW' | 'MEDIUM' | 'HIGH',
    relatedEvents: SecurityEvent[]
  ): void {
    const alert = {
      id: `alt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      title,
      severity,
      events: relatedEvents,
      createdAt: new Date()
    };

    this.alerts.push(alert);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    console.warn(`🚨 Security Alert [${severity}]: ${title}`);
  }

  /**
   * Get security dashboard
   */
  getDashboard(): {
    totalEvents: number;
    totalAlerts: number;
    recentEvents: SecurityEvent[];
    recentAlerts: any[];
    eventsByType: Record<string, number>;
  } {
    const eventsByType: Record<string, number> = {};
    
    this.events.forEach(event => {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
    });

    return {
      totalEvents: this.events.length,
      totalAlerts: this.alerts.length,
      recentEvents: this.events.slice(-10).reverse(),
      recentAlerts: this.alerts.slice(-5).reverse(),
      eventsByType
    };
  }
}

// Crypto Utilities
export class SimpleCrypto {
  /**
   * Generate secure PIN
   */
  static generateSecurePin(length: number = 6): string {
    let pin = '';
    for (let i = 0; i < length; i++) {
      pin += crypto.randomInt(0, 10).toString();
    }
    return pin;
  }

  /**
   * Hash PIN securely
   */
  static async hashPin(pin: string): Promise<{ hash: string; salt: string }> {
    const salt = crypto.randomBytes(32).toString('hex');
    
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(pin, salt, 100000, 64, 'sha512', (err, derivedKey) => {
        if (err) reject(err);
        else resolve({
          hash: derivedKey.toString('hex'),
          salt
        });
      });
    });
  }

  /**
   * Verify PIN
   */
  static async verifyPin(pin: string, hash: string, salt: string): Promise<boolean> {
    const result = await new Promise<Buffer>((resolve, reject) => {
      crypto.pbkdf2(pin, salt, 100000, 64, 'sha512', (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      });
    });

    return crypto.timingSafeEqual(
      Buffer.from(result.toString('hex'), 'hex'),
      Buffer.from(hash, 'hex')
    );
  }

  /**
   * Encrypt data
   */
  static encrypt(text: string, password: string): { encrypted: string; iv: string } {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(password, 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      encrypted,
      iv: iv.toString('hex')
    };
  }

  /**
   * Decrypt data
   */
  static decrypt(encryptedData: string, password: string, ivHex: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(password, 'salt', 32);
    const iv = Buffer.from(ivHex, 'hex');
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

// Export singleton instances
export const advancedSecurity = {
  totp: SimpleTOTP,
  rateLimiter: new SimpleRateLimiter(),
  deviceTracker: new SimpleDeviceTracker(),
  monitor: new SimpleSecurityMonitor(),
  crypto: SimpleCrypto
}; 