package logger

import (
    "log"
    "time"

    "github.com/gin-gonic/gin"
)

// New returns a basic stdlib logger with time prefixing.
func New() *log.Logger {
    l := log.Default()
    l.SetFlags(log.LstdFlags | log.Lshortfile)
    return l
}

// GinLogger is a simple Gin middleware for request logging.
func GinLogger(l *log.Logger) gin.HandlerFunc {
    return func(c *gin.Context) {
        start := time.Now()
        path := c.Request.URL.Path
        method := c.Request.Method
        c.Next()
        status := c.Writer.Status()
        latency := time.Since(start)
        l.Printf("%s %s -> %d (%s)", method, path, status, latency)
    }
}

