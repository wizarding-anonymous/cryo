package handlers

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"download-service/internal/clients/library"
	"download-service/internal/models"
	"download-service/internal/repository"
	"download-service/internal/services"
	"download-service/pkg/logger"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/suite"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type LibraryE2ETestSuite struct {
	suite.Suite
	app           *gin.Engine
	db            *gorm.DB
	mockLibrary   *library.MockClient
	server        *httptest.Server
}

func (s *LibraryE2ETestSuite) SetupSuite() {
	// Setup in-memory SQLite database
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	s.Require().NoError(err)
	s.db = db

	// Auto-migrate tables
	err = db.AutoMigrate(&models.Download{}, &models.DownloadFile{})
	s.Require().NoError(err)

	// Setup mock library client
	s.mockLibrary = library.NewMockClient()
	
	// Setup test data
	s.mockLibrary.SetUserGames("test-user-1", []string{"game-1", "game-2", "game-3"})
	s.mockLibrary.SetUserGames("test-user-2", []string{"game-2", "game-4"})

	// Setup dependencies
	log := logger.New()
	instrumentedLibrary := library.NewInstrumentedClient(s.mockLibrary, log)

	// Repositories
	downloadRepo := repository.NewDownloadRepository(db)

	// Services
	streamService := services.NewStreamService()
	downloadService := services.NewDownloadService(db, nil, downloadRepo, streamService, instrumentedLibrary, log)

	// Setup Gin
	gin.SetMode(gin.TestMode)
	s.app = gin.New()

	// Add test middleware for authentication
	s.app.Use(func(c *gin.Context) {
		if userID := c.GetHeader("X-Test-User-ID"); userID != "" {
			c.Set("auth_user_id", userID)
		}
		c.Next()
	})

	// Setup handlers
	downloadHandler := NewDownloadHandler(downloadService, nil)
	healthHandler := NewHealthHandler(db, nil, log)

	// Setup routes
	api := s.app.Group("/api")
	{
		api.POST("/downloads", downloadHandler.startDownload)
		api.GET("/downloads/:id", downloadHandler.getDownload)
		api.PATCH("/downloads/:id/pause", downloadHandler.pauseDownload)
		api.PATCH("/downloads/:id/resume", downloadHandler.resumeDownload)
		api.DELETE("/downloads/:id", downloadHandler.cancelDownload)
		api.GET("/users/:userId/downloads", downloadHandler.listUserDownloads)
		api.GET("/users/:userId/library/games", downloadHandler.listUserLibraryGames)
	}

	s.app.GET("/health", healthHandler.SimpleHealth)

	// Start test server
	s.server = httptest.NewServer(s.app)
}

func (s *LibraryE2ETestSuite) TearDownSuite() {
	if s.server != nil {
		s.server.Close()
	}
}

func (s *LibraryE2ETestSuite) SetupTest() {
	// Clean up test data before each test
	s.db.Exec("DELETE FROM download_files")
	s.db.Exec("DELETE FROM downloads")
	
	// Reset mock library state
	s.mockLibrary.ClearErrors()
}

func (s *LibraryE2ETestSuite) TestStartDownload_WithLibraryOwnershipCheck_Success() {
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
	s.Equal("test-user-1", result["userId"])
	s.Equal("downloading", result["status"])
}

func (s *LibraryE2ETestSuite) TestStartDownload_WithLibraryOwnershipCheck_AccessDenied() {
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

	var result map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&result)
	s.Require().NoError(err)
	s.Contains(result["error"], "access denied")
}

func (s *LibraryE2ETestSuite) TestStartDownload_LibraryServiceUnavailable() {
	// Simulate library service failure
	s.mockLibrary.SetError("CheckOwnership", errors.New("service unavailable"))

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

	s.Equal(http.StatusInternalServerError, resp.StatusCode)

	var result map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&result)
	s.Require().NoError(err)
	s.Contains(result["error"], "service unavailable")
}

func (s *LibraryE2ETestSuite) TestStartDownload_LibraryCircuitBreakerOpen() {
	// Simulate circuit breaker open
	s.mockLibrary.SetError("CheckOwnership", errors.New("library client: circuit open"))

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

	s.Equal(http.StatusServiceUnavailable, resp.StatusCode)

	var result map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&result)
	s.Require().NoError(err)
	s.Contains(result["error"], "circuit open")
}

func (s *LibraryE2ETestSuite) TestListUserLibraryGames_Success() {
	req, _ := http.NewRequest(http.MethodGet, s.server.URL+"/api/users/test-user-1/library/games", nil)
	req.Header.Set("X-Test-User-ID", "test-user-1")

	client := &http.Client{}
	resp, err := client.Do(req)
	s.Require().NoError(err)
	defer resp.Body.Close()

	s.Equal(http.StatusOK, resp.StatusCode)

	var result map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&result)
	s.Require().NoError(err)

	games := result["games"].([]interface{})
	s.Len(games, 3)
	
	gameIDs := make([]string, len(games))
	for i, game := range games {
		gameIDs[i] = game.(string)
	}
	s.Contains(gameIDs, "game-1")
	s.Contains(gameIDs, "game-2")
	s.Contains(gameIDs, "game-3")
}

func (s *LibraryE2ETestSuite) TestListUserLibraryGames_ServiceError() {
	// Simulate library service error
	s.mockLibrary.SetError("ListUserGames", errors.New("database connection failed"))

	req, _ := http.NewRequest(http.MethodGet, s.server.URL+"/api/users/test-user-1/library/games", nil)
	req.Header.Set("X-Test-User-ID", "test-user-1")

	client := &http.Client{}
	resp, err := client.Do(req)
	s.Require().NoError(err)
	defer resp.Body.Close()

	s.Equal(http.StatusInternalServerError, resp.StatusCode)

	var result map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&result)
	s.Require().NoError(err)
	s.Contains(result["error"], "database connection failed")
}

func (s *LibraryE2ETestSuite) TestMultipleUsersOwnershipChecks() {
	// Test that different users can only download their own games
	testCases := []struct {
		userID         string
		gameID         string
		expectedStatus int
	}{
		{"test-user-1", "game-1", http.StatusCreated},   // User 1 owns game 1
		{"test-user-1", "game-2", http.StatusCreated},   // User 1 owns game 2
		{"test-user-1", "game-4", http.StatusForbidden}, // User 1 doesn't own game 4
		{"test-user-2", "game-2", http.StatusCreated},   // User 2 owns game 2
		{"test-user-2", "game-4", http.StatusCreated},   // User 2 owns game 4
		{"test-user-2", "game-1", http.StatusForbidden}, // User 2 doesn't own game 1
	}

	for _, tc := range testCases {
		s.T().Run("User_"+tc.userID+"_Game_"+tc.gameID, func(t *testing.T) {
			payload := map[string]string{
				"gameId": tc.gameID,
			}
			body, _ := json.Marshal(payload)

			req, _ := http.NewRequest(http.MethodPost, s.server.URL+"/api/downloads", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("X-Test-User-ID", tc.userID)

			client := &http.Client{}
			resp, err := client.Do(req)
			s.Require().NoError(err)
			defer resp.Body.Close()

			s.Equal(tc.expectedStatus, resp.StatusCode)
		})
	}
}

func (s *LibraryE2ETestSuite) TestLibraryServiceRecoveryScenario() {
	payload := map[string]string{
		"gameId": "game-1",
	}
	body, _ := json.Marshal(payload)

	// First request - simulate service failure
	s.mockLibrary.SetError("CheckOwnership", errors.New("temporary service failure"))

	req1, _ := http.NewRequest(http.MethodPost, s.server.URL+"/api/downloads", bytes.NewReader(body))
	req1.Header.Set("Content-Type", "application/json")
	req1.Header.Set("X-Test-User-ID", "test-user-1")

	client := &http.Client{}
	resp1, err := client.Do(req1)
	s.Require().NoError(err)
	defer resp1.Body.Close()

	s.Equal(http.StatusInternalServerError, resp1.StatusCode)

	// Second request - simulate service recovery
	s.mockLibrary.ClearErrors()

	req2, _ := http.NewRequest(http.MethodPost, s.server.URL+"/api/downloads", bytes.NewReader(body))
	req2.Header.Set("Content-Type", "application/json")
	req2.Header.Set("X-Test-User-ID", "test-user-1")

	resp2, err := client.Do(req2)
	s.Require().NoError(err)
	defer resp2.Body.Close()

	s.Equal(http.StatusCreated, resp2.StatusCode)

	var result map[string]interface{}
	err = json.NewDecoder(resp2.Body).Decode(&result)
	s.Require().NoError(err)
	s.Equal("game-1", result["gameId"])
}

func (s *LibraryE2ETestSuite) TestConcurrentDownloadRequests() {
	const numGoroutines = 5
	const requestsPerGoroutine = 3

	type requestResult struct {
		userID     string
		gameID     string
		statusCode int
		err        error
	}

	results := make(chan requestResult, numGoroutines*requestsPerGoroutine)

	// Launch concurrent requests
	for i := 0; i < numGoroutines; i++ {
		go func(goroutineID int) {
			client := &http.Client{Timeout: 5 * time.Second}
			
			for j := 0; j < requestsPerGoroutine; j++ {
				userID := "test-user-1"
				gameID := "game-1" // All requests for the same game
				
				payload := map[string]string{
					"gameId": gameID,
				}
				body, _ := json.Marshal(payload)

				req, _ := http.NewRequest(http.MethodPost, s.server.URL+"/api/downloads", bytes.NewReader(body))
				req.Header.Set("Content-Type", "application/json")
				req.Header.Set("X-Test-User-ID", userID)

				resp, err := client.Do(req)
				statusCode := 0
				if resp != nil {
					statusCode = resp.StatusCode
					resp.Body.Close()
				}

				results <- requestResult{
					userID:     userID,
					gameID:     gameID,
					statusCode: statusCode,
					err:        err,
				}
			}
		}(i)
	}

	// Collect results
	successCount := 0
	errorCount := 0
	
	for i := 0; i < numGoroutines*requestsPerGoroutine; i++ {
		result := <-results
		if result.err != nil {
			errorCount++
			s.T().Logf("Request error: %v", result.err)
		} else if result.statusCode == http.StatusCreated {
			successCount++
		} else {
			s.T().Logf("Unexpected status code: %d", result.statusCode)
		}
	}

	s.T().Logf("Concurrent requests: %d success, %d errors", successCount, errorCount)
	
	// All requests should succeed since user owns the game
	s.Equal(numGoroutines*requestsPerGoroutine, successCount)
	s.Equal(0, errorCount)
}

func (s *LibraryE2ETestSuite) TestHealthCheckWithLibraryDependency() {
	// Health check should work even if library service is down
	s.mockLibrary.SetError("CheckOwnership", errors.New("service down"))

	req, _ := http.NewRequest(http.MethodGet, s.server.URL+"/health", nil)

	client := &http.Client{}
	resp, err := client.Do(req)
	s.Require().NoError(err)
	defer resp.Body.Close()

	// Health check should still pass (it doesn't depend on library service)
	s.Equal(http.StatusOK, resp.StatusCode)
}

func TestLibraryE2ETestSuite(t *testing.T) {
	suite.Run(t, new(LibraryE2ETestSuite))
}