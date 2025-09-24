package repository

import (
    "context"
    "testing"

    "download-service/internal/models"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)

func TestDownloadFileRepository_Create(t *testing.T) {
    db := setupTestDB(t)
    if db == nil {
        return // Test was skipped
    }
    downloadRepo := NewDownloadRepository(db)
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
    err := downloadRepo.Create(ctx, download)
    require.NoError(t, err)

    // Create a download file
    file := &models.DownloadFile{
        DownloadID:     download.ID,
        FileName:       "game.exe",
        FilePath:       "/downloads/game.exe",
        FileSize:       1000000,
        DownloadedSize: 0,
        Status:         models.StatusPending,
    }

    err = fileRepo.Create(ctx, file)
    assert.NoError(t, err)
    assert.NotEmpty(t, file.ID)
    assert.NotZero(t, file.CreatedAt)
    assert.NotZero(t, file.UpdatedAt)
}

func TestDownloadFileRepository_GetByID(t *testing.T) {
    db := setupTestDB(t)
    if db == nil {
        return // Test was skipped
    }
    downloadRepo := NewDownloadRepository(db)
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
    err := downloadRepo.Create(ctx, download)
    require.NoError(t, err)

    // Create a download file
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

    // Get the file
    retrieved, err := fileRepo.GetByID(ctx, file.ID)
    assert.NoError(t, err)
    assert.Equal(t, file.ID, retrieved.ID)
    assert.Equal(t, file.DownloadID, retrieved.DownloadID)
    assert.Equal(t, file.FileName, retrieved.FileName)
    assert.Equal(t, file.FilePath, retrieved.FilePath)
    assert.Equal(t, file.FileSize, retrieved.FileSize)
    assert.Equal(t, file.Status, retrieved.Status)
}

func TestDownloadFileRepository_ListByDownload(t *testing.T) {
    db := setupTestDB(t)
    if db == nil {
        return // Test was skipped
    }
    downloadRepo := NewDownloadRepository(db)
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
    err := downloadRepo.Create(ctx, download)
    require.NoError(t, err)

    // Create multiple files for the download
    fileNames := []string{"game.exe", "data.pak", "config.ini"}
    for _, fileName := range fileNames {
        file := &models.DownloadFile{
            DownloadID:     download.ID,
            FileName:       fileName,
            FilePath:       "/downloads/" + fileName,
            FileSize:       1000000,
            DownloadedSize: 0,
            Status:         models.StatusPending,
        }
        err = fileRepo.Create(ctx, file)
        require.NoError(t, err)
    }

    // List files by download
    files, err := fileRepo.ListByDownload(ctx, download.ID)
    assert.NoError(t, err)
    assert.Len(t, files, 3)

    // Verify files are sorted by file name
    assert.Equal(t, "config.ini", files[0].FileName)
    assert.Equal(t, "data.pak", files[1].FileName)
    assert.Equal(t, "game.exe", files[2].FileName)
}

func TestDownloadFileRepository_Update(t *testing.T) {
    db := setupTestDB(t)
    if db == nil {
        return // Test was skipped
    }
    downloadRepo := NewDownloadRepository(db)
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
    err := downloadRepo.Create(ctx, download)
    require.NoError(t, err)

    // Create a download file
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

    // Update the file
    file.Status = models.StatusDownloading
    file.DownloadedSize = 500000

    err = fileRepo.Update(ctx, file)
    assert.NoError(t, err)

    // Verify the update
    retrieved, err := fileRepo.GetByID(ctx, file.ID)
    assert.NoError(t, err)
    assert.Equal(t, models.StatusDownloading, retrieved.Status)
    assert.Equal(t, int64(500000), retrieved.DownloadedSize)
}

func TestDownloadFileRepository_UpdateStatus(t *testing.T) {
    db := setupTestDB(t)
    if db == nil {
        return // Test was skipped
    }
    downloadRepo := NewDownloadRepository(db)
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
    err := downloadRepo.Create(ctx, download)
    require.NoError(t, err)

    // Create a download file
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

    // Update status
    err = fileRepo.UpdateStatus(ctx, file.ID, models.StatusCompleted)
    assert.NoError(t, err)

    // Verify the update
    retrieved, err := fileRepo.GetByID(ctx, file.ID)
    assert.NoError(t, err)
    assert.Equal(t, models.StatusCompleted, retrieved.Status)
}

func TestDownloadFileRepository_UpdateProgress(t *testing.T) {
    db := setupTestDB(t)
    if db == nil {
        return // Test was skipped
    }
    downloadRepo := NewDownloadRepository(db)
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
    err := downloadRepo.Create(ctx, download)
    require.NoError(t, err)

    // Create a download file
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

    // Update progress
    err = fileRepo.UpdateProgress(ctx, file.ID, 750000)
    assert.NoError(t, err)

    // Verify the update
    retrieved, err := fileRepo.GetByID(ctx, file.ID)
    assert.NoError(t, err)
    assert.Equal(t, int64(750000), retrieved.DownloadedSize)
}

func TestDownloadFileRepository_Delete(t *testing.T) {
    db := setupTestDB(t)
    if db == nil {
        return // Test was skipped
    }
    downloadRepo := NewDownloadRepository(db)
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
    err := downloadRepo.Create(ctx, download)
    require.NoError(t, err)

    // Create a download file
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

    // Delete the file
    err = fileRepo.Delete(ctx, file.ID)
    assert.NoError(t, err)

    // Verify it's deleted
    _, err = fileRepo.GetByID(ctx, file.ID)
    assert.Error(t, err)
}

func TestDownloadFileRepository_DeleteByDownload(t *testing.T) {
    db := setupTestDB(t)
    if db == nil {
        return // Test was skipped
    }
    downloadRepo := NewDownloadRepository(db)
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
    err := downloadRepo.Create(ctx, download)
    require.NoError(t, err)

    // Create multiple files for the download
    fileNames := []string{"game.exe", "data.pak", "config.ini"}
    for _, fileName := range fileNames {
        file := &models.DownloadFile{
            DownloadID:     download.ID,
            FileName:       fileName,
            FilePath:       "/downloads/" + fileName,
            FileSize:       1000000,
            DownloadedSize: 0,
            Status:         models.StatusPending,
        }
        err = fileRepo.Create(ctx, file)
        require.NoError(t, err)
    }

    // Verify files exist
    files, err := fileRepo.ListByDownload(ctx, download.ID)
    assert.NoError(t, err)
    assert.Len(t, files, 3)

    // Delete all files by download
    err = fileRepo.DeleteByDownload(ctx, download.ID)
    assert.NoError(t, err)

    // Verify all files are deleted
    files, err = fileRepo.ListByDownload(ctx, download.ID)
    assert.NoError(t, err)
    assert.Len(t, files, 0)
}