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

    "download-service/internal/models"
    "download-service/internal/services"
    plog "download-service/pkg/logger"
    "gorm.io/gorm"
)

// In-memory implementations for repository and library client
type memDownloadRepo struct{ mu sync.Mutex; m map[string]models.Download; seq int }
func newMemDownloadRepo() *memDownloadRepo { return &memDownloadRepo{m: make(map[string]models.Download)} }
func (r *memDownloadRepo) Create(ctx context.Context, d *models.Download) error { r.mu.Lock(); defer r.mu.Unlock(); r.seq++; if d.ID==""{ d.ID = time.Now().Format("150405.000000") }; now:=time.Now(); d.CreatedAt=now; d.UpdatedAt=now; r.m[d.ID]=*d; return nil }
func (r *memDownloadRepo) GetByID(ctx context.Context, id string) (*models.Download, error) { r.mu.Lock(); defer r.mu.Unlock(); v,ok:=r.m[id]; if !ok { return nil, gorm.ErrRecordNotFound }; vv:=v; return &vv, nil }
func (r *memDownloadRepo) Update(ctx context.Context, d *models.Download) error { r.mu.Lock(); defer r.mu.Unlock(); if _,ok:=r.m[d.ID]; !ok { return gorm.ErrRecordNotFound }; d.UpdatedAt=time.Now(); r.m[d.ID]=*d; return nil }
func (r *memDownloadRepo) ListByUser(ctx context.Context, userID string, limit, offset int) ([]models.Download, error) { r.mu.Lock(); defer r.mu.Unlock(); out:=[]models.Download{}; for _,v:=range r.m{ if v.UserID==userID { out=append(out,v)} }; return out, nil }

type noopFileRepo struct{}
func (noopFileRepo) Create(ctx context.Context, f *models.DownloadFile) error { return nil }
func (noopFileRepo) ListByDownload(ctx context.Context, downloadID string) ([]models.DownloadFile, error) { return nil, nil }
func (noopFileRepo) Update(ctx context.Context, f *models.DownloadFile) error { return nil }

type mockLibrary struct{ owned bool }
func (m mockLibrary) CheckOwnership(ctx context.Context, userID, gameID string) (bool, error) { return m.owned, nil }
func (m mockLibrary) ListUserGames(ctx context.Context, userID string) ([]string, error) { return nil, nil }

// Test POST /downloads happy path
func TestStartDownloadHandler(t *testing.T) {
    t.Parallel()
    gin.SetMode(gin.TestMode)

    repo := newMemDownloadRepo()
    svc := services.NewDownloadService(nil, nil, repo, noopFileRepo{}, services.NewStreamService(), mockLibrary{owned: true}, plog.New())
    r := gin.New()
    h := NewDownloadHandler(svc, nil)
    h.RegisterRoutes(r.Group(""))

    body := map[string]string{"userId": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "gameId": "0b9a1f93-1c01-4f2f-9a31-0a1f7a1d2a6f"}
    b, _ := json.Marshal(body)
    req := httptest.NewRequest(http.MethodPost, "/downloads", bytes.NewReader(b))
    req.Header.Set("Content-Type", "application/json")
    w := httptest.NewRecorder()
    r.ServeHTTP(w, req)
    if w.Code != http.StatusCreated {
        t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
    }
}
