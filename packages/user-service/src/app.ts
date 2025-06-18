import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { PrismaClient } from '@prisma/client';

// Import middlewares
import { appLogger, requestLoggingMiddleware } from './utils/logger';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import { detectApiVersion, validateVersion, versionBasedContentNegotiation } from './middlewares/versioning.middleware';
import { generalRateLimit } from './middlewares/rate-limit.middleware';

// Import routes
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';

/**
 * Create Express Application
 * Follows comprehensive rules for application setup
 */
export const createApp = (): Application => {
  const app = express();

  // Trust proxy for accurate IP addresses
  app.set('trust proxy', 1);

  // Security middlewares
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));

  // CORS configuration
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:19006'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Version', 'API-Version', 'X-Request-ID']
  }));

  // Compression middleware
  app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    }
  }));

  // Request parsing middleware
  app.use(express.json({ 
    limit: '10mb',
    strict: true
  }));
  app.use(express.urlencoded({ 
    extended: true,
    limit: '10mb'
  }));

  // Request logging middleware (must be before other middlewares)
  app.use(requestLoggingMiddleware);

  // API versioning middleware
  app.use(detectApiVersion);
  app.use(validateVersion);
  app.use(versionBasedContentNegotiation);

  // Rate limiting middleware
  app.use(generalRateLimit);

  // Health check endpoint
  app.get('/health', async (req, res) => {
    try {
      // Test database connection
      const prisma = new PrismaClient();
      await prisma.$queryRaw`SELECT 1`;
      await prisma.$disconnect();
      
      res.status(200).json({
        status: 'OK',
        service: 'User Service',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.APP_VERSION || '1.0.0',
        database: 'Connected'
      });
    } catch (error) {
      appLogger.error('Health check failed:', { error: error instanceof Error ? error : new Error(String(error)) });
      res.status(503).json({
        status: 'ERROR',
        service: 'User Service',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.APP_VERSION || '1.0.0',
        database: 'Disconnected',
        error: 'Database connection failed'
      });
    }
  });

  // API routes
  app.use('/auth', authRoutes);
  app.use('/users', userRoutes);

  // API documentation
  app.get('/docs', (req, res) => {
    res.json({
      name: 'E-Learning AI User Service',
      version: process.env.APP_VERSION || '1.0.0',
      description: 'User management and authentication service',
      endpoints: {
        '/health': 'Health check',
        '/auth/register': 'User registration',
        '/auth/login': 'User login',
        '/auth/logout': 'User logout',
        '/auth/forgot-password': 'Forgot password',
        '/auth/reset-password': 'Reset password',
        '/auth/verify-email': 'Verify email',
        '/auth/resend-verification': 'Resend verification email',
        '/users/profile': 'User profile management'
      }
    });
  });

  // Default route
  app.get('/', (req, res) => {
    res.json({
      message: 'E-Learning AI User Service',
      version: process.env.APP_VERSION || '1.0.0',
      status: 'Running',
      docs: '/docs',
      health: '/health'
    });
  });

  // 404 handler (must be before error handler)
  app.use(notFoundHandler);

  // Global error handler (must be last)
  app.use(errorHandler);

  return app;
}; 