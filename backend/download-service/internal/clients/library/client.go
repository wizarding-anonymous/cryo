package library

import (
    "context"
    "encoding/json"
    "errors"
    "fmt"
    "io"
    "net"
    "net/http"
    "strings"
    "sync"
    "time"
)

// Options configures the Library Service client.
type Options struct {
    BaseURL               string
    Timeout               time.Duration
    MaxRetries            int
    InternalHeaderName    string // e.g., X-Internal-Token
    InternalHeaderValue   string
    CBThreshold           int           // consecutive failures to open circuit
    CBCooldown            time.Duration // open state duration
    HTTPClient            *http.Client  // optional custom client
}

type Client struct {
    baseURL  string
    hc       *http.Client
    hdrName  string
    hdrValue string

    maxRetries int
    cbThresh   int
    cbCooldown time.Duration

    mu          sync.Mutex
    failCount   int
    circuitOpen bool
    reopenAt    time.Time
}

// Interface describes the methods used by the Download Service.
type Interface interface {
    CheckOwnership(ctx context.Context, userID, gameID string) (bool, error)
    ListUserGames(ctx context.Context, userID string) ([]string, error)
}

func NewClient(opts Options) *Client {
    hc := opts.HTTPClient
    if hc == nil {
        hc = &http.Client{Timeout: maxDur(opts.Timeout, 2*time.Second)}
    }
    return &Client{
        baseURL:    strings.TrimRight(opts.BaseURL, "/"),
        hc:         hc,
        hdrName:    opts.InternalHeaderName,
        hdrValue:   opts.InternalHeaderValue,
        maxRetries: maxInt(opts.MaxRetries, 0),
        cbThresh:   maxInt(opts.CBThreshold, 5),
        cbCooldown: maxDur(opts.CBCooldown, 10*time.Second),
    }
}

func maxInt(v, d int) int {
    if v <= 0 {
        return d
    }
    return v
}

func maxDur(v, d time.Duration) time.Duration {
    if v <= 0 {
        return d
    }
    return v
}

// circuitAllows returns whether a request may proceed and updates state for half-open.
func (c *Client) circuitAllows() bool {
    c.mu.Lock()
    defer c.mu.Unlock()
    if !c.circuitOpen {
        return true
    }
    if time.Now().After(c.reopenAt) {
        // Half-open: allow a trial request.
        c.circuitOpen = false
        c.failCount = 0
        return true
    }
    return false
}

func (c *Client) markSuccess() {
    c.mu.Lock()
    c.failCount = 0
    c.circuitOpen = false
    c.mu.Unlock()
}

func (c *Client) markFailure() {
    c.mu.Lock()
    c.failCount++
    if c.failCount >= c.cbThresh && !c.circuitOpen {
        c.circuitOpen = true
        c.reopenAt = time.Now().Add(c.cbCooldown)
    }
    c.mu.Unlock()
}

// doJSON performs an HTTP request with retries and decodes JSON into out if non-nil.
func (c *Client) doJSON(ctx context.Context, method, path string, out any) (int, error) {
    if !c.circuitAllows() {
        return 0, errors.New("library client: circuit open")
    }

    url := c.baseURL + path
    var lastErr error
    attempts := c.maxRetries + 1
    for i := 0; i < attempts; i++ {
        req, err := http.NewRequestWithContext(ctx, method, url, nil)
        if err != nil {
            return 0, err
        }
        if c.hdrName != "" && c.hdrValue != "" {
            req.Header.Set(c.hdrName, c.hdrValue)
        }
        req.Header.Set("Accept", "application/json")

        resp, err := c.hc.Do(req)
        if err != nil {
            lastErr = err
            if retriable(err) && i < attempts-1 {
                backoff(i)
                continue
            }
            c.markFailure()
            return 0, err
        }
        defer resp.Body.Close()

        // 2xx success
        if resp.StatusCode >= 200 && resp.StatusCode < 300 {
            if out != nil {
                b, _ := io.ReadAll(resp.Body)
                if len(b) > 0 {
                    if err := json.Unmarshal(b, out); err != nil {
                        c.markFailure()
                        return resp.StatusCode, fmt.Errorf("decode response: %w", err)
                    }
                }
            }
            c.markSuccess()
            return resp.StatusCode, nil
        }

        // 404/401/etc — don’t retry on 4xx except 408
        if resp.StatusCode >= 400 && resp.StatusCode < 500 && resp.StatusCode != http.StatusRequestTimeout {
            c.markFailure()
            return resp.StatusCode, fmt.Errorf("library client: http %d", resp.StatusCode)
        }

        // 5xx or 408 — retry
        if i < attempts-1 {
            backoff(i)
            continue
        }
        c.markFailure()
        return resp.StatusCode, fmt.Errorf("library client: http %d", resp.StatusCode)
    }
    c.markFailure()
    if lastErr != nil {
        return 0, lastErr
    }
    return 0, errors.New("library client: request failed")
}

func retriable(err error) bool {
    var nerr net.Error
    if errors.As(err, &nerr) {
        return nerr.Temporary() || nerr.Timeout()
    }
    // connection reset, etc.
    if errors.Is(err, io.EOF) {
        return true
    }
    return false
}

func backoff(i int) { time.Sleep(time.Duration(150*(1<<i)) * time.Millisecond) }

// DTOs (minimal) for Library Service
type userGamesResponse struct {
    Games []struct {
        GameID string `json:"gameId"`
    } `json:"games"`
}

type ownershipResponse struct {
    Owned bool `json:"owned"`
}

// CheckOwnership checks whether user owns the game.
// Prefer internal endpoint: GET /api/library/user/:userId/games then check membership.
func (c *Client) CheckOwnership(ctx context.Context, userID, gameID string) (bool, error) {
    // Try internal endpoint to avoid user JWT requirement.
    var resp userGamesResponse
    code, err := c.doJSON(ctx, http.MethodGet, fmt.Sprintf("/api/library/user/%s/games", userID), &resp)
    if err == nil && (code >= 200 && code < 300) {
        for _, g := range resp.Games {
            if g.GameID == gameID {
                return true, nil
            }
        }
        return false, nil
    }
    // Fallback: if internal is unavailable but public ownership endpoint exists and caller can proxy user JWT later.
    // We return error here to avoid making unauthenticated call to a protected endpoint.
    return false, err
}

// ListUserGames returns list of game IDs owned by the user via internal endpoint.
func (c *Client) ListUserGames(ctx context.Context, userID string) ([]string, error) {
    var resp userGamesResponse
    _, err := c.doJSON(ctx, http.MethodGet, fmt.Sprintf("/api/library/user/%s/games", userID), &resp)
    if err != nil {
        return nil, err
    }
    ids := make([]string, 0, len(resp.Games))
    for _, g := range resp.Games {
        ids = append(ids, g.GameID)
    }
    return ids, nil
}
