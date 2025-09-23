package middleware

import (
    "errors"
    "net/http"
    "strings"

    "github.com/gin-gonic/gin"
    jwt "github.com/golang-jwt/jwt/v5"
)

const (
    CtxUserIDKey = "auth_user_id"
)

type AuthOptions struct {
    Enabled bool
    // If Secret is empty, middleware falls back to trusting X-User-Id header (dev only)
    Secret  string
    Issuer  string
    Audience string
}

// Auth validates Authorization: Bearer <jwt> with HS256 secret and sets user id into context.
// If disabled or no secret provided, it accepts X-User-Id header (for local/dev behind API Gateway).
func Auth(opts AuthOptions) gin.HandlerFunc {
    return func(c *gin.Context) {
        if !opts.Enabled {
            c.Next()
            return
        }
        if opts.Secret == "" {
            // Dev fallback
            uid := c.Request.Header.Get("X-User-Id")
            if uid == "" {
                c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing user identity"})
                return
            }
            c.Set(CtxUserIDKey, uid)
            c.Next()
            return
        }
        auth := c.GetHeader("Authorization")
        if auth == "" || !strings.HasPrefix(strings.ToLower(auth), "bearer ") {
            c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing bearer token"})
            return
        }
        tokenStr := strings.TrimSpace(auth[len("Bearer "):])
        token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
            if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
                return nil, errors.New("unexpected signing method")
            }
            return []byte(opts.Secret), nil
        }, jwt.WithAudience(opts.Audience), jwt.WithIssuer(opts.Issuer))
        if err != nil || !token.Valid {
            c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
            return
        }
        claims, ok := token.Claims.(jwt.MapClaims)
        if !ok {
            c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid claims"})
            return
        }
        sub, _ := claims["sub"].(string)
        if sub == "" {
            c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing sub claim"})
            return
        }
        c.Set(CtxUserIDKey, sub)
        c.Next()
    }
}

// UserIDFromContext returns the authenticated user id if available.
func UserIDFromContext(c *gin.Context) (string, bool) {
    v, ok := c.Get(CtxUserIDKey)
    if !ok { return "", false }
    s, _ := v.(string)
    return s, s != ""
}
