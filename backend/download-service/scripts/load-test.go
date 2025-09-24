package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
)

// LoadTestConfig holds configuration for load testing
type LoadTestConfig struct {
	BaseURL         string
	NumClients      int
	RequestsPerClient int
	TestDuration    time.Duration
	Endpoints       []EndpointTest
}

// EndpointTest defines a test for a specific endpoint
type EndpointTest struct {
	Name     string
	Method   string
	Path     string
	Body     interface{}
	Headers  map[string]string
	Expected int // Expected status code
}

// TestResult holds results from load testing
type TestResult struct {
	Endpoint        string
	TotalRequests   int
	SuccessRequests int
	FailedRequests  int
	AvgResponseTime time.Duration
	MinResponseTime time.Duration
	MaxResponseTime time.Duration
	RequestsPerSec  float64
	Errors          []string
}

func main() {
	config := LoadTestConfig{
		BaseURL:           "http://localhost:8080",
		NumClients:        100,
		RequestsPerClient: 10,
		TestDuration:      30 * time.Second,
		Endpoints: []EndpointTest{
			{
				Name:     "Health Check",
				Method:   "GET",
				Path:     "/health",
				Expected: 200,
			},
			{
				Name:     "Detailed Health Check",
				Method:   "GET",
				Path:     "/health/detailed",
				Expected: 200,
			},
			{
				Name:     "Metrics",
				Method:   "GET",
				Path:     "/metrics",
				Expected: 200,
			},
			{
				Name:   "Start Download",
				Method: "POST",
				Path:   "/api/v1/downloads",
				Body: map[string]interface{}{
					"gameId": "test-game-123",
				},
				Headers: map[string]string{
					"Content-Type":  "application/json",
					"Authorization": "Bearer test-token",
				},
				Expected: 201,
			},
			{
				Name:     "Get Downloads",
				Method:   "GET",
				Path:     "/api/v1/downloads",
				Headers: map[string]string{
					"Authorization": "Bearer test-token",
				},
				Expected: 200,
			},
		},
	}

	fmt.Printf("Starting load test with %d clients, %d requests per client\n", 
		config.NumClients, config.RequestsPerClient)
	fmt.Printf("Test duration: %v\n", config.TestDuration)
	fmt.Printf("Target URL: %s\n\n", config.BaseURL)

	results := runLoadTest(config)
	printResults(results)
}

func runLoadTest(config LoadTestConfig) []TestResult {
	var results []TestResult

	for _, endpoint := range config.Endpoints {
		fmt.Printf("Testing endpoint: %s %s\n", endpoint.Method, endpoint.Path)
		result := testEndpoint(config, endpoint)
		results = append(results, result)
		fmt.Printf("Completed: %s - %d/%d successful\n\n", 
			endpoint.Name, result.SuccessRequests, result.TotalRequests)
	}

	return results
}

func testEndpoint(config LoadTestConfig, endpoint EndpointTest) TestResult {
	var wg sync.WaitGroup
	var mu sync.Mutex
	
	result := TestResult{
		Endpoint:        endpoint.Name,
		MinResponseTime: time.Hour, // Initialize with high value
		Errors:          []string{},
	}

	responseTimes := make([]time.Duration, 0, config.NumClients*config.RequestsPerClient)
	
	startTime := time.Now()
	
	// Create worker goroutines
	for i := 0; i < config.NumClients; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			
			client := &http.Client{
				Timeout: 10 * time.Second,
			}
			
			for j := 0; j < config.RequestsPerClient; j++ {
				reqStart := time.Now()
				success, err := makeRequest(client, config.BaseURL, endpoint)
				reqDuration := time.Since(reqStart)
				
				mu.Lock()
				result.TotalRequests++
				responseTimes = append(responseTimes, reqDuration)
				
				if success {
					result.SuccessRequests++
				} else {
					result.FailedRequests++
					if err != nil {
						result.Errors = append(result.Errors, err.Error())
					}
				}
				
				if reqDuration < result.MinResponseTime {
					result.MinResponseTime = reqDuration
				}
				if reqDuration > result.MaxResponseTime {
					result.MaxResponseTime = reqDuration
				}
				mu.Unlock()
			}
		}()
	}
	
	wg.Wait()
	totalDuration := time.Since(startTime)
	
	// Calculate average response time
	var totalResponseTime time.Duration
	for _, rt := range responseTimes {
		totalResponseTime += rt
	}
	result.AvgResponseTime = totalResponseTime / time.Duration(len(responseTimes))
	
	// Calculate requests per second
	result.RequestsPerSec = float64(result.TotalRequests) / totalDuration.Seconds()
	
	return result
}

func makeRequest(client *http.Client, baseURL string, endpoint EndpointTest) (bool, error) {
	url := baseURL + endpoint.Path
	
	var body io.Reader
	if endpoint.Body != nil {
		jsonBody, err := json.Marshal(endpoint.Body)
		if err != nil {
			return false, fmt.Errorf("failed to marshal body: %v", err)
		}
		body = bytes.NewBuffer(jsonBody)
	}
	
	req, err := http.NewRequest(endpoint.Method, url, body)
	if err != nil {
		return false, fmt.Errorf("failed to create request: %v", err)
	}
	
	// Add headers
	for key, value := range endpoint.Headers {
		req.Header.Set(key, value)
	}
	
	resp, err := client.Do(req)
	if err != nil {
		return false, fmt.Errorf("request failed: %v", err)
	}
	defer resp.Body.Close()
	
	// Read response body to ensure complete response
	_, err = io.ReadAll(resp.Body)
	if err != nil {
		return false, fmt.Errorf("failed to read response: %v", err)
	}
	
	return resp.StatusCode == endpoint.Expected, nil
}

func printResults(results []TestResult) {
	fmt.Println("=== LOAD TEST RESULTS ===")
	fmt.Println()
	
	for _, result := range results {
		fmt.Printf("Endpoint: %s\n", result.Endpoint)
		fmt.Printf("  Total Requests: %d\n", result.TotalRequests)
		fmt.Printf("  Successful: %d (%.2f%%)\n", 
			result.SuccessRequests, 
			float64(result.SuccessRequests)/float64(result.TotalRequests)*100)
		fmt.Printf("  Failed: %d (%.2f%%)\n", 
			result.FailedRequests,
			float64(result.FailedRequests)/float64(result.TotalRequests)*100)
		fmt.Printf("  Requests/sec: %.2f\n", result.RequestsPerSec)
		fmt.Printf("  Response Times:\n")
		fmt.Printf("    Average: %v\n", result.AvgResponseTime)
		fmt.Printf("    Min: %v\n", result.MinResponseTime)
		fmt.Printf("    Max: %v\n", result.MaxResponseTime)
		
		if len(result.Errors) > 0 {
			fmt.Printf("  Errors (%d):\n", len(result.Errors))
			errorCounts := make(map[string]int)
			for _, err := range result.Errors {
				errorCounts[err]++
			}
			for err, count := range errorCounts {
				fmt.Printf("    %s: %d times\n", err, count)
			}
		}
		fmt.Println()
	}
}