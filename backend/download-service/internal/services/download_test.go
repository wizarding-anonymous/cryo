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

