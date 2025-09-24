package repository

import (
    "context"

    "download-service/internal/models"
    "gorm.io/gorm"
)

type DownloadFileRepository interface {
    Create(ctx context.Context, f *models.DownloadFile) error
    GetByID(ctx context.Context, id string) (*models.DownloadFile, error)
    ListByDownload(ctx context.Context, downloadID string) ([]models.DownloadFile, error)
    Update(ctx context.Context, f *models.DownloadFile) error
    UpdateStatus(ctx context.Context, id string, status models.DownloadStatus) error
    UpdateProgress(ctx context.Context, id string, downloadedSize int64) error
    Delete(ctx context.Context, id string) error
    DeleteByDownload(ctx context.Context, downloadID string) error
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

func (r *downloadFileRepo) GetByID(ctx context.Context, id string) (*models.DownloadFile, error) {
    var out models.DownloadFile
    if err := r.db.WithContext(ctx).First(&out, "id = ?", id).Error; err != nil {
        return nil, err
    }
    return &out, nil
}

func (r *downloadFileRepo) Update(ctx context.Context, f *models.DownloadFile) error {
    return r.db.WithContext(ctx).Save(f).Error
}

func (r *downloadFileRepo) UpdateStatus(ctx context.Context, id string, status models.DownloadStatus) error {
    return r.db.WithContext(ctx).Model(&models.DownloadFile{}).Where("id = ?", id).Update("status", status).Error
}

func (r *downloadFileRepo) UpdateProgress(ctx context.Context, id string, downloadedSize int64) error {
    return r.db.WithContext(ctx).Model(&models.DownloadFile{}).Where("id = ?", id).Update("downloaded_size", downloadedSize).Error
}

func (r *downloadFileRepo) Delete(ctx context.Context, id string) error {
    return r.db.WithContext(ctx).Delete(&models.DownloadFile{}, "id = ?", id).Error
}

func (r *downloadFileRepo) DeleteByDownload(ctx context.Context, downloadID string) error {
    return r.db.WithContext(ctx).Delete(&models.DownloadFile{}, "download_id = ?", downloadID).Error
}

