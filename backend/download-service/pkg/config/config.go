package config

import (
    "fmt"
    "log"
    "os"
    "strconv"
    "strings"
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
    // Logging
    LogLevel  string
    LogFormat string
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
    cfg := Config{
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
        // Logging
        LogLevel:  getenv("LOG_LEVEL", "info"),
        LogFormat: getenv("LOG_FORMAT", "json"),
    }
    
    if err := cfg.Validate(); err != nil {
        log.Fatalf("configuration validation failed: %v", err)
    }
    
    return cfg
}

// Validate checks if the configuration is valid
func (c *Config) Validate() error {
    var errors []string
    
    // Validate environment
    validEnvs := []string{"development", "test", "staging", "production"}
    if !contains(validEnvs, c.Env) {
        errors = append(errors, fmt.Sprintf("invalid APP_ENV: %s, must be one of %v", c.Env, validEnvs))
    }
    
    // Validate port
    if c.Port < 1 || c.Port > 65535 {
        errors = append(errors, fmt.Sprintf("invalid PORT: %d, must be between 1 and 65535", c.Port))
    }
    
    // Validate required fields for production
    if c.Env == "production" {
        if c.DatabaseURL == "" {
            errors = append(errors, "DATABASE_URL is required in production")
        }
        if c.AuthJwtEnabled && c.AuthJwtSecret == "" {
            errors = append(errors, "AUTH_JWT_SECRET is required when JWT auth is enabled in production")
        }
        if c.S3Endpoint == "" || c.S3AccessKeyID == "" || c.S3SecretAccessKey == "" || c.S3Bucket == "" {
            errors = append(errors, "S3 configuration (endpoint, access key, secret key, bucket) is required in production")
        }
    }
    
    // Validate log level
    validLogLevels := []string{"debug", "info", "warn", "error", "fatal", "panic"}
    if !contains(validLogLevels, strings.ToLower(c.LogLevel)) {
        errors = append(errors, fmt.Sprintf("invalid LOG_LEVEL: %s, must be one of %v", c.LogLevel, validLogLevels))
    }
    
    // Validate log format
    validLogFormats := []string{"json", "console"}
    if !contains(validLogFormats, strings.ToLower(c.LogFormat)) {
        errors = append(errors, fmt.Sprintf("invalid LOG_FORMAT: %s, must be one of %v", c.LogFormat, validLogFormats))
    }
    
    // Validate rate limiting
    if c.RateLimitRPS < 0 {
        errors = append(errors, "RATE_LIMIT_RPS must be non-negative")
    }
    if c.RateLimitBurst < 0 {
        errors = append(errors, "RATE_LIMIT_BURST must be non-negative")
    }
    
    if len(errors) > 0 {
        return fmt.Errorf("configuration errors: %s", strings.Join(errors, "; "))
    }
    
    return nil
}

// contains checks if a slice contains a string
func contains(slice []string, item string) bool {
    for _, s := range slice {
        if s == item {
            return true
        }
    }
    return false
}
