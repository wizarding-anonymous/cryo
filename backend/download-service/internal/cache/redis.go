package cache

import (
    "context"
    "time"

    redis "github.com/redis/go-redis/v9"
)

type Options struct {
    Addr     string
    Password string
    DB       int
}

func NewClient(opts Options) *redis.Client {
    return redis.NewClient(&redis.Options{
        Addr:     opts.Addr,
        Password: opts.Password,
        DB:       opts.DB,
    })
}

// Ping checks connectivity.
func Ping(ctx context.Context, rdb *redis.Client) error {
    ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
    defer cancel()
    return rdb.Ping(ctx).Err()
}

