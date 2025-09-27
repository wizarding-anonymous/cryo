# Game Catalog Service - API Documentation

## Overview

The Game Catalog Service provides a comprehensive REST API for managing and accessing game catalog information. This service is designed for high performance with caching, full-text search capabilities, and integration with other microservices in the gaming platform.

## Base URL

- **Development**: `http://localhost:3002`
- **Production**: `https://api.gaming-platform.ru` (via API Gateway)

## Authentication

Currently, the Game Catalog Service operates as a read-only public API for browsing games. Authentication is not required for basic catalog operations.

For future admin operations (adding/updating games), JWT authentication will be implemented.

## API Versioning

The API uses URL path versioning:
- Current version: `v1`
- Base path: `/api/v1` (health endpoints)
- Games endpoints: `/api/games` (current version)

## Rate Limiting

- **Development**: No rate limiting
- **Production**: 100 requests per minute per IP address

## Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "data": {
    // Response data here
  },
  "metadata": {
    "timestamp": "2023-01-15T10:30:00Z",
    "requestId": "req_123456789",
    "version": "1.0.0"
  }
}
```

### Error Response
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "statusCode": 400,
    "timestamp": "2023-01-15T10:30:00Z",
    "path": "/api/games",
    "details": [
      {
        "field": "page",
        "message": "Page must be at least 1",
        "value": 0
      }
    ]
  }
}
```

## Endpoints

### 1. Get Games List

Retrieve a paginated list of games with optional filtering and sorting.

**Endpoint**: `GET /api/games`

**Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | No | 1 | Page number (1-based) |
| `limit` | integer | No | 10 | Items per page (1-100) |
| `sortBy` | string | No | - | Sort field: `title`, `price`, `releaseDate`, `createdAt` |
| `sortOrder` | string | No | ASC | Sort order: `ASC`, `DESC` |
| `genre` | string | No | - | Filter by genre |
| `available` | boolean | No | - | Filter by availability |

**Example Request**:
```bash
GET /api/games?page=1&limit=20&sortBy=title&sortOrder=ASC&genre=Action%20RPG&available=true
```

**Example Response**:
```json
{
  "games": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "title": "Cyberpunk 2077",
      "description": "An open-world, action-adventure story set in Night City...",
      "shortDescription": "Futuristic RPG in Night City",
      "price": 2999.99,
      "currency": "RUB",
      "genre": "Action RPG",
      "developer": "CD Projekt RED",
      "publisher": "CD Projekt",
      "releaseDate": "2020-12-10T00:00:00Z",
      "images": [
        "https://cdn.gaming-platform.ru/games/cyberpunk2077/screenshot1.jpg",
        "https://cdn.gaming-platform.ru/games/cyberpunk2077/screenshot2.jpg"
      ],
      "systemRequirements": {
        "minimum": "OS: Windows 10, CPU: Intel i3, RAM: 4GB, GPU: GTX 1050",
        "recommended": "OS: Windows 11, CPU: Intel i5, RAM: 8GB, GPU: GTX 1660"
      },
      "available": true,
      "createdAt": "2023-01-15T10:30:00Z"
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 20,
  "totalPages": 8,
  "hasNext": true,
  "hasPrevious": false
}
```

**Response Codes**:
- `200 OK`: Success
- `400 Bad Request`: Invalid parameters
- `500 Internal Server Error`: Server error

### 2. Get Game Details

Retrieve detailed information about a specific game.

**Endpoint**: `GET /api/games/{id}`

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Game unique identifier |

**Example Request**:
```bash
GET /api/games/123e4567-e89b-12d3-a456-426614174000
```

**Example Response**:
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "title": "Cyberpunk 2077",
  "description": "An open-world, action-adventure story set in Night City, a megalopolis obsessed with power, glamour and body modification. You play as V, a mercenary outlaw going after a one-of-a-kind implant that is the key to immortality.",
  "shortDescription": "Futuristic RPG in Night City",
  "price": 2999.99,
  "currency": "RUB",
  "genre": "Action RPG",
  "developer": "CD Projekt RED",
  "publisher": "CD Projekt",
  "releaseDate": "2020-12-10T00:00:00Z",
  "images": [
    "https://cdn.gaming-platform.ru/games/cyberpunk2077/cover.jpg",
    "https://cdn.gaming-platform.ru/games/cyberpunk2077/screenshot1.jpg",
    "https://cdn.gaming-platform.ru/games/cyberpunk2077/screenshot2.jpg",
    "https://cdn.gaming-platform.ru/games/cyberpunk2077/screenshot3.jpg"
  ],
  "systemRequirements": {
    "minimum": "OS: Windows 10 64-bit, Processor: Intel Core i5-3570K or AMD FX-8310, Memory: 8 GB RAM, Graphics: NVIDIA GeForce GTX 780 or AMD Radeon RX 470, DirectX: Version 12, Storage: 70 GB available space",
    "recommended": "OS: Windows 10 64-bit, Processor: Intel Core i7-4790 or AMD Ryzen 3 3200G, Memory: 12 GB RAM, Graphics: NVIDIA GeForce GTX 1060 6GB or AMD Radeon R9 Fury, DirectX: Version 12, Storage: 70 GB available space (SSD recommended)"
  },
  "available": true,
  "createdAt": "2023-01-15T10:30:00Z"
}
```

**Response Codes**:
- `200 OK`: Success
- `400 Bad Request`: Invalid game ID format
- `404 Not Found`: Game not found
- `500 Internal Server Error`: Server error

### 3. Search Games

Search for games using full-text search with various filters.

**Endpoint**: `GET /api/games/search`

**Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | No | - | Search query (1-255 characters) |
| `searchType` | string | No | title | Search type: `title`, `description`, `all` |
| `page` | integer | No | 1 | Page number (1-based) |
| `limit` | integer | No | 10 | Items per page (1-100) |
| `minPrice` | number | No | - | Minimum price filter |
| `maxPrice` | number | No | - | Maximum price filter |
| `sortBy` | string | No | - | Sort field |
| `sortOrder` | string | No | ASC | Sort order |
| `genre` | string | No | - | Filter by genre |
| `available` | boolean | No | - | Filter by availability |

**Example Request**:
```bash
GET /api/games/search?q=cyberpunk&searchType=title&minPrice=1000&maxPrice=5000&page=1&limit=10
```

**Example Response**:
```json
{
  "games": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "title": "Cyberpunk 2077",
      "shortDescription": "Futuristic RPG in Night City",
      "price": 2999.99,
      "currency": "RUB",
      "genre": "Action RPG",
      "available": true
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10,
  "totalPages": 1,
  "hasNext": false,
  "hasPrevious": false
}
```

**Response Codes**:
- `200 OK`: Success (even if no results found)
- `400 Bad Request`: Invalid search parameters
- `500 Internal Server Error`: Server error

### 4. Get Game Purchase Information

Retrieve purchase-specific information for a game (used by Payment Service).

**Endpoint**: `GET /api/games/{id}/purchase-info`

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Game unique identifier |

**Example Request**:
```bash
GET /api/games/123e4567-e89b-12d3-a456-426614174000/purchase-info
```

**Example Response**:
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "title": "Cyberpunk 2077",
  "price": 2999.99,
  "currency": "RUB",
  "available": true
}
```

**Response Codes**:
- `200 OK`: Success
- `400 Bad Request`: Invalid game ID format
- `404 Not Found`: Game not found or not available for purchase
- `500 Internal Server Error`: Server error

**Integration Notes**:
- This endpoint is specifically designed for Payment Service integration
- Returns only essential fields required for payment processing
- Implements strict availability validation for purchase operations
- See [Payment Service Integration Documentation](./PAYMENT_SERVICE_INTEGRATION.md) for detailed integration guide

## Health Check Endpoints

### 1. Comprehensive Health Check

**Endpoint**: `GET /api/v1/health`

**Response**:
```json
{
  "status": "ok",
  "info": {
    "database": {
      "status": "up",
      "message": "Database connection is healthy"
    },
    "redis": {
      "status": "up",
      "message": "Redis connection is healthy"
    },
    "memory_heap": {
      "status": "up"
    },
    "memory_rss": {
      "status": "up"
    },
    "application": {
      "status": "up",
      "uptime": "3600s",
      "memory": {
        "rss": "128MB",
        "heapUsed": "64MB",
        "heapTotal": "96MB"
      },
      "nodeVersion": "v18.17.0",
      "environment": "production"
    }
  },
  "error": {},
  "details": {
    "database": {
      "status": "up",
      "message": "Database connection is healthy"
    },
    "redis": {
      "status": "up",
      "message": "Redis connection is healthy"
    },
    "memory_heap": {
      "status": "up"
    },
    "memory_rss": {
      "status": "up"
    },
    "application": {
      "status": "up",
      "uptime": "3600s",
      "memory": {
        "rss": "128MB",
        "heapUsed": "64MB",
        "heapTotal": "96MB"
      },
      "nodeVersion": "v18.17.0",
      "environment": "production"
    }
  }
}
```

### 2. Readiness Probe

**Endpoint**: `GET /api/v1/health/ready`

Checks if the service is ready to accept traffic.

### 3. Liveness Probe

**Endpoint**: `GET /api/v1/health/live`

Checks if the service is alive and should not be restarted.

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `GAME_NOT_FOUND` | 404 | Game not found |
| `SEARCH_ERROR` | 400 | Search parameters invalid |
| `DATABASE_ERROR` | 500 | Database operation failed |
| `CACHE_ERROR` | 500 | Cache operation failed |
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected server error |

## Caching

The API implements intelligent caching to improve performance:

### Cache Strategy
- **Game Lists**: 10 minutes TTL
- **Individual Games**: 30 minutes TTL
- **Search Results**: 5 minutes TTL
- **Purchase Info**: 15 minutes TTL

### Cache Headers
Responses include cache-related headers:
```
Cache-Control: public, max-age=600
ETag: "abc123def456"
Last-Modified: Mon, 15 Jan 2023 10:30:00 GMT
```

## Performance

### Response Time Targets
- **Game List**: < 100ms (95th percentile)
- **Game Details**: < 50ms (95th percentile)
- **Search**: < 200ms (95th percentile)
- **Health Checks**: < 10ms (95th percentile)

### Pagination Limits
- **Maximum page size**: 100 items
- **Default page size**: 10 items
- **Maximum search results**: 1000 items

## Integration Examples

### JavaScript/TypeScript
```typescript
interface Game {
  id: string;
  title: string;
  price: number;
  currency: string;
  available: boolean;
}

interface GameListResponse {
  games: Game[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
}

class GameCatalogClient {
  private baseUrl = 'http://localhost:3002/api';

  async getGames(page = 1, limit = 10): Promise<GameListResponse> {
    const response = await fetch(`${this.baseUrl}/games?page=${page}&limit=${limit}`);
    return response.json();
  }

  async getGame(id: string): Promise<Game> {
    const response = await fetch(`${this.baseUrl}/games/${id}`);
    if (!response.ok) {
      throw new Error(`Game not found: ${id}`);
    }
    return response.json();
  }

  async searchGames(query: string, options: any = {}): Promise<GameListResponse> {
    const params = new URLSearchParams({
      q: query,
      ...options
    });
    const response = await fetch(`${this.baseUrl}/games/search?${params}`);
    return response.json();
  }
}
```

### Python
```python
import requests
from typing import Dict, List, Optional

class GameCatalogClient:
    def __init__(self, base_url: str = "http://localhost:3002/api"):
        self.base_url = base_url

    def get_games(self, page: int = 1, limit: int = 10, **filters) -> Dict:
        params = {"page": page, "limit": limit, **filters}
        response = requests.get(f"{self.base_url}/games", params=params)
        response.raise_for_status()
        return response.json()

    def get_game(self, game_id: str) -> Dict:
        response = requests.get(f"{self.base_url}/games/{game_id}")
        response.raise_for_status()
        return response.json()

    def search_games(self, query: str, **options) -> Dict:
        params = {"q": query, **options}
        response = requests.get(f"{self.base_url}/games/search", params=params)
        response.raise_for_status()
        return response.json()

    def get_purchase_info(self, game_id: str) -> Dict:
        response = requests.get(f"{self.base_url}/games/{game_id}/purchase-info")
        response.raise_for_status()
        return response.json()
```

## Monitoring and Metrics

### Prometheus Metrics

Available at `/metrics` endpoint:

- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - Request duration histogram
- `game_catalog_cache_hits_total` - Cache hit counter
- `game_catalog_cache_misses_total` - Cache miss counter
- `game_catalog_search_queries_total` - Search query counter
- `nodejs_heap_size_used_bytes` - Node.js heap usage
- `nodejs_heap_size_total_bytes` - Node.js total heap size

### Custom Business Metrics

- `game_catalog_total_games` - Total games in catalog
- `game_catalog_available_games` - Available games count
- `game_catalog_popular_searches` - Most popular search terms
- `game_catalog_response_time_p95` - 95th percentile response time

## Changelog

### Version 1.0.0 (Current)
- Initial release with basic game catalog functionality
- Full-text search implementation
- Caching with Redis
- Health checks and monitoring
- Payment Service integration endpoints
- Comprehensive API documentation
- 100% test coverage

### Planned Features (Future Versions)
- Game recommendations API
- Advanced filtering (tags, categories)
- Game reviews integration
- Admin API for game management
- GraphQL API support
- Real-time notifications
- Advanced analytics endpoints

## Support

For API support:
- Check this documentation
- Review Swagger documentation at `/api-docs`
- Check service health at `/api/v1/health`
- Contact development team for issues

---

**Game Catalog Service API Documentation v1.0.0**