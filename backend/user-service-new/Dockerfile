# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install all dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Create the production image
FROM node:20-alpine

WORKDIR /app

# Install nest CLI globally for development
RUN npm install -g @nestjs/cli

# Copy package files and install all dependencies (including dev for development)
COPY package.json package-lock.json* ./
RUN npm install

# Copy the built application from the builder stage
COPY --from=builder /app/dist ./dist

# Copy source code for development
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application in development mode
CMD ["npm", "run", "start:dev"]
