package handlers

import "github.com/gin-gonic/gin"

type FileHandler struct{}

func NewFileHandler() *FileHandler { return &FileHandler{} }

func (h *FileHandler) RegisterRoutes(r *gin.RouterGroup) {
    // Placeholder for future file operations
}

