# Makefile for managing all microservices
# Works on both Unix-like systems and Windows (with make installed)

.PHONY: help build up down logs clean test lint format install dev prod restart status health setup

# Detect OS
ifeq ($(OS),Windows_NT)
    DETECTED_OS := Windows
    SHELL_EXT := .bat
    PS_EXT := .ps1
else
    DETECTED_OS := Unix
    SHELL_EXT := .sh
    PS_EXT := 
endif

# Default target
help:
	@echo "Available commands:"
	@echo "  setup      - Run setup script for development environment"
	@echo "  build      - Build all services"
	@echo "  up         - Start all services"
	@echo "  down       - Stop all services"
	@echo "  dev        - Start development environment"
	@echo "  prod       - Start production environment"
	@echo "  logs       - Show logs for all services"
	@echo "  clean      - Clean up containers, volumes, and images"
	@echo "  test       - Run tests for all services"
	@echo "  lint       - Run linting for all services"
	@echo "  format     - Format code for all services"
	@echo "  install    - Install dependencies for all services"
	@echo "  restart    - Restart all services"
	@echo "  status     - Show status of all services"
	@echo "  health     - Check health of all services"
	@echo ""
	@echo "Detected OS: $(DETECTED_OS)"

# Setup development environment
setup:
ifeq ($(DETECTED_OS),Windows)
	@powershell -ExecutionPolicy Bypass -File scripts/setup.ps1
else
	@chmod +x scripts/setup.sh && ./scripts/setup.sh
endif

# Build all services
build:
	@echo "Building all services..."
	docker-compose build

# Start all services
up:
	@echo "Starting all services..."
	docker-compose up -d

# Stop all services
down:
	@echo "Stopping all services..."
	docker-compose down

# Start development environment
dev:
	@echo "Starting development environment..."
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Start production environment
prod:
	@echo "Starting production environment..."
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Show logs
logs:
	@echo "Showing logs for all services..."
	docker-compose logs -f

# Show logs for specific service
logs-%:
	@echo "Showing logs for $*..."
	docker-compose logs -f $*

# Clean up
clean:
	@echo "Cleaning up containers, volumes, and images..."
	docker-compose down -v --remove-orphans
	docker system prune -f
	docker volume prune -f

# Run tests for all Node.js services
test:
	@echo "Running tests for all services..."
	@for service in user-service game-catalog-service library-service review-service payment-service notification-service social-service achievement-service security-service api-gateway; do \
		echo "Testing $$service..."; \
		cd $$service && npm test && cd ..; \
	done
	@echo "Testing download-service..."
	@cd download-service && go test ./... && cd ..

# Run linting for all services
lint:
	@echo "Running linting for all services..."
	@for service in user-service game-catalog-service library-service review-service payment-service notification-service social-service achievement-service security-service api-gateway; do \
		echo "Linting $$service..."; \
		cd $$service && npm run lint && cd ..; \
	done
	@echo "Linting download-service..."
	@cd download-service && golangci-lint run && cd ..

# Format code for all services
format:
	@echo "Formatting code for all services..."
	@for service in user-service game-catalog-service library-service review-service payment-service notification-service social-service achievement-service security-service api-gateway; do \
		echo "Formatting $$service..."; \
		cd $$service && npm run format && cd ..; \
	done
	@echo "Formatting download-service..."
	@cd download-service && go fmt ./... && cd ..

# Install dependencies for all services
install:
	@echo "Installing dependencies for all services..."
	@for service in user-service game-catalog-service library-service review-service payment-service notification-service social-service achievement-service security-service api-gateway; do \
		echo "Installing dependencies for $$service..."; \
		cd $$service && npm install && cd ..; \
	done
	@echo "Installing dependencies for download-service..."
	@cd download-service && go mod download && cd ..

# Restart all services
restart:
	@echo "Restarting all services..."
	docker-compose restart

# Restart specific service
restart-%:
	@echo "Restarting $*..."
	docker-compose restart $*

# Show status of all services
status:
	@echo "Status of all services:"
	docker-compose ps

# Health check for all services
health:
ifeq ($(DETECTED_OS),Windows)
	@powershell -ExecutionPolicy Bypass -File scripts/health-check.ps1
else
	@chmod +x scripts/health-check.sh && ./scripts/health-check.sh
endif

# Database operations
db-migrate:
	@echo "Running database migrations for all services..."
	@for service in user-service game-catalog-service library-service review-service payment-service notification-service social-service achievement-service security-service; do \
		echo "Migrating $$service database..."; \
		docker-compose exec $$service npm run migration:run; \
	done

db-seed:
	@echo "Seeding databases for all services..."
	@for service in user-service game-catalog-service library-service review-service payment-service notification-service social-service achievement-service security-service; do \
		echo "Seeding $$service database..."; \
		docker-compose exec $$service npm run seed; \
	done

# Monitoring
monitor:
	@echo "Opening monitoring dashboards..."
	@echo "Prometheus: http://localhost:9090"
	@echo "Grafana: http://localhost:3100 (admin/admin)"
	@echo "Kibana: http://localhost:5601"

# Backup databases
backup:
	@echo "Creating database backups..."
	@mkdir -p backups
	@for db in user catalog library review payment notification social achievement security download; do \
		echo "Backing up $$db database..."; \
		docker-compose exec postgres-$$db pg_dump -U $${db}_service $${db}_db > backups/$${db}_backup_$$(date +%Y%m%d_%H%M%S).sql; \
	done

# Scale services
scale-%:
	@echo "Scaling $* service..."
	docker-compose up -d --scale $*=$(REPLICAS)

# Update all services
update:
	@echo "Updating all services..."
	git pull
	docker-compose pull
	docker-compose build --no-cache
	docker-compose up -d