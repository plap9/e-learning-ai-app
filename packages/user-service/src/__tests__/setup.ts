/// <reference types="jest" />
import '@jest/globals';
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.REDIS_URL = 'redis://localhost:6379';

// Global test utilities
declare global {
  var testUtils: {
    createTestUser: (overrides?: any) => any;
  };
}

(global as any).testUtils = {
  createTestUser: (overrides = {}) => ({
    id: 'test-user-id',
    email: 'test@example.com',
    passwordHash: '$2a$12$test.hash.here',
    firstName: 'Test',
    lastName: 'User',
    isVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  })
}; 