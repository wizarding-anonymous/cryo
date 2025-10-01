package main

import (
	"fmt"
	"os"

	"download-service/internal/database"
)

func main() {
	// Get database configuration from environment variables
	host := getEnvOrDefault("DB_HOST", "localhost")
	port := getEnvOrDefault("DB_PORT", "5432")
	user := getEnvOrDefault("DB_USER", "testuser")
	password := getEnvOrDefault("DB_PASSWORD", "testpass")
	dbname := getEnvOrDefault("DB_NAME", "testdb")
	sslmode := getEnvOrDefault("DB_SSL_MODE", "disable")

	// Create DSN
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		host, port, user, password, dbname, sslmode)

	fmt.Printf("Attempting to connect to database with DSN: %s\n", dsn)

	// Connect to database
	db, err := database.Connect(database.Options{DSN: dsn})
	if err != nil {
		fmt.Printf("❌ Failed to connect to database: %v\n", err)
		os.Exit(1)
	}

	// Test health check
	if err := database.HealthCheck(db); err != nil {
		fmt.Printf("❌ Database health check failed: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("✅ Database connection successful!")
}

// getEnvOrDefault returns environment variable value or default if not set
func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}