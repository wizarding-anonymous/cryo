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
    "download-service/internal/observability"
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
        logger.Error(s.logger, "library ownership check failed", "error", err, "userID", userID, "gameID", gameID)
        return nil, err
    }
    if !owned {
        err := derr.AccessDeniedError{Reason: "game not owned"}
        logger.Info(s.logger, "user denied access to game", "error", err, "userID", userID, "gameID", gameID)
        return nil, err
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
        logger.Error(s.logger, "failed to create download record", "error", err)
        return nil, err
    }

    logger.Info(s.logger, "download started", "downloadID", d.ID, "userID", d.UserID, "gameID", d.GameID)
    observability.RecordDownloadStatus(observability.StatusStarted)
    observability.IncActiveDownloads()

    // Start streaming simulation; on each tick update DB and Redis.
    // Use background context so streaming continues after request returns.
    s.stream.Start(context.Background(), d.ID, d.DownloadedSize, d.TotalSize, s.defaultSpeed, func(upd StreamUpdate) bool {
        bytesSinceLastTick := upd.DownloadedSize - d.DownloadedSize
        observability.AddDownloadedBytes(float64(bytesSinceLastTick))
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
            logger.Error(s.logger, "finalize download failed", "error", err, "downloadID", d.ID)
        }
        if s.rdb != nil {
            _ = cache.DeleteDownloadStatus(context.Background(), s.rdb, d.ID)
        }
        logger.Info(s.logger, "download completed", "downloadID", d.ID)
        observability.RecordDownloadStatus(observability.StatusCompleted)
        observability.DecActiveDownloads()
    })

    return d, nil
}

func (s *DownloadService) PauseDownload(ctx context.Context, userID, downloadID string) error {
    d, err := s.repo.GetByID(ctx, downloadID)
    if err != nil {
        if errors.Is(err, gorm.ErrRecordNotFound) {
            return derr.DownloadNotFoundError{ID: downloadID}
        }
        return err
    }
    if d.UserID != userID {
        err := derr.AccessDeniedError{Reason: "not owner of download"}
        logger.Info(s.logger, "pause download access denied", "error", err, "authUserID", userID, "downloadID", downloadID)
        return err
    }
    if d.Status != models.StatusDownloading {
        return nil
    }
    s.stream.Pause(downloadID)
    d.Status = models.StatusPaused
    err = s.repo.Update(ctx, d)
    if err == nil {
        logger.Info(s.logger, "download paused", "downloadID", d.ID)
    }
    return err
}

func (s *DownloadService) ResumeDownload(ctx context.Context, userID, downloadID string) error {
    d, err := s.repo.GetByID(ctx, downloadID)
    if err != nil {
        if errors.Is(err, gorm.ErrRecordNotFound) {
            return derr.DownloadNotFoundError{ID: downloadID}
        }
        return err
    }
    if d.UserID != userID {
        err := derr.AccessDeniedError{Reason: "not owner of download"}
        logger.Info(s.logger, "resume download access denied", "error", err, "authUserID", userID, "downloadID", downloadID)
        return err
    }
    if d.Status != models.StatusPaused {
        return nil
    }
    s.stream.Resume(downloadID)
    d.Status = models.StatusDownloading
    err = s.repo.Update(ctx, d)
    if err == nil {
        logger.Info(s.logger, "download resumed", "downloadID", d.ID)
    }
    return err
}

func (s *DownloadService) GetDownload(ctx context.Context, userID, downloadID string) (*models.Download, error) {
    d, err := s.repo.GetByID(ctx, downloadID)
    if err != nil {
        if errors.Is(err, gorm.ErrRecordNotFound) {
            return nil, derr.DownloadNotFoundError{ID: downloadID}
        }
        return nil, err
    }
    if d.UserID != userID {
        err := derr.AccessDeniedError{Reason: "not owner of download"}
        logger.Info(s.logger, "get download access denied", "error", err, "authUserID", userID, "downloadID", downloadID)
        return nil, err
    }
    return d, nil
}

func (s *DownloadService) ListUserDownloads(ctx context.Context, userID string, limit, offset int) ([]models.Download, error) {
    return s.repo.ListByUser(ctx, userID, limit, offset)
}

func (s *DownloadService) CancelDownload(ctx context.Context, userID, downloadID string) error {
	d, err := s.repo.GetByID(ctx, downloadID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return derr.DownloadNotFoundError{ID: downloadID}
		}
		return err
	}
	if d.UserID != userID {
		err := derr.AccessDeniedError{Reason: "not owner of download"}
		logger.Info(s.logger, "cancel download access denied", "error", err, "authUserID", userID, "downloadID", downloadID)
		return err
	}

	// Only cancellable if downloading or paused
	if d.Status != models.StatusDownloading && d.Status != models.StatusPaused {
		return nil // Or return an error like "cannot cancel a completed/failed download"
	}

	s.stream.Stop(downloadID)
	d.Status = models.StatusCancelled

	// Optional: Could also trigger a cleanup of downloaded files here
	// s.files.CleanupFiles(...)

	err = s.repo.Update(ctx, d)
	if err == nil {
		logger.Info(s.logger, "download cancelled", "downloadID", d.ID)
		observability.RecordDownloadStatus(observability.StatusCancelled)
		observability.DecActiveDownloads()
	}
	return err
}

// ListUserLibraryGames returns a list of game IDs from the user's library.
func (s *DownloadService) ListUserLibraryGames(ctx context.Context, userID string) ([]string, error) {
	return s.library.ListUserGames(ctx, userID)
}

// SetDownloadSpeed updates the speed for an active download.
func (s *DownloadService) SetDownloadSpeed(ctx context.Context, userID, downloadID string, bytesPerSecond int64) error {
	d, err := s.repo.GetByID(ctx, downloadID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return derr.DownloadNotFoundError{ID: downloadID}
		}
		return err
	}
	if d.UserID != userID {
		err := derr.AccessDeniedError{Reason: "not owner of download"}
		logger.Info(s.logger, "set speed access denied", "error", err, "authUserID", userID, "downloadID", downloadID)
		return err
	}

	if d.Status != models.StatusDownloading && d.Status != models.StatusPaused {
		return derr.ValidationError{Msg: "cannot set speed for a download that is not active"}
	}

	s.stream.SetSpeed(downloadID, bytesPerSecond)
	logger.Info(s.logger, "download speed set", "downloadID", downloadID, "newSpeedBps", bytesPerSecond)
	// We could also persist this preference to the database if we wanted it to be sticky.
	// For now, it only affects the active download session.
	return nil
}
