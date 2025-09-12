# Stage 1: Build the application
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy application source
COPY . .

# Build the application
RUN npm run build

# Stage 2: Production environment
FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json for production dependencies
COPY --from=builder /usr/src/app/package*.json ./
RUN npm install --only=production --legacy-peer-deps

# Copy the built application from the builder stage
COPY --from=builder /usr/src/app/dist ./dist

# The service will run on port 3002
EXPOSE 3002

# Command to run the application
# Note: The entrypoint in dist is dist/main.js, not dist/src/main.js
CMD ["node", "dist/main.js"]
