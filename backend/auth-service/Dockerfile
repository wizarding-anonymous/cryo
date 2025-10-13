# =============================================================================
# Multi-stage Dockerfile for Auth Service
# Optimized for security, performance, and container orchestration
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies (Base layer for caching)
# -----------------------------------------------------------------------------
FROM node:18-alpine AS dependencies

# Install security updates and required packages
RUN apk update && apk upgrade && \
    apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./

# Install all dependencies with npm ci for reproducible builds
RUN npm ci --include=dev && \
    npm cache clean --force

# -----------------------------------------------------------------------------
# Stage 2: Builder (Build the application)
# -----------------------------------------------------------------------------
FROM dependencies AS builder

# Copy source code
COPY . .

# Build the application
RUN npm run build && \
    npm prune --production

# -----------------------------------------------------------------------------
# Stage 3: Production (Final optimized image)
# -----------------------------------------------------------------------------
FROM node:18-alpine AS production

# Install security updates and minimal runtime dependencies
RUN apk update && apk upgrade && \
    apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Create application directory
WORKDIR /app

# Create non-root user with specific UID/GID for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs

# Copy production dependencies from builder
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules

# Copy built application
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

# Copy package.json for runtime metadata
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./

# Copy health check script
COPY --from=builder --chown=nestjs:nodejs /app/health-check.js ./

# Copy database migration files if they exist
COPY --from=builder --chown=nestjs:nodejs /app/typeorm.config.ts ./
COPY --from=builder --chown=nestjs:nodejs /app/src/migrations ./src/migrations

# Set proper permissions
RUN chown -R nestjs:nodejs /app

# Switch to non-root user for security
USER nestjs

# Expose application port
EXPOSE 3001

# Set environment variables for production
ENV NODE_ENV=production
ENV PORT=3001

# Configure health check for container orchestration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node health-check.js --endpoint /api/health/ready || exit 1

# Use dumb-init to handle signals properly in containers
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/main.js"]

# =============================================================================
# Security and Optimization Features:
# 
# 1. Multi-stage build reduces final image size
# 2. Non-root user (nestjs:nodejs) for security
# 3. Minimal Alpine Linux base image
# 4. Security updates installed
# 5. dumb-init for proper signal handling
# 6. Optimized health check configuration
# 7. Production-only dependencies in final stage
# 8. Proper file permissions and ownership
# 9. Environment variables for configuration
# 10. Database migration support
# =============================================================================