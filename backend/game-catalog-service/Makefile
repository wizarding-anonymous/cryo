# Makefile for Game Catalog Service Docker operations

.PHONY: help build up down logs clean test prod-up prod-down

# Default target
help:
	@echo "Available commands:"
	@echo "  build      - Build Docker images"
	@echo "  up         - Start development environment"
	@echo "  down       - Stop development environment"
	@echo "  logs       - View application logs"
	@echo "  clean      - Clean up Docker resources"
	@echo "  test       - Run tests in Docker"
	@echo "  prod-up    - Start production environment"
	@echo "  prod-down  - Stop production environment"

# Development commands
build:
	docker-compose build

up:
	docker-compose up -d
	@echo "Services started. Application available at http://localhost:3002"
	@echo "API documentation at http://localhost:3002/api-docs"

down:
	docker-compose down

logs:
	docker-compose logs -f game-catalog-service

# Production commands
prod-up:
	docker-compose -f docker-compose.prod.yml up -d
	@echo "Production services started"

prod-down:
	docker-compose -f docker-compose.prod.yml down

# Utility commands
clean:
	docker-compose down -v
	docker system prune -f
	docker volume prune -f

test:
	docker-compose exec game-catalog-service npm run test

# Database operations
db-migrate:
	docker-compose exec game-catalog-service npm run migration:run

db-shell:
	docker-compose exec postgres psql -U postgres -d game_catalog_db

# Redis operations
redis-shell:
	docker-compose exec redis redis-cli

# Health checks
health:
	@echo "Checking service health..."
	@curl -f http://localhost:3002/api/health || echo "Service not healthy"

# Complete setup for new environment
setup: build up db-migrate
	@echo "Environment setup complete!"