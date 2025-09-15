package services

import (
	"context"
	"fmt"
	"time"

	"download-service/internal/clients/s3"
	"download-service/internal/models"
)

const presignedURLLifetime = 15 * time.Minute

// FileService handles file-related operations, such as generating download URLs.
type FileService struct {
	storage s3.Interface
}

// NewFileService creates a new FileService.
func NewFileService(storage s3.Interface) *FileService {
	return &FileService{storage: storage}
}

// GetDownloadURL generates a presigned URL for a given download.
func (s *FileService) GetDownloadURL(ctx context.Context, download *models.Download) (string, error) {
	// In a real scenario, we might have multiple files per download.
	// For MVP, we assume one file per game, with a predictable key.
	objectKey := fmt.Sprintf("games/%s/game.zip", download.GameID)

	url, err := s.storage.GetPresignedURL(ctx, objectKey, presignedURLLifetime)
	if err != nil {
		// It would be good to wrap this error in a domain-specific error type.
		return "", fmt.Errorf("could not get presigned URL: %w", err)
	}

	return url, nil
}

// VerifyFile simulates the file verification step (size/hash).
// In MVP, returns nil (success) without performing I/O.
func (s *FileService) VerifyFile(ctx context.Context, filePath string, expectedSize int64) error {
	return nil
}

// CleanupFiles simulates temporary files cleanup for a given download.
func (s *FileService) CleanupFiles(ctx context.Context, downloadID string) error {
	return nil
}
