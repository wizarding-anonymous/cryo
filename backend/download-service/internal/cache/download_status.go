package cache

import (
    "context"
    "encoding/json"
    "fmt"
    "time"

    redis "github.com/redis/go-redis/v9"
)

type DownloadStatusValue struct {
    Status         string `json:"status"`
    Progress       int    `json:"progress"`
    DownloadedSize int64  `json:"downloadedSize"`
    TotalSize      int64  `json:"totalSize"`
    Speed          int64  `json:"speed"`
    UpdatedAtUnix  int64  `json:"updatedAtUnix"`
}

func downloadStatusKey(id string) string { return fmt.Sprintf("dl:%s:status", id) }

// SetDownloadStatus caches the current status for a download with TTL.
func SetDownloadStatus(ctx context.Context, rdb *redis.Client, downloadID string, v DownloadStatusValue, ttl time.Duration) error {
    v.UpdatedAtUnix = time.Now().Unix()
    b, err := json.Marshal(v)
    if err != nil {
        return err
    }
    return rdb.Set(ctx, downloadStatusKey(downloadID), b, ttl).Err()
}

// GetDownloadStatus fetches the cached status, if any.
func GetDownloadStatus(ctx context.Context, rdb *redis.Client, downloadID string) (*DownloadStatusValue, error) {
    s, err := rdb.Get(ctx, downloadStatusKey(downloadID)).Result()
    if err != nil {
        if err == redis.Nil {
            return nil, nil
        }
        return nil, err
    }
    var v DownloadStatusValue
    if err := json.Unmarshal([]byte(s), &v); err != nil {
        return nil, err
    }
    return &v, nil
}

// DeleteDownloadStatus removes cached status.
func DeleteDownloadStatus(ctx context.Context, rdb *redis.Client, downloadID string) error {
    return rdb.Del(ctx, downloadStatusKey(downloadID)).Err()
}

