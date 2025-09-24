# Database Package

This package provides database connectivity and model management for the Download Service using GORM and PostgreSQL.

## Features

- **GORM Integration**: Full GORM setup with PostgreSQL driver
- **Auto Migrations**: Automatic database schema migrations
- **Optimized Indexes**: Performance-optimized indexes for common queries
- **Health Checks**: Database connectivity and health monitoring
- **Relationships**: Proper foreign key relationships between models
- **Constraints**: Data validation constraints at the database level

## Models

### Download
Represents a game download session with the following fields:
- `ID`: UUID primary key (auto-generated)
- `UserID`: UUID of the user (indexed, not null)
- `GameID`: UUID of the game (indexed, not null)
- `Status`: Download status (indexed, not null)
- `Progress`: Download progress 0-100% (with check constraint)
- `TotalSize`: Total file size in bytes
- `DownloadedSize`: Downloaded size in bytes
- `Speed`: Current download speed in bytes/second
- `Files`: Related download files (one-to-many relationship)
- `CreatedAt`, `UpdatedAt`: Timestamps

### DownloadFile
Represents individual files within a download:
- `ID`: UUID primary key (auto-generated)
- `DownloadID`: Foreign key to Download (indexed, not null, cascade delete)
- `FileName`: Name of the file (indexed, not null)
- `FilePath`: Full path to the file (not null)
- `FileSize`: File size in bytes
- `DownloadedSize`: Downloaded size in bytes
- `Status`: File download status (indexed)
- `Download`: Parent download relationship
- `CreatedAt`, `UpdatedAt`: Timestamps

## Indexes

The following indexes are automatically created for optimal performance:

### Primary Indexes
- `idx_downloads_user`: Single index on `user_id`
- `idx_downloads_game`: Single index on `game_id`
- `idx_downloads_status`: Single index on `status`
- `idx_download_files_download`: Single index on `download_id`
- `idx_download_files_name`: Single index on `file_name`
- `idx_download_files_status`: Single index on `status`

### Composite Indexes
- `idx_downloads_user_game_status`: Composite index on `(user_id, game_id, status)`
- `idx_downloads_user_status_created`: Composite index on `(user_id, status, created_at DESC)`

### Conditional Indexes
- `idx_downloads_active_status`: Conditional index for active downloads (`status IN ('downloading', 'paused')`)
- `idx_download_files_status_size`: Composite index on `(status, file_size)`

## Usage

### Connecting to Database

```go
import "download-service/internal/database"

// Connect with options
db, err := database.Connect(database.Options{
    DSN: "postgres://user:password@localhost:5432/downloads?sslmode=disable",
})
if err != nil {
    log.Fatal("Failed to connect to database:", err)
}
```

### Health Check

```go
// Check database health
if err := database.HealthCheck(db); err != nil {
    log.Error("Database health check failed:", err)
}
```

### Working with Models

```go
import "download-service/internal/models"

// Create a download
download := &models.Download{
    UserID:    "user-123",
    GameID:    "game-456",
    Status:    models.StatusPending,
    Progress:  0,
    TotalSize: 1000000,
}

err := db.Create(download).Error
if err != nil {
    log.Error("Failed to create download:", err)
}

// Query downloads with relationships
var downloads []models.Download
err = db.Preload("Files").Where("user_id = ?", userID).Find(&downloads).Error
```

## Testing

### Unit Tests
Run unit tests (uses in-memory SQLite when CGO is available):
```bash
go test ./internal/database -v
```

### Integration Tests
Run integration tests with real PostgreSQL:
```bash
# Start PostgreSQL with docker-compose
docker-compose up -d db

# Run integration tests
go test -tags=integration ./internal/database -v
```

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `APP_ENV`: Application environment (development/production)

## Performance Considerations

1. **Indexes**: All frequently queried fields are indexed
2. **Composite Indexes**: Multi-column queries use composite indexes
3. **Conditional Indexes**: Active downloads have specialized indexes
4. **Foreign Keys**: Proper relationships with cascade deletes
5. **Constraints**: Database-level validation for data integrity

## Migration Strategy

- Migrations run automatically on service startup
- Uses GORM's AutoMigrate for schema changes
- Additional indexes are created programmatically
- PostgreSQL extensions (pgcrypto) are enabled for UUID generation

## Monitoring

The `HealthCheck` function provides:
- Database connectivity verification
- Basic query functionality testing
- Connection pool status (via underlying sql.DB)

Use this for health endpoints and monitoring systems.