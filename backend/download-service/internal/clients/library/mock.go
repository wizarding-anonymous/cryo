package library

import (
	"context"
)

// MockClient implements Interface for testing
type MockClient struct {
	OwnedGames map[string][]string // userID -> []gameID
	Errors     map[string]error    // operation -> error to return
}

func NewMockClient() *MockClient {
	return &MockClient{
		OwnedGames: make(map[string][]string),
		Errors:     make(map[string]error),
	}
}

func (m *MockClient) CheckOwnership(ctx context.Context, userID, gameID string) (bool, error) {
	// Check if context is cancelled
	select {
	case <-ctx.Done():
		return false, ctx.Err()
	default:
	}

	if err, exists := m.Errors["CheckOwnership"]; exists {
		return false, err
	}

	games, exists := m.OwnedGames[userID]
	if !exists {
		return false, nil
	}

	for _, ownedGameID := range games {
		if ownedGameID == gameID {
			return true, nil
		}
	}

	return false, nil
}

func (m *MockClient) ListUserGames(ctx context.Context, userID string) ([]string, error) {
	// Check if context is cancelled
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	if err, exists := m.Errors["ListUserGames"]; exists {
		return nil, err
	}

	games, exists := m.OwnedGames[userID]
	if !exists {
		return []string{}, nil
	}

	// Return a copy to avoid external modifications
	result := make([]string, len(games))
	copy(result, games)
	return result, nil
}

// Helper methods for testing

func (m *MockClient) SetUserGames(userID string, gameIDs []string) {
	m.OwnedGames[userID] = gameIDs
}

func (m *MockClient) AddUserGame(userID, gameID string) {
	if m.OwnedGames[userID] == nil {
		m.OwnedGames[userID] = []string{}
	}
	m.OwnedGames[userID] = append(m.OwnedGames[userID], gameID)
}

func (m *MockClient) SetError(operation string, err error) {
	m.Errors[operation] = err
}

func (m *MockClient) ClearErrors() {
	m.Errors = make(map[string]error)
}

func (m *MockClient) Reset() {
	m.OwnedGames = make(map[string][]string)
	m.Errors = make(map[string]error)
}