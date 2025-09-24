import { DocumentBuilder } from '@nestjs/swagger';

export const createSwaggerConfig = (
  title?: string,
  description?: string,
  version?: string,
  serverUrl?: string,
  serverDescription?: string,
) => {
  return new DocumentBuilder()
    .setTitle(title ?? 'Library Service API')
    .setDescription(
      description ??
        `# Library Service API

API for managing user game libraries in the Russian Gaming Platform.

## Overview

This service provides comprehensive library management functionality including:
- **User game library management** - View and manage purchased games
- **Purchase history tracking** - Complete transaction history with details
- **Game ownership verification** - Verify user ownership for downloads
- **Search and filtering capabilities** - Find games quickly in large libraries
- **Integration with external services** - Payment, Game Catalog, and User services

## Authentication

Most endpoints require JWT authentication. Use the 'Authorize' button below to set your JWT token.

### Getting a JWT Token
1. Authenticate with the User Service
2. Copy the returned JWT token
3. Click 'Authorize' and paste the token (without 'Bearer ' prefix)

## Rate Limiting

API requests are rate-limited to ensure fair usage and system stability:
- **Public endpoints**: 100 requests per minute
- **Authenticated endpoints**: 1000 requests per minute
- **Internal endpoints**: No rate limiting

## Error Handling

All endpoints return standardized error responses with:
- **HTTP status codes** following REST conventions
- **Error codes** for programmatic handling
- **Correlation IDs** for request tracking
- **Detailed validation errors** when applicable

## Pagination

List endpoints support pagination with:
- **page**: Page number (default: 1)
- **limit**: Items per page (default: 20, max: 100)
- **sortBy**: Sort field
- **sortOrder**: Sort direction (asc/desc)

## Caching

Responses are cached for performance:
- **Library data**: 5 minutes
- **Search results**: 2 minutes
- **Purchase history**: 10 minutes
- **Purchase details**: 30 minutes

## Monitoring

Service health and metrics are available at:
- **/health** - Basic health check
- **/health/detailed** - Comprehensive health status
- **/health/external** - External services status
- **/metrics** - Prometheus metrics`,
    )
    .setVersion(version ?? '1.0.0')
    .setContact(
      'Library Service Team',
      'https://github.com/your-org/library-service',
      'library-service@yourcompany.com',
    )
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addServer(
      serverUrl ?? 'http://localhost:3000',
      serverDescription ?? 'Development server',
    )
    .addServer('https://api.yourgamingplatform.ru', 'Production server')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token obtained from the authentication service',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Library', 'Game library management endpoints')
    .addTag('Purchase History', 'Purchase history and transaction tracking')
    .addTag('Health', 'Service health monitoring endpoints')
    .addTag('Metrics', 'Prometheus metrics for monitoring')
    .build();
};

export const swaggerOptions = {
  explorer: true,
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'none',
    filter: true,
    showRequestHeaders: true,
    tryItOutEnabled: true,
    defaultModelsExpandDepth: 2,
    defaultModelExpandDepth: 2,
    displayOperationId: false,
    showExtensions: false,
    showCommonExtensions: false,
  },
  customSiteTitle: 'Library Service API Documentation',
  customfavIcon: '/favicon.ico',
  customJs: [
    'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-standalone-preset.min.js',
  ],
  customCssUrl: [
    'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.min.css',
  ],
  customCss: `
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info { margin: 20px 0; }
    .swagger-ui .info .title { color: #3b4151; }
    .swagger-ui .scheme-container { background: #f7f7f7; padding: 15px; margin: 20px 0; }
  `,
};