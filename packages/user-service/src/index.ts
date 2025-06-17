import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Import custom middleware and utilities
import { appLogger, requestLoggingMiddleware } from './utils/logger';
import { errorHandler, notFoundHandler, handleUnhandledRejection, handleUncaughtException } from './middlewares/error.middleware';
import { detectApiVersion, validateVersion, versionBasedContentNegotiation } from './middlewares/versioning.middleware';
import { generalRateLimit } from './middlewares/rate-limit.middleware';

// Import routes
import authRoutes from './routes/auth.routes';
import { userRoutes } from './routes/user.routes';

// Load environment variables
dotenv.config();

// Initialize Prisma Client
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
});

const app: Application = express();
const PORT = process.env.PORT || 3001;

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Security middleware
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

// Health check with database connection
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    
  res.status(200).json({
    status: 'OK',
    service: 'User Service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
      version: '1.0.0',
      database: 'Connected'
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'ERROR',
      service: 'User Service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      database: 'Disconnected',
      error: 'Database connection failed'
  });
  }
});

// Routes
app.use('/auth', authRoutes);
app.use('/', userRoutes);

// User profile routes
app.get('/profile', (req, res) => {
  res.status(200).json({
    message: 'Get user profile endpoint',
    status: 'Not implemented yet',
    service: 'User Service'
  });
});

app.put('/profile', (req, res) => {
  res.status(200).json({
    message: 'Update user profile endpoint',
    status: 'Not implemented yet',
    service: 'User Service'
  });
});

app.post('/profile/avatar', (req, res) => {
  res.status(200).json({
    message: 'Upload user avatar endpoint',
    status: 'Not implemented yet',
    service: 'User Service'
  });
});

// Learning progress routes
app.get('/progress', (req, res) => {
  res.status(200).json({
    message: 'Get learning progress endpoint',
    status: 'Not implemented yet',
    service: 'User Service'
  });
});

app.post('/progress', (req, res) => {
  res.status(200).json({
    message: 'Update learning progress endpoint',
    status: 'Not implemented yet',
    service: 'User Service'
  });
});

// API documentation
app.get('/docs', (req, res) => {
  res.json({
    name: 'E-Learning AI User Service',
    version: '1.0.0',
    description: 'User management and authentication service',
    endpoints: {
      '/health': 'Health check',
      '/auth/register': 'User registration',
      '/auth/login': 'User login',
      '/auth/logout': 'User logout',
      '/auth/refresh': 'Token refresh',
      '/profile': 'User profile management',
      '/profile/avatar': 'Avatar upload',
      '/progress': 'Learning progress tracking'
    }
  });
});

// Default route
app.get('/', (req, res) => {
  res.json({
    message: 'E-Learning AI User Service',
    version: '1.0.0',
    status: 'Running',
    docs: '/docs',
    health: '/health'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The route ${req.originalUrl} does not exist on this service`,
    service: 'User Service'
  });
});

// Error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', error);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    service: 'User Service'
  });
});

// Export app for testing
export { app, prisma };

// Database initialization and server startup
async function startServer() {
  try {
    // Connect to database
    await prisma.$connect();
    console.log('🗄️  Database connected successfully');

// Start server only if not in test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`👤 User Service running on port ${PORT}`);
    console.log(`📚 API Documentation: http://localhost:${PORT}/docs`);
    console.log(`❤️  Health Check: http://localhost:${PORT}/health`);
        console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      });
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

// Start the server
if (process.env.NODE_ENV !== 'test') {
  startServer();
} 