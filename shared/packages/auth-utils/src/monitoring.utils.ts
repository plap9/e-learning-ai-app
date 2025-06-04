import { EventEmitter } from 'events';

// Security Event Types
export enum SecurityEventType {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  TWO_FA_ENABLED = 'TWO_FA_ENABLED',
  TWO_FA_DISABLED = 'TWO_FA_DISABLED',
  SUSPICIOUS_LOGIN = 'SUSPICIOUS_LOGIN',
  BRUTE_FORCE_ATTEMPT = 'BRUTE_FORCE_ATTEMPT',
  TOKEN_BLACKLISTED = 'TOKEN_BLACKLISTED',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  PRIVILEGE_ESCALATION = 'PRIVILEGE_ESCALATION',
  ANOMALY_DETECTED = 'ANOMALY_DETECTED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  API_ABUSE = 'API_ABUSE',
  SQL_INJECTION_ATTEMPT = 'SQL_INJECTION_ATTEMPT',
  XSS_ATTEMPT = 'XSS_ATTEMPT',
  CSRF_ATTEMPT = 'CSRF_ATTEMPT',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  DATA_BREACH_ATTEMPT = 'DATA_BREACH_ATTEMPT'
}

export enum SecuritySeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: SecuritySeverity;
  userId?: string;
  sessionId?: string;
  ip: string;
  userAgent: string;
  timestamp: Date;
  metadata: {
    description: string;
    location?: string;
    deviceFingerprint?: string;
    additionalData?: any;
  };
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface SecurityAlert {
  id: string;
  title: string;
  description: string;
  severity: SecuritySeverity;
  events: SecurityEvent[];
  createdAt: Date;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  actions: string[];
}

// Security Monitoring System
export class SecurityMonitor extends EventEmitter {
  private events: SecurityEvent[] = [];
  private alerts: SecurityAlert[] = [];
  private patterns: Map<string, PatternDetector> = new Map();
  private alertHandlers: Map<SecuritySeverity, Array<(alert: SecurityAlert) => void>> = new Map();

  constructor() {
    super();
    this.initializePatternDetectors();
    this.setupAlertHandlers();
  }

  /**
   * Log security event
   */
  logEvent(event: Omit<SecurityEvent, 'id' | 'timestamp' | 'resolved'>): string {
    const securityEvent: SecurityEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: new Date(),
      resolved: false
    };

    this.events.push(securityEvent);
    this.emit('event', securityEvent);

    // Check for patterns
    this.checkPatterns(securityEvent);

    // Auto-cleanup old events
    this.cleanupOldEvents();

    return securityEvent.id;
  }

  /**
   * Create security alert
   */
  createAlert(
    title: string,
    description: string,
    severity: SecuritySeverity,
    relatedEvents: SecurityEvent[]
  ): SecurityAlert {
    const alert: SecurityAlert = {
      id: this.generateAlertId(),
      title,
      description,
      severity,
      events: relatedEvents,
      createdAt: new Date(),
      acknowledged: false,
      resolved: false,
      actions: this.getRecommendedActions(severity, relatedEvents)
    };

    this.alerts.push(alert);
    this.emit('alert', alert);

    // Trigger alert handlers
    const handlers = this.alertHandlers.get(severity) || [];
    handlers.forEach(handler => {
      try {
        handler(alert);
      } catch (error) {
        console.error('Alert handler error:', error);
      }
    });

    return alert;
  }

  /**
   * Initialize pattern detectors
   */
  private initializePatternDetectors(): void {
    // Brute force detection
    this.patterns.set('brute_force', new BruteForceDetector(this));
    
    // Anomaly detection
    this.patterns.set('anomaly', new AnomalyPatternDetector(this));
    
    // API abuse detection
    this.patterns.set('api_abuse', new APIAbuseDetector(this));
    
    // Attack signature detection
    this.patterns.set('attack_signatures', new AttackSignatureDetector(this));
  }

  /**
   * Setup alert handlers
   */
  private setupAlertHandlers(): void {
    // Critical alerts - immediate notification
    this.alertHandlers.set(SecuritySeverity.CRITICAL, [
      (alert) => this.sendImmediateNotification(alert),
      (alert) => this.escalateToAdmin(alert),
      (alert) => this.logThreatIntelligence(alert)
    ]);

    // High severity alerts
    this.alertHandlers.set(SecuritySeverity.HIGH, [
      (alert) => this.sendNotification(alert),
      (alert) => this.logThreatIntelligence(alert)
    ]);

    // Medium severity alerts
    this.alertHandlers.set(SecuritySeverity.MEDIUM, [
      (alert) => this.logForReview(alert)
    ]);

    // Low severity alerts
    this.alertHandlers.set(SecuritySeverity.LOW, [
      (alert) => this.logMetrics(alert)
    ]);
  }

  /**
   * Check patterns for new event
   */
  private checkPatterns(event: SecurityEvent): void {
    this.patterns.forEach(detector => {
      try {
        detector.analyze(event);
      } catch (error) {
        console.error('Pattern detector error:', error);
      }
    });
  }

  /**
   * Get recommended actions for alert
   */
  private getRecommendedActions(severity: SecuritySeverity, events: SecurityEvent[]): string[] {
    const actions: string[] = [];

    switch (severity) {
      case SecuritySeverity.CRITICAL:
        actions.push('Khóa tài khoản ngay lập tức');
        actions.push('Thông báo cho admin');
        actions.push('Kiểm tra log hệ thống');
        actions.push('Xem xét thu hồi tất cả token');
        break;

      case SecuritySeverity.HIGH:
        actions.push('Yêu cầu đổi mật khẩu');
        actions.push('Kích hoạt 2FA bắt buộc');
        actions.push('Theo dõi hoạt động gần đây');
        break;

      case SecuritySeverity.MEDIUM:
        actions.push('Gửi email cảnh báo');
        actions.push('Theo dõi trong 24h');
        actions.push('Xem xét tăng bảo mật');
        break;

      case SecuritySeverity.LOW:
        actions.push('Ghi nhận để phân tích');
        actions.push('Cập nhật metrics');
        break;
    }

    // Event-specific actions
    const eventTypes = events.map(e => e.type);
    if (eventTypes.includes(SecurityEventType.BRUTE_FORCE_ATTEMPT)) {
      actions.push('Chặn IP tạm thời');
      actions.push('Tăng thời gian rate limiting');
    }

    if (eventTypes.includes(SecurityEventType.SQL_INJECTION_ATTEMPT)) {
      actions.push('Kiểm tra WAF rules');
      actions.push('Review input validation');
    }

    return actions;
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert || alert.acknowledged) return false;

    alert.acknowledged = true;
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = acknowledgedBy;

    this.emit('alertAcknowledged', alert);
    return true;
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string, resolvedBy: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert || alert.resolved) return false;

    alert.resolved = true;
    alert.resolvedAt = new Date();
    alert.resolvedBy = resolvedBy;

    this.emit('alertResolved', alert);
    return true;
  }

  /**
   * Get security dashboard data
   */
  getSecurityDashboard(): {
    summary: {
      totalEvents: number;
      totalAlerts: number;
      unacknowledgedAlerts: number;
      unresolvedAlerts: number;
      criticalAlerts: number;
    };
    recentEvents: SecurityEvent[];
    recentAlerts: SecurityAlert[];
    eventsByType: Record<string, number>;
    alertsBySeverity: Record<string, number>;
    trends: {
      eventsLast24h: number;
      alertsLast24h: number;
      topIPs: Array<{ ip: string; events: number }>;
      topUsers: Array<{ userId: string; events: number }>;
    };
  } {
    const now = Date.now();
    const last24h = now - 24 * 60 * 60 * 1000;

    // Event counting
    const eventsByType: Record<string, number> = {};
    const alertsBySeverity: Record<string, number> = {};
    const ipCounts: Record<string, number> = {};
    const userCounts: Record<string, number> = {};

    this.events.forEach(event => {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      ipCounts[event.ip] = (ipCounts[event.ip] || 0) + 1;
      if (event.userId) {
        userCounts[event.userId] = (userCounts[event.userId] || 0) + 1;
      }
    });

    this.alerts.forEach(alert => {
      alertsBySeverity[alert.severity] = (alertsBySeverity[alert.severity] || 0) + 1;
    });

    const eventsLast24h = this.events.filter(e => e.timestamp.getTime() > last24h).length;
    const alertsLast24h = this.alerts.filter(a => a.createdAt.getTime() > last24h).length;

    const topIPs = Object.entries(ipCounts)
      .map(([ip, events]) => ({ ip, events }))
      .sort((a, b) => b.events - a.events)
      .slice(0, 10);

    const topUsers = Object.entries(userCounts)
      .map(([userId, events]) => ({ userId, events }))
      .sort((a, b) => b.events - a.events)
      .slice(0, 10);

    return {
      summary: {
        totalEvents: this.events.length,
        totalAlerts: this.alerts.length,
        unacknowledgedAlerts: this.alerts.filter(a => !a.acknowledged).length,
        unresolvedAlerts: this.alerts.filter(a => !a.resolved).length,
        criticalAlerts: this.alerts.filter(a => a.severity === SecuritySeverity.CRITICAL).length
      },
      recentEvents: this.events.slice(-10).reverse(),
      recentAlerts: this.alerts.slice(-10).reverse(),
      eventsByType,
      alertsBySeverity,
      trends: {
        eventsLast24h,
        alertsLast24h,
        topIPs,
        topUsers
      }
    };
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique alert ID
   */
  private generateAlertId(): string {
    return `alt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup old events (keep last 30 days)
   */
  private cleanupOldEvents(): void {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    this.events = this.events.filter(e => e.timestamp.getTime() > cutoff);
  }

  // Alert handlers
  private async sendImmediateNotification(alert: SecurityAlert): Promise<void> {
    console.error(`🚨 CRITICAL SECURITY ALERT: ${alert.title}`);
    // Implement actual notification logic (email, SMS, Slack, etc.)
  }

  private async sendNotification(alert: SecurityAlert): Promise<void> {
    console.warn(`⚠️ Security Alert: ${alert.title}`);
    // Implement notification logic
  }

  private async escalateToAdmin(alert: SecurityAlert): Promise<void> {
    console.error(`📢 Admin escalation: ${alert.title}`);
    // Implement admin escalation logic
  }

  private async logThreatIntelligence(alert: SecurityAlert): Promise<void> {
    // Log to threat intelligence system
    console.log(`🔍 Threat Intel: ${alert.title}`, alert.events.map(e => e.ip));
  }

  private async logForReview(alert: SecurityAlert): Promise<void> {
    console.log(`📝 Security Review: ${alert.title}`);
  }

  private async logMetrics(alert: SecurityAlert): Promise<void> {
    console.log(`📊 Security Metrics: ${alert.title}`);
  }
}

// Pattern Detectors
abstract class PatternDetector {
  constructor(protected monitor: SecurityMonitor) {}
  abstract analyze(event: SecurityEvent): void;
}

class BruteForceDetector extends PatternDetector {
  private failedAttempts = new Map<string, { count: number; lastAttempt: number }>();
  private readonly THRESHOLD = 5;
  private readonly WINDOW_MS = 15 * 60 * 1000; // 15 minutes

  analyze(event: SecurityEvent): void {
    if (event.type !== SecurityEventType.LOGIN_FAILURE) return;

    const key = `${event.ip}:${event.userId || 'unknown'}`;
    const now = Date.now();
    const current = this.failedAttempts.get(key) || { count: 0, lastAttempt: 0 };

    // Reset if outside window
    if (now - current.lastAttempt > this.WINDOW_MS) {
      current.count = 0;
    }

    current.count++;
    current.lastAttempt = now;
    this.failedAttempts.set(key, current);

    if (current.count >= this.THRESHOLD) {
      this.monitor.logEvent({
        type: SecurityEventType.BRUTE_FORCE_ATTEMPT,
        severity: SecuritySeverity.HIGH,
        ip: event.ip,
        userAgent: event.userAgent,
        userId: event.userId,
        metadata: {
          description: `Brute force attack detected: ${current.count} failed attempts`,
          additionalData: { attempts: current.count, windowMs: this.WINDOW_MS }
        }
      });

      this.monitor.createAlert(
        'Brute Force Attack Detected',
        `Detected ${current.count} failed login attempts from IP ${event.ip}`,
        SecuritySeverity.HIGH,
        [event]
      );
    }
  }
}

class AnomalyPatternDetector extends PatternDetector {
  private userPatterns = new Map<string, {
    loginTimes: number[];
    ips: string[];
    userAgents: string[];
  }>();

  analyze(event: SecurityEvent): void {
    if (!event.userId || event.type !== SecurityEventType.LOGIN_SUCCESS) return;

    let pattern = this.userPatterns.get(event.userId);
    if (!pattern) {
      pattern = { loginTimes: [], ips: [], userAgents: [] };
      this.userPatterns.set(event.userId, pattern);
    }

    const hour = new Date(event.timestamp).getHours();
    const isNewIP = !pattern.ips.includes(event.ip);
    const isNewUA = !pattern.userAgents.includes(event.userAgent);

    // Update patterns
    pattern.loginTimes.push(hour);
    if (pattern.loginTimes.length > 50) {
      pattern.loginTimes = pattern.loginTimes.slice(-50);
    }

    if (isNewIP) {
      pattern.ips.push(event.ip);
      if (pattern.ips.length > 10) {
        pattern.ips = pattern.ips.slice(-10);
      }
    }

    if (isNewUA) {
      pattern.userAgents.push(event.userAgent);
      if (pattern.userAgents.length > 5) {
        pattern.userAgents = pattern.userAgents.slice(-5);
      }
    }

    // Check for anomalies
    const anomalies: string[] = [];

    // Unusual login time
    if (pattern.loginTimes.length > 10) {
      const hourCounts: Record<number, number> = {};
      pattern.loginTimes.forEach(h => {
        hourCounts[h] = (hourCounts[h] || 0) + 1;
      });
      const currentHourFreq = (hourCounts[hour] || 0) / pattern.loginTimes.length;
      if (currentHourFreq < 0.1) {
        anomalies.push('Unusual login time');
      }
    }

    if (isNewIP && pattern.ips.length > 3) {
      anomalies.push('New IP address');
    }

    if (isNewUA) {
      anomalies.push('New user agent');
    }

    if (anomalies.length > 0) {
      this.monitor.logEvent({
        type: SecurityEventType.ANOMALY_DETECTED,
        severity: anomalies.length > 1 ? SecuritySeverity.MEDIUM : SecuritySeverity.LOW,
        ip: event.ip,
        userAgent: event.userAgent,
        userId: event.userId,
        metadata: {
          description: `Behavioral anomaly detected: ${anomalies.join(', ')}`,
          additionalData: { anomalies }
        }
      });
    }
  }
}

class APIAbuseDetector extends PatternDetector {
  private apiCalls = new Map<string, number[]>();
  private readonly RATE_THRESHOLD = 100; // requests per minute
  private readonly WINDOW_MS = 60 * 1000; // 1 minute

  analyze(event: SecurityEvent): void {
    if (event.type !== SecurityEventType.RATE_LIMIT_EXCEEDED) return;

    const key = event.ip;
    const now = Date.now();
    let calls = this.apiCalls.get(key) || [];

    // Remove old calls
    calls = calls.filter(time => now - time < this.WINDOW_MS);
    calls.push(now);
    this.apiCalls.set(key, calls);

    if (calls.length > this.RATE_THRESHOLD) {
      this.monitor.createAlert(
        'API Abuse Detected',
        `Excessive API calls from IP ${event.ip}: ${calls.length} requests/minute`,
        SecuritySeverity.MEDIUM,
        [event]
      );
    }
  }
}

class AttackSignatureDetector extends PatternDetector {
  private readonly ATTACK_PATTERNS = {
    [SecurityEventType.SQL_INJECTION_ATTEMPT]: /('|\\')|(;|\\;)|(union)|(select)|(insert)|(drop)|(delete)|(update)|(script)/i,
    [SecurityEventType.XSS_ATTEMPT]: /(<script>|javascript:|onerror=|onload=|eval\(|alert\()/i,
    [SecurityEventType.CSRF_ATTEMPT]: /(csrf|xsrf)/i
  };

  analyze(event: SecurityEvent): void {
    // This would typically analyze request payloads, but here we just demonstrate the structure
    Object.entries(this.ATTACK_PATTERNS).forEach(([attackType, pattern]) => {
      const eventType = attackType as SecurityEventType;
      if (event.type === eventType) {
        this.monitor.createAlert(
          `${attackType} Detected`,
          `Attack signature detected from IP ${event.ip}`,
          SecuritySeverity.HIGH,
          [event]
        );
      }
    });
  }
}

// Singleton instance
export const securityMonitor = new SecurityMonitor(); 