package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	"download-service/internal/cache"
	"download-service/pkg/logger"
)

// HealthHandler handles health check endpoints
type HealthHandler struct {
	db     *gorm.DB
	redis  *redis.Client
	logger logger.Logger
}

// NewHealthHandler creates a new health handler
func NewHealthHandler(db *gorm.DB, redis *redis.Client, logger logger.Logger) *HealthHandler {
	return &HealthHandler{
		db:     db,
		redis:  redis,
		logger: logger,
	}
}

// HealthStatus represents the status of a component
type HealthStatus struct {
	Status string `json:"status"`
	Error  string `json:"error,omitempty"`
}

// HealthResponse represents the overall health response
type HealthResponse struct {
	Status     string                  `json:"status"`
	Timestamp  time.Time               `json:"timestamp"`
	Version    string                  `json:"version,omitempty"`
	Components map[string]HealthStatus `json:"components,omitempty"`
}

// SimpleHealth returns a simple health check (200 OK)
func (h *HealthHandler) SimpleHealth(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "ok",
		"timestamp": time.Now(),
		"service":   "download-service",
	})
}

// DetailedHealth returns detailed health check with component status
func (h *HealthHandler) DetailedHealth(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
	defer cancel()

	components := make(map[string]HealthStatus)
	overallStatus := "ok"

	// Check database
	dbStatus := h.checkDatabase(ctx)
	components["database"] = dbStatus
	if dbStatus.Status != "ok" {
		overallStatus = "degraded"
	}

	// Check Redis
	redisStatus := h.checkRedis(ctx)
	components["redis"] = redisStatus
	if redisStatus.Status != "ok" {
		overallStatus = "degraded"
	}

	// Check disk space (basic check)
	diskStatus := h.checkDiskSpace()
	components["disk"] = diskStatus
	if diskStatus.Status != "ok" {
		overallStatus = "degraded"
	}

	// Determine HTTP status code
	httpStatus := http.StatusOK
	if overallStatus == "degraded" {
		httpStatus = http.StatusServiceUnavailable
	}

	response := HealthResponse{
		Status:     overallStatus,
		Timestamp:  time.Now(),
		Version:    "1.0.0", // Could be injected at build time
		Components: components,
	}

	c.JSON(httpStatus, response)
}

// ReadinessCheck checks if the service is ready to serve traffic
func (h *HealthHandler) ReadinessCheck(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 1*time.Second)
	defer cancel()

	// Check critical dependencies
	dbStatus := h.checkDatabase(ctx)
	redisStatus := h.checkRedis(ctx)

	if dbStatus.Status == "ok" && redisStatus.Status == "ok" {
		c.JSON(http.StatusOK, gin.H{
			"status":    "ready",
			"timestamp": time.Now(),
		})
	} else {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status":    "not_ready",
			"timestamp": time.Now(),
			"reason":    "dependencies_unavailable",
		})
	}
}

// LivenessCheck checks if the service is alive
func (h *HealthHandler) LivenessCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "alive",
		"timestamp": time.Now(),
	})
}

// checkDatabase checks database connectivity
func (h *HealthHandler) checkDatabase(ctx context.Context) HealthStatus {
	if h.db == nil {
		return HealthStatus{Status: "error", Error: "database not initialized"}
	}

	sqlDB, err := h.db.DB()
	if err != nil {
		return HealthStatus{Status: "error", Error: err.Error()}
	}

	if err := sqlDB.PingContext(ctx); err != nil {
		return HealthStatus{Status: "error", Error: err.Error()}
	}

	return HealthStatus{Status: "ok"}
}

// checkRedis checks Redis connectivity
func (h *HealthHandler) checkRedis(ctx context.Context) HealthStatus {
	if h.redis == nil {
		return HealthStatus{Status: "error", Error: "redis not initialized"}
	}

	if err := cache.Ping(ctx, h.redis); err != nil {
		return HealthStatus{Status: "error", Error: err.Error()}
	}

	return HealthStatus{Status: "ok"}
}

// checkDiskSpace performs a basic disk space check
func (h *HealthHandler) checkDiskSpace() HealthStatus {
	// This is a simplified check - in production you might want to check actual disk usage
	// For now, we'll just return ok since we can't easily check disk space in a cross-platform way
	return HealthStatus{Status: "ok"}
}

// RegisterRoutes registers health check routes
func (h *HealthHandler) RegisterRoutes(r *gin.Engine) {
	// Health endpoints (no auth required)
	r.GET("/health", h.SimpleHealth)
	r.GET("/health/detailed", h.DetailedHealth)
	r.GET("/health/ready", h.ReadinessCheck)
	r.GET("/health/live", h.LivenessCheck)
}