# Multi-stage Production-Optimized Dockerfile for Notification Service

# Development stage
FROM node:20-alpine AS development

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies)
RUN npm ci

# Copy source code
COPY . .

# Expose port
EXPOSE 3006

# Start in development mode
CMD ["npm", "run", "start:dev"]

# Build stage
FROM node:20-alpine AS build

WORKDIR /usr/src/app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy package files
COPY package*.json ./

# Install all dependencies with optimizations
RUN npm ci --no-audit --no-fund

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove dev dependencies and clean cache
RUN npm prune --production && npm cache clean --force

# Production stage - Optimized for size and security
FROM node:20-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

WORKDIR /usr/src/app

# Create non-root user first
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs

# Copy package files
COPY package*.json ./

# Install only production dependencies with optimizations
RUN npm ci --only=production --no-audit --no-fund && \
    npm cache clean --force

# Copy built application from build stage
COPY --from=build /usr/src/app/dist ./dist

# Copy health check script
COPY health-check.js ./

# Change ownership of the app directory
RUN chown -R nestjs:nodejs /usr/src/app

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3006

# Health check with improved reliability
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node health-check.js

# Use dumb-init for proper signal handling and graceful shutdown
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/main"]
