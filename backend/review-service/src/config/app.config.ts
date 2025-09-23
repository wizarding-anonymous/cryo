import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  environment: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret-key',
  
  // External service URLs
  services: {
    library: process.env.LIBRARY_SERVICE_URL || 'http://localhost:3001',
    gameCatalog: process.env.GAME_CATALOG_SERVICE_URL || 'http://localhost:3002',
    achievement: process.env.ACHIEVEMENT_SERVICE_URL || 'http://localhost:3004',
    notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005',
  },

  // API configuration
  api: {
    prefix: 'api/v1',
    version: '1.0.0',
    title: 'Review Service API',
    description: 'API for managing game reviews and ratings',
  },

  // Pagination defaults
  pagination: {
    defaultLimit: 10,
    maxLimit: 50,
  },

  // Review configuration
  review: {
    minTextLength: 10,
    maxTextLength: 1000,
    minRating: 1,
    maxRating: 5,
  },

  // Cache configuration
  cache: {
    ratingTtl: 300, // 5 minutes for game ratings
    reviewTtl: 60,  // 1 minute for review lists
  },
}));