# Advanced Security Features Guide

## Tổng Quan

Package `@elearning/auth-utils` hiện đã được trang bị các tính năng bảo mật nâng cao để đáp ứng yêu cầu enterprise-grade security:

## 🔐 Các Tính Năng Đã Triển Khai

### 1. Two-Factor Authentication (2FA) - TOTP
```typescript
import { advancedSecurity } from '@elearning/auth-utils';

// Generate TOTP secret cho user
const secret = advancedSecurity.totp.generateSecret();

// Generate 6-digit code
const code = advancedSecurity.totp.generateTOTP(secret);

// Verify code (có time window tolerance)
const isValid = advancedSecurity.totp.verifyTOTP(userInput, secret);
```

**Đặc điểm:**
- Time-based algorithm (30-second windows)
- SHA-1 HMAC với 6-digit codes
- Time drift tolerance (±1 window)
- Tương thích với Google Authenticator

### 2. Advanced Rate Limiting theo Plan
```typescript
import { advancedSecurity, UserPlan } from '@elearning/auth-utils';

// Check rate limit theo plan
const result = advancedSecurity.rateLimiter.checkLimit(userId, UserPlan.PREMIUM);

if (result.allowed) {
  console.log(`Remaining: ${result.remaining}, Reset: ${new Date(result.resetTime)}`);
} else {
  console.log('Rate limit exceeded');
}
```

**Giới hạn theo plan:**
- **FREE**: 100 requests/15 phút
- **PREMIUM**: 500 requests/15 phút  
- **ENTERPRISE**: 2000 requests/15 phút

### 3. Device Fingerprinting & Tracking
```typescript
const device = {
  userAgent: req.headers['user-agent'],
  ip: req.ip,
  screenResolution: '1920x1080',
  timezone: 'Asia/Ho_Chi_Minh',
  language: 'vi'
};

const result = advancedSecurity.deviceTracker.registerDevice(userId, device);

if (result.isNewDevice) {
  console.log(`New device detected (Trust: ${result.trustScore}%)`);
  // Trigger additional verification
}
```

**Tính năng:**
- SHA-256 device fingerprinting
- Trust score progression
- New device detection
- Device history tracking

### 4. Security Monitoring & Threat Detection
```typescript
// Log security events
advancedSecurity.monitor.logEvent({
  type: SecurityEventType.LOGIN_SUCCESS,
  userId: 'user123',
  ip: '192.168.1.100',
  userAgent: req.headers['user-agent'],
  metadata: { deviceId: 'abc123', plan: 'PREMIUM' }
});

// Get security dashboard
const dashboard = advancedSecurity.monitor.getDashboard();
console.log(`Events: ${dashboard.totalEvents}, Alerts: ${dashboard.totalAlerts}`);
```

**Pattern Detection:**
- **Brute Force**: 5+ failed logins từ cùng IP trong 15 phút
- **Rate Limit Abuse**: 3+ violations trong 5 phút
- **Anomaly Detection**: New device, unusual patterns

### 5. Advanced Cryptography
```typescript
// Generate secure PIN
const pin = advancedSecurity.crypto.generateSecurePin(6);

// Hash PIN với PBKDF2
const { hash, salt } = await advancedSecurity.crypto.hashPin(pin);

// Verify PIN
const isValid = await advancedSecurity.crypto.verifyPin(userInput, hash, salt);

// Encrypt sensitive data
const { encrypted, iv } = advancedSecurity.crypto.encrypt(data, password);
const decrypted = advancedSecurity.crypto.decrypt(encrypted, password, iv);
```

**Security Standards:**
- PBKDF2 với 100,000 iterations
- AES-256-CBC encryption
- Cryptographically secure random generation
- Constant-time comparisons

## 🛡️ Implementation Examples

### Complete Authentication Flow
```typescript
async function authenticateUser(req: Request, res: Response) {
  const { userId, pin, totpCode } = req.body;
  const device = extractDeviceInfo(req);

  try {
    // 1. Rate limiting check
    const rateLimit = advancedSecurity.rateLimiter.checkLimit(userId, user.plan);
    if (!rateLimit.allowed) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    // 2. Device tracking
    const deviceResult = advancedSecurity.deviceTracker.registerDevice(userId, device);
    
    // 3. PIN verification
    const pinValid = await advancedSecurity.crypto.verifyPin(pin, user.pinHash, user.pinSalt);
    if (!pinValid) {
      advancedSecurity.monitor.logEvent({
        type: SecurityEventType.LOGIN_FAILURE,
        userId, ip: req.ip, userAgent: req.headers['user-agent'],
        metadata: { reason: 'Invalid PIN' }
      });
      return res.status(401).json({ error: 'Invalid PIN' });
    }

    // 4. 2FA verification
    const totpValid = advancedSecurity.totp.verifyTOTP(totpCode, user.totpSecret);
    if (!totpValid) {
      return res.status(401).json({ error: 'Invalid 2FA code' });
    }

    // 5. Log successful login
    advancedSecurity.monitor.logEvent({
      type: SecurityEventType.LOGIN_SUCCESS,
      userId, ip: req.ip, userAgent: req.headers['user-agent'],
      metadata: { deviceId: deviceResult.deviceId, newDevice: deviceResult.isNewDevice }
    });

    // 6. Create encrypted session
    const sessionData = { userId, deviceId: deviceResult.deviceId, timestamp: Date.now() };
    const { encrypted, iv } = advancedSecurity.crypto.encrypt(
      JSON.stringify(sessionData), 
      process.env.SESSION_ENCRYPTION_KEY
    );

    res.json({ 
      success: true, 
      sessionToken: `${encrypted}:${iv}`,
      newDevice: deviceResult.isNewDevice,
      trustScore: deviceResult.trustScore
    });

  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

### Security Dashboard API
```typescript
app.get('/admin/security-dashboard', authenticateAdmin, (req, res) => {
  const dashboard = advancedSecurity.monitor.getDashboard();
  
  res.json({
    summary: {
      totalEvents: dashboard.totalEvents,
      totalAlerts: dashboard.totalAlerts,
      threatLevel: dashboard.totalAlerts > 10 ? 'HIGH' : 'NORMAL'
    },
    recentEvents: dashboard.recentEvents,
    recentAlerts: dashboard.recentAlerts,
    eventBreakdown: dashboard.eventsByType
  });
});
```

## 📊 Security Metrics & Monitoring

### Key Performance Indicators
- **Authentication Success Rate**: Target > 95%
- **False Positive Rate**: Target < 2%
- **Threat Detection Time**: Target < 1 minute
- **System Response Time**: Target < 100ms

### Alert Thresholds
- **CRITICAL**: Brute force attacks, data breach attempts
- **HIGH**: Suspicious login patterns, privilege escalation
- **MEDIUM**: Rate limit violations, new device registrations
- **LOW**: General security events

## 🔧 Configuration & Deployment

### Environment Variables
```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Encryption
SESSION_ENCRYPTION_KEY=your-session-encryption-key
DEVICE_FINGERPRINT_SALT=your-device-salt

# Rate Limiting
REDIS_URL=redis://localhost:6379
REDIS_POOL_SIZE=10

# Security
SECURITY_LEVEL=high
ENABLE_2FA=true
ENABLE_DEVICE_TRACKING=true
```

### API Gateway Integration
```typescript
// Apply advanced security middleware
app.use('/api/protected', 
  advancedSecurity.rateLimiter.middleware,
  authenticateToken,
  trackDevice,
  securityLogging
);
```

## 🚀 Performance Optimizations

### 1. Redis Clustering (Production)
```typescript
const redisCluster = new RedisClusterManager({
  nodes: [
    { host: '127.0.0.1', port: 7000 },
    { host: '127.0.0.1', port: 7001 },
    { host: '127.0.0.1', port: 7002 }
  ],
  poolSize: 10,
  maxConnectionAge: 3600000
});
```

### 2. Sliding Window Rate Limiting
```typescript
const slidingWindowLimiter = new SlidingWindowRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 100,
  keyGenerator: (ip) => `rate-limit:${ip}`
});
```

### 3. CDN Security Headers
```typescript
const securityHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'",
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};
```

## 🧪 Testing & Validation

### Unit Tests
```bash
npm test
```

### Security Penetration Testing
```bash
# Brute force simulation
npm run test:security:brute-force

# Rate limiting stress test  
npm run test:security:rate-limit

# Device spoofing detection
npm run test:security:device-spoofing
```

### Performance Benchmarks
```bash
# Authentication flow performance
npm run benchmark:auth-flow

# Encryption/decryption performance
npm run benchmark:crypto

# Rate limiting performance
npm run benchmark:rate-limit
```

## 📈 Monitoring & Alerting

### Real-time Monitoring
```typescript
// Setup monitoring alerts
advancedSecurity.monitor.on('alert', (alert) => {
  if (alert.severity === 'CRITICAL') {
    sendSlackAlert(alert);
    sendEmailAlert(alert);
    logToSIEM(alert);
  }
});
```

### Health Check Endpoints
```typescript
app.get('/health/security', (req, res) => {
  const stats = {
    rateLimiter: advancedSecurity.rateLimiter.getStatistics(),
    deviceTracker: advancedSecurity.deviceTracker.getStatistics(),
    monitor: advancedSecurity.monitor.getDashboard(),
    uptime: process.uptime()
  };
  
  res.json(stats);
});
```

## 🔒 Security Best Practices

### 1. Defense in Depth
- Multiple authentication factors
- Network-level security
- Application-level controls
- Data encryption at rest and in transit

### 2. Principle of Least Privilege
- Role-based access control
- Plan-based feature restrictions
- Time-limited sessions
- Granular permissions

### 3. Continuous Monitoring
- Real-time threat detection
- Anomaly pattern analysis
- Security event correlation
- Automated incident response

### 4. Regular Security Audits
- Code security reviews
- Dependency vulnerability scans
- Penetration testing
- Compliance validation

## 📚 Additional Resources

- [OWASP Top 10 Security Guidelines](https://owasp.org/www-project-top-ten/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [JWT Security Best Practices](https://tools.ietf.org/html/rfc8725)
- [Node.js Security Checklist](https://nodejs.org/en/docs/guides/security/)

---

**⚠️ Production Deployment Checklist:**

- [ ] Enable HTTPS/TLS encryption
- [ ] Configure Redis cluster for high availability  
- [ ] Set up comprehensive logging and monitoring
- [ ] Implement backup and disaster recovery
- [ ] Configure security headers and CSP
- [ ] Enable rate limiting and DDoS protection
- [ ] Set up automated security scanning
- [ ] Configure incident response procedures

**🎯 Next Phase Recommendations:**

1. **AI-Powered Threat Detection**: Machine learning for anomaly detection
2. **Biometric Authentication**: Fingerprint, Face ID integration  
3. **Blockchain-based Identity**: Decentralized identity verification
4. **Zero Trust Architecture**: Complete network security overhaul
5. **Quantum-Resistant Cryptography**: Future-proof encryption standards 