package repository

import (
    "database/sql"

    "gorm.io/driver/postgres"
    "gorm.io/gorm"
)

// NewPostgres opens a GORM connection to Postgres using the provided DSN/URL.
func NewPostgres(dsn string) (*gorm.DB, error) {
    db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
    if err != nil {
        return nil, err
    }
    // Verify the connection
    sqlDB, err := db.DB()
    if err != nil {
        return nil, err
    }
    return db, sqlDB.Ping()
}

// Optionally expose a helper to get *sql.DB from *gorm.DB.
func SQL(db *gorm.DB) (*sql.DB, error) { return db.DB() }

