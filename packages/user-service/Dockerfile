# User Service Dockerfile - Monorepo Multi-stage Build
FROM node:18-alpine AS base

# Install curl for health checks and OpenSSL for Prisma
RUN apk add --no-cache curl openssl openssl-dev

# Set working directory
WORKDIR /app

# Copy root package files and workspace config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./

# Copy shared packages
COPY shared/ ./shared/

# Copy user-service specific files
COPY packages/user-service/ ./packages/user-service/

# Install pnpm
RUN npm install -g pnpm

# Install all dependencies (monorepo)
RUN pnpm install --frozen-lockfile

# Build shared packages first
RUN pnpm --filter "@elearning/common-types" build || echo "No build script for common-types"
RUN pnpm --filter "@elearning/auth-utils" build || echo "No build script for auth-utils"
RUN pnpm --filter "@elearning/logger" build || echo "No build script for logger"
RUN pnpm --filter "@elearning/config-utils" build || echo "No build script for config-utils"

# Generate Prisma client and build user-service
WORKDIR /app/packages/user-service
RUN pnpm prisma generate
WORKDIR /app
RUN pnpm --filter "@elearning/user-service" build

# Production stage
FROM node:18-alpine AS production

# Install curl for health checks and OpenSSL for Prisma
RUN apk add --no-cache curl openssl openssl-dev

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files and install production dependencies
COPY --from=base /app/packages/user-service/package.json ./package.json
COPY --from=base /app/packages/user-service/prisma ./prisma
COPY --from=base /app/pnpm-lock.yaml ./pnpm-lock.yaml

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built application
COPY --from=base /app/packages/user-service/dist ./dist

# Generate Prisma client in production stage (ensure it's available)
RUN pnpm exec prisma generate --schema=./prisma/schema.prisma

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Start the application with database migration
CMD ["sh", "-c", "pnpm exec prisma migrate deploy --schema=./prisma/schema.prisma && node dist/index.js"] 