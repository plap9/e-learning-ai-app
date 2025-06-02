# 🎓 AI-Powered English Learning Application

A comprehensive microservices-based English learning platform with AI integration, designed for solo development but built with enterprise-grade architecture.

## 🚀 Features

### Core Learning Features
- **Adaptive Learning Paths**: AI-generated personalized lessons
- **Pronunciation Analysis**: Real-time speech assessment and feedback
- **Grammar Correction**: Intelligent error detection and suggestions
- **Interactive Conversations**: AI-powered conversation practice
- **Progress Tracking**: Detailed analytics and learning insights

### AI Capabilities
- **Text Generation**: Custom content creation using LLMs
- **Speech-to-Text**: Advanced audio processing with Whisper
- **Text-to-Speech**: Natural voice synthesis
- **Translation**: Multi-language support
- **Content Personalization**: Adaptive difficulty based on user progress

### Payment Integration
- **Stripe**: International payments
- **MoMo**: Vietnamese mobile wallet
- **ZaloPay**: Vietnamese digital payments

## 🏗️ Architecture

### Microservices Overview
```
┌─────────────────┐
│   Mobile App    │ (React Native + Expo)
│  (Port: Expo)   │
└─────────┬───────┘
          │
┌─────────▼───────┐
│   API Gateway   │ (Node.js + Express)
│   (Port: 3000)  │
└─────────┬───────┘
          │
    ┌─────┼─────┐
    │     │     │
┌───▼──┐ ┌▼──┐ ┌▼─────┐
│User  │ │AI │ │Audio │
│Svc   │ │Svc│ │Proc  │
│:3001 │ │:8K│ │:8001 │
└──────┘ └───┘ └──────┘
    │
┌───▼──────┐ ┌─────────┐
│Content   │ │Payment  │
│Service   │ │Service  │
│:3002     │ │:3003    │
└──────────┘ └─────────┘
    │
┌───▼─────────────┐
│   PostgreSQL    │
│   + Redis       │
└─────────────────┘
```

### Technology Stack

#### Backend Services
- **Language**: Node.js + TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL + Redis
- **Authentication**: JWT
- **API Documentation**: Swagger/OpenAPI

#### AI Services
- **Language**: Python
- **Framework**: FastAPI
- **ML Libraries**: PyTorch, Transformers, Whisper
- **Vector DB**: Pinecone (future) / pgvector (current)

#### Frontend
- **Framework**: React Native + Expo
- **State Management**: Zustand
- **UI Library**: Tailwind CSS (NativeWind)
- **Navigation**: React Navigation 6

#### Infrastructure
- **Containerization**: Docker + Docker Compose
- **Cloud**: AWS (RDS, ElastiCache, S3, CloudFront)
- **IaC**: Terraform
- **CI/CD**: GitHub Actions

## 📁 Project Structure

```
e-learning-ai-app/
├── packages/                    # Microservices
│   ├── api-gateway/            # Main API gateway
│   ├── user-service/           # User management & auth
│   ├── content-service/        # Learning content
│   ├── ai-service/             # AI processing (Python)
│   ├── payment-service/        # Payment integrations
│   └── audio-processing-service/ # Speech processing (Python)
├── shared/                     # Shared libraries
│   └── packages/
│       ├── common-types/       # TypeScript interfaces
│       ├── auth-utils/         # Authentication utilities
│       ├── logger/             # Logging configuration
│       └── config-utils/       # Configuration utilities
├── mobile-app/                 # React Native app
├── infra/                      # Infrastructure as Code
│   ├── terraform/              # AWS infrastructure
│   ├── aws-cdk/               # Alternative IaC
│   └── kubernetes/            # K8s manifests (future)
├── .github/workflows/          # CI/CD pipelines
└── docker-compose.yml          # Development environment
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.9+
- Docker & Docker Compose
- pnpm 8+

### Option 1: Docker Development (Recommended)
```bash
# Clone the repository
git clone <repository-url>
cd e-learning-ai-app

# Copy environment variables
cp env.example .env

# Start all services
docker-compose up --build

# The API Gateway will be available at http://localhost:3000
```

### Option 2: Local Development
```bash
# Install dependencies
pnpm install

# Start databases
docker-compose up postgres redis -d

# Start services in development mode
pnpm dev

# Or start services individually:
cd packages/api-gateway && pnpm dev
cd packages/user-service && pnpm dev
cd packages/content-service && pnpm dev
# ... etc
```

### Mobile App Development
```bash
cd mobile-app
pnpm install
pnpm start

# For iOS
pnpm ios

# For Android
pnpm android
```

## 📊 Service Endpoints

### API Gateway (Port 3000)
- **Health Check**: `GET /health`
- **User Routes**: `POST /api/users/*`
- **Content Routes**: `GET /api/content/*`
- **AI Routes**: `POST /api/ai/*`
- **Payment Routes**: `POST /api/payments/*`
- **Audio Routes**: `POST /api/audio/*`

### Individual Services
- **User Service**: http://localhost:3001
- **Content Service**: http://localhost:3002
- **Payment Service**: http://localhost:3003
- **AI Service**: http://localhost:8000
- **Audio Processing**: http://localhost:8001

## 🔧 Development

### Available Scripts
```bash
# Install all dependencies
pnpm install

# Build all services
pnpm build

# Run all services in development
pnpm dev

# Run tests
pnpm test

# Lint code
pnpm lint

# Clean all builds
pnpm clean

# Docker commands
pnpm docker:build    # Build all containers
pnpm docker:up       # Start in detached mode
pnpm docker:down     # Stop all containers
pnpm docker:logs     # View logs
```

### Environment Variables
Copy `env.example` to `.env` and update the following:

#### Required for Development
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `JWT_SECRET`: JWT signing secret

#### Required for AI Features
- `OPENAI_API_KEY`: OpenAI API key
- `GOOGLE_CLOUD_PROJECT`: GCP project ID

#### Required for Payments
- `STRIPE_SECRET_KEY`: Stripe secret key
- `MOMO_PARTNER_CODE`: MoMo partner credentials
- `ZALOPAY_APP_ID`: ZaloPay app credentials

## 🧪 Testing

### Unit Tests
```bash
# Run all tests
pnpm test

# Run tests for specific service
cd packages/user-service && pnpm test
```

### Integration Tests
```bash
# Start test environment
docker-compose -f docker-compose.test.yml up -d

# Run integration tests
pnpm test:integration
```

### API Testing
Use the provided Postman collection or test scripts:
```bash
# Test all endpoints
./scripts/test-api.sh
```

## 🚀 Deployment

### Development/Staging
```bash
# Deploy to AWS using Terraform
cd infra/terraform
terraform init
terraform plan
terraform apply
```

### Production
```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy using your preferred method:
# - AWS ECS/Fargate
# - Kubernetes
# - Docker Swarm
```

## 📈 Monitoring & Logging

### Health Checks
Each service exposes health check endpoints:
- `/health` - Basic health status
- `/health/ready` - Readiness probe
- `/health/live` - Liveness probe

### Logging
Centralized logging using:
- **Development**: Console output
- **Production**: CloudWatch Logs
- **Format**: Structured JSON logs

### Metrics
- **Application Metrics**: Custom business metrics
- **Infrastructure Metrics**: AWS CloudWatch
- **APM**: AWS X-Ray tracing

## 🔒 Security

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (RBAC)
- API rate limiting
- CORS configuration

### Data Protection
- Password hashing (bcrypt)
- SQL injection prevention
- XSS protection
- HTTPS enforcement

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Code Standards
- TypeScript for Node.js services
- Python type hints for AI services
- ESLint + Prettier for code formatting
- Conventional commits for commit messages

## 📋 Roadmap

### Phase 1: MVP (Current)
- [x] Basic microservices architecture
- [x] User authentication
- [x] Content management
- [x] AI API integrations
- [ ] Mobile app MVP

### Phase 2: AI Enhancement
- [ ] Custom model fine-tuning
- [ ] Vector database integration
- [ ] Advanced pronunciation analysis
- [ ] Personalized learning paths

### Phase 3: Scale & Optimize
- [ ] Kubernetes deployment
- [ ] Performance optimization
- [ ] Analytics dashboard
- [ ] Mobile app features

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

For support and questions:
- Create an issue in this repository
- Email: developer@elearning-ai.com
- Documentation: [Wiki](link-to-wiki)

## 🙏 Acknowledgements

- OpenAI for GPT integration
- Whisper for speech recognition
- React Native community
- FastAPI for Python services
- All open source contributors

---

Built with ❤️ for English learners worldwide 