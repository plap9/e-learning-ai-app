import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:19006'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Middleware
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check with backend service connectivity
app.get('/health', async (req, res) => {
  try {
    const serviceChecks = await Promise.allSettled([
      fetch(`${services.user}/health`).then(r => ({ service: 'user', ok: r.ok })).catch(() => ({ service: 'user', ok: false })),
      fetch(`${services.content}/health`).then(r => ({ service: 'content', ok: r.ok })).catch(() => ({ service: 'content', ok: false })),
      fetch(`${services.payment}/health`).then(r => ({ service: 'payment', ok: r.ok })).catch(() => ({ service: 'payment', ok: false })),
      fetch(`${services.ai}/health`).then(r => ({ service: 'ai', ok: r.ok })).catch(() => ({ service: 'ai', ok: false })),
      fetch(`${services.audio}/health`).then(r => ({ service: 'audio', ok: r.ok })).catch(() => ({ service: 'audio', ok: false }))
    ]);

    const serviceStatus = serviceChecks.map(result => 
      result.status === 'fulfilled' ? result.value : { service: 'unknown', ok: false }
    );

    const allHealthy = serviceStatus.every(s => s.ok);

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'OK' : 'DEGRADED',
      service: 'API Gateway',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      services: serviceStatus
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'ERROR',
      service: 'API Gateway',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      error: 'Failed to check backend services'
    });
  }
});

// Service routes with proxy
const services = {
  user: process.env.USER_SERVICE_URL || 'http://localhost:3001',
  content: process.env.CONTENT_SERVICE_URL || 'http://localhost:3002',
  payment: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3003',
  ai: process.env.AI_SERVICE_URL || 'http://localhost:8000',
  audio: process.env.AUDIO_SERVICE_URL || 'http://localhost:8001'
};

// Proxy configurations
app.use('/api/users', createProxyMiddleware({
  target: services.user,
  changeOrigin: true,
  pathRewrite: { '^/api/users': '' }
}));

app.use('/api/content', createProxyMiddleware({
  target: services.content,
  changeOrigin: true,
  pathRewrite: { '^/api/content': '' }
}));

app.use('/api/payments', createProxyMiddleware({
  target: services.payment,
  changeOrigin: true,
  pathRewrite: { '^/api/payments': '' }
}));

app.use('/api/ai', createProxyMiddleware({
  target: services.ai,
  changeOrigin: true,
  pathRewrite: { '^/api/ai': '' }
}));

app.use('/api/audio', createProxyMiddleware({
  target: services.audio,
  changeOrigin: true,
  pathRewrite: { '^/api/audio': '' }
}));

// API documentation
app.get('/api/docs', (req, res) => {
  res.json({
    name: 'E-Learning AI API Gateway',
    version: '1.0.0',
    services: {
      user: `${services.user} - User management and authentication`,
      content: `${services.content} - Learning content management`,
      payment: `${services.payment} - Payment processing`,
      ai: `${services.ai} - AI services (Python FastAPI)`,
      audio: `${services.audio} - Audio processing (Python FastAPI)`
    },
    endpoints: {
      '/health': 'Health check',
      '/api/users/*': 'User service proxy',
      '/api/content/*': 'Content service proxy',
      '/api/payments/*': 'Payment service proxy',
      '/api/ai/*': 'AI service proxy',
      '/api/audio/*': 'Audio service proxy'
    }
  });
});

// Default route
app.get('/', (req, res) => {
  res.json({
    message: 'E-Learning AI API Gateway',
    version: '1.0.0',
    status: 'Running',
    docs: '/api/docs',
    health: '/health'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The route ${req.originalUrl} does not exist on this server`,
    availableRoutes: ['/health', '/api/docs', '/api/users/*', '/api/content/*', '/api/payments/*', '/api/ai/*', '/api/audio/*']
  });
});

// Error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', error);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 API Gateway running on port ${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
  console.log(`❤️  Health Check: http://localhost:${PORT}/health`);
  console.log(`🔗 Service URLs:`);
  Object.entries(services).forEach(([name, url]) => {
    console.log(`   ${name}: ${url}`);
  });
}); 