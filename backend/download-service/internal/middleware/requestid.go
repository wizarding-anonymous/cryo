package middleware

import (
    "crypto/rand"
    "encoding/hex"

    "github.com/gin-gonic/gin"
)

const RequestIDKey = "request_id"
const RequestIDHeader = "X-Request-ID"

func RequestID() gin.HandlerFunc {
    return func(c *gin.Context) {
        rid := c.Request.Header.Get(RequestIDHeader)
        if rid == "" {
            rid = newID()
        }
        c.Set(RequestIDKey, rid)
        c.Writer.Header().Set(RequestIDHeader, rid)
        c.Next()
    }
}

func newID() string {
    b := make([]byte, 16)
    if _, err := rand.Read(b); err != nil {
        return ""
    }
    return hex.EncodeToString(b)
}

