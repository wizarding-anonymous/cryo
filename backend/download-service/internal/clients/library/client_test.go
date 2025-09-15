package library

import (
    "context"
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "sync/atomic"
    "testing"
    "time"
)

func newServerUserGames(handler func(w http.ResponseWriter, r *http.Request)) *httptest.Server {
    mux := http.NewServeMux()
    mux.HandleFunc("/api/library/user/u1/games", handler)
    return httptest.NewServer(mux)
}

func TestClient_CheckOwnership_Owned(t *testing.T) {
    srv := newServerUserGames(func(w http.ResponseWriter, r *http.Request) {
        if r.Header.Get("X-Internal-Token") != "secret" {
            t.Fatalf("missing internal header")
        }
        _ = json.NewEncoder(w).Encode(map[string]any{
            "games": []map[string]any{{"gameId": "g1"}, {"gameId": "g2"}},
        })
    })
    defer srv.Close()
    c := NewClient(Options{BaseURL: srv.URL, Timeout: time.Second, MaxRetries: 1, InternalHeaderName: "X-Internal-Token", InternalHeaderValue: "secret", CBThreshold: 3, CBCooldown: time.Second})
    owned, err := c.CheckOwnership(context.Background(), "u1", "g2")
    if err != nil { t.Fatalf("err: %v", err) }
    if !owned { t.Fatalf("expected owned") }
}

func TestClient_CheckOwnership_NotOwned(t *testing.T) {
    srv := newServerUserGames(func(w http.ResponseWriter, r *http.Request) {
        _ = json.NewEncoder(w).Encode(map[string]any{
            "games": []map[string]any{{"gameId": "g1"}},
        })
    })
    defer srv.Close()
    c := NewClient(Options{BaseURL: srv.URL, Timeout: time.Second, MaxRetries: 0, CBThreshold: 2, CBCooldown: time.Second})
    owned, err := c.CheckOwnership(context.Background(), "u1", "gX")
    if err != nil { t.Fatalf("err: %v", err) }
    if owned { t.Fatalf("expected not owned") }
}

func TestClient_RetryAndCircuitBreaker(t *testing.T) {
    var calls int32
    srv := newServerUserGames(func(w http.ResponseWriter, r *http.Request) {
        atomic.AddInt32(&calls, 1)
        // return 500
        w.WriteHeader(http.StatusInternalServerError)
    })
    defer srv.Close()
    c := NewClient(Options{BaseURL: srv.URL, Timeout: 200 * time.Millisecond, MaxRetries: 2, CBThreshold: 1, CBCooldown: 300 * time.Millisecond})

    // First call should attempt retries then fail
    if _, err := c.CheckOwnership(context.Background(), "u1", "g1"); err == nil {
        t.Fatalf("expected error on 5xx")
    }
    // Circuit likely open now; immediate next call should fail fast (no extra calls)
    prev := atomic.LoadInt32(&calls)
    if _, err := c.CheckOwnership(context.Background(), "u1", "g1"); err == nil {
        t.Fatalf("expected circuit open error")
    }
    if atomic.LoadInt32(&calls) != prev {
        t.Fatalf("expected no additional HTTP calls when circuit open")
    }
    // Wait cooldown, should try again
    time.Sleep(350 * time.Millisecond)
    _, _ = c.CheckOwnership(context.Background(), "u1", "g1")
}
