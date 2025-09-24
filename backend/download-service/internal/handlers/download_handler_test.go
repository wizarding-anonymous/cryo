package handlers

import (
    "bytes"
    "context"
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "sync"
    "testing"
    "time"

    "github.com/gin-gonic/gin"
    "github.com/stretchr/testify/suite"

    "download-service/internal/models"
    "download-service/internal/services"
    plog "download-service/pkg/logger"
    "gorm.io/gorm"
)

type downloadHandlerSuite struct {
    suite.Suite
    repo        *memDownloadRepo
    stream      *services.StreamService
    svc         *services.DownloadService
    router      *gin.Engine
    authUserID  string
    libraryMock mockLibrary
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
        d.ID = time.Now().Format("150405.000000")
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
    v, ok := r.m[id]
    if !ok {
        return nil, gorm.ErrRecordNotFound
    }
    vv := v
    return &vv, nil
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
    if _, ok := r.m[id]; !ok {
        return gorm.ErrRecordNotFound
    }
    delete(r.m, id)
    return nil
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

type mockLibrary struct{ owned bool }

func (m mockLibrary) CheckOwnership(ctx context.Context, userID, gameID string) (bool, error) { return m.owned, nil }
func (m mockLibrary) ListUserGames(ctx context.Context, userID string) ([]string, error)  { return nil, nil }

func TestDownloadHandlerSuite(t *testing.T) {
    gin.SetMode(gin.TestMode)
    suite.Run(t, new(downloadHandlerSuite))
}

func (s *downloadHandlerSuite) SetupTest() {
    s.repo = newMemDownloadRepo()
    s.stream = services.NewStreamService()
    s.libraryMock = mockLibrary{owned: true}
    s.svc = services.NewDownloadService(nil, nil, s.repo, s.stream, s.libraryMock, plog.New())

    s.router = gin.New()
    middlewareSuite := s
    s.router.Use(func(c *gin.Context) {
        if middlewareSuite.authUserID != "" {
            c.Set("auth_user_id", middlewareSuite.authUserID)
        }
        c.Next()
    })
    handler := NewDownloadHandler(s.svc, nil)
    handler.RegisterRoutes(s.router.Group("/api"))
}

func (s *downloadHandlerSuite) TestStartDownload() {
    s.authUserID = "00000000-0000-0000-0000-000000000001"
    body := map[string]string{"gameId": "11111111-1111-4111-8111-111111111111"}
    b, _ := json.Marshal(body)
    req := httptest.NewRequest(http.MethodPost, "/api/downloads", bytes.NewReader(b))
    req.Header.Set("Content-Type", "application/json")
    resp := httptest.NewRecorder()

    s.router.ServeHTTP(resp, req)
    if resp.Code != http.StatusCreated {
        s.T().Logf("Response body: %s", resp.Body.String())
    }
    s.Equal(http.StatusCreated, resp.Code)
}

func (s *downloadHandlerSuite) TestCancelDownload() {
    s.authUserID = "00000000-0000-0000-0000-000000000002"
    _ = s.repo.Create(context.Background(), &models.Download{ID: "dl-to-cancel", UserID: s.authUserID, Status: models.StatusDownloading})

    req := httptest.NewRequest(http.MethodDelete, "/api/downloads/dl-to-cancel", nil)
    resp := httptest.NewRecorder()

    s.router.ServeHTTP(resp, req)
    s.Equal(http.StatusNoContent, resp.Code)

    d, err := s.repo.GetByID(context.Background(), "dl-to-cancel")
    s.Require().NoError(err)
    s.Equal(models.StatusCancelled, d.Status)
}

func (s *downloadHandlerSuite) TestAuthorization() {
    s.authUserID = "00000000-0000-0000-0000-000000000022"
    _ = s.repo.Create(context.Background(), &models.Download{ID: "dl-owned", UserID: "00000000-0000-0000-0000-000000000011"})

    req := httptest.NewRequest(http.MethodGet, "/api/downloads/dl-owned", nil)
    resp := httptest.NewRecorder()

    s.router.ServeHTTP(resp, req)
    s.Equal(http.StatusForbidden, resp.Code)
}
func (s *downloadHandlerSuite) TestStartDownloadValidation() {
    s.authUserID = "00000000-0000-0000-0000-000000000001"
    req := httptest.NewRequest(http.MethodPost, "/api/downloads", bytes.NewReader([]byte(`{}`)))
    req.Header.Set("Content-Type", "application/json")
    resp := httptest.NewRecorder()

    s.router.ServeHTTP(resp, req)
    s.Equal(http.StatusBadRequest, resp.Code)
}

func (s *downloadHandlerSuite) TestListUserDownloads() {
    s.authUserID = "00000000-0000-0000-0000-000000000003"
    _ = s.repo.Create(context.Background(), &models.Download{ID: "dl-list", UserID: s.authUserID, Status: models.StatusPaused})

    req := httptest.NewRequest(http.MethodGet, "/api/users/00000000-0000-0000-0000-000000000003/downloads", nil)
    resp := httptest.NewRecorder()

    s.router.ServeHTTP(resp, req)
    s.Equal(http.StatusOK, resp.Code)
    s.Contains(resp.Body.String(), "dl-list")
}

