# Payment Service Integration Documentation

## Overview

This document describes the integration between the Game Catalog Service and the Payment Service for the MVP Russian gaming platform. The integration provides essential game information required for payment processing operations.

## Integration Endpoint

### GET /api/games/:id/purchase-info

**Purpose**: Provides purchase-specific information for a game to the Payment Service.

**URL**: `/api/games/{gameId}/purchase-info`

**Method**: `GET`

**Authentication**: None required (internal service communication)

**Parameters**:
- `gameId` (path parameter): UUID of the game

**Response Format**:
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "title": "Cyberpunk 2077",
  "price": 2999.99,
  "currency": "RUB",
  "available": true
}
```

**Response Fields**:
- `id` (string): Unique game identifier (UUID)
- `title` (string): Game title for order display
- `price` (number): Game price with decimal precision
- `currency` (string): ISO 4217 currency code (3 characters)
- `available` (boolean): Game availability for purchase

## Error Handling

### HTTP Status Codes

| Status Code | Description | Scenario |
|-------------|-------------|----------|
| 200 | OK | Game found and available for purchase |
| 400 | Bad Request | Invalid game ID format (not UUID) |
| 404 | Not Found | Game not found or not available for purchase |
| 500 | Internal Server Error | Database or system error |

### Error Response Format

```json
{
  "error": {
    "code": "GAME_NOT_FOUND",
    "message": "Game with ID \"123e4567-e89b-12d3-a456-426614174000\" not found",
    "statusCode": 404,
    "timestamp": "2023-01-15T10:30:00Z",
    "path": "/api/games/123e4567-e89b-12d3-a456-426614174000/purchase-info"
  }
}
```

### Error Scenarios

1. **Game Not Found**: Returns 404 when game ID doesn't exist
2. **Game Unavailable**: Returns 404 when game exists but is not available for purchase
3. **Invalid UUID**: Returns 400 when game ID is not a valid UUID format
4. **Database Error**: Returns 500 for internal database issues

## Business Logic

### Availability Validation

The endpoint implements strict availability validation:

1. **Primary Check**: Game must exist in the database
2. **Availability Check**: Game's `available` field must be `true`
3. **Consistency Check**: Both conditions must be met for successful response

### Price and Currency Validation

- **Price Format**: Always returned as a number with decimal precision
- **Currency Code**: Always 3-character ISO 4217 format (e.g., "RUB", "USD", "EUR")
- **Type Safety**: Price is explicitly cast to number to ensure Payment Service compatibility

## Integration Examples

### Node.js/TypeScript Example

```typescript
interface PurchaseInfo {
  id: string;
  title: string;
  price: number;
  currency: string;
  available: boolean;
}

class PaymentServiceClient {
  private catalogServiceUrl = 'http://game-catalog-service:3002';

  async getGamePurchaseInfo(gameId: string): Promise<PurchaseInfo> {
    const response = await fetch(
      `${this.catalogServiceUrl}/api/games/${gameId}/purchase-info`
    );
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Game ${gameId} not found or unavailable for purchase`);
      }
      throw new Error(`Failed to get purchase info: ${response.statusText}`);
    }
    
    return response.json();
  }

  async validateGameForPurchase(gameId: string): Promise<boolean> {
    try {
      const purchaseInfo = await this.getGamePurchaseInfo(gameId);
      return purchaseInfo.available && purchaseInfo.price > 0;
    } catch (error) {
      return false;
    }
  }
}
```

### Python Example

```python
import requests
from typing import Dict, Optional

class PaymentServiceClient:
    def __init__(self, catalog_service_url: str = "http://game-catalog-service:3002"):
        self.catalog_service_url = catalog_service_url

    def get_game_purchase_info(self, game_id: str) -> Optional[Dict]:
        """Get purchase information for a game."""
        url = f"{self.catalog_service_url}/api/games/{game_id}/purchase-info"
        
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 404:
                raise ValueError(f"Game {game_id} not found or unavailable")
            raise
        except requests.exceptions.RequestException as e:
            raise ConnectionError(f"Failed to connect to catalog service: {e}")

    def validate_game_for_purchase(self, game_id: str) -> bool:
        """Validate if a game is available for purchase."""
        try:
            purchase_info = self.get_game_purchase_info(game_id)
            return purchase_info.get('available', False) and purchase_info.get('price', 0) > 0
        except (ValueError, ConnectionError):
            return False
```

## Performance Considerations

### Caching Strategy

- **Cache TTL**: 15 minutes for purchase info (shorter than regular game data)
- **Cache Key**: `game_purchase_{gameId}`
- **Cache Invalidation**: Automatic on game updates or availability changes

### Response Time Targets

- **Target Response Time**: < 200ms (95th percentile)
- **Timeout Configuration**: 8 seconds (critical for payment flow)
- **Concurrent Requests**: Supports high concurrency for payment processing

## Security Considerations

### Input Validation

- **UUID Validation**: Strict UUID format validation for game IDs
- **SQL Injection Protection**: Parameterized queries prevent injection attacks
- **Rate Limiting**: Standard API rate limiting applies

### Data Privacy

- **Minimal Data Exposure**: Only essential purchase information is returned
- **No Sensitive Data**: Personal information, detailed descriptions, or internal metadata excluded
- **Audit Logging**: All purchase info requests are logged for audit purposes

## Monitoring and Alerting

### Key Metrics

- `game_catalog_purchase_info_requests_total` - Total purchase info requests
- `game_catalog_purchase_info_errors_total` - Purchase info request errors
- `game_catalog_purchase_info_response_time` - Response time histogram
- `game_catalog_unavailable_games_total` - Count of unavailable game requests

### Health Checks

The purchase info endpoint is included in the service health checks:

```bash
# Health check includes purchase info functionality
GET /api/v1/health
```

### Alerting Rules

1. **High Error Rate**: Alert if error rate > 5% over 5 minutes
2. **Slow Response**: Alert if 95th percentile > 500ms over 5 minutes
3. **Service Unavailable**: Alert if endpoint returns 5xx errors consistently

## Testing

### Unit Tests

Comprehensive unit tests cover:
- Valid purchase info retrieval
- Price and currency validation
- Availability checks
- Error scenarios
- Edge cases (free games, maximum prices)

### Integration Tests

End-to-end tests verify:
- Complete request/response cycle
- Database integration
- Cache behavior
- Error handling

### Load Testing

Performance tests ensure:
- Concurrent request handling
- Response time under load
- Cache effectiveness
- Database connection pooling

## Deployment Configuration

### Environment Variables

```bash
# Database connection
DATABASE_URL=postgresql://user:pass@postgres-catalog-db:5432/game_catalog

# Redis cache
REDIS_URL=redis://redis-cache:6379

# Service configuration
PORT=3002
NODE_ENV=production

# Logging
LOG_LEVEL=info
```

### Docker Configuration

```dockerfile
# Dockerfile includes health check for purchase info endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3002/api/v1/health || exit 1
```

### Kubernetes Deployment

```yaml
# Kubernetes deployment includes readiness probe
readinessProbe:
  httpGet:
    path: /api/v1/health/ready
    port: 3002
  initialDelaySeconds: 10
  periodSeconds: 5
```

## Troubleshooting

### Common Issues

1. **404 Errors**: Check if game exists and is available
2. **Timeout Errors**: Verify database connectivity and performance
3. **Cache Issues**: Check Redis connection and cache invalidation
4. **UUID Format Errors**: Ensure proper UUID format in requests

### Debug Commands

```bash
# Check service health
curl http://game-catalog-service:3002/api/v1/health

# Test purchase info endpoint
curl http://game-catalog-service:3002/api/games/{gameId}/purchase-info

# Check logs
kubectl logs -f deployment/game-catalog-service
```

## API Versioning

Current version: `v1` (implicit)

Future versions will be explicitly versioned:
- `v2`: Enhanced purchase info with additional fields
- `v3`: Real-time availability updates

## Support and Maintenance

### Contact Information

- **Development Team**: Game Platform Backend Team
- **On-Call**: Available 24/7 for production issues
- **Documentation**: Updated with each release

### Change Management

All changes to the purchase info endpoint require:
1. Payment Service team approval
2. Backward compatibility verification
3. Integration test updates
4. Documentation updates

---

**Last Updated**: December 2023  
**Version**: 1.0.0  
**Status**: Production Ready