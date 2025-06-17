import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../utils/errors';
import { appLogger } from '../utils/logger';

// Supported API versions
export const SUPPORTED_VERSIONS = ['v1', 'v2'] as const;
export const DEFAULT_VERSION = 'v1';
export const LATEST_VERSION = 'v2';

// Version type
export type ApiVersion = typeof SUPPORTED_VERSIONS[number];

// Extend Request interface to include API version
declare global {
  namespace Express {
    interface Request {
      apiVersion: ApiVersion;
      isVersionDeprecated: boolean;
      versionSource: 'url' | 'header' | 'query' | 'default';
    }
  }
}

// Version configuration interface
interface VersionConfig {
  version: ApiVersion;
  isDeprecated: boolean;
  deprecationDate?: Date;
  sunsetDate?: Date;
  migrationGuide?: string;
  breakingChanges?: string[];
}

// Version configurations
const VERSION_CONFIGS: Record<ApiVersion, VersionConfig> = {
  v1: {
    version: 'v1',
    isDeprecated: true,
    deprecationDate: new Date('2024-01-01'),
    sunsetDate: new Date('2024-06-01'),
    migrationGuide: 'https://docs.api.com/migration/v1-to-v2',
    breakingChanges: [
      'Password requirements updated',
      'Error response format changed',
      'Rate limiting headers standardized'
    ]
  },
  v2: {
    version: 'v2',
    isDeprecated: false
  }
};

// Extract version from URL path
const extractVersionFromUrl = (req: Request): ApiVersion | null => {
  const pathParts = req.path.split('/');
  const versionPart = pathParts[1]; // Assumes /v1/... or /v2/...
  
  if (versionPart && versionPart.startsWith('v')) {
    const version = versionPart as ApiVersion;
    return SUPPORTED_VERSIONS.includes(version) ? version : null;
  }
  
  return null;
};

// Extract version from Accept header
const extractVersionFromHeader = (req: Request): ApiVersion | null => {
  const acceptVersionHeader = req.headers['accept-version'] as string;
  const apiVersionHeader = req.headers['api-version'] as string;
  
  const version = acceptVersionHeader || apiVersionHeader;
  
  if (version && SUPPORTED_VERSIONS.includes(version as ApiVersion)) {
    return version as ApiVersion;
  }
  
  return null;
};

// Extract version from query parameter
const extractVersionFromQuery = (req: Request): ApiVersion | null => {
  const version = req.query.version as string;
  
  if (version && SUPPORTED_VERSIONS.includes(version as ApiVersion)) {
    return version as ApiVersion;
  }
  
  return null;
};

// Main version detection middleware
export const detectApiVersion = (req: Request, res: Response, next: NextFunction): void => {
  let detectedVersion: ApiVersion | null = null;
  let versionSource: 'url' | 'header' | 'query' | 'default' = 'default';

  // 1. Try to get version from URL (highest priority)
  detectedVersion = extractVersionFromUrl(req);
  if (detectedVersion) {
    versionSource = 'url';
  }

  // 2. Try to get version from headers
  if (!detectedVersion) {
    detectedVersion = extractVersionFromHeader(req);
    if (detectedVersion) {
      versionSource = 'header';
    }
  }

  // 3. Try to get version from query parameters
  if (!detectedVersion) {
    detectedVersion = extractVersionFromQuery(req);
    if (detectedVersion) {
      versionSource = 'query';
    }
  }

  // 4. Use default version
  if (!detectedVersion) {
    detectedVersion = DEFAULT_VERSION;
    versionSource = 'default';
  }

  // Set version info in request
  req.apiVersion = detectedVersion;
  req.versionSource = versionSource;
  
  const versionConfig = VERSION_CONFIGS[detectedVersion];
  req.isVersionDeprecated = versionConfig.isDeprecated;

  // Add version headers to response
  res.setHeader('API-Version', detectedVersion);
  res.setHeader('API-Version-Source', versionSource);
  res.setHeader('API-Supported-Versions', SUPPORTED_VERSIONS.join(','));
  res.setHeader('API-Latest-Version', LATEST_VERSION);

  // Add deprecation headers if version is deprecated
  if (versionConfig.isDeprecated) {
    res.setHeader('API-Deprecation', 'true');
    if (versionConfig.deprecationDate) {
      res.setHeader('API-Deprecation-Date', versionConfig.deprecationDate.toISOString());
    }
    if (versionConfig.sunsetDate) {
      res.setHeader('API-Sunset-Date', versionConfig.sunsetDate.toISOString());
    }
    if (versionConfig.migrationGuide) {
      res.setHeader('API-Migration-Guide', versionConfig.migrationGuide);
    }
    
    // Log deprecation warning
    appLogger.warn('Deprecated API version used', {
      requestId: req.headers['x-request-id'] as string,
      apiVersion: detectedVersion,
      versionSource,
      deprecationDate: versionConfig.deprecationDate,
      sunsetDate: versionConfig.sunsetDate,
      method: req.method,
      url: req.originalUrl,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });
  }

  // Log version detection
  appLogger.debug('API version detected', {
    requestId: req.headers['x-request-id'] as string,
    apiVersion: detectedVersion,
    versionSource,
    isDeprecated: versionConfig.isDeprecated,
    method: req.method,
    url: req.originalUrl
  });

  next();
};

// Middleware to require specific version
export const requireVersion = (requiredVersion: ApiVersion) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.apiVersion !== requiredVersion) {
      throw new ValidationError(
        `This endpoint requires API version ${requiredVersion}, but ${req.apiVersion} was provided`,
        'VALIDATION_4007_INVALID_VERSION',
        'apiVersion',
        req.apiVersion
      );
    }
    next();
  };
};

// Middleware to check if version is supported
export const validateVersion = (req: Request, res: Response, next: NextFunction): void => {
  if (!SUPPORTED_VERSIONS.includes(req.apiVersion)) {
    throw new ValidationError(
      `API version ${req.apiVersion} is not supported. Supported versions: ${SUPPORTED_VERSIONS.join(', ')}`,
      'VALIDATION_4008_UNSUPPORTED_VERSION',
      'apiVersion',
      req.apiVersion
    );
  }
  next();
};

// Middleware to block deprecated versions (optional)
export const blockDeprecatedVersions = (req: Request, res: Response, next: NextFunction): void => {
  const versionConfig = VERSION_CONFIGS[req.apiVersion];
  
  if (versionConfig.isDeprecated && versionConfig.sunsetDate && new Date() > versionConfig.sunsetDate) {
    throw new ValidationError(
      `API version ${req.apiVersion} has been sunset on ${versionConfig.sunsetDate.toDateString()}. Please upgrade to ${LATEST_VERSION}`,
      'VALIDATION_4009_VERSION_SUNSET',
      'apiVersion',
      req.apiVersion
    );
  }
  
  next();
};

// Version-aware response wrapper
export const versionedResponse = (req: Request, res: Response, data: any): void => {
  const responseFormat = getResponseFormat(req.apiVersion);
  
  const formattedResponse = responseFormat(data, req);
  res.json(formattedResponse);
};

// Response format based on version
const getResponseFormat = (version: ApiVersion) => {
  switch (version) {
    case 'v1':
      return (data: any, req: Request) => {
        // V1 format - legacy format
        if (data.error) {
          return {
            error: data.error.message || data.error,
            message: data.error.message || data.error,
            status: 'error',
            timestamp: new Date().toISOString()
          };
        }
        
        return {
          data,
          status: 'success',
          timestamp: new Date().toISOString()
        };
      };
      
    case 'v2':
      return (data: any, req: Request) => {
        // V2 format - new standardized format
        if (data.error) {
          return {
            success: false,
            error: {
              code: data.error.errorCode || 'UNKNOWN_ERROR',
              message: data.error.message || data.error,
              statusCode: data.error.statusCode || 500,
              timestamp: new Date().toISOString(),
              requestId: req.headers['x-request-id']
            },
            meta: {
              apiVersion: req.apiVersion,
              requestId: req.headers['x-request-id'],
              timestamp: new Date().toISOString()
            }
          };
        }
        
        return {
          success: true,
          data,
          meta: {
            apiVersion: req.apiVersion,
            requestId: req.headers['x-request-id'],
            timestamp: new Date().toISOString()
          }
        };
      };
      
    default:
      return getResponseFormat('v2'); // Fallback to latest
  }
};

// Version-specific feature flags
export const hasFeature = (req: Request, featureName: string): boolean => {
  const version = req.apiVersion;
  
  const featureMap: Record<ApiVersion, string[]> = {
    v1: [
      'basic-auth',
      'simple-validation',
      'basic-rate-limiting'
    ],
    v2: [
      'basic-auth',
      'simple-validation',
      'basic-rate-limiting',
      'advanced-rate-limiting',
      'structured-errors',
      'request-correlation',
      'security-headers',
      'field-selection',
      'batch-operations'
    ]
  };
  
  return featureMap[version]?.includes(featureName) || false;
};

// Get version configuration
export const getVersionConfig = (version: ApiVersion): VersionConfig => {
  return VERSION_CONFIGS[version];
};

// Get all version information for documentation
export const getVersionInfo = () => {
  return {
    supportedVersions: SUPPORTED_VERSIONS,
    defaultVersion: DEFAULT_VERSION,
    latestVersion: LATEST_VERSION,
    versionConfigs: VERSION_CONFIGS
  };
};

// Endpoint to get version information
export const getVersionInfoEndpoint = (req: Request, res: Response): void => {
  const versionInfo = getVersionInfo();
  
  versionedResponse(req, res, {
    message: 'API Version Information',
    ...versionInfo,
    currentVersion: req.apiVersion,
    versionSource: req.versionSource,
    isDeprecated: req.isVersionDeprecated
  });
};

// Content negotiation based on version
export const versionBasedContentNegotiation = (req: Request, res: Response, next: NextFunction): void => {
  // Set different content types based on version if needed
  switch (req.apiVersion) {
    case 'v1':
      res.setHeader('Content-Type', 'application/json; charset=utf-8; version=1.0');
      break;
    case 'v2':
      res.setHeader('Content-Type', 'application/json; charset=utf-8; version=2.0');
      break;
  }
  
  next();
};

// Export all version-related utilities
export default {
  detectApiVersion,
  requireVersion,
  validateVersion,
  blockDeprecatedVersions,
  versionedResponse,
  hasFeature,
  getVersionConfig,
  getVersionInfo,
  getVersionInfoEndpoint,
  versionBasedContentNegotiation,
  SUPPORTED_VERSIONS,
  DEFAULT_VERSION,
  LATEST_VERSION
}; 