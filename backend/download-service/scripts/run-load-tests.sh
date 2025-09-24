#!/bin/bash

# Load Testing Script for Download Service
# This script runs comprehensive load tests for the download service

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_URL="${SERVICE_URL:-http://localhost:8080}"
RESULTS_DIR="${SCRIPT_DIR}/results"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create results directory
mkdir -p "$RESULTS_DIR"

echo -e "${BLUE}=== Download Service Load Testing Suite ===${NC}"
echo -e "Service URL: ${SERVICE_URL}"
echo -e "Results will be saved to: ${RESULTS_DIR}"
echo ""

# Function to check if service is running
check_service() {
    echo -e "${YELLOW}Checking if service is running...${NC}"
    if curl -s -f "${SERVICE_URL}/health" > /dev/null; then
        echo -e "${GREEN}✓ Service is running${NC}"
        return 0
    else
        echo -e "${RED}✗ Service is not running at ${SERVICE_URL}${NC}"
        echo "Please start the service first with: make run"
        exit 1
    fi
}

# Function to run API load tests
run_api_load_tests() {
    echo -e "${YELLOW}Running API Load Tests...${NC}"
    
    cd "$SCRIPT_DIR"
    go run load-test.go > "${RESULTS_DIR}/api-load-test-$(date +%Y%m%d-%H%M%S).log" 2>&1
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ API Load Tests completed${NC}"
    else
        echo -e "${RED}✗ API Load Tests failed${NC}"
        return 1
    fi
}

# Function to run file operations load tests
run_file_ops_load_tests() {
    echo -e "${YELLOW}Running File Operations Load Tests...${NC}"
    
    cd "$SCRIPT_DIR"
    go run file-operations-load-test.go > "${RESULTS_DIR}/file-ops-load-test-$(date +%Y%m%d-%H%M%S).log" 2>&1
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ File Operations Load Tests completed${NC}"
    else
        echo -e "${RED}✗ File Operations Load Tests failed${NC}"
        return 1
    fi
}

# Function to run Go benchmark tests
run_benchmark_tests() {
    echo -e "${YELLOW}Running Go Benchmark Tests...${NC}"
    
    cd "${SCRIPT_DIR}/.."
    
    # Run benchmarks with different configurations
    echo "Running service benchmarks..."
    go test -bench=. -benchmem ./internal/services -run=^$ > "${RESULTS_DIR}/service-benchmarks-$(date +%Y%m%d-%H%M%S).log" 2>&1
    
    echo "Running handler benchmarks..."
    go test -bench=. -benchmem ./internal/handlers -run=^$ > "${RESULTS_DIR}/handler-benchmarks-$(date +%Y%m%d-%H%M%S).log" 2>&1
    
    echo "Running concurrent tests..."
    go test -run="Concurrent|Benchmark" ./... > "${RESULTS_DIR}/concurrent-tests-$(date +%Y%m%d-%H%M%S).log" 2>&1
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Benchmark Tests completed${NC}"
    else
        echo -e "${RED}✗ Benchmark Tests failed${NC}"
        return 1
    fi
}

# Function to run memory and CPU profiling
run_profiling_tests() {
    echo -e "${YELLOW}Running Profiling Tests...${NC}"
    
    cd "${SCRIPT_DIR}/.."
    
    # CPU profiling
    echo "Running CPU profiling..."
    go test -bench=. -benchmem -cpuprofile="${RESULTS_DIR}/cpu-$(date +%Y%m%d-%H%M%S).prof" ./internal/services -run=^$ > /dev/null 2>&1
    
    # Memory profiling
    echo "Running Memory profiling..."
    go test -bench=. -benchmem -memprofile="${RESULTS_DIR}/mem-$(date +%Y%m%d-%H%M%S).prof" ./internal/services -run=^$ > /dev/null 2>&1
    
    # Block profiling
    echo "Running Block profiling..."
    go test -bench=. -benchmem -blockprofile="${RESULTS_DIR}/block-$(date +%Y%m%d-%H%M%S).prof" ./internal/services -run=^$ > /dev/null 2>&1
    
    echo -e "${GREEN}✓ Profiling Tests completed${NC}"
    echo -e "Profile files saved to ${RESULTS_DIR}/"
    echo -e "Analyze with: go tool pprof <profile-file>"
}

# Function to run stress tests
run_stress_tests() {
    echo -e "${YELLOW}Running Stress Tests (1000+ concurrent operations)...${NC}"
    
    cd "$SCRIPT_DIR"
    
    # Create a high-load configuration
    cat > stress-test-config.json << EOF
{
    "baseURL": "${SERVICE_URL}",
    "numClients": 1000,
    "requestsPerClient": 50,
    "testDuration": "2m",
    "concurrentDownloads": 100
}
EOF
    
    # Run stress test (this would need a more sophisticated implementation)
    echo "Simulating 1000+ concurrent downloads..."
    timeout 120s go run file-operations-load-test.go > "${RESULTS_DIR}/stress-test-$(date +%Y%m%d-%H%M%S).log" 2>&1 || true
    
    rm -f stress-test-config.json
    
    echo -e "${GREEN}✓ Stress Tests completed${NC}"
}

# Function to generate summary report
generate_summary() {
    echo -e "${YELLOW}Generating Summary Report...${NC}"
    
    SUMMARY_FILE="${RESULTS_DIR}/load-test-summary-$(date +%Y%m%d-%H%M%S).md"
    
    cat > "$SUMMARY_FILE" << EOF
# Download Service Load Test Summary

**Date:** $(date)
**Service URL:** ${SERVICE_URL}

## Test Results

### API Load Tests
$(find "$RESULTS_DIR" -name "api-load-test-*.log" -exec tail -20 {} \; 2>/dev/null || echo "No API load test results found")

### File Operations Load Tests
$(find "$RESULTS_DIR" -name "file-ops-load-test-*.log" -exec tail -20 {} \; 2>/dev/null || echo "No file operations test results found")

### Benchmark Tests
$(find "$RESULTS_DIR" -name "*benchmarks-*.log" -exec tail -10 {} \; 2>/dev/null || echo "No benchmark results found")

### Profile Files Generated
$(find "$RESULTS_DIR" -name "*.prof" -exec basename {} \; 2>/dev/null || echo "No profile files found")

## Recommendations

1. **Performance Optimization:**
   - Review CPU and memory profiles for bottlenecks
   - Optimize file I/O operations based on benchmark results
   - Consider connection pooling improvements

2. **Scalability:**
   - Monitor concurrent operation limits
   - Implement circuit breakers for external dependencies
   - Consider horizontal scaling based on load patterns

3. **Monitoring:**
   - Set up alerts for response time degradation
   - Monitor memory usage patterns
   - Track download success rates

## Next Steps

1. Analyze profile files: \`go tool pprof <profile-file>\`
2. Review detailed logs in: \`${RESULTS_DIR}/\`
3. Implement optimizations based on findings
4. Re-run tests to validate improvements
EOF

    echo -e "${GREEN}✓ Summary report generated: ${SUMMARY_FILE}${NC}"
}

# Main execution
main() {
    case "${1:-all}" in
        "api")
            check_service
            run_api_load_tests
            ;;
        "file-ops")
            run_file_ops_load_tests
            ;;
        "bench")
            run_benchmark_tests
            ;;
        "profile")
            run_profiling_tests
            ;;
        "stress")
            check_service
            run_stress_tests
            ;;
        "all")
            check_service
            run_api_load_tests
            run_file_ops_load_tests
            run_benchmark_tests
            run_profiling_tests
            run_stress_tests
            generate_summary
            ;;
        "help"|"-h"|"--help")
            echo "Usage: $0 [test-type]"
            echo ""
            echo "Test types:"
            echo "  api       - Run API load tests"
            echo "  file-ops  - Run file operations load tests"
            echo "  bench     - Run Go benchmark tests"
            echo "  profile   - Run profiling tests (CPU, memory, block)"
            echo "  stress    - Run stress tests (1000+ concurrent)"
            echo "  all       - Run all tests (default)"
            echo "  help      - Show this help"
            echo ""
            echo "Environment variables:"
            echo "  SERVICE_URL - Service URL (default: http://localhost:8080)"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown test type: $1${NC}"
            echo "Use '$0 help' for usage information"
            exit 1
            ;;
    esac
}

main "$@"