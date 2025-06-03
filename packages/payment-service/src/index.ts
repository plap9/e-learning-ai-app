import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Load environment variables
dotenv.config();

// Initialize Prisma Client
const prisma = new PrismaClient();

const app: Application = express();
const PORT = process.env.PORT || 3003;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:19006'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50 // limit each IP to 50 requests per windowMs (stricter for payment service)
});
app.use(limiter);

// Middleware
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '1mb' })); // Smaller limit for payment service
app.use(express.urlencoded({ extended: true }));

// Health check with database connection
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    
    res.status(200).json({
      status: 'OK',
      service: 'Payment Service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      database: 'Connected'
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'ERROR',
      service: 'Payment Service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      database: 'Disconnected',
      error: 'Database connection failed'
    });
  }
});

// Stripe payment routes
app.post('/stripe/create-payment-intent', (req, res) => {
  res.status(200).json({
    message: 'Stripe payment intent creation endpoint',
    status: 'Not implemented yet',
    service: 'Payment Service'
  });
});

app.post('/stripe/confirm-payment', (req, res) => {
  res.status(200).json({
    message: 'Stripe payment confirmation endpoint',
    status: 'Not implemented yet',
    service: 'Payment Service'
  });
});

app.post('/stripe/webhook', (req, res) => {
  res.status(200).json({
    message: 'Stripe webhook endpoint',
    status: 'Not implemented yet',
    service: 'Payment Service'
  });
});

// MoMo payment routes
app.post('/momo/create-payment', (req, res) => {
  res.status(200).json({
    message: 'MoMo payment creation endpoint',
    status: 'Not implemented yet',
    service: 'Payment Service'
  });
});

app.post('/momo/callback', (req, res) => {
  res.status(200).json({
    message: 'MoMo payment callback endpoint',
    status: 'Not implemented yet',
    service: 'Payment Service'
  });
});

app.post('/momo/notify', (req, res) => {
  res.status(200).json({
    message: 'MoMo payment notification endpoint',
    status: 'Not implemented yet',
    service: 'Payment Service'
  });
});

// ZaloPay payment routes
app.post('/zalopay/create-payment', (req, res) => {
  res.status(200).json({
    message: 'ZaloPay payment creation endpoint',
    status: 'Not implemented yet',
    service: 'Payment Service'
  });
});

app.post('/zalopay/callback', (req, res) => {
  res.status(200).json({
    message: 'ZaloPay payment callback endpoint',
    status: 'Not implemented yet',
    service: 'Payment Service'
  });
});

// Subscription management routes
app.get('/subscriptions', (req, res) => {
  res.status(200).json({
    message: 'Get user subscriptions endpoint',
    status: 'Not implemented yet',
    service: 'Payment Service'
  });
});

app.post('/subscriptions', (req, res) => {
  res.status(200).json({
    message: 'Create subscription endpoint',
    status: 'Not implemented yet',
    service: 'Payment Service'
  });
});

app.put('/subscriptions/:id', (req, res) => {
  res.status(200).json({
    message: `Update subscription ${req.params.id} endpoint`,
    status: 'Not implemented yet',
    service: 'Payment Service'
  });
});

app.delete('/subscriptions/:id', (req, res) => {
  res.status(200).json({
    message: `Cancel subscription ${req.params.id} endpoint`,
    status: 'Not implemented yet',
    service: 'Payment Service'
  });
});

// Payment history routes
app.get('/payments', (req, res) => {
  res.status(200).json({
    message: 'Get payment history endpoint',
    status: 'Not implemented yet',
    service: 'Payment Service'
  });
});

app.get('/payments/:id', (req, res) => {
  res.status(200).json({
    message: `Get payment ${req.params.id} details endpoint`,
    status: 'Not implemented yet',
    service: 'Payment Service'
  });
});

// Refund routes
app.post('/refunds', (req, res) => {
  res.status(200).json({
    message: 'Create refund endpoint',
    status: 'Not implemented yet',
    service: 'Payment Service'
  });
});

app.get('/refunds/:id', (req, res) => {
  res.status(200).json({
    message: `Get refund ${req.params.id} status endpoint`,
    status: 'Not implemented yet',
    service: 'Payment Service'
  });
});

// API documentation
app.get('/docs', (req, res) => {
  res.json({
    name: 'E-Learning AI Payment Service',
    version: '1.0.0',
    description: 'Payment processing service supporting Stripe, MoMo, and ZaloPay',
    endpoints: {
      '/health': 'Health check',
      '/stripe/*': 'Stripe payment integration',
      '/momo/*': 'MoMo payment integration',
      '/zalopay/*': 'ZaloPay payment integration',
      '/subscriptions': 'Subscription management',
      '/payments': 'Payment history',
      '/refunds': 'Refund management'
    },
    security: {
      rateLimit: '50 requests per 15 minutes',
      cors: 'Configured for secure origins',
      webhooks: 'Signature verification required'
    }
  });
});

// Default route
app.get('/', (req, res) => {
  res.json({
    message: 'E-Learning AI Payment Service',
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
    service: 'Payment Service'
  });
});

// Error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', error);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    service: 'Payment Service'
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
        console.log(`💳 Payment Service running on port ${PORT}`);
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