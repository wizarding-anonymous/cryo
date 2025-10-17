# Stage 1: Build the application
FROM node:20-alpine AS builder

# Install security updates and build dependencies
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init && \
    rm -rf /var/cache/apk/*

# Create non-root user for build stage
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Set working directory
WORKDIR /usr/src/app

# Copy package files with proper ownership
COPY --chown=nestjs:nodejs package*.json ./

# Create node_modules directory with proper ownership
RUN mkdir -p node_modules && chown -R nestjs:nodejs node_modules

# Install dependencies as non-root user
USER nestjs
RUN npm ci --legacy-peer-deps && npm cache clean --force

# Copy application source with proper ownership
COPY --chown=nestjs:nodejs . .

# Build the application (dist directory will be created automatically)
RUN npm run build

# Stage 2: Production environment with security hardening
FROM node:20-alpine AS production

# Install security updates and runtime dependencies
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init curl && \
    rm -rf /var/cache/apk/*

# Create non-root user for production
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Set working directory
WORKDIR /usr/src/app

# Copy package files with proper ownership
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/package*.json ./

# Install only production dependencies
RUN npm ci --only=production --legacy-peer-deps && \
    npm cache clean --force && \
    rm -rf /tmp/* /var/tmp/*

# Copy the built application from the builder stage
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/dist ./dist

# Create uploads directory with proper permissions
RUN mkdir -p uploads/avatars && \
    chown -R nestjs:nodejs uploads

# Switch to non-root user
USER nestjs

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3002/api/health/live || exit 1

# Expose the port the app runs on
EXPOSE 3002

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Command to run the application
CMD ["node", "dist/src/main.js"]
