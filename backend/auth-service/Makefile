# Auth Service Makefile
# This Makefile provides convenient commands for Auth Service development and deployment

.PHONY: help install build start start-dev stop test test-e2e lint format clean db-init db-status db-reset docker-build docker-up docker-down docker-logs

# Default target
help:
	@echo "Auth Service - Available commands:"
	@echo ""
	@echo "Development:"
	@echo "  install     - Install dependencies"
	@echo "  build       - Build the application"
	@echo "  start       - Start the application"
	@echo "  start-dev   - Start in development mode"
	@echo "  test        - Run unit tests"
	@echo "  test-e2e    - Run end-to-end tests"
	@echo "  lint        - Run linter"
	@echo "  format      - Format code"
	@echo ""
	@echo "Database:"
	@echo "  db-init     - Initialize database and run migrations"
	@echo "  db-status   - Show database status"
	@echo "  db-reset    - Reset database (development only)"
	@echo ""
	@echo "Docker (from backend directory):"
	@echo "  docker-build - Build Docker image"
	@echo "  docker-up    - Start services with Docker"
	@echo "  docker-down  - Stop Docker services"
	@echo "  docker-logs  - Show Auth Service logs"
	@echo ""
	@echo "Utilities:"
	@echo "  clean       - Clean build artifacts"

# Development commands
install:
	npm ci

build:
	npm run build

start:
	npm run start

start-dev:
	npm run start:dev

test:
	npm run test

test-e2e:
	npm run test:e2e

lint:
	npm run lint

format:
	npm run format

clean:
	rm -rf dist node_modules coverage

# Database commands
db-init:
	npm run db:init

db-status:
	npm run db:status

db-reset:
	npm run db:reset

# Docker commands (must be run from backend directory)
docker-build:
	@if [ ! -f ../docker-compose.yml ]; then \
		echo "Error: Must be run from backend directory"; \
		echo "Usage: cd ../backend && make -C auth-service docker-build"; \
		exit 1; \
	fi
	cd .. && docker-compose build auth-service

docker-up:
	@if [ ! -f ../docker-compose.yml ]; then \
		echo "Error: Must be run from backend directory"; \
		echo "Usage: cd ../backend && make -C auth-service docker-up"; \
		exit 1; \
	fi
	cd .. && docker-compose up -d postgres-auth redis auth-service

docker-down:
	@if [ ! -f ../docker-compose.yml ]; then \
		echo "Error: Must be run from backend directory"; \
		echo "Usage: cd ../backend && make -C auth-service docker-down"; \
		exit 1; \
	fi
	cd .. && docker-compose down

docker-logs:
	@if [ ! -f ../docker-compose.yml ]; then \
		echo "Error: Must be run from backend directory"; \
		echo "Usage: cd ../backend && make -C auth-service docker-logs"; \
		exit 1; \
	fi
	cd .. && docker-compose logs -f auth-service

# Development workflow
dev-setup: install db-init
	@echo "Auth Service development setup complete!"
	@echo "Run 'make start-dev' to start development server"

# Quick setup commands
setup-dev:
	@echo "Running development setup script..."
	@bash scripts/setup.sh development

setup-docker:
	@echo "Running Docker setup script..."
	@bash scripts/setup.sh docker

setup-prod:
	@echo "Running production setup script..."
	@bash scripts/setup.sh production

# Production deployment
deploy: build docker-build
	@echo "Auth Service built and ready for deployment"

# Health check
health:
	@echo "Checking Auth Service health..."
	@curl -f http://localhost:3001/api/health || echo "Service not running"

# Database health
db-health:
	@echo "Checking database health..."
	@curl -f http://localhost:3001/api/health/database || echo "Database not accessible"