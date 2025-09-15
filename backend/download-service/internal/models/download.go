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
    ID             string         `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
    UserID         string         `json:"userId" gorm:"type:uuid;index:idx_downloads_user;index:idx_downloads_user_game_status,priority:1"`
    GameID         string         `json:"gameId" gorm:"type:uuid;index:idx_downloads_game;index:idx_downloads_user_game_status,priority:2"`
    Status         DownloadStatus `json:"status" gorm:"type:text;index:idx_downloads_status;index:idx_downloads_user_game_status,priority:3"`
    Progress       int            `json:"progress"`
    TotalSize      int64          `json:"totalSize"`
    DownloadedSize int64          `json:"downloadedSize"`
    Speed          int64          `json:"speed"`
    CreatedAt      time.Time      `json:"createdAt"`
    UpdatedAt      time.Time      `json:"updatedAt"`
}

type DownloadFile struct {
    ID             string   `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
    DownloadID     string   `json:"downloadId" gorm:"type:uuid;index:idx_download_files_download"`
    FileName       string   `json:"fileName"`
    FilePath       string   `json:"filePath"`
    FileSize       int64    `json:"fileSize"`
    DownloadedSize int64    `json:"downloadedSize"`
    Status         string   `json:"status"`
}
