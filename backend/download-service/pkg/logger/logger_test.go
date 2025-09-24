package logger

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNew(t *testing.T) {
	logger := New()
	assert.NotNil(t, logger)
	
	// Test that it implements the Logger interface
	var _ Logger = logger
}

func TestNewWithConfig(t *testing.T) {
	tests := []struct {
		name   string
		level  string
		format string
	}{
		{"debug json", "debug", "json"},
		{"info json", "info", "json"},
		{"warn json", "warn", "json"},
		{"error json", "error", "json"},
		{"fatal json", "fatal", "json"},
		{"panic json", "panic", "json"},
		{"debug console", "debug", "console"},
		{"info console", "info", "console"},
		{"invalid level", "invalid", "json"},
		{"invalid format", "info", "invalid"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			logger := NewWithConfig(tt.level, tt.format)
			assert.NotNil(t, logger)
			
			// Test that it implements the Logger interface
			var _ Logger = logger
		})
	}
}

func TestZapWrapper(t *testing.T) {
	logger := New()
	
	// Test that methods don't panic
	assert.NotPanics(t, func() {
		logger.Printf("test %s", "message")
	})
	
	assert.NotPanics(t, func() {
		logger.Println("test", "message")
	})
	
	// Note: We can't easily test Fatalf as it would exit the program
}

func TestWith(t *testing.T) {
	logger := New()
	
	// Test With function
	newLogger := With(logger, "key", "value")
	assert.NotNil(t, newLogger)
	
	// Test that it implements the Logger interface
	var _ Logger = newLogger
}

func TestInfo(t *testing.T) {
	logger := New()
	
	// Test that Info doesn't panic
	assert.NotPanics(t, func() {
		Info(logger, "test message", "key", "value")
	})
}

func TestError(t *testing.T) {
	logger := New()
	
	// Test that Error doesn't panic
	assert.NotPanics(t, func() {
		Error(logger, "test error", "key", "value")
	})
}