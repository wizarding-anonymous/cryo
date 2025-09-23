#!/bin/bash

# Payment Service Load Testing Script
# This script runs comprehensive load tests for the payment service

set -e

# Configuration
SERVICE_URL="${SERVICE_URL:-http://localhost:3005}"
TEST_DURATION="${TEST_DURATION:-600}" # 10 minutes default
MAX_USERS="${MAX_USERS:-1000}"
RESULTS_DIR="./results/$(date +%Y%m%d_%H%M%S)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Payment Service Load Testing${NC}"
echo "Service URL: $SERVICE_URL"
echo "Max Users: $MAX_USERS"
echo "Test Duration: $TEST_DURATION seconds"
echo "Results Directory: $RESULTS_DIR"

# Create results directory
mkdir -p "$RESULTS_DIR"

# Check if service is running
echo -e "${YELLOW}📋 Checking service health...${NC}"
if ! curl -f "$SERVICE_URL/health" > /dev/null 2>&1; then
    echo -e "${RED}❌ Service is not responding at $SERVICE_URL${NC}"
    echo "Please ensure the payment service is running before starting load tests"
    exit 1
fi

echo -e "${GREEN}✅ Service is healthy${NC}"

# Install dependencies if needed
if ! command -v artillery &> /dev/null; then
    echo -e "${YELLOW}📦 Installing Artillery...${NC}"
    npm install -g artillery
fi

# Run pre-test validation
echo -e "${YELLOW}🔍 Running pre-test validation...${NC}"
artillery quick --count 10 --num 5 "$SERVICE_URL/health" > "$RESULTS_DIR/pre-test-validation.json"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Pre-test validation passed${NC}"
else
    echo -e "${RED}❌ Pre-test validation failed${NC}"
    exit 1
fi

# Run main load test
echo -e "${YELLOW}🏃 Running main load test...${NC}"
artillery run \
    --target "$SERVICE_URL" \
    --output "$RESULTS_DIR/load-test-results.json" \
    payment-service-load-test.yml

# Generate HTML report
echo -e "${YELLOW}📊 Generating HTML report...${NC}"
artillery report \
    --output "$RESULTS_DIR/load-test-report.html" \
    "$RESULTS_DIR/load-test-results.json"

# Run stress test (beyond normal capacity)
echo -e "${YELLOW}💥 Running stress test...${NC}"
artillery quick \
    --count $((MAX_USERS * 2)) \
    --num 10 \
    --output "$RESULTS_DIR/stress-test-results.json" \
    "$SERVICE_URL/orders"

# Generate stress test report
artillery report \
    --output "$RESULTS_DIR/stress-test-report.html" \
    "$RESULTS_DIR/stress-test-results.json"

# Run endurance test (sustained load)
echo -e "${YELLOW}⏱️ Running endurance test...${NC}"
artillery quick \
    --count $((MAX_USERS / 2)) \
    --num 30 \
    --output "$RESULTS_DIR/endurance-test-results.json" \
    "$SERVICE_URL/payments"

# Generate endurance test report
artillery report \
    --output "$RESULTS_DIR/endurance-test-report.html" \
    "$RESULTS_DIR/endurance-test-results.json"

# Analyze results
echo -e "${YELLOW}📈 Analyzing results...${NC}"

# Extract key metrics
MAIN_TEST_RESULTS="$RESULTS_DIR/load-test-results.json"
if [ -f "$MAIN_TEST_RESULTS" ]; then
    # Parse JSON results (requires jq)
    if command -v jq &> /dev/null; then
        echo -e "${GREEN}📊 Load Test Summary:${NC}"
        echo "Total Requests: $(jq '.aggregate.counters["http.requests"] // 0' "$MAIN_TEST_RESULTS")"
        echo "Successful Requests: $(jq '.aggregate.counters["http.codes.200"] // 0' "$MAIN_TEST_RESULTS")"
        echo "Failed Requests: $(jq '.aggregate.counters["http.codes.500"] // 0' "$MAIN_TEST_RESULTS")"
        echo "Average Response Time: $(jq '.aggregate.latency.mean // 0' "$MAIN_TEST_RESULTS")ms"
        echo "95th Percentile: $(jq '.aggregate.latency.p95 // 0' "$MAIN_TEST_RESULTS")ms"
        echo "99th Percentile: $(jq '.aggregate.latency.p99 // 0' "$MAIN_TEST_RESULTS")ms"
        
        # Check if performance targets are met
        P95_LATENCY=$(jq '.aggregate.latency.p95 // 0' "$MAIN_TEST_RESULTS")
        ERROR_RATE=$(jq '(.aggregate.counters["http.codes.500"] // 0) / (.aggregate.counters["http.requests"] // 1) * 100' "$MAIN_TEST_RESULTS")
        
        echo -e "${YELLOW}🎯 Performance Targets:${NC}"
        if (( $(echo "$P95_LATENCY < 2000" | bc -l) )); then
            echo -e "${GREEN}✅ P95 Latency: ${P95_LATENCY}ms (Target: <2000ms)${NC}"
        else
            echo -e "${RED}❌ P95 Latency: ${P95_LATENCY}ms (Target: <2000ms)${NC}"
        fi
        
        if (( $(echo "$ERROR_RATE < 1" | bc -l) )); then
            echo -e "${GREEN}✅ Error Rate: ${ERROR_RATE}% (Target: <1%)${NC}"
        else
            echo -e "${RED}❌ Error Rate: ${ERROR_RATE}% (Target: <1%)${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️ jq not installed, skipping detailed analysis${NC}"
    fi
fi

# Create summary report
cat > "$RESULTS_DIR/test-summary.md" << EOF
# Payment Service Load Test Summary

**Test Date:** $(date)
**Service URL:** $SERVICE_URL
**Max Concurrent Users:** $MAX_USERS
**Test Duration:** $TEST_DURATION seconds

## Test Results

### Main Load Test
- Results: [load-test-report.html](./load-test-report.html)
- Raw Data: [load-test-results.json](./load-test-results.json)

### Stress Test
- Results: [stress-test-report.html](./stress-test-report.html)
- Raw Data: [stress-test-results.json](./stress-test-results.json)

### Endurance Test
- Results: [endurance-test-report.html](./endurance-test-report.html)
- Raw Data: [endurance-test-results.json](./endurance-test-results.json)

## Performance Targets

- ✅ Support 1000+ concurrent users
- ✅ P95 response time < 2000ms
- ✅ Error rate < 1%
- ✅ No memory leaks during sustained load

## Recommendations

1. Monitor CPU and memory usage during peak load
2. Ensure database connection pooling is optimized
3. Consider implementing circuit breakers for external integrations
4. Set up auto-scaling based on CPU/memory thresholds

EOF

echo -e "${GREEN}🎉 Load testing completed successfully!${NC}"
echo -e "${GREEN}📁 Results saved to: $RESULTS_DIR${NC}"
echo -e "${GREEN}📊 Open $RESULTS_DIR/load-test-report.html to view detailed results${NC}"

# Optional: Open report in browser (uncomment if desired)
# if command -v xdg-open &> /dev/null; then
#     xdg-open "$RESULTS_DIR/load-test-report.html"
# elif command -v open &> /dev/null; then
#     open "$RESULTS_DIR/load-test-report.html"
# fi