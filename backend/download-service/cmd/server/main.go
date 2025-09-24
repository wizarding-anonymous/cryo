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

    "download-service/internal/cache"
    libclient "download-service/internal/clients/library"
    s3client "download-service/internal/clients/s3"
    "download-service/internal/handlers"
    "download-service/internal/database"
    "download-service/internal/repository"
    "download-service/internal/router"
    "download-service/internal/services"
    "download-service/pkg/config"
    "download-service/pkg/logger"
)

func main() {
    cfg := config.Load()
    logg := logger.NewWithConfig(cfg.LogLevel, cfg.LogFormat)


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
    baseLibClient := libclient.NewClient(libclient.Options{
        BaseURL:             cfg.LibraryBaseURL,
        Timeout:             time.Duration(cfg.LibraryTimeoutMs) * time.Millisecond,
        MaxRetries:          cfg.LibraryRetries,
        InternalHeaderName:  cfg.LibraryInternalHeader,
        InternalHeaderValue: cfg.LibraryInternalToken,
        CBThreshold:         cfg.LibraryCBThreshold,
        CBCooldown:          time.Duration(cfg.LibraryCBCooldownMs) * time.Millisecond,
    })
    // Wrap with instrumentation for logging and monitoring
    lib := libclient.NewInstrumentedClient(baseLibClient, logg)

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
    stream := services.NewStreamService()
    fileSvc := services.NewFileService(s3)
    dlSvc := services.NewDownloadService(db, rdb, dlRepo, stream, lib, logg)

    // Create handlers
    h := handlers.NewDownloadHandler(dlSvc, rdb)
    fh := handlers.NewFileHandler(fileSvc, dlSvc)
    hh := handlers.NewHealthHandler(db, rdb, logg)

    // Setup router with all middleware and routes
    r := router.SetupRouter(router.RouterOptions{
        Config:              &cfg,
        Logger:              logg,
        DownloadHandler:     h,
        FileHandler:         fh,
        HealthHandler:       hh,
        EnableProfiling:     cfg.Env != "production", // Enable profiling in dev/test
        EnableMetrics:       true,
        CORSAllowedOrigins:  []string{}, // Will use production defaults
        CORSAllowedMethods:  []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
        CORSAllowedHeaders:  []string{"Origin", "Content-Type", "Authorization", "X-Request-ID", "X-User-Id"},
        CORSExposeHeaders:   []string{"X-Request-ID"},
        CORSAllowCredentials: false,
        CORSMaxAge:          12 * time.Hour,
    })

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

