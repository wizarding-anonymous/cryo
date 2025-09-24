package cache

import (
	"context"
	"sync"
	"time"

	redis "github.com/redis/go-redis/v9"
)

// MockRedis implements a simple in-memory Redis mock for testing
type MockRedis struct {
	mu   sync.RWMutex
	data map[string]string
	ttl  map[string]time.Time
}

func NewMockRedis() *MockRedis {
	return &MockRedis{
		data: make(map[string]string),
		ttl:  make(map[string]time.Time),
	}
}

func (m *MockRedis) Set(ctx context.Context, key string, value interface{}, expiration time.Duration) *redis.StatusCmd {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.data[key] = value.(string)
	if expiration > 0 {
		m.ttl[key] = time.Now().Add(expiration)
	} else {
		delete(m.ttl, key)
	}

	cmd := redis.NewStatusCmd(ctx)
	cmd.SetVal("OK")
	return cmd
}

func (m *MockRedis) Get(ctx context.Context, key string) *redis.StringCmd {
	m.mu.RLock()
	defer m.mu.RUnlock()

	cmd := redis.NewStringCmd(ctx)

	// Check if key has expired
	if expiry, exists := m.ttl[key]; exists && time.Now().After(expiry) {
		delete(m.data, key)
		delete(m.ttl, key)
		cmd.SetErr(redis.Nil)
		return cmd
	}

	if value, exists := m.data[key]; exists {
		cmd.SetVal(value)
	} else {
		cmd.SetErr(redis.Nil)
	}

	return cmd
}

func (m *MockRedis) Del(ctx context.Context, keys ...string) *redis.IntCmd {
	m.mu.Lock()
	defer m.mu.Unlock()

	deleted := int64(0)
	for _, key := range keys {
		if _, exists := m.data[key]; exists {
			delete(m.data, key)
			delete(m.ttl, key)
			deleted++
		}
	}

	cmd := redis.NewIntCmd(ctx)
	cmd.SetVal(deleted)
	return cmd
}

func (m *MockRedis) Exists(ctx context.Context, keys ...string) *redis.IntCmd {
	m.mu.RLock()
	defer m.mu.RUnlock()

	count := int64(0)
	for _, key := range keys {
		// Check if key has expired
		if expiry, exists := m.ttl[key]; exists && time.Now().After(expiry) {
			continue
		}
		if _, exists := m.data[key]; exists {
			count++
		}
	}

	cmd := redis.NewIntCmd(ctx)
	cmd.SetVal(count)
	return cmd
}

func (m *MockRedis) Expire(ctx context.Context, key string, expiration time.Duration) *redis.BoolCmd {
	m.mu.Lock()
	defer m.mu.Unlock()

	cmd := redis.NewBoolCmd(ctx)

	if _, exists := m.data[key]; exists {
		m.ttl[key] = time.Now().Add(expiration)
		cmd.SetVal(true)
	} else {
		cmd.SetVal(false)
	}

	return cmd
}

func (m *MockRedis) TTL(ctx context.Context, key string) *redis.DurationCmd {
	m.mu.RLock()
	defer m.mu.RUnlock()

	cmd := redis.NewDurationCmd(ctx, time.Second)

	if expiry, exists := m.ttl[key]; exists {
		remaining := time.Until(expiry)
		if remaining > 0 {
			cmd.SetVal(remaining)
		} else {
			cmd.SetVal(-2 * time.Second) // Key expired
		}
	} else if _, exists := m.data[key]; exists {
		cmd.SetVal(-1 * time.Second) // Key exists but no TTL
	} else {
		cmd.SetVal(-2 * time.Second) // Key doesn't exist
	}

	return cmd
}

func (m *MockRedis) Ping(ctx context.Context) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx)
	cmd.SetVal("PONG")
	return cmd
}

func (m *MockRedis) FlushAll(ctx context.Context) *redis.StatusCmd {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.data = make(map[string]string)
	m.ttl = make(map[string]time.Time)

	cmd := redis.NewStatusCmd(ctx)
	cmd.SetVal("OK")
	return cmd
}

// Helper methods for testing

func (m *MockRedis) Reset() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.data = make(map[string]string)
	m.ttl = make(map[string]time.Time)
}

func (m *MockRedis) Size() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.data)
}

func (m *MockRedis) HasKey(key string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	// Check if key has expired
	if expiry, exists := m.ttl[key]; exists && time.Now().After(expiry) {
		return false
	}
	
	_, exists := m.data[key]
	return exists
}