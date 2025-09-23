package dto

import "download-service/internal/models"

// Requests
type StartDownloadRequest struct {
    UserID string `json:"userId" binding:"omitempty,uuid4"`
    GameID string `json:"gameId" binding:"required,uuid4"`
}

type PauseDownloadRequest struct {
    DownloadID string `json:"downloadId" binding:"required,uuid4"`
}

type ResumeDownloadRequest struct {
    DownloadID string `json:"downloadId" binding:"required,uuid4"`
}

// Responses
type DownloadResponse struct {
    ID             string `json:"id"`
    UserID         string `json:"userId"`
    GameID         string `json:"gameId"`
    Status         string `json:"status"`
    Progress       int    `json:"progress"`
    TotalSize      int64  `json:"totalSize"`
    DownloadedSize int64  `json:"downloadedSize"`
    Speed          int64  `json:"speed"`
    CreatedAt      int64  `json:"createdAt"`
    UpdatedAt      int64  `json:"updatedAt"`
}

func FromModel(d models.Download) DownloadResponse {
    return DownloadResponse{
        ID:             d.ID,
        UserID:         d.UserID,
        GameID:         d.GameID,
        Status:         string(d.Status),
        Progress:       d.Progress,
        TotalSize:      d.TotalSize,
        DownloadedSize: d.DownloadedSize,
        Speed:          d.Speed,
        CreatedAt:      d.CreatedAt.Unix(),
        UpdatedAt:      d.UpdatedAt.Unix(),
    }
}
