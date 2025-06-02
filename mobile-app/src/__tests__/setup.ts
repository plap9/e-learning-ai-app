// Test setup for Mobile App
import '@testing-library/jest-native/extend-expect';

// Mock Expo modules
jest.mock('expo-font');
jest.mock('expo-asset');
jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      name: 'E-Learning AI App',
      slug: 'elearning-ai-app',
    },
  },
}));

// Mock React Native modules
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

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