package repository

import (
    "context"

    "download-service/internal/models"
    "gorm.io/gorm"
)

type DownloadRepository interface {
    Create(ctx context.Context, d *models.Download) error
    GetByID(ctx context.Context, id string) (*models.Download, error)
    Update(ctx context.Context, d *models.Download) error
    ListByUser(ctx context.Context, userID string, limit, offset int) ([]models.Download, error)
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

