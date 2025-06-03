# Content Service Dockerfile - Monorepo Multi-stage Build
FROM node:18-alpine AS base

# Install curl for health checks and OpenSSL for Prisma
RUN apk add --no-cache curl openssl openssl-dev

# Set working directory
WORKDIR /app

# Copy root package files and workspace config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./

# Copy shared packages
COPY shared/ ./shared/

# Copy content-service specific files
COPY packages/content-service/ ./packages/content-service/

# Install pnpm
RUN npm install -g pnpm

# Install all dependencies (monorepo)
RUN pnpm install --frozen-lockfile

# Build shared packages first
RUN pnpm --filter "@elearning/common-types" build || echo "No build script for common-types"
RUN pnpm --filter "@elearning/auth-utils" build || echo "No build script for auth-utils"
RUN pnpm --filter "@elearning/logger" build || echo "No build script for logger"
RUN pnpm --filter "@elearning/config-utils" build || echo "No build script for config-utils"

# Generate Prisma client and build content-service
WORKDIR /app/packages/content-service
RUN pnpm prisma generate
WORKDIR /app
RUN pnpm --filter "@elearning/content-service" build

# Production stage
FROM node:18-alpine AS production

# Install curl for health checks and OpenSSL for Prisma
RUN apk add --no-cache curl openssl openssl-dev

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files and monorepo configuration
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=base /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=base /app/packages/content-service/package.json ./packages/content-service/package.json
COPY --from=base /app/packages/content-service/prisma ./packages/content-service/prisma

# Install production dependencies only (for the specific service)
WORKDIR /app/packages/content-service
RUN pnpm install --frozen-lockfile --prod
WORKDIR /app

# Copy built application
COPY --from=base /app/packages/content-service/dist ./packages/content-service/dist

# Generate Prisma client in production stage (ensure it's available)
WORKDIR /app/packages/content-service
RUN pnpm exec prisma generate
WORKDIR /app

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3002/health || exit 1

# Start the application with database migration
CMD ["sh", "-c", "cd packages/content-service && pnpm exec prisma migrate deploy && node dist/index.js"] 