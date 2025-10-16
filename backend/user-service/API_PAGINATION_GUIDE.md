# User Service API Pagination Guide

## Overview

The User Service now provides standardized API responses with comprehensive pagination and filtering capabilities. This guide covers the new endpoints and their usage.

## Standardized Response Format

All public API endpoints return responses in the following format:

```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "meta": { ... },
  "timestamp": "2023-12-01T10:00:00Z",
  "correlationId": "req_123456789"
}
```

### Response Fields

- `success`: Boolean indicating if the request was successful
- `data`: The actual response data (null for errors)
- `error`: Error message (null for successful requests)
- `meta`: Additional metadata (pagination info, etc.)
- `timestamp`: ISO timestamp of the response
- `correlationId`: Unique identifier for request tracing

## Pagination Types

### 1. Offset-based Pagination

Traditional page-based pagination using `page` and `limit` parameters.

**Parameters:**
- `page`: Page number (1-based, default: 1)
- `limit`: Items per page (1-100, default: 20)

**Example:**
```bash
GET /api/users?page=2&limit=10
```

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "total": 100,
      "page": 2,
      "limit": 10,
      "totalPages": 10,
      "hasNext": true,
      "hasPrevious": true,
      "nextCursor": null,
      "previousCursor": null
    }
  },
  "timestamp": "2023-12-01T10:00:00Z",
  "correlationId": "req_123456789"
}
```

### 2. Cursor-based Pagination

High-performance pagination using cursors, ideal for large datasets.

**Parameters:**
- `cursor`: Base64-encoded cursor for the next page
- `limit`: Items per page (1-100, default: 20)

**Example:**
```bash
GET /api/users?cursor=eyJpZCI6IjEyMyIsImNyZWF0ZWRBdCI6IjIwMjMtMTItMDFUMTA6MDA6MDBaIn0%3D&limit=20
```

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "total": 0,
      "page": 1,
      "limit": 20,
      "totalPages": 0,
      "hasNext": true,
      "hasPrevious": true,
      "nextCursor": "eyJpZCI6IjQ5NiIsImNyZWF0ZWRBdCI6IjIwMjMtMTItMDFUMTE6MDA6MDBaIn0%3D",
      "previousCursor": "eyJpZCI6IjEyMyIsImNyZWF0ZWRBdCI6IjIwMjMtMTItMDFUMTA6MDA6MDBaIn0%3D"
    }
  },
  "timestamp": "2023-12-01T10:00:00Z",
  "correlationId": "req_123456789"
}
```

## Sorting

Both pagination types support sorting:

**Parameters:**
- `sortBy`: Field to sort by (`createdAt`, `updatedAt`, `name`, `email`, `lastLoginAt`)
- `sortOrder`: Sort direction (`asc`, `desc`, default: `desc`)

**Example:**
```bash
GET /api/users?sortBy=name&sortOrder=asc&page=1&limit=20
```

## Filtering

### Available Filters

#### Text Filters (Partial Match, Case-Insensitive)
- `name`: Filter by user name
- `email`: Filter by email address
- `language`: Filter by language preference
- `timezone`: Filter by timezone preference

#### Boolean Filters
- `isActive`: Filter by active status (`true`/`false`)
- `includeDeleted`: Include soft-deleted users (`true`/`false`, default: `false`)

#### Date Range Filters
- `createdFrom`: Filter by creation date from (ISO string)
- `createdTo`: Filter by creation date to (ISO string)
- `lastLoginFrom`: Filter by last login date from (ISO string)
- `lastLoginTo`: Filter by last login date to (ISO string)

### Filter Examples

**Filter by active users created in December 2023:**
```bash
GET /api/users?isActive=true&createdFrom=2023-12-01T00:00:00Z&createdTo=2023-12-31T23:59:59Z
```

**Search for users with "john" in name or email:**
```bash
GET /api/users/search?q=john&limit=10
```

**Filter by language and timezone:**
```bash
GET /api/users?language=en&timezone=UTC&page=1&limit=50
```

## API Endpoints

### 1. List Users with Pagination

```
GET /api/users
```

Retrieves users with pagination, filtering, and sorting.

**Query Parameters:** All pagination, sorting, and filtering parameters listed above.

### 2. Search Users

```
GET /api/users/search
```

Searches users by name or email with pagination support.

**Required Parameters:**
- `q`: Search term for name or email

**Optional Parameters:** All pagination and sorting parameters.

**Example:**
```bash
GET /api/users/search?q=john&sortBy=createdAt&sortOrder=desc&limit=10
```

## Error Handling

Errors are returned in the standardized format:

```json
{
  "success": false,
  "data": null,
  "error": "Search term is required",
  "meta": {
    "code": "VALIDATION_ERROR",
    "path": "/api/users/search",
    "details": {
      "field": "q",
      "value": ""
    }
  },
  "timestamp": "2023-12-01T10:00:00Z",
  "correlationId": "req_123456789"
}
```

### Common Error Codes

- `VALIDATION_ERROR`: Invalid query parameters
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INTERNAL_SERVER_ERROR`: Server error
- `SERVICE_UNAVAILABLE`: Service temporarily unavailable

## Performance Considerations

### When to Use Cursor-based Pagination

- **Large datasets** (>10,000 records)
- **Real-time data** where new records are frequently added
- **Deep pagination** (accessing pages beyond 100)
- **Consistent performance** requirements

### When to Use Offset-based Pagination

- **Small to medium datasets** (<10,000 records)
- **User interfaces** that need page numbers
- **Random page access** requirements
- **Simple implementation** needs

### Best Practices

1. **Use appropriate limits**: Start with 20-50 items per page
2. **Implement caching**: Cache frequently accessed pages
3. **Monitor performance**: Track query execution times
4. **Use indexes**: Ensure proper database indexes for sort fields
5. **Handle errors gracefully**: Implement retry logic for transient errors

## Examples

### JavaScript/TypeScript Client

```typescript
interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  meta?: Record<string, any>;
  timestamp: string;
  correlationId: string;
}

interface PaginatedUsers {
  items: User[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
    nextCursor?: string;
    previousCursor?: string;
  };
}

// Fetch users with offset pagination
async function fetchUsers(page: number = 1, limit: number = 20): Promise<ApiResponse<PaginatedUsers>> {
  const response = await fetch(`/api/users?page=${page}&limit=${limit}`);
  return response.json();
}

// Fetch users with cursor pagination
async function fetchUsersWithCursor(cursor?: string, limit: number = 20): Promise<ApiResponse<PaginatedUsers>> {
  const url = cursor 
    ? `/api/users?cursor=${encodeURIComponent(cursor)}&limit=${limit}`
    : `/api/users?limit=${limit}`;
  const response = await fetch(url);
  return response.json();
}

// Search users
async function searchUsers(query: string, page: number = 1): Promise<ApiResponse<PaginatedUsers>> {
  const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}&page=${page}`);
  return response.json();
}

// Usage examples
const users = await fetchUsers(1, 20);
if (users.success) {
  console.log('Users:', users.data.items);
  console.log('Has next page:', users.data.pagination.hasNext);
}

const searchResults = await searchUsers('john doe');
if (searchResults.success) {
  console.log('Search results:', searchResults.data.items);
}
```

### Python Client

```python
import requests
from typing import Optional, Dict, Any

class UserServiceClient:
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url
        self.headers = {'X-API-Key': api_key}
    
    def fetch_users(self, page: int = 1, limit: int = 20, **filters) -> Dict[str, Any]:
        params = {'page': page, 'limit': limit, **filters}
        response = requests.get(f'{self.base_url}/api/users', 
                              headers=self.headers, params=params)
        return response.json()
    
    def fetch_users_with_cursor(self, cursor: Optional[str] = None, 
                               limit: int = 20) -> Dict[str, Any]:
        params = {'limit': limit}
        if cursor:
            params['cursor'] = cursor
        
        response = requests.get(f'{self.base_url}/api/users', 
                              headers=self.headers, params=params)
        return response.json()
    
    def search_users(self, query: str, page: int = 1, limit: int = 20) -> Dict[str, Any]:
        params = {'q': query, 'page': page, 'limit': limit}
        response = requests.get(f'{self.base_url}/api/users/search', 
                              headers=self.headers, params=params)
        return response.json()

# Usage
client = UserServiceClient('http://localhost:3000', 'your-api-key')

# Fetch active users
users = client.fetch_users(page=1, limit=20, isActive=True)
if users['success']:
    print(f"Found {len(users['data']['items'])} users")

# Search users
results = client.search_users('john')
if results['success']:
    print(f"Search found {len(results['data']['items'])} users")
```

## Migration Guide

### From Old API Format

If you're migrating from the old API format, here are the key changes:

**Old Format:**
```json
{
  "id": "123",
  "name": "John Doe",
  "email": "john@example.com"
}
```

**New Format:**
```json
{
  "success": true,
  "data": {
    "id": "123",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "error": null,
  "timestamp": "2023-12-01T10:00:00Z",
  "correlationId": "req_123456789"
}
```

### Update Your Client Code

1. **Check the `success` field** before accessing data
2. **Access data through `response.data`** instead of directly
3. **Handle errors through `response.error`**
4. **Use `correlationId` for debugging**
5. **Implement pagination using the new parameters**

## Monitoring and Debugging

### Correlation IDs

Every request receives a unique `correlationId` that can be used for:
- **Tracing requests** across services
- **Debugging issues** in logs
- **Performance monitoring**
- **Error tracking**

### Logging

All API calls are logged with:
- Request parameters
- Response times
- Error details
- User context
- Correlation IDs

### Metrics

The service exposes Prometheus metrics for:
- Request counts by endpoint
- Response times
- Error rates
- Pagination usage patterns
- Cache hit/miss ratios

Access metrics at: `http://localhost:3000/metrics`