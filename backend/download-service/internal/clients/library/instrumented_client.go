package library

import (
	"context"
	"time"

	"download-service/internal/observability"
	"download-service/pkg/logger"
)

// InstrumentedClient wraps the Library Service client with logging and monitoring
type InstrumentedClient struct {
	client Interface
	logger logger.Logger
}

// NewInstrumentedClient creates a new instrumented library client
func NewInstrumentedClient(client Interface, logger logger.Logger) *InstrumentedClient {
	return &InstrumentedClient{
		client: client,
		logger: logger,
	}
}

// CheckOwnership checks whether user owns the game with logging and monitoring
func (ic *InstrumentedClient) CheckOwnership(ctx context.Context, userID, gameID string) (bool, error) {
	start := time.Now()
	method := "CheckOwnership"
	
	logger.Info(ic.logger, "checking game ownership", 
		"method", method,
		"userID", userID, 
		"gameID", gameID)

	owned, err := ic.client.CheckOwnership(ctx, userID, gameID)
	duration := time.Since(start)

	if err != nil {
		status := "error"
		if isCircuitOpenError(err) {
			status = "circuit_open"
			observability.SetLibraryCircuitBreakerState(true)
		}
		
		observability.RecordLibraryRequest(method, status, duration)
		logger.Error(ic.logger, "library service ownership check failed",
			"method", method,
			"userID", userID,
			"gameID", gameID,
			"error", err,
			"duration_ms", duration.Milliseconds())
		return false, err
	}

	observability.RecordLibraryRequest(method, "success", duration)
	observability.SetLibraryCircuitBreakerState(false)
	
	logger.Info(ic.logger, "library service ownership check completed",
		"method", method,
		"userID", userID,
		"gameID", gameID,
		"owned", owned,
		"duration_ms", duration.Milliseconds())

	return owned, nil
}

// ListUserGames returns list of game IDs owned by the user with logging and monitoring
func (ic *InstrumentedClient) ListUserGames(ctx context.Context, userID string) ([]string, error) {
	start := time.Now()
	method := "ListUserGames"
	
	logger.Info(ic.logger, "listing user games", 
		"method", method,
		"userID", userID)

	games, err := ic.client.ListUserGames(ctx, userID)
	duration := time.Since(start)

	if err != nil {
		status := "error"
		if isCircuitOpenError(err) {
			status = "circuit_open"
			observability.SetLibraryCircuitBreakerState(true)
		}
		
		observability.RecordLibraryRequest(method, status, duration)
		logger.Error(ic.logger, "library service list games failed",
			"method", method,
			"userID", userID,
			"error", err,
			"duration_ms", duration.Milliseconds())
		return nil, err
	}

	observability.RecordLibraryRequest(method, "success", duration)
	observability.SetLibraryCircuitBreakerState(false)
	
	logger.Info(ic.logger, "library service list games completed",
		"method", method,
		"userID", userID,
		"gameCount", len(games),
		"duration_ms", duration.Milliseconds())

	return games, nil
}

// isCircuitOpenError checks if the error indicates circuit breaker is open
func isCircuitOpenError(err error) bool {
	return err != nil && err.Error() == "library client: circuit open"
}