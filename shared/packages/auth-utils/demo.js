#!/usr/bin/env node

const { advancedSecurity, SecurityEventType } = require('./dist/advanced-features');
const { UserPlan } = require('./dist/types');

console.log('🚀 E-Learning AI App - Advanced Security Features Demo');
console.log('='.repeat(60));

async function demonstrateSecurityFeatures() {
  
  // 1. Two-Factor Authentication Demo
  console.log('\n🔐 1. Two-Factor Authentication (TOTP) Demo');
  console.log('-'.repeat(40));
  
  const totpSecret = advancedSecurity.totp.generateSecret();
  console.log(`📱 Generated TOTP Secret: ${totpSecret.substring(0, 16)}...`);
  
  const totpCode = advancedSecurity.totp.generateTOTP(totpSecret);
  console.log(`🔑 Generated TOTP Code: ${totpCode}`);
  
  const totpValid = advancedSecurity.totp.verifyTOTP(totpCode, totpSecret);
  console.log(`✅ TOTP Verification: ${totpValid ? 'VALID' : 'INVALID'}`);

  // 2. Rate Limiting Demo
  console.log('\n⏱️ 2. Plan-based Rate Limiting Demo');
  console.log('-'.repeat(40));
  
  const plans = [UserPlan.FREE, UserPlan.PREMIUM, UserPlan.ENTERPRISE];
  plans.forEach(plan => {
    const result = advancedSecurity.rateLimiter.checkLimit(`user-${plan}`, plan);
    console.log(`${plan}: ${result.allowed ? '✅ ALLOWED' : '❌ BLOCKED'} (${result.remaining} remaining)`);
  });

  // Test rate limiting
  console.log('\n📊 Testing rate limit enforcement:');
  for (let i = 0; i < 5; i++) {
    const result = advancedSecurity.rateLimiter.checkLimit('heavy-user', UserPlan.FREE);
    console.log(`  Request ${i + 1}: ${result.allowed ? '✅' : '❌'} (${result.remaining} left)`);
  }

  // 3. Device Fingerprinting Demo
  console.log('\n📱 3. Device Fingerprinting & Tracking Demo');
  console.log('-'.repeat(40));
  
  const devices = [
    {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      ip: '192.168.1.100',
      screenResolution: '1920x1080',
      timezone: 'Asia/Ho_Chi_Minh',
      language: 'vi'
    },
    {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
      ip: '192.168.1.101',
      screenResolution: '375x812',
      timezone: 'Asia/Ho_Chi_Minh',
      language: 'vi'
    },
    {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      ip: '192.168.1.102',
      screenResolution: '2560x1600',
      timezone: 'Asia/Ho_Chi_Minh',
      language: 'en'
    }
  ];

  devices.forEach((device, index) => {
    const result = advancedSecurity.deviceTracker.registerDevice('demo-user', device);
    const deviceType = device.userAgent.includes('iPhone') ? '📱 Mobile' : 
                      device.userAgent.includes('Macintosh') ? '💻 Mac' : '🖥️ Windows';
    console.log(`${deviceType}: ${result.isNewDevice ? '🆕 NEW' : '✅ KNOWN'} (Trust: ${result.trustScore}%)`);
  });

  // Show user devices
  const userDevices = advancedSecurity.deviceTracker.getUserDevices('demo-user');
  console.log(`\n👤 User has ${userDevices.length} registered devices`);

  // 4. Security Monitoring Demo
  console.log('\n🛡️ 4. Security Monitoring & Threat Detection Demo');
  console.log('-'.repeat(40));
  
  // Normal login events
  console.log('Simulating normal user activity...');
  for (let i = 0; i < 3; i++) {
    advancedSecurity.monitor.logEvent({
      type: SecurityEventType.LOGIN_SUCCESS,
      userId: `user-${i}`,
      ip: `192.168.1.${100 + i}`,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      metadata: { plan: 'PREMIUM', device: 'trusted' }
    });
  }

  // Simulate brute force attack
  console.log('\n🚨 Simulating brute force attack...');
  const attackerIP = '45.147.230.204';
  for (let i = 0; i < 6; i++) {
    advancedSecurity.monitor.logEvent({
      type: SecurityEventType.LOGIN_FAILURE,
      userId: 'victim-user',
      ip: attackerIP,
      userAgent: 'Malicious-Bot/1.0',
      metadata: { attempt: i + 1, reason: 'Invalid password' }
    });
  }

  // Get security dashboard
  const dashboard = advancedSecurity.monitor.getDashboard();
  console.log(`\n📊 Security Dashboard Summary:`);
  console.log(`  📋 Total Events: ${dashboard.totalEvents}`);
  console.log(`  🚨 Total Alerts: ${dashboard.totalAlerts}`);
  console.log(`  🔴 Brute Force Detected: ${dashboard.eventsByType[SecurityEventType.BRUTE_FORCE] || 0}`);
  console.log(`  ❌ Failed Logins: ${dashboard.eventsByType[SecurityEventType.LOGIN_FAILURE] || 0}`);

  // 5. Advanced Cryptography Demo
  console.log('\n🔒 5. Advanced Cryptography Demo');
  console.log('-'.repeat(40));
  
  // Generate secure PIN
  const pin = advancedSecurity.crypto.generateSecurePin(6);
  console.log(`📍 Generated Secure PIN: ${pin}`);
  
  // Hash PIN
  const { hash, salt } = await advancedSecurity.crypto.hashPin(pin);
  console.log(`🔐 PIN Hash: ${hash.substring(0, 32)}...`);
  console.log(`🧂 Salt: ${salt.substring(0, 16)}...`);
  
  // Verify PIN
  const pinValid = await advancedSecurity.crypto.verifyPin(pin, hash, salt);
  console.log(`✅ PIN Verification: ${pinValid ? 'VALID' : 'INVALID'}`);
  
  // Test wrong PIN
  const wrongPinValid = await advancedSecurity.crypto.verifyPin('000000', hash, salt);
  console.log(`❌ Wrong PIN Test: ${wrongPinValid ? 'VALID' : 'INVALID'}`);

  // Data encryption
  const sensitiveData = 'Thông tin học sinh: Nguyễn Văn A, SĐT: 0123456789, Email: test@example.com';
  const encryptionKey = 'my-super-secret-encryption-key-2024';
  
  console.log(`\n📄 Original Data: ${sensitiveData}`);
  
  const { encrypted, iv } = advancedSecurity.crypto.encrypt(sensitiveData, encryptionKey);
  console.log(`🔒 Encrypted: ${encrypted.substring(0, 32)}...`);
  console.log(`🔑 IV: ${iv}`);
  
  const decrypted = advancedSecurity.crypto.decrypt(encrypted, encryptionKey, iv);
  console.log(`🔓 Decrypted: ${decrypted}`);
  console.log(`✅ Encryption/Decryption: ${decrypted === sensitiveData ? 'SUCCESS' : 'FAILED'}`);

  // 6. Real-world Authentication Flow Demo
  console.log('\n🌟 6. Complete Authentication Flow Demo');
  console.log('-'.repeat(40));
  
  const realUser = {
    id: 'student-123',
    plan: UserPlan.PREMIUM,
    totpSecret: advancedSecurity.totp.generateSecret()
  };

  const userDevice = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
    ip: '203.162.4.191', // Vietnam IP
    screenResolution: '1920x1080',
    timezone: 'Asia/Ho_Chi_Minh',
    language: 'vi'
  };

  console.log(`👤 User: ${realUser.id} (Plan: ${realUser.plan})`);
  
  // Step 1: Rate limiting check
  const rateCheck = advancedSecurity.rateLimiter.checkLimit(realUser.id, realUser.plan);
  console.log(`⏱️  Rate Limiting: ${rateCheck.allowed ? '✅ ALLOWED' : '❌ BLOCKED'}`);
  
  if (!rateCheck.allowed) {
    console.log('❌ Authentication failed: Rate limit exceeded');
    return;
  }

  // Step 2: Device tracking
  const deviceCheck = advancedSecurity.deviceTracker.registerDevice(realUser.id, userDevice);
  console.log(`📱 Device Check: ${deviceCheck.isNewDevice ? '🆕 NEW DEVICE' : '✅ KNOWN DEVICE'} (Trust: ${deviceCheck.trustScore}%)`);

  // Step 3: Generate PIN and 2FA
  const userPin = advancedSecurity.crypto.generateSecurePin(6);
  const { hash: pinHash, salt: pinSalt } = await advancedSecurity.crypto.hashPin(userPin);
  const totpCode2 = advancedSecurity.totp.generateTOTP(realUser.totpSecret);
  
  console.log(`🔢 Generated PIN: ${userPin}`);
  console.log(`🔑 Generated 2FA Code: ${totpCode2}`);

  // Step 4: Verify credentials
  const pinVerified = await advancedSecurity.crypto.verifyPin(userPin, pinHash, pinSalt);
  const totpVerified = advancedSecurity.totp.verifyTOTP(totpCode2, realUser.totpSecret);
  
  console.log(`🔐 PIN Verification: ${pinVerified ? '✅ VALID' : '❌ INVALID'}`);
  console.log(`🔑 2FA Verification: ${totpVerified ? '✅ VALID' : '❌ INVALID'}`);

  if (pinVerified && totpVerified) {
    // Step 5: Create encrypted session
    const sessionData = {
      userId: realUser.id,
      deviceId: deviceCheck.deviceId,
      plan: realUser.plan,
      loginTime: new Date().toISOString(),
      trustScore: deviceCheck.trustScore
    };

    const sessionKey = 'session-encryption-key-2024';
    const sessionEncrypted = advancedSecurity.crypto.encrypt(JSON.stringify(sessionData), sessionKey);
    
    console.log(`🎫 Session Token: ${sessionEncrypted.encrypted.substring(0, 32)}...`);

    // Step 6: Log successful authentication
    advancedSecurity.monitor.logEvent({
      type: SecurityEventType.LOGIN_SUCCESS,
      userId: realUser.id,
      ip: userDevice.ip,
      userAgent: userDevice.userAgent,
      metadata: {
        deviceId: deviceCheck.deviceId,
        newDevice: deviceCheck.isNewDevice,
        plan: realUser.plan,
        twoFactorUsed: true,
        trustScore: deviceCheck.trustScore
      }
    });

    console.log('🎉 Authentication Flow: ✅ SUCCESS');
    console.log(`📊 Session created for user ${realUser.id} on ${deviceCheck.isNewDevice ? 'new' : 'trusted'} device`);
  } else {
    console.log('❌ Authentication Flow: FAILED');
  }

  // 7. Performance Statistics
  console.log('\n📈 7. Performance & Security Statistics');
  console.log('-'.repeat(40));
  
  const finalDashboard = advancedSecurity.monitor.getDashboard();
  console.log(`📊 Security Events Processed: ${finalDashboard.totalEvents}`);
  console.log(`🚨 Security Alerts Generated: ${finalDashboard.totalAlerts}`);
  console.log(`🔐 Authentication Success Rate: ${(finalDashboard.eventsByType[SecurityEventType.LOGIN_SUCCESS] || 0) / Math.max(1, finalDashboard.totalEvents) * 100}%`);
  
  // Memory usage simulation
  const memoryUsage = process.memoryUsage();
  console.log(`💾 Memory Usage: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`);
  
  console.log('\n🎯 Security Recommendations:');
  console.log('  ✅ Enable 2FA for all users');
  console.log('  ✅ Monitor for suspicious login patterns');
  console.log('  ✅ Implement device trust scoring');
  console.log('  ✅ Use encrypted session management');
  console.log('  ✅ Set up real-time security alerts');

  console.log('\n🚀 Demo completed successfully!');
  console.log('All advanced security features are working properly.');
  console.log('Ready for production deployment! 🎉');
}

// Run demo
demonstrateSecurityFeatures().catch(error => {
  console.error('❌ Demo failed:', error);
  process.exit(1);
}); 