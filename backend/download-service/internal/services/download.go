package services

import (
    "context"
    "errors"
    "math"
    "time"

    "download-service/internal/cache"
    lib "download-service/internal/clients/library"
    derr "download-service/internal/errors"
    "download-service/internal/models"
    "download-service/internal/repository"
    "download-service/pkg/logger"

    redis "github.com/redis/go-redis/v9"
    "gorm.io/gorm"
)

type DownloadService struct {
    db       *gorm.DB
    repo     repository.DownloadRepository
    files    repository.DownloadFileRepository
    rdb      *redis.Client
    stream   *StreamService
    library  lib.Interface
    logger   logger.Logger
    // Tuning params for MVP simulation
    defaultTotalSize int64 // bytes
    defaultSpeed     int64 // bytes per tick (1s)
}

func NewDownloadService(db *gorm.DB, rdb *redis.Client, repo repository.DownloadRepository, files repository.DownloadFileRepository, stream *StreamService, library lib.Interface, logger logger.Logger) *DownloadService {
    return &DownloadService{
        db:               db,
        repo:             repo,
        files:            files,
        rdb:              rdb,
        stream:           stream,
        library:          library,
        logger:           logger,
        defaultTotalSize: 128 * 1024 * 1024, // 128MB
        defaultSpeed:     5 * 1024 * 1024,   // 5MB/s
    }
}

func (s *DownloadService) StartDownload(ctx context.Context, userID, gameID string) (*models.Download, error) {
    owned, err := s.library.CheckOwnership(ctx, userID, gameID)
    if err != nil {
        return nil, err
    }
    if !owned {
        return nil, derr.AccessDeniedError{Reason: "game not owned"}
    }

    d := &models.Download{
        UserID:         userID,
        GameID:         gameID,
        Status:         models.StatusDownloading,
        Progress:       0,
        TotalSize:      s.defaultTotalSize,
        DownloadedSize: 0,
        Speed:          s.defaultSpeed,
    }
    if err := s.repo.Create(ctx, d); err != nil {
        return nil, err
    }

    // Start streaming simulation; on each tick update DB and Redis.
    // Use background context so streaming continues after request returns.
    s.stream.Start(context.Background(), d.ID, d.DownloadedSize, d.TotalSize, s.defaultSpeed, func(upd StreamUpdate) bool {
        // Update model
        d.DownloadedSize = upd.DownloadedSize
        d.TotalSize = upd.TotalSize
        d.Speed = upd.Speed
        d.Progress = int(math.Round(float64(d.DownloadedSize) * 100 / float64(d.TotalSize)))
        // Persist
        if err := s.repo.Update(ctx, d); err != nil {
            s.logger.Printf("update progress failed: %v", err)
        }
        // Cache (optional)
        if s.rdb != nil {
            _ = cache.SetDownloadStatus(ctx, s.rdb, d.ID, cache.DownloadStatusValue{
                Status:         string(d.Status),
                Progress:       d.Progress,
                DownloadedSize: d.DownloadedSize,
                TotalSize:      d.TotalSize,
                Speed:          d.Speed,
            }, 30*time.Second)
        }
        return false
    }, func() {
        // Mark completed
        d.Status = models.StatusCompleted
        d.Progress = 100
        if err := s.repo.Update(context.Background(), d); err != nil {
            s.logger.Printf("finalize download failed: %v", err)
        }
        if s.rdb != nil {
            _ = cache.DeleteDownloadStatus(context.Background(), s.rdb, d.ID)
        }
    })

    return d, nil
}

func (s *DownloadService) PauseDownload(ctx context.Context, downloadID string) error {
    d, err := s.repo.GetByID(ctx, downloadID)
    if err != nil {
        if errors.Is(err, gorm.ErrRecordNotFound) {
            return derr.DownloadNotFoundError{ID: downloadID}
        }
        return err
    }
    if d.Status != models.StatusDownloading {
        return nil
    }
    s.stream.Pause(downloadID)
    d.Status = models.StatusPaused
    return s.repo.Update(ctx, d)
}

func (s *DownloadService) ResumeDownload(ctx context.Context, downloadID string) error {
    d, err := s.repo.GetByID(ctx, downloadID)
    if err != nil {
        if errors.Is(err, gorm.ErrRecordNotFound) {
            return derr.DownloadNotFoundError{ID: downloadID}
        }
        return err
    }
    if d.Status != models.StatusPaused {
        return nil
    }
    s.stream.Resume(downloadID)
    d.Status = models.StatusDownloading
    return s.repo.Update(ctx, d)
}

func (s *DownloadService) GetDownload(ctx context.Context, downloadID string) (*models.Download, error) {
    d, err := s.repo.GetByID(ctx, downloadID)
    if err != nil {
        if errors.Is(err, gorm.ErrRecordNotFound) {
            return nil, derr.DownloadNotFoundError{ID: downloadID}
        }
        return nil, err
    }
    return d, nil
}

func (s *DownloadService) ListUserDownloads(ctx context.Context, userID string, limit, offset int) ([]models.Download, error) {
    return s.repo.ListByUser(ctx, userID, limit, offset)
}
