package middleware

import "github.com/gin-gonic/gin"

// Auth is a placeholder for future JWT/opaque token auth via API Gateway.
func Auth() gin.HandlerFunc {
    return func(c *gin.Context) {
        // In MVP Task 1, no-op. Future: validate headers from API Gateway.
        c.Next()
    }
}

