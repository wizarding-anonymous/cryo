package handlers

import (
    "net/http"

    "github.com/gin-gonic/gin"

    "download-service/internal/services"
)

type FileHandler struct{ file *services.FileService }

func NewFileHandler(file *services.FileService) *FileHandler { return &FileHandler{file: file} }

type verifyBody struct{
    FilePath string `json:"filePath" binding:"required"`
    ExpectedSize int64 `json:"expectedSize" binding:"required"`
}

func (h *FileHandler) RegisterRoutes(r *gin.RouterGroup) {
    r.POST("/downloads/:id/verify", h.verify)
    r.DELETE("/downloads/:id/files/temp", h.cleanup)
}

func (h *FileHandler) verify(c *gin.Context) {
    var body verifyBody
    if err := c.ShouldBindJSON(&body); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    if err := h.file.VerifyFile(c.Request.Context(), body.FilePath, body.ExpectedSize); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *FileHandler) cleanup(c *gin.Context) {
    id := c.Param("id")
    if id == "" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "missing id"})
        return
    }
    if err := h.file.CleanupFiles(c.Request.Context(), id); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
