import { 
  SimpleTOTP, 
  SimpleRateLimiter, 
  SimpleDeviceTracker, 
  SimpleSecurityMonitor, 
  SimpleCrypto,
  advancedSecurity,
  SecurityEventType 
} from '../advanced-features';
import { UserPlan } from '../types';

describe('Advanced Security Features - Basic Tests', () => {
  
  test('SimpleTOTP - Generate and verify codes', () => {
    const secret = SimpleTOTP.generateSecret();
    const code = SimpleTOTP.generateTOTP(secret);
    const isValid = SimpleTOTP.verifyTOTP(code, secret);
    
    expect(secret).toBeDefined();
    expect(code).toMatch(/^\d{6}$/);
    expect(isValid).toBe(true);
  });

  test('SimpleRateLimiter - Basic rate limiting', () => {
    const limiter = new SimpleRateLimiter();
    const result = limiter.checkLimit('user1', UserPlan.FREE);
    
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(99);
    expect(result.resetTime).toBeGreaterThan(Date.now());
  });

  test('SimpleDeviceTracker - Device registration', () => {
    const tracker = new SimpleDeviceTracker();
    const device = {
      userAgent: 'Mozilla/5.0',
      ip: '192.168.1.100',
      screenResolution: '1920x1080',
      timezone: 'Asia/Ho_Chi_Minh',
      language: 'vi'
    };
    
    const result = tracker.registerDevice('user1', device);
    
    expect(result.isNewDevice).toBe(true);
    expect(result.trustScore).toBe(20);
    expect(result.deviceId).toBeDefined();
  });

  test('SimpleSecurityMonitor - Event logging', () => {
    const monitor = new SimpleSecurityMonitor();
    const eventId = monitor.logEvent({
      type: SecurityEventType.LOGIN_SUCCESS,
      userId: 'user1',
      ip: '192.168.1.100',
      userAgent: 'Mozilla/5.0',
      metadata: {}
    });
    
    expect(eventId).toBeDefined();
    expect(eventId.startsWith('evt_')).toBe(true);
    
    const dashboard = monitor.getDashboard();
    expect(dashboard.totalEvents).toBe(1);
  });

  test('SimpleCrypto - PIN operations', async () => {
    const pin = SimpleCrypto.generateSecurePin(6);
    expect(pin).toMatch(/^\d{6}$/);
    
    const { hash, salt } = await SimpleCrypto.hashPin(pin);
    const isValid = await SimpleCrypto.verifyPin(pin, hash, salt);
    
    expect(isValid).toBe(true);
  });

  test('SimpleCrypto - Encryption/Decryption', () => {
    const plaintext = 'Secret message';
    const password = 'password';
    
    const { encrypted, iv } = SimpleCrypto.encrypt(plaintext, password);
    const decrypted = SimpleCrypto.decrypt(encrypted, password, iv);
    
    expect(decrypted).toBe(plaintext);
  });

  test('Advanced Security Integration', () => {
    expect(advancedSecurity.totp).toBe(SimpleTOTP);
    expect(advancedSecurity.rateLimiter).toBeInstanceOf(SimpleRateLimiter);
    expect(advancedSecurity.deviceTracker).toBeInstanceOf(SimpleDeviceTracker);
    expect(advancedSecurity.monitor).toBeInstanceOf(SimpleSecurityMonitor);
    expect(advancedSecurity.crypto).toBe(SimpleCrypto);
  });

  test('Real-world scenario - User login flow', async () => {
    const userId = 'test-user';
    const userPlan = UserPlan.PREMIUM;
    const device = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      ip: '192.168.1.100',
      screenResolution: '1920x1080',
      timezone: 'Asia/Ho_Chi_Minh',
      language: 'vi'
    };

    // 1. Register device
    const deviceResult = advancedSecurity.deviceTracker.registerDevice(userId, device);
    expect(deviceResult.isNewDevice).toBe(true);

    // 2. Check rate limits
    const rateLimitResult = advancedSecurity.rateLimiter.checkLimit(userId, userPlan);
    expect(rateLimitResult.allowed).toBe(true);

    // 3. Generate 2FA
    const totpSecret = advancedSecurity.totp.generateSecret();
    const totpCode = advancedSecurity.totp.generateTOTP(totpSecret);
    const totpValid = advancedSecurity.totp.verifyTOTP(totpCode, totpSecret);
    expect(totpValid).toBe(true);

    // 4. Log event
    const eventId = advancedSecurity.monitor.logEvent({
      type: SecurityEventType.LOGIN_SUCCESS,
      userId,
      ip: device.ip,
      userAgent: device.userAgent,
      metadata: { deviceId: deviceResult.deviceId }
    });
    expect(eventId).toBeDefined();

    // 5. Encrypt session data
    const sessionData = JSON.stringify({ userId, timestamp: Date.now() });
    const { encrypted, iv } = advancedSecurity.crypto.encrypt(sessionData, 'session-key');
    const decrypted = advancedSecurity.crypto.decrypt(encrypted, 'session-key', iv);
    expect(JSON.parse(decrypted).userId).toBe(userId);

    console.log('✅ Complete security flow test passed');
  });

  test('Security threat detection', () => {
    const monitor = new SimpleSecurityMonitor();
    const attackerIP = '45.147.230.204';
    
    // Simulate brute force attack
    for (let i = 0; i < 5; i++) {
      monitor.logEvent({
        type: SecurityEventType.LOGIN_FAILURE,
        userId: 'victim',
        ip: attackerIP,
        userAgent: 'Bot/1.0',
        metadata: { attempt: i + 1 }
      });
    }

    const dashboard = monitor.getDashboard();
    expect(dashboard.totalEvents).toBeGreaterThan(5); // Should include brute force event
    expect(dashboard.totalAlerts).toBeGreaterThan(0);
    
    console.log('🚨 Security threat detection test passed');
  });
}); 