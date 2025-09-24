// +build integration

package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/suite"

	"download-service/internal/cache"
	"download-service/internal/clients/library"
	"download-service/internal/clients/s3"
	"download-service/internal/database"
	"download-service/internal/middleware"
	"download-service/internal/models"
	"download-service/internal/repository"
	"download-service/internal/router"
	"download-service/internal/services"
	"download-service/pkg/config"
	"download-service/pkg/logger"
)

type IntegrationTestSuite struct {
	suite.Suite
	app    *gin.Engine
	db     *database.DB
	config *config.Config
	server *httptest.Server
}

func (s *IntegrationTestSuite) SetupSuite() {
	// Load test configuration
	cfg, err := config.Load()
	s.Require().NoError(err)
	s.config = cfg

	// Override with test database
	if testDSN := os.Getenv("TEST_DATABASE_URL"); testDSN != "" {
		s.config.Database.DSN = testDSN
	} else {
		s.config.Database.DSN = "postgres://postgres:postgres@localhost:5432/downloads_test?sslmode=disable"
	}

	// Connect to test database
	db, err := database.Connect(database.Options{
		DSN:         s.config.Database.DSN,
		MaxOpenConn: 10,
		MaxIdleConn: 5,
	})
	if err != nil {
		s.T().Skipf("Could not connect to test database: %v", err)
	}
	s.db = db

	// Run migrations
	err = database.Migrate(db)
	s.Require().NoError(err)

	// Setup dependencies
	log := logger.New()
	
	// Mock S3 client for testing
	s3Client := s3.NewMockClient()
	
	// Mock library client
	libraryClient := &library.MockClient{
		OwnedGames: map[string][]string{
			"test-user-1": {"game-1", "game-2", "game-3"},
			"test-user-2": {"game-2", "game-4"},
		},
	}

	// Redis cache (use mock for testing)
	redisCache := cache.NewMockRedis()

	// Repositories
	downloadRepo := repository.NewDownloadRepository(db)
	downloadFileRepo := repository.NewDownloadFileRepository(db)

	// Services
	streamService := services.NewStreamService()
	fileService := services.NewFileService(s3Client)
	downloadService := services.NewDownloadService(
		db,
		nil, // Redis client - using nil for tests
		downloadRepo,
		streamService,
		libraryClient,
		log,
	)

	// Setup Gin
	gin.SetMode(gin.TestMode)
	s.app = gin.New()

	// Add middleware
	s.app.Use(middleware.RequestID())
	s.app.Use(middleware.Logging(log))
	s.app.Use(func(c *gin.Context) {
		// Mock authentication - set user ID from header
		if userID := c.GetHeader("X-Test-User-ID"); userID != "" {
			c.Set("auth_user_id", userID)
		}
		c.Next()
	})

	// Setup routes
	apiRouter := router.NewRouter(downloadService, nil, log)
	apiRouter.SetupRoutes(s.app)

	// Start test server
	s.server = httptest.NewServer(s.app)
}

func (s *IntegrationTestSuite) TearDownSuite() {
	if s.server != nil {
		s.server.Close()
	}
	if s.db != nil {
		// Clean up test data
		s.db.Exec("DELETE FROM download_files")
		s.db.Exec("DELETE FROM downloads")
	}
}

func (s *IntegrationTestSuite) SetupTest() {
	// Clean up test data before each test
	s.db.Exec("DELETE FROM download_files")
	s.db.Exec("DELETE FROM downloads")
}

func (s *IntegrationTestSuite) TestHealthEndpoint() {
	resp, err := http.Get(s.server.URL + "/health")
	s.Require().NoError(err)
	defer resp.Body.Close()

	s.Equal(http.StatusOK, resp.StatusCode)
}

func (s *IntegrationTestSuite) TestStartDownload_Success() {
	payload := map[string]string{
		"gameId": "game-1",
	}
	body, _ := json.Marshal(payload)

	req, _ := http.NewRequest(http.MethodPost, s.server.URL+"/api/downloads", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Test-User-ID", "test-user-1")

	client := &http.Client{}
	resp, err := client.Do(req)
	s.Require().NoError(err)
	defer resp.Body.Close()

	s.Equal(http.StatusCreated, resp.StatusCode)

	var result map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&result)
	s.Require().NoError(err)
	s.NotEmpty(result["id"])
	s.Equal("game-1", result["gameId"])
	s.Equal("downloading", result["status"])
}

func (s *IntegrationTestSuite) TestStartDownload_Unauthorized() {
	payload := map[string]string{
		"gameId": "game-5", // User doesn't own this game
	}
	body, _ := json.Marshal(payload)

	req, _ := http.NewRequest(http.MethodPost, s.server.URL+"/api/downloads", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Test-User-ID", "test-user-1")

	client := &http.Client{}
	resp, err := client.Do(req)
	s.Require().NoError(err)
	defer resp.Body.Close()

	s.Equal(http.StatusForbidden, resp.StatusCode)
}

func (s *IntegrationTestSuite) TestGetDownload() {
	// First create a download
	download := &models.Download{
		UserID:         "test-user-1",
		GameID:         "game-1",
		Status:         models.StatusDownloading,
		Progress:       50,
		TotalSize:      1000000,
		DownloadedSize: 500000,
		Speed:          1024,
	}
	err := s.db.Create(download).Error
	s.Require().NoError(err)

	// Get the download
	req, _ := http.NewRequest(http.MethodGet, s.server.URL+"/api/downloads/"+download.ID, nil)
	req.Header.Set("X-Test-User-ID", "test-user-1")

	client := &http.Client{}
	resp, err := client.Do(req)
	s.Require().NoError(err)
	defer resp.Body.Close()

	s.Equal(http.StatusOK, resp.StatusCode)

	var result map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&result)
	s.Require().NoError(err)
	s.Equal(download.ID, result["id"])
	s.Equal("game-1", result["gameId"])
	s.Equal(float64(50), result["progress"])
}

func (s *IntegrationTestSuite) TestPauseResumeDownload() {
	// Create a download
	download := &models.Download{
		UserID: "test-user-1",
		GameID: "game-1",
		Status: models.StatusDownloading,
	}
	err := s.db.Create(download).Error
	s.Require().NoError(err)

	// Pause the download
	req, _ := http.NewRequest(http.MethodPatch, s.server.URL+"/api/downloads/"+download.ID+"/pause", nil)
	req.Header.Set("X-Test-User-ID", "test-user-1")

	client := &http.Client{}
	resp, err := client.Do(req)
	s.Require().NoError(err)
	defer resp.Body.Close()

	s.Equal(http.StatusNoContent, resp.StatusCode)

	// Verify status changed
	var updatedDownload models.Download
	err = s.db.First(&updatedDownload, "id = ?", download.ID).Error
	s.Require().NoError(err)
	s.Equal(models.StatusPaused, updatedDownload.Status)

	// Resume the download
	req, _ = http.NewRequest(http.MethodPatch, s.server.URL+"/api/downloads/"+download.ID+"/resume", nil)
	req.Header.Set("X-Test-User-ID", "test-user-1")

	resp, err = client.Do(req)
	s.Require().NoError(err)
	defer resp.Body.Close()

	s.Equal(http.StatusNoContent, resp.StatusCode)

	// Verify status changed back
	err = s.db.First(&updatedDownload, "id = ?", download.ID).Error
	s.Require().NoError(err)
	s.Equal(models.StatusDownloading, updatedDownload.Status)
}

func (s *IntegrationTestSuite) TestCancelDownload() {
	// Create a download
	download := &models.Download{
		UserID: "test-user-1",
		GameID: "game-1",
		Status: models.StatusDownloading,
	}
	err := s.db.Create(download).Error
	s.Require().NoError(err)

	// Cancel the download
	req, _ := http.NewRequest(http.MethodDelete, s.server.URL+"/api/downloads/"+download.ID, nil)
	req.Header.Set("X-Test-User-ID", "test-user-1")

	client := &http.Client{}
	resp, err := client.Do(req)
	s.Require().NoError(err)
	defer resp.Body.Close()

	s.Equal(http.StatusNoContent, resp.StatusCode)

	// Verify status changed
	var updatedDownload models.Download
	err = s.db.First(&updatedDownload, "id = ?", download.ID).Error
	s.Require().NoError(err)
	s.Equal(models.StatusCancelled, updatedDownload.Status)
}

func (s *IntegrationTestSuite) TestListUserDownloads() {
	// Create multiple downloads for user
	downloads := []models.Download{
		{UserID: "test-user-1", GameID: "game-1", Status: models.StatusDownloading},
		{UserID: "test-user-1", GameID: "game-2", Status: models.StatusCompleted},
		{UserID: "test-user-2", GameID: "game-3", Status: models.StatusDownloading}, // Different user
	}

	for i := range downloads {
		err := s.db.Create(&downloads[i]).Error
		s.Require().NoError(err)
	}

	// List downloads for test-user-1
	req, _ := http.NewRequest(http.MethodGet, s.server.URL+"/api/users/test-user-1/downloads", nil)
	req.Header.Set("X-Test-User-ID", "test-user-1")

	client := &http.Client{}
	resp, err := client.Do(req)
	s.Require().NoError(err)
	defer resp.Body.Close()

	s.Equal(http.StatusOK, resp.StatusCode)

	var result map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&result)
	s.Require().NoError(err)

	downloadsData := result["downloads"].([]interface{})
	s.Len(downloadsData, 2) // Only downloads for test-user-1
}

func (s *IntegrationTestSuite) TestAccessControl() {
	// Create a download for user-1
	download := &models.Download{
		UserID: "test-user-1",
		GameID: "game-1",
		Status: models.StatusDownloading,
	}
	err := s.db.Create(download).Error
	s.Require().NoError(err)

	// Try to access with user-2 (should fail)
	req, _ := http.NewRequest(http.MethodGet, s.server.URL+"/api/downloads/"+download.ID, nil)
	req.Header.Set("X-Test-User-ID", "test-user-2")

	client := &http.Client{}
	resp, err := client.Do(req)
	s.Require().NoError(err)
	defer resp.Body.Close()

	s.Equal(http.StatusForbidden, resp.StatusCode)
}

func (s *IntegrationTestSuite) TestConcurrentDownloadOperations() {
	const numGoroutines = 10
	const operationsPerGoroutine = 5

	var wg sync.WaitGroup
	errors := make(chan error, numGoroutines*operationsPerGoroutine)
	downloadIDs := make(chan string, numGoroutines*operationsPerGoroutine)

	// Concurrent download creation
	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(goroutineID int) {
			defer wg.Done()
			client := &http.Client{}

			for j := 0; j < operationsPerGoroutine; j++ {
				payload := map[string]string{
					"gameId": fmt.Sprintf("game-%d", (goroutineID%3)+1), // Use games 1-3
				}
				body, _ := json.Marshal(payload)

				req, _ := http.NewRequest(http.MethodPost, s.server.URL+"/api/downloads", bytes.NewReader(body))
				req.Header.Set("Content-Type", "application/json")
				req.Header.Set("X-Test-User-ID", "test-user-1")

				resp, err := client.Do(req)
				if err != nil {
					errors <- err
					return
				}
				defer resp.Body.Close()

				if resp.StatusCode != http.StatusCreated {
					errors <- fmt.Errorf("unexpected status code: %d", resp.StatusCode)
					return
				}

				var result map[string]interface{}
				if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
					errors <- err
					return
				}

				downloadIDs <- result["id"].(string)
			}
		}(i)
	}

	wg.Wait()
	close(errors)
	close(downloadIDs)

	// Check for errors
	for err := range errors {
		s.T().Errorf("Concurrent operation failed: %v", err)
	}

	// Verify all downloads were created
	downloadCount := 0
	for range downloadIDs {
		downloadCount++
	}

	expected := numGoroutines * operationsPerGoroutine
	s.Equal(expected, downloadCount)
}

func (s *IntegrationTestSuite) TestRateLimiting() {
	// This test would require actual rate limiting middleware
	// For now, we'll test that multiple rapid requests don't break the system
	const numRequests = 20
	var wg sync.WaitGroup
	successCount := int32(0)

	for i := 0; i < numRequests; i++ {
		wg.Add(1)
		go func(requestID int) {
			defer wg.Done()
			
			payload := map[string]string{
				"gameId": "game-1",
			}
			body, _ := json.Marshal(payload)

			req, _ := http.NewRequest(http.MethodPost, s.server.URL+"/api/downloads", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("X-Test-User-ID", "test-user-1")

			client := &http.Client{Timeout: 5 * time.Second}
			resp, err := client.Do(req)
			if err == nil {
				defer resp.Body.Close()
				if resp.StatusCode == http.StatusCreated {
					atomic.AddInt32(&successCount, 1)
				}
			}
		}(i)
	}

	wg.Wait()

	// All requests should succeed (no rate limiting in test)
	s.Equal(int32(numRequests), successCount)
}

func (s *IntegrationTestSuite) TestDatabaseTransactions() {
	// Test that failed operations don't leave partial data
	payload := map[string]string{
		"gameId": "invalid-game-id", // This should fail validation
	}
	body, _ := json.Marshal(payload)

	req, _ := http.NewRequest(http.MethodPost, s.server.URL+"/api/downloads", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Test-User-ID", "test-user-1")

	client := &http.Client{}
	resp, err := client.Do(req)
	s.Require().NoError(err)
	defer resp.Body.Close()

	// Should fail due to game ownership check
	s.Equal(http.StatusForbidden, resp.StatusCode)

	// Verify no partial data was created
	var count int64
	err = s.db.Model(&models.Download{}).Where("user_id = ? AND game_id = ?", "test-user-1", "invalid-game-id").Count(&count).Error
	s.Require().NoError(err)
	s.Equal(int64(0), count)
}

func TestIntegrationTestSuite(t *testing.T) {
	suite.Run(t, new(IntegrationTestSuite))
}