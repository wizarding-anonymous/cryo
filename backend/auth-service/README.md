# 🔐 Auth Service

Authentication and Authorization Microservice for Russian Gaming Platform

## Overview

The Auth Service handles all authentication and authorization operations for the gaming platform. It provides secure user registration, login, logout, token management, and validation services for other microservices.

## Features

- **User Registration**: Secure user account creation with password hashing
- **User Authentication**: Login/logout with JWT tokens
- **Token Management**: JWT token generation, validation, and blacklisting
- **Token Refresh**: Refresh token mechanism for extended sessions
- **Security Integration**: Integration with security service for audit logging
- **Notification Integration**: Welcome emails and security alerts
- **Rate Limiting**: Protection against brute force attacks
- **Redis Integration**: Token blacklisting and session management

## Architecture

### Production Architecture Overview
```
┌─────────────────┐    Circuit      ┌─────────────────┐
│   Auth Service  │    Breaker      │  User Service   │
│                 │◄──────────────►│                 │
│ • Registration  │   HTTP APIs     │ • User CRUD     │
│ • Login/Logout  │   (Critical)    │ • Profile Mgmt  │
│ • Token Mgmt    │                 │                 │
│ • Sessions      │                 │                 │
│                 │                 │                 │
│ ┌─────────────┐ │                 │                 │
│ │   Auth DB   │ │                 │                 │
│ │ • Sessions  │ │                 │                 │
│ │ • Tokens    │ │                 │                 │
│ │ • Attempts  │ │                 │                 │
│ └─────────────┘ │                 │                 │
└─────────────────┘                 └─────────────────┘
         │                                   
         │ Event Bus (Async)                 
         ▼                                   
┌─────────────────┐                 
│  Event Bus      │                 
│ • Redis/Bull    │                 
│ • Event Queues  │                 
└─────────────────┘                 
    │           │
    ▼           ▼
┌─────────────────┐  ┌─────────────────┐
│ Security Service│  │Notification Svc │
│ • Event Logging │  │ • Welcome Emails│
│ • Audit Trail   │  │ • Security Alert│
└─────────────────┘  └─────────────────┘
```

### Service Communication
- **User Service**: User data management with Circuit Breaker protection
- **Security Service**: Async security event logging via event bus
- **Notification Service**: Async email notifications via event bus
- **PostgreSQL**: Local Auth Service database for sessions and tokens
- **Redis/Bull**: Event bus for async processing and caching

### Key Components
- **AuthController**: REST API endpoints for authentication
- **AuthService**: Core authentication business logic with resilience
- **SessionService**: Local session management and tracking
- **TokenService**: JWT token management with local database
- **JwtStrategy**: Passport JWT validation with local session checks
- **Circuit Breaker Clients**: Resilient communication with external services
- **Event Bus**: Async event publishing and processing
- **Event Processors**: Handle security, notification, and user events

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout (blacklist token)
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/validate` - Validate JWT token (for other services)

### Service Information
- `GET /api` - Service health and information

## Environment Variables

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Database Configuration (Auth Service DB)
DATABASE_URL=postgresql://username:password@localhost:5432/auth_db
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=auth_db
DATABASE_USERNAME=auth_user
DATABASE_PASSWORD=secure_password

# Redis Configuration (Event Bus + Cache)
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_password

# Circuit Breaker Configuration
CIRCUIT_BREAKER_TIMEOUT=3000
CIRCUIT_BREAKER_ERROR_THRESHOLD=50
CIRCUIT_BREAKER_RESET_TIMEOUT=30000

# Service URLs
USER_SERVICE_URL=http://localhost:3002
SECURITY_SERVICE_URL=http://localhost:3004
NOTIFICATION_SERVICE_URL=http://localhost:3005

# Event Bus Configuration
EVENT_BUS_RETRY_ATTEMPTS=3
EVENT_BUS_RETRY_DELAY=1000
SECURITY_EVENTS_QUEUE=security-events
NOTIFICATION_EVENTS_QUEUE=notification-events
USER_EVENTS_QUEUE=user-events

# Session Configuration
SESSION_CLEANUP_INTERVAL=3600000  # 1 hour in ms
SESSION_MAX_AGE=86400000          # 24 hours in ms
MAX_SESSIONS_PER_USER=5
```

## Installation

### Prerequisites

Auth Service is part of the backend microservices architecture. Ensure you have:
- Docker and Docker Compose installed
- Node.js 18+ (for local development)
- Access to the backend directory structure

### Local Development

```bash
# Navigate to Auth Service directory
cd backend/auth-service

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start database services from backend directory
cd ../
docker-compose up -d postgres-auth redis

# Return to Auth Service and initialize database
cd auth-service
npm run db:init

# Start development server
npm run start:dev
```

### Quick Start with Make

```bash
# Setup development environment
make dev-setup

# Start development server
make start-dev

# Or use Docker from backend directory
cd ../
make -C auth-service docker-up
```

### Docker Development

```bash
# From the backend directory, start Auth Service with dependencies
cd backend
docker-compose up -d postgres-auth redis auth-service

# Or start all services
docker-compose up -d

# Development mode with hot reload
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d auth-service

# Build only Auth Service
docker-compose build auth-service
```

## Development

```bash
# Start in watch mode
npm run start:dev

# Run tests
npm run test

# Run e2e tests
npm run test:e2e

# Lint code
npm run lint

# Format code
npm run format
```

## Security Features

### Password Security
- Bcrypt hashing with salt rounds
- Strong password requirements
- Password validation on registration

### Token Security
- JWT with configurable expiration
- Local token blacklisting with database storage
- Refresh token mechanism with rotation
- Token validation with local session checks
- Automatic token cleanup and maintenance

### Session Management
- Local session storage with metadata
- IP address and user agent tracking
- Concurrent session limiting per user
- Automatic session cleanup and expiration
- Session invalidation for security events

### Rate Limiting
- Registration endpoint protection
- Login attempt limiting with database tracking
- Configurable throttling rules
- Failed attempt monitoring and alerting

### Resilience and Reliability
- Circuit Breaker pattern for external service calls
- Graceful degradation when services are unavailable
- Event-driven architecture for non-critical operations
- Automatic retry with exponential backoff
- Comprehensive health checks and monitoring

### Audit Logging
- Async security event logging via event bus
- Failed login attempts tracking in local database
- Account creation and session tracking
- Security event processing with retry logic

## API Documentation

Swagger documentation is available at:
- Development: http://localhost:3001/api/docs
- Production: https://your-domain.com/api/docs

## Monitoring

The service includes:
- Health check endpoints
- Prometheus metrics (if configured)
- Structured logging
- Error tracking

## Dependencies

### Core Dependencies
- **NestJS**: Framework for building scalable applications
- **Passport**: Authentication middleware
- **JWT**: JSON Web Token implementation
- **Bcrypt**: Password hashing library
- **Redis**: In-memory data store for token blacklisting
- **Axios**: HTTP client for service communication

### Development Dependencies
- **Jest**: Testing framework
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **TypeScript**: Type-safe JavaScript

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Deployment

### Local Production Build

```bash
# Build for production
npm run build

# Start production server
npm run start:prod
```

### Docker Deployment

```bash
# From the backend directory
cd backend

# Production deployment
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d auth-service

# Scale the service (production)
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale auth-service=3

# View logs
docker-compose logs -f auth-service

# Health check
curl http://localhost:3001/api/health
```

### Environment Configuration

The service uses different environment files:
- `.env.example` - Template for local development
- `.env.docker` - Docker container configuration
- `.env` - Local development (copy from .env.example)

### Docker Network

Auth Service runs on Docker network `microservices-network` and communicates with:
- **Database**: `postgres-auth:5432` (PostgreSQL)
- **Cache/Events**: `redis:6379` (Redis)
- **User Service**: `user-service:3002`
- **Security Service**: `security-service:3010`
- **Notification Service**: `notification-service:3007`

## Contributing

1. Follow the existing code style
2. Write tests for new features
3. Update documentation
4. Follow security best practices

## License

Private - Gaming Platform Team