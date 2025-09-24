package services

import (
	"context"
	"errors"
	"testing"
	"time"

	"download-service/internal/clients/library"
	derr "download-service/internal/errors"
	"download-service/internal/models"
	"download-service/pkg/logger"
	"github.com/stretchr/testify/suite"
)

type LibraryIntegrationTestSuite struct {
	suite.Suite
	repo         *memDownloadRepo
	stream       *StreamService
	mockLibrary  *library.MockClient
	svc          *DownloadService
}

func (s *LibraryIntegrationTestSuite) SetupTest() {
	s.repo = newMemDownloadRepo()
	s.stream = NewStreamService()
	s.mockLibrary = library.NewMockClient()
	
	// Wrap with instrumentation
	instrumentedLibrary := library.NewInstrumentedClient(s.mockLibrary, logger.New())
	
	s.svc = NewDownloadService(nil, nil, s.repo, s.stream, instrumentedLibrary, logger.New())
	s.svc.defaultTotalSize = 1024 * 1024 // 1MB for faster tests
	s.svc.defaultSpeed = 1024 * 1024     // 1MB/s for faster tests
}

func (s *LibraryIntegrationTestSuite) TestStartDownload_OwnershipCheckSuccess() {
	userID := "user-123"
	gameID := "game-456"
	
	// Setup: User owns the game
	s.mockLibrary.SetUserGames(userID, []string{gameID, "other-game"})

	download, err := s.svc.StartDownload(context.Background(), userID, gameID)
	
	s.Require().NoError(err)
	s.Require().NotNil(download)
	s.Equal(userID, download.UserID)
	s.Equal(gameID, download.GameID)
	s.Equal(models.StatusDownloading, download.Status)
}

func (s *LibraryIntegrationTestSuite) TestStartDownload_OwnershipCheckDenied() {
	userID := "user-123"
	gameID := "game-456"
	
	// Setup: User does NOT own the game
	s.mockLibrary.SetUserGames(userID, []string{"other-game-1", "other-game-2"})

	download, err := s.svc.StartDownload(context.Background(), userID, gameID)
	
	s.Require().Error(err)
	s.Require().Nil(download)
	
	var accessErr derr.AccessDeniedError
	s.Require().True(errors.As(err, &accessErr))
}

func (s *LibraryIntegrationTestSuite) TestStartDownload_LibraryServiceUnavailable() {
	userID := "user-123"
	gameID := "game-456"
	
	// Setup: Library service returns error
	s.mockLibrary.SetError("CheckOwnership", errors.New("service unavailable"))

	download, err := s.svc.StartDownload(context.Background(), userID, gameID)
	
	s.Require().Error(err)
	s.Require().Nil(download)
	s.Contains(err.Error(), "service unavailable")
}

func (s *LibraryIntegrationTestSuite) TestStartDownload_LibraryServiceCircuitOpen() {
	userID := "user-123"
	gameID := "game-456"
	
	// Setup: Circuit breaker is open
	s.mockLibrary.SetError("CheckOwnership", errors.New("library client: circuit open"))

	download, err := s.svc.StartDownload(context.Background(), userID, gameID)
	
	s.Require().Error(err)
	s.Require().Nil(download)
	s.Contains(err.Error(), "circuit open")
}

func (s *LibraryIntegrationTestSuite) TestStartDownload_LibraryServiceTimeout() {
	userID := "user-123"
	gameID := "game-456"
	
	// Setup: Library service timeout
	s.mockLibrary.SetError("CheckOwnership", context.DeadlineExceeded)

	download, err := s.svc.StartDownload(context.Background(), userID, gameID)
	
	s.Require().Error(err)
	s.Require().Nil(download)
	s.Equal(context.DeadlineExceeded, err)
}

func (s *LibraryIntegrationTestSuite) TestListUserLibraryGames_Success() {
	userID := "user-123"
	expectedGames := []string{"game-1", "game-2", "game-3"}
	
	// Setup: User has games in library
	s.mockLibrary.SetUserGames(userID, expectedGames)

	games, err := s.svc.ListUserLibraryGames(context.Background(), userID)
	
	s.Require().NoError(err)
	s.Equal(expectedGames, games)
}

func (s *LibraryIntegrationTestSuite) TestListUserLibraryGames_EmptyLibrary() {
	userID := "user-123"
	
	// Setup: User has no games
	s.mockLibrary.SetUserGames(userID, []string{})

	games, err := s.svc.ListUserLibraryGames(context.Background(), userID)
	
	s.Require().NoError(err)
	s.Empty(games)
}

func (s *LibraryIntegrationTestSuite) TestListUserLibraryGames_ServiceError() {
	userID := "user-123"
	
	// Setup: Library service error
	s.mockLibrary.SetError("ListUserGames", errors.New("database connection failed"))

	games, err := s.svc.ListUserLibraryGames(context.Background(), userID)
	
	s.Require().Error(err)
	s.Require().Nil(games)
	s.Contains(err.Error(), "database connection failed")
}

func (s *LibraryIntegrationTestSuite) TestMultipleDownloads_OwnershipChecks() {
	userID := "user-123"
	ownedGames := []string{"game-1", "game-2", "game-3"}
	notOwnedGame := "game-4"
	
	// Setup: User owns some games but not others
	s.mockLibrary.SetUserGames(userID, ownedGames)

	// Test downloading owned games - should succeed
	for _, gameID := range ownedGames {
		download, err := s.svc.StartDownload(context.Background(), userID, gameID)
		s.Require().NoError(err, "Failed to start download for owned game %s", gameID)
		s.Equal(gameID, download.GameID)
	}

	// Test downloading not owned game - should fail
	download, err := s.svc.StartDownload(context.Background(), userID, notOwnedGame)
	s.Require().Error(err)
	s.Require().Nil(download)
	
	var accessErr derr.AccessDeniedError
	s.Require().True(errors.As(err, &accessErr))
}

func (s *LibraryIntegrationTestSuite) TestConcurrentOwnershipChecks() {
	const numGoroutines = 10
	const downloadsPerGoroutine = 5
	
	userID := "concurrent-user"
	ownedGames := make([]string, numGoroutines*downloadsPerGoroutine)
	for i := range ownedGames {
		ownedGames[i] = "game-" + string(rune('a'+i))
	}
	
	// Setup: User owns all games
	s.mockLibrary.SetUserGames(userID, ownedGames)

	type result struct {
		gameID string
		err    error
	}
	results := make(chan result, numGoroutines*downloadsPerGoroutine)

	// Start concurrent downloads
	for i := 0; i < numGoroutines; i++ {
		go func(goroutineID int) {
			for j := 0; j < downloadsPerGoroutine; j++ {
				gameIndex := goroutineID*downloadsPerGoroutine + j
				gameID := ownedGames[gameIndex]
				
				_, err := s.svc.StartDownload(context.Background(), userID, gameID)
				results <- result{gameID: gameID, err: err}
			}
		}(i)
	}

	// Collect results
	successCount := 0
	for i := 0; i < numGoroutines*downloadsPerGoroutine; i++ {
		res := <-results
		if res.err == nil {
			successCount++
		} else {
			s.T().Errorf("Download failed for game %s: %v", res.gameID, res.err)
		}
	}

	s.Equal(numGoroutines*downloadsPerGoroutine, successCount)
}

func (s *LibraryIntegrationTestSuite) TestLibraryServiceRecovery() {
	userID := "user-123"
	gameID := "game-456"
	
	// Setup: User owns the game
	s.mockLibrary.SetUserGames(userID, []string{gameID})
	
	// First, simulate service failure
	s.mockLibrary.SetError("CheckOwnership", errors.New("service temporarily unavailable"))
	
	_, err := s.svc.StartDownload(context.Background(), userID, gameID)
	s.Require().Error(err)
	
	// Then, simulate service recovery
	s.mockLibrary.ClearErrors()
	
	download, err := s.svc.StartDownload(context.Background(), userID, gameID)
	s.Require().NoError(err)
	s.Require().NotNil(download)
	s.Equal(gameID, download.GameID)
}

func (s *LibraryIntegrationTestSuite) TestLibraryServiceRetryBehavior() {
	userID := "user-123"
	gameID := "game-456"
	
	// Setup: User owns the game
	s.mockLibrary.SetUserGames(userID, []string{gameID})
	
	// First, simulate service failure multiple times
	s.mockLibrary.SetError("CheckOwnership", errors.New("temporary network error"))
	
	_, err := s.svc.StartDownload(context.Background(), userID, gameID)
	s.Require().Error(err)
	s.Contains(err.Error(), "temporary network error")
	
	// Then, simulate service recovery
	s.mockLibrary.ClearErrors()
	
	download, err := s.svc.StartDownload(context.Background(), userID, gameID)
	s.Require().NoError(err)
	s.Require().NotNil(download)
	s.Equal(gameID, download.GameID)
}

func (s *LibraryIntegrationTestSuite) TestLibraryServicePerformance() {
	userID := "perf-user"
	gameID := "perf-game"
	
	// Setup: User owns the game
	s.mockLibrary.SetUserGames(userID, []string{gameID})

	// Measure performance of ownership checks
	const numChecks = 100
	start := time.Now()
	
	for i := 0; i < numChecks; i++ {
		_, err := s.svc.StartDownload(context.Background(), userID, gameID)
		s.Require().NoError(err)
	}
	
	duration := time.Since(start)
	avgDuration := duration / numChecks
	
	s.T().Logf("Average download start time (including ownership check): %v", avgDuration)
	
	// Performance assertion - should be reasonably fast
	s.Less(avgDuration, 10*time.Millisecond, "Download start should be fast")
}

func (s *LibraryIntegrationTestSuite) TestContextCancellation() {
	userID := "user-123"
	gameID := "game-456"
	
	// Setup: User owns the game
	s.mockLibrary.SetUserGames(userID, []string{gameID})
	
	// Create a context that will be cancelled
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately
	
	_, err := s.svc.StartDownload(ctx, userID, gameID)
	
	// Should handle context cancellation gracefully
	s.Require().Error(err)
	s.True(errors.Is(err, context.Canceled) || 
		   errors.Is(err, context.DeadlineExceeded) ||
		   err.Error() == "context canceled", 
		   "Expected context cancellation error, got: %v", err)
}

func TestLibraryIntegrationTestSuite(t *testing.T) {
	suite.Run(t, new(LibraryIntegrationTestSuite))
}