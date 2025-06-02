// Test setup for API Gateway
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Global test timeout
jest.setTimeout(30000);

// Mock console methods in tests
global.console = {
  ...console,
  // Uncomment to ignore specific log levels
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
}; 