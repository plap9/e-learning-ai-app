// Types
export * from './types';

// JWT Utilities
export { JWTUtils, createJWTUtils } from './jwt.utils';

// Password Utilities  
export { PasswordUtils, createPasswordUtils } from './password.utils';

// Authentication Middleware
export { 
  AuthMiddleware, 
  createAuthMiddleware, 
  quickAuth,
  type AuthMiddlewareConfig 
} from './auth.middleware';

// Token Blacklisting
export { 
  TokenBlacklist, 
  createTokenBlacklist,
  type TokenBlacklistConfig 
} from './token-blacklist.utils';

// Session Management
export { 
  SessionManager, 
  createSessionManager,
  type SessionConfig,
  type SessionData 
} from './session.utils';

// Security Utilities
export { 
  SecurityUtils, 
  createSecurityUtils, 
  quickSecurity,
  type SecurityConfig 
} from './security.utils';

// Advanced Security Features (Simple Implementation)
export { 
  SimpleTOTP,
  SimpleRateLimiter,
  SimpleDeviceTracker,
  SimpleSecurityMonitor,
  SimpleCrypto,
  advancedSecurity,
  SecurityEventType as SimpleSecurityEventType,
  type DeviceInfo,
  type SecurityEvent as SimpleSecurityEvent
} from './advanced-features';

// Re-export commonly used functions for convenience
import { createJWTUtils } from './jwt.utils';
import { createPasswordUtils } from './password.utils';
import { createAuthMiddleware, quickAuth } from './auth.middleware';
import { createTokenBlacklist } from './token-blacklist.utils';
import { createSessionManager } from './session.utils';
import { createSecurityUtils, quickSecurity } from './security.utils';
import { advancedSecurity } from './advanced-features';

export const auth = {
  jwt: createJWTUtils,
  password: createPasswordUtils,
  middleware: createAuthMiddleware,
  blacklist: createTokenBlacklist,
  session: createSessionManager,
  security: createSecurityUtils,
  advanced: advancedSecurity,
  quick: {
    ...quickAuth,
    security: quickSecurity
  }
}; 