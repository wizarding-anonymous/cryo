package services

import (
    "context"
    "testing"

    "download-service/internal/clients/s3"
    derr "download-service/internal/errors"
    "download-service/internal/models"
    "github.com/stretchr/testify/require"
)

func TestFileService_VerifyAndCleanup(t *testing.T) {
    mock := s3.NewMockClient()
    fileSvc := NewFileService(mock)

    key := objectKeyForGame("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
    mock.PutObject(key, 1024, nil)

    err := fileSvc.VerifyFile(context.Background(), key, 1024)
    require.NoError(t, err)

    err = fileSvc.VerifyFile(context.Background(), key, 2048)
    require.Error(t, err)
    require.IsType(t, derr.FileCorruptedError{}, err)

    tempKey := BuildTempObjectKey("download-1", "chunk-1")
    mock.PutObject(tempKey, 10, nil)
    require.NoError(t, fileSvc.CleanupFiles(context.Background(), "download-1"))
    require.NoError(t, fileSvc.CleanupFiles(context.Background(), "download-1"))
}

func TestFileService_GetDownloadURL(t *testing.T) {
    mock := s3.NewMockClient()
    fileSvc := NewFileService(mock)
    download := &models.Download{GameID: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"}

    url, err := fileSvc.GetDownloadURL(context.Background(), download)
    require.NoError(t, err)
    require.Contains(t, url, "/games/")
    require.Contains(t, url, "expires_in")
}
