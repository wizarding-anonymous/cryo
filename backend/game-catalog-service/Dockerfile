# Stage 1: Build the application
FROM node:20-alpine AS builder

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Set Node.js options for crypto support
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Create app directory and set permissions
WORKDIR /usr/src/app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm install --legacy-peer-deps && npm cache clean --force

# Copy source code
COPY . .

# Change ownership to non-root user and build
RUN chown -R nestjs:nodejs /usr/src/app
USER nestjs

# Build the application
RUN npm run build

# Stage 2: Production environment
FROM node:20-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Set Node.js options for crypto support
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Create app directory
WORKDIR /usr/src/app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Copy package files
COPY package*.json ./

# Install production dependencies and required dev dependencies for TypeORM CLI
RUN npm install --only=production --legacy-peer-deps && \
    npm install ts-node tsconfig-paths typescript --legacy-peer-deps && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/dist ./dist

# Copy data-source for TypeORM CLI
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/data-source.ts ./data-source.ts
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/tsconfig.json ./tsconfig.json

# Copy scripts directly from source (not from builder)
COPY --chown=nestjs:nodejs scripts ./scripts

# Make scripts executable and fix line endings (as root)
RUN chmod +x ./scripts/*.sh && \
    sed -i 's/\r$//' ./scripts/*.sh && \
    chown -R nestjs:nodejs /usr/src/app

# Switch to non-root user
USER nestjs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD node dist/src/health-check.js || exit 1

# The service will run on port 3002
EXPOSE 3002

# Use custom entrypoint for initialization
ENTRYPOINT ["dumb-init", "--", "./scripts/docker-init.sh"]

# Command to run the application
CMD ["node", "dist/src/main.js"]
