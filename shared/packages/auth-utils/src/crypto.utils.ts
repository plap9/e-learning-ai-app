import crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

// PIN Cryptographic Security
export class CryptoUtils {
  private static readonly PBKDF2_ITERATIONS = 100000;
  private static readonly PBKDF2_KEYLEN = 64;
  private static readonly PBKDF2_DIGEST = 'sha512';
  private static readonly SCRYPT_N = 32768;
  private static readonly SCRYPT_R = 8;
  private static readonly SCRYPT_P = 1;
  private static readonly SCRYPT_KEYLEN = 64;

  /**
   * Hash PIN bằng PBKDF2 cho bảo mật cao
   */
  static async hashPinPBKDF2(pin: string, salt?: string): Promise<{ hash: string; salt: string }> {
    const saltBuffer = salt ? Buffer.from(salt, 'hex') : crypto.randomBytes(32);
    
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(pin, saltBuffer, this.PBKDF2_ITERATIONS, this.PBKDF2_KEYLEN, this.PBKDF2_DIGEST, (err, derivedKey) => {
        if (err) reject(err);
        else resolve({
          hash: derivedKey.toString('hex'),
          salt: saltBuffer.toString('hex')
        });
      });
    });
  }

  /**
   * Hash PIN bằng Scrypt cho hiệu suất tốt
   */
  static async hashPinScrypt(pin: string, salt?: string): Promise<{ hash: string; salt: string }> {
    const saltBuffer = salt ? Buffer.from(salt, 'hex') : crypto.randomBytes(32);
    
    return new Promise((resolve, reject) => {
      crypto.scrypt(pin, saltBuffer, this.SCRYPT_KEYLEN, {
        N: this.SCRYPT_N,
        r: this.SCRYPT_R,
        p: this.SCRYPT_P
      }, (err, derivedKey) => {
        if (err) reject(err);
        else resolve({
          hash: derivedKey.toString('hex'),
          salt: saltBuffer.toString('hex')
        });
      });
    });
  }

  /**
   * Hash PIN bằng Argon2 (qua bcrypt với cost cao)
   */
  static async hashPinArgon2Style(pin: string): Promise<string> {
    const cost = 14; // Rất cao cho PIN security
    return bcrypt.hash(pin, cost);
  }

  /**
   * Verify PIN với các phương thức khác nhau
   */
  static async verifyPinPBKDF2(pin: string, hash: string, salt: string): Promise<boolean> {
    const result = await this.hashPinPBKDF2(pin, salt);
    return crypto.timingSafeEqual(Buffer.from(result.hash, 'hex'), Buffer.from(hash, 'hex'));
  }

  static async verifyPinScrypt(pin: string, hash: string, salt: string): Promise<boolean> {
    const result = await this.hashPinScrypt(pin, salt);
    return crypto.timingSafeEqual(Buffer.from(result.hash, 'hex'), Buffer.from(hash, 'hex'));
  }

  static async verifyPinArgon2Style(pin: string, hash: string): Promise<boolean> {
    return bcrypt.compare(pin, hash);
  }

  /**
   * Generate cryptographically secure random PIN
   */
  static generateSecurePin(length: number = 6): string {
    const digits = '0123456789';
    let pin = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, digits.length);
      pin += digits[randomIndex];
    }
    
    return pin;
  }

  /**
   * Generate secure random string
   */
  static generateRandomString(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Encrypt sensitive data
   */
  static encrypt(text: string, key: string): { encrypted: string; iv: string } {
    const algorithm = 'aes-256-gcm';
    const keyBuffer = crypto.scryptSync(key, 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv);
    cipher.setAAD(Buffer.from('additional-auth-data', 'utf8'));
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted: encrypted + ':' + authTag.toString('hex'),
      iv: iv.toString('hex')
    };
  }

  /**
   * Decrypt sensitive data
   */
  static decrypt(encryptedData: string, key: string, iv: string): string {
    const algorithm = 'aes-256-gcm';
    const keyBuffer = crypto.scryptSync(key, 'salt', 32);
    const ivBuffer = Buffer.from(iv, 'hex');
    
    const [encrypted, authTag] = encryptedData.split(':');
    
    if (!encrypted || !authTag) {
      throw new Error('Invalid encrypted data format');
    }
    
    const decipher = crypto.createDecipheriv(algorithm, keyBuffer, ivBuffer);
    decipher.setAAD(Buffer.from('additional-auth-data', 'utf8'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Hash device fingerprint
   */
  static hashDeviceFingerprint(fingerprint: string): string {
    return crypto.createHash('sha256')
      .update(fingerprint + process.env.DEVICE_FINGERPRINT_SALT || 'default-salt')
      .digest('hex');
  }

  /**
   * Generate secure session token
   */
  static generateSessionToken(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Validate PIN strength
   */
  static validatePinStrength(pin: string): {
    isValid: boolean;
    score: number;
    issues: string[];
  } {
    const issues: string[] = [];
    let score = 0;

    // Kiểm tra độ dài
    if (pin.length < 4) {
      issues.push('PIN quá ngắn (tối thiểu 4 ký tự)');
    } else if (pin.length >= 6) {
      score += 2;
    } else {
      score += 1;
    }

    // Kiểm tra không phải số tuần tự
    const isSequential = /^(0123|1234|2345|3456|4567|5678|6789)/.test(pin);
    if (isSequential) {
      issues.push('PIN không được là dãy số tuần tự');
      score -= 2;
    } else {
      score += 1;
    }

    // Kiểm tra không phải số lặp
    const isRepeating = /^(\d)\1{3,}$/.test(pin);
    if (isRepeating) {
      issues.push('PIN không được lặp cùng một số');
      score -= 2;
    } else {
      score += 1;
    }

    // Kiểm tra độ phức tạp
    const uniqueDigits = new Set(pin).size;
    if (uniqueDigits >= 4) {
      score += 2;
    } else if (uniqueDigits >= 3) {
      score += 1;
    }

    // Kiểm tra không phải pattern phổ biến
    const commonPatterns = ['0000', '1111', '1234', '0123', '1357', '2468'];
    if (commonPatterns.includes(pin)) {
      issues.push('PIN không được sử dụng pattern phổ biến');
      score -= 3;
    }

    return {
      isValid: issues.length === 0 && score >= 3,
      score: Math.max(0, Math.min(10, score)),
      issues
    };
  }
}

// IP Geolocation và Device Tracking
export interface GeolocationInfo {
  ip: string;
  country: string;
  countryCode: string;
  region: string;
  city: string;
  latitude: number;
  longitude: number;
  timezone: string;
  isp: string;
  asn: string;
  isVpn: boolean;
  isProxy: boolean;
  isTor: boolean;
  riskScore: number;
}

export class GeolocationTracker {
  private static cache = new Map<string, { data: GeolocationInfo; expiry: number }>();
  private static readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Lấy thông tin geolocation từ IP
   */
  static async getLocationInfo(ip: string): Promise<GeolocationInfo | null> {
    // Kiểm tra cache trước
    const cached = this.cache.get(ip);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    try {
      // Sử dụng IP-API (free tier)
      const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,city,lat,lon,timezone,isp,as,proxy,query`);
      const data = await response.json();

      if (data.status === 'success') {
        const locationInfo: GeolocationInfo = {
          ip: data.query,
          country: data.country,
          countryCode: data.countryCode,
          region: data.region,
          city: data.city,
          latitude: data.lat,
          longitude: data.lon,
          timezone: data.timezone,
          isp: data.isp,
          asn: data.as,
          isVpn: data.proxy,
          isProxy: data.proxy,
          isTor: this.checkTorExit(ip),
          riskScore: this.calculateRiskScore(data)
        };

        // Cache kết quả
        this.cache.set(ip, {
          data: locationInfo,
          expiry: Date.now() + this.CACHE_TTL
        });

        return locationInfo;
      }
    } catch (error) {
      console.error('Lỗi lấy thông tin geolocation:', error);
    }

    return null;
  }

  /**
   * Kiểm tra IP có phải Tor exit node
   */
  private static checkTorExit(ip: string): boolean {
    // Danh sách một số Tor exit nodes phổ biến
    const knownTorExits = [
      '199.87.154.251',
      '185.220.100.240',
      '185.220.100.241'
      // Thêm danh sách đầy đủ từ https://check.torproject.org/exit-addresses
    ];
    
    return knownTorExits.includes(ip);
  }

  /**
   * Tính toán risk score dựa trên thông tin IP
   */
  private static calculateRiskScore(data: any): number {
    let score = 0;

    // VPN/Proxy detection
    if (data.proxy) score += 30;

    // ISP analysis
    const suspiciousISPs = ['hosting', 'cloud', 'server', 'datacenter'];
    if (suspiciousISPs.some(keyword => 
      data.isp.toLowerCase().includes(keyword)
    )) {
      score += 20;
    }

    // Country risk (example)
    const highRiskCountries = ['CN', 'RU', 'KP', 'IR'];
    if (highRiskCountries.includes(data.countryCode)) {
      score += 15;
    }

    return Math.min(100, score);
  }

  /**
   * Phân tích pattern truy cập
   */
  static analyzeAccessPattern(
    currentLocation: GeolocationInfo,
    previousLocations: GeolocationInfo[]
  ): {
    isAnomaly: boolean;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    reasons: string[];
  } {
    const reasons: string[] = [];
    let riskScore = 0;

    if (previousLocations.length > 0) {
      const lastLocation = previousLocations[previousLocations.length - 1];

      if (lastLocation) {
        // Kiểm tra thay đổi quốc gia đột ngột
        if (currentLocation.countryCode !== lastLocation.countryCode) {
          reasons.push('Thay đổi quốc gia trong thời gian ngắn');
          riskScore += 40;
        }

        // Kiểm tra khoảng cách địa lý
        const distance = this.calculateDistance(
          currentLocation.latitude, currentLocation.longitude,
          lastLocation.latitude, lastLocation.longitude
        );

        if (distance > 1000) { // > 1000km
          reasons.push('Di chuyển địa lý bất thường');
          riskScore += 30;
        }

        // Kiểm tra timezone khác nhau
        if (currentLocation.timezone !== lastLocation.timezone) {
          reasons.push('Thay đổi múi giờ');
          riskScore += 20;
        }
      }
    }

    // Risk từ IP attributes
    riskScore += currentLocation.riskScore;

    if (currentLocation.isVpn || currentLocation.isProxy) {
      reasons.push('Sử dụng VPN/Proxy');
    }

    if (currentLocation.isTor) {
      reasons.push('Truy cập qua Tor network');
      riskScore += 50;
    }

    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (riskScore >= 70) riskLevel = 'HIGH';
    else if (riskScore >= 40) riskLevel = 'MEDIUM';

    return {
      isAnomaly: riskScore >= 40,
      riskLevel,
      reasons
    };
  }

  /**
   * Tính khoảng cách giữa 2 tọa độ (Haversine formula)
   */
  private static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Clear expired cache entries
   */
  static clearExpiredCache(): void {
    const now = Date.now();
    for (const [ip, cached] of this.cache.entries()) {
      if (cached.expiry <= now) {
        this.cache.delete(ip);
      }
    }
  }
} 