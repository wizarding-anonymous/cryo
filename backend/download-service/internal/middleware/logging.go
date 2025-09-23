package middleware

import (
    "log"
    "time"

    "github.com/gin-gonic/gin"
)

func Logging(l *log.Logger) gin.HandlerFunc {
    return func(c *gin.Context) {
        start := time.Now()
        c.Next()
        l.Printf("%s %s -> %d in %s", c.Request.Method, c.Request.URL.Path, c.Writer.Status(), time.Since(start))
    }
}

