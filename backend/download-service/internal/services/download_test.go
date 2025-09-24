package services

import (
    "context"
    "errors"
    "fmt"
    "sync"
    "sync/atomic"
    "testing"
    "time"

    derr "download-service/internal/errors"
    "download-service/internal/models"
    "download-service/pkg/logger"
    "github.com/stretchr/testify/suite"
    "gorm.io/gorm"
)

type downloadServiceSuite struct {
    suite.Suite
    repo   *memDownloadRepo
    stream *StreamService
    svc    *DownloadService
}

type memDownloadRepo struct {
    mu  sync.Mutex
    m   map[string]models.Download
    seq int
}

func newMemDownloadRepo() *memDownloadRepo { return &memDownloadRepo{m: make(map[string]models.Download)} }

func (r *memDownloadRepo) Create(ctx context.Context, d *models.Download) error {
    r.mu.Lock()
    defer r.mu.Unlock()
    r.seq++
    if d.ID == "" {
        d.ID = fmtID(r.seq)
    }
    now := time.Now()
    d.CreatedAt = now
    d.UpdatedAt = now
    r.m[d.ID] = *d
    return nil
}

func (r *memDownloadRepo) GetByID(ctx context.Context, id string) (*models.Download, error) {
    r.mu.Lock()
    defer r.mu.Unlock()
    if v, ok := r.m[id]; ok {
        vv := v
        return &vv, nil
    }
    return nil, gorm.ErrRecordNotFound
}

func (r *memDownloadRepo) Update(ctx context.Context, d *models.Download) error {
    r.mu.Lock()
    defer r.mu.Unlock()
    if _, ok := r.m[d.ID]; !ok {
        return gorm.ErrRecordNotFound
    }
    d.UpdatedAt = time.Now()
    r.m[d.ID] = *d
    return nil
}

func (r *memDownloadRepo) ListByUser(ctx context.Context, userID string, limit, offset int) ([]models.Download, error) {
    r.mu.Lock()
    defer r.mu.Unlock()
    out := make([]models.Download, 0)
    for _, v := range r.m {
        if v.UserID == userID {
            out = append(out, v)
        }
    }
    return out, nil
}

func (r *memDownloadRepo) GetByIDWithFiles(ctx context.Context, id string) (*models.Download, error) {
    return r.GetByID(ctx, id)
}

func (r *memDownloadRepo) UpdateStatus(ctx context.Context, id string, status models.DownloadStatus) error {
    r.mu.Lock()
    defer r.mu.Unlock()
    if d, ok := r.m[id]; ok {
        d.Status = status
        d.UpdatedAt = time.Now()
        r.m[id] = d
        return nil
    }
    return gorm.ErrRecordNotFound
}

func (r *memDownloadRepo) UpdateProgress(ctx context.Context, id string, progress int, downloadedSize int64, speed int64) error {
    r.mu.Lock()
    defer r.mu.Unlock()
    if d, ok := r.m[id]; ok {
        d.Progress = progress
        d.DownloadedSize = downloadedSize
        d.Speed = speed
        d.UpdatedAt = time.Now()
        r.m[id] = d
        return nil
    }
    return gorm.ErrRecordNotFound
}

func (r *memDownloadRepo) ListByUserAndStatus(ctx context.Context, userID string, status models.DownloadStatus, limit, offset int) ([]models.Download, error) {
    r.mu.Lock()
    defer r.mu.Unlock()
    out := make([]models.Download, 0)
    for _, v := range r.m {
        if v.UserID == userID && v.Status == status {
            out = append(out, v)
        }
    }
    return out, nil
}

func (r *memDownloadRepo) Delete(ctx context.Context, id string) error {
    r.mu.Lock()
    defer r.mu.Unlock()
    if _, ok := r.m[id]; ok {
        delete(r.m, id)
        return nil
    }
    return gorm.ErrRecordNotFound
}

func (r *memDownloadRepo) CountByUser(ctx context.Context, userID string) (int64, error) {
    r.mu.Lock()
    defer r.mu.Unlock()
    count := int64(0)
    for _, v := range r.m {
        if v.UserID == userID {
            count++
        }
    }
    return count, nil
}

type mockLibrary struct {
    owned bool
    err   error
}

func (m mockLibrary) CheckOwnership(ctx context.Context, userID, gameID string) (bool, error) { return m.owned, m.err }
func (m mockLibrary) ListUserGames(ctx context.Context, userID string) ([]string, error)  { return nil, nil }

func fmtID(i int) string {
    return "dl-" + time.Now().Format("150405") + "-" + string(rune('a'+(i%26)))
}

func (s *downloadServiceSuite) SetupTest() {
    s.repo = newMemDownloadRepo()
    s.stream = NewStreamService()
    s.svc = NewDownloadService(nil, nil, s.repo, s.stream, mockLibrary{owned: true}, logger.New())
    s.svc.defaultTotalSize = 512 * 1024
    s.svc.defaultSpeed = 512 * 1024
}

func (s *downloadServiceSuite) TestStartDownloadDenied() {
    svc := NewDownloadService(nil, nil, s.repo, s.stream, mockLibrary{owned: false}, logger.New())
    _, err := svc.StartDownload(context.Background(), "00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002")
    s.Require().Error(err)
    s.Require().True(errors.As(err, &derr.AccessDeniedError{}))
}

func (s *downloadServiceSuite) TestStartPauseResume() {
    userID := "10000000-0000-0000-0000-000000000001"
    gameID := "20000000-0000-0000-0000-000000000001"

    d, err := s.svc.StartDownload(context.Background(), userID, gameID)
    s.Require().NoError(err)
    s.Require().NotEmpty(d.ID)
    s.Require().Equal(models.StatusDownloading, d.Status)

    s.Require().NoError(s.svc.PauseDownload(context.Background(), userID, d.ID))
    paused, err := s.svc.GetDownload(context.Background(), userID, d.ID)
    s.Require().NoError(err)
    s.Require().Equal(models.StatusPaused, paused.Status)

    s.Require().NoError(s.svc.ResumeDownload(context.Background(), userID, d.ID))
    resumed, err := s.svc.GetDownload(context.Background(), userID, d.ID)
    s.Require().NoError(err)
    s.Require().Equal(models.StatusDownloading, resumed.Status)
}

func (s *downloadServiceSuite) TestActionsAccessDenied() {
    ownerID := "10000000-0000-0000-0000-000000000011"
    attackerID := "10000000-0000-0000-0000-000000000022"
    _ = s.repo.Create(context.Background(), &models.Download{ID: "dl-1", UserID: ownerID})

    _, err := s.svc.GetDownload(context.Background(), attackerID, "dl-1")
    s.Require().True(errors.As(err, &derr.AccessDeniedError{}))

    s.Require().True(errors.As(s.svc.PauseDownload(context.Background(), attackerID, "dl-1"), &derr.AccessDeniedError{}))
    s.Require().True(errors.As(s.svc.ResumeDownload(context.Background(), attackerID, "dl-1"), &derr.AccessDeniedError{}))
    s.Require().True(errors.As(s.svc.CancelDownload(context.Background(), attackerID, "dl-1"), &derr.AccessDeniedError{}))
    s.Require().True(errors.As(s.svc.SetDownloadSpeed(context.Background(), attackerID, "dl-1", 128), &derr.AccessDeniedError{}))
}

func (s *downloadServiceSuite) TestSetDownloadSpeedValidation() {
    userID := "30000000-0000-0000-0000-000000000001"
    gameID := "40000000-0000-0000-0000-000000000001"
    d, err := s.svc.StartDownload(context.Background(), userID, gameID)
    s.Require().NoError(err)

    err = s.svc.SetDownloadSpeed(context.Background(), userID, d.ID, -1)
    s.Require().True(errors.As(err, &derr.ValidationError{}))

    s.Require().NoError(s.svc.SetDownloadSpeed(context.Background(), userID, d.ID, 1024))
}

func TestDownloadServiceSuite(t *testing.T) {
    suite.Run(t, new(downloadServiceSuite))
}

// Benchmark tests for download operations
func BenchmarkDownloadService_StartDownload(b *testing.B) {
    repo := newMemDownloadRepo()
    stream := NewStreamService()
    svc := NewDownloadService(nil, nil, repo, stream, mockLibrary{owned: true}, logger.New())
    ctx := context.Background()
    
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        userID := fmt.Sprintf("user-%d", i)
        gameID := fmt.Sprintf("game-%d", i)
        _, err := svc.StartDownload(ctx, userID, gameID)
        if err != nil {
            b.Fatal(err)
        }
    }
}

func BenchmarkDownloadService_GetDownload(b *testing.B) {
    repo := newMemDownloadRepo()
    stream := NewStreamService()
    svc := NewDownloadService(nil, nil, repo, stream, mockLibrary{owned: true}, logger.New())
    ctx := context.Background()
    
    // Setup test downloads
    const numDownloads = 1000
    downloads := make([]string, numDownloads)
    userID := "benchmark-user"
    
    for i := 0; i < numDownloads; i++ {
        gameID := fmt.Sprintf("game-%d", i)
        d, err := svc.StartDownload(ctx, userID, gameID)
        if err != nil {
            b.Fatal(err)
        }
        downloads[i] = d.ID
    }
    
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        downloadID := downloads[i%numDownloads]
        _, err := svc.GetDownload(ctx, userID, downloadID)
        if err != nil {
            b.Fatal(err)
        }
    }
}

func BenchmarkDownloadService_UpdateProgress(b *testing.B) {
    repo := newMemDownloadRepo()
    stream := NewStreamService()
    svc := NewDownloadService(nil, nil, repo, stream, mockLibrary{owned: true}, logger.New())
    ctx := context.Background()
    
    userID := "benchmark-user"
    gameID := "benchmark-game"
    d, err := svc.StartDownload(ctx, userID, gameID)
    if err != nil {
        b.Fatal(err)
    }
    
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        progress := i % 100
        err := repo.UpdateProgress(ctx, d.ID, progress, int64(progress*1024), int64(1024))
        if err != nil {
            b.Fatal(err)
        }
    }
}

// Concurrent tests for download operations
func TestDownloadService_ConcurrentStartDownload(t *testing.T) {
    repo := newMemDownloadRepo()
    stream := NewStreamService()
    svc := NewDownloadService(nil, nil, repo, stream, mockLibrary{owned: true}, logger.New())
    ctx := context.Background()
    
    const numGoroutines = 50
    const downloadsPerGoroutine = 10
    
    var wg sync.WaitGroup
    errors := make(chan error, numGoroutines*downloadsPerGoroutine)
    downloadIDs := make(chan string, numGoroutines*downloadsPerGoroutine)
    
    for i := 0; i < numGoroutines; i++ {
        wg.Add(1)
        go func(goroutineID int) {
            defer wg.Done()
            for j := 0; j < downloadsPerGoroutine; j++ {
                userID := fmt.Sprintf("user-%d", goroutineID)
                gameID := fmt.Sprintf("game-%d-%d", goroutineID, j)
                
                download, err := svc.StartDownload(ctx, userID, gameID)
                if err != nil {
                    errors <- err
                    return
                }
                downloadIDs <- download.ID
            }
        }(i)
    }
    
    wg.Wait()
    close(errors)
    close(downloadIDs)
    
    // Check for errors
    for err := range errors {
        t.Errorf("Concurrent StartDownload failed: %v", err)
    }
    
    // Verify all downloads were created
    downloadCount := 0
    for range downloadIDs {
        downloadCount++
    }
    
    expected := numGoroutines * downloadsPerGoroutine
    if downloadCount != expected {
        t.Errorf("Expected %d downloads, got %d", expected, downloadCount)
    }
}

func TestDownloadService_ConcurrentPauseResume(t *testing.T) {
    repo := newMemDownloadRepo()
    stream := NewStreamService()
    svc := NewDownloadService(nil, nil, repo, stream, mockLibrary{owned: true}, logger.New())
    ctx := context.Background()
    
    // Create initial downloads
    const numDownloads = 20
    downloads := make([]string, numDownloads)
    userID := "concurrent-user"
    
    for i := 0; i < numDownloads; i++ {
        gameID := fmt.Sprintf("concurrent-game-%d", i)
        d, err := svc.StartDownload(ctx, userID, gameID)
        if err != nil {
            t.Fatal(err)
        }
        downloads[i] = d.ID
    }
    
    var wg sync.WaitGroup
    errors := make(chan error, numDownloads*4) // pause + resume + pause + resume
    
    // Concurrent pause/resume operations
    for i := 0; i < numDownloads; i++ {
        wg.Add(1)
        go func(downloadID string) {
            defer wg.Done()
            
            // Pause
            if err := svc.PauseDownload(ctx, userID, downloadID); err != nil {
                errors <- err
                return
            }
            
            // Resume
            if err := svc.ResumeDownload(ctx, userID, downloadID); err != nil {
                errors <- err
                return
            }
            
            // Pause again
            if err := svc.PauseDownload(ctx, userID, downloadID); err != nil {
                errors <- err
                return
            }
            
            // Resume again
            if err := svc.ResumeDownload(ctx, userID, downloadID); err != nil {
                errors <- err
                return
            }
        }(downloads[i])
    }
    
    wg.Wait()
    close(errors)
    
    for err := range errors {
        t.Errorf("Concurrent pause/resume failed: %v", err)
    }
}

func TestDownloadService_ConcurrentProgressUpdates(t *testing.T) {
    repo := newMemDownloadRepo()
    stream := NewStreamService()
    svc := NewDownloadService(nil, nil, repo, stream, mockLibrary{owned: true}, logger.New())
    ctx := context.Background()
    
    userID := "progress-user"
    gameID := "progress-game"
    d, err := svc.StartDownload(ctx, userID, gameID)
    if err != nil {
        t.Fatal(err)
    }
    
    const numGoroutines = 10
    const updatesPerGoroutine = 20
    
    var wg sync.WaitGroup
    errors := make(chan error, numGoroutines*updatesPerGoroutine)
    
    for i := 0; i < numGoroutines; i++ {
        wg.Add(1)
        go func(goroutineID int) {
            defer wg.Done()
            for j := 0; j < updatesPerGoroutine; j++ {
                progress := (goroutineID*updatesPerGoroutine + j) % 100
                downloadedSize := int64(progress * 1024)
                speed := int64(1024 + goroutineID*100)
                
                err := repo.UpdateProgress(ctx, d.ID, progress, downloadedSize, speed)
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
        t.Errorf("Concurrent progress update failed: %v", err)
    }
    
    // Verify final state
    finalDownload, err := svc.GetDownload(ctx, userID, d.ID)
    if err != nil {
        t.Fatal(err)
    }
    
    if finalDownload.Progress < 0 || finalDownload.Progress > 100 {
        t.Errorf("Invalid final progress: %d", finalDownload.Progress)
    }
}

func TestDownloadService_ConcurrentAccessControl(t *testing.T) {
    repo := newMemDownloadRepo()
    stream := NewStreamService()
    svc := NewDownloadService(nil, nil, repo, stream, mockLibrary{owned: true}, logger.New())
    ctx := context.Background()
    
    ownerID := "owner-user"
    gameID := "access-control-game"
    d, err := svc.StartDownload(ctx, ownerID, gameID)
    if err != nil {
        t.Fatal(err)
    }
    
    const numAttackers = 20
    var wg sync.WaitGroup
    accessDeniedCount := int32(0)
    
    for i := 0; i < numAttackers; i++ {
        wg.Add(1)
        go func(attackerID int) {
            defer wg.Done()
            attackerUserID := fmt.Sprintf("attacker-%d", attackerID)
            
            // Try to access download (should fail)
            _, err := svc.GetDownload(ctx, attackerUserID, d.ID)
            if err != nil {
                var accessErr derr.AccessDeniedError
                if errors.As(err, &accessErr) {
                    atomic.AddInt32(&accessDeniedCount, 1)
                }
            }
            
            // Try to pause download (should fail)
            err = svc.PauseDownload(ctx, attackerUserID, d.ID)
            if err != nil {
                var accessErr derr.AccessDeniedError
                if errors.As(err, &accessErr) {
                    atomic.AddInt32(&accessDeniedCount, 1)
                }
            }
        }(i)
    }
    
    wg.Wait()
    
    // All access attempts should be denied
    expectedDenials := int32(numAttackers * 2) // GetDownload + PauseDownload
    if accessDeniedCount != expectedDenials {
        t.Errorf("Expected %d access denials, got %d", expectedDenials, accessDeniedCount)
    }
}

