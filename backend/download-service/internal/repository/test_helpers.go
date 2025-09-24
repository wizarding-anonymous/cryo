package repository

import (
	"testing"

	"download-service/internal/models"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// setupTestDB creates an in-memory SQLite database for testing.
// It skips the test if CGO is not available (SQLite requires CGO).
func setupTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	// Try to create SQLite database
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		// Check if this is the CGO error
		if err.Error() == "Binary was compiled with 'CGO_ENABLED=0', go-sqlite3 requires cgo to work. This is a stub" {
			t.Skip("SQLite requires CGO, skipping database tests")
			return nil
		}
		// If it's a different error, fail the test
		require.NoError(t, err)
	}

	// Run migrations
	err = db.AutoMigrate(&models.Download{}, &models.DownloadFile{})
	require.NoError(t, err)

	return db
}

// requireCGO skips the test if CGO is not available
func requireCGO(t *testing.T) {
	t.Helper()
	
	// Try to create a simple SQLite connection to check CGO availability
	_, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil && err.Error() == "Binary was compiled with 'CGO_ENABLED=0', go-sqlite3 requires cgo to work. This is a stub" {
		t.Skip("SQLite requires CGO, skipping database tests")
	}
}