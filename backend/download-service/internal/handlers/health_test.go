package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockLogger implements the logger interface for testing
type MockLogger struct {
	mock.Mock
}

func (m *MockLogger) Printf(format string, args ...any) {
	m.Called(format, args)
}

func (m *MockLogger) Println(args ...any) {
	m.Called(args)
}

func (m *MockLogger) Fatalf(format string, args ...any) {
	m.Called(format, args)
}

func TestHealthHandler_SimpleHealth(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mockLogger := &MockLogger{}
	handler := NewHealthHandler(nil, nil, mockLogger)

	router := gin.New()
	router.GET("/health", handler.SimpleHealth)

	req, _ := http.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "ok", response["status"])
	assert.Equal(t, "download-service", response["service"])
	assert.NotNil(t, response["timestamp"])
}

func TestHealthHandler_LivenessCheck(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mockLogger := &MockLogger{}
	handler := NewHealthHandler(nil, nil, mockLogger)

	router := gin.New()
	router.GET("/health/live", handler.LivenessCheck)

	req, _ := http.NewRequest("GET", "/health/live", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "alive", response["status"])
	assert.NotNil(t, response["timestamp"])
}

func TestHealthHandler_DetailedHealth_NoDependencies(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mockLogger := &MockLogger{}
	handler := NewHealthHandler(nil, nil, mockLogger)

	router := gin.New()
	router.GET("/health/detailed", handler.DetailedHealth)

	req, _ := http.NewRequest("GET", "/health/detailed", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusServiceUnavailable, w.Code)

	var response HealthResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "degraded", response.Status)
	assert.NotNil(t, response.Components)
	assert.Equal(t, "error", response.Components["database"].Status)
	assert.Equal(t, "error", response.Components["redis"].Status)
	assert.Equal(t, "ok", response.Components["disk"].Status)
}

func TestHealthHandler_ReadinessCheck_NoDependencies(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mockLogger := &MockLogger{}
	handler := NewHealthHandler(nil, nil, mockLogger)

	router := gin.New()
	router.GET("/health/ready", handler.ReadinessCheck)

	req, _ := http.NewRequest("GET", "/health/ready", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusServiceUnavailable, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "not_ready", response["status"])
	assert.Equal(t, "dependencies_unavailable", response["reason"])
}

func TestHealthHandler_RegisterRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mockLogger := &MockLogger{}
	handler := NewHealthHandler(nil, nil, mockLogger)

	router := gin.New()
	handler.RegisterRoutes(router)

	// Test that routes are registered
	routes := router.Routes()
	
	expectedRoutes := []string{
		"/health",
		"/health/detailed", 
		"/health/ready",
		"/health/live",
		"/api/v1/health",
	}

	routePaths := make([]string, len(routes))
	for i, route := range routes {
		routePaths[i] = route.Path
	}

	for _, expectedRoute := range expectedRoutes {
		assert.Contains(t, routePaths, expectedRoute)
	}
}