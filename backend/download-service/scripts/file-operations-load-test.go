package main

import (
	"context"
	"fmt"
	"math/rand"
	"sync"
	"time"
)

// FileOperationsLoadTest simulates heavy file operations load
type FileOperationsLoadTest struct {
	NumWorkers       int
	TestDuration     time.Duration
	FileSizes        []int64 // Different file sizes to test
	ConcurrentOps    int     // Number of concurrent operations per worker
}

// FileOpResult holds results from file operations testing
type FileOpResult struct {
	Operation       string
	TotalOps        int64
	SuccessfulOps   int64
	FailedOps       int64
	AvgDuration     time.Duration
	MinDuration     time.Duration
	MaxDuration     time.Duration
	TotalBytes      int64
	BytesPerSecond  float64
	OpsPerSecond    float64
}

func main() {
	config := FileOperationsLoadTest{
		NumWorkers:    10,
		TestDuration:  5 * time.Second,
		FileSizes:     []int64{1024, 10240, 102400, 1048576, 10485760}, // 1KB to 10MB
		ConcurrentOps: 5,
	}

	fmt.Printf("Starting file operations load test\n")
	fmt.Printf("Workers: %d\n", config.NumWorkers)
	fmt.Printf("Duration: %v\n", config.TestDuration)
	fmt.Printf("Concurrent ops per worker: %d\n", config.ConcurrentOps)
	fmt.Printf("File sizes: %v bytes\n\n", config.FileSizes)

	results := runFileOperationsTest(config)
	printFileOpResults(results)
}

func runFileOperationsTest(config FileOperationsLoadTest) []FileOpResult {
	ctx, cancel := context.WithTimeout(context.Background(), config.TestDuration)
	defer cancel()

	var wg sync.WaitGroup
	var mu sync.Mutex

	// Results for different operations
	results := map[string]*FileOpResult{
		"file_download":    {Operation: "File Download", MinDuration: time.Hour},
		"file_verification": {Operation: "File Verification", MinDuration: time.Hour},
		"file_cleanup":     {Operation: "File Cleanup", MinDuration: time.Hour},
		"stream_session":   {Operation: "Stream Session", MinDuration: time.Hour},
	}

	startTime := time.Now()

	// Start workers
	for i := 0; i < config.NumWorkers; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			runFileWorker(ctx, workerID, config, results, &mu)
		}(i)
	}

	wg.Wait()
	totalDuration := time.Since(startTime)

	// Calculate final metrics
	var finalResults []FileOpResult
	for _, result := range results {
		if result.TotalOps > 0 {
			result.AvgDuration = time.Duration(int64(result.AvgDuration) / result.TotalOps)
			result.OpsPerSecond = float64(result.TotalOps) / totalDuration.Seconds()
			result.BytesPerSecond = float64(result.TotalBytes) / totalDuration.Seconds()
		}
		finalResults = append(finalResults, *result)
	}

	return finalResults
}

func runFileWorker(ctx context.Context, workerID int, config FileOperationsLoadTest, 
	results map[string]*FileOpResult, mu *sync.Mutex) {
	
	rand.Seed(time.Now().UnixNano() + int64(workerID))
	
	for {
		select {
		case <-ctx.Done():
			return
		default:
			// Simulate different file operations
			operations := []string{"file_download", "file_verification", "file_cleanup", "stream_session"}
			
			for _, op := range operations {
				select {
				case <-ctx.Done():
					return
				default:
					duration, bytes, success := simulateFileOperation(op, config.FileSizes)
					
					mu.Lock()
					result := results[op]
					result.TotalOps++
					result.AvgDuration += duration
					result.TotalBytes += bytes
					
					if success {
						result.SuccessfulOps++
					} else {
						result.FailedOps++
					}
					
					if duration < result.MinDuration {
						result.MinDuration = duration
					}
					if duration > result.MaxDuration {
						result.MaxDuration = duration
					}
					mu.Unlock()
				}
			}
		}
	}
}

func simulateFileOperation(operation string, fileSizes []int64) (time.Duration, int64, bool) {
	start := time.Now()
	
	// Select random file size
	fileSize := fileSizes[rand.Intn(len(fileSizes))]
	
	// Simulate operation duration based on file size and operation type
	var baseDuration time.Duration
	var success bool = true
	
	switch operation {
	case "file_download":
		// Simulate download time: ~1ms per KB + network latency
		baseDuration = time.Duration(fileSize/1024)*time.Millisecond + 
			time.Duration(rand.Intn(50))*time.Millisecond
		// 95% success rate for downloads
		success = rand.Float32() < 0.95
		
	case "file_verification":
		// Simulate verification time: ~0.1ms per KB
		baseDuration = time.Duration(fileSize/10240)*time.Millisecond + 
			time.Duration(rand.Intn(10))*time.Millisecond
		// 99% success rate for verification
		success = rand.Float32() < 0.99
		
	case "file_cleanup":
		// Simulate cleanup time: ~0.05ms per KB
		baseDuration = time.Duration(fileSize/20480)*time.Millisecond + 
			time.Duration(rand.Intn(5))*time.Millisecond
		// 99.5% success rate for cleanup
		success = rand.Float32() < 0.995
		
	case "stream_session":
		// Simulate streaming session setup: fixed overhead + size-based
		baseDuration = 10*time.Millisecond + 
			time.Duration(fileSize/51200)*time.Millisecond + 
			time.Duration(rand.Intn(20))*time.Millisecond
		// 97% success rate for streaming
		success = rand.Float32() < 0.97
	}
	
	// Add some random variation (±20%)
	variation := time.Duration(float64(baseDuration) * (rand.Float64()*0.4 - 0.2))
	actualDuration := baseDuration + variation
	
	// Simulate the actual work by sleeping
	time.Sleep(actualDuration / 1000) // Scale down for testing
	
	return time.Since(start), fileSize, success
}

func printFileOpResults(results []FileOpResult) {
	fmt.Println("=== FILE OPERATIONS LOAD TEST RESULTS ===")
	fmt.Println()
	
	var totalOps int64
	var totalBytes int64
	
	for _, result := range results {
		fmt.Printf("Operation: %s\n", result.Operation)
		fmt.Printf("  Total Operations: %d\n", result.TotalOps)
		fmt.Printf("  Successful: %d (%.2f%%)\n", 
			result.SuccessfulOps, 
			float64(result.SuccessfulOps)/float64(result.TotalOps)*100)
		fmt.Printf("  Failed: %d (%.2f%%)\n", 
			result.FailedOps,
			float64(result.FailedOps)/float64(result.TotalOps)*100)
		fmt.Printf("  Operations/sec: %.2f\n", result.OpsPerSecond)
		fmt.Printf("  Bytes/sec: %.2f (%.2f MB/s)\n", 
			result.BytesPerSecond, result.BytesPerSecond/1024/1024)
		fmt.Printf("  Response Times:\n")
		fmt.Printf("    Average: %v\n", result.AvgDuration)
		fmt.Printf("    Min: %v\n", result.MinDuration)
		fmt.Printf("    Max: %v\n", result.MaxDuration)
		fmt.Printf("  Total Data: %.2f MB\n", float64(result.TotalBytes)/1024/1024)
		fmt.Println()
		
		totalOps += result.TotalOps
		totalBytes += result.TotalBytes
	}
	
	fmt.Printf("=== SUMMARY ===\n")
	fmt.Printf("Total Operations: %d\n", totalOps)
	fmt.Printf("Total Data Processed: %.2f MB\n", float64(totalBytes)/1024/1024)
	fmt.Println()
}