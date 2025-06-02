import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

const prisma = new PrismaClient();

beforeAll(async () => {
  // Setup test database
  await prisma.$connect();
});

afterAll(async () => {
  // Cleanup test database
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Clean up data before each test in correct order
  try {
    await prisma.userSession.deleteMany();
    await prisma.token.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.user.deleteMany();
  } catch (error) {
    console.warn('Database cleanup warning:', error);
  }
});

// Global test utilities
declare global {
  var testUtils: {
    createTestUser: (overrides?: any) => Promise<any>;
  };
}

(global as any).testUtils = {
  createTestUser: async (overrides = {}) => {
    return prisma.user.create({
      data: {
        email: 'test@example.com',
        passwordHash: '$2a$12$test.hash.here',
        firstName: 'Test',
        lastName: 'User',
        isVerified: true,
        ...overrides
      }
    });
  }
}; 