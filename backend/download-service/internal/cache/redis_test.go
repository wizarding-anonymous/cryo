package cache

import (
	"context"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTestRedis(t *testing.T) *redis.Client {
	// Use a test Redis instance or mock
	// For this test, we'll use a simple in-memory mock
	client := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
		DB:   15, // Use a different DB for tests
	})

	// Clear the test database
	ctx := context.Background()
	client.FlushDB(ctx)

	return client
}

func TestNewClient(t *testing.T) {
	opts := Options{
		Addr:     "localhost:6379",
		Password: "",
		DB:       0,
	}

	client := NewClient(opts)
	assert.NotNil(t, client)
}

func TestPing(t *testing.T) {
	client := setupTestRedis(t)
	ctx := context.Background()

	// This test will skip if Redis is not available
	err := Ping(ctx, client)
	if err != nil {
		t.Skip("Redis not available, skipping test")
	}

	assert.NoError(t, err)
}

func TestSetAndGetDownloadStatus(t *testing.T) {
	client := setupTestRedis(t)
	ctx := context.Background()

	// Skip if Redis is not available
	if err := Ping(ctx, client); err != nil {
		t.Skip("Redis not available, skipping test")
	}

	downloadID := "test-download-123"
	status := DownloadStatusValue{
		Status:         "downloading",
		Progress:       50,
		DownloadedSize: 500000,
		TotalSize:      1000000,
		Speed:          1024,
	}

	// Test Set
	err := SetDownloadStatus(ctx, client, downloadID, status, 5*time.Minute)
	require.NoError(t, err)

	// Test Get
	retrieved, err := GetDownloadStatus(ctx, client, downloadID)
	require.NoError(t, err)
	require.NotNil(t, retrieved)

	assert.Equal(t, status.Status, retrieved.Status)
	assert.Equal(t, status.Progress, retrieved.Progress)
	assert.Equal(t, status.DownloadedSize, retrieved.DownloadedSize)
	assert.Equal(t, status.TotalSize, retrieved.TotalSize)
	assert.Equal(t, status.Speed, retrieved.Speed)
	assert.NotZero(t, retrieved.UpdatedAtUnix)
}

func TestGetNonExistentDownloadStatus(t *testing.T) {
	client := setupTestRedis(t)
	ctx := context.Background()

	// Skip if Redis is not available
	if err := Ping(ctx, client); err != nil {
		t.Skip("Redis not available, skipping test")
	}

	// Test getting non-existent status
	status, err := GetDownloadStatus(ctx, client, "non-existent-id")
	require.NoError(t, err)
	assert.Nil(t, status)
}

func TestDeleteDownloadStatus(t *testing.T) {
	client := setupTestRedis(t)
	ctx := context.Background()

	// Skip if Redis is not available
	if err := Ping(ctx, client); err != nil {
		t.Skip("Redis not available, skipping test")
	}

	downloadID := "test-download-delete"
	status := DownloadStatusValue{
		Status:   "completed",
		Progress: 100,
	}

	// Set status
	err := SetDownloadStatus(ctx, client, downloadID, status, 5*time.Minute)
	require.NoError(t, err)

	// Verify it exists
	retrieved, err := GetDownloadStatus(ctx, client, downloadID)
	require.NoError(t, err)
	require.NotNil(t, retrieved)

	// Delete status
	err = DeleteDownloadStatus(ctx, client, downloadID)
	require.NoError(t, err)

	// Verify it's gone
	retrieved, err = GetDownloadStatus(ctx, client, downloadID)
	require.NoError(t, err)
	assert.Nil(t, retrieved)
}

func TestDownloadStatusTTL(t *testing.T) {
	client := setupTestRedis(t)
	ctx := context.Background()

	// Skip if Redis is not available
	if err := Ping(ctx, client); err != nil {
		t.Skip("Redis not available, skipping test")
	}

	downloadID := "test-download-ttl"
	status := DownloadStatusValue{
		Status:   "downloading",
		Progress: 25,
	}

	// Set with short TTL
	err := SetDownloadStatus(ctx, client, downloadID, status, 100*time.Millisecond)
	require.NoError(t, err)

	// Should exist immediately
	retrieved, err := GetDownloadStatus(ctx, client, downloadID)
	require.NoError(t, err)
	require.NotNil(t, retrieved)

	// Wait for TTL to expire
	time.Sleep(150 * time.Millisecond)

	// Should be gone
	retrieved, err = GetDownloadStatus(ctx, client, downloadID)
	require.NoError(t, err)
	assert.Nil(t, retrieved)
}

func TestDownloadStatusKey(t *testing.T) {
	downloadID := "test-123"
	expected := "dl:test-123:status"
	actual := downloadStatusKey(downloadID)
	assert.Equal(t, expected, actual)
}

func TestDownloadStatusValueSerialization(t *testing.T) {
	client := setupTestRedis(t)
	ctx := context.Background()

	// Skip if Redis is not available
	if err := Ping(ctx, client); err != nil {
		t.Skip("Redis not available, skipping test")
	}

	downloadID := "test-serialization"
	
	// Test with various data types
	status := DownloadStatusValue{
		Status:         "paused",
		Progress:       75,
		DownloadedSize: 750000000, // Large number
		TotalSize:      1000000000,
		Speed:          0, // Zero value
	}

	err := SetDownloadStatus(ctx, client, downloadID, status, 5*time.Minute)
	require.NoError(t, err)

	retrieved, err := GetDownloadStatus(ctx, client, downloadID)
	require.NoError(t, err)
	require.NotNil(t, retrieved)

	assert.Equal(t, status.Status, retrieved.Status)
	assert.Equal(t, status.Progress, retrieved.Progress)
	assert.Equal(t, status.DownloadedSize, retrieved.DownloadedSize)
	assert.Equal(t, status.TotalSize, retrieved.TotalSize)
	assert.Equal(t, status.Speed, retrieved.Speed)
}