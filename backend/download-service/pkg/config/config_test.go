package config

import (
	"os"
	"testing"
)

func TestConfig_Validate(t *testing.T) {
	tests := []struct {
		name    string
		config  Config
		wantErr bool
	}{
		{
			name: "valid development config",
			config: Config{
				Env:         "development",
				Port:        8080,
				DatabaseURL: "postgres://localhost/test",
				LogLevel:    "info",
				LogFormat:   "json",
			},
			wantErr: false,
		},
		{
			name: "valid production config",
			config: Config{
				Env:               "production",
				Port:              8080,
				DatabaseURL:       "postgres://localhost/test",
				AuthJwtEnabled:    true,
				AuthJwtSecret:     "secret",
				S3Endpoint:        "https://s3.amazonaws.com",
				S3AccessKeyID:     "key",
				S3SecretAccessKey: "secret",
				S3Bucket:          "bucket",
				LogLevel:          "info",
				LogFormat:         "json",
			},
			wantErr: false,
		},
		{
			name: "invalid environment",
			config: Config{
				Env:       "invalid",
				Port:      8080,
				LogLevel:  "info",
				LogFormat: "json",
			},
			wantErr: true,
		},
		{
			name: "invalid port",
			config: Config{
				Env:       "development",
				Port:      -1,
				LogLevel:  "info",
				LogFormat: "json",
			},
			wantErr: true,
		},
		{
			name: "invalid log level",
			config: Config{
				Env:       "development",
				Port:      8080,
				LogLevel:  "invalid",
				LogFormat: "json",
			},
			wantErr: true,
		},
		{
			name: "invalid log format",
			config: Config{
				Env:       "development",
				Port:      8080,
				LogLevel:  "info",
				LogFormat: "invalid",
			},
			wantErr: true,
		},
		{
			name: "production missing JWT secret",
			config: Config{
				Env:            "production",
				Port:           8080,
				DatabaseURL:    "postgres://localhost/test",
				AuthJwtEnabled: true,
				LogLevel:       "info",
				LogFormat:      "json",
			},
			wantErr: true,
		},
		{
			name: "production missing S3 config",
			config: Config{
				Env:            "production",
				Port:           8080,
				DatabaseURL:    "postgres://localhost/test",
				AuthJwtEnabled: false,
				LogLevel:       "info",
				LogFormat:      "json",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.config.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Config.Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestLoad(t *testing.T) {
	// Save original env vars
	originalEnv := make(map[string]string)
	envVars := []string{
		"APP_ENV", "PORT", "DATABASE_URL", "LOG_LEVEL", "LOG_FORMAT",
	}
	for _, key := range envVars {
		originalEnv[key] = os.Getenv(key)
	}

	// Clean up after test
	defer func() {
		for key, value := range originalEnv {
			if value == "" {
				os.Unsetenv(key)
			} else {
				os.Setenv(key, value)
			}
		}
	}()

	// Set test environment variables
	os.Setenv("APP_ENV", "test")
	os.Setenv("PORT", "9090")
	os.Setenv("LOG_LEVEL", "debug")
	os.Setenv("LOG_FORMAT", "console")

	cfg := Load()

	if cfg.Env != "test" {
		t.Errorf("Expected Env to be 'test', got %s", cfg.Env)
	}
	if cfg.Port != 9090 {
		t.Errorf("Expected Port to be 9090, got %d", cfg.Port)
	}
	if cfg.LogLevel != "debug" {
		t.Errorf("Expected LogLevel to be 'debug', got %s", cfg.LogLevel)
	}
	if cfg.LogFormat != "console" {
		t.Errorf("Expected LogFormat to be 'console', got %s", cfg.LogFormat)
	}
}

func TestGetenv(t *testing.T) {
	// Test with existing env var
	os.Setenv("TEST_VAR", "test_value")
	defer os.Unsetenv("TEST_VAR")

	result := getenv("TEST_VAR", "default")
	if result != "test_value" {
		t.Errorf("Expected 'test_value', got %s", result)
	}

	// Test with non-existing env var
	result = getenv("NON_EXISTING_VAR", "default")
	if result != "default" {
		t.Errorf("Expected 'default', got %s", result)
	}
}

func TestGetint(t *testing.T) {
	// Test with valid int
	os.Setenv("TEST_INT", "123")
	defer os.Unsetenv("TEST_INT")

	result := getint("TEST_INT", 456)
	if result != 123 {
		t.Errorf("Expected 123, got %d", result)
	}

	// Test with invalid int
	os.Setenv("TEST_INVALID_INT", "not_a_number")
	defer os.Unsetenv("TEST_INVALID_INT")

	result = getint("TEST_INVALID_INT", 456)
	if result != 456 {
		t.Errorf("Expected 456 (default), got %d", result)
	}

	// Test with non-existing env var
	result = getint("NON_EXISTING_INT", 789)
	if result != 789 {
		t.Errorf("Expected 789 (default), got %d", result)
	}
}