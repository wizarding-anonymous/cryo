package library

import (
    "context"
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "sync/atomic"
    "testing"
    "time"

    "github.com/stretchr/testify/require"
)

func TestClient_CheckOwnership_Owned(t *testing.T) {
    ownsCalls := int32(0)
    srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        switch r.URL.Path {
        case "/api/library/user/u1/owns/g2":
            atomic.AddInt32(&ownsCalls, 1)
            require.Equal(t, "secret", r.Header.Get("X-Internal-Token"))
            _ = json.NewEncoder(w).Encode(map[string]any{"owns": true, "purchaseDate": "2025-01-01T00:00:00Z"})
        case "/api/library/user/u1/games":
            _ = json.NewEncoder(w).Encode(map[string]any{"games": []map[string]any{{"gameId": "g1"}}})
        default:
            http.NotFound(w, r)
        }
    }))
    defer srv.Close()

    c := NewClient(Options{BaseURL: srv.URL, Timeout: time.Second, MaxRetries: 1, InternalHeaderName: "X-Internal-Token", InternalHeaderValue: "secret", CBThreshold: 3, CBCooldown: time.Second})
    owned, err := c.CheckOwnership(context.Background(), "u1", "g2")
    require.NoError(t, err)
    require.True(t, owned)
    require.Equal(t, int32(1), atomic.LoadInt32(&ownsCalls))
}

func TestClient_CheckOwnership_NotOwned(t *testing.T) {
    srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        switch r.URL.Path {
        case "/api/library/user/u1/owns/gX":
            http.NotFound(w, r)
        case "/api/library/user/u1/games":
            _ = json.NewEncoder(w).Encode(map[string]any{"games": []map[string]any{{"gameId": "g1"}}})
        default:
            http.NotFound(w, r)
        }
    }))
    defer srv.Close()

    c := NewClient(Options{BaseURL: srv.URL, Timeout: time.Second, MaxRetries: 0, CBThreshold: 2, CBCooldown: time.Second})
    owned, err := c.CheckOwnership(context.Background(), "u1", "gX")
    require.NoError(t, err)
    require.False(t, owned)
}

func TestClient_CheckOwnership_FallbackToList(t *testing.T) {
    ownsCalls := int32(0)
    gamesCalls := int32(0)
    srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        switch r.URL.Path {
        case "/api/library/user/u1/owns/g2":
            atomic.AddInt32(&ownsCalls, 1)
            w.WriteHeader(http.StatusInternalServerError)
        case "/api/library/user/u1/games":
            atomic.AddInt32(&gamesCalls, 1)
            _ = json.NewEncoder(w).Encode(map[string]any{"games": []map[string]any{{"gameId": "g2"}}})
        default:
            http.NotFound(w, r)
        }
    }))
    defer srv.Close()

    c := NewClient(Options{BaseURL: srv.URL, Timeout: time.Second, MaxRetries: 0, CBThreshold: 3, CBCooldown: 500 * time.Millisecond})
    owned, err := c.CheckOwnership(context.Background(), "u1", "g2")
    require.NoError(t, err)
    require.True(t, owned)
    require.Equal(t, int32(1), atomic.LoadInt32(&ownsCalls))
    require.Equal(t, int32(1), atomic.LoadInt32(&gamesCalls))
}

func TestClient_RetryAndCircuitBreaker(t *testing.T) {
    var ownsCalls int32
    srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if r.URL.Path == "/api/library/user/u1/owns/g1" {
            atomic.AddInt32(&ownsCalls, 1)
            w.WriteHeader(http.StatusInternalServerError)
            return
        }
        http.NotFound(w, r)
    }))
    defer srv.Close()

    c := NewClient(Options{BaseURL: srv.URL, Timeout: 200 * time.Millisecond, MaxRetries: 1, CBThreshold: 1, CBCooldown: 300 * time.Millisecond})

    // First call should attempt retries then fail
    _, err := c.CheckOwnership(context.Background(), "u1", "g1")
    require.Error(t, err)
    firstCalls := atomic.LoadInt32(&ownsCalls)
    require.GreaterOrEqual(t, firstCalls, int32(1))

    // Circuit likely open now; next call should not increase HTTP calls
    _, err = c.CheckOwnership(context.Background(), "u1", "g1")
    require.Error(t, err)
    require.Equal(t, firstCalls, atomic.LoadInt32(&ownsCalls))

    // Wait cooldown, should try again
    time.Sleep(350 * time.Millisecond)
    _, _ = c.CheckOwnership(context.Background(), "u1", "g1")
}
