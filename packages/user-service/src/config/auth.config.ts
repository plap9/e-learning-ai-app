import Joi from 'joi';

// Configuration interface
export interface AuthConfig {
  readonly EMAIL_MASK_REGEX: RegExp;
  readonly DEFAULT_API_VERSION: string;
  readonly HEALTH_CACHE_TTL: number;
  readonly DEFAULT_REQUEST_SIZE_LIMIT: number;
  readonly PERFORMANCE_THRESHOLDS: {
    readonly WARNING: number;
    readonly ERROR: number;
  };
  readonly SECURITY_HEADERS: Record<string, string>;
  readonly CORS_ORIGINS: string[];
  readonly SUPPORTED_API_VERSIONS: string[];
  readonly CACHE_CONFIG: {
    readonly MAX_ENTRIES: number;
    readonly DEFAULT_TTL: number;
  };
  readonly SANITIZATION_CONFIG: {
    readonly MAX_NAME_LENGTH: number;
    readonly ALLOWED_NAME_CHARS: RegExp;
    readonly EMAIL_DOMAIN_WHITELIST: string[];
  };
}

// Custom Joi extension for RegExp validation
const regexValidator = Joi.extend((joi) => ({
  type: 'regex',
  base: joi.any(),
  validate(value, helpers) {
    if (!(value instanceof RegExp)) {
      return { value, errors: helpers.error('regex.base') };
    }
    return { value };
  },
  messages: {
    'regex.base': '"{{#label}}" must be a RegExp object'
  }
}));

// Environment validation
const validateEnvironment = (): void => {
  const required = ['JWT_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }
};

// Configuration validation schema
const configSchema = Joi.object({
  EMAIL_MASK_REGEX: regexValidator.regex().default(/(?<=.{2}).(?=.*@)/g),
  DEFAULT_API_VERSION: Joi.string().valid('v1', 'v2').default('v1'),
  HEALTH_CACHE_TTL: Joi.number().min(1000).max(300000).default(30000), // 1s to 5min
  DEFAULT_REQUEST_SIZE_LIMIT: Joi.number().min(1024).max(10485760).default(1048576), // 1KB to 10MB
  PERFORMANCE_THRESHOLDS: Joi.object({
    WARNING: Joi.number().min(100).max(5000).default(1000),
    ERROR: Joi.number().min(1000).max(10000).default(3000)
  }),
  SECURITY_HEADERS: Joi.object().default({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-DNS-Prefetch-Control': 'off',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  }),
  CORS_ORIGINS: Joi.array().items(Joi.string().uri()).default(['http://localhost:3000']),
  SUPPORTED_API_VERSIONS: Joi.array().items(Joi.string()).default(['v1', 'v2']),
  CACHE_CONFIG: Joi.object({
    MAX_ENTRIES: Joi.number().min(5).max(100).default(50),
    DEFAULT_TTL: Joi.number().min(1000).max(3600000).default(30000)
  }),
  SANITIZATION_CONFIG: Joi.object({
    MAX_NAME_LENGTH: Joi.number().min(10).max(100).default(50),
    ALLOWED_NAME_CHARS: regexValidator.regex().default(/^[a-zA-ZÀ-ỹ\s\-'\.]+$/),
    EMAIL_DOMAIN_WHITELIST: Joi.array().items(Joi.string()).default([])
  })
});

// Configuration validation function
const validateConfig = (config: Partial<AuthConfig>): AuthConfig => {
  // Validate environment first
  validateEnvironment();
  
  const { error, value } = configSchema.validate(config, {
    allowUnknown: false,
    stripUnknown: true
  });

  if (error) {
    throw new Error(`Auth configuration validation failed: ${error.message}`);
  }

  return value as AuthConfig;
};

// Environment-specific configuration
const getEnvironmentConfig = (): Partial<AuthConfig> => {
  const env = process.env.NODE_ENV || 'development';

  const baseConfig: Partial<AuthConfig> = {
    DEFAULT_API_VERSION: process.env.DEFAULT_API_VERSION as 'v1' | 'v2' || 'v1',
    HEALTH_CACHE_TTL: parseInt(process.env.HEALTH_CACHE_TTL || '30000'),
    DEFAULT_REQUEST_SIZE_LIMIT: parseInt(process.env.REQUEST_SIZE_LIMIT || '1048576'),
  };

  switch (env) {
    case 'production':
      const productionOrigins = process.env.CORS_ORIGINS?.split(',').map(o => o.trim()) || [];
      
      // Validate production CORS origins
      if (productionOrigins.length === 0) {
        throw new Error('CORS_ORIGINS environment variable is required in production');
      }
      
      // Check for localhost in production
      const hasLocalhost = productionOrigins.some(origin => 
        origin.includes('localhost') || origin.includes('127.0.0.1')
      );
      
      if (hasLocalhost) {
        throw new Error('Production CORS origins should not include localhost URLs');
      }
      
      return {
        ...baseConfig,
        CORS_ORIGINS: productionOrigins,
        PERFORMANCE_THRESHOLDS: {
          WARNING: 500,
          ERROR: 2000
        },
        CACHE_CONFIG: {
          MAX_ENTRIES: 100,
          DEFAULT_TTL: 60000 // 1 minute in production
        }
      };

    case 'staging':
      return {
        ...baseConfig,
        CORS_ORIGINS: process.env.CORS_ORIGINS?.split(',') || ['https://staging.yourdomain.com'],
        PERFORMANCE_THRESHOLDS: {
          WARNING: 1000,
          ERROR: 3000
        },
        CACHE_CONFIG: {
          MAX_ENTRIES: 50,
          DEFAULT_TTL: 30000
        }
      };

    case 'development':
    default:
      return {
        ...baseConfig,
        CORS_ORIGINS: ['http://localhost:3000', 'http://localhost:3001'],
        PERFORMANCE_THRESHOLDS: {
          WARNING: 2000,
          ERROR: 5000
        },
        CACHE_CONFIG: {
          MAX_ENTRIES: 10,
          DEFAULT_TTL: 10000 // 10 seconds in dev
        },
        SANITIZATION_CONFIG: {
          MAX_NAME_LENGTH: 50,
          ALLOWED_NAME_CHARS: /^[a-zA-ZÀ-ỹ\s\-'\.]+$/,
          EMAIL_DOMAIN_WHITELIST: [] // No restrictions in dev
        }
      };
  }
};

// Create and export validated configuration
export const authConfig: AuthConfig = validateConfig(getEnvironmentConfig());

// Configuration utilities
export const isProductionEnvironment = (): boolean => {
  return process.env.NODE_ENV === 'production';
};

export const isDevelopmentEnvironment = (): boolean => {
  return process.env.NODE_ENV === 'development';
};

export const getConfigValue = <K extends keyof AuthConfig>(key: K): AuthConfig[K] => {
  return authConfig[key];
};

// Configuration health check
export const validateAuthConfigHealth = (): { isHealthy: boolean; issues: string[] } => {
  const issues: string[] = [];

  // Check critical configuration values
  if (authConfig.DEFAULT_REQUEST_SIZE_LIMIT > 10 * 1024 * 1024) {
    issues.push('Request size limit is too high (>10MB)');
  }

  if (authConfig.PERFORMANCE_THRESHOLDS.WARNING >= authConfig.PERFORMANCE_THRESHOLDS.ERROR) {
    issues.push('Performance warning threshold should be less than error threshold');
  }

  if (authConfig.HEALTH_CACHE_TTL < 1000) {
    issues.push('Health cache TTL is too low (<1s)');
  }

  if (isProductionEnvironment() && authConfig.CORS_ORIGINS.includes('http://localhost:3000')) {
    issues.push('Production environment should not allow localhost CORS origins');
  }

  return {
    isHealthy: issues.length === 0,
    issues
  };
};

export default authConfig; 