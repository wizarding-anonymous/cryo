package services

import (
    "context"
    "testing"
    "time"
)

func TestStreamService_StartAndComplete(t *testing.T) {
    ss := NewStreamService()
    done := make(chan struct{})
    ss.Start(context.Background(), "dl1", 0, 1024*10, 1024*10, func(upd StreamUpdate) bool {
        return false
    }, func() {
        close(done)
    })
    select {
    case <-done:
        // ok
    case <-time.After(2 * time.Second):
        t.Fatal("download did not complete in time")
    }
}

func TestStreamService_PauseResume(t *testing.T) {
    ss := NewStreamService()
    progressed := make(chan struct{}, 1)
    ss.Start(context.Background(), "dl2", 0, 1024*100, 1024*50, func(upd StreamUpdate) bool {
        if upd.DownloadedSize > 0 {
            select { case progressed <- struct{}{}: default: }
        }
        return false
    }, nil)
    // Wait first tick
    <-progressed
    ss.Pause("dl2")
    // capture downloaded after pause
    time.Sleep(1100 * time.Millisecond)
    // resume and ensure we get progress again
    ss.Resume("dl2")
    select {
    case <-progressed:
        // might have buffered, wait another tick
    default:
    }
    select {
    case <-progressed:
        // got progress after resume
    case <-time.After(2 * time.Second):
        t.Fatal("no progress after resume")
    }
    ss.Stop("dl2")
}

func TestStreamService_Concurrent(t *testing.T) {
    ss := NewStreamService()
    done1 := make(chan struct{})
    done2 := make(chan struct{})
    ss.Start(context.Background(), "dlA", 0, 1024*10, 1024*10, nil, func(){ close(done1) })
    ss.Start(context.Background(), "dlB", 0, 1024*10, 1024*10, nil, func(){ close(done2) })
    select { case <-done1: case <-time.After(2*time.Second): t.Fatal("dlA timeout") }
    select { case <-done2: case <-time.After(2*time.Second): t.Fatal("dlB timeout") }
}

func BenchmarkStreamService_Session(b *testing.B) {
    for i := 0; i < b.N; i++ {
        ss := NewStreamService()
        done := make(chan struct{})
        ss.Start(context.Background(), "bench", 0, 1024*10, 1024*10, nil, func(){ close(done) })
        <-done
    }
}
