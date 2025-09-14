package config

import (
    "log"
    "os"
    "strconv"
)

type Config struct {
    Env         string
    Port        int
    DatabaseURL string
    RedisAddr   string
    RedisPass   string
    RedisDB     int
}

func getenv(key, def string) string {
    if v := os.Getenv(key); v != "" {
        return v
    }
    return def
}

func getint(key string, def int) int {
    if v := os.Getenv(key); v != "" {
        if i, err := strconv.Atoi(v); err == nil {
            return i
        }
        log.Printf("invalid int for %s: %s, using default %d", key, v, def)
    }
    return def
}

func Load() Config {
    return Config{
        Env:         getenv("APP_ENV", "development"),
        Port:        getint("PORT", 8080),
        DatabaseURL: getenv("DATABASE_URL", "postgres://postgres:postgres@db:5432/downloads?sslmode=disable"),
        RedisAddr:   getenv("REDIS_ADDR", "redis:6379"),
        RedisPass:   getenv("REDIS_PASSWORD", ""),
        RedisDB:     getint("REDIS_DB", 0),
    }
}

