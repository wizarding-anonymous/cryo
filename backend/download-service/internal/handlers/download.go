package handlers

import (
    "context"
    "net/http"
    "strconv"

    "github.com/gin-gonic/gin"

    "download-service/internal/cache"
    "download-service/internal/dto"
    derr "download-service/internal/errors"
    "download-service/internal/models"
    "download-service/internal/services"
    intramw "download-service/internal/middleware"

    redis "github.com/redis/go-redis/v9"
)

type DownloadHandler struct {
    svc *services.DownloadService
    rdb *redis.Client
}

func NewDownloadHandler(svc *services.DownloadService, rdb *redis.Client) *DownloadHandler {
    return &DownloadHandler{svc: svc, rdb: rdb}
}

// RegisterRoutes wires download-related routes under the given router group.
func (h *DownloadHandler) RegisterRoutes(r *gin.RouterGroup) {
	r.POST("/downloads", h.startDownload)
	r.GET("/downloads/:id", h.getDownload)
	r.PUT("/downloads/:id/pause", h.pauseDownload)
	r.PUT("/downloads/:id/resume", h.resumeDownload)
	r.DELETE("/downloads/:id", h.cancelDownload)
	r.PUT("/downloads/:id/speed", h.setDownloadSpeed)
	r.GET("/downloads/user/:userId", h.listUserDownloads)

	r.GET("/library/games", h.listUserLibraryGames)
}

func (h *DownloadHandler) setDownloadSpeed(c *gin.Context) {
	id := c.Param("id")
	uid, ok := intramw.UserIDFromContext(c)
	if !ok {
		httpError(c, derr.AccessDeniedError{Reason: "missing user identity"})
		return
	}
	var req struct {
		BytesPerSecond int64 `json:"bytesPerSecond"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		httpError(c, derr.ValidationError{Msg: err.Error()})
		return
	}

	if err := h.svc.SetDownloadSpeed(c.Request.Context(), uid, id, req.BytesPerSecond); err != nil {
		httpError(c, err)
		return
	}
	c.Status(http.StatusOK)
}

func (h *DownloadHandler) listUserLibraryGames(c *gin.Context) {
	uid, ok := intramw.UserIDFromContext(c)
	if !ok {
		httpError(c, derr.AccessDeniedError{Reason: "missing user identity"})
		return
	}
	games, err := h.svc.ListUserLibraryGames(c.Request.Context(), uid)
	if err != nil {
		httpError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"games": games})
}

func (h *DownloadHandler) cancelDownload(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		httpError(c, derr.ValidationError{Msg: "missing id"})
		return
	}
	uid, ok := intramw.UserIDFromContext(c)
	if !ok {
		httpError(c, derr.AccessDeniedError{Reason: "missing user identity"})
		return
	}
	if err := h.svc.CancelDownload(c.Request.Context(), uid, id); err != nil {
		httpError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func httpError(c *gin.Context, err error) {
    switch err.(type) {
    case derr.ValidationError:
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
    case derr.AccessDeniedError:
        c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
    case derr.DownloadNotFoundError:
        c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
    default:
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
    }
}

func (h *DownloadHandler) startDownload(c *gin.Context) {
    var req dto.StartDownloadRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        httpError(c, derr.ValidationError{Msg: err.Error()})
        return
    }
    // Prefer userId from auth context if present
    if uid, ok := intramw.UserIDFromContext(c); ok {
        req.UserID = uid
    }

    if req.UserID == "" {
        httpError(c, derr.AccessDeniedError{Reason: "user identity not found in token"})
        return
    }

    d, err := h.svc.StartDownload(c.Request.Context(), req.UserID, req.GameID)
    if err != nil {
        httpError(c, err)
        return
    }
    c.JSON(http.StatusCreated, dto.FromModel(*d))
}

func (h *DownloadHandler) getDownload(c *gin.Context) {
    id := c.Param("id")
    if id == "" {
        httpError(c, derr.ValidationError{Msg: "missing id"})
        return
    }
    uid, ok := intramw.UserIDFromContext(c)
    if !ok {
        httpError(c, derr.AccessDeniedError{Reason: "missing user identity"})
        return
    }
    d, err := h.svc.GetDownload(c.Request.Context(), uid, id)
    if err != nil {
        httpError(c, err)
        return
    }
    // Try enrich with cached status
    if h.rdb != nil {
        if stat, _ := cache.GetDownloadStatus(context.Background(), h.rdb, id); stat != nil {
            d.Progress = stat.Progress
            d.DownloadedSize = stat.DownloadedSize
            d.TotalSize = stat.TotalSize
            d.Speed = stat.Speed
            // status string might reflect paused/downloading
            d.Status = models.DownloadStatus(stat.Status)
        }
    }
    c.JSON(http.StatusOK, dto.FromModel(*d))
}

func (h *DownloadHandler) pauseDownload(c *gin.Context) {
    id := c.Param("id")
    if id == "" {
        httpError(c, derr.ValidationError{Msg: "missing id"})
        return
    }
    uid, ok := intramw.UserIDFromContext(c)
    if !ok {
        httpError(c, derr.AccessDeniedError{Reason: "missing user identity"})
        return
    }
    if err := h.svc.PauseDownload(c.Request.Context(), uid, id); err != nil {
        httpError(c, err)
        return
    }
    d, err := h.svc.GetDownload(c.Request.Context(), uid, id)
    if err != nil {
        httpError(c, err)
        return
    }
    c.JSON(http.StatusOK, dto.FromModel(*d))
}

func (h *DownloadHandler) resumeDownload(c *gin.Context) {
    id := c.Param("id")
    if id == "" {
        httpError(c, derr.ValidationError{Msg: "missing id"})
        return
    }
    uid, ok := intramw.UserIDFromContext(c)
    if !ok {
        httpError(c, derr.AccessDeniedError{Reason: "missing user identity"})
        return
    }
    if err := h.svc.ResumeDownload(c.Request.Context(), uid, id); err != nil {
        httpError(c, err)
        return
    }
    d, err := h.svc.GetDownload(c.Request.Context(), uid, id)
    if err != nil {
        httpError(c, err)
        return
    }
    c.JSON(http.StatusOK, dto.FromModel(*d))
}

func (h *DownloadHandler) listUserDownloads(c *gin.Context) {
    pathUserID := c.Param("userId")
    if pathUserID == "" {
        httpError(c, derr.ValidationError{Msg: "missing userId"})
        return
    }
    authUserID, ok := intramw.UserIDFromContext(c)
    if !ok {
        httpError(c, derr.AccessDeniedError{Reason: "missing user identity"})
        return
    }
    if pathUserID != authUserID {
        httpError(c, derr.AccessDeniedError{Reason: "cannot view downloads for another user"})
        return
    }

    limit := 50
    offset := 0
    if v := c.Query("limit"); v != "" {
        if n, err := strconv.Atoi(v); err == nil && n >= 0 && n <= 200 {
            limit = n
        }
    }
    if v := c.Query("offset"); v != "" {
        if n, err := strconv.Atoi(v); err == nil && n >= 0 {
            offset = n
        }
    }
    list, err := h.svc.ListUserDownloads(c.Request.Context(), pathUserID, limit, offset)
    if err != nil {
        httpError(c, err)
        return
    }
    // Enrich via cache
    resp := make([]dto.DownloadResponse, 0, len(list))
    for i := range list {
        d := &list[i]
        if h.rdb != nil {
            if stat, _ := cache.GetDownloadStatus(context.Background(), h.rdb, d.ID); stat != nil {
                d.Progress = stat.Progress
                d.DownloadedSize = stat.DownloadedSize
                d.TotalSize = stat.TotalSize
                d.Speed = stat.Speed
                d.Status = models.DownloadStatus(stat.Status)
            }
        }
        resp = append(resp, dto.FromModel(*d))
    }
    c.JSON(http.StatusOK, gin.H{"items": resp, "limit": limit, "offset": offset, "count": len(resp)})
}
