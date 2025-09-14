package models

import "time"

type DownloadStatus string

const (
    StatusPending     DownloadStatus = "pending"
    StatusDownloading DownloadStatus = "downloading"
    StatusPaused      DownloadStatus = "paused"
    StatusCompleted   DownloadStatus = "completed"
    StatusFailed      DownloadStatus = "failed"
)

type Download struct {
    ID             string         `json:"id" gorm:"primaryKey;type:uuid"`
    UserID         string         `json:"userId" gorm:"index;type:uuid"`
    GameID         string         `json:"gameId" gorm:"index;type:uuid"`
    Status         DownloadStatus `json:"status" gorm:"type:text"`
    Progress       int            `json:"progress"`
    TotalSize      int64          `json:"totalSize"`
    DownloadedSize int64          `json:"downloadedSize"`
    Speed          int64          `json:"speed"`
    CreatedAt      time.Time      `json:"createdAt"`
    UpdatedAt      time.Time      `json:"updatedAt"`
}

type DownloadFile struct {
    ID             string   `json:"id" gorm:"primaryKey;type:uuid"`
    DownloadID     string   `json:"downloadId" gorm:"index;type:uuid"`
    FileName       string   `json:"fileName"`
    FilePath       string   `json:"filePath"`
    FileSize       int64    `json:"fileSize"`
    DownloadedSize int64    `json:"downloadedSize"`
    Status         string   `json:"status"`
}

