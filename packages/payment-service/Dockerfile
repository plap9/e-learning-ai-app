# Payment Service Dockerfile - Monorepo Multi-stage Build
FROM node:18-alpine AS base

# Install curl for health checks and OpenSSL for Prisma
RUN apk add --no-cache curl openssl openssl-dev

# Set working directory
WORKDIR /app

# Copy root package files and workspace config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./

# Copy shared packages
COPY shared/ ./shared/

# Copy payment-service specific files
COPY packages/payment-service/ ./packages/payment-service/

# Install pnpm
RUN npm install -g pnpm

# Install all dependencies (monorepo)
RUN pnpm install --frozen-lockfile

# Build shared packages first
RUN pnpm --filter "@elearning/common-types" build || echo "No build script for common-types"
RUN pnpm --filter "@elearning/auth-utils" build || echo "No build script for auth-utils"
RUN pnpm --filter "@elearning/logger" build || echo "No build script for logger"
RUN pnpm --filter "@elearning/config-utils" build || echo "No build script for config-utils"

# Generate Prisma client and build payment-service
WORKDIR /app/packages/payment-service
RUN pnpm prisma generate
WORKDIR /app
RUN pnpm --filter "@elearning/payment-service" build

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
COPY --from=base /app/packages/payment-service/package.json ./packages/payment-service/package.json
COPY --from=base /app/packages/payment-service/prisma ./packages/payment-service/prisma

# Install production dependencies only (for the specific service)
WORKDIR /app/packages/payment-service
RUN pnpm install --frozen-lockfile --prod
WORKDIR /app

# Copy built application
COPY --from=base /app/packages/payment-service/dist ./packages/payment-service/dist

# Generate Prisma client in production stage (ensure it's available)
WORKDIR /app/packages/payment-service
RUN pnpm exec prisma generate
WORKDIR /app

# Expose port
EXPOSE 3003

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD curl -f http://localhost:3003/health || exit 1

# Start the application with database migration
CMD ["sh", "-c", "cd packages/payment-service && pnpm exec prisma migrate deploy && node dist/index.js"] 