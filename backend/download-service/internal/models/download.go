package models

import (
    "time"
    
    "download-service/pkg/validate"
)

type DownloadStatus string

const (
    StatusPending     DownloadStatus = "pending"
    StatusDownloading DownloadStatus = "downloading"
    StatusPaused      DownloadStatus = "paused"
    StatusCompleted   DownloadStatus = "completed"
    StatusFailed      DownloadStatus = "failed"
    StatusCancelled   DownloadStatus = "cancelled"
)

// Download represents a game download with complete validation tags
type Download struct {
    ID             string         `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()" validate:"omitempty,uuid4"`
    UserID         string         `json:"userId" gorm:"type:uuid;not null;index:idx_downloads_user;index:idx_downloads_user_game_status,priority:1" validate:"required,uuid4"`
    GameID         string         `json:"gameId" gorm:"type:uuid;not null;index:idx_downloads_game;index:idx_downloads_user_game_status,priority:2" validate:"required,uuid4"`
    Status         DownloadStatus `json:"status" gorm:"type:text;not null;index:idx_downloads_status;index:idx_downloads_user_game_status,priority:3" validate:"required,oneof=pending downloading paused completed failed cancelled"`
    Progress       int            `json:"progress" gorm:"default:0;check:progress >= 0 AND progress <= 100" validate:"min=0,max=100"`
    TotalSize      int64          `json:"totalSize" gorm:"default:0" validate:"min=0"`
    DownloadedSize int64          `json:"downloadedSize" gorm:"default:0" validate:"min=0"`
    Speed          int64          `json:"speed" gorm:"default:0" validate:"min=0"`
    Files          []DownloadFile `json:"files,omitempty" gorm:"foreignKey:DownloadID"`
    CreatedAt      time.Time      `json:"createdAt"`
    UpdatedAt      time.Time      `json:"updatedAt"`
}

// DownloadFile represents a file within a download with complete validation tags
type DownloadFile struct {
    ID             string         `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()" validate:"omitempty,uuid4"`
    DownloadID     string         `json:"downloadId" gorm:"type:uuid;index:idx_download_files_download;not null" validate:"required,uuid4"`
    Download       *Download      `json:"download,omitempty" gorm:"foreignKey:DownloadID;constraint:OnDelete:CASCADE"`
    FileName       string         `json:"fileName" gorm:"not null;index:idx_download_files_name" validate:"required,min=1,max=255"`
    FilePath       string         `json:"filePath" gorm:"not null" validate:"required,min=1,max=500"`
    FileSize       int64          `json:"fileSize" validate:"min=0"`
    DownloadedSize int64          `json:"downloadedSize" validate:"min=0"`
    Status         DownloadStatus `json:"status" gorm:"type:text;index:idx_download_files_status" validate:"required,oneof=pending downloading paused completed failed cancelled"`
    CreatedAt      time.Time      `json:"createdAt"`
    UpdatedAt      time.Time      `json:"updatedAt"`
}

// ValidateDownload validates a Download struct using go-playground/validator
func (d *Download) Validate() error {
    return validate.Struct(d)
}

// ValidateDownloadFile validates a DownloadFile struct using go-playground/validator
func (df *DownloadFile) Validate() error {
    return validate.Struct(df)
}
