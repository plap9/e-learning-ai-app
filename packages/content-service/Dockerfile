# Content Service Dockerfile - Monorepo Build
FROM node:18-alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Set working directory
WORKDIR /app

# Copy root package files and workspace config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./

# Copy shared packages
COPY shared/ ./shared/

# Install pnpm
RUN npm install -g pnpm

# Install all dependencies (monorepo)
RUN pnpm install --frozen-lockfile

# Copy content-service specific files
COPY packages/content-service/ ./packages/content-service/

# Build shared packages first
RUN pnpm --filter "@elearning/common-types" build || echo "No build script for common-types"
RUN pnpm --filter "@elearning/auth-utils" build || echo "No build script for auth-utils"
RUN pnpm --filter "@elearning/logger" build || echo "No build script for logger"
RUN pnpm --filter "@elearning/config-utils" build || echo "No build script for config-utils"

# Build content-service
RUN pnpm --filter "@elearning/content-service" build

# Set working directory to content-service
WORKDIR /app/packages/content-service

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3002/health || exit 1

# Start the application
CMD ["pnpm", "start"] 