package database

import (
    "fmt"

    "download-service/internal/models"
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
    return nil
}

