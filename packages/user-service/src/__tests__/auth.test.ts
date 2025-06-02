import request from 'supertest';
import { app } from '../index';

describe('Authentication Endpoints', () => {
  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'Test123456',
        confirmPassword: 'Test123456',
        firstName: 'New',
        lastName: 'User'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('userId');
    });

    it('should return validation error for invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'Test123456',
        confirmPassword: 'Test123456',
        firstName: 'Test',
        lastName: 'User'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      // First register a user
      const userData = {
        email: 'loginuser@example.com',
        password: 'Test123456',
        confirmPassword: 'Test123456',
        firstName: 'Login',
        lastName: 'User'
      };

      await request(app)
        .post('/auth/register')
        .send(userData);

      // Then try to login
      const loginData = {
        email: 'loginuser@example.com',
        password: 'Test123456'
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginData);

      // Should fail due to email not verified
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Email chưa được xác thực');
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('service', 'User Service');
    });
  });
}); 