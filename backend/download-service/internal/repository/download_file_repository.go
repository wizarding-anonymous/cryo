package repository

import (
    "context"

    "download-service/internal/models"
    "gorm.io/gorm"
)

type DownloadFileRepository interface {
    Create(ctx context.Context, f *models.DownloadFile) error
    ListByDownload(ctx context.Context, downloadID string) ([]models.DownloadFile, error)
    Update(ctx context.Context, f *models.DownloadFile) error
}

type downloadFileRepo struct{ db *gorm.DB }

func NewDownloadFileRepository(db *gorm.DB) DownloadFileRepository { return &downloadFileRepo{db: db} }

func (r *downloadFileRepo) Create(ctx context.Context, f *models.DownloadFile) error {
    return r.db.WithContext(ctx).Create(f).Error
}

func (r *downloadFileRepo) ListByDownload(ctx context.Context, downloadID string) ([]models.DownloadFile, error) {
    var list []models.DownloadFile
    if err := r.db.WithContext(ctx).Where("download_id = ?", downloadID).Order("file_name ASC").Find(&list).Error; err != nil {
        return nil, err
    }
    return list, nil
}

func (r *downloadFileRepo) Update(ctx context.Context, f *models.DownloadFile) error {
    return r.db.WithContext(ctx).Save(f).Error
}

