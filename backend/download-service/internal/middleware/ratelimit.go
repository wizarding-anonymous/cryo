package middleware

import (
    "net"
    "net/http"
    "sync"
    "time"

    "github.com/gin-gonic/gin"
    "golang.org/x/time/rate"
)

type RateLimitOptions struct {
    RPS   float64
    Burst int
    // KeyFunc allows custom keying (e.g., user id). If nil, uses client IP.
    KeyFunc func(*gin.Context) string
}

type limiterEntry struct {
    l   *rate.Limiter
    exp time.Time
}

type limiterStore struct {
    mu   sync.Mutex
    data map[string]*limiterEntry
}

func newStore() *limiterStore { return &limiterStore{data: make(map[string]*limiterEntry)} }

func (s *limiterStore) get(key string, rps float64, burst int) *rate.Limiter {
    s.mu.Lock()
    defer s.mu.Unlock()
    now := time.Now()
    if e, ok := s.data[key]; ok {
        e.exp = now.Add(5 * time.Minute)
        return e.l
    }
    l := rate.NewLimiter(rate.Limit(rps), burst)
    s.data[key] = &limiterEntry{l: l, exp: now.Add(5 * time.Minute)}
    // opportunistic cleanup
    for k, v := range s.data {
        if now.After(v.exp) {
            delete(s.data, k)
        }
    }
    return l
}

func clientIP(c *gin.Context) string {
    ip := c.ClientIP()
    if ip == "" {
        host, _, _ := net.SplitHostPort(c.Request.RemoteAddr)
        ip = host
    }
    return ip
}

// RateLimit applies a token-bucket limiter per key (user/IP) and returns 429 if exceeded.
func RateLimit(opts RateLimitOptions) gin.HandlerFunc {
    store := newStore()
    keyFn := opts.KeyFunc
    if keyFn == nil {
        keyFn = func(c *gin.Context) string { return clientIP(c) }
    } else {
        // wrap to fallback on IP
        orig := keyFn
        keyFn = func(c *gin.Context) string {
            if k := orig(c); k != "" { return k }
            return clientIP(c)
        }
    }
    if opts.RPS <= 0 { opts.RPS = 5 }
    if opts.Burst <= 0 { opts.Burst = 10 }
    return func(c *gin.Context) {
        key := keyFn(c)
        lim := store.get(key, opts.RPS, opts.Burst)
        if !lim.Allow() {
            c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "rate limit exceeded"})
            return
        }
        c.Next()
    }
}

