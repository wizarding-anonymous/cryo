package services

import (
    "context"
    "errors"
    "fmt"
    "strings"
    "time"

    "download-service/internal/clients/s3"
    derr "download-service/internal/errors"
    "download-service/internal/models"
)

const presignedURLLifetime = 15 * time.Minute
const tempPrefixTemplate = "temp/%s/"

// FileService handles file-related operations, such as generating download URLs.
type FileService struct {
    storage s3.Interface
}

// NewFileService creates a new FileService.
func NewFileService(storage s3.Interface) *FileService {
    return &FileService{storage: storage}
}

func objectKeyForGame(gameID string) string {
    return fmt.Sprintf("games/%s/game.zip", gameID)
}

// GetDownloadURL generates a presigned URL for a given download.
func (s *FileService) GetDownloadURL(ctx context.Context, download *models.Download) (string, error) {
    objectKey := objectKeyForGame(download.GameID)

    url, err := s.storage.GetPresignedURL(ctx, objectKey, presignedURLLifetime)
    if err != nil {
        return "", fmt.Errorf("could not get presigned URL: %w", err)
    }
    return url, nil
}

// VerifyFile checks object metadata to ensure the expected size matches the stored file.
func (s *FileService) VerifyFile(ctx context.Context, filePath string, expectedSize int64) error {
    if expectedSize <= 0 {
        return derr.ValidationError{Msg: "expectedSize must be greater than zero"}
    }

    info, err := s.storage.StatObject(ctx, filePath)
    if err != nil {
        if errors.Is(err, s3.ErrNotFound) {
            return derr.FileCorruptedError{Path: filePath}
        }
        return fmt.Errorf("stat object: %w", err)
    }
    if info.Size != expectedSize {
        return derr.FileCorruptedError{Path: filePath}
    }
    return nil
}

// CleanupFiles removes temporary chunks used during download assembly.
func (s *FileService) CleanupFiles(ctx context.Context, downloadID string) error {
    prefix := fmt.Sprintf(tempPrefixTemplate, downloadID)
    if err := s.storage.CleanupPrefix(ctx, prefix); err != nil {
        if errors.Is(err, s3.ErrNotFound) {
            // Nothing to cleanup, treat as success.
            return nil
        }
        return fmt.Errorf("cleanup temp files: %w", err)
    }
    return nil
}

// BuildTempObjectKey returns the path for temporary pieces of a download.
func BuildTempObjectKey(downloadID, filename string) string {
    cleaned := strings.TrimPrefix(filename, "/")
    return fmt.Sprintf(tempPrefixTemplate+"%s", downloadID, cleaned)
}
