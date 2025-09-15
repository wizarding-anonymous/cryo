package main

import (
    "context"
    "fmt"
    "log"
    "net/http"
    "os"
    "os/signal"
    "syscall"
    "time"

    "github.com/gin-contrib/cors"
    "github.com/gin-contrib/gzip"
    "github.com/gin-gonic/gin"
    ginpprof "github.com/gin-contrib/pprof"
    "github.com/prometheus/client_golang/prometheus/promhttp"

    "download-service/internal/cache"
    libclient "download-service/internal/clients/library"
    s3client "download-service/internal/clients/s3"
    "download-service/internal/handlers"
    "download-service/internal/database"
    intramw "download-service/internal/middleware"
    "download-service/internal/observability"
    "download-service/internal/repository"
    "download-service/internal/services"
    "download-service/pkg/config"
    "download-service/pkg/logger"
)

func main() {
    cfg := config.Load()
    logg := logger.New()

    if cfg.Env == "production" {
        gin.SetMode(gin.ReleaseMode)
    }

    r := gin.New()
    // Recovery first to catch panics
    r.Use(gin.Recovery())
    // Request ID, logging
    r.Use(intramw.RequestID())
    r.Use(logger.GinLogger(logg))
    // CORS and compression
    r.Use(cors.Default())
    r.Use(gzip.Gzip(gzip.DefaultCompression))

    // Metrics middleware
    r.Use(observability.GinMetrics())

    // pprof
    ginpprof.Register(r, "/debug/pprof")

    // Health endpoints
    r.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ok"}) })


    // Initialize database
    db, err := database.Connect(database.Options{DSN: cfg.DatabaseURL})
    if err != nil {
        logg.Fatalf("db connection failed: %v", err)
    }

    // Initialize Redis
    rdb := cache.NewClient(cache.Options{Addr: cfg.RedisAddr, Password: cfg.RedisPass, DB: cfg.RedisDB})
    if err := cache.Ping(context.Background(), rdb); err != nil {
        logg.Fatalf("redis connection failed: %v", err)
    }

    // Initialize Library Service client
    lib := libclient.NewClient(libclient.Options{
        BaseURL:             cfg.LibraryBaseURL,
        Timeout:             time.Duration(cfg.LibraryTimeoutMs) * time.Millisecond,
        MaxRetries:          cfg.LibraryRetries,
        InternalHeaderName:  cfg.LibraryInternalHeader,
        InternalHeaderValue: cfg.LibraryInternalToken,
        CBThreshold:         cfg.LibraryCBThreshold,
        CBCooldown:          time.Duration(cfg.LibraryCBCooldownMs) * time.Millisecond,
    })

    // Initialize S3 client
    s3, err := s3client.NewClient(context.Background(), s3client.Options{
        Endpoint:        cfg.S3Endpoint,
        Region:          cfg.S3Region,
        AccessKeyID:     cfg.S3AccessKeyID,
        SecretAccessKey: cfg.S3SecretAccessKey,
        Bucket:          cfg.S3Bucket,
    })
    if err != nil {
        logg.Fatalf("s3 client failed: %v", err)
    }

    // Wire repositories and services
    dlRepo := repository.NewDownloadRepository(db)
    dfRepo := repository.NewDownloadFileRepository(db)
    stream := services.NewStreamService()
    fileSvc := services.NewFileService(s3)
    dlSvc := services.NewDownloadService(db, rdb, dlRepo, dfRepo, stream, lib, logg)

    // Register HTTP routes with auth + rate limiting
    h := handlers.NewDownloadHandler(dlSvc, rdb)
    fh := handlers.NewFileHandler(fileSvc, dlSvc)
    api := r.Group("")
    // Auth
    api.Use(intramw.Auth(intramw.AuthOptions{
        Enabled:  cfg.AuthJwtEnabled,
        Secret:   cfg.AuthJwtSecret,
        Issuer:   cfg.AuthJwtIssuer,
        Audience: cfg.AuthJwtAudience,
    }))
    // Rate limiting (keyed by user when available, else IP)
    api.Use(intramw.RateLimit(intramw.RateLimitOptions{
        RPS:   float64(cfg.RateLimitRPS),
        Burst: cfg.RateLimitBurst,
        KeyFunc: func(c *gin.Context) string {
            if uid, ok := intramw.UserIDFromContext(c); ok { return uid }
            return ""
        },
    }))
    h.RegisterRoutes(api)
    fh.RegisterRoutes(api)

    // Detailed health
    r.GET("/health/detailed", func(c *gin.Context) {
        type comp struct{ Status string `json:"status"`; Error string `json:"error,omitempty"` }
        var dbStatus, redisStatus comp
        // DB ping
        if sqlDB, err2 := db.DB(); err2 == nil {
            ctx, cancel := context.WithTimeout(c.Request.Context(), 500*time.Millisecond)
            defer cancel()
            if err := sqlDB.PingContext(ctx); err != nil {
                dbStatus.Status = "error"
                dbStatus.Error = err.Error()
            } else {
                dbStatus.Status = "ok"
            }
        } else {
            dbStatus.Status = "error"
            dbStatus.Error = err2.Error()
        }
        // Redis ping
        if err := cache.Ping(c.Request.Context(), rdb); err != nil {
            redisStatus.Status = "error"
            redisStatus.Error = err.Error()
        } else {
            redisStatus.Status = "ok"
        }
        overall := http.StatusOK
        if dbStatus.Status != "ok" || redisStatus.Status != "ok" {
            overall = http.StatusServiceUnavailable
        }
        c.JSON(overall, gin.H{"status": map[string]any{"db": dbStatus, "redis": redisStatus}})
    })

    // Prometheus metrics endpoint
    r.GET("/metrics", gin.WrapH(promhttp.Handler()))

    srv := &http.Server{
        Addr:              fmt.Sprintf(":%d", cfg.Port),
        Handler:           r,
        ReadTimeout:       15 * time.Second,
        ReadHeaderTimeout: 5 * time.Second,
        WriteTimeout:      30 * time.Second,
        IdleTimeout:       60 * time.Second,
    }

    go func() {
        logg.Printf("download-service listening on :%d", cfg.Port)
        if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            logg.Fatalf("server error: %v", err)
        }
    }()

    // Graceful shutdown
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    <-quit
    log.Println("Shutting down server...")

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()
    if err := srv.Shutdown(ctx); err != nil {
        logg.Fatalf("server forced to shutdown: %v", err)
    }

    logg.Println("Server exiting")
}
