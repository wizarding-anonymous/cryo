package library

import (
	"context"
	"errors"
	"testing"
	"time"

	"download-service/pkg/logger"
	"github.com/stretchr/testify/require"
)

func TestInstrumentedClient_CheckOwnership_Success(t *testing.T) {
	mockClient := NewMockClient()
	mockClient.SetUserGames("user1", []string{"game1", "game2"})
	
	log := logger.New()
	instrumentedClient := NewInstrumentedClient(mockClient, log)

	owned, err := instrumentedClient.CheckOwnership(context.Background(), "user1", "game1")
	require.NoError(t, err)
	require.True(t, owned)
}

func TestInstrumentedClient_CheckOwnership_NotOwned(t *testing.T) {
	mockClient := NewMockClient()
	mockClient.SetUserGames("user1", []string{"game1", "game2"})
	
	log := logger.New()
	instrumentedClient := NewInstrumentedClient(mockClient, log)

	owned, err := instrumentedClient.CheckOwnership(context.Background(), "user1", "game3")
	require.NoError(t, err)
	require.False(t, owned)
}

func TestInstrumentedClient_CheckOwnership_Error(t *testing.T) {
	mockClient := NewMockClient()
	mockClient.SetError("CheckOwnership", errors.New("service unavailable"))
	
	log := logger.New()
	instrumentedClient := NewInstrumentedClient(mockClient, log)

	owned, err := instrumentedClient.CheckOwnership(context.Background(), "user1", "game1")
	require.Error(t, err)
	require.False(t, owned)
	require.Contains(t, err.Error(), "service unavailable")
}

func TestInstrumentedClient_CheckOwnership_CircuitOpen(t *testing.T) {
	mockClient := NewMockClient()
	mockClient.SetError("CheckOwnership", errors.New("library client: circuit open"))
	
	log := logger.New()
	instrumentedClient := NewInstrumentedClient(mockClient, log)

	owned, err := instrumentedClient.CheckOwnership(context.Background(), "user1", "game1")
	require.Error(t, err)
	require.False(t, owned)
	require.Contains(t, err.Error(), "circuit open")
}

func TestInstrumentedClient_ListUserGames_Success(t *testing.T) {
	mockClient := NewMockClient()
	expectedGames := []string{"game1", "game2", "game3"}
	mockClient.SetUserGames("user1", expectedGames)
	
	log := logger.New()
	instrumentedClient := NewInstrumentedClient(mockClient, log)

	games, err := instrumentedClient.ListUserGames(context.Background(), "user1")
	require.NoError(t, err)
	require.Equal(t, expectedGames, games)
}

func TestInstrumentedClient_ListUserGames_Error(t *testing.T) {
	mockClient := NewMockClient()
	mockClient.SetError("ListUserGames", errors.New("database connection failed"))
	
	log := logger.New()
	instrumentedClient := NewInstrumentedClient(mockClient, log)

	games, err := instrumentedClient.ListUserGames(context.Background(), "user1")
	require.Error(t, err)
	require.Nil(t, games)
	require.Contains(t, err.Error(), "database connection failed")
}

func TestInstrumentedClient_ListUserGames_CircuitOpen(t *testing.T) {
	mockClient := NewMockClient()
	mockClient.SetError("ListUserGames", errors.New("library client: circuit open"))
	
	log := logger.New()
	instrumentedClient := NewInstrumentedClient(mockClient, log)

	games, err := instrumentedClient.ListUserGames(context.Background(), "user1")
	require.Error(t, err)
	require.Nil(t, games)
	require.Contains(t, err.Error(), "circuit open")
}

func TestInstrumentedClient_Performance(t *testing.T) {
	mockClient := NewMockClient()
	mockClient.SetUserGames("user1", []string{"game1", "game2"})
	
	log := logger.New()
	instrumentedClient := NewInstrumentedClient(mockClient, log)

	// Test that instrumentation doesn't significantly impact performance
	start := time.Now()
	for i := 0; i < 100; i++ {
		_, err := instrumentedClient.CheckOwnership(context.Background(), "user1", "game1")
		require.NoError(t, err)
	}
	duration := time.Since(start)

	// Should complete 100 calls in reasonable time (less than 100ms)
	require.Less(t, duration, 100*time.Millisecond)
}

func TestInstrumentedClient_ConcurrentAccess(t *testing.T) {
	mockClient := NewMockClient()
	mockClient.SetUserGames("user1", []string{"game1", "game2"})
	
	log := logger.New()
	instrumentedClient := NewInstrumentedClient(mockClient, log)

	// Test concurrent access to instrumented client
	const numGoroutines = 10
	const callsPerGoroutine = 10
	
	done := make(chan bool, numGoroutines)
	errors := make(chan error, numGoroutines*callsPerGoroutine)

	for i := 0; i < numGoroutines; i++ {
		go func() {
			defer func() { done <- true }()
			for j := 0; j < callsPerGoroutine; j++ {
				_, err := instrumentedClient.CheckOwnership(context.Background(), "user1", "game1")
				if err != nil {
					errors <- err
				}
			}
		}()
	}

	// Wait for all goroutines to complete
	for i := 0; i < numGoroutines; i++ {
		<-done
	}
	close(errors)

	// Check that no errors occurred
	for err := range errors {
		t.Errorf("Concurrent access error: %v", err)
	}
}

func TestIsCircuitOpenError(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		expected bool
	}{
		{
			name:     "circuit open error",
			err:      errors.New("library client: circuit open"),
			expected: true,
		},
		{
			name:     "other error",
			err:      errors.New("connection timeout"),
			expected: false,
		},
		{
			name:     "nil error",
			err:      nil,
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isCircuitOpenError(tt.err)
			require.Equal(t, tt.expected, result)
		})
	}
}