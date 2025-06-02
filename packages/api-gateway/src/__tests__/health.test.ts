import request from 'supertest';
import express from 'express';

// Simple health check test
describe('API Gateway Health Check', () => {
  const app = express();
  
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', service: 'api-gateway' });
  });

  it('should return health status', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body).toEqual({
      status: 'OK',
      service: 'api-gateway'
    });
  });

  it('should handle 404 for unknown routes', async () => {
    await request(app)
      .get('/unknown-route')
      .expect(404);
  });
}); 