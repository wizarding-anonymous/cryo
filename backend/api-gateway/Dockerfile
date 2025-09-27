# Stage 1: Dependencies
FROM node:20-alpine AS dependencies

WORKDIR /usr/src/app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci --legacy-peer-deps

# Stage 2: Build the application
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy dependencies from previous stage
COPY --from=dependencies /usr/src/app/node_modules ./node_modules
COPY --from=dependencies /usr/src/app/package*.json ./

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 3: Production dependencies
FROM node:20-alpine AS production-deps

WORKDIR /usr/src/app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force

# Stage 4: Production image
FROM node:20-alpine AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

WORKDIR /usr/src/app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy production dependencies
COPY --from=production-deps --chown=nestjs:nodejs /usr/src/app/node_modules ./node_modules

# Copy built application
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/package*.json ./

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV NODE_OPTIONS="--max-old-space-size=512"

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]

