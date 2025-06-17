import { Request } from 'express';

// Shared interfaces for Express Request extensions
export interface RequestContext {
  requestId: string;
  userId?: string;
  userAgent: string;
  ip: string;
  startTime: number;
  apiVersion: string;
}

export interface UserPayload {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isVerified: boolean;
  plan: string;
}

export interface Logger {
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
  logAuth: (event: string, email?: string, userId?: string, success?: boolean) => void;
  logSecurity: (event: string, severity: 'low' | 'medium' | 'high', details: Record<string, unknown>) => void;
}

// Global Express namespace extensions
declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
      context?: RequestContext;
      logger?: Logger;
    }
  }
}

// Export extended Request type for explicit typing
export interface AuthRequest extends Request {
  user?: UserPayload;
  context?: RequestContext;
  logger?: Logger;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  meta: {
    timestamp: string;
    requestId?: string;
    version: string;
    duration?: number;
    [key: string]: unknown;
  };
}

export interface HealthMetrics {
  status: string;
  timestamp: string;
  uptime: number;
  memory: NodeJS.MemoryUsage;
  cpu: NodeJS.CpuUsage;
  nodeVersion: string;
  environment: string;
  version: string;
} 