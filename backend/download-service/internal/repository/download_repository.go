package repository

import (
    "context"

    "download-service/internal/models"
    "gorm.io/gorm"
)

type DownloadRepository interface {
    Create(ctx context.Context, d *models.Download) error
    GetByID(ctx context.Context, id string) (*models.Download, error)
    GetByIDWithFiles(ctx context.Context, id string) (*models.Download, error)
    Update(ctx context.Context, d *models.Download) error
    UpdateStatus(ctx context.Context, id string, status models.DownloadStatus) error
    UpdateProgress(ctx context.Context, id string, progress int, downloadedSize int64, speed int64) error
    ListByUser(ctx context.Context, userID string, limit, offset int) ([]models.Download, error)
    ListByUserAndStatus(ctx context.Context, userID string, status models.DownloadStatus, limit, offset int) ([]models.Download, error)
    Delete(ctx context.Context, id string) error
    CountByUser(ctx context.Context, userID string) (int64, error)
}

type downloadRepo struct{ db *gorm.DB }

func NewDownloadRepository(db *gorm.DB) DownloadRepository { return &downloadRepo{db: db} }

func (r *downloadRepo) Create(ctx context.Context, d *models.Download) error {
    return r.db.WithContext(ctx).Create(d).Error
}

func (r *downloadRepo) GetByID(ctx context.Context, id string) (*models.Download, error) {
    var out models.Download
    if err := r.db.WithContext(ctx).First(&out, "id = ?", id).Error; err != nil {
        return nil, err
    }
    return &out, nil
}

func (r *downloadRepo) Update(ctx context.Context, d *models.Download) error {
    return r.db.WithContext(ctx).Save(d).Error
}

func (r *downloadRepo) GetByIDWithFiles(ctx context.Context, id string) (*models.Download, error) {
    var out models.Download
    if err := r.db.WithContext(ctx).Preload("Files").First(&out, "id = ?", id).Error; err != nil {
        return nil, err
    }
    return &out, nil
}

func (r *downloadRepo) UpdateStatus(ctx context.Context, id string, status models.DownloadStatus) error {
    return r.db.WithContext(ctx).Model(&models.Download{}).Where("id = ?", id).Update("status", status).Error
}

func (r *downloadRepo) UpdateProgress(ctx context.Context, id string, progress int, downloadedSize int64, speed int64) error {
    updates := map[string]interface{}{
        "progress":        progress,
        "downloaded_size": downloadedSize,
        "speed":          speed,
    }
    return r.db.WithContext(ctx).Model(&models.Download{}).Where("id = ?", id).Updates(updates).Error
}

func (r *downloadRepo) ListByUser(ctx context.Context, userID string, limit, offset int) ([]models.Download, error) {
    var list []models.Download
    q := r.db.WithContext(ctx).Where("user_id = ?", userID).Order("created_at DESC")
    if limit > 0 {
        q = q.Limit(limit)
    }
    if offset > 0 {
        q = q.Offset(offset)
    }
    if err := q.Find(&list).Error; err != nil {
        return nil, err
    }
    return list, nil
}

func (r *downloadRepo) ListByUserAndStatus(ctx context.Context, userID string, status models.DownloadStatus, limit, offset int) ([]models.Download, error) {
    var list []models.Download
    q := r.db.WithContext(ctx).Where("user_id = ? AND status = ?", userID, status).Order("created_at DESC")
    if limit > 0 {
        q = q.Limit(limit)
    }
    if offset > 0 {
        q = q.Offset(offset)
    }
    if err := q.Find(&list).Error; err != nil {
        return nil, err
    }
    return list, nil
}

func (r *downloadRepo) Delete(ctx context.Context, id string) error {
    return r.db.WithContext(ctx).Delete(&models.Download{}, "id = ?", id).Error
}

func (r *downloadRepo) CountByUser(ctx context.Context, userID string) (int64, error) {
    var count int64
    if err := r.db.WithContext(ctx).Model(&models.Download{}).Where("user_id = ?", userID).Count(&count).Error; err != nil {
        return 0, err
    }
    return count, nil
}

