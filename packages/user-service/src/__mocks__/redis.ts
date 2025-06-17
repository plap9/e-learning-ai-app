// Mock Redis client for testing
const mockRedisClient = {
  connect: () => Promise.resolve(),
  disconnect: () => Promise.resolve(),
  quit: () => Promise.resolve(),
  on: () => {},
  incr: () => Promise.resolve(1),
  get: () => Promise.resolve(null),
  expire: () => Promise.resolve(true),
  del: () => Promise.resolve(1),
  keys: () => Promise.resolve([]),
  set: () => Promise.resolve('OK')
};

export const createClient = () => mockRedisClient; 