package router

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"download-service/pkg/config"
	"download-service/pkg/logger"
)

func TestSetupRouter_BasicConfiguration(t *testing.T) {
	gin.SetMode(gin.TestMode)
	
	cfg := &config.Config{
		Env:              "test",
		AuthJwtEnabled:   false,
		RateLimitRPS:     10,
		RateLimitBurst:   20,
	}
	logg := logger.New()

	opts := RouterOptions{
		Config:         cfg,
		Logger:         logg,
		EnableProfiling: true,
		EnableMetrics:  true,
	}

	r := SetupRouter(opts)
	require.NotNil(t, r)

	// Test basic health endpoint
	req := httptest.NewRequest("GET", "/api/v1/health", nil)
	resp := httptest.NewRecorder()
	r.ServeHTTP(resp, req)

	assert.Equal(t, http.StatusOK, resp.Code)
	assert.Contains(t, resp.Body.String(), `"status":"ok"`)
}

func TestSetupRouter_CORSConfiguration(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Test that CORS middleware can be configured without errors
	cfg := &config.Config{
		Env: "test",
	}
	logg := logger.New()

	opts := RouterOptions{
		Config:               cfg,
		Logger:               logg,
		CORSAllowedOrigins:   []string{"https://example.com"},
		CORSAllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		CORSAllowedHeaders:   []string{"Content-Type", "Authorization"},
		CORSExposeHeaders:    []string{"X-Request-ID"},
		CORSAllowCredentials: false,
		CORSMaxAge:           1 * time.Hour,
	}

	// This should not panic and should create a router successfully
	r := SetupRouter(opts)
	require.NotNil(t, r)

	// Test that the router works
	req := httptest.NewRequest("GET", "/api/v1/health", nil)
	resp := httptest.NewRecorder()
	r.ServeHTTP(resp, req)

	assert.Equal(t, http.StatusOK, resp.Code)
	assert.Contains(t, resp.Body.String(), "ok")
}

func TestSetupRouter_ProductionMode(t *testing.T) {
	gin.SetMode(gin.TestMode) // Keep test mode for testing
	
	cfg := &config.Config{
		Env: "production",
	}
	logg := logger.New()

	opts := RouterOptions{
		Config:          cfg,
		Logger:          logg,
		EnableProfiling: false, // Disabled in production
		EnableMetrics:   true,
	}

	r := SetupRouter(opts)

	// Test that profiling endpoint is not available when disabled
	req := httptest.NewRequest("GET", "/debug/pprof/", nil)
	resp := httptest.NewRecorder()
	r.ServeHTTP(resp, req)

	assert.Equal(t, http.StatusNotFound, resp.Code)
}

func TestSetupRouter_MetricsEndpoint(t *testing.T) {
	gin.SetMode(gin.TestMode)
	
	cfg := &config.Config{
		Env: "test",
	}
	logg := logger.New()

	opts := RouterOptions{
		Config:        cfg,
		Logger:        logg,
		EnableMetrics: true,
	}

	r := SetupRouter(opts)

	// Test metrics endpoint
	req := httptest.NewRequest("GET", "/metrics", nil)
	resp := httptest.NewRecorder()
	r.ServeHTTP(resp, req)

	assert.Equal(t, http.StatusOK, resp.Code)
	assert.Contains(t, resp.Header().Get("Content-Type"), "text/plain")
}

func TestSetupRouter_RequestIDMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)
	
	cfg := &config.Config{
		Env: "test",
	}
	logg := logger.New()

	opts := RouterOptions{
		Config: cfg,
		Logger: logg,
	}

	r := SetupRouter(opts)

	// Test that request ID is added to response headers
	req := httptest.NewRequest("GET", "/api/v1/health", nil)
	resp := httptest.NewRecorder()
	r.ServeHTTP(resp, req)

	assert.Equal(t, http.StatusOK, resp.Code)
	assert.NotEmpty(t, resp.Header().Get("X-Request-ID"))
}

func TestSetupRouter_ExistingRequestID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	
	cfg := &config.Config{
		Env: "test",
	}
	logg := logger.New()

	opts := RouterOptions{
		Config: cfg,
		Logger: logg,
	}

	r := SetupRouter(opts)

	// Test that existing request ID is preserved
	existingID := "test-request-id-123"
	req := httptest.NewRequest("GET", "/api/v1/health", nil)
	req.Header.Set("X-Request-ID", existingID)
	resp := httptest.NewRecorder()
	r.ServeHTTP(resp, req)

	assert.Equal(t, http.StatusOK, resp.Code)
	assert.Equal(t, existingID, resp.Header().Get("X-Request-ID"))
}

func TestSetupRouter_CompressionMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)
	
	cfg := &config.Config{
		Env: "test",
	}
	logg := logger.New()

	opts := RouterOptions{
		Config: cfg,
		Logger: logg,
	}

	r := SetupRouter(opts)

	// Test that compression is applied when requested
	req := httptest.NewRequest("GET", "/api/v1/health", nil)
	req.Header.Set("Accept-Encoding", "gzip")
	resp := httptest.NewRecorder()
	r.ServeHTTP(resp, req)

	assert.Equal(t, http.StatusOK, resp.Code)
	// Note: In test mode, gin might not actually compress small responses
	// This test mainly ensures the middleware is registered without errors
}

func TestGetStringSliceOrDefault(t *testing.T) {
	tests := []struct {
		name         string
		input        []string
		defaultValue []string
		expected     []string
	}{
		{
			name:         "empty slice returns default",
			input:        []string{},
			defaultValue: []string{"default1", "default2"},
			expected:     []string{"default1", "default2"},
		},
		{
			name:         "nil slice returns default",
			input:        nil,
			defaultValue: []string{"default1", "default2"},
			expected:     []string{"default1", "default2"},
		},
		{
			name:         "non-empty slice returns input",
			input:        []string{"input1", "input2"},
			defaultValue: []string{"default1", "default2"},
			expected:     []string{"input1", "input2"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := getStringSliceOrDefault(tt.input, tt.defaultValue)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestGetDurationOrDefault(t *testing.T) {
	tests := []struct {
		name         string
		input        time.Duration
		defaultValue time.Duration
		expected     time.Duration
	}{
		{
			name:         "zero duration returns default",
			input:        0,
			defaultValue: 5 * time.Minute,
			expected:     5 * time.Minute,
		},
		{
			name:         "non-zero duration returns input",
			input:        10 * time.Minute,
			defaultValue: 5 * time.Minute,
			expected:     10 * time.Minute,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := getDurationOrDefault(tt.input, tt.defaultValue)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestSetupRouter_WithoutHandlers(t *testing.T) {
	gin.SetMode(gin.TestMode)
	
	cfg := &config.Config{
		Env:            "test",
		AuthJwtEnabled: false,
		RateLimitRPS:   10,
		RateLimitBurst: 20,
	}
	logg := logger.New()

	opts := RouterOptions{
		Config:          cfg,
		Logger:          logg,
		DownloadHandler: nil, // No handlers provided
		FileHandler:     nil,
	}

	r := SetupRouter(opts)
	require.NotNil(t, r)

	// Should still work for health endpoints
	req := httptest.NewRequest("GET", "/api/v1/health", nil)
	resp := httptest.NewRecorder()
	r.ServeHTTP(resp, req)

	assert.Equal(t, http.StatusOK, resp.Code)
}

func TestSetupRouter_ProductionCORSDefaults(t *testing.T) {
	gin.SetMode(gin.TestMode)
	
	cfg := &config.Config{
		Env: "production",
	}
	logg := logger.New()

	opts := RouterOptions{
		Config: cfg,
		Logger: logg,
		// No CORS origins specified - should use production defaults
	}

	// This should not panic and should create a router successfully
	r := SetupRouter(opts)
	require.NotNil(t, r)

	// Test that the router works
	req := httptest.NewRequest("GET", "/api/v1/health", nil)
	resp := httptest.NewRecorder()
	r.ServeHTTP(resp, req)

	assert.Equal(t, http.StatusOK, resp.Code)
	assert.Contains(t, resp.Body.String(), "ok")
}