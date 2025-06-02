import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

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

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'Content Service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

// Course management routes
app.get('/courses', (req, res) => {
  res.status(200).json({
    message: 'Get all courses endpoint',
    status: 'Not implemented yet',
    service: 'Content Service'
  });
});

app.get('/courses/:id', (req, res) => {
  res.status(200).json({
    message: `Get course ${req.params.id} endpoint`,
    status: 'Not implemented yet',
    service: 'Content Service'
  });
});

app.post('/courses', (req, res) => {
  res.status(200).json({
    message: 'Create new course endpoint',
    status: 'Not implemented yet',
    service: 'Content Service'
  });
});

app.put('/courses/:id', (req, res) => {
  res.status(200).json({
    message: `Update course ${req.params.id} endpoint`,
    status: 'Not implemented yet',
    service: 'Content Service'
  });
});

// Lesson management routes
app.get('/courses/:courseId/lessons', (req, res) => {
  res.status(200).json({
    message: `Get lessons for course ${req.params.courseId} endpoint`,
    status: 'Not implemented yet',
    service: 'Content Service'
  });
});

app.get('/lessons/:id', (req, res) => {
  res.status(200).json({
    message: `Get lesson ${req.params.id} endpoint`,
    status: 'Not implemented yet',
    service: 'Content Service'
  });
});

app.post('/courses/:courseId/lessons', (req, res) => {
  res.status(200).json({
    message: `Create lesson for course ${req.params.courseId} endpoint`,
    status: 'Not implemented yet',
    service: 'Content Service'
  });
});

// Exercise management routes
app.get('/lessons/:lessonId/exercises', (req, res) => {
  res.status(200).json({
    message: `Get exercises for lesson ${req.params.lessonId} endpoint`,
    status: 'Not implemented yet',
    service: 'Content Service'
  });
});

app.get('/exercises/:id', (req, res) => {
  res.status(200).json({
    message: `Get exercise ${req.params.id} endpoint`,
    status: 'Not implemented yet',
    service: 'Content Service'
  });
});

app.post('/lessons/:lessonId/exercises', (req, res) => {
  res.status(200).json({
    message: `Create exercise for lesson ${req.params.lessonId} endpoint`,
    status: 'Not implemented yet',
    service: 'Content Service'
  });
});

// Content generation routes (AI integration)
app.post('/content/generate', (req, res) => {
  res.status(200).json({
    message: 'AI content generation endpoint',
    status: 'Not implemented yet',
    service: 'Content Service'
  });
});

app.post('/content/translate', (req, res) => {
  res.status(200).json({
    message: 'Content translation endpoint',
    status: 'Not implemented yet',
    service: 'Content Service'
  });
});

// Content search routes
app.get('/search', (req, res) => {
  res.status(200).json({
    message: 'Content search endpoint',
    query: req.query.q || '',
    status: 'Not implemented yet',
    service: 'Content Service'
  });
});

// API documentation
app.get('/docs', (req, res) => {
  res.json({
    name: 'E-Learning AI Content Service',
    version: '1.0.0',
    description: 'Learning content management service',
    endpoints: {
      '/health': 'Health check',
      '/courses': 'Course management',
      '/courses/:id': 'Specific course operations',
      '/courses/:courseId/lessons': 'Lesson management',
      '/lessons/:id': 'Specific lesson operations',
      '/lessons/:lessonId/exercises': 'Exercise management',
      '/exercises/:id': 'Specific exercise operations',
      '/content/generate': 'AI content generation',
      '/content/translate': 'Content translation',
      '/search': 'Content search'
    }
  });
});

// Default route
app.get('/', (req, res) => {
  res.json({
    message: 'E-Learning AI Content Service',
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
    service: 'Content Service'
  });
});

// Error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', error);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    service: 'Content Service'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`📚 Content Service running on port ${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/docs`);
  console.log(`❤️  Health Check: http://localhost:${PORT}/health`);
}); 