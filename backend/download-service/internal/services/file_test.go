package services

import (
    "context"
    "fmt"
    "sync"
    "testing"

    "download-service/internal/clients/s3"
    derr "download-service/internal/errors"
    "download-service/internal/models"
    "github.com/stretchr/testify/require"
    "github.com/stretchr/testify/suite"
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

// FileServiceSuite provides comprehensive testing with testify/suite
type FileServiceSuite struct {
    suite.Suite
    mockStorage *s3.MockClient
    service     *FileService
}

func (s *FileServiceSuite) SetupTest() {
    s.mockStorage = s3.NewMockClient()
    s.service = NewFileService(s.mockStorage)
}

func (s *FileServiceSuite) TestGetDownloadURL_Success() {
    download := &models.Download{GameID: "test-game-id"}
    
    url, err := s.service.GetDownloadURL(context.Background(), download)
    
    s.NoError(err)
    s.Contains(url, "games/test-game-id/game.zip")
    s.Contains(url, "expires_in")
}

func (s *FileServiceSuite) TestVerifyFile_Success() {
    key := "test-file"
    expectedSize := int64(1024)
    s.mockStorage.PutObject(key, expectedSize, nil)
    
    err := s.service.VerifyFile(context.Background(), key, expectedSize)
    
    s.NoError(err)
}

func (s *FileServiceSuite) TestVerifyFile_SizeMismatch() {
    key := "test-file"
    s.mockStorage.PutObject(key, 1024, nil)
    
    err := s.service.VerifyFile(context.Background(), key, 2048)
    
    s.Error(err)
    s.IsType(derr.FileCorruptedError{}, err)
}

func (s *FileServiceSuite) TestVerifyFile_InvalidSize() {
    err := s.service.VerifyFile(context.Background(), "test-file", 0)
    
    s.Error(err)
    s.IsType(derr.ValidationError{}, err)
}

func (s *FileServiceSuite) TestCleanupFiles_Success() {
    downloadID := "test-download"
    tempKey := BuildTempObjectKey(downloadID, "chunk-1")
    s.mockStorage.PutObject(tempKey, 100, nil)
    
    err := s.service.CleanupFiles(context.Background(), downloadID)
    
    s.NoError(err)
}

func (s *FileServiceSuite) TestCleanupFiles_NoFiles() {
    err := s.service.CleanupFiles(context.Background(), "non-existent")
    
    s.NoError(err) // Should not error when no files to cleanup
}

func (s *FileServiceSuite) TestBuildTempObjectKey() {
    downloadID := "test-download"
    filename := "chunk-1"
    
    key := BuildTempObjectKey(downloadID, filename)
    
    s.Equal("temp/test-download/chunk-1", key)
}

func (s *FileServiceSuite) TestBuildTempObjectKey_WithSlash() {
    downloadID := "test-download"
    filename := "/chunk-1"
    
    key := BuildTempObjectKey(downloadID, filename)
    
    s.Equal("temp/test-download/chunk-1", key)
}

func TestFileServiceSuite(t *testing.T) {
    suite.Run(t, new(FileServiceSuite))
}

// Benchmark tests for file operations
func BenchmarkFileService_GetDownloadURL(b *testing.B) {
    mock := s3.NewMockClient()
    service := NewFileService(mock)
    download := &models.Download{GameID: "benchmark-game-id"}
    ctx := context.Background()
    
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        _, err := service.GetDownloadURL(ctx, download)
        if err != nil {
            b.Fatal(err)
        }
    }
}

func BenchmarkFileService_VerifyFile(b *testing.B) {
    mock := s3.NewMockClient()
    service := NewFileService(mock)
    key := "benchmark-file"
    size := int64(1024 * 1024) // 1MB
    mock.PutObject(key, size, nil)
    ctx := context.Background()
    
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        err := service.VerifyFile(ctx, key, size)
        if err != nil {
            b.Fatal(err)
        }
    }
}

func BenchmarkFileService_CleanupFiles(b *testing.B) {
    mock := s3.NewMockClient()
    service := NewFileService(mock)
    ctx := context.Background()
    
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        downloadID := fmt.Sprintf("benchmark-download-%d", i)
        // Setup temp files
        for j := 0; j < 10; j++ {
            tempKey := BuildTempObjectKey(downloadID, fmt.Sprintf("chunk-%d", j))
            mock.PutObject(tempKey, 100, nil)
        }
        
        err := service.CleanupFiles(ctx, downloadID)
        if err != nil {
            b.Fatal(err)
        }
    }
}

func BenchmarkFileService_BuildTempObjectKey(b *testing.B) {
    downloadID := "benchmark-download"
    filename := "benchmark-chunk"
    
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        _ = BuildTempObjectKey(downloadID, filename)
    }
}

// Concurrent tests for file operations
func TestFileService_ConcurrentGetDownloadURL(t *testing.T) {
    mock := s3.NewMockClient()
    service := NewFileService(mock)
    ctx := context.Background()
    
    const numGoroutines = 100
    const numOperations = 10
    
    var wg sync.WaitGroup
    errors := make(chan error, numGoroutines*numOperations)
    
    for i := 0; i < numGoroutines; i++ {
        wg.Add(1)
        go func(id int) {
            defer wg.Done()
            for j := 0; j < numOperations; j++ {
                download := &models.Download{GameID: fmt.Sprintf("game-%d-%d", id, j)}
                _, err := service.GetDownloadURL(ctx, download)
                if err != nil {
                    errors <- err
                    return
                }
            }
        }(i)
    }
    
    wg.Wait()
    close(errors)
    
    for err := range errors {
        t.Errorf("Concurrent GetDownloadURL failed: %v", err)
    }
}

func TestFileService_ConcurrentVerifyFile(t *testing.T) {
    mock := s3.NewMockClient()
    service := NewFileService(mock)
    ctx := context.Background()
    
    // Setup test files
    const numFiles = 50
    for i := 0; i < numFiles; i++ {
        key := fmt.Sprintf("concurrent-file-%d", i)
        mock.PutObject(key, int64(1024+i), nil)
    }
    
    const numGoroutines = 20
    var wg sync.WaitGroup
    errors := make(chan error, numGoroutines*numFiles)
    
    for i := 0; i < numGoroutines; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            for j := 0; j < numFiles; j++ {
                key := fmt.Sprintf("concurrent-file-%d", j)
                err := service.VerifyFile(ctx, key, int64(1024+j))
                if err != nil {
                    errors <- err
                    return
                }
            }
        }()
    }
    
    wg.Wait()
    close(errors)
    
    for err := range errors {
        t.Errorf("Concurrent VerifyFile failed: %v", err)
    }
}

func TestFileService_ConcurrentCleanupFiles(t *testing.T) {
    mock := s3.NewMockClient()
    service := NewFileService(mock)
    ctx := context.Background()
    
    const numGoroutines = 30
    var wg sync.WaitGroup
    errors := make(chan error, numGoroutines)
    
    for i := 0; i < numGoroutines; i++ {
        wg.Add(1)
        go func(id int) {
            defer wg.Done()
            downloadID := fmt.Sprintf("concurrent-download-%d", id)
            
            // Setup temp files for this download
            for j := 0; j < 5; j++ {
                tempKey := BuildTempObjectKey(downloadID, fmt.Sprintf("chunk-%d", j))
                mock.PutObject(tempKey, 100, nil)
            }
            
            err := service.CleanupFiles(ctx, downloadID)
            if err != nil {
                errors <- err
                return
            }
        }(i)
    }
    
    wg.Wait()
    close(errors)
    
    for err := range errors {
        t.Errorf("Concurrent CleanupFiles failed: %v", err)
    }
}
