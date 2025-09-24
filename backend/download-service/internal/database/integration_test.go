// +build integration

package database

import (
	"os"
	"testing"

	"download-service/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestDatabaseIntegration tests the database with a real PostgreSQL instance
// Run with: go test -tags=integration ./internal/database
func TestDatabaseIntegration(t *testing.T) {
	// Get database URL from environment
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://postgres:postgres@localhost:5432/downloads?sslmode=disable"
	}

	// Connect to database
	db, err := Connect(Options{DSN: dsn})
	if err != nil {
		t.Skipf("Could not connect to PostgreSQL: %v", err)
	}

	// Test health check
	err = HealthCheck(db)
	require.NoError(t, err)

	// Test creating a download
	download := &models.Download{
		UserID:         "integration-user-123",
		GameID:         "integration-game-456",
		Status:         models.StatusPending,
		Progress:       0,
		TotalSize:      1000000,
		DownloadedSize: 0,
		Speed:          0,
	}

	err = db.Create(download).Error
	require.NoError(t, err)
	assert.NotEmpty(t, download.ID)

	// Test creating a download file
	downloadFile := &models.DownloadFile{
		DownloadID:     download.ID,
		FileName:       "integration-test.exe",
		FilePath:       "/tmp/integration-test.exe",
		FileSize:       500000,
		DownloadedSize: 0,
		Status:         models.StatusPending,
	}

	err = db.Create(downloadFile).Error
	require.NoError(t, err)
	assert.NotEmpty(t, downloadFile.ID)

	// Test querying with relationships
	var foundDownload models.Download
	err = db.Preload("Files").First(&foundDownload, "id = ?", download.ID).Error
	require.NoError(t, err)
	assert.Len(t, foundDownload.Files, 1)
	assert.Equal(t, downloadFile.FileName, foundDownload.Files[0].FileName)

	// Test indexes work (query by user_id and status)
	var userDownloads []models.Download
	err = db.Where("user_id = ? AND status = ?", download.UserID, models.StatusPending).Find(&userDownloads).Error
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(userDownloads), 1)

	// Cleanup
	db.Delete(&downloadFile)
	db.Delete(&download)
}