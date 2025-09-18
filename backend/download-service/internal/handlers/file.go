package handlers

import (
    "net/http"

    "github.com/gin-gonic/gin"

    derr "download-service/internal/errors"
    intramw "download-service/internal/middleware"
    "download-service/internal/services"
    "download-service/pkg/validate"
)

type FileHandler struct {
    fileSvc *services.FileService
    dlSvc   *services.DownloadService
}

func NewFileHandler(fileSvc *services.FileService, dlSvc *services.DownloadService) *FileHandler {
    return &FileHandler{fileSvc: fileSvc, dlSvc: dlSvc}
}

type verifyBody struct {
    FilePath     string `json:"filePath" binding:"required"`
    ExpectedSize int64  `json:"expectedSize" binding:"required,gt=0"`
}

func (h *FileHandler) RegisterRoutes(r *gin.RouterGroup) {
    r.GET("/downloads/:id/url", h.getDownloadURL)
    r.POST("/downloads/:id/verify", h.verify)
    r.DELETE("/downloads/:id/files/temp", h.cleanup)
}

func (h *FileHandler) getDownloadURL(c *gin.Context) {
    downloadID := c.Param("id")
    userID, ok := intramw.UserIDFromContext(c)
    if !ok {
        httpError(c, derr.AccessDeniedError{Reason: "missing user identity"})
        return
    }

    download, err := h.dlSvc.GetDownload(c.Request.Context(), userID, downloadID)
    if err != nil {
        httpError(c, err)
        return
    }

    url, err := h.fileSvc.GetDownloadURL(c.Request.Context(), download)
    if err != nil {
        httpError(c, err)
        return
    }

    c.JSON(http.StatusOK, gin.H{"url": url})
}

func (h *FileHandler) verify(c *gin.Context) {
    var body verifyBody
    if err := c.ShouldBindJSON(&body); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    if err := validate.Struct(body); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    if err := h.fileSvc.VerifyFile(c.Request.Context(), body.FilePath, body.ExpectedSize); err != nil {
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
    if err := h.fileSvc.CleanupFiles(c.Request.Context(), id); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
