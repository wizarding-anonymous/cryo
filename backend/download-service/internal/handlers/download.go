package handlers

import (
    "github.com/gin-gonic/gin"
)

type DownloadHandler struct {
    // svc DownloadService // to be plugged in later
}

func NewDownloadHandler() *DownloadHandler {
    return &DownloadHandler{}
}

// RegisterRoutes wires download-related routes under the given router group.
func (h *DownloadHandler) RegisterRoutes(r *gin.RouterGroup) {
    // Stub routes for future implementation
    r.POST("/downloads", func(c *gin.Context) { c.JSON(501, gin.H{"error": "not implemented"}) })
    r.GET("/downloads/:id", func(c *gin.Context) { c.JSON(501, gin.H{"error": "not implemented"}) })
    r.PUT("/downloads/:id/pause", func(c *gin.Context) { c.JSON(501, gin.H{"error": "not implemented"}) })
    r.PUT("/downloads/:id/resume", func(c *gin.Context) { c.JSON(501, gin.H{"error": "not implemented"}) })
    r.GET("/downloads/user/:userId", func(c *gin.Context) { c.JSON(501, gin.H{"error": "not implemented"}) })
}

