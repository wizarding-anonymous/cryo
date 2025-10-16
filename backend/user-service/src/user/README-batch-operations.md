# Batch Operations Documentation

## Overview

The BatchService provides optimized batch operations for user management with chunk-based processing, comprehensive error handling, and performance monitoring. This service is designed to handle large volumes of user data efficiently while maintaining data integrity and system performance.

## Features

- **Chunk-based Processing**: Automatically processes large datasets in configurable chunks
- **Comprehensive Error Handling**: Detailed error reporting with continue-on-error options
- **Performance Optimization**: Caching integration and database query optimization
- **Validation**: Input validation for all batch operations
- **Monitoring**: Built-in metrics and logging for performance tracking
- **Security**: Audit logging for all operations

## API Endpoints

### 1. Batch User Creation

**Endpoint**: `POST /batch/users/create`

Creates multiple users with chunk-based processing.

```typescript
// Request Body
{
  "users": [
    {
      "email": "user1@example.com",
      "name": "User One",
      "password": "hashed_password_1"
    },
    {
      "email": "user2@example.com", 
      "name": "User Two",
      "password": "hashed_password_2"
    }
  ],
  "options": {
    "chunkSize": 100,
    "continueOnError": true
  }
}

// Response
{
  "success": true,
  "message": "Successfully created 2 out of 2 users",
  "data": [...], // Array of created users
  "failed": [], // Array of failed operations with errors
  "stats": {
    "total": 2,
    "successful": 2,
    "failed": 0
  }
}
```

### 2. Batch User Lookup

**Endpoint**: `GET /batch/users/lookup?ids=uuid1,uuid2,uuid3&chunkSize=100`

Retrieves multiple users by IDs with caching optimization.

```typescript
// Response
{
  "success": true,
  "message": "Found 3 out of 3 users",
  "data": [...], // Array of users (without passwords)
  "stats": {
    "requested": 3,
    "found": 3,
    "missing": 0
  }
}
```

### 3. Batch User Updates

**Endpoint**: `PATCH /batch/users/update`

Updates multiple users with validation and conflict detection.

```typescript
// Request Body
{
  "updates": [
    {
      "id": "user-uuid-1",
      "data": {
        "name": "Updated Name",
        "email": "newemail@example.com"
      }
    }
  ],
  "options": {
    "chunkSize": 50,
    "continueOnError": true
  }
}
```

### 4. Batch Last Login Update

**Endpoint**: `PATCH /batch/users/last-login`

Updates last login timestamps for multiple users.

```typescript
// Request Body
{
  "userIds": ["uuid1", "uuid2", "uuid3"],
  "options": {
    "chunkSize": 200,
    "continueOnError": true
  }
}
```

### 5. Batch Soft Delete

**Endpoint**: `DELETE /batch/users/soft-delete`

Soft deletes multiple users with audit logging.

```typescript
// Request Body
{
  "userIds": ["uuid1", "uuid2", "uuid3"],
  "options": {
    "chunkSize": 100,
    "continueOnError": false
  }
}
```

## Processing Options

All batch operations support the following options:

```typescript
interface BatchProcessingOptions {
  chunkSize?: number;        // Default: 100, Max: 1000
  maxConcurrency?: number;   // Default: 5, Max: 10
  continueOnError?: boolean; // Default: true
}
```

### Chunk Size Guidelines

- **Small operations (< 100 items)**: Use default chunk size (100)
- **Medium operations (100-1000 items)**: Use chunk size 200-500
- **Large operations (> 1000 items)**: Use chunk size 500-1000
- **Memory-constrained environments**: Use smaller chunks (50-100)

## Error Handling

### Error Response Format

```typescript
{
  "success": false,
  "message": "Batch operation completed with errors",
  "data": [...], // Successfully processed items
  "failed": [
    {
      "item": {...}, // Original item that failed
      "error": "Detailed error message"
    }
  ],
  "stats": {
    "total": 100,
    "successful": 95,
    "failed": 5
  }
}
```

### Common Error Types

1. **Validation Errors**
   - Invalid email format
   - Missing required fields
   - Invalid UUID format

2. **Business Logic Errors**
   - Duplicate email addresses
   - User not found
   - Email already in use by another user

3. **System Errors**
   - Database connection issues
   - Cache service unavailable
   - Processing timeout

### Continue on Error Behavior

- **`continueOnError: true`** (default): Process all items, collect errors
- **`continueOnError: false`**: Stop processing on first error

## Performance Considerations

### Caching Strategy

1. **Read Operations**: Cache-aside pattern with Redis
2. **Write Operations**: Write-through caching with invalidation
3. **Batch Operations**: Bulk cache operations for efficiency

### Database Optimization

1. **Connection Pooling**: Optimized pool size for concurrent operations
2. **Query Batching**: Efficient bulk queries with proper indexing
3. **Transaction Management**: Proper transaction boundaries for data integrity

### Memory Management

1. **Streaming Processing**: Large datasets processed in chunks
2. **Memory Monitoring**: Built-in memory usage tracking
3. **Garbage Collection**: Efficient object lifecycle management

## Monitoring and Metrics

### Built-in Metrics

- `batch_operations_total{operation, status}`: Total batch operations
- `batch_operation_duration_seconds{operation}`: Operation duration
- `batch_chunk_size{operation}`: Average chunk size used
- `batch_error_rate{operation}`: Error rate by operation type

### Logging

All batch operations include structured logging with:

- Operation type and parameters
- Processing duration and chunk information
- Success/failure statistics
- Error details and stack traces
- Correlation IDs for request tracing

## Security Considerations

### Audit Logging

All batch operations are logged to the Security Service with:

- User ID (if available)
- Operation type and timestamp
- IP address and user agent
- Data access patterns

### Data Protection

- Passwords are never returned in responses
- Sensitive data is excluded from logs
- Input validation prevents injection attacks
- Rate limiting protects against abuse

## Usage Examples

### Creating Users in Batches

```typescript
import { BatchService } from './batch.service';

// Inject BatchService
constructor(private readonly batchService: BatchService) {}

// Create users with custom options
const result = await this.batchService.createUsers(
  userDtos,
  {
    chunkSize: 200,
    continueOnError: true
  }
);

console.log(`Created ${result.stats.successful} users`);
if (result.failed.length > 0) {
  console.log('Failed operations:', result.failed);
}
```

### Processing Large Datasets

```typescript
// For very large datasets (10k+ users)
const largeUserList = [...]; // 10,000 users

const result = await this.batchService.createUsers(
  largeUserList,
  {
    chunkSize: 500,        // Larger chunks for efficiency
    maxConcurrency: 3,     // Lower concurrency to avoid overwhelming DB
    continueOnError: true  // Continue processing despite individual failures
  }
);
```

### Error Recovery

```typescript
// Retry failed operations
const initialResult = await this.batchService.createUsers(users);

if (initialResult.failed.length > 0) {
  // Extract failed items and retry
  const failedUsers = initialResult.failed.map(f => f.item);
  
  const retryResult = await this.batchService.createUsers(
    failedUsers,
    { chunkSize: 50, continueOnError: false }
  );
}
```

## Best Practices

1. **Choose Appropriate Chunk Sizes**: Balance memory usage and performance
2. **Monitor Error Rates**: Set up alerts for high error rates
3. **Use Caching Effectively**: Warm up cache for frequently accessed data
4. **Handle Partial Failures**: Always check for failed operations
5. **Log Operations**: Use correlation IDs for request tracing
6. **Test with Load**: Validate performance under expected load
7. **Plan for Rollback**: Have strategies for handling failed batch operations

## Integration with Other Services

### Auth Service Integration

```typescript
// Notify Auth Service of user changes
await this.integrationService.publishUserEvent({
  type: 'USERS_BATCH_CREATED',
  userIds: result.successful.map(u => u.id),
  timestamp: new Date(),
  correlationId: 'batch-op-123'
});
```

### Cache Warming

```typescript
// Warm up cache for frequently accessed users
await this.batchService.processInChunks(
  frequentlyAccessedUserIds,
  100,
  async (chunk) => {
    const users = await this.userRepository.findByIds(chunk);
    await this.cacheService.setUsersBatch(users);
  }
);
```

This documentation provides comprehensive guidance for using the BatchService effectively while maintaining system performance and data integrity.