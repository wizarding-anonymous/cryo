SHELL := /bin/sh

.PHONY: test cover cover-html bench test-integration test-unit test-concurrent test-all

# Run all unit tests
test:
	go test ./...

# Run unit tests only (exclude integration tests)
test-unit:
	go test -short ./...

# Run integration tests (requires database)
test-integration:
	go test -tags=integration ./...

# Run concurrent/benchmark tests
test-concurrent:
	go test -run="Concurrent|Benchmark" ./...

# Run all tests including integration
test-all: test-unit test-integration

# Generate coverage report
cover:
	go test ./... -coverprofile=coverage.out -covermode=atomic
	go tool cover -func coverage.out
	@echo "Total coverage:"
	@go tool cover -func coverage.out | grep total | awk '{print $$3}'

# Generate HTML coverage report
cover-html: cover
	go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report generated: coverage.html"

# Run benchmark tests
bench:
	go test -bench=. -benchmem ./internal/services -run=^$$
	go test -bench=. -benchmem ./internal/handlers -run=^$$

# Run benchmark tests with CPU profiling
bench-cpu:
	go test -bench=. -benchmem -cpuprofile=cpu.prof ./internal/services -run=^$$

# Run benchmark tests with memory profiling  
bench-mem:
	go test -bench=. -benchmem -memprofile=mem.prof ./internal/services -run=^$$

# Clean up generated files
clean:
	rm -f coverage.out coverage.html cpu.prof mem.prof

# Run tests with race detection
test-race:
	go test -race ./...

# Run tests with verbose output
test-verbose:
	go test -v ./...

# Load testing targets
load-test:
	@echo "Running comprehensive load tests..."
	@if [ -f "./scripts/run-load-tests.sh" ]; then \
		./scripts/run-load-tests.sh all; \
	else \
		echo "Load test script not found. Running basic benchmarks..."; \
		$(MAKE) bench; \
	fi

load-test-api:
	@echo "Running API load tests..."
	@if [ -f "./scripts/run-load-tests.sh" ]; then \
		./scripts/run-load-tests.sh api; \
	else \
		echo "Load test script not found."; \
	fi

load-test-file-ops:
	@echo "Running file operations load tests..."
	@if [ -f "./scripts/run-load-tests.sh" ]; then \
		./scripts/run-load-tests.sh file-ops; \
	else \
		echo "Load test script not found."; \
	fi

stress-test:
	@echo "Running stress tests..."
	@if [ -f "./scripts/run-load-tests.sh" ]; then \
		./scripts/run-load-tests.sh stress; \
	else \
		echo "Stress test script not found."; \
	fi

profile:
	@echo "Running profiling tests..."
	@if [ -f "./scripts/run-load-tests.sh" ]; then \
		./scripts/run-load-tests.sh profile; \
	else \
		$(MAKE) bench-cpu; \
		$(MAKE) bench-mem; \
	fi

# Production targets
prod-check:
	@echo "Running production readiness checks..."
	@echo "1. Test coverage..."
	@$(MAKE) cover
	@echo "2. Load testing..."
	@$(MAKE) load-test
	@echo "3. Security scan (if available)..."
	@go list -json -m all | nancy sleuth || echo "Nancy not installed, skipping security scan"
	@echo "4. Vulnerability check (if available)..."
	@govulncheck ./... || echo "govulncheck not installed, skipping vulnerability check"

docker-build:
	docker build -t download-service:latest .

docker-push: docker-build
	@echo "Tagging and pushing Docker image..."
	@read -p "Enter registry URL (e.g., your-registry.com): " registry; \
	docker tag download-service:latest $$registry/download-service:latest; \
	docker push $$registry/download-service:latest

k8s-deploy:
	kubectl apply -f deploy/k8s/

k8s-remove:
	kubectl delete -f deploy/k8s/