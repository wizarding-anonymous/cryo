# Review Service

Review Service is a critical microservice for the MVP Russian gaming platform that enables users to create and view game reviews with comprehensive rating functionality.

## Features

- User review creation and management
- Game rating system with caching
- Integration with other MVP services (Library, Achievement, Notification, Game Catalog)
- JWT authentication and authorization
- PostgreSQL database with TypeORM
- Redis caching for performance
- Docker support for development and production

## Technology Stack

- **Framework**: NestJS + TypeScript
- **Database**: PostgreSQL
- **Cache**: Redis
- **ORM**: TypeORM
- **Authentication**: JWT
- **Testing**: Jest
- **Containerization**: Docker

## Project Setup

### Prerequisites

- Node.js 20+
- Docker and Docker Compose
- PostgreSQL (if running locally)
- Redis (if running locally)

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
```

### Running with Docker (Recommended)

```bash
# Start all services (PostgreSQL, Redis, Review Service)
docker-compose up -d

# View logs
docker-compose logs -f review-service

# Stop services
docker-compose down
```

### Running Locally

```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

## API Endpoints

### Reviews
- `POST /reviews` - Create review (requires authentication)
- `GET /reviews/game/:gameId` - Get game reviews with pagination
- `PUT /reviews/:id` - Update review (requires authentication)
- `DELETE /reviews/:id` - Delete review (requires authentication)

### Ratings
- `GET /ratings/game/:gameId` - Get game rating (cached)

### Health
- `GET /health` - Health check endpoint

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Environment Variables

See `.env.example` for all available configuration options.

Key variables:
- `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`, `DATABASE_NAME` - PostgreSQL configuration
- `REDIS_HOST`, `REDIS_PORT` - Redis configuration
- `JWT_SECRET` - JWT secret for authentication
- External service URLs for integration

## Docker

### Development
```bash
docker-compose up
```

### Production
```bash
docker-compose -f docker-compose.prod.yml up
```

## Architecture

The service follows NestJS modular architecture with:
- Controllers for HTTP endpoints
- Services for business logic
- Entities for database models
- DTOs for data validation
- Guards for authentication
- Interceptors for caching

## Integration

This service integrates with:
- **Library Service**: Game ownership verification
- **Achievement Service**: First review achievements
- **Notification Service**: New review notifications
- **Game Catalog Service**: Rating synchronization