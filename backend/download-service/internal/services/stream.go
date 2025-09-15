package services

import (
    "context"
    "sync"
    "time"
)

// StreamUpdate carries incremental progress information to the caller on every tick.
type StreamUpdate struct {
    DownloadID     string
    DownloadedSize int64
    TotalSize      int64
    Speed          int64
}

// StreamService manages in-memory download progress simulation for MVP.
// It drives periodic ticks and supports pause/resume.
type StreamService struct {
    mu       sync.Mutex
    sessions map[string]*session
}

type session struct {
    id         string
    total      int64
    downloaded int64
    speed      int64
    paused     bool
    stopped    bool
    ticker     *time.Ticker
    cancel     context.CancelFunc
}

func NewStreamService() *StreamService { return &StreamService{sessions: make(map[string]*session)} }

// Start begins a session with a given total size and bytes-per-second speed.
// If a session already exists, it is resumed.
func (ss *StreamService) Start(ctx context.Context, downloadID string, startingDownloaded, totalSize, speed int64, onTick func(StreamUpdate) bool, onDone func()) {
    ss.mu.Lock()
    if s, ok := ss.sessions[downloadID]; ok {
        // resume existing
        s.paused = false
        ss.mu.Unlock()
        return
    }
    cctx, cancel := context.WithCancel(ctx)
    s := &session{
        id:         downloadID,
        total:      totalSize,
        downloaded: startingDownloaded,
        speed:      speed,
        paused:     false,
        stopped:    false,
        ticker:     time.NewTicker(1 * time.Second),
        cancel:     cancel,
    }
    ss.sessions[downloadID] = s
    ss.mu.Unlock()

    go func() {
        defer func() {
            s.ticker.Stop()
            ss.mu.Lock()
            delete(ss.sessions, downloadID)
            ss.mu.Unlock()
            if onDone != nil {
                onDone()
            }
        }()
        for {
            select {
            case <-cctx.Done():
                return
            case <-s.ticker.C:
                if s.stopped || s.paused {
                    continue
                }
                // advance progress
                s.downloaded += s.speed
                if s.downloaded > s.total {
                    s.downloaded = s.total
                }
                if onTick != nil {
                    if stop := onTick(StreamUpdate{DownloadID: s.id, DownloadedSize: s.downloaded, TotalSize: s.total, Speed: s.speed}); stop {
                        return
                    }
                }
                if s.downloaded >= s.total {
                    return
                }
            }
        }
    }()
}

func (ss *StreamService) Pause(downloadID string) {
    ss.mu.Lock()
    if s, ok := ss.sessions[downloadID]; ok {
        s.paused = true
    }
    ss.mu.Unlock()
}

func (ss *StreamService) SetSpeed(downloadID string, bytesPerSecond int64) {
    ss.mu.Lock()
    defer ss.mu.Unlock()
    if s, ok := ss.sessions[downloadID]; ok {
        if bytesPerSecond > 0 {
            s.speed = bytesPerSecond
        }
    }
}

func (ss *StreamService) Resume(downloadID string) {
    ss.mu.Lock()
    if s, ok := ss.sessions[downloadID]; ok {
        s.paused = false
    }
    ss.mu.Unlock()
}

func (ss *StreamService) Stop(downloadID string) {
    ss.mu.Lock()
    if s, ok := ss.sessions[downloadID]; ok {
        s.stopped = true
        s.cancel()
    }
    ss.mu.Unlock()
}

