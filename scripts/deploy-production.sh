#!/bin/bash

# Production Deployment Script for E-Learning AI App
set -e

echo "🚀 Starting Production Deployment..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOCKER_USERNAME=${DOCKER_USERNAME:-"DOCKER_USERNAME"}
IMAGE_TAG=${IMAGE_TAG:-"latest"}
ENV_FILE=${ENV_FILE:-".env.prod"}

# Check if production environment file exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ Production environment file ($ENV_FILE) not found!${NC}"
    echo -e "${YELLOW}📝 Please copy .env.prod.example to .env.prod and configure your values${NC}"
    exit 1
fi

echo -e "${BLUE}📋 Using configuration:${NC}"
echo -e "   Docker Username: ${DOCKER_USERNAME}"
echo -e "   Image Tag: ${IMAGE_TAG}"
echo -e "   Environment File: ${ENV_FILE}"

# Load environment variables
export $(cat $ENV_FILE | grep -v '^#' | xargs)

echo -e "${YELLOW}🐳 Pulling latest Docker images...${NC}"
docker pull $DOCKER_USERNAME/elearning-api-gateway:$IMAGE_TAG
docker pull $DOCKER_USERNAME/elearning-user-service:$IMAGE_TAG
docker pull $DOCKER_USERNAME/elearning-content-service:$IMAGE_TAG
docker pull $DOCKER_USERNAME/elearning-payment-service:$IMAGE_TAG
docker pull $DOCKER_USERNAME/elearning-ai-service:$IMAGE_TAG
docker pull $DOCKER_USERNAME/elearning-audio-service:$IMAGE_TAG

echo -e "${YELLOW}🔄 Stopping existing services...${NC}"
docker-compose -f docker-compose.prod.yml --env-file $ENV_FILE down --remove-orphans

echo -e "${YELLOW}🧹 Cleaning up unused Docker resources...${NC}"
docker system prune -f

echo -e "${YELLOW}📊 Creating Docker networks and volumes...${NC}"
docker-compose -f docker-compose.prod.yml --env-file $ENV_FILE up --no-start

echo -e "${YELLOW}🗄️  Starting database services...${NC}"
docker-compose -f docker-compose.prod.yml --env-file $ENV_FILE up -d postgres redis

echo -e "${YELLOW}⏳ Waiting for database to be ready...${NC}"
sleep 30

echo -e "${YELLOW}🏗️  Running database migrations...${NC}"
# Run migrations on user service (adjust as needed for other services)
docker-compose -f docker-compose.prod.yml --env-file $ENV_FILE run --rm user-service npx prisma migrate deploy

echo -e "${YELLOW}🚀 Starting all services...${NC}"
docker-compose -f docker-compose.prod.yml --env-file $ENV_FILE up -d

echo -e "${YELLOW}⏳ Waiting for services to start...${NC}"
sleep 60

echo -e "${YELLOW}🔍 Checking service health...${NC}"
services=("api-gateway:3000" "user-service:3001" "content-service:3002" "payment-service:3003" "ai-service:8000" "audio-processing-service:8001")

for service in "${services[@]}"; do
    service_name=$(echo $service | cut -d: -f1)
    port=$(echo $service | cut -d: -f2)
    
    if curl -f http://localhost:$port/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ $service_name is healthy${NC}"
    else
        echo -e "${RED}❌ $service_name health check failed${NC}"
    fi
done

echo -e "${YELLOW}📊 Checking Nginx status...${NC}"
if curl -f http://localhost/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Nginx is healthy${NC}"
else
    echo -e "${RED}❌ Nginx health check failed${NC}"
fi

echo -e "${YELLOW}📋 Service Status:${NC}"
docker-compose -f docker-compose.prod.yml --env-file $ENV_FILE ps

echo -e "${YELLOW}📊 Container Resource Usage:${NC}"
docker stats --no-stream

echo -e "${GREEN}🎉 Production Deployment Completed!${NC}"
echo -e "${BLUE}🌐 Your application should be available at:${NC}"
echo -e "   HTTP:  http://your-domain.com"
echo -e "   HTTPS: https://your-domain.com"
echo -e "${BLUE}📊 Monitoring:${NC}"
echo -e "   Nginx Status: http://localhost:8080/nginx_status"
echo -e "   Health Check: http://localhost/health"
echo -e "${BLUE}📚 Useful Commands:${NC}"
echo -e "   View logs: docker-compose -f docker-compose.prod.yml logs -f [service]"
echo -e "   Stop services: docker-compose -f docker-compose.prod.yml down"
echo -e "   Restart service: docker-compose -f docker-compose.prod.yml restart [service]" 