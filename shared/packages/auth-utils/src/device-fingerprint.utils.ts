import crypto from 'crypto';

// Device Fingerprinting
export interface DeviceFingerprint {
  userAgent: string;
  screenResolution: string;
  timezone: string;
  language: string;
  platform: string;
  colorDepth: number;
  hardwareConcurrency: number;
  deviceMemory?: number;
  canvas?: string;
  webgl?: string;
  audio?: string;
  fonts?: string[];
  plugins?: string[];
  cookieEnabled: boolean;
  doNotTrack: boolean;
  ip: string;
  headers: Record<string, string>;
}

export interface ProcessedFingerprint {
  hash: string;
  riskScore: number;
  deviceType: 'mobile' | 'desktop' | 'tablet' | 'unknown';
  browserFamily: string;
  osFamily: string;
  isBot: boolean;
  confidence: number;
  createdAt: Date;
}

export class DeviceFingerprintManager {
  private static readonly FINGERPRINT_VERSION = '1.0';
  private static knownDevices = new Map<string, ProcessedFingerprint>();
  private static suspiciousFingerprints = new Set<string>();

  /**
   * Process raw fingerprint data
   */
  static processFingerprint(raw: DeviceFingerprint): ProcessedFingerprint {
    const hash = this.generateFingerprintHash(raw);
    const deviceType = this.detectDeviceType(raw);
    const browserInfo = this.parseBrowserInfo(raw.userAgent);
    const osInfo = this.parseOSInfo(raw.userAgent);
    const riskScore = this.calculateRiskScore(raw);
    const isBot = this.detectBot(raw);
    const confidence = this.calculateConfidence(raw);

    const processed: ProcessedFingerprint = {
      hash,
      riskScore,
      deviceType,
      browserFamily: browserInfo.family,
      osFamily: osInfo.family,
      isBot,
      confidence,
      createdAt: new Date()
    };

    // Cache device
    this.knownDevices.set(hash, processed);

    return processed;
  }

  /**
   * Generate unique fingerprint hash
   */
  private static generateFingerprintHash(fingerprint: DeviceFingerprint): string {
    const components = [
      fingerprint.userAgent,
      fingerprint.screenResolution,
      fingerprint.timezone,
      fingerprint.language,
      fingerprint.platform,
      fingerprint.colorDepth.toString(),
      fingerprint.hardwareConcurrency.toString(),
      fingerprint.deviceMemory?.toString() || '',
      fingerprint.canvas || '',
      fingerprint.webgl || '',
      fingerprint.audio || '',
      (fingerprint.fonts || []).join(','),
      (fingerprint.plugins || []).join(','),
      fingerprint.cookieEnabled.toString(),
      fingerprint.doNotTrack.toString(),
      this.FINGERPRINT_VERSION
    ].join('|');

    return crypto.createHash('sha256')
      .update(components + (process.env.FINGERPRINT_SALT || 'default-salt'))
      .digest('hex');
  }

  /**
   * Detect device type from fingerprint
   */
  private static detectDeviceType(fingerprint: DeviceFingerprint): 'mobile' | 'desktop' | 'tablet' | 'unknown' {
    const ua = fingerprint.userAgent.toLowerCase();
    
    if (/mobile|android|iphone|ipod|blackberry|opera mini|iemobile|wpdesktop/.test(ua)) {
      return 'mobile';
    }
    
    if (/tablet|ipad|android(?!.*mobile)/.test(ua)) {
      return 'tablet';
    }
    
    if (/windows|macintosh|linux/.test(ua)) {
      return 'desktop';
    }
    
    return 'unknown';
  }

  /**
   * Parse browser information
   */
  private static parseBrowserInfo(userAgent: string): { family: string; version: string } {
    const ua = userAgent.toLowerCase();
    
    if (ua.includes('chrome')) {
      const match = ua.match(/chrome\/(\d+\.\d+)/);
      return { family: 'Chrome', version: match?.[1] || 'unknown' };
    }
    
    if (ua.includes('firefox')) {
      const match = ua.match(/firefox\/(\d+\.\d+)/);
      return { family: 'Firefox', version: match?.[1] || 'unknown' };
    }
    
    if (ua.includes('safari') && !ua.includes('chrome')) {
      const match = ua.match(/version\/(\d+\.\d+)/);
      return { family: 'Safari', version: match?.[1] || 'unknown' };
    }
    
    if (ua.includes('edge')) {
      const match = ua.match(/edge\/(\d+\.\d+)/);
      return { family: 'Edge', version: match?.[1] || 'unknown' };
    }
    
    return { family: 'Unknown', version: 'unknown' };
  }

  /**
   * Parse OS information
   */
  private static parseOSInfo(userAgent: string): { family: string; version: string } {
    const ua = userAgent.toLowerCase();
    
    if (ua.includes('windows')) {
      if (ua.includes('windows nt 10')) return { family: 'Windows', version: '10' };
      if (ua.includes('windows nt 6.3')) return { family: 'Windows', version: '8.1' };
      if (ua.includes('windows nt 6.1')) return { family: 'Windows', version: '7' };
      return { family: 'Windows', version: 'unknown' };
    }
    
    if (ua.includes('macintosh') || ua.includes('mac os x')) {
      const match = ua.match(/mac os x (\d+_\d+)/);
      const version = match?.[1]?.replace('_', '.') || 'unknown';
      return { family: 'macOS', version };
    }
    
    if (ua.includes('linux')) {
      return { family: 'Linux', version: 'unknown' };
    }
    
    if (ua.includes('android')) {
      const match = ua.match(/android (\d+\.\d+)/);
      return { family: 'Android', version: match?.[1] || 'unknown' };
    }
    
    if (ua.includes('iphone') || ua.includes('ipad')) {
      const match = ua.match(/os (\d+_\d+)/);
      const version = match?.[1]?.replace('_', '.') || 'unknown';
      return { family: 'iOS', version };
    }
    
    return { family: 'Unknown', version: 'unknown' };
  }

  /**
   * Calculate risk score
   */
  private static calculateRiskScore(fingerprint: DeviceFingerprint): number {
    let score = 0;

    // Check for automation indicators
    if (fingerprint.userAgent.includes('headless')) score += 50;
    if (fingerprint.userAgent.includes('selenium')) score += 60;
    if (fingerprint.userAgent.includes('phantomjs')) score += 60;
    if (fingerprint.userAgent.includes('bot')) score += 40;

    // Unusual screen resolutions
    const resolution = fingerprint.screenResolution;
    const commonResolutions = ['1920x1080', '1366x768', '1280x720', '1440x900', '1600x900'];
    if (!commonResolutions.includes(resolution)) score += 10;

    // Missing standard features
    if (!fingerprint.cookieEnabled) score += 20;
    if (fingerprint.colorDepth < 16) score += 15;
    if (fingerprint.hardwareConcurrency === 0) score += 10;

    // Empty fingerprint components
    if (!fingerprint.canvas) score += 15;
    if (!fingerprint.webgl) score += 10;
    if (!fingerprint.fonts || fingerprint.fonts.length === 0) score += 20;
    if (!fingerprint.plugins || fingerprint.plugins.length === 0) score += 15;

    // Perfect fingerprint (too consistent)
    const entropy = this.calculateEntropy(fingerprint);
    if (entropy < 2) score += 30; // Too little variation

    return Math.min(100, score);
  }

  /**
   * Bot detection
   */
  private static detectBot(fingerprint: DeviceFingerprint): boolean {
    const ua = fingerprint.userAgent.toLowerCase();
    
    const botIndicators = [
      'bot', 'crawler', 'spider', 'scraper', 'headless',
      'selenium', 'phantomjs', 'webdriver', 'automated',
      'test', 'monitor', 'check', 'audit'
    ];

    // Check User Agent
    if (botIndicators.some(indicator => ua.includes(indicator))) {
      return true;
    }

    // Check for missing browser features
    if (!fingerprint.canvas && !fingerprint.webgl) {
      return true;
    }

    // Check for impossible combinations
    if (fingerprint.hardwareConcurrency === 0 && fingerprint.deviceMemory === 0) {
      return true;
    }

    return false;
  }

  /**
   * Calculate fingerprint confidence
   */
  private static calculateConfidence(fingerprint: DeviceFingerprint): number {
    let confidence = 0;

    // Strong indicators
    if (fingerprint.canvas) confidence += 25;
    if (fingerprint.webgl) confidence += 20;
    if (fingerprint.audio) confidence += 15;
    if (fingerprint.fonts && fingerprint.fonts.length > 0) confidence += 15;
    if (fingerprint.plugins && fingerprint.plugins.length > 0) confidence += 10;

    // Basic indicators
    if (fingerprint.screenResolution !== 'unknown') confidence += 5;
    if (fingerprint.timezone !== 'unknown') confidence += 5;
    if (fingerprint.language !== 'unknown') confidence += 5;

    return Math.min(100, confidence);
  }

  /**
   * Calculate entropy
   */
  private static calculateEntropy(fingerprint: DeviceFingerprint): number {
    const components = [
      fingerprint.userAgent,
      fingerprint.screenResolution,
      fingerprint.timezone,
      fingerprint.language,
      fingerprint.platform,
      fingerprint.colorDepth.toString(),
      fingerprint.hardwareConcurrency.toString()
    ];

    const uniqueValues = new Set(components).size;
    return uniqueValues / components.length;
  }

  /**
   * Compare fingerprints
   */
  static compareFingerprints(fp1: string, fp2: string): {
    similarity: number;
    isSameDevice: boolean;
    changedComponents: string[];
  } {
    const device1 = this.knownDevices.get(fp1);
    const device2 = this.knownDevices.get(fp2);

    if (!device1 || !device2) {
      return {
        similarity: 0,
        isSameDevice: false,
        changedComponents: ['Device not found']
      };
    }

    const similarity = this.calculateSimilarity(device1, device2);
    const isSameDevice = similarity > 0.8; // 80% similarity threshold

    return {
      similarity,
      isSameDevice,
      changedComponents: this.getChangedComponents(device1, device2)
    };
  }

  /**
   * Calculate similarity between two devices
   */
  private static calculateSimilarity(device1: ProcessedFingerprint, device2: ProcessedFingerprint): number {
    let matches = 0;
    let total = 0;

    // Compare key components
    const comparisons = [
      device1.deviceType === device2.deviceType,
      device1.browserFamily === device2.browserFamily,
      device1.osFamily === device2.osFamily
    ];

    comparisons.forEach(match => {
      if (match) matches++;
      total++;
    });

    return total > 0 ? matches / total : 0;
  }

  /**
   * Get changed components between devices
   */
  private static getChangedComponents(device1: ProcessedFingerprint, device2: ProcessedFingerprint): string[] {
    const changes: string[] = [];

    if (device1.deviceType !== device2.deviceType) {
      changes.push(`Device type: ${device1.deviceType} -> ${device2.deviceType}`);
    }

    if (device1.browserFamily !== device2.browserFamily) {
      changes.push(`Browser: ${device1.browserFamily} -> ${device2.browserFamily}`);
    }

    if (device1.osFamily !== device2.osFamily) {
      changes.push(`OS: ${device1.osFamily} -> ${device2.osFamily}`);
    }

    return changes;
  }

  /**
   * Mark fingerprint as suspicious
   */
  static markSuspicious(fingerprintHash: string, reason: string): void {
    this.suspiciousFingerprints.add(fingerprintHash);
    console.warn(`Fingerprint marked suspicious: ${fingerprintHash} - ${reason}`);
  }

  /**
   * Check if fingerprint is suspicious
   */
  static isSuspicious(fingerprintHash: string): boolean {
    return this.suspiciousFingerprints.has(fingerprintHash);
  }

  /**
   * Get device statistics
   */
  static getDeviceStatistics(): {
    totalDevices: number;
    deviceTypes: Record<string, number>;
    browsers: Record<string, number>;
    operatingSystems: Record<string, number>;
    suspiciousDevices: number;
    averageRiskScore: number;
  } {
    const devices = Array.from(this.knownDevices.values());
    
    const deviceTypes: Record<string, number> = {};
    const browsers: Record<string, number> = {};
    const operatingSystems: Record<string, number> = {};
    let totalRiskScore = 0;

    devices.forEach(device => {
      deviceTypes[device.deviceType] = (deviceTypes[device.deviceType] || 0) + 1;
      browsers[device.browserFamily] = (browsers[device.browserFamily] || 0) + 1;
      operatingSystems[device.osFamily] = (operatingSystems[device.osFamily] || 0) + 1;
      totalRiskScore += device.riskScore;
    });

    return {
      totalDevices: devices.length,
      deviceTypes,
      browsers,
      operatingSystems,
      suspiciousDevices: this.suspiciousFingerprints.size,
      averageRiskScore: devices.length > 0 ? totalRiskScore / devices.length : 0
    };
  }

  /**
   * Clean up old fingerprints
   */
  static cleanupOldFingerprints(maxAge: number = 30 * 24 * 60 * 60 * 1000): void {
    const cutoff = new Date(Date.now() - maxAge);
    
    for (const [hash, device] of this.knownDevices.entries()) {
      if (device.createdAt < cutoff) {
        this.knownDevices.delete(hash);
      }
    }
  }
}

// Anomaly Detection System
export interface UserBehaviorPattern {
  userId: string;
  loginTimes: number[];
  ipAddresses: string[];
  devices: string[];
  locations: string[];
  activityPatterns: {
    averageSessionDuration: number;
    commonPages: string[];
    typicalActions: string[];
  };
  lastUpdated: Date;
}

export class AnomalyDetector {
  private userPatterns = new Map<string, UserBehaviorPattern>();
  private anomalies: Array<{
    userId: string;
    type: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    description: string;
    timestamp: Date;
    metadata: any;
  }> = [];

  /**
   * Update user behavior pattern
   */
  updateUserPattern(userId: string, activity: {
    loginTime?: number;
    ipAddress?: string;
    deviceFingerprint?: string;
    location?: string;
    sessionDuration?: number;
    pagesVisited?: string[];
    actions?: string[];
  }): void {
    let pattern = this.userPatterns.get(userId);
    
    if (!pattern) {
      pattern = {
        userId,
        loginTimes: [],
        ipAddresses: [],
        devices: [],
        locations: [],
        activityPatterns: {
          averageSessionDuration: 0,
          commonPages: [],
          typicalActions: []
        },
        lastUpdated: new Date()
      };
    }

    // Update patterns
    if (activity.loginTime) {
      pattern.loginTimes.push(activity.loginTime);
      if (pattern.loginTimes.length > 100) {
        pattern.loginTimes = pattern.loginTimes.slice(-100); // Keep last 100
      }
    }

    if (activity.ipAddress && !pattern.ipAddresses.includes(activity.ipAddress)) {
      pattern.ipAddresses.push(activity.ipAddress);
      if (pattern.ipAddresses.length > 20) {
        pattern.ipAddresses = pattern.ipAddresses.slice(-20);
      }
    }

    if (activity.deviceFingerprint && !pattern.devices.includes(activity.deviceFingerprint)) {
      pattern.devices.push(activity.deviceFingerprint);
      if (pattern.devices.length > 10) {
        pattern.devices = pattern.devices.slice(-10);
      }
    }

    if (activity.location && !pattern.locations.includes(activity.location)) {
      pattern.locations.push(activity.location);
      if (pattern.locations.length > 10) {
        pattern.locations = pattern.locations.slice(-10);
      }
    }

    pattern.lastUpdated = new Date();
    this.userPatterns.set(userId, pattern);
  }

  /**
   * Detect anomalies in user behavior
   */
  detectAnomalies(userId: string, currentActivity: {
    loginTime: number;
    ipAddress: string;
    deviceFingerprint: string;
    location: string;
    sessionDuration?: number;
  }): Array<{
    type: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    description: string;
    confidence: number;
  }> {
    const pattern = this.userPatterns.get(userId);
    const anomalies: Array<{
      type: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH';
      description: string;
      confidence: number;
    }> = [];

    if (!pattern) {
      // New user, no pattern to compare
      return anomalies;
    }

    // Unusual login time
    const timeAnomaly = this.detectTimeAnomaly(currentActivity.loginTime, pattern.loginTimes);
    if (timeAnomaly) {
      anomalies.push(timeAnomaly);
    }

    // New IP address
    if (!pattern.ipAddresses.includes(currentActivity.ipAddress)) {
      anomalies.push({
        type: 'NEW_IP_ADDRESS',
        severity: 'MEDIUM',
        description: `Đăng nhập từ IP mới: ${currentActivity.ipAddress}`,
        confidence: 0.8
      });
    }

    // New device
    if (!pattern.devices.includes(currentActivity.deviceFingerprint)) {
      anomalies.push({
        type: 'NEW_DEVICE',
        severity: 'HIGH',
        description: 'Đăng nhập từ thiết bị mới',
        confidence: 0.9
      });
    }

    // New location
    if (!pattern.locations.includes(currentActivity.location)) {
      anomalies.push({
        type: 'NEW_LOCATION',
        severity: 'MEDIUM',
        description: `Đăng nhập từ vị trí mới: ${currentActivity.location}`,
        confidence: 0.7
      });
    }

    // Store detected anomalies
    anomalies.forEach(anomaly => {
      this.anomalies.push({
        userId,
        type: anomaly.type,
        severity: anomaly.severity,
        description: anomaly.description,
        timestamp: new Date(),
        metadata: currentActivity
      });
    });

    return anomalies;
  }

  /**
   * Detect time-based anomalies
   */
  private detectTimeAnomaly(currentTime: number, historicalTimes: number[]): {
    type: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    description: string;
    confidence: number;
  } | null {
    if (historicalTimes.length < 5) {
      return null; // Need more data
    }

    const currentHour = new Date(currentTime).getHours();
    const historicalHours = historicalTimes.map(t => new Date(t).getHours());
    
    // Calculate hour frequency
    const hourCounts: Record<number, number> = {};
    historicalHours.forEach(hour => {
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    const currentHourCount = hourCounts[currentHour] || 0;
    const totalLogins = historicalTimes.length;
    const hourProbability = currentHourCount / totalLogins;

    // If less than 5% of logins happen at this hour, it's unusual
    if (hourProbability < 0.05) {
      return {
        type: 'UNUSUAL_LOGIN_TIME',
        severity: 'LOW',
        description: `Đăng nhập vào thời gian bất thường: ${currentHour}:00`,
        confidence: 0.6
      };
    }

    return null;
  }

  /**
   * Get user risk score based on recent anomalies
   */
  getUserRiskScore(userId: string): {
    score: number;
    level: 'LOW' | 'MEDIUM' | 'HIGH';
    recentAnomalies: number;
    recommendations: string[];
  } {
    const recentAnomalies = this.anomalies.filter(a => 
      a.userId === userId && 
      Date.now() - a.timestamp.getTime() < 24 * 60 * 60 * 1000 // Last 24 hours
    );

    let score = 0;
    recentAnomalies.forEach(anomaly => {
      switch (anomaly.severity) {
        case 'LOW': score += 10; break;
        case 'MEDIUM': score += 25; break;
        case 'HIGH': score += 50; break;
      }
    });

    let level: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (score >= 75) level = 'HIGH';
    else if (score >= 35) level = 'MEDIUM';

    const recommendations: string[] = [];
    if (level === 'HIGH') {
      recommendations.push('Yêu cầu xác thực 2FA bổ sung');
      recommendations.push('Kiểm tra hoạt động tài khoản gần đây');
      recommendations.push('Cân nhắc tạm khóa tài khoản');
    } else if (level === 'MEDIUM') {
      recommendations.push('Yêu cầu xác nhận qua email');
      recommendations.push('Theo dõi hoạt động trong 24h tới');
    }

    return {
      score: Math.min(100, score),
      level,
      recentAnomalies: recentAnomalies.length,
      recommendations
    };
  }

  /**
   * Get anomaly statistics
   */
  getAnomalyStatistics(): {
    totalAnomalies: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    recentAnomalies: number;
    topUsers: Array<{ userId: string; anomalies: number }>;
  } {
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const userCounts: Record<string, number> = {};

    this.anomalies.forEach(anomaly => {
      byType[anomaly.type] = (byType[anomaly.type] || 0) + 1;
      bySeverity[anomaly.severity] = (bySeverity[anomaly.severity] || 0) + 1;
      userCounts[anomaly.userId] = (userCounts[anomaly.userId] || 0) + 1;
    });

    const recentAnomalies = this.anomalies.filter(a => 
      Date.now() - a.timestamp.getTime() < 24 * 60 * 60 * 1000
    ).length;

    const topUsers = Object.entries(userCounts)
      .map(([userId, count]) => ({ userId, anomalies: count }))
      .sort((a, b) => b.anomalies - a.anomalies)
      .slice(0, 10);

    return {
      totalAnomalies: this.anomalies.length,
      byType,
      bySeverity,
      recentAnomalies,
      topUsers
    };
  }

  /**
   * Clear old anomalies
   */
  clearOldAnomalies(maxAge: number = 7 * 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAge;
    this.anomalies = this.anomalies.filter(a => a.timestamp.getTime() > cutoff);
  }
} 