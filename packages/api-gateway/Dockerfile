# API Gateway Dockerfile - Monorepo Multi-stage Build
FROM node:18-alpine AS base

# Install curl for health checks and OpenSSL for Prisma
RUN apk add --no-cache curl openssl openssl-dev

# Set working directory
WORKDIR /app

# Copy root package files and workspace config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./

# Copy shared packages
COPY shared/ ./shared/

# Copy api-gateway specific files
COPY packages/api-gateway/ ./packages/api-gateway/

# Install pnpm
RUN npm install -g pnpm

# Install all dependencies (monorepo)
RUN pnpm install --frozen-lockfile

# Build shared packages first
RUN pnpm --filter "@elearning/common-types" build || echo "No build script for common-types"
RUN pnpm --filter "@elearning/auth-utils" build || echo "No build script for auth-utils"
RUN pnpm --filter "@elearning/logger" build || echo "No build script for logger"
RUN pnpm --filter "@elearning/config-utils" build || echo "No build script for config-utils"

# Build api-gateway
RUN pnpm --filter "@elearning/api-gateway" build

# Production stage
FROM node:18-alpine AS production

# Install curl for health checks and OpenSSL for Prisma
RUN apk add --no-cache curl openssl openssl-dev

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy built application and dependencies
COPY --from=base /app/packages/api-gateway/dist ./dist
COPY --from=base /app/packages/api-gateway/package.json ./package.json
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/packages/api-gateway/node_modules ./packages/api-gateway/node_modules

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "dist/index.js"] 