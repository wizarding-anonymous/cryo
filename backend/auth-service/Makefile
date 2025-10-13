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
	@echo "Configuration Management:"
	@echo "  config-validate      - Validate current environment config"
	@echo "  config-validate-prod - Validate production config"
	@echo "  config-validate-staging - Validate staging config"
	@echo "  config-validate-dev  - Validate development config"
	@echo ""
	@echo "Secret Generation:"
	@echo "  secrets-generate     - Generate secrets for production"
	@echo "  secrets-generate-prod - Generate production secrets"
	@echo "  secrets-generate-staging - Generate staging secrets"
	@echo "  secrets-generate-dev - Generate development secrets"
	@echo "  secrets-generate-docker - Generate Docker Compose secrets"
	@echo "  secrets-generate-k8s - Generate Kubernetes secrets"
	@echo "  secrets-generate-all - Generate all secret formats"
	@echo ""
	@echo "Environment Setup:"
	@echo "  env-setup-dev    - Setup development environment"
	@echo "  env-setup-docker - Setup Docker environment"
	@echo "  env-setup-prod   - Setup production environment"
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
	@echo "Health & Validation:"
	@echo "  health      - Check service health"
	@echo "  db-health   - Check database health"
	@echo "  validate-all - Run complete environment validation"
	@echo ""
	@echo "Security:"
	@echo "  security-scan    - Run security vulnerability scan"
	@echo "  security-audit   - Run npm audit"
	@echo "  security-docker  - Run Docker security scan"
	@echo ""
	@echo "Kubernetes:"
	@echo "  k8s-deploy   - Deploy to Kubernetes"
	@echo "  k8s-delete   - Delete from Kubernetes"
	@echo "  k8s-status   - Check Kubernetes status"
	@echo ""
	@echo "Utilities:"
	@echo "  clean        - Clean build artifacts"
	@echo "  health-check - Run comprehensive health checks"

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

# Configuration Management
config-validate:
	npm run config:validate

config-validate-prod:
	npm run config:validate:prod

config-validate-staging:
	npm run config:validate:staging

config-validate-dev:
	npm run config:validate:dev

# Secret Generation
secrets-generate:
	npm run secrets:generate

secrets-generate-prod:
	npm run secrets:generate:prod

secrets-generate-staging:
	npm run secrets:generate:staging

secrets-generate-dev:
	npm run secrets:generate:dev

secrets-generate-docker:
	npm run secrets:generate:docker

secrets-generate-k8s:
	npm run secrets:generate:k8s

secrets-generate-all:
	npm run secrets:generate:all

# Environment Setup
env-setup-dev:
	@echo "Setting up development environment..."
	@cp .env.example .env.local
	@echo "✅ Created .env.local from template"
	@echo "📝 Please edit .env.local with your local settings"
	@make config-validate-dev

env-setup-docker:
	@echo "Setting up Docker environment..."
	@echo "✅ Docker environment uses .env.docker (already configured)"
	@make config-validate

env-setup-prod:
	@echo "Setting up production environment..."
	@echo "⚠️  Production setup requires manual configuration"
	@echo "1. Set environment variables for secrets"
	@echo "2. Run: make secrets-generate-prod"
	@echo "3. Run: make config-validate-prod"

# Health check
health:
	@echo "Checking Auth Service health..."
	@curl -f http://localhost:3001/api/health || echo "Service not running"

# Database health
db-health:
	@echo "Checking database health..."
	@curl -f http://localhost:3001/api/health/database || echo "Database not accessible"

# Complete environment validation
validate-all:
	@echo "🔍 Running complete environment validation..."
	@make config-validate
	@make health
	@make db-health
	@echo "✅ All validations complete"

# Security commands
security-scan:
	@echo "🔒 Running security vulnerability scan..."
	npm audit --audit-level=moderate

security-audit:
	@echo "🔒 Running npm audit..."
	npm audit --json > npm-audit-report.json || true
	@echo "Audit report saved to npm-audit-report.json"

security-docker:
	@echo "🔒 Running Docker security scan..."
	docker build -t auth-service-security-scan .
	@if command -v trivy >/dev/null 2>&1; then \
		trivy image auth-service-security-scan; \
	else \
		echo "Trivy not installed. Install with: curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin"; \
	fi

# Kubernetes commands
k8s-deploy:
	@echo "🚀 Deploying to Kubernetes..."
	kubectl apply -f k8s/configmap.yaml
	kubectl apply -f k8s/service.yaml
	kubectl apply -f k8s/deployment.yaml
	kubectl apply -f k8s/hpa.yaml

k8s-delete:
	@echo "🗑️ Deleting from Kubernetes..."
	kubectl delete -f k8s/ --ignore-not-found=true

k8s-status:
	@echo "📊 Checking Kubernetes deployment status..."
	kubectl get pods -l app=auth-service
	kubectl get services -l app=auth-service
	kubectl get deployments -l app=auth-service
	kubectl get hpa -l app=auth-service

# Enhanced health check
health-check:
	@echo "🏥 Running comprehensive health checks..."
	node health-check.js --comprehensive

# Docker production commands
docker-build-prod:
	@echo "🐳 Building production Docker image..."
	docker build -t auth-service:prod --target production .

docker-run-prod:
	@echo "🐳 Running production Docker container..."
	docker run -d \
		--name auth-service-prod \
		-p 3001:3001 \
		--env-file .env.production \
		--read-only \
		--tmpfs /tmp:noexec,nosuid,size=100m \
		--tmpfs /app/logs:noexec,nosuid,size=50m \
		--security-opt no-new-privileges:true \
		auth-service:prod

docker-stop-all:
	@echo "🐳 Stopping all Docker containers..."
	docker stop auth-service auth-service-prod 2>/dev/null || true
	docker rm auth-service auth-service-prod 2>/dev/null || true

# CI/CD pipeline simulation
ci-pipeline: install lint test build security-scan
	@echo "✅ CI pipeline completed successfully"

# Production deployment pipeline
prod-pipeline: ci-pipeline docker-build-prod security-docker
	@echo "✅ Production pipeline completed successfully"