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

    "github.com/gin-gonic/gin"

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
    r.Use(gin.Recovery())
    r.Use(logger.GinLogger(logg))

    // Health endpoints
    r.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ok"}) })
    r.GET("/ready", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ready"}) })

    srv := &http.Server{
        Addr:    fmt.Sprintf(":%d", cfg.Port),
        Handler: r,
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

