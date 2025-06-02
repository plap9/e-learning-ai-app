# 🚀 Quick Start Guide

This guide will help you get the E-Learning AI App running in under 10 minutes.

## 📋 Prerequisites

Make sure you have the following installed:
- **Node.js 18+** (Download from [nodejs.org](https://nodejs.org/))
- **Docker Desktop** (Download from [docker.com](https://www.docker.com/products/docker-desktop))
- **pnpm** (Install with `npm install -g pnpm`)

## 🎯 Two Options to Get Started

### Option 1: Docker (Recommended for beginners)

This will run everything in containers - no need to install databases locally.

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd e-learning-ai-app

# 2. Copy environment file
cp env.example .env

# 3. Start all services with Docker
docker-compose up --build

# 4. Wait for all services to start (takes 2-3 minutes first time)
# You'll see "All services are ready!" when done

# 5. Test the API
curl http://localhost:3000/health
```

✅ **That's it!** Your API is running at http://localhost:3000

### Option 2: Local Development

For active development where you want to modify code.

```bash
# 1. Clone and enter directory
git clone <your-repo-url>
cd e-learning-ai-app

# 2. Install all dependencies
pnpm install

# 3. Start databases in Docker
docker-compose up postgres redis -d

# 4. Copy and configure environment
cp env.example .env
# Edit .env file with your settings

# 5. Start all services in development mode
pnpm dev
```

This will start all services with hot-reload enabled.

## 🧪 Verify Everything Works

### Check Health Status
```bash
# API Gateway health
curl http://localhost:3000/health

# Individual services
curl http://localhost:3001/health  # User Service
curl http://localhost:3002/health  # Content Service
curl http://localhost:3003/health  # Payment Service
curl http://localhost:8000/health  # AI Service
curl http://localhost:8001/health  # Audio Service
```

### Test User Registration
```bash
curl -X POST http://localhost:3000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User"
  }'
```

## 📱 Run Mobile App

```bash
# Navigate to mobile app
cd mobile-app

# Install dependencies
pnpm install

# Start Expo development server
pnpm start

# Scan QR code with Expo Go app (iOS/Android)
# Or press 'w' to open in web browser
```

## 🛠️ Common Issues & Solutions

### Docker Issues
```bash
# If containers fail to start
docker-compose down
docker system prune -f
docker-compose up --build

# View logs
docker-compose logs -f [service-name]
```

### Port Conflicts
If you see "port already in use" errors:
```bash
# Check what's using the port
netstat -tulpn | grep :3000

# Kill the process or change ports in docker-compose.yml
```

### Database Connection Issues
```bash
# Reset database
docker-compose down
docker volume rm elearning-ai-app_postgres_data
docker-compose up postgres -d
```

## 🎯 What's Next?

### Explore the API
- **Swagger Documentation**: http://localhost:3000/docs (when implemented)
- **User endpoints**: http://localhost:3000/api/users/
- **Content endpoints**: http://localhost:3000/api/content/
- **AI endpoints**: http://localhost:3000/api/ai/

### Development
```bash
# Watch logs for all services
docker-compose logs -f

# Rebuild specific service
docker-compose up --build user-service

# Access service shell
docker-compose exec user-service sh
```

### Mobile Development
```bash
cd mobile-app
pnpm ios    # Run on iOS simulator
pnpm android # Run on Android emulator
```

## 📊 Service URLs

| Service | URL | Purpose |
|---------|-----|---------|
| API Gateway | http://localhost:3000 | Main entry point |
| User Service | http://localhost:3001 | Authentication & users |
| Content Service | http://localhost:3002 | Learning content |
| Payment Service | http://localhost:3003 | Payments & subscriptions |
| AI Service | http://localhost:8000 | AI processing |
| Audio Service | http://localhost:8001 | Speech processing |
| PostgreSQL | localhost:5432 | Database |
| Redis | localhost:6379 | Cache & sessions |

## 🔧 Environment Configuration

Key environment variables to configure in `.env`:

```bash
# Database (for local development)
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/elearning_ai
REDIS_URL=redis://localhost:6379

# JWT Secret (change in production!)
JWT_SECRET=your-super-secret-jwt-key

# AI Services (optional for basic testing)
OPENAI_API_KEY=your-openai-api-key
GOOGLE_CLOUD_PROJECT=your-gcp-project

# Payment (optional for payment testing)
STRIPE_SECRET_KEY=your-stripe-secret-key
```

## ⚡ Quick Commands

```bash
# Start everything
docker-compose up

# Stop everything
docker-compose down

# View all logs
docker-compose logs -f

# Rebuild and restart
docker-compose up --build

# Clean restart
docker-compose down && docker-compose up --build

# Install dependencies in all packages
pnpm install

# Run all services in dev mode
pnpm dev

# Run tests
pnpm test

# Build all services
pnpm build
```

## 🆘 Need Help?

1. **Check the logs**: `docker-compose logs -f`
2. **Restart services**: `docker-compose restart`
3. **Clean slate**: `docker-compose down && docker-compose up --build`
4. **Check issues**: Look at the GitHub issues page
5. **Ask for help**: Create a new issue with your logs

---

Happy coding! 🎉 

Cài đặt dependencies cho từng package

Tạo code skeleton cho từng service

Thiết lập database schemas

Implement basic APIs

Tạo mobile app foundation