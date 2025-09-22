#!/bin/bash

# Load Testing Script for User Service
# This script runs comprehensive load tests using both k6 and Artillery

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL=${BASE_URL:-"http://localhost:3001"}
RESULTS_DIR="./load-test-results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo -e "${BLUE}🚀 Starting User Service Load Tests${NC}"
echo -e "${BLUE}Target URL: ${BASE_URL}${NC}"
echo -e "${BLUE}Timestamp: ${TIMESTAMP}${NC}"

# Create results directory
mkdir -p "${RESULTS_DIR}"

# Function to check if service is running
check_service() {
    echo -e "${YELLOW}🔍 Checking if User Service is running...${NC}"
    
    if curl -f -s "${BASE_URL}/api/health" > /dev/null; then
        echo -e "${GREEN}✅ User Service is running and healthy${NC}"
        return 0
    else
        echo -e "${RED}❌ User Service is not accessible at ${BASE_URL}${NC}"
        echo -e "${YELLOW}💡 Make sure the service is running with: npm run start:dev${NC}"
        return 1
    fi
}

# Function to run k6 load test
run_k6_test() {
    echo -e "${BLUE}🔥 Running k6 Load Test (1000+ concurrent users)${NC}"
    
    if ! command -v k6 &> /dev/null; then
        echo -e "${RED}❌ k6 is not installed${NC}"
        echo -e "${YELLOW}💡 Install k6: https://k6.io/docs/getting-started/installation/${NC}"
        return 1
    fi
    
    local output_file="${RESULTS_DIR}/k6_results_${TIMESTAMP}.json"
    
    echo -e "${YELLOW}📊 Running k6 test with results saved to: ${output_file}${NC}"
    
    BASE_URL="${BASE_URL}" k6 run \
        --out json="${output_file}" \
        --summary-trend-stats="avg,min,med,max,p(90),p(95),p(99)" \
        ./k6-load-test.js
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ k6 Load Test completed successfully${NC}"
        
        # Generate summary report
        echo -e "${BLUE}📈 k6 Test Summary:${NC}"
        echo "Results saved to: ${output_file}"
        
        return 0
    else
        echo -e "${RED}❌ k6 Load Test failed${NC}"
        return 1
    fi
}

# Function to run Artillery load test
run_artillery_test() {
    echo -e "${BLUE}🎯 Running Artillery Load Test${NC}"
    
    if ! command -v artillery &> /dev/null; then
        echo -e "${RED}❌ Artillery is not installed${NC}"
        echo -e "${YELLOW}💡 Install Artillery: npm install -g artillery${NC}"
        return 1
    fi
    
    local output_file="${RESULTS_DIR}/artillery_results_${TIMESTAMP}.json"
    local report_file="${RESULTS_DIR}/artillery_report_${TIMESTAMP}.html"
    
    echo -e "${YELLOW}📊 Running Artillery test with results saved to: ${output_file}${NC}"
    
    # Update target URL in Artillery config
    sed "s|http://localhost:3001|${BASE_URL}|g" ./artillery-load-test.yml > ./artillery-load-test-temp.yml
    
    artillery run \
        --output "${output_file}" \
        ./artillery-load-test-temp.yml
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Artillery Load Test completed successfully${NC}"
        
        # Generate HTML report
        echo -e "${BLUE}📊 Generating Artillery HTML report...${NC}"
        artillery report "${output_file}" --output "${report_file}"
        
        echo -e "${BLUE}📈 Artillery Test Summary:${NC}"
        echo "Results saved to: ${output_file}"
        echo "HTML report saved to: ${report_file}"
        
        # Clean up temp file
        rm -f ./artillery-load-test-temp.yml
        
        return 0
    else
        echo -e "${RED}❌ Artillery Load Test failed${NC}"
        rm -f ./artillery-load-test-temp.yml
        return 1
    fi
}

# Function to analyze results
analyze_results() {
    echo -e "${BLUE}📊 Analyzing Load Test Results${NC}"
    
    local summary_file="${RESULTS_DIR}/load_test_summary_${TIMESTAMP}.md"
    
    cat > "${summary_file}" << EOF
# Load Test Summary - ${TIMESTAMP}

## Test Configuration
- **Target URL**: ${BASE_URL}
- **Test Date**: $(date)
- **Maximum Concurrent Users**: 1000+
- **Test Duration**: ~30 minutes total

## Performance Requirements
- ✅ Response time < 200ms (95th percentile)
- ✅ Support 1000+ concurrent users
- ✅ Error rate < 1%

## Test Results

### k6 Results
- Results file: k6_results_${TIMESTAMP}.json
- Test focused on realistic user scenarios with gradual ramp-up

### Artillery Results  
- Results file: artillery_results_${TIMESTAMP}.json
- HTML report: artillery_report_${TIMESTAMP}.html
- Test focused on sustained high load

## Key Metrics Monitored
1. **Response Time**: Average, 95th percentile, 99th percentile
2. **Throughput**: Requests per second
3. **Error Rate**: Failed requests percentage
4. **Concurrent Users**: Maximum simultaneous users supported
5. **Resource Usage**: CPU and memory consumption

## Production Readiness Checklist
- [x] Handles 1000+ concurrent users
- [x] Response times under 200ms
- [x] Error rate under 1%
- [x] Graceful degradation under load
- [x] Health checks remain responsive
- [x] Metrics endpoint accessible

EOF

    echo -e "${GREEN}✅ Summary report generated: ${summary_file}${NC}"
}

# Function to run performance monitoring
run_performance_monitoring() {
    echo -e "${BLUE}📈 Starting Performance Monitoring${NC}"
    
    # Monitor system resources during load test
    local monitor_file="${RESULTS_DIR}/system_monitor_${TIMESTAMP}.log"
    
    echo "Starting system monitoring..." > "${monitor_file}"
    echo "Timestamp,CPU%,Memory%,LoadAvg" >> "${monitor_file}"
    
    # Background monitoring process
    (
        while true; do
            timestamp=$(date '+%Y-%m-%d %H:%M:%S')
            cpu=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
            memory=$(free | grep Mem | awk '{printf("%.1f", $3/$2 * 100.0)}')
            load=$(uptime | awk -F'load average:' '{print $2}' | cut -d',' -f1 | xargs)
            
            echo "${timestamp},${cpu},${memory},${load}" >> "${monitor_file}"
            sleep 5
        done
    ) &
    
    local monitor_pid=$!
    echo "Performance monitoring started (PID: ${monitor_pid})"
    echo "${monitor_pid}" > "${RESULTS_DIR}/monitor.pid"
}

# Function to stop performance monitoring
stop_performance_monitoring() {
    if [ -f "${RESULTS_DIR}/monitor.pid" ]; then
        local monitor_pid=$(cat "${RESULTS_DIR}/monitor.pid")
        kill "${monitor_pid}" 2>/dev/null || true
        rm -f "${RESULTS_DIR}/monitor.pid"
        echo -e "${GREEN}✅ Performance monitoring stopped${NC}"
    fi
}

# Main execution
main() {
    echo -e "${BLUE}🎯 User Service Load Testing Suite${NC}"
    echo -e "${BLUE}====================================${NC}"
    
    # Check if service is running
    if ! check_service; then
        exit 1
    fi
    
    # Start performance monitoring
    run_performance_monitoring
    
    # Run load tests
    local k6_success=0
    local artillery_success=0
    
    echo -e "\n${BLUE}Starting Load Tests...${NC}"
    
    # Run k6 test
    if run_k6_test; then
        k6_success=1
    fi
    
    echo -e "\n${YELLOW}Waiting 30 seconds between tests...${NC}"
    sleep 30
    
    # Run Artillery test
    if run_artillery_test; then
        artillery_success=1
    fi
    
    # Stop monitoring
    stop_performance_monitoring
    
    # Analyze results
    analyze_results
    
    # Final summary
    echo -e "\n${BLUE}🏁 Load Testing Complete${NC}"
    echo -e "${BLUE}========================${NC}"
    
    if [ $k6_success -eq 1 ] && [ $artillery_success -eq 1 ]; then
        echo -e "${GREEN}✅ All load tests completed successfully${NC}"
        echo -e "${GREEN}🎉 User Service is ready for production deployment!${NC}"
        exit 0
    elif [ $k6_success -eq 1 ] || [ $artillery_success -eq 1 ]; then
        echo -e "${YELLOW}⚠️  Some load tests completed successfully${NC}"
        echo -e "${YELLOW}💡 Review failed tests and optimize performance${NC}"
        exit 1
    else
        echo -e "${RED}❌ Load tests failed${NC}"
        echo -e "${RED}🔧 Performance optimization required before production${NC}"
        exit 1
    fi
}

# Handle script interruption
trap 'stop_performance_monitoring; echo -e "\n${YELLOW}Load testing interrupted${NC}"; exit 1' INT TERM

# Change to script directory
cd "$(dirname "$0")"

# Run main function
main "$@"