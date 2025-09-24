package database

import (
	"fmt"

	"download-service/internal/models"
	_ "github.com/lib/pq"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type Options struct {
	DSN string
}

// Connect opens a GORM connection, runs migrations, and returns the DB handle.
func Connect(opts Options) (*gorm.DB, error) {
	if opts.DSN == "" {
		return nil, fmt.Errorf("database DSN is empty")
	}
	db, err := gorm.Open(postgres.Open(opts.DSN), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return nil, err
	}
	if err := migrate(db); err != nil {
		return nil, err
	}
	return db, nil
}

func migrate(db *gorm.DB) error {
	// Enable pgcrypto for gen_random_uuid() if available
	db.Exec(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`)

	// AutoMigrate models
	if err := db.AutoMigrate(&models.Download{}, &models.DownloadFile{}); err != nil {
		return err
	}

	// Create additional indexes for performance
	if err := createAdditionalIndexes(db); err != nil {
		return err
	}

	return nil
}

// createAdditionalIndexes creates additional performance indexes
func createAdditionalIndexes(db *gorm.DB) error {
	// Composite index for user downloads with status and creation time
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_downloads_user_status_created 
		ON downloads (user_id, status, created_at DESC)`)
	
	// Index for active downloads (downloading, paused)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_downloads_active_status 
		ON downloads (status) WHERE status IN ('downloading', 'paused')`)
	
	// Index for download files by status and size
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_download_files_status_size 
		ON download_files (status, file_size)`)

	return nil
}

// HealthCheck verifies database connectivity and basic functionality
func HealthCheck(db *gorm.DB) error {
	if db == nil {
		return fmt.Errorf("database connection is nil")
	}

	sqlDB, err := db.DB()
	if err != nil {
		return fmt.Errorf("failed to get underlying sql.DB: %w", err)
	}

	// Check if we can ping the database
	if err := sqlDB.Ping(); err != nil {
		return fmt.Errorf("database ping failed: %w", err)
	}

	// Check if we can perform a simple query
	var count int64
	if err := db.Model(&models.Download{}).Count(&count).Error; err != nil {
		return fmt.Errorf("failed to query downloads table: %w", err)
	}

	return nil
}
