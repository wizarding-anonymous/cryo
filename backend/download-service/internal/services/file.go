package services

import (
    "context"
)

// FileService handles file I/O operations during downloads.
type FileService struct{}

func NewFileService() *FileService { return &FileService{} }

// VerifyFile simulates the file verification step (size/hash).
// In MVP, returns nil (success) without performing I/O.
func (s *FileService) VerifyFile(ctx context.Context, filePath string, expectedSize int64) error {
    return nil
}

// CleanupFiles simulates temporary files cleanup for a given download.
func (s *FileService) CleanupFiles(ctx context.Context, downloadID string) error {
    return nil
}
