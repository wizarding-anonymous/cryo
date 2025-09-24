# Repository Package

This package contains the data access layer for the download service.

## Testing

### CGO Requirements

The repository tests use SQLite for in-memory testing, which requires CGO to be enabled. If CGO is not available (e.g., when `CGO_ENABLED=0`), the tests will be automatically skipped with an appropriate message.

### Running Tests

To run tests with CGO enabled (for full database testing):
```bash
CGO_ENABLED=1 go test ./internal/repository/... -v
```

To run tests without CGO (tests will be skipped):
```bash
CGO_ENABLED=0 go test ./internal/repository/... -v
```

### Test Structure

- `test_helpers.go` - Contains shared test utilities including `setupTestDB()` function
- `download_repository_test.go` - Tests for download repository operations
- `download_file_repository_test.go` - Tests for download file repository operations

The `setupTestDB()` function automatically detects CGO availability and skips tests gracefully when SQLite cannot be used.

## Production Usage

In production, the service uses PostgreSQL which doesn't require CGO. The SQLite dependency is only used for testing purposes.