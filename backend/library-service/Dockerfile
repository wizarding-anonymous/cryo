# Multi-stage build for NestJS Library Service
# Stage 1: Base image with common dependencies
FROM node:20-alpine AS base

# Install dumb-init for proper signal handling and curl for health checks
RUN apk add --no-cache dumb-init curl

# Create app directory
WORKDIR /usr/src/app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Copy package files
COPY package*.json ./

# Stage 2: Development environment
FROM base AS development

# Install all dependencies (including dev dependencies)
RUN npm ci --legacy-peer-deps && npm cache clean --force

# Copy source code
COPY . .

# Change ownership to non-root user
RUN chown -R nestjs:nodejs /usr/src/app
USER nestjs

# Expose port
EXPOSE 3000

# Start development server with hot reload
CMD ["npm", "run", "start:dev"]

# Stage 3: Build stage
FROM base AS builder

# Install all dependencies (including dev dependencies for build)
RUN npm ci --legacy-peer-deps && npm cache clean --force

# Copy source code
COPY . .

# Change ownership to non-root user
RUN chown -R nestjs:nodejs /usr/src/app
USER nestjs

# Build the application
RUN npm run build

# Stage 4: Production environment
FROM node:20-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /usr/src/app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production --legacy-peer-deps && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/dist ./dist

# Change ownership to non-root user
RUN chown -R nestjs:nodejs /usr/src/app
USER nestjs

# Health check using internal health endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Expose port
EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/src/main.js"]
