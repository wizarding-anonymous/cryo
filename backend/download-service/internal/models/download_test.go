package models

import (
    "testing"
    "time"

    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)

func TestDownloadValidation(t *testing.T) {
    tests := []struct {
        name      string
        download  Download
        wantError bool
    }{
        {
            name: "valid download",
            download: Download{
                ID:             "550e8400-e29b-41d4-a716-446655440000",
                UserID:         "550e8400-e29b-41d4-a716-446655440001",
                GameID:         "550e8400-e29b-41d4-a716-446655440002",
                Status:         StatusPending,
                Progress:       0,
                TotalSize:      1000000,
                DownloadedSize: 0,
                Speed:          0,
                CreatedAt:      time.Now(),
                UpdatedAt:      time.Now(),
            },
            wantError: false,
        },
        {
            name: "invalid user ID",
            download: Download{
                UserID:         "invalid-uuid",
                GameID:         "550e8400-e29b-41d4-a716-446655440002",
                Status:         StatusPending,
                Progress:       0,
                TotalSize:      1000000,
                DownloadedSize: 0,
                Speed:          0,
            },
            wantError: true,
        },
        {
            name: "invalid game ID",
            download: Download{
                UserID:         "550e8400-e29b-41d4-a716-446655440001",
                GameID:         "invalid-uuid",
                Status:         StatusPending,
                Progress:       0,
                TotalSize:      1000000,
                DownloadedSize: 0,
                Speed:          0,
            },
            wantError: true,
        },
        {
            name: "invalid status",
            download: Download{
                UserID:         "550e8400-e29b-41d4-a716-446655440001",
                GameID:         "550e8400-e29b-41d4-a716-446655440002",
                Status:         "invalid-status",
                Progress:       0,
                TotalSize:      1000000,
                DownloadedSize: 0,
                Speed:          0,
            },
            wantError: true,
        },
        {
            name: "invalid progress - negative",
            download: Download{
                UserID:         "550e8400-e29b-41d4-a716-446655440001",
                GameID:         "550e8400-e29b-41d4-a716-446655440002",
                Status:         StatusPending,
                Progress:       -1,
                TotalSize:      1000000,
                DownloadedSize: 0,
                Speed:          0,
            },
            wantError: true,
        },
        {
            name: "invalid progress - over 100",
            download: Download{
                UserID:         "550e8400-e29b-41d4-a716-446655440001",
                GameID:         "550e8400-e29b-41d4-a716-446655440002",
                Status:         StatusPending,
                Progress:       101,
                TotalSize:      1000000,
                DownloadedSize: 0,
                Speed:          0,
            },
            wantError: true,
        },
        {
            name: "invalid total size - negative",
            download: Download{
                UserID:         "550e8400-e29b-41d4-a716-446655440001",
                GameID:         "550e8400-e29b-41d4-a716-446655440002",
                Status:         StatusPending,
                Progress:       0,
                TotalSize:      -1,
                DownloadedSize: 0,
                Speed:          0,
            },
            wantError: true,
        },
        {
            name: "missing required fields",
            download: Download{
                Progress:       0,
                TotalSize:      1000000,
                DownloadedSize: 0,
                Speed:          0,
            },
            wantError: true,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            err := tt.download.Validate()
            if tt.wantError {
                assert.Error(t, err)
            } else {
                assert.NoError(t, err)
            }
        })
    }
}

func TestDownloadFileValidation(t *testing.T) {
    tests := []struct {
        name         string
        downloadFile DownloadFile
        wantError    bool
    }{
        {
            name: "valid download file",
            downloadFile: DownloadFile{
                ID:             "550e8400-e29b-41d4-a716-446655440000",
                DownloadID:     "550e8400-e29b-41d4-a716-446655440001",
                FileName:       "game.exe",
                FilePath:       "/downloads/game.exe",
                FileSize:       1000000,
                DownloadedSize: 0,
                Status:         StatusPending,
                CreatedAt:      time.Now(),
                UpdatedAt:      time.Now(),
            },
            wantError: false,
        },
        {
            name: "invalid download ID",
            downloadFile: DownloadFile{
                DownloadID:     "invalid-uuid",
                FileName:       "game.exe",
                FilePath:       "/downloads/game.exe",
                FileSize:       1000000,
                DownloadedSize: 0,
                Status:         StatusPending,
            },
            wantError: true,
        },
        {
            name: "empty file name",
            downloadFile: DownloadFile{
                DownloadID:     "550e8400-e29b-41d4-a716-446655440001",
                FileName:       "",
                FilePath:       "/downloads/game.exe",
                FileSize:       1000000,
                DownloadedSize: 0,
                Status:         StatusPending,
            },
            wantError: true,
        },
        {
            name: "empty file path",
            downloadFile: DownloadFile{
                DownloadID:     "550e8400-e29b-41d4-a716-446655440001",
                FileName:       "game.exe",
                FilePath:       "",
                FileSize:       1000000,
                DownloadedSize: 0,
                Status:         StatusPending,
            },
            wantError: true,
        },
        {
            name: "file name too long",
            downloadFile: DownloadFile{
                DownloadID:     "550e8400-e29b-41d4-a716-446655440001",
                FileName:       string(make([]byte, 256)), // 256 characters, exceeds max of 255
                FilePath:       "/downloads/game.exe",
                FileSize:       1000000,
                DownloadedSize: 0,
                Status:         StatusPending,
            },
            wantError: true,
        },
        {
            name: "file path too long",
            downloadFile: DownloadFile{
                DownloadID:     "550e8400-e29b-41d4-a716-446655440001",
                FileName:       "game.exe",
                FilePath:       string(make([]byte, 501)), // 501 characters, exceeds max of 500
                FileSize:       1000000,
                DownloadedSize: 0,
                Status:         StatusPending,
            },
            wantError: true,
        },
        {
            name: "negative file size",
            downloadFile: DownloadFile{
                DownloadID:     "550e8400-e29b-41d4-a716-446655440001",
                FileName:       "game.exe",
                FilePath:       "/downloads/game.exe",
                FileSize:       -1,
                DownloadedSize: 0,
                Status:         StatusPending,
            },
            wantError: true,
        },
        {
            name: "invalid status",
            downloadFile: DownloadFile{
                DownloadID:     "550e8400-e29b-41d4-a716-446655440001",
                FileName:       "game.exe",
                FilePath:       "/downloads/game.exe",
                FileSize:       1000000,
                DownloadedSize: 0,
                Status:         "invalid-status",
            },
            wantError: true,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            err := tt.downloadFile.Validate()
            if tt.wantError {
                assert.Error(t, err)
            } else {
                assert.NoError(t, err)
            }
        })
    }
}

func TestDownloadStatusConstants(t *testing.T) {
    // Test that all status constants are valid
    statuses := []DownloadStatus{
        StatusPending,
        StatusDownloading,
        StatusPaused,
        StatusCompleted,
        StatusFailed,
        StatusCancelled,
    }

    expectedStatuses := []string{
        "pending",
        "downloading",
        "paused",
        "completed",
        "failed",
        "cancelled",
    }

    require.Len(t, statuses, len(expectedStatuses))

    for i, status := range statuses {
        assert.Equal(t, expectedStatuses[i], string(status))
    }
}

func TestDownloadFileRelationship(t *testing.T) {
    // Test that DownloadFile can reference Download
    download := &Download{
        ID:             "550e8400-e29b-41d4-a716-446655440000",
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

    downloadFile := DownloadFile{
        ID:             "550e8400-e29b-41d4-a716-446655440003",
        DownloadID:     download.ID,
        Download:       download,
        FileName:       "game.exe",
        FilePath:       "/downloads/game.exe",
        FileSize:       1000000,
        DownloadedSize: 0,
        Status:         StatusPending,
        CreatedAt:      time.Now(),
        UpdatedAt:      time.Now(),
    }

    assert.Equal(t, download.ID, downloadFile.DownloadID)
    assert.Equal(t, download, downloadFile.Download)
    assert.NoError(t, downloadFile.Validate())
}