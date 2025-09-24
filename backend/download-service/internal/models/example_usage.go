package models

import (
    "context"
    "fmt"
    "time"
)

// ExampleUsage demonstrates how to use the Download and DownloadFile models
// with validation in a real-world scenario
func ExampleUsage() {
    // Create a new download
    download := &Download{
        UserID:         "550e8400-e29b-41d4-a716-446655440001",
        GameID:         "550e8400-e29b-41d4-a716-446655440002",
        Status:         StatusPending,
        Progress:       0,
        TotalSize:      1000000,
        DownloadedSize: 0,
        Speed:          0,
        CreatedAt:      time.Now(),
        UpdatedAt:      time.Now(),
    }

    // Validate the download before saving
    if err := download.Validate(); err != nil {
        fmt.Printf("Download validation failed: %v\n", err)
        return
    }

    // Create download files
    files := []DownloadFile{
        {
            DownloadID:     download.ID, // Will be set after download is created
            FileName:       "game.exe",
            FilePath:       "/downloads/game/game.exe",
            FileSize:       800000,
            DownloadedSize: 0,
            Status:         StatusPending,
            CreatedAt:      time.Now(),
            UpdatedAt:      time.Now(),
        },
        {
            DownloadID:     download.ID,
            FileName:       "data.pak",
            FilePath:       "/downloads/game/data.pak",
            FileSize:       200000,
            DownloadedSize: 0,
            Status:         StatusPending,
            CreatedAt:      time.Now(),
            UpdatedAt:      time.Now(),
        },
    }

    // Validate each file
    for i, file := range files {
        if err := file.Validate(); err != nil {
            fmt.Printf("File %d validation failed: %v\n", i, err)
            return
        }
    }

    fmt.Println("All models validated successfully!")
    fmt.Printf("Download: %+v\n", download)
    fmt.Printf("Files: %+v\n", files)
}

// ExampleRepositoryUsage demonstrates how to use repositories with the models
func ExampleRepositoryUsage(ctx context.Context, downloadRepo interface{}, fileRepo interface{}) {
    // This is a conceptual example showing how repositories would be used
    // In real implementation, you would inject actual repository instances
    
    download := &Download{
        UserID:         "550e8400-e29b-41d4-a716-446655440001",
        GameID:         "550e8400-e29b-41d4-a716-446655440002",
        Status:         StatusPending,
        Progress:       0,
        TotalSize:      1000000,
        DownloadedSize: 0,
        Speed:          0,
    }

    // Validate before repository operations
    if err := download.Validate(); err != nil {
        fmt.Printf("Validation failed: %v\n", err)
        return
    }

    // Repository operations would look like:
    // 1. err := downloadRepo.Create(ctx, download)
    // 2. retrieved, err := downloadRepo.GetByID(ctx, download.ID)
    // 3. err := downloadRepo.UpdateStatus(ctx, download.ID, StatusDownloading)
    // 4. downloads, err := downloadRepo.ListByUser(ctx, userID, 10, 0)

    fmt.Println("Repository usage example completed")
}