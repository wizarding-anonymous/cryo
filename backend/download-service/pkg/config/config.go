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
    // Library Service integration
    LibraryBaseURL         string
    LibraryTimeoutMs       int
    LibraryRetries         int
    LibraryCBThreshold     int
    LibraryCBCooldownMs    int
    LibraryInternalHeader  string
    LibraryInternalToken   string
    // Auth & Rate limiting
    AuthJwtEnabled bool
    AuthJwtSecret  string
    AuthJwtIssuer  string
    AuthJwtAudience string
    RateLimitRPS   int
    RateLimitBurst int
    // S3 Storage
    S3Endpoint        string
    S3Region          string
    S3AccessKeyID     string
    S3SecretAccessKey string
    S3Bucket          string
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
        LibraryBaseURL:        getenv("LIBRARY_BASE_URL", "http://library-service:3000"),
        LibraryTimeoutMs:      getint("LIBRARY_TIMEOUT_MS", 2000),
        LibraryRetries:        getint("LIBRARY_RETRIES", 2),
        LibraryCBThreshold:    getint("LIBRARY_CB_THRESHOLD", 5),
        LibraryCBCooldownMs:   getint("LIBRARY_CB_COOLDOWN_MS", 10000),
        LibraryInternalHeader: getenv("LIBRARY_INTERNAL_HEADER", "X-Internal-Token"),
        LibraryInternalToken:  getenv("LIBRARY_INTERNAL_TOKEN", ""),
        AuthJwtEnabled: getenv("AUTH_JWT_ENABLED", "true") == "true",
        AuthJwtSecret:  getenv("AUTH_JWT_SECRET", ""),
        AuthJwtIssuer:  getenv("AUTH_JWT_ISSUER", ""),
        AuthJwtAudience: getenv("AUTH_JWT_AUDIENCE", ""),
        RateLimitRPS:   getint("RATE_LIMIT_RPS", 5),
        RateLimitBurst: getint("RATE_LIMIT_BURST", 10),
        // S3
        S3Endpoint:        getenv("S3_ENDPOINT", ""),
        S3Region:          getenv("S3_REGION", "us-east-1"),
        S3AccessKeyID:     getenv("S3_ACCESS_KEY_ID", ""),
        S3SecretAccessKey: getenv("S3_SECRET_ACCESS_KEY", ""),
        S3Bucket:          getenv("S3_BUCKET", ""),
    }
}
