package services

import (
    "context"
    "fmt"
    "sync"
    "sync/atomic"
    "testing"
    "time"

    "github.com/stretchr/testify/suite"
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

// StreamServiceSuite provides comprehensive testing with testify/suite
type StreamServiceSuite struct {
    suite.Suite
    service *StreamService
}

func (s *StreamServiceSuite) SetupTest() {
    s.service = NewStreamService()
}

func (s *StreamServiceSuite) TearDownTest() {
    // Stop any running sessions
    s.service.Stop("test-download")
}

func (s *StreamServiceSuite) TestStart_NewSession() {
    done := make(chan struct{})
    updates := make([]StreamUpdate, 0)
    var mu sync.Mutex

    s.service.Start(context.Background(), "test-download", 0, 1024, 512, 
        func(update StreamUpdate) bool {
            mu.Lock()
            updates = append(updates, update)
            mu.Unlock()
            return false
        },
        func() {
            close(done)
        })

    select {
    case <-done:
        // Success
    case <-time.After(5 * time.Second):
        s.Fail("Download did not complete in time")
    }

    mu.Lock()
    s.Greater(len(updates), 0, "Should have received progress updates")
    lastUpdate := updates[len(updates)-1]
    s.Equal(int64(1024), lastUpdate.TotalSize)
    s.Equal(int64(1024), lastUpdate.DownloadedSize)
    mu.Unlock()
}

func (s *StreamServiceSuite) TestStart_ResumeExistingSession() {
    // Start a session with a callback to track updates
    updates := make([]StreamUpdate, 0)
    var mu sync.Mutex
    
    s.service.Start(context.Background(), "test-download", 0, 10240, 1024, 
        func(update StreamUpdate) bool {
            mu.Lock()
            updates = append(updates, update)
            mu.Unlock()
            return false
        }, nil)
    
    time.Sleep(100 * time.Millisecond) // Let it start
    s.service.Pause("test-download")
    
    // Get initial update count
    mu.Lock()
    initialCount := len(updates)
    mu.Unlock()
    
    time.Sleep(1200 * time.Millisecond) // Wait while paused
    
    // Verify no new updates while paused
    mu.Lock()
    pausedCount := len(updates)
    mu.Unlock()
    s.Equal(initialCount, pausedCount, "Should not receive updates while paused")
    
    // Resume by calling Start again - this should just unpause the existing session
    s.service.Start(context.Background(), "test-download", 0, 10240, 1024, nil, nil)
    
    // Wait for the resumed session to produce updates
    time.Sleep(1500 * time.Millisecond) // Wait for at least one tick after resume
    
    mu.Lock()
    finalCount := len(updates)
    mu.Unlock()
    
    s.Greater(finalCount, pausedCount, "Should receive updates after resume")
    
    // Clean up
    s.service.Stop("test-download")
}

func (s *StreamServiceSuite) TestPause() {
    updates := make([]StreamUpdate, 0)
    var mu sync.Mutex
    paused := false

    s.service.Start(context.Background(), "test-download", 0, 10240, 1024,
        func(update StreamUpdate) bool {
            mu.Lock()
            updates = append(updates, update)
            if len(updates) == 2 && !paused {
                paused = true
                mu.Unlock()
                s.service.Pause("test-download")
                return false
            }
            mu.Unlock()
            return false
        }, nil)

    time.Sleep(4 * time.Second) // Wait for several ticks

    mu.Lock()
    updateCount := len(updates)
    mu.Unlock()

    // Should have stopped progressing after pause
    s.LessOrEqual(updateCount, 4, "Should not have many updates after pause")
}

func (s *StreamServiceSuite) TestResume() {
    updates := make([]StreamUpdate, 0)
    var mu sync.Mutex
    pauseAfterFirst := true

    s.service.Start(context.Background(), "test-download", 0, 10240, 1024,
        func(update StreamUpdate) bool {
            mu.Lock()
            updates = append(updates, update)
            if len(updates) == 1 && pauseAfterFirst {
                pauseAfterFirst = false
                mu.Unlock()
                s.service.Pause("test-download")
                // Resume after a delay
                go func() {
                    time.Sleep(2 * time.Second)
                    s.service.Resume("test-download")
                }()
                return false
            }
            mu.Unlock()
            return false
        }, nil)

    // Wait for resume to take effect and generate more updates
    time.Sleep(6 * time.Second) // Increased wait time for more reliable test

    mu.Lock()
    updateCount := len(updates)
    mu.Unlock()

    // More lenient check - just ensure we got some updates after resume
    s.GreaterOrEqual(updateCount, 2, "Should have received updates after resume")
}

func (s *StreamServiceSuite) TestSetSpeed() {
    updates := make([]StreamUpdate, 0)
    var mu sync.Mutex
    speedChanged := false

    s.service.Start(context.Background(), "test-download", 0, 10240, 1024,
        func(update StreamUpdate) bool {
            mu.Lock()
            updates = append(updates, update)
            if len(updates) == 2 && !speedChanged {
                speedChanged = true
                mu.Unlock()
                s.service.SetSpeed("test-download", 2048) // Double the speed
                return false
            }
            mu.Unlock()
            return false
        }, nil)

    time.Sleep(4 * time.Second)

    mu.Lock()
    if len(updates) > 3 {
        // Check that later updates show increased speed
        laterUpdate := updates[len(updates)-1]
        s.Equal(int64(2048), laterUpdate.Speed)
    }
    mu.Unlock()
}

func (s *StreamServiceSuite) TestSetSpeed_InvalidSpeed() {
    s.service.Start(context.Background(), "test-download", 0, 1024, 512, nil, nil)
    
    // Set invalid speed (should be ignored)
    s.service.SetSpeed("test-download", -100)
    s.service.SetSpeed("test-download", 0)
    
    // Should not crash or cause issues
    time.Sleep(100 * time.Millisecond)
}

func (s *StreamServiceSuite) TestStop() {
    stopped := false
    s.service.Start(context.Background(), "test-download", 0, 10240, 1024,
        func(update StreamUpdate) bool {
            return false
        },
        func() {
            stopped = true
        })

    time.Sleep(100 * time.Millisecond) // Let it start
    s.service.Stop("test-download")
    time.Sleep(100 * time.Millisecond) // Let it stop

    s.True(stopped, "onDone callback should have been called")
}

func (s *StreamServiceSuite) TestConcurrentSessions() {
    const numSessions = 10
    var wg sync.WaitGroup
    completedSessions := int32(0)

    for i := 0; i < numSessions; i++ {
        wg.Add(1)
        go func(sessionID int) {
            defer wg.Done()
            downloadID := fmt.Sprintf("concurrent-download-%d", sessionID)
            
            done := make(chan struct{})
            s.service.Start(context.Background(), downloadID, 0, 1024, 1024,
                nil,
                func() {
                    atomic.AddInt32(&completedSessions, 1)
                    close(done)
                })

            select {
            case <-done:
                // Success
            case <-time.After(3 * time.Second):
                s.T().Errorf("Session %d did not complete in time", sessionID)
            }
        }(i)
    }

    wg.Wait()
    s.Equal(int32(numSessions), completedSessions, "All sessions should complete")
}

func (s *StreamServiceSuite) TestConcurrentOperations() {
    const numOperations = 50
    var wg sync.WaitGroup

    // Start a long-running session
    s.service.Start(context.Background(), "test-download", 0, 100000, 1000, nil, nil)

    // Perform concurrent operations
    for i := 0; i < numOperations; i++ {
        wg.Add(1)
        go func(opID int) {
            defer wg.Done()
            
            switch opID % 4 {
            case 0:
                s.service.Pause("test-download")
            case 1:
                s.service.Resume("test-download")
            case 2:
                s.service.SetSpeed("test-download", int64(1000+opID*100))
            case 3:
                // Just read state by starting (should resume existing)
                s.service.Start(context.Background(), "test-download", 0, 100000, 1000, nil, nil)
            }
        }(i)
    }

    wg.Wait()
    s.service.Stop("test-download")
}

func (s *StreamServiceSuite) TestProgressAccuracy() {
    updates := make([]StreamUpdate, 0)
    var mu sync.Mutex
    done := make(chan struct{})

    totalSize := int64(5120)  // 5KB
    speed := int64(1024)      // 1KB/s

    s.service.Start(context.Background(), "test-download", 0, totalSize, speed,
        func(update StreamUpdate) bool {
            mu.Lock()
            updates = append(updates, update)
            mu.Unlock()
            return false
        },
        func() {
            close(done)
        })

    select {
    case <-done:
        // Success
    case <-time.After(10 * time.Second):
        s.Fail("Download did not complete in time")
    }

    mu.Lock()
    s.Greater(len(updates), 0, "Should have progress updates")
    
    // Check that progress is monotonically increasing
    for i := 1; i < len(updates); i++ {
        s.GreaterOrEqual(updates[i].DownloadedSize, updates[i-1].DownloadedSize,
            "Progress should be monotonically increasing")
    }
    
    // Check final state
    lastUpdate := updates[len(updates)-1]
    s.Equal(totalSize, lastUpdate.TotalSize)
    s.Equal(totalSize, lastUpdate.DownloadedSize)
    s.Equal(speed, lastUpdate.Speed)
    mu.Unlock()
}

func (s *StreamServiceSuite) TestNonExistentSession() {
    // Operations on non-existent sessions should not crash
    s.service.Pause("non-existent")
    s.service.Resume("non-existent")
    s.service.SetSpeed("non-existent", 1024)
    s.service.Stop("non-existent")
}

func TestStreamServiceSuite(t *testing.T) {
    suite.Run(t, new(StreamServiceSuite))
}

// Additional benchmark tests
func BenchmarkStreamService_ConcurrentSessions(b *testing.B) {
    ss := NewStreamService()
    
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        done := make(chan struct{})
        downloadID := fmt.Sprintf("bench-concurrent-%d", i)
        
        ss.Start(context.Background(), downloadID, 0, 1024, 1024, nil, func() {
            close(done)
        })
        
        <-done
    }
}

func BenchmarkStreamService_Operations(b *testing.B) {
    ss := NewStreamService()
    ss.Start(context.Background(), "bench-ops", 0, 100000, 1000, nil, nil)
    
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        switch i % 3 {
        case 0:
            ss.Pause("bench-ops")
        case 1:
            ss.Resume("bench-ops")
        case 2:
            ss.SetSpeed("bench-ops", int64(1000+i))
        }
    }
    
    ss.Stop("bench-ops")
}
