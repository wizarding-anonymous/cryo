package services

import (
    "context"
    "errors"
    "sync"
    "testing"
    "time"

    derr "download-service/internal/errors"
    "download-service/internal/models"
    "download-service/pkg/logger"
    "gorm.io/gorm"
)

type memDownloadRepo struct{
    mu sync.Mutex
    m map[string]models.Download
    seq int
}
func newMemDownloadRepo() *memDownloadRepo { return &memDownloadRepo{m: make(map[string]models.Download)} }
func (r *memDownloadRepo) Create(ctx context.Context, d *models.Download) error {
    r.mu.Lock(); defer r.mu.Unlock()
    r.seq++; if d.ID == "" { d.ID =  fmtID(r.seq) }
    now := time.Now(); d.CreatedAt = now; d.UpdatedAt = now
    r.m[d.ID] = *d
    return nil
}
func (r *memDownloadRepo) GetByID(ctx context.Context, id string) (*models.Download, error) {
    r.mu.Lock(); defer r.mu.Unlock()
    if v, ok := r.m[id]; ok { vv := v; return &vv, nil }
    return nil, gorm.ErrRecordNotFound
}
func (r *memDownloadRepo) Update(ctx context.Context, d *models.Download) error {
    r.mu.Lock(); defer r.mu.Unlock()
    if _, ok := r.m[d.ID]; !ok { return gorm.ErrRecordNotFound }
    d.UpdatedAt = time.Now()
    r.m[d.ID] = *d
    return nil
}
func (r *memDownloadRepo) ListByUser(ctx context.Context, userID string, limit, offset int) ([]models.Download, error) {
    r.mu.Lock(); defer r.mu.Unlock()
    out := make([]models.Download, 0)
    for _, v := range r.m { if v.UserID == userID { out = append(out, v) } }
    return out, nil
}

type noopFileRepo struct{}
func (noopFileRepo) Create(ctx context.Context, f *models.DownloadFile) error { return nil }
func (noopFileRepo) ListByDownload(ctx context.Context, downloadID string) ([]models.DownloadFile, error) { return nil, nil }
func (noopFileRepo) Update(ctx context.Context, f *models.DownloadFile) error { return nil }

type mockLibrary struct{ owned bool; err error }
func (m mockLibrary) CheckOwnership(ctx context.Context, userID, gameID string) (bool, error) { return m.owned, m.err }
func (m mockLibrary) ListUserGames(ctx context.Context, userID string) ([]string, error) { return nil, nil }

func fmtID(i int) string { return  "dl-" + time.Now().Format("150405") + "-" +  string(rune('a'+(i%26))) }

func TestDownloadService_StartDownload_AccessDenied(t *testing.T) {
    repo := newMemDownloadRepo()
    svc := NewDownloadService(nil, nil, repo, noopFileRepo{}, NewStreamService(), mockLibrary{owned: false}, logger.New())
    _, err := svc.StartDownload(context.Background(), "00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002")
    if err == nil {
        t.Fatal("expected error, got nil")
    }
    var ad derr.AccessDeniedError
    if !errors.As(err, &ad) {
        t.Fatalf("expected AccessDeniedError, got %T", err)
    }
}

func TestDownloadService_StartPauseResume(t *testing.T) {
    repo := newMemDownloadRepo()
    stream := NewStreamService()
    svc := NewDownloadService(nil, nil, repo, noopFileRepo{}, stream, mockLibrary{owned: true}, logger.New())
    userID := "10000000-0000-0000-0000-000000000001"
    gameID := "20000000-0000-0000-0000-000000000001"
    // speed up
    svc.defaultTotalSize = 1024 * 1024
    svc.defaultSpeed = 1024 * 1024
    d, err := svc.StartDownload(context.Background(), userID, gameID)
    if err != nil {
        t.Fatalf("start: %v", err)
    }
    if d.ID == "" {
        t.Fatal("expected id generated")
    }
    if d.Status != models.StatusDownloading {
        t.Fatalf("expected downloading, got %s", d.Status)
    }
    // Pause and resume
    if err := svc.PauseDownload(context.Background(), userID, d.ID); err != nil {
        t.Fatalf("pause: %v", err)
    }
    dd, _ := svc.GetDownload(context.Background(), userID, d.ID)
    if dd.Status != models.StatusPaused {
        t.Fatalf("expected paused, got %s", dd.Status)
    }
    if err := svc.ResumeDownload(context.Background(), userID, d.ID); err != nil {
        t.Fatalf("resume: %v", err)
    }
}

func TestDownloadService_Actions_AccessDenied(t *testing.T) {
    repo := newMemDownloadRepo()
    ownerID := "10000000-0000-0000-0000-000000000011"
    attackerID := "10000000-0000-0000-0000-000000000022"
    // ownerID owns this download
    _ = repo.Create(context.Background(), &models.Download{ID: "dl-1", UserID: ownerID})

    svc := NewDownloadService(nil, nil, repo, noopFileRepo{}, NewStreamService(), mockLibrary{owned: true}, logger.New())

    // attackerID tries to access it
    _, err := svc.GetDownload(context.Background(), attackerID, "dl-1")
    if !errors.As(err, &derr.AccessDeniedError{}) {
        t.Fatalf("expected access denied on GetDownload, got %T", err)
    }

    err = svc.PauseDownload(context.Background(), attackerID, "dl-1")
    if !errors.As(err, &derr.AccessDeniedError{}) {
        t.Fatalf("expected access denied on PauseDownload, got %T", err)
    }

    err = svc.ResumeDownload(context.Background(), attackerID, "dl-1")
    if !errors.As(err, &derr.AccessDeniedError{}) {
        t.Fatalf("expected access denied on ResumeDownload, got %T", err)
    }

    err = svc.CancelDownload(context.Background(), attackerID, "dl-1")
    if !errors.As(err, &derr.AccessDeniedError{}) {
        t.Fatalf("expected access denied on CancelDownload, got %T", err)
    }

    err = svc.SetDownloadSpeed(context.Background(), attackerID, "dl-1", 123)
    if !errors.As(err, &derr.AccessDeniedError{}) {
        t.Fatalf("expected access denied on SetDownloadSpeed, got %T", err)
    }
}
