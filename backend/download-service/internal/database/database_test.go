package database

import (
	"fmt"
	"os"
	"testing"
	"time"

	"download-service/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	// Get database configuration from environment variables
	host := getEnvOrDefault("DB_HOST", "localhost")
	port := getEnvOrDefault("DB_PORT", "5432")
	user := getEnvOrDefault("DB_USER", "testuser")
	password := getEnvOrDefault("DB_PASSWORD", "testpass")
	dbname := getEnvOrDefault("DB_NAME", "testdb")
	sslmode := getEnvOrDefault("DB_SSL_MODE", "disable")

	// Create DSN
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		host, port, user, password, dbname, sslmode)

	// Connect to database
	db, err := Connect(Options{DSN: dsn})
	require.NoError(t, err, "Failed to connect to test database")

	// Clean up tables before each test
	cleanupTables(t, db)

	return db
}

// cleanupTables removes all data from test tables
func cleanupTables(t *testing.T, db *gorm.DB) {
	t.Helper()

	// Delete in correct order due to foreign key constraints
	err := db.Exec("DELETE FROM download_files").Error
	require.NoError(t, err)

	err = db.Exec("DELETE FROM downloads").Error
	require.NoError(t, err)
}

// getEnvOrDefault returns environment variable value or default if not set
func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func TestConnect(t *testing.T) {
	tests := []struct {
		name    string
		opts    Options
		wantErr bool
	}{
		{
			name:    "empty DSN should fail",
			opts:    Options{DSN: ""},
			wantErr: true,
		},
		{
			name:    "invalid DSN should fail",
			opts:    Options{DSN: "invalid://dsn"},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := Connect(tt.opts)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestMigrate(t *testing.T) {
	db := setupTestDB(t)

	// Check if tables exist
	assert.True(t, db.Migrator().HasTable(&models.Download{}))
	assert.True(t, db.Migrator().HasTable(&models.DownloadFile{}))

	// Check if indexes exist
	assert.True(t, db.Migrator().HasIndex(&models.Download{}, "idx_downloads_user"))
	assert.True(t, db.Migrator().HasIndex(&models.Download{}, "idx_downloads_game"))
	assert.True(t, db.Migrator().HasIndex(&models.Download{}, "idx_downloads_status"))
	assert.True(t, db.Migrator().HasIndex(&models.DownloadFile{}, "idx_download_files_download"))
}

func TestHealthCheck(t *testing.T) {
	t.Run("nil database should fail", func(t *testing.T) {
		err := HealthCheck(nil)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "database connection is nil")
	})

	t.Run("valid database should pass", func(t *testing.T) {
		db := setupTestDB(t)
		err := HealthCheck(db)
		assert.NoError(t, err)
	})
}

func TestDownloadModel(t *testing.T) {
	db := setupTestDB(t)

	// Create a test download with valid UUIDs
	download := &models.Download{
		UserID:         "550e8400-e29b-41d4-a716-446655440001",
		GameID:         "550e8400-e29b-41d4-a716-446655440002",
		Status:         models.StatusPending,
		Progress:       0,
		TotalSize:      1000000,
		DownloadedSize: 0,
		Speed:          0,
	}

	// Test create
	err := db.Create(download).Error
	require.NoError(t, err)
	assert.NotEmpty(t, download.ID)
	assert.NotZero(t, download.CreatedAt)
	assert.NotZero(t, download.UpdatedAt)

	// Test read
	var found models.Download
	err = db.First(&found, "id = ?", download.ID).Error
	require.NoError(t, err)
	assert.Equal(t, download.UserID, found.UserID)
	assert.Equal(t, download.GameID, found.GameID)
	assert.Equal(t, download.Status, found.Status)

	// Test update
	found.Status = models.StatusDownloading
	found.Progress = 50
	err = db.Save(&found).Error
	require.NoError(t, err)

	// Verify update
	var updated models.Download
	err = db.First(&updated, "id = ?", download.ID).Error
	require.NoError(t, err)
	assert.Equal(t, models.StatusDownloading, updated.Status)
	assert.Equal(t, 50, updated.Progress)
	assert.True(t, updated.UpdatedAt.After(updated.CreatedAt))
}

func TestDownloadFileModel(t *testing.T) {
	db := setupTestDB(t)

	// Create a parent download first with valid UUIDs
	download := &models.Download{
		UserID:         "550e8400-e29b-41d4-a716-446655440001",
		GameID:         "550e8400-e29b-41d4-a716-446655440002",
		Status:         models.StatusPending,
		Progress:       0,
		TotalSize:      1000000,
		DownloadedSize: 0,
		Speed:          0,
	}
	err := db.Create(download).Error
	require.NoError(t, err)

	// Create a download file
	downloadFile := &models.DownloadFile{
		DownloadID:     download.ID,
		FileName:       "game.exe",
		FilePath:       "/downloads/game.exe",
		FileSize:       500000,
		DownloadedSize: 0,
		Status:         models.StatusPending,
	}

	// Test create
	err = db.Create(downloadFile).Error
	require.NoError(t, err)
	assert.NotEmpty(t, downloadFile.ID)
	assert.NotZero(t, downloadFile.CreatedAt)

	// Test read with relationship
	var foundDownload models.Download
	err = db.Preload("Files").First(&foundDownload, "id = ?", download.ID).Error
	require.NoError(t, err)
	assert.Len(t, foundDownload.Files, 1)
	assert.Equal(t, downloadFile.FileName, foundDownload.Files[0].FileName)

	// Test foreign key constraint
	var foundFile models.DownloadFile
	err = db.Preload("Download").First(&foundFile, "id = ?", downloadFile.ID).Error
	require.NoError(t, err)
	assert.NotNil(t, foundFile.Download)
	assert.Equal(t, download.ID, foundFile.Download.ID)
}

func TestDownloadStatusConstraints(t *testing.T) {
	db := setupTestDB(t)

	tests := []struct {
		name     string
		download models.Download
		wantErr  bool
	}{
		{
			name: "valid progress should succeed",
			download: models.Download{
				UserID:   "550e8400-e29b-41d4-a716-446655440001",
				GameID:   "550e8400-e29b-41d4-a716-446655440002",
				Status:   models.StatusDownloading,
				Progress: 50,
			},
			wantErr: false,
		},
		{
			name: "progress over 100 should fail",
			download: models.Download{
				UserID:   "550e8400-e29b-41d4-a716-446655440001",
				GameID:   "550e8400-e29b-41d4-a716-446655440002",
				Status:   models.StatusDownloading,
				Progress: 150,
			},
			wantErr: true,
		},
		{
			name: "negative progress should fail",
			download: models.Download{
				UserID:   "550e8400-e29b-41d4-a716-446655440001",
				GameID:   "550e8400-e29b-41d4-a716-446655440002",
				Status:   models.StatusDownloading,
				Progress: -10,
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := db.Create(&tt.download).Error
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestIndexPerformance(t *testing.T) {
	db := setupTestDB(t)

	// Create test data with valid UUID
	userID := "550e8400-e29b-41d4-a716-446655440001"
	for i := 0; i < 100; i++ {
		download := &models.Download{
			UserID:         userID,
			GameID:         fmt.Sprintf("550e8400-e29b-41d4-a716-4466554400%02d", i),
			Status:         models.StatusCompleted,
			Progress:       100,
			TotalSize:      1000000,
			DownloadedSize: 1000000,
			Speed:          0,
		}
		err := db.Create(download).Error
		require.NoError(t, err)
	}

	// Test query performance with indexes
	start := time.Now()
	var downloads []models.Download
	err := db.Where("user_id = ? AND status = ?", userID, models.StatusCompleted).Find(&downloads).Error
	duration := time.Since(start)

	require.NoError(t, err)
	assert.Len(t, downloads, 100)
	// Query should be fast with proper indexes
	assert.Less(t, duration, 100*time.Millisecond)
}