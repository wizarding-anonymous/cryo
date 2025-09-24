#!/bin/bash

# Performance Testing Script for Library Service
# This script runs comprehensive performance tests including load tests, database stress tests, and benchmarks

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000/api}"
JWT_TOKEN="${JWT_TOKEN:-}"
REQUIRE_AUTH="${REQUIRE_AUTH:-false}"
TEST_DURATION="${TEST_DURATION:-5m}"
MAX_VUS="${MAX_VUS:-1000}"
RESULTS_DIR="./performance-results"

echo -e "${BLUE}=== Library Service Performance Testing Suite ===${NC}"
echo -e "${BLUE}Base URL: ${BASE_URL}${NC}"
echo -e "${BLUE}Test Duration: ${TEST_DURATION}${NC}"
echo -e "${BLUE}Max Virtual Users: ${MAX_VUS}${NC}"
echo ""

# Create results directory
mkdir -p "${RESULTS_DIR}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Function to check if k6 is installed
check_k6() {
    if ! command -v k6 &> /dev/null; then
        echo -e "${RED}Error: k6 is not installed. Please install k6 first.${NC}"
        echo "Visit: https://k6.io/docs/getting-started/installation/"
        exit 1
    fi
    echo -e "${GREEN}✓ k6 is installed${NC}"
}

# Function to check if service is running
check_service() {
    echo -e "${YELLOW}Checking if Library Service is running...${NC}"
    if curl -s -f "${BASE_URL}/health" > /dev/null; then
        echo -e "${GREEN}✓ Library Service is running${NC}"
    else
        echo -e "${RED}Error: Library Service is not responding at ${BASE_URL}${NC}"
        echo "Please start the service first."
        exit 1
    fi
}

# Function to run basic load test
run_basic_load_test() {
    echo -e "${YELLOW}Running Basic Load Test...${NC}"
    k6 run \
        --env BASE_URL="${BASE_URL}" \
        --env JWT_TOKEN="${JWT_TOKEN}" \
        --env REQUIRE_AUTH="${REQUIRE_AUTH}" \
        --out json="${RESULTS_DIR}/basic_load_test_${TIMESTAMP}.json" \
        --summary-export="${RESULTS_DIR}/basic_load_test_summary_${TIMESTAMP}.json" \
        ./load-tests/k6-script.js
    
    echo -e "${GREEN}✓ Basic Load Test completed${NC}"
}

# Function to run comprehensive performance test suite
run_performance_suite() {
    echo -e "${YELLOW}Running Comprehensive Performance Test Suite...${NC}"
    
    # Test different scenarios
    scenarios=("large_library_load" "search_performance" "ownership_checks" "mixed_workload")
    
    for scenario in "${scenarios[@]}"; do
        echo -e "${BLUE}Running scenario: ${scenario}${NC}"
        k6 run \
            --env BASE_URL="${BASE_URL}" \
            --env JWT_TOKEN="${JWT_TOKEN}" \
            --env REQUIRE_AUTH="${REQUIRE_AUTH}" \
            --env K6_SCENARIO_NAME="${scenario}" \
            --out json="${RESULTS_DIR}/performance_suite_${scenario}_${TIMESTAMP}.json" \
            --summary-export="${RESULTS_DIR}/performance_suite_${scenario}_summary_${TIMESTAMP}.json" \
            ./load-tests/performance-test-suite.js
        
        echo -e "${GREEN}✓ Scenario ${scenario} completed${NC}"
        sleep 10 # Cool down between tests
    done
}

# Function to run database stress tests
run_database_stress_tests() {
    echo -e "${YELLOW}Running Database Stress Tests...${NC}"
    
    # Test different database scenarios
    db_scenarios=("connection_pool_stress" "complex_queries" "concurrent_writes" "large_dataset_pagination")
    
    for scenario in "${db_scenarios[@]}"; do
        echo -e "${BLUE}Running DB scenario: ${scenario}${NC}"
        k6 run \
            --env BASE_URL="${BASE_URL}" \
            --env JWT_TOKEN="${JWT_TOKEN}" \
            --env K6_SCENARIO_NAME="${scenario}" \
            --out json="${RESULTS_DIR}/db_stress_${scenario}_${TIMESTAMP}.json" \
            --summary-export="${RESULTS_DIR}/db_stress_${scenario}_summary_${TIMESTAMP}.json" \
            ./load-tests/database-stress-test.js
        
        echo -e "${GREEN}✓ DB Scenario ${scenario} completed${NC}"
        sleep 15 # Longer cool down for database tests
    done
}

# Function to run Jest performance tests
run_jest_performance_tests() {
    echo -e "${YELLOW}Running Jest Performance Tests...${NC}"
    
    # Set test environment variables
    export NODE_ENV=test
    export DATABASE_HOST=localhost
    export DATABASE_PORT=5432
    export DATABASE_NAME=library_service_test
    export REDIS_HOST=localhost
    export REDIS_PORT=6379
    
    # Run performance e2e tests
    npm run test:e2e -- --testNamePattern="Performance E2E" --verbose --detectOpenHandles
    
    echo -e "${GREEN}✓ Jest Performance Tests completed${NC}"
}

# Function to generate performance report
generate_report() {
    echo -e "${YELLOW}Generating Performance Report...${NC}"
    
    REPORT_FILE="${RESULTS_DIR}/performance_report_${TIMESTAMP}.md"
    
    cat > "${REPORT_FILE}" << EOF
# Library Service Performance Test Report

**Test Date:** $(date)
**Base URL:** ${BASE_URL}
**Test Duration:** ${TEST_DURATION}
**Max Virtual Users:** ${MAX_VUS}

## Test Results Summary

### Basic Load Test
- Results: \`basic_load_test_${TIMESTAMP}.json\`
- Summary: \`basic_load_test_summary_${TIMESTAMP}.json\`

### Performance Test Suite
EOF

    for scenario in "large_library_load" "search_performance" "ownership_checks" "mixed_workload"; do
        echo "- **${scenario}**: \`performance_suite_${scenario}_${TIMESTAMP}.json\`" >> "${REPORT_FILE}"
    done

    cat >> "${REPORT_FILE}" << EOF

### Database Stress Tests
EOF

    for scenario in "connection_pool_stress" "complex_queries" "concurrent_writes" "large_dataset_pagination"; do
        echo "- **${scenario}**: \`db_stress_${scenario}_${TIMESTAMP}.json\`" >> "${REPORT_FILE}"
    done

    cat >> "${REPORT_FILE}" << EOF

## Performance Requirements Verification

### Response Time Requirements (from spec)
- Library load: < 200ms (95th percentile)
- Search operations: < 500ms (90th percentile)
- Ownership checks: < 100ms (95th percentile)

### Throughput Requirements
- Support 1000+ concurrent users
- Error rate < 1%

## Recommendations

Based on the test results, review the following:

1. **Database Optimization**
   - Check slow query logs
   - Verify index usage
   - Monitor connection pool utilization

2. **Caching Strategy**
   - Review cache hit rates
   - Optimize TTL values
   - Consider cache warming strategies

3. **Application Performance**
   - Profile memory usage
   - Check for memory leaks
   - Optimize critical code paths

## Files Generated

All test result files are stored in: \`${RESULTS_DIR}/\`

EOF

    echo -e "${GREEN}✓ Performance Report generated: ${REPORT_FILE}${NC}"
}

# Function to cleanup old results
cleanup_old_results() {
    echo -e "${YELLOW}Cleaning up old test results (keeping last 10)...${NC}"
    
    # Keep only the 10 most recent result files
    find "${RESULTS_DIR}" -name "*.json" -type f -printf '%T@ %p\n' | sort -rn | tail -n +21 | cut -d' ' -f2- | xargs -r rm
    find "${RESULTS_DIR}" -name "*.md" -type f -printf '%T@ %p\n' | sort -rn | tail -n +11 | cut -d' ' -f2- | xargs -r rm
    
    echo -e "${GREEN}✓ Cleanup completed${NC}"
}

# Main execution
main() {
    echo -e "${BLUE}Starting Performance Test Suite...${NC}"
    
    # Pre-flight checks
    check_k6
    check_service
    
    # Cleanup old results
    cleanup_old_results
    
    # Run tests based on arguments
    case "${1:-all}" in
        "basic")
            run_basic_load_test
            ;;
        "suite")
            run_performance_suite
            ;;
        "database")
            run_database_stress_tests
            ;;
        "jest")
            run_jest_performance_tests
            ;;
        "all")
            run_basic_load_test
            run_performance_suite
            run_database_stress_tests
            run_jest_performance_tests
            ;;
        *)
            echo -e "${RED}Usage: $0 [basic|suite|database|jest|all]${NC}"
            exit 1
            ;;
    esac
    
    # Generate report
    generate_report
    
    echo -e "${GREEN}=== Performance Testing Completed ===${NC}"
    echo -e "${GREEN}Results saved in: ${RESULTS_DIR}/${NC}"
}

# Run main function with all arguments
main "$@"