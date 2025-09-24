package router

import (
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-contrib/gzip"
	ginpprof "github.com/gin-contrib/pprof"
	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"download-service/internal/handlers"
	intramw "download-service/internal/middleware"
	"download-service/internal/observability"
	"download-service/pkg/config"
	"download-service/pkg/logger"
)

// RouterOptions contains configuration for setting up the router
type RouterOptions struct {
	Config              *config.Config
	Logger              logger.Logger
	DownloadHandler     *handlers.DownloadHandler
	FileHandler         *handlers.FileHandler
	HealthHandler       *handlers.HealthHandler
	EnableProfiling     bool
	EnableMetrics       bool
	CORSAllowedOrigins  []string
	CORSAllowedMethods  []string
	CORSAllowedHeaders  []string
	CORSExposeHeaders   []string
	CORSAllowCredentials bool
	CORSMaxAge          time.Duration
}

// SetupRouter creates and configures the Gin router with all middleware and routes
func SetupRouter(opts RouterOptions) *gin.Engine {
	if opts.Config.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()

	// Core middleware - order matters!
	setupCoreMiddleware(r, opts)
	
	// CORS middleware with custom configuration
	setupCORSMiddleware(r, opts)
	
	// Compression middleware
	r.Use(gzip.Gzip(gzip.DefaultCompression))
	
	// Observability middleware
	r.Use(observability.GinMetrics())

	// Optional middleware
	if opts.EnableProfiling {
		ginpprof.Register(r, "/debug/pprof")
	}

	// Health endpoints (no auth required)
	setupHealthRoutes(r, opts)

	// Metrics endpoint (no auth required)
	if opts.EnableMetrics {
		r.GET("/metrics", gin.WrapH(promhttp.Handler()))
	}

	// API routes with authentication and rate limiting
	setupAPIRoutes(r, opts)

	return r
}

// setupCoreMiddleware configures essential middleware that should be applied first
func setupCoreMiddleware(r *gin.Engine, opts RouterOptions) {
	// Recovery middleware - must be first to catch panics from other middleware
	r.Use(gin.Recovery())
	
	// Request ID middleware - early in chain for tracing
	r.Use(intramw.RequestID())
	
	// Logging middleware - after request ID so logs include request ID
	r.Use(logger.GinLogger(opts.Logger))
}

// setupCORSMiddleware configures CORS with production-ready defaults
func setupCORSMiddleware(r *gin.Engine, opts RouterOptions) {
	corsConfig := cors.Config{
		AllowOrigins:     getStringSliceOrDefault(opts.CORSAllowedOrigins, []string{"*"}),
		AllowMethods:     getStringSliceOrDefault(opts.CORSAllowedMethods, []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}),
		AllowHeaders:     getStringSliceOrDefault(opts.CORSAllowedHeaders, []string{"Origin", "Content-Type", "Authorization", "X-Request-ID"}),
		ExposeHeaders:    getStringSliceOrDefault(opts.CORSExposeHeaders, []string{"X-Request-ID"}),
		AllowCredentials: opts.CORSAllowCredentials,
		MaxAge:           getDurationOrDefault(opts.CORSMaxAge, 12*time.Hour),
		AllowWildcard:    true, // Allow wildcard subdomains
		AllowWebSockets:  true, // Allow WebSocket connections
		AllowFiles:       true, // Allow file uploads
	}

	// In production, be more restrictive with origins
	if opts.Config.Env == "production" && len(opts.CORSAllowedOrigins) == 0 {
		corsConfig.AllowOrigins = []string{
			"https://yourgameplatform.ru",
			"https://www.yourgameplatform.ru",
			"https://api.yourgameplatform.ru",
		}
		corsConfig.AllowWildcard = false // Disable wildcard in production
	}

	r.Use(cors.New(corsConfig))
}

// setupHealthRoutes configures health check endpoints
func setupHealthRoutes(r *gin.Engine, opts RouterOptions) {
	if opts.HealthHandler != nil {
		opts.HealthHandler.RegisterRoutes(r)
	} else {
		// Fallback simple health check if no handler provided
		r.GET("/health", func(c *gin.Context) {
			c.JSON(200, gin.H{"status": "ok"})
		})
		r.GET("/api/v1/health", func(c *gin.Context) {
			c.JSON(200, gin.H{"status": "ok"})
		})
	}
}

// setupAPIRoutes configures authenticated API routes with middleware
func setupAPIRoutes(r *gin.Engine, opts RouterOptions) {
	api := r.Group("/api")
	
	// Authentication middleware
	api.Use(intramw.Auth(intramw.AuthOptions{
		Enabled:  opts.Config.AuthJwtEnabled,
		Secret:   opts.Config.AuthJwtSecret,
		Issuer:   opts.Config.AuthJwtIssuer,
		Audience: opts.Config.AuthJwtAudience,
	}))
	
	// Rate limiting middleware (keyed by user when available, else IP)
	api.Use(intramw.RateLimit(intramw.RateLimitOptions{
		RPS:   float64(opts.Config.RateLimitRPS),
		Burst: opts.Config.RateLimitBurst,
		KeyFunc: func(c *gin.Context) string {
			if uid, ok := intramw.UserIDFromContext(c); ok {
				return uid
			}
			return ""
		},
	}))

	// Register handler routes
	if opts.DownloadHandler != nil {
		opts.DownloadHandler.RegisterRoutes(api)
	}
	if opts.FileHandler != nil {
		opts.FileHandler.RegisterRoutes(api)
	}
}

// Helper functions for default values
func getStringSliceOrDefault(slice []string, defaultValue []string) []string {
	if len(slice) == 0 {
		return defaultValue
	}
	return slice
}

func getDurationOrDefault(duration time.Duration, defaultValue time.Duration) time.Duration {
	if duration == 0 {
		return defaultValue
	}
	return duration
}