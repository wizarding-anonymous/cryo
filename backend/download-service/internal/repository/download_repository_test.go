package repository

import (
    "context"
    "testing"
    "time"

    "download-service/internal/models"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)



func TestDownloadRepository_Create(t *testing.T) {
    db := setupTestDB(t)
    if db == nil {
        return // Test was skipped
    }
    repo := NewDownloadRepository(db)
    ctx := context.Background()

    download := &models.Download{
        UserID:         "550e8400-e29b-41d4-a716-446655440001",
        GameID:         "550e8400-e29b-41d4-a716-446655440002",
        Status:         models.StatusPending,
        Progress:       0,
        TotalSize:      1000000,
        DownloadedSize: 0,
        Speed:          0,
    }

    err := repo.Create(ctx, download)
    assert.NoError(t, err)
    assert.NotEmpty(t, download.ID)
    assert.NotZero(t, download.CreatedAt)
    assert.NotZero(t, download.UpdatedAt)
}

func TestDownloadRepository_GetByID(t *testing.T) {
    db := setupTestDB(t)
    if db == nil {
        return // Test was skipped
    }
    repo := NewDownloadRepository(db)
    ctx := context.Background()

    // Create a download first
    download := &models.Download{
        UserID:         "550e8400-e29b-41d4-a716-446655440001",
        GameID:         "550e8400-e29b-41d4-a716-446655440002",
        Status:         models.StatusPending,
        Progress:       0,
        TotalSize:      1000000,
        DownloadedSize: 0,
        Speed:          0,
    }
    err := repo.Create(ctx, download)
    require.NoError(t, err)

    // Get the download
    retrieved, err := repo.GetByID(ctx, download.ID)
    assert.NoError(t, err)
    assert.Equal(t, download.ID, retrieved.ID)
    assert.Equal(t, download.UserID, retrieved.UserID)
    assert.Equal(t, download.GameID, retrieved.GameID)
    assert.Equal(t, download.Status, retrieved.Status)
}

func TestDownloadRepository_GetByIDWithFiles(t *testing.T) {
    db := setupTestDB(t)
    if db == nil {
        return // Test was skipped
    }
    repo := NewDownloadRepository(db)
    fileRepo := NewDownloadFileRepository(db)
    ctx := context.Background()

    // Create a download first
    download := &models.Download{
        UserID:         "550e8400-e29b-41d4-a716-446655440001",
        GameID:         "550e8400-e29b-41d4-a716-446655440002",
        Status:         models.StatusPending,
        Progress:       0,
        TotalSize:      1000000,
        DownloadedSize: 0,
        Speed:          0,
    }
    err := repo.Create(ctx, download)
    require.NoError(t, err)

    // Create a file for the download
    file := &models.DownloadFile{
        DownloadID:     download.ID,
        FileName:       "game.exe",
        FilePath:       "/downloads/game.exe",
        FileSize:       1000000,
        DownloadedSize: 0,
        Status:         models.StatusPending,
    }
    err = fileRepo.Create(ctx, file)
    require.NoError(t, err)

    // Get the download with files
    retrieved, err := repo.GetByIDWithFiles(ctx, download.ID)
    assert.NoError(t, err)
    assert.Equal(t, download.ID, retrieved.ID)
    assert.Len(t, retrieved.Files, 1)
    assert.Equal(t, file.FileName, retrieved.Files[0].FileName)
}

func TestDownloadRepository_Update(t *testing.T) {
    db := setupTestDB(t)
    if db == nil {
        return // Test was skipped
    }
    repo := NewDownloadRepository(db)
    ctx := context.Background()

    // Create a download first
    download := &models.Download{
        UserID:         "550e8400-e29b-41d4-a716-446655440001",
        GameID:         "550e8400-e29b-41d4-a716-446655440002",
        Status:         models.StatusPending,
        Progress:       0,
        TotalSize:      1000000,
        DownloadedSize: 0,
        Speed:          0,
    }
    err := repo.Create(ctx, download)
    require.NoError(t, err)

    // Update the download
    download.Status = models.StatusDownloading
    download.Progress = 50
    download.DownloadedSize = 500000
    download.Speed = 1024

    err = repo.Update(ctx, download)
    assert.NoError(t, err)

    // Verify the update
    retrieved, err := repo.GetByID(ctx, download.ID)
    assert.NoError(t, err)
    assert.Equal(t, models.StatusDownloading, retrieved.Status)
    assert.Equal(t, 50, retrieved.Progress)
    assert.Equal(t, int64(500000), retrieved.DownloadedSize)
    assert.Equal(t, int64(1024), retrieved.Speed)
}

func TestDownloadRepository_UpdateStatus(t *testing.T) {
    db := setupTestDB(t)
    if db == nil {
        return // Test was skipped
    }
    repo := NewDownloadRepository(db)
    ctx := context.Background()

    // Create a download first
    download := &models.Download{
        UserID:         "550e8400-e29b-41d4-a716-446655440001",
        GameID:         "550e8400-e29b-41d4-a716-446655440002",
        Status:         models.StatusPending,
        Progress:       0,
        TotalSize:      1000000,
        DownloadedSize: 0,
        Speed:          0,
    }
    err := repo.Create(ctx, download)
    require.NoError(t, err)

    // Update status
    err = repo.UpdateStatus(ctx, download.ID, models.StatusDownloading)
    assert.NoError(t, err)

    // Verify the update
    retrieved, err := repo.GetByID(ctx, download.ID)
    assert.NoError(t, err)
    assert.Equal(t, models.StatusDownloading, retrieved.Status)
}

func TestDownloadRepository_UpdateProgress(t *testing.T) {
    db := setupTestDB(t)
    if db == nil {
        return // Test was skipped
    }
    repo := NewDownloadRepository(db)
    ctx := context.Background()

    // Create a download first
    download := &models.Download{
        UserID:         "550e8400-e29b-41d4-a716-446655440001",
        GameID:         "550e8400-e29b-41d4-a716-446655440002",
        Status:         models.StatusPending,
        Progress:       0,
        TotalSize:      1000000,
        DownloadedSize: 0,
        Speed:          0,
    }
    err := repo.Create(ctx, download)
    require.NoError(t, err)

    // Update progress
    err = repo.UpdateProgress(ctx, download.ID, 75, 750000, 2048)
    assert.NoError(t, err)

    // Verify the update
    retrieved, err := repo.GetByID(ctx, download.ID)
    assert.NoError(t, err)
    assert.Equal(t, 75, retrieved.Progress)
    assert.Equal(t, int64(750000), retrieved.DownloadedSize)
    assert.Equal(t, int64(2048), retrieved.Speed)
}

func TestDownloadRepository_ListByUser(t *testing.T) {
    db := setupTestDB(t)
    if db == nil {
        return // Test was skipped
    }
    repo := NewDownloadRepository(db)
    ctx := context.Background()

    userID := "550e8400-e29b-41d4-a716-446655440001"

    // Create multiple downloads for the user
    for i := 0; i < 3; i++ {
        download := &models.Download{
            UserID:         userID,
            GameID:         "550e8400-e29b-41d4-a716-44665544000" + string(rune('2'+i)),
            Status:         models.StatusPending,
            Progress:       0,
            TotalSize:      1000000,
            DownloadedSize: 0,
            Speed:          0,
        }
        err := repo.Create(ctx, download)
        require.NoError(t, err)
        
        // Add small delay to ensure different created_at times
        time.Sleep(time.Millisecond)
    }

    // List downloads
    downloads, err := repo.ListByUser(ctx, userID, 10, 0)
    assert.NoError(t, err)
    assert.Len(t, downloads, 3)

    // Test pagination
    downloads, err = repo.ListByUser(ctx, userID, 2, 0)
    assert.NoError(t, err)
    assert.Len(t, downloads, 2)

    downloads, err = repo.ListByUser(ctx, userID, 2, 2)
    assert.NoError(t, err)
    assert.Len(t, downloads, 1)
}

func TestDownloadRepository_ListByUserAndStatus(t *testing.T) {
    db := setupTestDB(t)
    if db == nil {
        return // Test was skipped
    }
    repo := NewDownloadRepository(db)
    ctx := context.Background()

    userID := "550e8400-e29b-41d4-a716-446655440001"

    // Create downloads with different statuses
    statuses := []models.DownloadStatus{models.StatusPending, models.StatusDownloading, models.StatusCompleted}
    for i, status := range statuses {
        download := &models.Download{
            UserID:         userID,
            GameID:         "550e8400-e29b-41d4-a716-44665544000" + string(rune('2'+i)),
            Status:         status,
            Progress:       0,
            TotalSize:      1000000,
            DownloadedSize: 0,
            Speed:          0,
        }
        err := repo.Create(ctx, download)
        require.NoError(t, err)
    }

    // List only pending downloads
    downloads, err := repo.ListByUserAndStatus(ctx, userID, models.StatusPending, 10, 0)
    assert.NoError(t, err)
    assert.Len(t, downloads, 1)
    assert.Equal(t, models.StatusPending, downloads[0].Status)
}

func TestDownloadRepository_Delete(t *testing.T) {
    db := setupTestDB(t)
    if db == nil {
        return // Test was skipped
    }
    repo := NewDownloadRepository(db)
    ctx := context.Background()

    // Create a download first
    download := &models.Download{
        UserID:         "550e8400-e29b-41d4-a716-446655440001",
        GameID:         "550e8400-e29b-41d4-a716-446655440002",
        Status:         models.StatusPending,
        Progress:       0,
        TotalSize:      1000000,
        DownloadedSize: 0,
        Speed:          0,
    }
    err := repo.Create(ctx, download)
    require.NoError(t, err)

    // Delete the download
    err = repo.Delete(ctx, download.ID)
    assert.NoError(t, err)

    // Verify it's deleted
    _, err = repo.GetByID(ctx, download.ID)
    assert.Error(t, err)
}

func TestDownloadRepository_CountByUser(t *testing.T) {
    db := setupTestDB(t)
    if db == nil {
        return // Test was skipped
    }
    repo := NewDownloadRepository(db)
    ctx := context.Background()

    userID := "550e8400-e29b-41d4-a716-446655440001"

    // Initially should be 0
    count, err := repo.CountByUser(ctx, userID)
    assert.NoError(t, err)
    assert.Equal(t, int64(0), count)

    // Create downloads
    for i := 0; i < 5; i++ {
        download := &models.Download{
            UserID:         userID,
            GameID:         "550e8400-e29b-41d4-a716-44665544000" + string(rune('2'+i)),
            Status:         models.StatusPending,
            Progress:       0,
            TotalSize:      1000000,
            DownloadedSize: 0,
            Speed:          0,
        }
        err := repo.Create(ctx, download)
        require.NoError(t, err)
    }

    // Count should be 5
    count, err = repo.CountByUser(ctx, userID)
    assert.NoError(t, err)
    assert.Equal(t, int64(5), count)
}