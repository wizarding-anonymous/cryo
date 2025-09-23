package logger

import (
    "fmt"
    "time"

    "github.com/gin-gonic/gin"
    "go.uber.org/zap"
    "go.uber.org/zap/zapcore"

    intramw "download-service/internal/middleware"
)

// Logger exposes a minimal subset compatible with existing calls.
type Logger interface {
    Printf(format string, args ...any)
    Println(args ...any)
    Fatalf(format string, args ...any)
}

type zapWrapper struct{ s *zap.SugaredLogger }

func (z zapWrapper) Printf(format string, args ...any) { z.s.Infof(format, args...) }
func (z zapWrapper) Println(args ...any)               { z.s.Info(args...) }
func (z zapWrapper) Fatalf(format string, args ...any) { z.s.Fatalf(format, args...) }

// New creates a production-ready zap logger wrapped to our minimal interface.
func New() Logger {
    cfg := zap.NewProductionConfig()
    cfg.EncoderConfig.TimeKey = "ts"
    cfg.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
    lg, _ := cfg.Build()
    return zapWrapper{s: lg.Sugar()}
}

// GinLogger logs structured HTTP access logs with request id.
func GinLogger(l Logger) gin.HandlerFunc {
    return func(c *gin.Context) {
        start := time.Now()
        path := c.Request.URL.Path
        method := c.Request.Method
        c.Next()
        status := c.Writer.Status()
        latency := time.Since(start)
        rid, _ := c.Get(intramw.RequestIDKey)
        if ridStr, ok := rid.(string); ok && ridStr != "" {
            l.Printf("[rid=%s] method=%s path=%s status=%d latency=%s", ridStr, method, path, status, latency)
        } else {
            l.Printf("method=%s path=%s status=%d latency=%s", method, path, status, latency)
        }
    }
}

// With returns underlying sugared logger for structured fields, when needed.
func With(l Logger, fields ...any) Logger {
    if zw, ok := l.(zapWrapper); ok {
        return zapWrapper{s: zw.s.With(fields...)}
    }
    // fallback
    return l
}

// Debug helper for quick logs without printf.
func Info(l Logger, msg string, kv ...any) {
    if zw, ok := l.(zapWrapper); ok {
        zw.s.Infow(msg, kv...)
        return
    }
    l.Println(append([]any{msg}, kv...)...)
}

// Error helper for errors with fields.
func Error(l Logger, msg string, kv ...any) {
    if zw, ok := l.(zapWrapper); ok {
        zw.s.Errorw(msg, kv...)
        return
    }
    l.Println(append([]any{fmt.Sprintf("ERROR: %s", msg)}, kv...)...)
}
