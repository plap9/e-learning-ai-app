import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { createApp } from './app';
import { appLogger } from './utils/logger';
import { handleUnhandledRejection, handleUncaughtException } from './middlewares/error.middleware';

// Load environment variables
dotenv.config();

// Initialize Prisma client
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
  errorFormat: 'pretty'
});

// Create Express application
export const app = createApp();

// Server configuration
const PORT = parseInt(process.env.PORT || '3001', 10);

// Global error handlers
process.on('unhandledRejection', handleUnhandledRejection);
process.on('uncaughtException', handleUncaughtException);

// Database initialization and server startup
async function startServer() {
  try {
    // Connect to database
    await prisma.$connect();
    appLogger.info('🗄️  Database connected successfully');

    // Start server only if not in test environment
    if (process.env.NODE_ENV !== 'test') {
      const server = app.listen(PORT, () => {
        appLogger.info(`👤 User Service running on port ${PORT}`);
        appLogger.info(`📚 API Documentation: http://localhost:${PORT}/docs`);
        appLogger.info(`❤️  Health Check: http://localhost:${PORT}/health`);
        appLogger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      });

      // Handle server errors
      server.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          appLogger.error(`Port ${PORT} is already in use`);
        } else {
          appLogger.error('Server error:', error);
        }
        process.exit(1);
      });
    }
  } catch (error) {
    appLogger.error('Failed to start server:', { error: error instanceof Error ? error : new Error(String(error)) });
    process.exit(1);
  }
}

// Graceful shutdown handlers
const gracefulShutdown = async (signal: string) => {
  appLogger.info(`Received ${signal}. Shutting down gracefully...`);
  
  try {
    // Close database connection
    await prisma.$disconnect();
    appLogger.info('Database connection closed');
    
    appLogger.info('Server shut down successfully');
    process.exit(0);
  } catch (error) {
    appLogger.error('Error during shutdown:', { error: error instanceof Error ? error : new Error(String(error)) });
    process.exit(1);
  }
};

// Register shutdown handlers
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Start the server
if (process.env.NODE_ENV !== 'test') {
  startServer().catch((error) => {
    appLogger.error('Failed to start server:', { error: error instanceof Error ? error : new Error(String(error)) });
    process.exit(1);
  });
} 