package middleware

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
)

func TestAuth_Disabled(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(Auth(AuthOptions{Enabled: false}))
	r.GET("/test", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	req := httptest.NewRequest("GET", "/test", nil)
	resp := httptest.NewRecorder()
	r.ServeHTTP(resp, req)

	assert.Equal(t, 200, resp.Code)
}

func TestAuth_DevMode(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(Auth(AuthOptions{Enabled: true, Secret: ""}))
	r.GET("/test", func(c *gin.Context) {
		uid, ok := UserIDFromContext(c)
		if ok {
			c.JSON(200, gin.H{"userId": uid})
		} else {
			c.JSON(500, gin.H{"error": "no user"})
		}
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("X-User-Id", "test-user-123")
	resp := httptest.NewRecorder()
	r.ServeHTTP(resp, req)

	assert.Equal(t, 200, resp.Code)
	assert.Contains(t, resp.Body.String(), "test-user-123")
}

func TestAuth_JWT(t *testing.T) {
	gin.SetMode(gin.TestMode)
	secret := "test-secret"
	
	// Create a valid JWT token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": "user-123",
		"iss": "test-issuer",
		"aud": "test-audience",
		"exp": time.Now().Add(time.Hour).Unix(),
	})
	tokenString, _ := token.SignedString([]byte(secret))

	r := gin.New()
	r.Use(Auth(AuthOptions{
		Enabled:  true,
		Secret:   secret,
		Issuer:   "test-issuer",
		Audience: "test-audience",
	}))
	r.GET("/test", func(c *gin.Context) {
		uid, ok := UserIDFromContext(c)
		if ok {
			c.JSON(200, gin.H{"userId": uid})
		} else {
			c.JSON(500, gin.H{"error": "no user"})
		}
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer "+tokenString)
	resp := httptest.NewRecorder()
	r.ServeHTTP(resp, req)

	assert.Equal(t, 200, resp.Code)
	assert.Contains(t, resp.Body.String(), "user-123")
}

func TestAuth_InvalidToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(Auth(AuthOptions{
		Enabled: true,
		Secret:  "test-secret",
	}))
	r.GET("/test", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer invalid-token")
	resp := httptest.NewRecorder()
	r.ServeHTTP(resp, req)

	assert.Equal(t, 401, resp.Code)
}

func TestRateLimit(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(RateLimit(RateLimitOptions{
		RPS:   1,
		Burst: 1,
	}))
	r.GET("/test", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// First request should succeed
	req1 := httptest.NewRequest("GET", "/test", nil)
	resp1 := httptest.NewRecorder()
	r.ServeHTTP(resp1, req1)
	assert.Equal(t, 200, resp1.Code)

	// Second immediate request should be rate limited
	req2 := httptest.NewRequest("GET", "/test", nil)
	resp2 := httptest.NewRecorder()
	r.ServeHTTP(resp2, req2)
	assert.Equal(t, 429, resp2.Code)
}

func TestRequestID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(RequestID())
	r.GET("/test", func(c *gin.Context) {
		rid, exists := c.Get(RequestIDKey)
		if exists {
			c.JSON(200, gin.H{"requestId": rid})
		} else {
			c.JSON(500, gin.H{"error": "no request id"})
		}
	})

	req := httptest.NewRequest("GET", "/test", nil)
	resp := httptest.NewRecorder()
	r.ServeHTTP(resp, req)

	assert.Equal(t, 200, resp.Code)
	assert.Contains(t, resp.Body.String(), "requestId")
	assert.NotEmpty(t, resp.Header().Get(RequestIDHeader))
}

func TestRequestID_ExistingHeader(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(RequestID())
	r.GET("/test", func(c *gin.Context) {
		rid, _ := c.Get(RequestIDKey)
		c.JSON(200, gin.H{"requestId": rid})
	})

	existingID := "existing-request-id"
	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set(RequestIDHeader, existingID)
	resp := httptest.NewRecorder()
	r.ServeHTTP(resp, req)

	assert.Equal(t, 200, resp.Code)
	assert.Contains(t, resp.Body.String(), existingID)
	assert.Equal(t, existingID, resp.Header().Get(RequestIDHeader))
}